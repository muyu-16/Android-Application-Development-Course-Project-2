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

		<!-- 波形图可视化 - 居中生长 + 向右滚动 -->
		<view class="wave-visualizer" v-if="isRecording">
			<view class="wave-canvas">
				<!-- 中心参考线 -->
				<view class="wave-center-line"></view>
				<!-- 波形条：从中间同时向上/下生长 -->
				<view class="wave-bars">
					<view
						v-for="(level, index) in waveBars"
						:key="'bar-' + index"
						class="wave-bar"
						:style="{
							height: level + '%',
							backgroundColor: getBarColor(level),
							opacity: 0.3 + (index / waveBars.length) * 0.7
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
				<view class="control-row asr-lang-row" v-if="asrEnabled">
					<text class="control-label">识别语言</text>
					<view class="lang-options">
						<view
							v-for="lang in asrLangOptions"
							:key="lang.value"
							class="lang-chip"
							:class="{ active: asrLanguage === lang.value }"
							@tap="asrLanguage = lang.value"
						>
							<text>{{ lang.label }}</text>
						</view>
					</view>
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
						<view class="record-name-row">
							<text class="record-name">{{ item.fullTime || item.time }}</text>
							<text v-if="item.transcriptLang" class="record-lang-tag">{{ item.transcriptLang }}</text>
						</view>
						<text v-if="item.duration" class="record-duration">时长 {{ item.duration }}</text>
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

// 引入阿里云语音识别插件
import 'recorder-core/src/extensions/asr.aliyun.short.js'

const audio = uni.createInnerAudioContext()

const isRecording = ref(false)
const isPlaying = ref(false)
const currentPlayingIndex = ref(-1)
const recordDuration = ref(0)
let recordTimer = null

const powerLevel = ref(0)
const waveBars = ref(new Array(50).fill(5))
const targetPower = ref(0)
let waveTickTimer = null

const recordList = ref([])
const playbackRate = ref(1.0)
const volume = ref(0.8)

// ASR (Automatic Speech Recognition) 配置
// 阿里云语音识别配置
const asrTokenApi = 'http://192.168.1.14:9527/token'  // Token 生成接口
const asrEnabled = ref(true)
const asrInterimText = ref('')
const asrFinalText = ref('')
const asrLanguage = ref('普通话')
const asrLangOptions = [
	{ label: '普通话', value: '普通话' },
	{ label: '粤语', value: '粤语' },
	{ label: '英语', value: '英语' },
	{ label: '日语', value: '日语' }
]

