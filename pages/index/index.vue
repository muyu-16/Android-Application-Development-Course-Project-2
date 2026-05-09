<template>
  <view class="container">
    <view class="header">
      <view class="pineapple-decoration left">🍍</view>
      <view class="title-area">
        <text class="title">菠萝录音</text>
        <text class="subtitle">甜蜜声音</text>
        <text class="user-info">240200164 梁栩浩</text>
        <text class="user-info">240200181 刘子云</text>
        <text class="user-info">240200177 徐沣</text>
        <text class="user-info">240200175 宋诚</text>
      </view>
      <view class="pineapple-decoration right">🍍</view>
    </view>
    
    <view class="record-section">
      <view class="timer" v-if="isRecording">
        <text class="timer-num">{{ formatTime(recordDuration) }}</text>
      </view>
      
      <view class="visualizer-container">
        <canvas type="2d" id="audioVisualizer" class="visualizer" canvas-id="audioVisualizer" style="width: 300px; height: 75px;"></canvas>
      </view>
      
      <view class="btn-wrapper">
        <view class="leaf left-leaf"></view>
        <view class="leaf right-leaf"></view>
        <view class="ripple" :class="{ 'active': isRecording }"></view>
        <view
          class="record-btn"
          :class="{ 'recording': isRecording }"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
          @touchcancel="handleTouchEnd"
        >
          <image
            class="pineapple-bg"
            src="/static/菠萝录音键.png"
            mode="aspectFit"
          />
        </view>
      </view>
      
      <text class="hint">{{ isRecording ? '松开结束' : '按住说话' }}</text>
    </view>
    
    <view class="status" v-if="statusText">
      <text class="status-text">{{ statusText }}</text>
    </view>
    
    <view class="speed-control" v-if="lastRecordPath && !isRecording">
      <view class="speed-label">变速处理</view>
      <view class="speed-tabs">
        <view 
          class="speed-tab"
          :class="{ active: currentSpeed === 0.5 }"
          @click="handleSpeedChange(0.5)"
        >
          <view class="tab-icon">🐢</view>
          <view class="tab-text">0.5x</view>
          <view class="tab-sub">慢速</view>
        </view>
        <view 
          class="speed-tab center-tab"
          :class="{ active: currentSpeed === 1 }"
          @click="handleSpeedChange(1)"
        >
          <view class="tab-icon">🐇</view>
          <view class="tab-text">1x</view>
          <view class="tab-sub">原速</view>
        </view>
        <view 
          class="speed-tab"
          :class="{ active: currentSpeed === 2 }"
          @click="handleSpeedChange(2)"
        >
          <view class="tab-icon">🚀</view>
          <view class="tab-text">2x</view>
          <view class="tab-sub">快速</view>
        </view>
      </view>
    </view>
    
    <view class="actions" v-if="lastRecordPath && !isRecording">
      <view class="action-btn" @click="replayLast">
        <text class="action-text">重播</text>
      </view>
      <view class="action-btn primary" :class="{ disabled: isSaving }" @click="saveRecording">
        <text class="action-text">{{ isSaving ? '保存中...' : '保存' }}</text>
      </view>
    </view>
    
    <view class="history" v-if="recordings.length > 0">
      <view class="history-title">录音记录</view>
      <scroll-view class="history-list" scroll-y>
        <view 
          v-for="(item, index) in recordings" 
          :key="index" 
          class="history-item-container"
        >
          <view class="history-delete-area" @click="deleteHistory(index)">
            <text class="delete-text">删除</text>
          </view>
          <view 
            class="history-item"
            :class="{'swiped': swipedIndex === index}"
            @touchstart="onTouchStart(index, $event)"
            @touchmove="onTouchMove(index, $event)"
            @touchend="onTouchEnd(index)"
            @click="handleItemClick(index)"
          >
            <view class="history-info">
              <text class="history-name">录音 {{ index + 1 }}</text>
              <text class="history-time">{{ formatRecordTime(item.timestamp) }}</text>
            </view>
            <text class="history-duration">{{ item.duration }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { timeStretch } from '@/utils/time-stretch.js'

const isRecording = ref(false)
const statusText = ref('')
const recordDuration = ref(0)
const lastRecordPath = ref('')
const lastRecordDuration = ref(0)
const recordings = ref([])
const isPlaying = ref(false)
const currentPlayingIndex = ref(-1)
const isSaving = ref(false)
const playbackRate = ref(1)
const audioContextObj = ref(null)
const swipedIndex = ref(-1)
const touchStartX = ref(0)
const currentSpeed = ref(1)

// Web Audio API 相关
const canvasContext = ref(null)
const audioDataArray = ref([])
const canvasWidth = ref(300)
const canvasHeight = ref(75)
const visualizationInterval = ref(null)
const audioEnergy = ref(0)
const isCanvas2D = ref(false)
const hasRealPCMData = ref(false)

// Web Audio API 相关 (H5)
const webAudioContext = ref(null)
const webAudioAnalyser = ref(null)

// 原生音频分析器 (App)
const nativeAudioAnalyzer = ref(null)
const isNativeAnalyzerSupported = ref(false)

let recorderManager = null
let audioContext = null
let durationTimer = null

const isApp = () => typeof plus !== 'undefined'
const isMpWx = () => typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH
const isH5 = () => typeof window !== 'undefined' && typeof document !== 'undefined' && !isApp() && !isMpWx()

onMounted(() => {
  recorderManager = uni.getRecorderManager()
  
  initCanvas()
  
  recorderManager.onStart(() => {
    isRecording.value = true
    statusText.value = '正在录音...'
    startDurationTimer()
    startAudioVisualization()
  })
  
  recorderManager.onFrameRecorded((res) => {
    if (isMpWx() && res.frameBuffer) {
      hasRealPCMData.value = true
      processPCMFrame(res.frameBuffer)
    }
  })
  
  recorderManager.onStop(async (res) => {
    isRecording.value = false
    stopDurationTimer()
    stopAudioVisualization()
    lastRecordPath.value = res.tempFilePath
    const duration = res.duration || recordDuration.value || 0
    lastRecordDuration.value = duration
    recordDuration.value = duration

    if (isMpWx()) {
      statusText.value = '录音完成，自动播放中...'
      playAudio(res.tempFilePath)
    } else {
      try {
        statusText.value = '处理录音中...'
        const speededPath = await timeStretch(res.tempFilePath, 1.5)
        statusText.value = '录音完成，自动播放中...'
        playAudio(speededPath)
      } catch (error) {
        console.error('变速处理失败:', error)
        statusText.value = '录音完成，自动播放中...'
        playAudio(res.tempFilePath)
      }
    }
  })
  
  recorderManager.onError((err) => {
    isRecording.value = false
    stopDurationTimer()
    stopAudioVisualization()
    statusText.value = '录音失败: ' + err.errMsg
  })
  
  loadRecordings()
})

onUnmounted(() => {
  stopCurrentPlayback()
  stopAudioVisualization()
  if (durationTimer) {
    clearInterval(durationTimer)
  }
})

const startDurationTimer = () => {
  recordDuration.value = 0
  durationTimer = setInterval(() => {
    recordDuration.value += 100
    if (recordDuration.value >= 60000) {
      stopRecording()
    }
  }, 100)
}

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

const formatRecordTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

const handleTouchStart = (e) => {
  e.preventDefault()
  startRecording()
}

const handleTouchEnd = (e) => {
  e.preventDefault()
  stopRecording()
}

const startRecording = () => {
  if (isRecording.value) return
  statusText.value = '准备录音...'
  stopCurrentPlayback()

  if (isApp()) {
    recorderManager.start({
      format: 'aac',
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1
    })
  } else if (isMpWx()) {
    hasRealPCMData.value = false
    recorderManager.start({
      format: 'wav',
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      frameSize: 256
    })
  } else {
    recorderManager.start({
      format: 'wav',
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1
    })
  }
}

const stopRecording = () => {
  if (isRecording.value) {
    recorderManager.stop()
  }
}

const playAudio = (filePath) => {
  startAudioVisualization()

  if (isH5()) {
    playWithWebAudioAPI(filePath)
    return
  }

  if (filePath.startsWith('file://') || filePath.startsWith('wxfile://') ||
      filePath.includes('tmp://') || filePath.includes('temp://') ||
      !filePath.startsWith('http')) {
    playWithNativeAudio(filePath)
    return
  }

  playWithNativeAudio(filePath)
}

const playWithNativeAudio = (filePath) => {
  if (audioContext) {
    audioContext.destroy()
  }
  audioContext = uni.createInnerAudioContext()
  audioContext.src = filePath
  audioContext.playbackRate = playbackRate.value

  audioContext.onPlay(() => {
    isPlaying.value = true
    statusText.value = '播放中...'
  })

  audioContext.onTimeUpdate(() => {
    const progress = audioContext.currentTime / (audioContext.duration || 1)
    audioEnergy.value = 0.3 + Math.abs(Math.sin(progress * Math.PI * 2)) * 0.4 + Math.random() * 0.3
  })

  audioContext.onEnded(() => {
    isPlaying.value = false
    audioEnergy.value = 0
    currentPlayingIndex.value = -1
    statusText.value = '播放完成 ✓'
    stopAudioVisualization()
  })

  audioContext.onError((err) => {
    isPlaying.value = false
    audioEnergy.value = 0
    currentPlayingIndex.value = -1
    statusText.value = '播放失败: ' + err.errMsg
    console.error('播放失败:', err)
    stopAudioVisualization()
  })

  audioContext.play()
}

// H5 环境使用 Web Audio API 播放音频并获取真实可视化数据
const playWithWebAudioAPI = (filePath) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  const h5AudioContext = new AudioContextClass()

  // 确保分析器已初始化
  if (!webAudioAnalyser.value) {
    initWebAudioAnalyser()
  }

  // 创建音频源
  const audioElement = new Audio()
  audioElement.src = filePath
  audioElement.crossOrigin = 'anonymous'

  const source = h5AudioContext.createMediaElementSource(audioElement)
  source.connect(webAudioAnalyser.value)
  webAudioAnalyser.value.connect(h5AudioContext.destination)

  audioElement.playbackRate = playbackRate.value
  audioElement.play()

  isPlaying.value = true
  statusText.value = '播放中...'

  audioElement.onended = () => {
    isPlaying.value = false
    currentPlayingIndex.value = -1
    statusText.value = '播放完成 ✓'
    stopAudioVisualization()
    h5AudioContext.close()
  }

  audioElement.onerror = (err) => {
    isPlaying.value = false
    currentPlayingIndex.value = -1
    statusText.value = '播放失败'
    console.error('H5 音频播放失败:', err)
    stopAudioVisualization()
    h5AudioContext.close()
  }

  audioContextObj.value = {
    context: h5AudioContext,
    source: audioElement
  }
}

