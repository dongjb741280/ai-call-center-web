<template>
  <div class="softphone-page">
    <div class="softphone-container">
      <!-- 左侧：控制面板 -->
      <div class="panel-left">
        <!-- 连接与状态 -->
        <el-card shadow="hover" class="card-compact">
          <template #header>
            <div class="card-header">
              <el-icon><Key /></el-icon>
              <span>连接</span>
              <el-tag v-if="connected" :type="agentState === 'READY' ? 'success' : 'warning'" size="small" class="ml-1">
                {{ agentState === 'READY' ? '空闲' : agentState === 'NOT_READY' ? '忙碌' : agentState || '' }}
              </el-tag>
              <el-tag v-if="sipRegistered" type="success" size="small" class="ml-1">SIP</el-tag>
            </div>
          </template>
          <el-form :model="loginForm" label-width="56px" size="small" class="form-compact">
            <el-form-item label="账号">
              <el-select v-model="loginForm.agentKey" filterable :loading="agentLoading" placeholder="选择坐席" size="small" style="width: 100%">
                <el-option v-for="a in agentOptions" :key="a.agentKey" :label="a.agentName ? `${a.agentKey} - ${a.agentName}` : a.agentKey" :value="a.agentKey" />
              </el-select>
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="loginForm.passwd" type="password" show-password placeholder="坐席密码" size="small" />
            </el-form-item>
            <el-row :gutter="6">
              <el-col :span="12">
                <el-form-item label="接听">
                  <el-select v-model="loginForm.loginType" size="small">
                    <el-option label="SIP" :value="1" />
                    <el-option label="WebRTC" :value="2" />
                    <el-option label="手机" :value="3" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="模式">
                  <el-select v-model="loginForm.workType" size="small">
                    <el-option label="普通" :value="1" />
                    <el-option label="预测" :value="2" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
          <div class="card-actions">
            <el-button type="primary" @click="handleConnect" :loading="connecting" :disabled="connected" size="small">
              <el-icon><Link /></el-icon> 连接
            </el-button>
            <el-button type="danger" @click="handleLogout" :disabled="!connected" size="small">
              <el-icon><SwitchButton /></el-icon> 登出
            </el-button>
            <el-button type="warning" @click="handleBusy" :disabled="!connected" size="small" plain>
              忙碌
            </el-button>
            <el-button type="success" @click="handleReady" :disabled="!connected" size="small" plain>
              空闲
            </el-button>
          </div>
        </el-card>

        <!-- 通话控制 -->
        <el-card shadow="hover" class="card-compact">
          <template #header>
            <div class="card-header">
              <el-icon><Phone /></el-icon>
              <span>通话控制</span>
              <el-tag v-if="callState" type="danger" size="small" class="ml-1">{{ callState }}</el-tag>
            </div>
          </template>
          <div class="call-section">
            <el-button v-if="audioPlaybackBlocked" type="warning" size="small" @click="retryCallAudio">启用通话声音</el-button>
            <div class="call-row">
              <el-input v-model="phoneNum" placeholder="被叫号码" size="small" style="flex: 1" />
              <el-button type="primary" @click="handleMakeCall" :disabled="!connected" size="small">
                <el-icon><PhoneFilled /></el-icon> 外呼
              </el-button>
              <el-button type="success" @click="handleAcceptCall" :disabled="!connected" size="small">应答</el-button>
              <el-button type="danger" @click="handleHangup" :disabled="!connected" size="small">挂机</el-button>
            </div>
            <div class="call-row">
              <el-input v-model="transferNum" placeholder="转接目标" size="small" style="flex: 1" />
              <el-button @click="handleTransfer" :disabled="!connected" type="warning" size="small">转接</el-button>
            </div>
            <div class="call-row">
              <el-input v-model="consultNum" placeholder="咨询目标" size="small" style="flex: 1" />
              <el-button @click="handleConsult" :disabled="!connected" type="warning" size="small">咨询</el-button>
              <el-button @click="handleConsultCancel" :disabled="!connected" type="danger" size="small" plain>
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <div class="call-row">
              <el-input v-model="consultTransferNum" placeholder="咨询转接目标" size="small" style="flex: 1" />
              <el-button @click="handleConsultTransfer" :disabled="!connected" type="warning" size="small">咨询转</el-button>
              <el-button @click="handleConsultParty" :disabled="!connected" type="success" size="small">
                <el-icon><Connection /></el-icon>
              </el-button>
            </div>
            <el-divider />
            <div class="card-actions">
              <el-button @click="handleMute" :disabled="!connected" type="warning" size="small" plain>静音</el-button>
              <el-button @click="handleCancelMute" :disabled="!connected" type="success" size="small" plain>取消静音</el-button>
              <el-button @click="handleHold" :disabled="!connected" type="warning" size="small">保持</el-button>
              <el-button @click="handleCancelHold" :disabled="!connected" type="success" size="small">取消保持</el-button>
            </div>
          </div>
        </el-card>

        <!-- 班长监控 -->
        <el-card shadow="hover" class="card-compact">
          <template #header>
            <div class="card-header">
              <el-icon><View /></el-icon>
              <span>班长监控</span>
            </div>
          </template>
          <div class="call-row">
            <el-input v-model="monitorTarget" placeholder="目标坐席" size="small" style="flex: 1" />
            <el-button @click="handleListen" :disabled="!connected" type="info" size="small" plain>监听</el-button>
            <el-button @click="handleInsert" :disabled="!connected" type="warning" size="small" plain>强插</el-button>
            <el-button @click="handleWhisper" :disabled="!connected" type="danger" size="small" plain>耳语</el-button>
          </div>
        </el-card>
      </div>

      <!-- 右侧：消息日志 -->
      <div class="panel-right">
        <el-card shadow="hover" class="message-card">
          <template #header>
            <div class="card-header">
              <el-icon><ChatLineSquare /></el-icon>
              <span>消息日志</span>
              <el-button size="small" @click="clearMessages" style="margin-left: auto">清除</el-button>
            </div>
          </template>
          <div class="message-body" ref="messageBodyRef">
            <div v-if="messages.length === 0" class="message-empty">暂无消息</div>
            <div v-for="(msg, index) in messages" :key="index" class="message-item">
              <span class="message-time">{{ msg.time }}</span>
              <span :class="['message-type', msg.level]">{{ msg.type }}</span>
              <pre class="message-content">{{ msg.content }}</pre>
            </div>
          </div>
        </el-card>
      </div>
    </div>
    <audio id="sipRemoteAudio" autoplay playsinline hidden></audio>
  </div>
