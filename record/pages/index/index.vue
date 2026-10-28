<template>
  <view class="container">
    <view class="header">
      <view class="pineapple-decoration left">🍍</view>
      <view class="title-area">
        <text class="title">菠萝录音</text>
        <text class="subtitle">甜蜜声音 🍍</text>
      </view>
      <view class="pineapple-decoration right">🍍</view>
    </view>
    
    <view class="record-section">
      <view class="timer" v-if="isRecording">
        <text class="timer-num">{{ formatTime(recordDuration) }}</text>
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
    
    <view class="speed-control" v-if="isPlaying">
      <view class="speed-label">播放速度</view>
      <view class="speed-buttons">
        <view 
          class="speed-btn" 
          :class="{ active: playbackRate === 0.5 }"
          @click="setSpeed(0.5)"
        >0.5x</view>
        <view 
          class="speed-btn" 
          :class="{ active: playbackRate === 0.75 }"
          @click="setSpeed(0.75)"
        >0.75x</view>
        <view 
          class="speed-btn" 
          :class="{ active: playbackRate === 1 }"
          @click="setSpeed(1)"
        >1x</view>
        <view 
          class="speed-btn" 
          :class="{ active: playbackRate === 1.25 }"
          @click="setSpeed(1.25)"
        >1.25x</view>
        <view 
          class="speed-btn" 
          :class="{ active: playbackRate === 1.5 }"
          @click="setSpeed(1.5)"
        >1.5x</view>
        <view 
          class="speed-btn" 
          :class="{ active: playbackRate === 2 }"
          @click="setSpeed(2)"
        >2x</view>
      </view>
    </view>
    
    <view class="actions" v-if="lastRecordPath && !isRecording">
      <view class="action-btn" @click="replayLast">
        <text class="action-text">重播</text>
      </view>
      <view class="action-btn primary" @click="saveRecording">
        <text class="action-text">保存</text>
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
            @click="handleItemClick(index, item)"
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
import { ref, computed, onMounted, onUnmounted } from 'vue'

const isRecording = ref(false)
const statusText = ref('')
const recordDuration = ref(0)
const lastRecordPath = ref('')
const lastRecordDuration = ref(0)
const recordings = ref([])
const isPlaying = ref(false)
const currentPlayingIndex = ref(-1)
const playbackRate = ref(1)
const audioContextObj = ref(null)
const swipedIndex = ref(-1)
const touchStartX = ref(0)
const touchStartY = ref(0)

let recorderManager = null
let audioContext = null
let touchTimer = null
let durationTimer = null

const statusClass = computed(() => {
  if (statusText.value.includes('录音中') || statusText.value.includes('播放中')) {
    return 'status-active'
  }
  if (statusText.value.includes('完成')) {
    return 'status-success'
  }
  if (statusText.value.includes('失败') || statusText.value.includes('错误')) {
    return 'status-error'
  }
  return ''
})

onMounted(() => {
  recorderManager = uni.getRecorderManager()
  
  recorderManager.onStart(() => {
    isRecording.value = true
    statusText.value = '正在录音...'
    startDurationTimer()
  })
  
  recorderManager.onStop((res) => {
    isRecording.value = false
    stopDurationTimer()
    lastRecordPath.value = res.tempFilePath
    console.log('=================================')
    console.log('录音停止事件触发')
    console.log('res 对象完整内容:', JSON.stringify(res))
    console.log('res.tempFilePath:', res.tempFilePath)
    console.log('res.duration:', res.duration)
    console.log('recordDuration.value:', recordDuration.value)
    console.log('=================================')
    const duration = res.duration || recordDuration.value || 0
    lastRecordDuration.value = duration
    recordDuration.value = duration
    statusText.value = '录音完成，自动播放中...'
    playAudio(res.tempFilePath)
  })
  
  recorderManager.onError((err) => {
    isRecording.value = false
    stopDurationTimer()
    statusText.value = '录音失败: ' + err.errMsg
  })
  
  loadRecordings()
})