const stopCurrentPlayback = () => {
  if (audioContext) {
    audioContext.stop()
    audioContext.destroy()
    audioContext = null
  }
  if (audioContextObj.value) {
    if (audioContextObj.value.source) {
      try {
        audioContextObj.value.source.stop()
      } catch (e) { /* 可能已停止 */ }
    }
    if (audioContextObj.value.context) {
      audioContextObj.value.context.close()
    }
    audioContextObj.value = null
  }
  isPlaying.value = false
  currentPlayingIndex.value = -1
}

const replayLast = () => {
  if (lastRecordPath.value) {
    stopCurrentPlayback()
    playAudio(lastRecordPath.value)
  }
}

const saveRecording = () => {
  if (!lastRecordPath.value || isSaving.value) return

  isSaving.value = true
  statusText.value = '保存中...'
  const timestamp = Date.now()
  const fileName = `recording_${timestamp}.wav`

  if (isApp()) {
    plus.io.resolveLocalFileSystemURL(lastRecordPath.value, (tempEntry) => {
      plus.io.resolveLocalFileSystemURL('_doc/', (docEntry) => {
        tempEntry.copyTo(docEntry, fileName, (res) => {
          doSaveSuccess(res.fullPath)
        }, (err) => {
          console.error('复制文件失败，尝试直接保存:', err)
          doSaveWithNativeAPI(lastRecordPath.value, fileName)
        })
      }, (err) => {
        console.error('访问文档目录失败:', err)
        doSaveWithNativeAPI(lastRecordPath.value, fileName)
      })
    }, (err) => {
      console.error('访问临时文件失败:', err)
      doSaveWithNativeAPI(lastRecordPath.value, fileName)
    })
  } else if (isMpWx()) {
    const savedPath = `${wx.env.USER_DATA_PATH}/${fileName}`
    uni.saveFile({
      tempFilePath: lastRecordPath.value,
      filePath: savedPath,
      success: (res) => {
        doSaveSuccess(res.savedFilePath)
      },
      fail: (err) => {
        isSaving.value = false
        console.error('保存录音失败:', err)
        statusText.value = '保存失败，请重试'
      }
    })
  } else if (isH5()) {
    doSaveForH5(lastRecordPath.value, fileName)
  } else {
    doSaveWithNativeAPI(lastRecordPath.value, fileName)
  }
}