</template>

<script setup>
import { ref, shallowRef, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { agentLogin } from '@/api/softphone'
import { getAgentConfigList, getStationList } from '@/api/config'
import { UA, WebSocketInterface } from 'jssip'
import CallSdk from '@/utils/callSdk'

const connecting = ref(false)
const connected = ref(false)
const agentState = ref('')
const callState = ref('')
const phoneNum = ref('1005')
const transferNum = ref('1005')
const consultNum = ref('1005')
const consultTransferNum = ref('1005')
const monitorTarget = ref('1005')
const messages = ref([])
const messageBodyRef = ref(null)
const agentToken = ref('')
const sipRegistered = ref(false)
// JsSIP 持有原生 WebRTC 对象，不能让 Vue 深度代理其 PeerConnection/MediaStream。
const sipSession = shallowRef(null)
const audioPlaybackBlocked = ref(false)
const isOutgoingCall = ref(false) // 标记是否是主动外呼（A-leg），需自动接听
const agentOptions = ref([])
const agentLoading = ref(false)

let voxaiInstance = null
let sipUa = null
let ringbackCtx = null      // 持久AudioContext，避免重复创建导致浏览器限制
let ringbackTimer = null
let ringbackActive = false  // 控制振铃音开关
let mediaStatsTimer = null
let audioPlaySequence = 0

const playRemoteAudio = async () => {
  const audio = document.getElementById('sipRemoteAudio')
  if (!audio?.srcObject) return
  const sequence = ++audioPlaySequence
  audio.muted = false
  audio.volume = 1
  try {
    await audio.play()
    if (sequence === audioPlaySequence) audioPlaybackBlocked.value = false
  } catch (error) {
    // A newer play()/stream replacement or call cleanup can abort an older
    // pending play. This is not an autoplay permission failure.
    if (sequence !== audioPlaySequence || error.name === 'AbortError') return
    audioPlaybackBlocked.value = true
    addMessage('SIP', `通话声音未播放: ${error.name}，请点击“启用通话声音”`, 'error')
  }
}

const retryCallAudio = () => playRemoteAudio()

const clearCallAudio = () => {
  audioPlaySequence++
  if (mediaStatsTimer) { clearInterval(mediaStatsTimer); mediaStatsTimer = null }
  const audio = document.getElementById('sipRemoteAudio')
  if (audio) { audio.pause(); audio.srcObject = null }
  audioPlaybackBlocked.value = false
}

// 在连接按钮的用户手势中解锁来电铃声，避免等到异步 SIP 来电才创建 AudioContext。
const prepareRingtone = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  if (!ringbackCtx) ringbackCtx = new AudioContext()
  if (ringbackCtx.state === 'suspended') {
    ringbackCtx.resume().catch(error => addMessage('SIP', `请点击页面启用铃声: ${error.message}`, 'warning'))
  }
}