onUnmounted(() => {
  stopCurrentPlayback()
  if (touchTimer) {
    clearTimeout(touchTimer)
  }
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
  touchTimer = setTimeout(() => {
    startRecording()
  }, 100)
}

const handleTouchEnd = (e) => {
  e.preventDefault()
  if (touchTimer) {
    clearTimeout(touchTimer)
    touchTimer = null
  }
  stopRecording()
}

const startRecording = () => {
  if (isRecording.value) return
  statusText.value = '准备录音...'
  stopCurrentPlayback()
  recorderManager.start({
    format: 'mp3',
    duration: 60000,
    sampleRate: 48000,
    bitRate: 128000,
    numberOfChannels: 2,
    encodeBitRate: 128000
  })
}

const stopRecording = () => {
  if (isRecording.value) {
    recorderManager.stop()
  }
}

const playAudio = (filePath) => {
  // 本地临时文件路径(tempFilePath)使用原生音频播放
  if (filePath.startsWith('file://') || filePath.startsWith('wxfile://') || 
      filePath.includes('tmp://') || filePath.includes('temp://') ||
      !filePath.startsWith('http')) {
    playWithNativeAudio(filePath)
    return
  }
  
  // 尝试使用Web Audio API实现变速不变调
  if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
    const AudioContextClass = AudioContext || webkitAudioContext
    const audioContext = new AudioContextClass()
    
    uni.request({
      url: filePath,
      responseType: 'arraybuffer',
      success: (res) => {
        audioContext.decodeAudioData(res.data, (buffer) => {
          const source = audioContext.createBufferSource()
          source.buffer = buffer
          
          const pitchShifter = audioContext.createScriptProcessor(4096, 1, 1)
          const currentPlaybackRate = playbackRate.value
          
          let position = 0
          const bufferSize = 4096
          
          pitchShifter.onaudioprocess = (event) => {
            const outputData = event.outputBuffer.getChannelData(0)
            
            for (let i = 0; i < bufferSize; i++) {
              position += currentPlaybackRate
              if (position >= buffer.length) {
                position = buffer.length - 1
                try {
                  source.stop()
                } catch (e) {}
                isPlaying.value = false
                currentPlayingIndex.value = -1
                statusText.value = '播放完成 ✓'
                return
              }
              
              const index = Math.floor(position)
              const fraction = position - index
              
              if (index < buffer.length - 1) {
                outputData[i] = buffer.getChannelData(0)[index] * (1 - fraction) + 
                               buffer.getChannelData(0)[index + 1] * fraction
              } else {
                outputData[i] = 0
              }
            }
          }
          
          source.connect(pitchShifter)
          pitchShifter.connect(audioContext.destination)
          source.start()
          
          isPlaying.value = true
          statusText.value = '播放中...'
          
          audioContextObj.value = {
            context: audioContext,
            source: source,
            pitchShifter: pitchShifter
          }
        }, (err) => {
          console.error('解码音频失败:', err)
          playWithNativeAudio(filePath)
        })
      },
      fail: (err) => {
        console.error('加载音频失败:', err)
        playWithNativeAudio(filePath)
      }
    })
  } else {
    playWithNativeAudio(filePath)
  }
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
  
  audioContext.onEnded(() => {
    isPlaying.value = false
    currentPlayingIndex.value = -1
    statusText.value = '播放完成 ✓'
  })
  
  audioContext.onError((err) => {
    isPlaying.value = false
    currentPlayingIndex.value = -1
    statusText.value = '播放失败: ' + err.errMsg
    console.error('播放失败:', err)
  })
  
  audioContext.play()
}

const setSpeed = (rate) => {
  playbackRate.value = rate
  if (audioContext) {
    audioContext.playbackRate = rate
  }
  if (audioContextObj.value) {
    // 对于Web Audio API，需要重新创建音频源以改变播放速度
    if (isPlaying.value && lastRecordPath.value) {
      stopCurrentPlayback()
      playAudio(lastRecordPath.value)
    } else if (isPlaying.value && currentPlayingIndex.value >= 0 && recordings.value[currentPlayingIndex.value]) {
      stopCurrentPlayback()
      playAudio(recordings.value[currentPlayingIndex.value].path)
    }
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
      } catch (e) {
        console.log('音频已停止:', e)
      }
    }
    if (audioContextObj.value.pitchShifter) {
      audioContextObj.value.pitchShifter.disconnect()
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
  if (!lastRecordPath.value) return

  const timestamp = Date.now()
  const fileName = `recording_${timestamp}.mp3`

  const isApp = typeof plus !== 'undefined'
  const isWx = typeof wx !== 'undefined' && wx.env !== 'undefined'
  const isH5 = typeof window !== 'undefined' && !isApp && !isWx

  if (isApp) {
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
  } else if (isWx) {
    const savedPath = `${wx.env.USER_DATA_PATH}/${fileName}`
    uni.saveFile({
      tempFilePath: lastRecordPath.value,
      filePath: savedPath,
      success: (res) => {
        doSaveSuccess(res.savedFilePath)
      },
      fail: (err) => {
        console.error('保存录音失败:', err)
        statusText.value = '保存失败，请重试'
      }
    })
  } else if (isH5) {
    doSaveForH5(lastRecordPath.value, fileName)
  } else {
    doSaveWithNativeAPI(lastRecordPath.value, fileName)
  }
}

