<template>
	<view class="container">
		<!-- 安全区域顶部 -->
		<view class="status-bar"></view>

		<!-- 顶部返回栏 -->
		<view class="header">
			<view class="back-btn" @tap="goBack">
				<text class="back-icon">←</text>
			</view>
			<text class="title">录音机</text>
		</view>

		<!-- 录音提示 -->
		<view class="record-hint" v-if="!isRecording">
			<text>按住按钮开始录音，松开停止</text>
		</view>

		<!-- 波形图可视化 -->
		<view class="wave-visualizer" v-if="isRecording">
			<view class="wave-stack">
				<view class="wave-bars wave-bars--top">
					<view
						v-for="(level, index) in waveBars"
						:key="'top-' + index"
						class="wave-bar"
						:style="{
							height: level + '%',
							backgroundColor: getBarColor(level),
							animationDelay: index * 0.02 + 's'
						}"
					></view>
				</view>
				<view class="wave-bars wave-bars--bottom">
					<view
						v-for="(level, index) in waveBars"
						:key="'bottom-' + index"
						class="wave-bar"
						:style="{
							height: level + '%',
							backgroundColor: getBarColor(level),
							animationDelay: index * 0.02 + 's'
						}"
					></view>
				</view>
			</view>
			<text class="wave-info">录音中... {{ formatTime(recordDuration) }}</text>
		</view>

		<!-- ASR 实时转写结果显示 -->
		<view class="asr-panel" v-if="isRecording && asrEnabled">
			<view class="asr-header">
				<text class="asr-label">🎤 语音转文字</text>
				<text class="asr-status-dot">●</text>
			</view>
			<scroll-view scroll-y class="asr-text-scroll">
				<text class="asr-text">{{ asrInterimText || asrFinalText || '等待音频...' }}</text>
			</scroll-view>
		</view>

		<!-- 控制面板 -->
		<view class="control-panel">
			<!-- 录音按钮 - 按下录音 -->
			<view class="record-btn-wrapper">
				<view
					class="record-btn"
					:class="{ recording: isRecording }"
					@touchstart="startRecord"
					@touchend="stopRecord"
					@touchcancel="stopRecord"
				>
					<view class="record-icon">
						<text class="mic-icon">🎙️</text>
					</view>
				</view>
				<text class="record-text">{{ isRecording ? '录音中...' : '按住说话' }}</text>
				<text v-if="isRecording" class="record-time">{{ formatTime(recordDuration) }}</text>
			</view>

			<!-- 播放控制 -->
			<view class="playback-controls">
				<view class="control-row">
					<view class="control-header">
						<text class="control-label">播放速度</text>
						<text class="control-value">{{ playbackRate }}x</text>
					</view>
					<slider 
						class="slider"
						:min="0.5" 
						:max="2" 
						:step="0.25" 
						:value="playbackRate"
						@change="onPlaybackRateChange"
						activeColor="#667eea"
						block-color="#667eea"
						block-size="18"
					/>
				</view>
				<view class="control-row">
					<view class="control-header">
						<text class="control-label">播放音量</text>
						<text class="control-value">{{ Math.round(volume * 100) }}%</text>
					</view>
					<slider 
						class="slider"
						:min="0" 
						:max="1" 
						:step="0.1" 
						:value="volume"
						@change="onVolumeChange"
						activeColor="#667eea"
						block-color="#667eea"
						block-size="18"
					/>
				</view>
			</view>
				<view class="control-row asr-toggle-row">
					<view class="control-header">
						<text class="control-label">🎤 ASR 语音转文字</text>
						<text class="control-value">{{ asrEnabled ? '已开启' : '已关闭' }}</text>
					</view>
					<switch
						:checked="asrEnabled"
						@change="asrEnabled = $event.detail.value"
						color="#667eea"
					/>
				</view>

			</view>
		<!-- 录音列表 -->
		<view class="record-list-section">
			<text class="section-title">录音历史 ({{ recordList.length }})</text>
			<scroll-view scroll-y class="list-container">
				<view 
					v-for="(item, index) in recordList" 
					:key="item.id"
					class="record-item"
					:class="{ playing: currentPlayingIndex === index }"
					
				>
					<view class="record-info" @tap="playRecord(index)">
						<text class="record-name">{{ item.fullTime || item.time }}</text>
						<text v-if="item.transcript" class="record-transcript">{{ item.transcript }}</text>
					</view>
					<view class="record-actions">
						<text v-if="currentPlayingIndex === index" class="playing-indicator">
							{{ isPlaying ? '🔊' : '⏸️' }}
						</text>
						<view class="delete-btn" @tap.stop="deleteRecord(index)">
							<text class="delete-icon">🗑️</text>
						</view>
					</view>
				</view>
				<view v-if="recordList.length === 0" class="empty-tip">
					<text>暂无录音，点击上方按钮开始录音</text>
				</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { onShow } from '@dcloudio/uni-app'