const loginForm = reactive({
  agentKey: 'agent1001',
  passwd: '12345678',
  loginType: 2,
  workType: 1,
  // fsHost / fsPort 由 loadStation() 从后台站点表填充，registerSip 内有兜底
  fsHost: '',
  fsPort: null
})

const loadAgents = async () => {
  agentLoading.value = true
  try {
    const res = await getAgentConfigList({ pageNum: 1, pageSize: 1000 })
    if (res.code === 0) {
      agentOptions.value = res.data?.list || []
    }
  } catch { /* empty */ }
  finally {
    agentLoading.value = false
  }
}

const loadStation = async () => {
  try {
    const res = await getStationList({ pageNum: 1, pageSize: 100 })
    if (res.code === 0) {
      const list = res.data?.list || []
      const fs = list.find(s => s.status === 1 && s.wsHost) || list.find(s => s.wsHost)
      if (fs) {
        loginForm.fsHost = fs.wsHost
        loginForm.fsPort = fs.wsPort
      }
    }
  } catch { /* empty */ }
}

const addMessage = (type, content, level = 'info') => {
  const now = new Date()
  const time = now.toLocaleTimeString('zh-CN', { hour12: false })
  messages.value.push({ time, type, content, level })
  nextTick(() => {
    if (messageBodyRef.value) {
      messageBodyRef.value.scrollTop = messageBodyRef.value.scrollHeight
    }
  })
}

const clearMessages = () => {
  messages.value = []
}

// 本地振铃音（浏览器端生成）
const startLocalRingback = () => {
  if (ringbackTimer) return
  try {
    prepareRingtone()
    if (!ringbackCtx) return
    ringbackActive = true
    const playTone = () => {
      if (!ringbackActive || !ringbackCtx) return
      const gain = ringbackCtx.createGain()
      gain.gain.value = 0.25
      gain.connect(ringbackCtx.destination)
      const o1 = ringbackCtx.createOscillator()
      const o2 = ringbackCtx.createOscillator()
      o1.type = 'sine'; o1.frequency.value = 440
      o2.type = 'sine'; o2.frequency.value = 480
      o1.connect(gain); o2.connect(gain)
      o1.start(); o2.start()
      o1.stop(ringbackCtx.currentTime + 2)
      o2.stop(ringbackCtx.currentTime + 2)
    }
    playTone()
    ringbackTimer = setInterval(playTone, 6000)
    addMessage('SIP', '本地振铃音开始')
  } catch (e) {
    addMessage('SIP', `振铃音失败: ${e.message}`, 'error')
  }
}

