import { describe, it, expect } from 'vitest'
import { parseGatewayAddress, formatGatewayAddress, buildSipGatewayPayload } from '@/utils/sipGateway'

describe('SIP gateway address and request contract', () => {
  it.each(['sip.example.com:5060', '192.0.2.1:7450', '[2001:db8::1]:5061', 'sip.example.com'])('round trips %s without changing the address', address => {
    const { host, port } = parseGatewayAddress(address)
    expect(formatGatewayAddress(host, port)).toBe(address)
  })
  it.each(['https://sip.example.com', 'sip.example.com/path', 'user@sip.example.com', 'bad host', 'sip.example.com:5060', '999.999.999.999'])('rejects invalid host %s', host => {
    expect(() => formatGatewayAddress(host, 5060)).toThrow()
  })
  it.each([0, 65536, 5060.5, '5060'])('rejects invalid port %s', port => {
    expect(() => formatGatewayAddress('sip.example.com', port)).toThrow('端口')
  })
  it('sends companyId and registerAddr, excluding UI fields and companyCode', () => {
    expect(buildSipGatewayPayload({ id: 7, companyId: 2, companyCode: 'legacy', username: 'gateway', passwd: 'test-pass', host: 'sip.example.com', port: 5060 })).toEqual({
      id: 7, companyId: 2, username: 'gateway', passwd: 'test-pass', registerAddr: 'sip.example.com:5060'
    })
  })
  it('allows an unbound gateway using companyId 0', () => {
    expect(buildSipGatewayPayload({ companyId: 0, username: 'gateway', passwd: 'test-pass', host: 'sip.example.com', port: 5060 }).companyId).toBe(0)
  })
})