import Recorder from 'recorder-core'
import RecordApp from 'recorder-core/src/app-support/app'
import '@/uni_modules/Recorder-UniCore/app-uni-support.js'

// Prevent tree-shaking from removing Recorder import
Recorder.a = Recorder.a || 1

// #ifdef MP-WEIXIN
import 'recorder-core/src/app-support/app-miniProgram-wx-support.js'
// #endif

// #ifdef H5 || MP-WEIXIN
import 'recorder-core/src/engine/mp3'
import 'recorder-core/src/engine/mp3-engine'
// #endif

const audio = uni.createInnerAudioContext()

const isRecording = ref(false)
const isPlaying = ref(false)
const currentPlayingIndex = ref(-1)
const recordDuration = ref(0)
let recordTimer = null

const powerLevel = ref(0)
const waveData = ref([])
const waveBars = ref(new Array(30).fill(5))
const maxWavePoints = 100
const targetPower = ref(0)
let waveTickTimer = null

const recordList = ref([])
const playbackRate = ref(1.0)
const volume = ref(0.8)

// ASR (Automatic Speech Recognition) 配置
const asrServerUrl = 'ws://127.0.0.1:8765/ws/transcribe'
const asrEnabled = ref(true)
const asrWebSocket = ref(null)
const asrInterimText = ref('')
const asrFinalText = ref('')
const asrLastSentIndex = ref(0)
const asrLanguage = ref('')

const userName = '刘子云'
const pageInstance = getCurrentInstance()?.proxy || null

const activateWebViewIfNeeded = () => {
	// #ifdef APP
	if (pageInstance) {
		RecordApp.UniWebViewActivate(pageInstance)
	}
	// #endif
}

onMounted(() => {
	const savedList = uni.getStorageSync('recordList')
	if (savedList) {
		recordList.value = savedList
	}
	
	console.log(`【${userName}】页面加载 - 当前recordList长度: ${recordList.value.length}`)

	// #ifdef APP
	if (pageInstance) {
		RecordApp.UniPageOnShow(pageInstance)
	}
	// #endif

	audio.onEnded(() => {
		isPlaying.value = false
		currentPlayingIndex.value = -1
	})

	audio.onError((err) => {
		console.error('播放错误:', err)
		uni.showToast({
			title: '播放失败',
			icon: 'none'
		})
	})
})

onUnmounted(() => {
	if (recordTimer) {
		clearInterval(recordTimer)
	}
	stopWaveTicker()
	audio.stop()
})

onShow(() => {
	// #ifdef APP
	if (pageInstance) {
		RecordApp.UniPageOnShow(pageInstance)
	}
	// #endif
})