const stopLocalRingback = () => {
  ringbackActive = false
  if (ringbackTimer) { clearInterval(ringbackTimer); ringbackTimer = null }
  if (ringbackCtx) { ringbackCtx.suspend() }
}

// 初始化 CallSdk 事件监听
const initVoxai = (loginData) => {
  voxaiInstance = new CallSdk()

  voxaiInstance.addEventListener('message', (data) => {
    const msg = JSON.stringify(data)
    if (data.type === 'pong') return

    // 根据消息类型更新状态
    if (data.type === 'stateChange') {
      agentState.value = data.agentState || ''
      callState.value = data.callState || ''
    }

    // B-leg振铃时播放本地振铃音，接通/挂断后停止
    if (data.type === 'OUT_CALLED_RING') {
      startLocalRingback()
    }
    if (data.type === 'TALKING' || data.agentState === 'AFTER' || data.type === 'AFTER') {
      stopLocalRingback()
    }
    if (data.agentState === 'AFTER' || data.type === 'AFTER') {
      callState.value = ''
    }

    addMessage('RECV', msg)
    // 显示 WS 错误消息
    if (data && data.code && data.code !== 0 && data.message) {
      ElMessage.warning(data.message)
    }
  })

  voxaiInstance.addEventListener('logout', () => {
    addMessage('EVENT', 'logout', 'warning')
    connected.value = false
    agentState.value = ''
    callState.value = ''
    voxaiInstance = null
  })

  voxaiInstance.init(loginData)
}


// 连接（登录 + 初始化 SDK）
const handleConnect = async () => {
  if (!loginForm.agentKey || !loginForm.passwd) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  connecting.value = true
  prepareRingtone()
  try {
    // 1. 调用后台登录接口
    const res = await agentLogin({
      agentKey: loginForm.agentKey,
      passwd: loginForm.passwd,
      loginType: loginForm.loginType,
      workType: loginForm.workType,
      forceLogin: true
    })

    if (res.code !== 0) {
      ElMessage.error(res.message || '登录失败')
      return
    }

    addMessage('LOGIN', JSON.stringify(res.data))
    ElMessage.success('登录成功')

    // 3. 保存 token 并初始化 SDK
    agentToken.value = res.data.token
    initVoxai(res.data)
    connected.value = true
    agentState.value = 'LOGIN'

    // 4. SIP 注册到 FS (loginType=1 SIP / loginType=2 WebRTC)
    if (loginForm.loginType <= 2) {
      registerSip(res.data)
    }
  } catch (e) {
    ElMessage.error('连接失败: ' + (e.message || '未知错误'))
  } finally {
    connecting.value = false
  }
}

// 登出
const handleLogout = () => {
  stopLocalRingback()
  clearCallAudio()
  if (ringbackCtx) { ringbackCtx.close(); ringbackCtx = null }
  if (voxaiInstance) {
    voxaiInstance.logout()
  }
  if (sipUa) {
    sipUa.stop()
    sipUa = null
    sipRegistered.value = false
    addMessage('SIP', '已注销')
  }
  connected.value = false
  agentState.value = ''
  callState.value = ''
  voxaiInstance = null
  agentToken.value = ''
  addMessage('EVENT', '手动登出', 'warning')
}

