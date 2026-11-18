// CDR timestamps and durations use milliseconds. Historical timestamps may use seconds.
export const formatCallTime = value => {
  let timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '-'
  // Match the legacy timestamp range supported by the backend's CdrTimes.
  if (timestamp >= 1_000_000_000 && timestamp < 100_000_000_000) timestamp *= 1000
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false })
}

export const formatCallDuration = value => {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '00:00'
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