const startRecord = () => {
	if (isRecording.value) return
	waveData.value = []
	waveBars.value = new Array(30).fill(5)
	powerLevel.value = 0
	targetPower.value = 0
	const startWithPermission = () => {
		const set = {
			type: 'mp3',
			sampleRate: 16000,
			bitRate: 16,
			onProcess: (_buffers, level, duration) => {
				if (!isRecording.value) return
				targetPower.value = level

				// ASR 流式发送：将 PCM Float32 转换为 Int16 发送
				if (asrEnabled.value && asrWebSocket.value && _buffers && _buffers.length > 0) {
					// _buffers[0] 是累积的 Float32Array PCM 数据
					const totalSamples = _buffers[0].length
					const lastSent = asrLastSentIndex.value
					if (totalSamples > lastSent) {
						const newChunk = _buffers[0].slice(lastSent, totalSamples)
						sendPCMChunk(newChunk)
						asrLastSentIndex.value = totalSamples
					}
				}
			}
		}

		activateWebViewIfNeeded()
		RecordApp.Start(set, () => {
			isRecording.value = true
			recordDuration.value = 0
			startDurationTimer()
			startWaveTicker()
			// 连接 ASR WebSocket
			connectASR()
		}, (msg) => {
			console.error('开始录音失败:', msg)
			isRecording.value = false
			uni.showToast({ title: '录音失败', icon: 'none' })
		})
	}

	if (!pageInstance) {
		uni.showToast({ title: '页面未初始化', icon: 'none' })
		return
	}

	activateWebViewIfNeeded()
	RecordApp.RequestPermission(() => {
		startWithPermission()
	}, (msg) => {
		console.error('请求录音权限失败:', msg)
		uni.showToast({ title: '需要录音权限', icon: 'none' })
	})
}

const startDurationTimer = () => {
	if (recordTimer) clearInterval(recordTimer)
	recordDuration.value = 0
	recordTimer = setInterval(() => {
		recordDuration.value++
	}, 1000)
}

const stopRecord = () => {
	if (!isRecording.value) return
	isRecording.value = false
	powerLevel.value = 0
	waveData.value = []
	waveBars.value = new Array(30).fill(5)
	stopWaveTicker()

	if (recordTimer) {
		clearInterval(recordTimer)
		recordTimer = null
	}

	// 关闭 ASR 连接并获取最终识别文本
	const asrPromise = closeASR()

	RecordApp.Stop((arrayBuffer, duration, mime) => {
		const now = new Date()
		const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

		// 等待 ASR 结果
		asrPromise.then((transcript) => {
			const finalTranscript = transcript || asrFinalText.value || ''

			// #ifdef H5
			const blob = new Blob([arrayBuffer], { type: mime })
			const url = (window.URL || window.webkitURL).createObjectURL(blob)
			recordList.value.push({
				id: Date.now(),
				src: url,
				time: timeStr,
				transcript: finalTranscript,
				transcriptLang: asrLanguage.value || '',
			})
			uni.setStorageSync('recordList', recordList.value)
			// #endif

			// #ifdef APP || MP-WEIXIN
			RecordApp.UniSaveLocalFile('recorder.mp3', arrayBuffer, (savePath) => {
				recordList.value.push({
					id: Date.now(),
					src: savePath,
					time: timeStr,
					transcript: finalTranscript,
					transcriptLang: asrLanguage.value || '',
				})
				uni.setStorageSync('recordList', recordList.value)
			}, (errMsg) => {
				console.error('保存录音失败:', errMsg)
				uni.showToast({ title: '保存失败', icon: 'none' })
			})
			// #endif
		})
	}, (msg) => {
		console.error('结束录音失败:', msg)
		uni.showToast({ title: '结束录音失败', icon: 'none' })
	})
}

const updateWaveData = (power) => {
	if (!isRecording.value) return
	powerLevel.value = power
	waveData.value.push(power)
	if (waveData.value.length > maxWavePoints) {
		waveData.value.shift()
	}

	const barCount = 30
	const newBars = []
	for (let i = 0; i < barCount; i++) {
		const dataIndex = Math.floor((i / barCount) * waveData.value.length)
		const value = waveData.value[waveData.value.length - 1 - dataIndex] || 0
		const variation = (Math.random() - 0.5) * 20
		const barValue = Math.max(5, Math.min(100, value + variation))
		newBars.push(barValue)
	}
	waveBars.value = newBars
}

const startWaveTicker = () => {
	if (waveTickTimer) return
	let smoothPower = powerLevel.value || 0
	waveTickTimer = setInterval(() => {
		if (!isRecording.value) return
		const diff = targetPower.value - smoothPower
		smoothPower += diff * 0.35
		const jitter = (Math.random() - 0.5) * 6
		updateWaveData(Math.max(0, Math.min(100, smoothPower + jitter)))
	}, 50)
}

const stopWaveTicker = () => {
	if (waveTickTimer) {
		clearInterval(waveTickTimer)
		waveTickTimer = null
	}
}