const doSaveSuccess = (savedPath) => {
  isSaving.value = false
  const duration = lastRecordDuration.value || recordDuration.value || 0

  const newRecording = {
    path: savedPath,
    duration: formatTime(duration),
    timestamp: Date.now()
  }

  recordings.value.unshift(newRecording)

  saveRecordingsToStorage()
  lastRecordPath.value = ''
  lastRecordDuration.value = 0
  recordDuration.value = 0
  statusText.value = '已保存到录音记录 ✓'
}

const doSaveWithNativeAPI = (tempPath, fileName) => {
  uni.saveFile({
    tempFilePath: tempPath,
    filePath: fileName,
    success: (res) => {
      doSaveSuccess(res.savedFilePath)
    },
    fail: (err) => {
      isSaving.value = false
      console.error('Native API保存失败:', err)
      statusText.value = '保存失败，请重试'
    }
  })
}

const doSaveForH5 = (filePath, fileName) => {
  const link = document.createElement('a')
  link.href = filePath
  link.download = fileName
  link.click()

  isSaving.value = false
  const newRecording = {
    path: filePath,
    duration: formatTime(lastRecordDuration.value),
    timestamp: Date.now()
  }

  recordings.value.unshift(newRecording)
  saveRecordingsToStorage()
  lastRecordPath.value = ''
  lastRecordDuration.value = 0
  recordDuration.value = 0
  statusText.value = '已保存到录音记录 ✓'
}

