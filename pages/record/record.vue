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
				<!-- 变速不变调按钮 - 实验五 -->
				<view class="speed-control-section">
					<text class="speed-section-title">变速不变调 (实验五)</text>
					<view class="speed-buttons">
						<view 
							class="speed-btn" 
							:class="{ active: currentSpeed === 0.5 }"
							@tap="setSpeed(0.5)"
						>
							<text class="speed-btn-text">0.5x</text>
						</view>
						<view 
							class="speed-btn" 
							:class="{ active: currentSpeed === 1 }"
							@tap="setSpeed(1)"
						>
							<text class="speed-btn-text">1x</text>
						</view>
						<view 
							class="speed-btn" 
							:class="{ active: currentSpeed === 2 }"
							@tap="setSpeed(2)"
						>
							<text class="speed-btn-text">2x</text>
						</view>
					</view>
					<text class="speed-hint">试听"移动应用开发真奇妙啊"中的长音效果</text>
				</view>
			</view>
		</view>

		<!-- 录音列表 -->
		<view class="record-list-section">
			<text class="section-title">录音历史 ({{ recordList.length }})</text>
			<text class="section-hint">录制"移动应用开发真奇妙啊——传感器让代码活起来啦——"测试变速效果</text>
			<scroll-view scroll-y class="list-container">
				<view 
					v-for="(item, index) in recordList" 
					:key="item.id"
					class="record-item"
					:class="{ playing: currentPlayingIndex === index }"
					@tap="playRecord(index)"
				>
					<view class="record-info">
						<text class="record-name">{{ item.fullTime || item.time }}</text>
						<text class="record-time-display">{{ formatTime(item.duration || 0) }}</text>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { timeStretch } from '../../utils/time-stretch.js'

const recorder = uni.getRecorderManager()
const audio = uni.createInnerAudioContext()

const isRecording = ref(false)
const isPlaying = ref(false)
const currentPlayingIndex = ref(-1)
const recordDuration = ref(0)
let recordTimer = null

const recordList = ref([])
const playbackRate = ref(1.0)
const volume = ref(0.8)
const currentSpeed = ref(1)
const currentPlayingSrc = ref('')
const isProcessing = ref(false)

const userName = '刘子云'

onMounted(() => {
	const savedList = uni.getStorageSync('recordList')
	if (savedList) {
		recordList.value = savedList
	}
	
	console.log(`【${userName}】页面加载 - 当前recordList长度: ${recordList.value.length}`)

	recorder.onStop((res) => {
		isRecording.value = false
		if (recordTimer) {
			clearInterval(recordTimer)
			recordTimer = null
		}
		
		const now = new Date()
		const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
		const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
		const fullStr = `${dateStr} ${timeStr}`
		
		console.log(`【${userName}】录音添加前 - recordList长度: ${recordList.value.length}`)
		
		recordList.value.push({
			id: Date.now(),
			src: res.tempFilePath,
			time: timeStr,
			fullTime: fullStr,
			duration: recordDuration.value
		})
		
		console.log(`【${userName}】录音添加后 - recordList长度: ${recordList.value.length}`)
		console.log(`【${userName}】当前录音列表共 ${recordList.value.length} 条记录`)
		
		uni.setStorageSync('recordList', recordList.value)
	})

	recorder.onStart(() => {
		isRecording.value = true
		recordDuration.value = 0
		recordTimer = setInterval(() => {
			recordDuration.value++
		}, 1000)
	})

	recorder.onError((err) => {
		console.error('录音错误:', err)
		uni.showToast({
			title: '录音失败',
			icon: 'none'
		})
	})

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
	audio.stop()
})

const startRecord = () => {
	if (isRecording.value) return
	console.log('recordManager.start 请求参数:', {
		format: 'wav',
		sampleRate: 16000,
		numberOfChannels: 1,
		duration: 30000
	})
	recorder.start({
		format: 'wav',
		sampleRate: 16000,
		numberOfChannels: 1,
		duration: 30000
	})
}