// ===================== ASR WebSocket 流式识别 =====================

const connectASR = () => {
	if (!asrEnabled.value) return
	try {
		// #ifdef H5
		const ws = new WebSocket(asrServerUrl)
		ws.binaryType = 'arraybuffer'
		ws.onopen = () => { console.log('[ASR] WebSocket 已连接') }
		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data)
				if (msg.type === 'interim') {
					asrInterimText.value = msg.text
				} else if (msg.type === 'final') {
					asrFinalText.value = msg.text
					asrInterimText.value = ''
					asrLanguage.value = msg.language || ''
				}
			} catch (e) {
				console.error('[ASR] 消息解析失败:', e)
			}
		}
		ws.onerror = (err) => { console.error('[ASR] WebSocket 错误:', err) }
		ws.onclose = () => { console.log('[ASR] WebSocket 已关闭') }
		asrWebSocket.value = ws
		asrLastSentIndex.value = 0
		asrInterimText.value = ''
		asrFinalText.value = ''
		asrLanguage.value = ''
		// #endif
	} catch (e) {
		console.error('[ASR] 连接失败:', e)
	}
}

const sendPCMChunk = (float32Chunk) => {
	const ws = asrWebSocket.value
	if (!ws || ws.readyState !== WebSocket.OPEN) return
	if (float32Chunk.length < 1600) return  // < 0.1秒，跳过

	// Float32 [-1,1] -> Int16 [-32768,32767]
	const int16 = new Int16Array(float32Chunk.length)
	for (let i = 0; i < float32Chunk.length; i++) {
		const s = Math.max(-1, Math.min(1, float32Chunk[i]))
		int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
	}
	ws.send(int16.buffer)
}

const closeASR = () => {
	return new Promise((resolve) => {
		asrInterimText.value = ''
		const ws = asrWebSocket.value
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			resolve(asrFinalText.value)
			return
		}
		// 监听最终结果后关闭
		const origHandler = ws.onmessage
		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data)
				if (msg.type === 'final') {
					asrFinalText.value = msg.text
					asrLanguage.value = msg.language || ''
					resolve(msg.text || '')
					return
				}
			} catch (e) { /* ignore */ }
			if (origHandler) origHandler.call(ws, event)
		}
		ws.send(JSON.stringify({ type: 'stop' }))
		// 超时保护：3秒后如果没有收到 final，直接关闭
		setTimeout(() => {
			try { ws.close() } catch(e) {}
			resolve(asrFinalText.value || '')
		}, 3000)
		asrWebSocket.value = null
	})
}

const getBarColor = (level) => {
	if (level > 70) return '#ef4444'
	if (level >= 40) return '#22c55e'
	return '#667eea'
}


const playRecord = (index) => {
	if (currentPlayingIndex.value === index && isPlaying.value) {
		audio.pause()
		isPlaying.value = false
	} else {
		audio.src = recordList.value[index].src
		audio.playbackRate = playbackRate.value
		audio.volume = volume.value
		audio.play()
		currentPlayingIndex.value = index
		isPlaying.value = true
	}
}

const deleteRecord = (index) => {
	uni.showModal({
		title: '确认删除',
		content: '确定要删除这条录音吗？',
		success: (res) => {
			if (res.confirm) {
				if (currentPlayingIndex.value === index) {
					audio.stop()
					isPlaying.value = false
					currentPlayingIndex.value = -1
				}
				recordList.value.splice(index, 1)
				uni.setStorageSync('recordList', recordList.value)
				
				if (currentPlayingIndex.value > index) {
					currentPlayingIndex.value--
				}
			}
		}
	})
}

const onPlaybackRateChange = (e) => {
	playbackRate.value = e.detail.value
	if (isPlaying.value) {
		audio.playbackRate = playbackRate.value
	}
}

const onVolumeChange = (e) => {
	volume.value = e.detail.value
	if (isPlaying.value) {
		audio.volume = volume.value
	}
}