const playHistory = (index) => {
  stopCurrentPlayback()
  currentPlayingIndex.value = index
  playAudio(recordings.value[index].path)
}

const deleteHistory = (index) => {
  recordings.value.splice(index, 1)
  saveRecordingsToStorage()
  swipedIndex.value = -1
}

const onTouchStart = (index, event) => {
  const touch = event.touches[0]
  touchStartX.value = touch.clientX
}

const onTouchMove = (index, event) => {
  const touch = event.touches[0]
  const diffX = touchStartX.value - touch.clientX
  
  if (diffX > 60) {
    swipedIndex.value = index
  } else if (diffX < -60) {
    swipedIndex.value = -1
  }
}

const onTouchEnd = (index) => {
  if (swipedIndex.value === index) {
    return
  }
  swipedIndex.value = -1
}

const handleItemClick = (index) => {
  swipedIndex.value = -1
  playHistory(index)
}

const loadRecordings = async () => {
  try {
    const saved = uni.getStorageSync('recordings')
    if (saved) {
      const loadedRecordings = JSON.parse(saved)
      const validRecordings = []
      
      for (const item of loadedRecordings) {
        try {
          const fileInfo = await new Promise((resolve, reject) => {
            uni.getFileInfo({
              filePath: item.path,
              success: resolve,
              fail: reject
            })
          })
          validRecordings.push(item)
        } catch (e) {
          console.log('录音文件已失效:', item.path)
        }
      }
      
      recordings.value = validRecordings
      if (validRecordings.length !== loadedRecordings.length) {
        saveRecordingsToStorage()
      }
    }
  } catch (e) {
    console.error('加载录音记录失败', e)
  }
}

const saveRecordingsToStorage = () => {
  try {
    uni.setStorageSync('recordings', JSON.stringify(recordings.value))
  } catch (e) {
    console.error('保存录音记录失败', e)
  }
}

