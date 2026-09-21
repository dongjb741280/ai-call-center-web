import { describe, it, expect, vi } from 'vitest'
import { buildSipRange, checkSipBatch, createSipBatch, sipNumberError, sipPasswordError } from '@/utils/sipProvisioning'

const rowsFor = (...sips) => sips.map(sip => ({ sip, status: 'unchecked', message: '' }))
const available = () => Promise.resolve({ code: 0, data: { list: [] } })

describe('SIP number ranges', () => {
  it('includes both endpoints and preserves the API string type', () => {
    expect(buildSipRange('950001', '950003')).toEqual(['950001', '950002', '950003'])
    expect(buildSipRange('2147483647', '2147483647')).toEqual(['2147483647'])
  })
  it.each(['1234', '01234', '95000.1', '95000e1', 'abcde', '2147483648', '9999999999999999', ' 950001'])('rejects unsupported number %s', value => {
    expect(sipNumberError(value)).not.toBe('')
    expect(() => buildSipRange(value, value)).toThrow()
  })
  it('rejects backwards and oversized batches', () => {
    expect(() => buildSipRange('950003', '950001')).toThrow('结束号码')
    expect(() => buildSipRange('950001', '950101')).toThrow('100')
    expect(buildSipRange('950001', '950100')).toHaveLength(100)
  })
  it('enforces the password length and prevents server-side trimming', () => {
    expect(sipPasswordError('test-pass')).toBe('')
    for (const password of ['', 'short', ' test-pass', 'test-pass ', 'a'.repeat(17)]) {
      expect(sipPasswordError(password)).not.toBe('')
    }
  })
})

describe('SIP batch provisioning', () => {
  it('checks exact numbers, skips existing extensions, and never overwrites them', async () => {
    const rows = rowsFor('950001', '950002', '950003')
    const lookup = vi.fn().mockImplementationOnce(() => ({ code: 0, data: { list: [{ sip: 950001 }] } })).mockImplementation(available)
    expect(await checkSipBatch(rows, lookup)).toBe(true)
    expect(lookup.mock.calls[0][0]).toEqual({ pageNum: 1, pageSize: 1, query: '{"sip":"950001"}' })
    const create = vi.fn().mockResolvedValue({ code: 0 })
    await createSipBatch(rows, 'test-pass', create)
    expect(create.mock.calls.map(([data]) => data)).toEqual([
      { sip: '950002', sipPwd: 'test-pass' }, { sip: '950003', sipPwd: 'test-pass' }
    ])
    expect(rows.map(row => row.status)).toEqual(['exists', 'success', 'success'])
  })
  it('does not mark the batch checked after a read failure', async () => {
    const rows = rowsFor('950001', '950002')
    await expect(checkSipBatch(rows, vi.fn().mockResolvedValue({ code: 403, message: '无权查询' }))).rejects.toThrow('无权查询')
    expect(rows.map(row => row.status)).toEqual(['checkFailed', 'unchecked'])
  })
  it('rejects malformed read responses instead of assuming numbers are available', async () => {
    await expect(checkSipBatch(rowsFor('950001'), () => ({ code: 0 }))).rejects.toThrow('响应异常')
  })
  it('stops on an HTTP 200 business failure and keeps previous successes', async () => {
    const rows = rowsFor('950001', '950002', '950003')
    await checkSipBatch(rows, available)
    const create = vi.fn().mockResolvedValueOnce({ code: 0 }).mockResolvedValueOnce({ code: 1001, message: '分机已存在' })
    await createSipBatch(rows, 'test-pass', create)
    expect(create).toHaveBeenCalledTimes(2)
    expect(rows.map(row => row.status)).toEqual(['success', 'failed', 'pending'])
    expect(rows[1].message).toBe('分机已存在')
  })
  it('does not automatically retry an ambiguous network failure', async () => {
    const rows = rowsFor('950001', '950002')
    await checkSipBatch(rows, available)
    const create = vi.fn().mockRejectedValue(new Error('timeout'))
    await createSipBatch(rows, 'test-pass', create)
    expect(create).toHaveBeenCalledTimes(1)
    expect(rows.map(row => row.status)).toEqual(['uncertain', 'pending'])
  })
  it('waits for the current write and stops before starting the next one', async () => {
    const rows = rowsFor('950001', '950002')
    await checkSipBatch(rows, available)
    let resolveWrite
    let stopped = false
    const create = vi.fn(() => new Promise(resolve => { resolveWrite = resolve }))
    const running = createSipBatch(rows, 'test-pass', create, () => stopped)
    expect(rows[0].status).toBe('creating')
    expect(create).toHaveBeenCalledTimes(1)
    stopped = true
    resolveWrite({ code: 0 })
    await running
    expect(rows.map(row => row.status)).toEqual(['success', 'pending'])
    expect(create).toHaveBeenCalledTimes(1)
  })
  it('supports stopping the preflight check without any writes', async () => {
    const rows = rowsFor('950001')
    const lookup = vi.fn()
    expect(await checkSipBatch(rows, lookup, () => true)).toBe(false)
    expect(lookup).not.toHaveBeenCalled()
  })
})
