export function parseGatewayAddress(address = '') {
  const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(address)
  if (!match) return { host: address, port: undefined }
  return { host: match[1].replace(/^\[|\]$/g, ''), port: match[2] ? Number(match[2]) : undefined }
}

export function gatewayHostError(value) {
  const host = String(value || '')
  if (!host || host !== host.trim() || /[\s/@?#]/.test(host)) return '请输入 IP 或域名，不包含协议、路径或端口'
  try {
    const url = new URL(`http://${host.includes(':') ? `[${host}]` : host}`)
    if (url.port || url.pathname !== '/' || url.username || url.password) throw new Error()
    if (!host.includes(':') && !/^[a-zA-Z0-9.-]+$/.test(host)) throw new Error()
    return ''
  } catch { return '请输入有效的 IP 或域名，端口请填入端口栏' }
}

export function formatGatewayAddress(host, port) {
  const error = gatewayHostError(host)
  if (error) throw new Error(error)
  if (port != null && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('端口须为 1–65535 的整数')
  const address = host.includes(':') ? `[${host}]` : host
  return port == null ? address : `${address}:${port}`
}

export function buildSipGatewayPayload(form) {
  if (!Number.isSafeInteger(form.companyId) || form.companyId < 0) throw new Error('企业ID须为非负整数，0 表示不绑定企业')
  if (!form.username || form.username.length < 2 || form.username.length > 16) throw new Error('网关账号须为 2–16 个字符')
  if (!form.passwd || form.passwd.length < 2 || form.passwd.length > 16) throw new Error('网关密码须为 2–16 个字符')
  return {
    ...(form.id != null ? { id: form.id } : {}),
    companyId: form.companyId, username: form.username, passwd: form.passwd,
    registerAddr: formatGatewayAddress(form.host, form.port)
  }
}