const handleSpeedChange = async (speed) => {
  if (!lastRecordPath.value) return
  currentSpeed.value = speed

  if (isMpWx()) {
    statusText.value = `正在播放${speed}x速度...`
    playbackRate.value = speed
    playAudio(lastRecordPath.value)
  } else {
    try {
      statusText.value = `处理${speed}x速度中...`
      const speededPath = await timeStretch(lastRecordPath.value, speed)
      statusText.value = `正在播放${speed}x速度...`
      playAudio(speededPath)
    } catch (error) {
      console.error('变速处理失败:', error)
      statusText.value = `正在播放${speed}x速度...`
      playbackRate.value = speed
      playAudio(lastRecordPath.value)
    }
  }
}

// 初始化 Web Audio API 分析器
const initWebAudioAnalyser = () => {
  if (webAudioContext.value) return

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    webAudioContext.value = new AudioContextClass()
    webAudioAnalyser.value = webAudioContext.value.createAnalyser()
    webAudioAnalyser.value.fftSize = 2048
    webAudioAnalyser.value.smoothingTimeConstant = 0.3

    audioDataArray.value = new Uint8Array(webAudioAnalyser.value.frequencyBinCount)
  } catch (e) {
    console.error('Web Audio API 初始化失败:', e)
  }
}

// 音频可视化相关方法
const initCanvas = () => {
  // App 环境 - 使用 uni.createCanvasContext + 原生音频分析器
  if (isApp()) {
    try {
      canvasContext.value = uni.createCanvasContext('audioVisualizer')
      canvasWidth.value = 300
      canvasHeight.value = 75
      audioDataArray.value = new Uint8Array(128)
      initNativeAudioAnalyzer()
      return
    } catch (e) {
      console.error('App Canvas初始化失败:', e)
    }
    return
  }

  // 小程序环境 - 使用 SelectorQuery 获取 Canvas 2D 节点
  if (isMpWx()) {
    try {
      const query = uni.createSelectorQuery()
      query.select('#audioVisualizer')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (res && res[0] && res[0].node) {
            const canvas = res[0].node
            const dpr = uni.getSystemInfoSync().pixelRatio
            canvas.width = 300 * dpr
            canvas.height = 75 * dpr
            const ctx = canvas.getContext('2d')
            ctx.scale(dpr, dpr)
            canvasContext.value = ctx
            canvasWidth.value = 300
            canvasHeight.value = 75
            audioDataArray.value = new Uint8Array(128)
            isCanvas2D.value = true
            if (isPlaying.value || isRecording.value) {
              startAudioVisualization()
            }
          }
        })
    } catch (e) {
      console.error('小程序Canvas初始化失败:', e)
    }
    return
  }

  // H5 环境 - 使用 Canvas 2D + Web Audio API
  if (isH5()) {
    const canvas = document.getElementById('audioVisualizer')
    if (canvas) {
      canvasContext.value = canvas.getContext('2d')
      canvasWidth.value = canvas.width || 300
      canvasHeight.value = canvas.height || 75
      isCanvas2D.value = true
      initWebAudioAnalyser()
      audioDataArray.value = new Uint8Array(webAudioAnalyser.value?.frequencyBinCount || 128)
    } else {
      console.error('H5 Canvas初始化失败: 无法获取canvas元素')
    }
    return
  }
}

// 初始化原生音频分析器 (App端)
const initNativeAudioAnalyzer = () => {
  try {
    const nativeModule = uni.requireNativePlugin('AudioAnalyzer')
    if (nativeModule) {
      nativeAudioAnalyzer.value = nativeModule
      isNativeAnalyzerSupported.value = true

      if (nativeModule.setCallback) {
        nativeModule.setCallback((frequencies) => {
          if (frequencies && frequencies.length > 0) {
            audioDataArray.value = new Uint8Array(frequencies.map(f => Math.round(f * 255)))
          }
        })
      }
    } else {
      isNativeAnalyzerSupported.value = false
    }
  } catch (e) {
    isNativeAnalyzerSupported.value = false
    console.error('原生音频分析器加载失败:', e)
  }
}

