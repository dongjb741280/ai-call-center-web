import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElDatePicker } from 'element-plus'
import OutboundReport from '@/views/call/OutboundReport.vue'
import InboundReport from '@/views/call/InboundReport.vue'
import IvrReport from '@/views/call/IvrReport.vue'
import * as api from '@/api/config'

vi.mock('@/api/config', () => ({
  getCallMonitorList: vi.fn(),
  getCallDeviceList: vi.fn(),
  getCallDetailList: vi.fn(),
  getIvrFlowList: vi.fn(),
  getCallRecordingUrl: vi.fn(),
}))

const callTime = new Date(2026, 10, 18, 10, 20, 30).getTime()
const answerTime = callTime + 12005
const endTime = answerTime + 4560
const displayTime = value => new Date(value).toLocaleString('zh-CN', { hour12: false })
const call = {
  callId: 'test-call', callTime, answerTime, endTime,
  talkTime: 4560, recordStartTime: answerTime, recordTime: 4560,
  queueStartTime: callTime, queueEndTime: answerTime, waitTime: 12005,
}
let wrapper

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  api.getCallMonitorList.mockResolvedValue({ code: 0, data: { list: [call], total: 1 } })
  api.getCallDeviceList.mockResolvedValue({ code: 0, data: [{ ...call, deviceId: 'test-device' }] })
  api.getCallDetailList.mockResolvedValue({ code: 0, data: [{ startTime: callTime, endTime }] })
  api.getIvrFlowList.mockResolvedValue({ code: 0, data: [{ nodeId: 'test-node', startTime: callTime, endTime }] })
  api.getCallRecordingUrl.mockResolvedValue({ code: 0, data: 'http://localhost:9000/cc-record/test.wav?signature=test' })
})
afterEach(() => wrapper?.unmount())

const open = async component => {
  wrapper = mount(component, {
    global: {
      plugins: [ElementPlus],
      stubs: { ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } },
    },
  })
  await flushPromises()
}
const click = async label => {
  await wrapper.findAll('button').find(button => button.text() === label).trigger('click')
  await flushPromises()
}
const columnText = (table, label) => {
  const index = table.findAll('thead th').findIndex(header => header.text() === label)
  expect(index).toBeGreaterThanOrEqual(0)
  return table.findAll('tbody tr')[0].findAll('td')[index].text()
}

describe.each([
  ['外呼报表', OutboundReport], ['呼入报表', InboundReport], ['IVR报表', IvrReport],
])('%s的毫秒话单', (_name, component) => {
  it('按毫秒显示拨打、应答、结束时间以及通话和录音时长', async () => {
    await open(component)
    if (component === InboundReport) {
      expect(JSON.parse(api.getCallMonitorList.mock.lastCall[0].query).direction).toBe('INBOUND')
    }
    const table = wrapper.find('.el-table')
    expect(columnText(table, '拨打时间')).toBe(displayTime(callTime))
    expect(columnText(table, '应答时间')).toBe(displayTime(answerTime))
    expect(columnText(table, '结束时间')).toBe(displayTime(endTime))
    expect(columnText(table, '通话时长')).toBe('00:04')
    expect(columnText(table, '录音时长')).toBe('00:04')
  })

  it('时间筛选传递日期选择器的毫秒值', async () => {
    await open(component)
    await wrapper.findComponent(ElDatePicker).vm.$emit('update:modelValue', [String(callTime), String(endTime)])
    await click('搜索')
    expect(JSON.parse(api.getCallMonitorList.mock.lastCall[0].query)).toMatchObject({ start: callTime, end: endTime })
    await click('重置')
    const resetQuery = JSON.parse(api.getCallMonitorList.mock.lastCall[0].query)
    expect(resetQuery).not.toHaveProperty('start')
    expect(resetQuery).not.toHaveProperty('end')
  })
})

it.each([callTime, String(callTime), Math.floor(callTime / 1000), String(Math.floor(callTime / 1000))])(
  '外呼时间兼容数字和字符串形式的毫秒及历史秒时间戳：%s', async timestamp => {
    api.getCallMonitorList.mockResolvedValue({ code: 0, data: { list: [{ ...call, callTime: timestamp }], total: 1 } })
    await open(OutboundReport)
    expect(columnText(wrapper.find('.el-table'), '拨打时间')).toBe(displayTime(callTime))
  },
)

it.each([
  [null, '00:00'], [0, '00:00'], [999, '00:00'], [1000, '00:01'],
  [61001, '01:01'], ['76000', '01:16'], [3600000, '60:00'],
])('外呼时长按毫秒换算并舍去不足一秒的部分：%s', async (duration, expected) => {
  api.getCallMonitorList.mockResolvedValue({ code: 0, data: { list: [{ ...call, talkTime: duration }], total: 1 } })
  await open(OutboundReport)
  expect(columnText(wrapper.find('.el-table'), '通话时长')).toBe(expected)
})

it.each([null, 0, '0', -1, 'invalid'])('空值或无效的外呼时间显示占位符：%s', async timestamp => {
  api.getCallMonitorList.mockResolvedValue({ code: 0, data: { list: [{ ...call, callTime: timestamp }], total: 1 } })
  await open(OutboundReport)
  expect(columnText(wrapper.find('.el-table'), '拨打时间')).toBe('-')
})