// SIP 注册到 FreeSWITCH
const registerSip = (loginData) => {
  const sipNum = loginData.sips?.[0]
  if (!sipNum) {
    addMessage('SIP', '没有 SIP 号，跳过注册', 'warning')
    return
  }
  if (!loginData.sipPwd) {
    addMessage('SIP', `分机 ${sipNum} 缺少 SIP 密码，跳过注册`, 'warning')
    return
  }
  // 销毁旧 UA（如果存在）
  if (sipUa) {
    sipUa.stop()
    sipUa = null
  }
  const fsHost = loginForm.fsHost || window.location.hostname
  const wsPort = loginForm.fsPort || 5066
  try {
    const socket = new WebSocketInterface(`ws://${fsHost}:${wsPort}`)
    sipUa = new UA({
      sockets: [socket],
      uri: `sip:${sipNum}@${fsHost}`,
      password: loginData.sipPwd,
      register: true,
      session_timers: false,
      register_expires: 3600
    })

    sipUa.on('registered', () => {
      sipRegistered.value = true
      addMessage('SIP', `分机 ${sipNum}@${fsHost} 注册成功`)
    })
    sipUa.on('unregistered', () => {
      sipRegistered.value = false
      addMessage('SIP', '注册已取消')
    })
    sipUa.on('registrationFailed', (e) => {
      sipRegistered.value = false
      addMessage('SIP', `注册失败: ${e.cause}`, 'error')
    })
    sipUa.on('connected', () => {
      addMessage('SIP', `WebSocket 已连接 FS:5066`)
    })
    sipUa.on('disconnected', () => {
      sipRegistered.value = false
      addMessage('SIP', 'WebSocket 断开，将自动重连', 'warning')
    })
    sipUa.on('newRTCSession', (data) => {
      const session = data.session
      const boundConnections = new WeakSet()
      const bindRemoteAudio = (pc) => {
        if (!pc || boundConnections.has(pc)) return
        boundConnections.add(pc)
        const remoteStream = new MediaStream()
        const attachTrack = (track) => {
          if (!track || track.kind !== 'audio' || track.readyState === 'ended') return
          if (!remoteStream.getTracks().includes(track)) remoteStream.addTrack(track)
          const audio = document.getElementById('sipRemoteAudio')
          if (!audio) return
          if (audio.srcObject !== remoteStream) audio.srcObject = remoteStream
          void playRemoteAudio()
          addMessage('SIP', '远端音频已绑定')
        }
        // 监听必须在 answer() 创建连接时安装，不能等 accepted 后再延迟绑定。
        pc.addEventListener('track', event => attachTrack(event.track))
        pc.getReceivers().forEach(receiver => attachTrack(receiver.track))
        pc.addEventListener('iceconnectionstatechange', () => {
          addMessage('SIP', `ICE: ${pc.iceConnectionState}`,
            pc.iceConnectionState === 'failed' ? 'error' : 'info')
        })
      }
      session.on('peerconnection', ({ peerconnection }) => bindRemoteAudio(peerconnection))
      bindRemoteAudio(session.connection)
      session.on('getusermediafailed', error => {
        addMessage('SIP', `麦克风不可用: ${error.name} ${error.message}`, 'error')
        ElMessage.error('无法使用麦克风，请检查浏览器权限和输入设备')
      })
      session.on('accepted', () => {
        stopLocalRingback()
        callState.value = 'TALKING'
        addMessage('SIP', '通话已建立')
        bindRemoteAudio(session.connection)
        void playRemoteAudio()
        if (mediaStatsTimer) clearInterval(mediaStatsTimer)
        const pc = session.connection
        let samples = 0
        mediaStatsTimer = setInterval(async () => {
          if (sipSession.value !== session || pc?.connectionState === 'closed' || !pc?.getStats) return
          try {
            const stats = await pc.getStats()
            let sent = 0, received = 0
            stats.forEach(report => {
              if ((report.kind || report.mediaType) !== 'audio') return
              if (report.type === 'inbound-rtp') received += report.bytesReceived || 0
              if (report.type === 'outbound-rtp') sent += report.bytesSent || 0
            })
            const mic = pc.getSenders().find(sender => sender.track?.kind === 'audio')?.track
            addMessage('SIP', `音频收发累计: 发送 ${sent} B / 接收 ${received} B；麦克风 ${mic?.readyState || '无音轨'}，启用 ${mic?.enabled ?? false}`)
          } catch (error) {
            addMessage('SIP', `音频统计失败: ${error.message}`, 'warning')
          }
          if (++samples >= 3) { clearInterval(mediaStatsTimer); mediaStatsTimer = null }
        }, 5000)
      })
      session.on('ended', () => {
        stopLocalRingback()
        sipSession.value = null
        callState.value = ''
        isOutgoingCall.value = false
        clearCallAudio()
        addMessage('SIP', '通话结束')
      })
      session.on('failed', (e) => {
        stopLocalRingback()
        sipSession.value = null
        callState.value = ''
        isOutgoingCall.value = false
        clearCallAudio()
        addMessage('SIP', `通话失败: ${e.cause}`, 'error')
        addMessage('SIP', `失败详情: originator=${e.originator} message=${e.message}`, 'error')
      })
      // 所有媒体和结束事件就绪后再应答，避免自动接听时漏掉 peerconnection。
      if (data.originator === 'remote') {
        sipSession.value = session
        addMessage('SIP', `来电: ${session.remote_identity.uri.user}`, 'warning')
        if (isOutgoingCall.value) {
          isOutgoingCall.value = false
          session.answer({ mediaConstraints: { audio: true, video: false } })
        } else {
          callState.value = 'RINGING'
          startLocalRingback()
        }
      }
    })

    sipUa.start()
    addMessage('SIP', `正在注册 ${sipNum}@${fsHost}:${wsPort} ...`)
  } catch (e) {
    addMessage('SIP', `初始化失败: ${e.message}`, 'error')
  }
}