const startAudioVisualization = () => {
  if (isApp() && nativeAudioAnalyzer.value && isNativeAnalyzerSupported.value) {
    try {
      nativeAudioAnalyzer.value.start({
        sampleRate: 44100,
        channel: 1,
        fftSize: 256
      })
    } catch (e) {
      console.error('启动原生音频分析器失败:', e)
    }
  }

  if (!canvasContext.value) {
    initCanvas()
    return
  }

  stopAudioVisualization()

  visualizationInterval.value = setInterval(() => {
    drawVisualization()
  }, 30)
}

const stopAudioVisualization = () => {
  if (isApp() && nativeAudioAnalyzer.value && isNativeAnalyzerSupported.value) {
    try {
      nativeAudioAnalyzer.value.stop()
      console.log('原生音频分析器已停止')
    } catch (e) {
      console.error('停止原生音频分析器失败:', e)
    }
  }

  if (visualizationInterval.value) {
    clearInterval(visualizationInterval.value)
    visualizationInterval.value = null
  }

  // 清空 Canvas - 使用背景色覆盖
  if (canvasContext.value) {
    const ctx = canvasContext.value
    const is2D = isCanvas2D.value
    if (is2D) {
      ctx.fillStyle = '#1a1a3e'
    } else {
      ctx.setFillStyle('#1a1a3e')
    }
    ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)
    if (!is2D) {
      ctx.draw()
    }
  }
}

// 实时处理来自麦克风的 PCM 音频数据，生成真实频谱
function processPCMFrame(frameBuffer) {
  try {
    const int16Array = new Int16Array(frameBuffer)
    const n = int16Array.length
    if (n < 8) return

    const numBars = audioDataArray.value.length || 128
    const samplesPerBand = Math.max(2, Math.floor(n / numBars))

    for (let i = 0; i < numBars; i++) {
      let sumSq = 0
      let count = 0
      const startIdx = Math.min(i * samplesPerBand, n - samplesPerBand)

      for (let j = 0; j < samplesPerBand && (startIdx + j) < n; j++) {
        const normalized = int16Array[startIdx + j] / 32768
        sumSq += normalized * normalized
        count++
      }

      const rms = Math.sqrt(sumSq / count) * 5
      const value = Math.min(255, Math.max(0, Math.round(rms * 255)))

      audioDataArray.value[i] = audioDataArray.value[i]
        ? Math.round(audioDataArray.value[i] * 0.6 + value * 0.4)
        : value
    }
  } catch (e) {
    console.error('PCM处理失败:', e)
  }
}

const drawVisualization = () => {
  if (!canvasContext.value || canvasWidth.value <= 0 || canvasHeight.value <= 0) {
    return
  }

  const useNativeData = isApp() && nativeAudioAnalyzer.value && isNativeAnalyzerSupported.value && audioDataArray.value.length > 0
  const useWebAudioData = isH5() && webAudioAnalyser.value
  const useRealPCM = isMpWx() && hasRealPCMData.value && audioDataArray.value.length > 0

  if (!useNativeData && !useWebAudioData && !useRealPCM) {
    updateAudioData()
  }

  const ctx = canvasContext.value
  const width = canvasWidth.value
  const height = canvasHeight.value
  const is2D = isCanvas2D.value

  if (is2D) {
    ctx.fillStyle = '#1a1a3e'
  } else {
    ctx.setFillStyle('#1a1a3e')
  }
  ctx.fillRect(0, 0, width, height)

  const barCount = audioDataArray.value.length
  const barWidth = Math.max(2, (width / barCount) * 0.7)
  const gap = Math.max(1, (width - barCount * barWidth) / (barCount + 1))

  for (let i = 0; i < barCount; i++) {
    const barHeight = Math.max(4, (audioDataArray.value[i] / 255) * height * 0.7)
    const x = gap + i * (barWidth + gap)
    const y = height - barHeight

    const ratio = audioDataArray.value[i] / 255
    const r = Math.round(255 * ratio + 50 * (1 - ratio))
    const g = Math.round(180 * ratio + 50 * (1 - ratio))
    const b = Math.round(30 * ratio + 50 * (1 - ratio))

    if (is2D) {
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    } else {
      ctx.setFillStyle(`rgb(${r}, ${g}, ${b})`)
    }
    ctx.fillRect(x, y, barWidth, barHeight)

    if (is2D) {
      ctx.fillStyle = `rgba(255, 255, 200, ${ratio * 0.3})`
    } else {
      ctx.setFillStyle(`rgba(255, 255, 200, ${ratio * 0.3})`)
    }
    ctx.fillRect(x, y, barWidth, Math.max(2, barHeight * 0.15))
  }

  if (!is2D) {
    ctx.draw()
  }
}