const formatTime = (seconds) => {
	const mins = Math.floor(seconds / 60)
	const secs = seconds % 60
	return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const goBack = () => {
	uni.navigateBack()
}
</script>

<!-- #ifdef APP -->
<script module="recorderRender" lang="renderjs">
import 'recorder-core'
import RecordApp from 'recorder-core/src/app-support/app'
import '../../uni_modules/Recorder-UniCore/app-uni-support.js'
import 'recorder-core/src/engine/mp3'
import 'recorder-core/src/engine/mp3-engine'

export default {
	mounted() {
		RecordApp.UniRenderjsRegister(this)
	}
}
</script>
<!-- #endif -->

<style lang="scss">
.container {
	min-height: 100vh;
	background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
	padding: 240rpx 40rpx 40rpx;
	box-sizing: border-box;
}

.status-bar {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	height: 60rpx;
	background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
	z-index: 11;
}

.header {
	position: fixed;
	top: 60rpx;
	left: 0;
	right: 0;
	height: 140rpx;
	padding: 20rpx 40rpx;
	display: flex;
	align-items: center;
	background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
	z-index: 10;
}

.back-btn {
	width: 80rpx;
	height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.back-icon {
	font-size: 48rpx;
	color: #fff;
}

.title {
	flex: 1;
	text-align: center;
	font-size: 40rpx;
	font-weight: 600;
	color: #fff;
	padding-right: 80rpx;
}

.record-hint {
	text-align: center;
	padding: 20rpx;
	margin-bottom: 20rpx;
}

.record-hint text {
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.85);
	background: rgba(255, 255, 255, 0.08);
	padding: 12rpx 24rpx;
	border-radius: 999rpx;
	border: 1px solid rgba(255, 255, 255, 0.12);
	box-shadow: 0 8rpx 24rpx rgba(15, 52, 96, 0.25);
}

.wave-visualizer {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin: 20rpx 0;
	padding: 30rpx;
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(102, 126, 234, 0.12));
	border-radius: 24rpx;
	border: 1px solid rgba(255, 255, 255, 0.12);
	box-shadow: 0 16rpx 40rpx rgba(7, 24, 46, 0.35);
	backdrop-filter: blur(18rpx);
	position: relative;
	overflow: hidden;
}

.wave-visualizer::before {
	content: '';
	position: absolute;
	left: -20%;
	top: -40%;
	width: 140%;
	height: 140%;
	background: radial-gradient(circle at 30% 30%, rgba(118, 75, 162, 0.35), transparent 55%);
	opacity: 0.7;
	pointer-events: none;
}


.wave-stack {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	width: 100%;
	padding: 6rpx 0 2rpx;
	z-index: 1;
}

.wave-bars {
	display: flex;
	align-items: flex-end;
	justify-content: center;
	gap: 6rpx;
	height: 72rpx;
	width: 100%;
}

.wave-bars--top {
	transform: scaleY(-1);
}

.wave-bar {
	width: 12rpx;
	border-radius: 6rpx;
	transition: height 0.1s ease;
	min-height: 8rpx;
	box-shadow: 0 0 16rpx rgba(102, 126, 234, 0.45);
	filter: saturate(1.2);
	animation: bar-glow 1.6s ease-in-out infinite;
}

.wave-info {
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.85);
	margin-top: 16rpx;
	letter-spacing: 1rpx;
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
	background: rgba(0, 0, 0, 0.18);
	border: 1px solid rgba(255, 255, 255, 0.1);
	z-index: 1;
}

.control-panel {
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(102, 126, 234, 0.08));
	border-radius: 32rpx;
	padding: 50rpx 40rpx;
	margin-bottom: 40rpx;
	backdrop-filter: blur(20rpx);
	border: 1px solid rgba(255, 255, 255, 0.12);
	box-shadow: 0 16rpx 40rpx rgba(7, 24, 46, 0.28);
}

.record-btn-wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 50rpx;
}