// 忙碌
const handleBusy = () => {
  if (voxaiInstance) {
    voxaiInstance.setBusy()
    agentState.value = 'BUSY'
    addMessage('CMD', 'setBusy')
  }
}

// 空闲
const handleReady = () => {
  if (voxaiInstance) {
    voxaiInstance.setReady()
    agentState.value = 'READY'
    addMessage('CMD', 'setReady')
  }
}

// 外呼
const handleMakeCall = async () => {
  if (!phoneNum.value) {
    ElMessage.warning('请输入被叫号码')
    return
  }
  // 清理上一次通话残留状态
  stopLocalRingback()
  if (sipSession.value) {
    sipSession.value.terminate()
    sipSession.value = null
  }
  callState.value = ''
  clearCallAudio()
  if (voxaiInstance) {
    isOutgoingCall.value = true
    callState.value = 'CALLING'
    addMessage('CMD', `makeCall: ${phoneNum.value}`)
    try {
      const response = await voxaiInstance.makeCall(phoneNum.value)
      addMessage('HTTP', `makeCall: ${JSON.stringify(response)}`)
      if (response?.code !== 0) {
        throw new Error(response?.message || '呼叫请求失败')
      }
    } catch (error) {
      callState.value = ''
      isOutgoingCall.value = false
      stopLocalRingback()
      const message = error.message || '呼叫请求失败'
      addMessage('ERR', `makeCall: ${message}`, 'error')
      ElMessage.error(message)
    }
  }
}

// 应答
const handleAcceptCall = () => {
  stopLocalRingback()
  if (sipSession.value) {
    sipSession.value.answer({
      mediaConstraints: { audio: true, video: false }
    })
    // Retry an already attached stream in the click gesture. A new stream is
    // attached only once an audio track arrives, rather than playing an empty stream.
    void playRemoteAudio()
    addMessage('CMD', 'sipAnswer')
    return
  }
  if (voxaiInstance) {
    voxaiInstance.acceptCall()
    callState.value = 'TALKING'
    addMessage('CMD', 'acceptCall')
  }
}