// ASR 实例
let asrInstance = null

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

	// 加载云端录音列表
	loadFromCloud()

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
	waveBars.value = new Array(50).fill(5)
	powerLevel.value = 0
	targetPower.value = 0
	const startWithPermission = () => {
		const set = {
			type: 'mp3',
			sampleRate: 16000,
			bitRate: 16,
			onProcess: (_buffers, level, duration, bufferSampleRate, newBufferIdx) => {
				if (!isRecording.value) return
				targetPower.value = level

				// ASR 流式发送：将音频数据输入到阿里云 ASR
				if (asrEnabled.value && asrInstance && _buffers && _buffers.length > 0) {
					asrInstance.input(_buffers, bufferSampleRate, newBufferIdx)
				}
			}
		}

		activateWebViewIfNeeded()
		RecordApp.Start(set, () => {
			isRecording.value = true
			recordDuration.value = 0
			startDurationTimer()
			startWaveTicker()
			// 连接 ASR
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
	waveBars.value = new Array(50).fill(5)
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
		const fullTimeStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${timeStr}`
		const durationStr = formatTime(recordDuration.value)

		// 等待 ASR 结果
		asrPromise.then((transcript) => {
			const finalTranscript = transcript || asrFinalText.value || ''

			// #ifdef H5
			const blob = new Blob([arrayBuffer], { type: mime })
			const url = (window.URL || window.webkitURL).createObjectURL(blob)
			recordList.value.push({
				id: Date.now(),
				src: url,
				fullTime: fullTimeStr,
				time: timeStr,
				duration: durationStr,
				transcript: finalTranscript,
				transcriptLang: finalTranscript ? (asrLanguage.value || '普通话') : '',
			})
			uni.setStorageSync('recordList', recordList.value)
			uploadToCloud(blob, recordDuration.value, mime)
			// #endif

			// #ifdef MP-WEIXIN
			RecordApp.MiniProgramWx_WriteLocalFile(
				'recorder_' + Date.now() + '.wav',
				arrayBuffer,
				function(localFilePath) {
					recordList.value.push({
						id: Date.now(),
						src: localFilePath,
						fullTime: fullTimeStr,
						time: timeStr,
						duration: durationStr,
						transcript: finalTranscript,
						transcriptLang: finalTranscript ? (asrLanguage.value || '普通话') : '',
					})
					uni.setStorageSync('recordList', recordList.value)
					uploadToCloud(localFilePath, recordDuration.value)
				},
				function(err) {
					console.error('本地保存失败:', err)
					uni.showToast({ title: '保存失败', icon: 'none' })
				}
			)
			// #endif

			// #ifdef APP
			const fs = uni.getFileSystemManager()
			const filePath = `${uni.env.USER_DATA_PATH}/recorder_${Date.now()}.mp3`
			fs.writeFile({
				filePath: filePath,
				data: arrayBuffer,
				encoding: 'binary',
				success: () => {
					recordList.value.push({
						id: Date.now(),
						src: filePath,
						fullTime: fullTimeStr,
						time: timeStr,
						duration: durationStr,
						transcript: finalTranscript,
						transcriptLang: finalTranscript ? (asrLanguage.value || '普通话') : '',
					})
					uni.setStorageSync('recordList', recordList.value)
					uploadToCloud(filePath, recordDuration.value)
				},
				fail: (err) => {
					console.error('保存录音失败:', err)
					uni.showToast({ title: '保存失败', icon: 'none' })
				}
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

	// 将新数据从左侧推入，右侧挤出（向右滚动效果）
	const barCount = 50
	const currentBars = waveBars.value
	const variation = (Math.random() - 0.5) * 20
	const newValue = Math.max(5, Math.min(100, power + variation))

	// 左侧插入新值，移除最右侧的值
	const shifted = [newValue, ...currentBars.slice(0, barCount - 1)]
	waveBars.value = shifted
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

// ===================== ASR 阿里云语音识别 =====================

/** 实现 apiRequest 接口，tokenApi 的请求实现方法 **/
var uni_ApiRequest = function(url, args, success, fail) {
	// 请求 url 获得 token 数据，然后通过 success 返回结果
	uni.request({
		url: url, data: args, method: 'POST', dataType: 'text',
		header: { 'content-type': 'application/x-www-form-urlencoded' },
		success: (e) => {
			if (e.statusCode != 200) {
				fail('请求出错[' + e.statusCode + ']')
				return
			}
			try {
				var data = JSON.parse(e.data)
			} catch (e) {
				fail('请求结果不是json格式')
				return
			}
			// 根据接口格式提取数据并回调
			if (data.c !== 0) {
				fail('接口调用错误：' + data.m)
				return
			}
			data = data.v
			success({ appkey: data.appkey, token: data.token })
		},
		fail: (e) => {
			fail(e.errMsg || '请求出错')
		}
	})
}

/** 实现 compatibleWebSocket 接口 **/
var uni_WebSocket = function(url) {
	var ws = {
		onopen: () => {},
		onerror: (event) => {},
		onclose: (event) => {},
		onmessage: (event) => {}
	}
	var store = ws.storeData = {}

	ws.send = (data) => {
		store.wsTask.send({ data: data })
	}
	ws.connect = () => {
		var wsTask = store.wsTask = uni.connectSocket({
			url: url,
			success: () => { },
			fail: (res) => {
				if (store.isError) return; store.isError = 1
				ws.onerror({ message: '创建连接出现错误：' + res.errMsg })
			}
		})
		wsTask.onOpen(() => {
			if (store.isOpen) return; store.isOpen = 1
			ws.onopen()
		})
		wsTask.onClose((e) => {
			if (store.isClose) return; store.isClose = 1
			ws.onclose({ code: e.code || -1, reason: e.reason || '' })
		})
		wsTask.onError((e) => {
			if (store.isError) return; store.isError = 1
			ws.onerror({ message: e.errMsg || '未知错误' })
		})
		wsTask.onMessage((e) => { ws.onmessage({ data: e.data }) })
	}
	ws.close = (code, reason) => {
		var obj = {}
		if (code != null) obj.code = code
		if (reason != null) obj.reason = reason
		store.wsTask.close(obj)
	}
	return ws
}

const connectASR = () => {
	if (!asrEnabled.value) return
	try {
		console.log('[ASR] 正在启动阿里云语音识别...')

		// 创建语音识别对象
		asrInstance = Recorder.ASR_Aliyun_Short({
			tokenApi: asrTokenApi,
			apiArgs: {
				lang: asrLanguage.value
			},
			apiRequest: uni_ApiRequest,
			compatibleWebSocket: uni_WebSocket,
			asrProcess: (text, nextDuration, abortMsg) => {
				if (abortMsg) {
					console.error('[ASR] 识别被终止：', abortMsg)
					return false
				}
				asrInterimText.value = text
				// 限制识别时长不超过 2 分钟
				return nextDuration <= 2 * 60 * 1000
			},
			log: (msg, color) => {
				console.log('[ASR]', msg)
			}
		})

		// 打开语音识别
		asrInstance.start(() => {
			console.log('[ASR] 阿里云语音识别已启动')
			asrInterimText.value = ''
			asrFinalText.value = ''
		}, (errMsg) => {
			console.error('[ASR] 语音识别启动失败：', errMsg)
			uni.showToast({ title: 'ASR启动失败', icon: 'none' })
		})
	} catch (e) {
		console.error('[ASR] 连接失败:', e)
	}
}

const closeASR = () => {
	return new Promise((resolve) => {
		asrInterimText.value = ''

		if (!asrInstance) {
			resolve(asrFinalText.value || '')
			return
		}

		var asr2 = asrInstance
		asrInstance = null

		asr2.stop((text, abortMsg) => {
			if (abortMsg) {
				console.log('[ASR] 识别中途被终止：', abortMsg)
			}
			asrFinalText.value = text
			resolve(text || '')
		}, (errMsg) => {
			console.error('[ASR] 识别结束失败：', errMsg)
			resolve(asrFinalText.value || '')
		})
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

// ===================== 云端上传 / 读取 =====================

// 微信小程序：读本地文件 → ArrayBuffer → base64
const readFileAsBase64 = (filePath) => {
	return new Promise((resolve, reject) => {
		uni.getFileSystemManager().readFile({
			filePath: filePath,
			success: (res) => {
				try {
					const base64 = uni.arrayBufferToBase64(res.data)
					resolve(base64)
				} catch (e) {
					reject(e)
				}
			},
			fail: (err) => reject(err)
		})
	})
}

// 上传录音到云端，返回云端 fileID
const uploadToCloud = async (localFilePath, durationSec, mime = 'audio/mpeg') => {
	try {
		uni.showLoading({ title: '上传中...', mask: true })

		let fileID = ''

		// #ifdef MP-WEIXIN
		// 微信小程序：wx.cloud.uploadFile 不接受 USER_DATA_PATH 里的文件，
		// 所以走云函数：本地读 buffer → base64 → 云端写存储 + 写库
		const base64 = await readFileAsBase64(localFilePath)
		const cloudRes = await uniCloud.callFunction({
			name: 'uploadRecording',
			data: {
				base64: base64,
				cloudPath: `recordings/recording_${Date.now()}.mp3`,
				duration: durationSec,
				nickname: uni.getStorageSync('myNickname') || '匿名同学',
				deviceId: uni.getSystemInfoSync().deviceId
			}
		})
		if (!cloudRes.result || !cloudRes.result.success) {
			throw new Error(cloudRes.result?.error || '云函数返回失败')
		}
		fileID = cloudRes.result.fileID
		// #endif

		// #ifndef MP-WEIXIN
		// H5 / APP：把 Blob 包成 File，其它情况直接传路径
		let uploadFile = localFilePath
		if (typeof Blob !== 'undefined' && localFilePath instanceof Blob && !(localFilePath instanceof File)) {
			uploadFile = new File([localFilePath], `recording_${Date.now()}.mp3`, { type: mime })
		}

		const uploadResult = await uniCloud.uploadFile({
			filePath: uploadFile,
			cloudPath: `recordings/recording_${Date.now()}.mp3`,
			onUploadProgress: (e) => {
				console.log(`上传进度: ${e.progress}%`)
			}
		})
		fileID = uploadResult.fileID

		// 将元数据存入云数据库
		const db = uniCloud.database()
		await db.collection('recordings').add({
			fileID: fileID,
			duration: durationSec,
			createTime: Date.now(),
			nickname: uni.getStorageSync('myNickname') || '匿名同学',
			deviceId: uni.getSystemInfoSync().deviceId
		})
		// #endif

		console.log('上传成功，云端地址：', fileID)
		uni.hideLoading()
		uni.showToast({ title: '已保存到云端', icon: 'success' })

		return fileID
	} catch (e) {
		uni.hideLoading()
		console.error('上传失败：', e)
		uni.showToast({ title: '上传失败，已保存本地', icon: 'none' })
		return localFilePath
	}
}

const formatTimestamp = (ts) => {
	const d = new Date(ts)
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	const hh = String(d.getHours()).padStart(2, '0')
	const mm = String(d.getMinutes()).padStart(2, '0')
	const ss = String(d.getSeconds()).padStart(2, '0')
	return {
		fullTime: `${m}-${day} ${hh}:${mm}:${ss}`,
		time: `${hh}:${mm}:${ss}`
	}
}

// 从云数据库读取录音列表（可以看到所有人的录音）
const loadFromCloud = async () => {
	try {
		const db = uniCloud.database()
		const result = await db.collection('recordings')
			.orderBy('createTime', 'desc')
			.limit(50)
			.get()

		const cloudList = (result.result.data || []).map((item) => {
			const t = formatTimestamp(item.createTime || Date.now())
			return {
				id: 'cloud_' + (item._id || item.fileID),
				src: item.fileID,
				fullTime: t.fullTime,
				time: t.time,
				duration: formatTime(item.duration || 0),
				transcript: '',
				transcriptLang: '',
				nickname: item.nickname || '匿名',
				fromCloud: true
			}
		})

		// 合并：云端记录追加到本地列表之后（按 id 去重）
		const existingIds = new Set(recordList.value.map((r) => r.id))
		const newOnes = cloudList.filter((r) => !existingIds.has(r.id))
		if (newOnes.length) {
			recordList.value = [...recordList.value, ...newOnes]
			uni.setStorageSync('recordList', recordList.value)
		}
		console.log('云端录音加载完成，新增', newOnes.length, '条')
	} catch (e) {
		console.error('读取云端失败:', e)
	}
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

.wave-canvas {
	position: relative;
	width: 100%;
	height: 200rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1;
}

.wave-center-line {
	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	height: 2rpx;
	background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
	transform: translateY(-50%);
	pointer-events: none;
}

.wave-bars {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 6rpx;
	height: 100%;
	width: 100%;
	padding: 0 4rpx;
}

.wave-bar {
	width: 10rpx;
	border-radius: 5rpx;
	transition: height 0.08s ease, opacity 0.15s ease;
	min-height: 6rpx;
	flex-shrink: 0;
	box-shadow: 0 0 12rpx rgba(102, 126, 234, 0.4);
	filter: saturate(1.2);
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
	/* 录音列表头部和标签 */
	.record-name-row {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}
	.record-lang-tag {
		font-size: 20rpx;
		color: #667eea;
		background: rgba(102, 126, 234, 0.2);
		padding: 2rpx 12rpx;
		border-radius: 6rpx;
		flex-shrink: 0;
	}
	.record-duration {
		display: block;
		font-size: 22rpx;
		color: rgba(255, 255, 255, 0.35);
		margin-top: 6rpx;
	}
	/* 录音列表中的转录文本 */
	.record-transcript {
		display: -webkit-box;
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.55);
		margin-top: 8rpx;
		line-height: 1.5;
		overflow: hidden;
		text-overflow: ellipsis;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		word-break: break-all;
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


		/* ASR 语言选择 */
		.asr-lang-row {
			margin-top: 20rpx;
			padding-top: 24rpx;
			border-top: 1px solid rgba(255, 255, 255, 0.08);
		}
		.lang-options {
			display: flex;
			flex-wrap: wrap;
			gap: 16rpx;
			margin-top: 12rpx;
		}
		.lang-chip {
			padding: 10rpx 28rpx;
			border-radius: 999rpx;
			background: rgba(255, 255, 255, 0.08);
			border: 1px solid rgba(255, 255, 255, 0.15);
			font-size: 26rpx;
			color: rgba(255, 255, 255, 0.7);
			transition: all 0.2s ease;
		}
		.lang-chip.active {
			background: rgba(102, 126, 234, 0.35);
			border-color: #667eea;
			color: #fff;
			font-weight: 500;
		}
</style>