const updateAudioData = () => {
  const time = Date.now() / 1000
  const isActive = isRecording.value || isPlaying.value
  const energy = isActive ? (isRecording.value ? 0.7 + Math.random() * 0.3 : audioEnergy.value) : 0

  for (let i = 0; i < audioDataArray.value.length; i++) {
    if (isActive) {
      const pos = i / audioDataArray.value.length

      const lowFreq = Math.pow(1 - pos * 0.7, 2)
      const highFreq = Math.exp(-pos * 3)

      const wave = Math.sin(pos * Math.PI * 6 + time * 4) * 0.3
        + Math.sin(pos * Math.PI * 12 + time * 6) * 0.2

      const noise = (Math.random() - 0.5) * 0.25

      const value = 255 * energy * (lowFreq * 0.6 + highFreq * 0.4) * (0.7 + wave + noise)
        + audioDataArray.value[i] * 0.15

      audioDataArray.value[i] = Math.max(15, Math.min(255, Math.round(value)))
    } else {
      audioDataArray.value[i] = Math.max(0, Math.round(audioDataArray.value[i] * 0.9 - 3))
    }
  }
}
</script>

/* 姓名: 张三 学号: 2023001 使用LLM: MiniMax-M2.5 */
<style>
page {
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d0d1f 100%);
  min-height: 100vh;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx 60rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40rpx;
}

.pineapple-decoration {
  font-size: 48rpx;
  animation: float 3s ease-in-out infinite;
}

.pineapple-decoration.left {
  animation-delay: 0s;
}

.pineapple-decoration.right {
  animation-delay: 1.5s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10rpx);
  }
}

.title-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 20rpx;
}

.title {
  font-size: 52rpx;
  font-weight: 700;
  color: #ffd93d;
  text-shadow: 0 4rpx 20rpx rgba(255, 217, 61, 0.3);
}

.subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8rpx;
}

.user-info {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 12rpx;
  letter-spacing: 2rpx;
}

.record-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60rpx;
}

.visualizer-container {
  width: 300px;
  height: 75px;
  margin-bottom: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 20rpx;
  padding: 0;
  box-sizing: border-box;
}

.visualizer {
  width: 300px;
  height: 75px;
  border-radius: 16rpx;
}

.timer {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 60rpx;
  padding: 20rpx 50rpx;
  margin-bottom: 60rpx;
  backdrop-filter: blur(20rpx);
}

.timer-num {
  font-size: 56rpx;
  font-weight: 300;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  letter-spacing: 6rpx;
}

.btn-wrapper {
  position: relative;
  width: 320rpx;
  height: 320rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.leaf {
  position: absolute;
  top: -30rpx;
  width: 20rpx;
  height: 60rpx;
  background: linear-gradient(180deg, #4ade80 0%, #22c55e 100%);
  border-radius: 20rpx 20rpx 0 0;
  z-index: 5;
}

.left-leaf {
  left: 60rpx;
  transform: rotate(-30deg);
}

.right-leaf {
  right: 60rpx;
  transform: rotate(30deg);
}

.record-btn.recording .leaf {
  background: linear-gradient(180deg, #fb923c 0%, #f97316 100%);
  animation: leafShake 0.5s ease-in-out infinite;
}

@keyframes leafShake {
  0%, 100% {
    transform: rotate(-30deg);
  }
  25% {
    transform: rotate(-35deg);
  }
  75% {
    transform: rotate(-25deg);
  }
}

.record-btn.recording .right-leaf {
  animation: leafShakeRight 0.5s ease-in-out infinite;
}

@keyframes leafShakeRight {
  0%, 100% {
    transform: rotate(30deg);
  }
  25% {
    transform: rotate(35deg);
  }
  75% {
    transform: rotate(25deg);
  }
}

.ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.8);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 217, 61, 0.3);
  opacity: 0;
  transition: all 0.6s ease;
}