// 挂机
const handleHangup = () => {
  stopLocalRingback()
  clearCallAudio()
  if (sipSession.value) {
    sipSession.value.terminate()
    sipSession.value = null
    callState.value = ''
    addMessage('CMD', 'sipTerminate')
    return
  }
  if (voxaiInstance) {
    voxaiInstance.closeCall()
    callState.value = ''
    addMessage('CMD', 'closeCall')
  }
}

// 转接
const handleTransfer = () => {
  if (!transferNum.value) {
    ElMessage.warning('请输入转接目标')
    return
  }
  if (voxaiInstance) {
    voxaiInstance.phoneTransfer(transferNum.value)
    addMessage('CMD', `phoneTransfer: ${transferNum.value}`)
  }
}

// 咨询
const handleConsult = () => {
  if (!consultNum.value) {
    ElMessage.warning('请输入咨询目标')
    return
  }
  if (voxaiInstance) {
    voxaiInstance.phoneConsult(consultNum.value)
    addMessage('CMD', `phoneConsult: ${consultNum.value}`)
  }
}

// 取消咨询
const handleConsultCancel = () => {
  if (voxaiInstance) {
    voxaiInstance.phoneConsultCancel()
    addMessage('CMD', 'phoneConsultCancel')
  }
}

// 咨询转接
const handleConsultTransfer = () => {
  if (!consultTransferNum.value) {
    ElMessage.warning('请输入咨询转接目标')
    return
  }
  if (voxaiInstance) {
    voxaiInstance.phoneConsultTransfer(consultTransferNum.value)
    addMessage('CMD', `phoneConsultTransfer: ${consultTransferNum.value}`)
  }
}

// 转三方
const handleConsultParty = () => {
  if (voxaiInstance) {
    voxaiInstance.phoneConsultParty()
    addMessage('CMD', 'phoneConsultParty')
  }
}

// 静音
const handleMute = () => {
  if (voxaiInstance) {
    voxaiInstance.mutePhone()
      .then(res => {
        addMessage('CMD', 'mutePhone: ' + JSON.stringify(res))
        if (res.code === 0) ElMessage.success('已静音')
        else ElMessage.error(res.message || '静音失败')
      })
      .catch(err => {
        addMessage('ERR', 'mutePhone error: ' + err.message)
        ElMessage.error('静音请求失败')
      })
  }
}

// 取消静音
const handleCancelMute = () => {
  if (voxaiInstance) {
    voxaiInstance.cancelMute()
      .then(res => {
        addMessage('CMD', 'cancelMute: ' + JSON.stringify(res))
        if (res.code === 0) ElMessage.success('已取消静音')
        else ElMessage.error(res.message || '取消静音失败')
      })
      .catch(err => {
        addMessage('ERR', 'cancelMute error: ' + err.message)
        ElMessage.error('取消静音请求失败')
      })
  }
}

// 保持
const handleHold = () => {
  if (voxaiInstance) {
    voxaiInstance.holdTalking()
    addMessage('CMD', 'holdTalking')
  }
}

// 取消保持
const handleCancelHold = () => {
  if (voxaiInstance) {
    voxaiInstance.cancelHold()
    addMessage('CMD', 'cancelHold')
  }
}

// 班长监控
const handleListen = () => {
  if (!monitorTarget.value) {
    ElMessage.warning('请输入目标坐席')
    return
  }
  if (!voxaiInstance) return
  if (!voxaiInstance.phoneListen) {
    ElMessage.error('SDK 未更新，请重新部署 voxai-call')
    return
  }
  voxaiInstance.phoneListen(monitorTarget.value)
  addMessage('CMD', `phoneListen: ${monitorTarget.value}`)
}

