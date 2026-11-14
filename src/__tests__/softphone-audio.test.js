import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import SoftPhone from '@/views/SoftPhone.vue'

const mocks = vi.hoisted(() => ({ ua: null }))
vi.mock('@/utils/callSdk', () => ({ default: class {
  init() {} addEventListener() {} logout() {}
} }))
vi.mock('@/api/softphone', () => ({ agentLogin: vi.fn().mockResolvedValue({ code: 0, data: {
  token: 'test', sips: ['1002'], sipPwd: 'test'
} }) }))
vi.mock('@/api/config', () => ({
  getAgentConfigList: vi.fn().mockResolvedValue({ code: 0, data: { list: [] } }),
  getStationList: vi.fn().mockResolvedValue({ code: 0, data: { list: [] } })
}))
vi.mock('jssip', () => ({
  UA: class extends EventEmitter {
    constructor() { super(); mocks.ua = this }
    start() {} stop() {}
  },
  WebSocketInterface: class {}
}))

describe('incoming SIP audio', () => {
  let wrapper, oscillator, play, context
  beforeEach(async () => {
    vi.useFakeTimers()
    oscillator = { connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
    context = {
      state: 'suspended', currentTime: 0, destination: {},
      resume: vi.fn().mockResolvedValue(), suspend: vi.fn().mockResolvedValue(), close: vi.fn(),
      createGain: () => ({ gain: { value: 0 }, connect: vi.fn() }),
      createOscillator: () => ({ ...oscillator, frequency: { value: 0 } })
    }
    vi.stubGlobal('AudioContext', class { constructor() { return context } })
    vi.stubGlobal('MediaStream', class {
      constructor(tracks = []) { this.tracks = tracks }
      getTracks() { return this.tracks }
      getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio') }
      addTrack(track) { this.tracks.push(track) }
    })
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    wrapper = shallowMount(SoftPhone, { attachTo: document.body })
    await wrapper.vm.handleConnect()
    await flushPromises()
  })
  afterEach(() => {
    wrapper.unmount()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function incoming() {
    const session = new EventEmitter()
    const pc = new EventTarget()
    pc.getReceivers = function () {
      if (this !== pc) throw new TypeError('Illegal invocation')
      return []
    }
    pc.getSenders = () => []
    session.answer = vi.fn(function () {
      this.connection = pc
      this.emit('peerconnection', { peerconnection: this.connection })
      const event = new Event('track')
      event.track = { kind: 'audio', id: 'remote', readyState: 'live' }
      event.streams = [] // WebRTC permits streamless track events.
      pc.dispatchEvent(event)
    })
    session.terminate = vi.fn()
    session.remote_identity = { uri: { user: '1005' } }
    mocks.ua.emit('newRTCSession', { originator: 'remote', session })
    return session
  }

  it('rings for direct SIP calls without a platform WebSocket event', () => {
    incoming()
    expect(wrapper.vm.callState).toBe('RINGING')
    expect(oscillator.start).toHaveBeenCalled()
    expect(context.resume).toHaveBeenCalled()
  })

  it('binds streamless remote tracks during answer, before accepted', async () => {
    incoming()
    wrapper.vm.handleAcceptCall()
    expect(play).toHaveBeenCalled() // Starts in the answer click before RTP/track arrival.
    await flushPromises()
    const audio = wrapper.find('audio').element
    expect(audio.srcObject?.getAudioTracks()).toEqual([expect.objectContaining({ id: 'remote' })])
    expect(play).toHaveBeenCalled()
  })

  it('collects media counters from the current raw WebRTC session', async () => {
    const session = incoming()
    wrapper.vm.handleAcceptCall()
    session.connection.getStats = vi.fn().mockResolvedValue(new Map([
      ['in', { type: 'inbound-rtp', kind: 'audio', bytesReceived: 1200 }],
      ['out', { type: 'outbound-rtp', kind: 'audio', bytesSent: 600 }]
    ]))
    session.emit('accepted')
    await vi.advanceTimersByTimeAsync(5000)
    expect(session.connection.getStats).toHaveBeenCalled()
    expect(wrapper.vm.messages.some(message => message.content.includes('发送 600 B / 接收 1200 B'))).toBe(true)
  })

  it('reports blocked playback and lets the user retry', async () => {
    play.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    incoming()
    wrapper.vm.handleAcceptCall()
    await flushPromises()
    expect(wrapper.vm.audioPlaybackBlocked).toBe(true)
    play.mockResolvedValue()
    await wrapper.vm.retryCallAudio()
    expect(wrapper.vm.audioPlaybackBlocked).toBe(false)
  })

  it('does not misreport an interrupted play as an autoplay restriction', async () => {
    play.mockRejectedValue(new DOMException('interrupted by a new load request', 'AbortError'))
    incoming()
    wrapper.vm.handleAcceptCall()
    await flushPromises()
    expect(wrapper.vm.audioPlaybackBlocked).toBe(false)
    expect(wrapper.vm.messages.some(message => message.content.includes('AbortError'))).toBe(false)
  })

  it('stops the ringtone immediately on answer and clears audio on failure', async () => {
    const session = incoming()
    wrapper.vm.handleAcceptCall()
    expect(context.suspend).toHaveBeenCalled()
    await flushPromises()
    session.emit('failed', { cause: 'Canceled', originator: 'remote' })
    expect(wrapper.find('audio').element.srcObject).toBeNull()
    const starts = oscillator.start.mock.calls.length
    await vi.advanceTimersByTimeAsync(6500)
    expect(oscillator.start).toHaveBeenCalledTimes(starts)
  })
})