.ripple.active {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
  animation: ripplePulse 1.5s ease-out infinite;
}

.ripple.active::before,
.ripple.active::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120%;
  height: 120%;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 217, 61, 0.2);
  animation: ripplePulse 1.5s ease-out infinite;
}

.ripple.active::after {
  width: 140%;
  height: 140%;
  animation-delay: 0.5s;
}

@keyframes ripplePulse {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0;
  }
}

.record-btn {
  width: 320rpx;
  height: 320rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.pineapple-bg {
  width: 100%;
  height: 100%;
}

.record-btn.recording .pineapple-bg {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.record-btn.recording {
  background: linear-gradient(145deg, #fb923c 0%, #f97316 50%, #ea580c 100%);
  box-shadow: 
    0 20rpx 60rpx rgba(251, 146, 60, 0.5),
    0 0 0 0 rgba(251, 146, 60, 0),
    inset 0 2rpx 4rpx rgba(255, 255, 255, 0.3),
    inset 0 -4rpx 8rpx rgba(0, 0, 0, 0.1);
  transform: scale(0.92);
}

.record-btn:active {
  transform: scale(0.88);
}

.record-btn.recording:active {
  transform: scale(0.85);
}

.hint {
  margin-top: 50rpx;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 2rpx;
}

.status {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 100rpx;
  padding: 20rpx 50rpx;
  margin-bottom: 40rpx;
}

.status-text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 1rpx;
}

.actions {
  display: flex;
  gap: 30rpx;
  margin-bottom: 60rpx;
}

.action-btn {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 100rpx;
  padding: 20rpx 50rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.action-btn:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.12);
}

.action-btn.primary {
  background: rgba(255, 217, 61, 0.3);
  border-color: rgba(255, 217, 61, 0.5);
}

.action-btn.primary:active {
  background: rgba(255, 217, 61, 0.5);
}

.action-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: 500;
}

.history {
  width: 100%;
  max-width: 600rpx;
}

.history-title {
  font-size: 30rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 20rpx;
  padding-left: 10rpx;
}

.history-list {
  max-height: 350rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 24rpx;
  overflow: hidden;
}

.history-item-container {
  position: relative;
  overflow: hidden;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40rpx 45rpx;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
  position: relative;
  z-index: 2;
  transition: transform 0.3s ease;
}

.history-item-container:last-child .history-item {
  border-bottom: none;
}

.history-item.swiped {
  transform: translateX(-160rpx);
}

.history-delete-area {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 0;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  overflow: hidden;
  transition: width 0.3s ease;
}

.history-item.swiped ~ .history-delete-area {
  width: 160rpx;
}

.history-item-container:has(.history-item.swiped) .history-delete-area {
  width: 160rpx;
}

.delete-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
  letter-spacing: 2rpx;
  text-align: center;
}

.history-item:active {
  background: rgba(255, 255, 255, 0.08);
}

.history-info {
  display: flex;
  flex-direction: column;
}

.history-name {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  margin-bottom: 8rpx;
}

.history-time {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 8rpx;
}

.history-duration {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.speed-control {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 32rpx;
  padding: 32rpx 24rpx;
  margin-bottom: 30rpx;
}

.speed-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  margin-bottom: 24rpx;
}

.speed-tabs {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.speed-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 16rpx;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 24rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
}

.speed-tab.active {
  background: linear-gradient(145deg, rgba(255, 217, 61, 0.25) 0%, rgba(255, 184, 0, 0.15) 100%);
  border-color: rgba(255, 217, 61, 0.5);
  transform: scale(1.05);
  box-shadow: 0 8rpx 30rpx rgba(255, 217, 61, 0.2);
}

.center-tab {
  margin-top: 0rpx;
}

.center-tab.active {
  transform: scale(1.1);
}

.tab-icon {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.tab-text {
  font-size: 32rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4rpx;
}

.tab-sub {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.4);
}

.speed-tab.active .tab-text {
  color: #ffd93d;
}

.speed-tab.active .tab-sub {
  color: rgba(255, 217, 61, 0.7);
}
</style>