const handleInsert = () => {
  if (!monitorTarget.value) {
    ElMessage.warning('请输入目标坐席')
    return
  }
  if (!voxaiInstance) return
  if (!voxaiInstance.phoneInsert) {
    ElMessage.error('SDK 未更新，请重新部署 voxai-call')
    return
  }
  voxaiInstance.phoneInsert(monitorTarget.value)
  addMessage('CMD', `phoneInsert: ${monitorTarget.value}`)
}

const handleWhisper = () => {
  if (!monitorTarget.value) {
    ElMessage.warning('请输入目标坐席')
    return
  }
  if (!voxaiInstance) return
  if (!voxaiInstance.phoneWhisper) {
    ElMessage.error('SDK 未更新，请重新部署 voxai-call')
    return
  }
  voxaiInstance.phoneWhisper(monitorTarget.value)
  addMessage('CMD', `phoneWhisper: ${monitorTarget.value}`)
}

onMounted(() => {
  addMessage('INFO', 'CallSdk 已就绪（本地模块）')
  loadAgents()
  loadStation()
})

onBeforeUnmount(() => {
  stopLocalRingback()
  clearCallAudio()
  if (ringbackCtx) { ringbackCtx.close(); ringbackCtx = null }
  if (voxaiInstance) {
    voxaiInstance.logout()
  }
  if (sipUa) {
    sipUa.stop()
    sipUa = null
  }
})
</script>

<style scoped>
.softphone-page {
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.softphone-container {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 10px;
  height: 100%;
  max-width: 1500px;
  margin: 0 auto;
}

/* ---- 左侧控制面板 ---- */
.panel-left {
  min-width: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ---- 紧凑卡片 ---- */
.card-compact :deep(.el-card__header) {
  padding: 6px 10px;
}

.card-compact :deep(.el-card__body) {
  padding: 8px 10px;
}

/* ---- 紧凑表单 ---- */
.form-compact :deep(.el-form-item) {
  margin-bottom: 4px;
}

.form-compact :deep(.el-form-item__label) {
  font-size: 12px;
  line-height: 28px;
}

.ml-1 {
  margin-left: 4px;
}

/* ---- 右侧消息面板 ---- */
.panel-right {
  min-width: 260px;
  min-height: 0;
}

.message-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.message-card :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.message-card :deep(.el-card__header) {
  padding: 6px 10px;
}

/* ---- 卡片组件 ---- */
.card-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  font-size: 13px;
}

.card-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* ---- 呼叫控制 ---- */
.call-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.call-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.call-row .el-button {
  flex-shrink: 0;
  white-space: nowrap;
}

.panel-left :deep(.el-divider) {
  margin: 2px 0;
}

/* ---- 消息日志 ---- */
.message-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
}

.message-empty {
  color: var(--text-secondary);
  text-align: center;
  padding-top: 40px;
  font-size: var(--font-size-sm);
}

.message-item {
  padding: 2px 0;
  border-bottom: 1px solid var(--border-color-light);
}

.message-time {
  color: var(--text-secondary);
  margin-right: 6px;
}

.message-type {
  display: inline-block;
  padding: 0 4px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 600;
  margin-right: 4px;
}

.message-type.info {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.message-type.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.message-type.error {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.message-content {
  margin: 2px 0 0 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
  font-size: 11px;
}

/* ---- 响应式 ---- */
@media (max-width: 1100px) {
  .softphone-container {
    grid-template-columns: 340px 1fr;
  }
}

@media (max-width: 900px) {
  .softphone-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    gap: 8px;
    overflow-y: auto;
  }

  .panel-left {
    overflow-y: visible;
  }

  .panel-right {
    min-width: 0;
    min-height: 320px;
  }
}

@media (max-width: 480px) {
  .panel-left {
    gap: 6px;
  }

  .call-row {
    flex-wrap: wrap;
  }

  .call-row .el-button {
    font-size: 11px;
    padding: 6px 10px;
  }

  .card-actions {
    gap: 4px;
  }

  .card-actions .el-button {
    padding: 6px 10px;
  }
}

</style>