const doSaveSuccess = (savedPath) => {
  console.log('=================================')
  console.log('doSaveSuccess 被调用')
  console.log('lastRecordDuration.value:', lastRecordDuration.value)
  console.log('typeof lastRecordDuration.value:', typeof lastRecordDuration.value)
  console.log('recordDuration.value:', recordDuration.value)
  console.log('=================================')

  const duration = lastRecordDuration.value || recordDuration.value || 0
  console.log('计算后的 duration:', duration)

  const newRecording = {
    path: savedPath,
    duration: formatTime(duration),
    timestamp: Date.now()
  }

  console.log('=================================')
  console.log('录音记录存盘成功！')
  console.log('姓名：梁栩浩')
  console.log('操作前录音列表长度:', recordings.value.length)
  recordings.value.unshift(newRecording)
  console.log('操作后录音列表长度:', recordings.value.length)
  console.log('=================================')

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

const deleteLast = () => {
  lastRecordPath.value = ''
  lastRecordDuration.value = 0
  recordDuration.value = 0
  statusText.value = '已删除'
}

const playHistory = (item) => {
  stopCurrentPlayback()
  currentPlayingIndex.value = recordings.value.indexOf(item)
  playAudio(item.path)
}

const deleteHistory = (index) => {
  recordings.value.splice(index, 1)
  saveRecordingsToStorage()
  swipedIndex.value = -1
}

const onTouchStart = (index, event) => {
  const touch = event.touches[0]
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
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

const handleItemClick = (index, item) => {
  if (swipedIndex.value === index) {
    swipedIndex.value = -1
  } else {
    swipedIndex.value = -1
    playHistory(item)
  }
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

const clearAllRecordings = () => {
  recordings.value = []
  uni.removeStorageSync('recordings')
  statusText.value = '已清空所有录音'
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

.record-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60rpx;
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

.pineapple-icon {
  font-size: 56rpx;
  position: absolute;
  top: 20rpx;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.ripple {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 217, 61, 0.3);
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.6s ease;
}

.ripple.active {
  opacity: 1;
  transform: scale(1);
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

.btn-core {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10rpx);
}

.mic {
  position: relative;
  width: 60rpx;
  height: 90rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mic-head {
  width: 36rpx;
  height: 48rpx;
  background: #fff;
  border-radius: 18rpx 18rpx 8rpx 8rpx;
  position: relative;
}

.mic-head::before {
  content: '';
  position: absolute;
  top: 8rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 20rpx;
  height: 28rpx;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-radius: 10rpx;
}

.mic-body {
  width: 4rpx;
  height: 20rpx;
  background: #fff;
  margin-top: -2rpx;
}

.mic-base {
  width: 24rpx;
  height: 8rpx;
  background: #fff;
  border-radius: 0 0 12rpx 12rpx;
  margin-top: -2rpx;
}

.mic.pulse .mic-head {
  animation: micPulse 1s ease-in-out infinite;
}

.mic.pulse .mic-head::before {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.2) 100%);
}

@keyframes micPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
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

.history-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.history-play {
  font-size: 36rpx;
  color: rgba(255, 255, 255, 0.6);
}

.history-delete {
  font-size: 48rpx;
  color: rgba(255, 255, 255, 0.5);
  padding: 15rpx;
  line-height: 1;
}

.history-delete:active {
  color: rgba(255, 77, 79, 0.8);
}

.speed-control {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
  padding: 24rpx 30rpx;
  margin-bottom: 30rpx;
}

.speed-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  margin-bottom: 16rpx;
}

.speed-buttons {
  display: flex;
  justify-content: space-between;
  gap: 10rpx;
}

.speed-btn {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  transition: all 0.2s ease;
}

.speed-btn.active {
  background: rgba(255, 217, 61, 0.4);
  color: #fff;
  font-weight: 600;
}

.speed-btn:active {
  transform: scale(0.95);
}
</style>