it.each([OutboundReport, InboundReport])('话单详情、设备、呼叫流程和IVR流程均按毫秒显示：%s', async component => {
  await open(component)
  await click('详情')
  expect(api.getCallDeviceList).toHaveBeenCalledWith(call.callId)
  expect(api.getCallDetailList).toHaveBeenCalledWith(call.callId)
  expect(api.getIvrFlowList).toHaveBeenCalledWith(call.callId)
  const basic = wrapper.find('.el-descriptions')
  expect(basic.text()).toContain(displayTime(callTime))
  expect(basic.text()).toContain(displayTime(answerTime))
  expect(basic.text()).toContain(displayTime(endTime))
  expect(basic.text()).toContain('00:04')
  expect(basic.text()).toContain('00:12')
  const device = wrapper.find('.device-card')
  expect(device.text()).toContain(displayTime(answerTime))
  expect(device.text()).toContain('00:04')
  const tables = wrapper.findAll('.el-table')
  for (const table of tables.slice(1)) {
    expect(columnText(table, '开始时间')).toBe(displayTime(callTime))
    expect(columnText(table, '结束时间')).toBe(displayTime(endTime))
  }
})

it('呼入详情的单个接口失败时保留其他详情并显示失败提示', async () => {
  api.getCallDeviceList.mockRejectedValueOnce(new Error('network'))
  await open(InboundReport)
  await click('详情')
  expect(wrapper.text()).toContain('设备明细加载失败，请重试')
  const flow = wrapper.findAll('.el-table')[1]
  expect(columnText(flow, '开始时间')).toBe(displayTime(callTime))
})

it('快速切换呼入话单时清理旧字段，并忽略上一条未完成的详情请求', async () => {
  api.getCallMonitorList.mockResolvedValue({ code: 0, data: { list: [{ ...call, agentName: '旧坐席' }, { callId: 'second-call' }], total: 2 } })
  let resolveDevices
  api.getCallDeviceList.mockReturnValueOnce(new Promise(resolve => { resolveDevices = resolve }))
    .mockResolvedValueOnce({ code: 0, data: [] })
  await open(InboundReport)
  await click('详情')
  await wrapper.findAll('button').filter(button => button.text() === '详情')[1].trigger('click')
  await flushPromises()
  expect(wrapper.find('.el-descriptions').text()).not.toContain('旧坐席')
  resolveDevices({ code: 0, data: [{ ...call, deviceId: 'stale-device' }] })
  await flushPromises()
  expect(wrapper.find('.device-card').exists()).toBe(false)
})

describe.each([['外呼', OutboundReport], ['呼入', InboundReport]])('%s录音播放', (_name, component) => {
  const recordingCall = { ...call, record: '/cc-record/test.wav' }
  beforeEach(() => {
    api.getCallMonitorList.mockResolvedValue({ code: 0, data: { list: [recordingCall], total: 1 } })
  })

  it('通过话单ID取得临时地址，并直接绑定到音频元素', async () => {
    await open(component)
    await click('播放')
    expect(api.getCallRecordingUrl).toHaveBeenCalledWith(call.callId)
    expect(wrapper.find('audio').attributes('src')).toBe('http://localhost:9000/cc-record/test.wav?signature=test')
    expect(wrapper.find('audio source').exists()).toBe(false)
  })

  it('切换录音创建新的播放器，关闭时停止播放并清理地址', async () => {
    api.getCallMonitorList.mockResolvedValue({ code: 0, data: { list: [recordingCall, { ...recordingCall, callId: 'second-call' }], total: 2 } })
    api.getCallRecordingUrl.mockResolvedValueOnce({ code: 0, data: 'http://localhost:9000/cc-record/first.wav?signed=1' })
      .mockResolvedValueOnce({ code: 0, data: 'http://localhost:9000/cc-record/second.wav?signed=2' })
    await open(component)
    await click('播放')
    const first = wrapper.find('audio').element
    await wrapper.findAll('button').filter(button => button.text() === '播放')[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('audio').element).not.toBe(first)
    expect(wrapper.find('audio').attributes('src')).toContain('second.wav')
    await click('关闭')
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('文件不可用时显示明确提示，不挂载空播放器', async () => {
    api.getCallRecordingUrl.mockResolvedValue({ code: 1106, message: '录音文件暂不可用' })
    await open(component)
    await click('播放')
    expect(wrapper.text()).toContain('录音文件暂不可用')
    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('请求失败及媒体加载失败时显示提示', async () => {
    api.getCallRecordingUrl.mockRejectedValueOnce(new Error('network'))
    await open(component)
    await click('播放')
    expect(wrapper.text()).toContain('获取录音失败，请稍后重试')
    await click('播放')
    await wrapper.find('audio').trigger('error')
    expect(wrapper.text()).toContain('录音加载失败，请重新打开后重试')
  })

  it('关闭后忽略尚未完成的播放地址请求', async () => {
    let resolveUrl
    api.getCallRecordingUrl.mockReturnValue(new Promise(resolve => { resolveUrl = resolve }))
    await open(component)
    await click('播放')
    await click('关闭')
    resolveUrl({ code: 0, data: 'http://localhost:9000/cc-record/late.wav?signed=1' })
    await flushPromises()
    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('没有录音地址时明确显示无录音', async () => {
    api.getCallMonitorList.mockResolvedValue({ code: 0, data: { list: [call], total: 1 } })
    await open(component)
    expect(columnText(wrapper.find('.el-table'), '录音')).toBe('无录音')
    expect(wrapper.findAll('button').some(button => button.text() === '播放')).toBe(false)
  })
})