.record-btn {
	width: 180rpx;
	height: 180rpx;
	border-radius: 50%;
	background: linear-gradient(135deg, #667eea, #764ba2);
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 12rpx 40rpx rgba(102, 126, 234, 0.5);
	transition: transform 0.1s ease, box-shadow 0.3s ease;
}

.record-btn:active {
	transform: scale(0.9);
}

.record-btn.recording {
	background: linear-gradient(135deg, #f093fb, #f5576c);
	box-shadow: 0 12rpx 50rpx rgba(245, 87, 108, 0.6);
}

.record-icon {
	font-size: 60rpx;
}

.mic-icon, .stop-icon {
	font-size: 72rpx;
}

.record-text {
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.7);
	margin-top: 20rpx;
}

.record-time {
	font-size: 40rpx;
	color: #f093fb;
	font-weight: 600;
	margin-top: 12rpx;
	font-family: 'Courier New', monospace;
}

.playback-controls {
	margin-top: 20rpx;
}

.control-row {
	margin-bottom: 32rpx;
}

.control-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12rpx;
}

.control-label {
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.9);
}

.control-value {
	font-size: 28rpx;
	color: #667eea;
	font-weight: 600;
}

.slider {
	width: 100%;
	margin: 0;
}

.record-list-section {
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.07), rgba(15, 52, 96, 0.2));
	border-radius: 32rpx;
	padding: 40rpx;
	backdrop-filter: blur(20rpx);
	border: 1px solid rgba(255, 255, 255, 0.12);
	box-shadow: 0 18rpx 44rpx rgba(7, 24, 46, 0.32);
}

.section-title {
	display: block;
	font-size: 32rpx;
	color: #fff;
	font-weight: 600;
	margin-bottom: 24rpx;
}

.list-container {
	max-height: 500rpx;
}

.record-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx;
	background: rgba(255, 255, 255, 0.06);
	border-radius: 16rpx;
	margin-bottom: 16rpx;
	border: 1px solid rgba(255, 255, 255, 0.05);
	transition: all 0.3s ease;
}

.record-item:active {
	background: rgba(255, 255, 255, 0.1);
}

.record-item.playing {
	background: rgba(102, 126, 234, 0.22);
	border-color: rgba(102, 126, 234, 0.45);
	box-shadow: 0 12rpx 28rpx rgba(102, 126, 234, 0.25);
}

@keyframes bar-glow {
	0% {
		box-shadow: 0 0 10rpx rgba(102, 126, 234, 0.35);
		transform: translateY(0);
	}
	50% {
		box-shadow: 0 0 22rpx rgba(240, 147, 251, 0.45);
		transform: translateY(-2rpx);
	}
	100% {
		box-shadow: 0 0 10rpx rgba(102, 126, 234, 0.35);
		transform: translateY(0);
	}
}

.record-info {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.record-name {
	font-size: 30rpx;
	color: #fff;
	font-weight: 500;
}

.record-time-display {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.5);
	margin-top: 8rpx;
}

.record-actions {
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.playing-indicator {
	font-size: 32rpx;
}

.delete-btn {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.1);
}

.delete-icon {
	font-size: 28rpx;
}

.empty-tip {
	text-align: center;
	padding: 60rpx;
	color: rgba(255, 255, 255, 0.4);
	font-size: 28rpx;
}

	/* ASR 面板 */
	.asr-panel {
		background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(15, 52, 96, 0.25));
		border-radius: 24rpx;
		padding: 24rpx 32rpx;
		margin-bottom: 24rpx;
		border: 1px solid rgba(102, 126, 234, 0.3);
		box-shadow: 0 8rpx 24rpx rgba(7, 24, 46, 0.2);
		backdrop-filter: blur(12rpx);
	}
	.asr-header {
		display: flex;
		align-items: center;
		gap: 12rpx;
		margin-bottom: 12rpx;
	}
	.asr-label {
		font-size: 26rpx;
		color: rgba(255, 255, 255, 0.8);
		font-weight: 500;
	}
	.asr-status-dot {
		font-size: 18rpx;
		color: #22c55e;
		animation: asr-blink 1s ease-in-out infinite;
	}
	@keyframes asr-blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
	.asr-text-scroll {
		max-height: 120rpx;
	}
	.asr-text {
		font-size: 28rpx;
		color: #fff;
		line-height: 1.6;
		word-break: break-all;
	}
	/* 录音列表中的转录文本 */
	.record-transcript {
		display: block;
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.55);
		margin-top: 8rpx;
		line-height: 1.5;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 400rpx;
	}
	/* ASR 开关行 */
	.asr-toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 20rpx;
		padding-top: 24rpx;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

</style>