const stopRecord = () => {
	if (!isRecording.value) return
	recorder.stop()
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

const setSpeed = async (speed) => {
	if (isProcessing.value) return
	
	const index = currentPlayingIndex.value
	if (index === -1) {
		uni.showToast({ title: '请先选择录音', icon: 'none' })
		return
	}
	
	currentSpeed.value = speed
	playbackRate.value = speed
	
	// 如果当前没有播放，先加载音源
	if (currentPlayingIndex.value !== index) {
		audio.src = recordList.value[index].src
	}
	
	// 设置播放速度
	audio.playbackRate = speed
	audio.volume = volume.value
	
	// 如果之前在播放，继续播放
	if (isPlaying.value) {
		audio.play()
	} else {
		audio.play()
		isPlaying.value = true
	}
	
	// 显示提示
	if (speed === 1) {
		uni.showToast({ title: '正常播放速度', icon: 'none', duration: 1000 })
	} else {
		uni.showToast({ title: `播放速度 ${speed}x`, icon: 'none', duration: 1500 })
		
		// 0.5x 和 2x 尝试变速不变调处理（实验五）
		if (Math.abs(speed - 0.5) < 0.01 || Math.abs(speed - 2) < 0.01) {
			// 注意：这里只是尝试，实际效果取决于录音格式和设备支持
			console.log(`实验五：测试${speed}x变速效果 - 注意听"啊"和"啦"长音是否颤抖`)
			
			// 如果需要真正的变速不变调处理，可以取消下面注释并使用timeStretch工具
			/*
			try {
				isProcessing.value = true
				uni.showLoading({ title: `${speed}x 变速处理...`, mask: true })
				const processedPath = await timeStretch(recordList.value[index].src, speed)
				audio.src = processedPath
				audio.playbackRate = 1
				audio.volume = volume.value
				audio.play()
				currentPlayingSrc.value = processedPath
				uni.showToast({ title: `${speed}x 变速不变调`, icon: 'none', duration: 1500 })
			} catch (err) {
				console.error('变速处理失败，使用普通变速:', err)
				audio.src = recordList.value[index].src
				audio.playbackRate = speed
				audio.volume = volume.value
				audio.play()
			} finally {
				isProcessing.value = false
				uni.hideLoading()
			}
			*/
		}
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
	color: rgba(255, 255, 255, 0.5);
}

.control-panel {
	background: rgba(255, 255, 255, 0.08);
	border-radius: 32rpx;
	padding: 50rpx 40rpx;
	margin-bottom: 40rpx;
	backdrop-filter: blur(20rpx);
	border: 1px solid rgba(255, 255, 255, 0.1);
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

.speed-control-section {
	margin-top: 20rpx;
}

.speed-section-title {
	display: block;
	text-align: center;
	font-size: 28rpx;
	font-weight: 600;
	color: rgba(255, 255, 255, 0.9);
	margin-bottom: 20rpx;
	padding: 10rpx 0;
	background: rgba(102, 126, 234, 0.15);
	border-radius: 20rpx;
}

.speed-buttons {
	display: flex;
	justify-content: center;
	gap: 30rpx;
	margin-bottom: 16rpx;
}

.speed-btn {
	padding: 16rpx 40rpx;
	border-radius: 30rpx;
	background: rgba(255, 255, 255, 0.1);
	border: 2rpx solid rgba(255, 255, 255, 0.2);
	transition: all 0.3s ease;
	transform: scale(1);
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.speed-btn:active {
	transform: scale(0.95);
}

.speed-btn.active {
	background: linear-gradient(135deg, #667eea, #764ba2);
	border-color: #667eea;
	box-shadow: 0 6rpx 16rpx rgba(102, 126, 234, 0.4);
	transform: scale(1.05);
}

.speed-btn-text {
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.8);
	font-weight: 600;
}

.speed-btn.active .speed-btn-text {
	color: #fff;
}

.speed-hint {
	display: block;
	text-align: center;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.5);
	font-style: italic;
}

.record-list-section {
	background: rgba(255, 255, 255, 0.08);
	border-radius: 32rpx;
	padding: 40rpx;
	backdrop-filter: blur(20rpx);
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.section-title {
	display: block;
	font-size: 32rpx;
	color: #fff;
	font-weight: 600;
	margin-bottom: 16rpx;
}

.section-hint {
	display: block;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.5);
	margin-bottom: 24rpx;
	padding: 10rpx 16rpx;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 16rpx;
	text-align: center;
}

.list-container {
	max-height: 500rpx;
}

.record-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 16rpx;
	margin-bottom: 16rpx;
	border: 1px solid rgba(255, 255, 255, 0.05);
	transition: all 0.3s ease;
}

.record-item:active {
	background: rgba(255, 255, 255, 0.1);
}

.record-item.playing {
	background: rgba(102, 126, 234, 0.2);
	border-color: rgba(102, 126, 234, 0.4);
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
</style>
