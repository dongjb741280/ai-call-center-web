export const SIP_BATCH_LIMIT = 100

// AgentSip.sip is an Integer in voxai-admin; keep the API's string representation.
export function sipNumberError(value) {
  const sip = String(value ?? '')
  return /^[1-9]\d{4,9}$/.test(sip) && Number(sip) <= 2147483647
    ? '' : '分机号须为 5–10 位数字，不以 0 开头，最大为 2147483647'
}

export function sipPasswordError(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 16 && value.trim() === value
    ? '' : '密码须为 8–16 个字符，首尾不能有空格'
}

export function buildSipRange(start, end) {
  const error = sipNumberError(start) || sipNumberError(end)
  if (error) throw new Error(error)
  const count = Number(end) - Number(start) + 1
  if (count < 1) throw new Error('结束号码不能小于开始号码')
  if (count > SIP_BATCH_LIMIT) throw new Error(`每批最多创建 ${SIP_BATCH_LIMIT} 个分机`)
  return Array.from({ length: count }, (_, index) => String(Number(start) + index))
}

export function requireApiSuccess(response) {
  if (!response || response.code !== 0) {
    const error = new Error(response?.message || '操作未成功，请检查后重试')
    error.businessFailure = response?.code != null
    throw error
  }
  return response.data
}

// Check every number before enabling writes. Existing entries are never updated.
export async function checkSipBatch(rows, lookup, shouldStop = () => false) {
  for (const row of rows) {
    if (shouldStop()) return false
    row.status = 'checking'
    try {
      const data = requireApiSuccess(await lookup({
        pageNum: 1, pageSize: 1, query: JSON.stringify({ sip: row.sip })
      }))
      if (!Array.isArray(data?.list)) throw new Error('分机列表响应异常，请重新检查')
      row.status = data.list.some(item => String(item.sip) === row.sip) ? 'exists' : 'pending'
    } catch (error) {
      row.status = 'checkFailed'
      row.message = error.message || '检查失败'
      throw error
    }
  }
  return !shouldStop()
}

// Each POST commits independently. Stop on failure; never retry an uncertain write.
export async function createSipBatch(rows, password, create, shouldStop = () => false) {
  const error = sipPasswordError(password)
  if (error) throw new Error(error)
  for (const row of rows) {
    if (shouldStop()) break
    if (row.status !== 'pending') continue
    row.status = 'creating'
    try {
      requireApiSuccess(await create({ sip: row.sip, sipPwd: password }))
      row.status = 'success'
    } catch (error) {
      row.status = error.businessFailure ? 'failed' : 'uncertain'
      row.message = error.businessFailure
        ? error.message : '未能确认创建结果，请刷新分机列表核对后再操作'
      break
    }
  }
}
