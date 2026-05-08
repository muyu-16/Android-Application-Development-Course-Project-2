/**
 * time-stretch.js — 纯 JS 变速不变调（演示兼测试数据兼容性版本）
 * 
 * ═══════════════════════════════════════════════════════
 *  三层架构（从底到顶）：
 * 
 *  ┌─────────────────────────────────────────────────┐
 *  │  第 3 层：便捷包装（timeStretch / timeStretchAll）│
 *  │  ← 封装文件读写，适合在 index.vue 一行调用       │
 *  ├─────────────────────────────────────────────────┤
 *  │  第 2 层：文件 I/O（readFile / writeFile）        │
 *  │  ← 跨平台兼容：App(plus.io) / 小程序(FSManager)  │
 *  ├─────────────────────────────────────────────────┤
 *  │  第 1 层：纯算法（timeStretchBuffer）             │
 *  │  ← 零平台依赖，输入输出都是 ArrayBuffer          │
 *  │  ← 包含 WAV解析 + OLA变速 + WAV编码              │
 *  └─────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════
 * 
 * 原理：OLA (Overlap-Add) 时域拉伸
 *   1. 把音频切成重叠的小帧（~30ms）
 *   2. 改变帧与帧之间的间距来拉伸/压缩时间
 *   3. 用 Hann 窗口平滑拼接，避免拼接处的咔哒声
 * 
 * 特点：有初步效果，但仔细听瑕疵明显（课后可搜索 WSOLA 了解改进方案）
 * 
 * ⚠️ 录音格式要求：WAV
 *    recorder.start({ format: 'wav', sampleRate: 16000, numberOfChannels: 1 })
 * 
 * ═══════════════ API 速查 ═══════════════
 * 
 * 【推荐】一行搞定（封装了文件读写）：
 *   import { timeStretch } from '@/utils/time-stretch.js'
 *   const outputPath = await timeStretch(inputPath, 1.5)
 *   audio.src = outputPath; audio.play()
 * 
 * 【推荐】批量三档：
 *   import { timeStretchAll } from '@/utils/time-stretch.js'
 *   const paths = await timeStretchAll(inputPath)
 *   // paths = { '0.5': '...', '1.5': '...', '2': '...' }
 * 
 * 【高级】纯 Buffer（零平台依赖，你自己处理文件读写）：
 *   import { timeStretchBuffer } from '@/utils/time-stretch.js'
 *   const outputBuffer = timeStretchBuffer(inputArrayBuffer, 1.5)
 *   // outputBuffer 是 WAV 格式的 ArrayBuffer
 */
// ============================================================
//  第 1 层：纯算法（零平台依赖）
// ============================================================
// -------------------- WAV 解析 --------------------
/**
 * 解析 WAV 文件的 ArrayBuffer，提取 PCM 采样数据
 */
function parseWAV(buffer) {
  const view = new DataView(buffer)
  // 检查 RIFF 头
  const headerBytes = []
  for (let i = 0; i < Math.min(12, buffer.byteLength); i++) {
    headerBytes.push(view.getUint8(i))
  }
  const riff = String.fromCharCode(headerBytes[0], headerBytes[1], headerBytes[2], headerBytes[3])
  const headerHex = headerBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')
  const headerAscii = headerBytes.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('')
  console.log(`  文件头: [${headerHex}] "${headerAscii}" (${buffer.byteLength} bytes)`)
  
  if (riff !== 'RIFF') {
    if (headerBytes[0] === 0x23 && headerBytes[1] === 0x21 && headerBytes[2] === 0x41 && headerBytes[3] === 0x4D) {
      console.log(`  检测到 AMR-WB 格式，需要先转换为 WAV`)
      throw new Error(`检测到 AMR-WB 格式，请在 App 端使用 uni.getRecorderManager() 支持的格式，或使用 native.js 录音插件`)
    }
    // 常见格式识别
    let hint = '未知格式'
    if (headerAscii.startsWith('ftyp') || headerBytes[4] === 0x66) hint = '这是 M4A/AAC 文件，设备不支持 WAV 录音'
    if (headerBytes[0] === 0xFF && (headerBytes[1] & 0xE0) === 0xE0) hint = '这是 MP3 文件'
    if (headerBytes[0] === 0x00 && headerBytes[1] === 0x00) hint = '可能是 M4A/AAC (ftyp box)'
    throw new Error(`不是 WAV 文件。头部="${headerAscii}"，${hint}`)
  }
  const numChannels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const bitsPerSample = view.getUint16(34, true)
  // 找到 data 块
  let dataOffset = 44
  for (let i = 36; i < buffer.byteLength - 8; i++) {
    if (view.getUint8(i) === 0x64 && view.getUint8(i + 1) === 0x61 &&
        view.getUint8(i + 2) === 0x74 && view.getUint8(i + 3) === 0x61) {
      dataOffset = i + 8
      break
    }
  }
  // 提取 PCM 数据并转为 Float32（-1.0 ~ 1.0）
  const bytesPerSample = bitsPerSample / 8
  const numSamples = Math.floor((buffer.byteLength - dataOffset) / bytesPerSample / numChannels)
  const samples = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const offset = dataOffset + i * bytesPerSample * numChannels
    if (bitsPerSample === 16) {
      samples[i] = view.getInt16(offset, true) / 32768.0
    } else if (bitsPerSample === 8) {
      samples[i] = (view.getUint8(offset) - 128) / 128.0
    }
  }
  return { samples, sampleRate, numChannels, bitsPerSample }
}
// -------------------- WAV 编码 --------------------
/**
 * 将 Float32 采样数据编码为 WAV 格式的 ArrayBuffer
 */
function encodeWAV(samples, sampleRate) {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, clamped * 32767, true)
  }
  return buffer
}
function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
// -------------------- OLA 变速核心 --------------------
/**
 * OLA (Overlap-Add) 时域拉伸
 * 
 * 工作原理（以 2 倍速为例）：
 *   输入：|---帧1---|---帧2---|---帧3---|---帧4---|
 *          ↑ 每次跳 hopA 读取下一帧
 *   输出：|--帧1--|--帧2--|--帧3--|--帧4--|        ← 更短了！
 *          ↑ 每次跳 hopS 写入（hopS = hopA / speed）
 *   帧的内容不变（音调不变），但排列更紧密（时间更短 = 更快）
 */
function olaTimeStretch(input, sampleRate, speed) {
  const frameSize = Math.pow(2, Math.round(Math.log2(sampleRate * 0.03)))
  const hopA = Math.floor(frameSize / 4)
  const hopS = Math.round(hopA / speed)
  // Hann 窗函数
  const window = new Float32Array(frameSize)
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frameSize - 1)))
  }
  const numFrames = Math.floor((input.length - frameSize) / hopA) + 1
  const outputLength = (numFrames - 1) * hopS + frameSize
  const output = new Float32Array(outputLength)
  const windowSum = new Float32Array(outputLength)
  for (let frame = 0; frame < numFrames; frame++) {
    const readPos = frame * hopA
    const writePos = frame * hopS
    for (let i = 0; i < frameSize; i++) {
      if (readPos + i < input.length && writePos + i < outputLength) {
        output[writePos + i] += input[readPos + i] * window[i]
        windowSum[writePos + i] += window[i]
      }
    }
  }
  for (let i = 0; i < outputLength; i++) {
    if (windowSum[i] > 0.001) {
      output[i] /= windowSum[i]
    }
  }
  return output
}
// -------------------- 第 1 层对外接口 --------------------
/**
 * 【纯算法】变速不变调 — ArrayBuffer 进，ArrayBuffer 出
 * 
 * 零平台依赖！在任何 JS 环境（App / 小程序 / 浏览器 / Node.js）都能用。
 * 学生如果自己处理文件读写，用这个函数就够了。
 * 
 * @param {ArrayBuffer} wavBuffer - 输入的 WAV 文件 ArrayBuffer
 * @param {number} speed          - 速度倍率 (0.5 = 半速, 2.0 = 两倍速)
 * @returns {ArrayBuffer}         - 变速后的 WAV 文件 ArrayBuffer
 * 
 * @example
 *   // 你自己读文件得到 ArrayBuffer，然后：
 *   const outputBuffer = timeStretchBuffer(inputBuffer, 1.5)
 *   // 你自己把 outputBuffer 写入文件
 */
export function timeStretchBuffer(wavBuffer, speed) {
  const { samples, sampleRate } = parseWAV(wavBuffer)
  const stretched = olaTimeStretch(samples, sampleRate, speed)
  return encodeWAV(stretched, sampleRate)
}
// ============================================================
//  第 2 层：跨平台文件 I/O
//  兼容 App (plus.io) 和 小程序 (FileSystemManager)
// ============================================================
/**
 * 读取文件为 ArrayBuffer（跨平台）
 */
function readFileAsArrayBuffer(filePath) {
  // #ifdef APP-PLUS
  // App 逻辑层没有 XMLHttpRequest，只能用 plus.io.FileReader
  // 关键：用 convertLocalFileSystemURL 转换 _doc/ 逻辑路径
  return new Promise((resolve, reject) => {
    let resolved = false
    
    // 10秒超时保护（防止 FileReader 永久挂起）
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error(`读取文件超时(10s): ${filePath}`))
      }
    }, 10000)
    
    // _doc/xxx 转为 file:///... 绝对路径
    let absPath = filePath
    if (plus.io.convertLocalFileSystemURL) {
      absPath = plus.io.convertLocalFileSystemURL(filePath)
      console.log(`  路径转换: ${filePath} → ${absPath}`)
    }
    
    plus.io.resolveLocalFileSystemURL(absPath, (entry) => {
      entry.file((file) => {
        const reader = new plus.io.FileReader()
        reader.onloadend = (e) => {
          if (resolved) return
          resolved = true
          clearTimeout(timer)
          
          if (!e.target.result) {
            reject(new Error('读取文件内容为空'))
            return
          }
          
          // readAsDataURL 返回 "data:audio/wav;base64,xxxxx"
          // 需要提取 base64 部分并转为 ArrayBuffer
          const dataURL = e.target.result
          const base64Idx = dataURL.indexOf(',')
          if (base64Idx === -1) {
            reject(new Error('DataURL 格式异常'))
            return
          }
          const base64 = dataURL.substring(base64Idx + 1)
          const binaryStr = atob(base64)
          const buffer = new ArrayBuffer(binaryStr.length)
          const view = new Uint8Array(buffer)
          for (let i = 0; i < binaryStr.length; i++) {
            view[i] = binaryStr.charCodeAt(i)
          }
          console.log(`  读取成功: ${buffer.byteLength} bytes`)
          resolve(buffer)
        }
        reader.onerror = (e) => {
          if (resolved) return
          resolved = true
          clearTimeout(timer)
          reject(new Error(`FileReader 错误: ${JSON.stringify(e)}`))
        }
        // 用 readAsDataURL（比 readAsArrayBuffer 更稳定）
        reader.readAsDataURL(file)
      }, (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          reject(new Error(`获取文件对象失败: ${JSON.stringify(err)}`))
        }
      })
    }, (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        reject(new Error(`解析路径失败[${absPath}]: ${JSON.stringify(err)}`))
      }
    })
  })
  // #endif
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    const fs = uni.getFileSystemManager()
    fs.readFile({
      filePath,
      success: (res) => resolve(res.data),
      fail: (err) => reject(new Error(`读取文件失败: ${err.errMsg}`))
    })
  })
  // #endif
}
/**
 * 将 ArrayBuffer 写入文件（跨平台）
 */
function writeFileFromBuffer(filePath, buffer) {
  // #ifdef APP-PLUS
  // App 端：用 Blob 写入文件
  return new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL('_doc/', (dirEntry) => {
      const fileName = filePath.split('/').pop()
      dirEntry.getFile(fileName, { create: true }, (fileEntry) => {
        fileEntry.createWriter((writer) => {
          writer.onwrite = () => {
            const localURL = fileEntry.toLocalURL()
            console.log(`  文件写入成功: ${localURL}`)
            resolve(localURL)
          }
          writer.onerror = (e) => reject(new Error(`写入失败: ${e.message}`))
          writer.seek(0)
          writer.write(new Blob([buffer], { type: 'audio/wav' }))
        }, (err) => reject(new Error(`创建写入器失败: ${err.message}`)))
      }, (err) => reject(new Error(`获取文件入口失败: ${err.message}`)))
    }, (err) => reject(new Error(`解析目录失败: ${err.message}`)))
  })
  // #endif
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    const fs = uni.getFileSystemManager()
    fs.writeFile({
      filePath,
      data: buffer,
      success: () => resolve(),
      fail: (err) => reject(new Error(`写入文件失败: ${err.errMsg}`))
    })
  })
  // #endif
}
/**
 * 获取跨平台临时文件路径
 */
function getTempPath(speed) {
  const ts = Date.now()
  // #ifdef APP-PLUS
  return `_doc/stretch_${speed}x_${ts}.wav`
  // #endif
  // #ifdef MP-WEIXIN
  return `${uni.env.USER_DATA_PATH}/stretch_${speed}x_${ts}.wav`
  // #endif
}
// ============================================================
//  第 3 层：便捷包装（给 index.vue 直接调用）
// ============================================================
/**
 * 【便捷】变速不变调 — 文件路径进，文件路径出
 * 
 * 封装了文件读写，在 index.vue 中一行搞定。
 * 
 * @param {string} filePath - 录音 WAV 文件路径
 * @param {number} speed    - 速度倍率 (0.5 / 1.5 / 2.0)
 * @returns {Promise<string>} - 处理后的 WAV 文件路径
 * 
 * @example
 *   const path = await timeStretch(res.tempFilePath, 1.5)
 *   audio.src = path
 *   audio.play()
 */
/**
 * 检测音频文件格式
 */
function detectAudioFormat(headerBytes) {
  // 检查 WAV (RIFF)
  if (headerBytes[0] === 0x52 && headerBytes[1] === 0x49 && 
      headerBytes[2] === 0x46 && headerBytes[3] === 0x46) {
    return 'wav';
  }
  
  // 检查 MP3 (ID3v1/ID3v2 或 MPEG header)
  if ((headerBytes[0] === 0xFF && (headerBytes[1] & 0xE0) === 0xE0) ||
      (headerBytes[0] === 0x49 && headerBytes[1] === 0x44 && headerBytes[2] === 0x33)) {
    return 'mp3';
  }
  
  // 检查 AMR-WB
  if (headerBytes[0] === 0x23 && headerBytes[1] === 0x21 && 
      headerBytes[2] === 0x41 && headerBytes[3] === 0x4D) {
    return 'amr-wb';
  }
  
  // 检查 AAC/M4A (ftyp box)
  if (headerBytes[4] === 0x66 && headerBytes[5] === 0x74 && 
      headerBytes[6] === 0x79 && headerBytes[7] === 0x70) {
    return 'aac';
  }
  
  return 'unknown';
}

export async function timeStretch(filePath, speed) {
  console.log(`[time-stretch] 开始 ${speed}x 处理...`)
  const t0 = Date.now()
  
  try {
    // 读文件 → 纯算法处理 → 写文件
    const inputBuffer = await readFileAsArrayBuffer(filePath)
    console.log(`  读取完成: ${(inputBuffer.byteLength / 1024).toFixed(1)} KB`)
    
    // 检查文件格式
    const view = new DataView(inputBuffer)
    const headerBytes = []
    for (let i = 0; i < Math.min(12, inputBuffer.byteLength); i++) {
      headerBytes.push(view.getUint8(i))
    }
    
    const format = detectAudioFormat(headerBytes)
    console.log(`  检测到格式: ${format}`)
    
    // 如果不是 WAV 格式，无法进行变速处理
    if (format !== 'wav') {
      console.error(`  ${format.toUpperCase()} 格式暂不支持变速处理`)
      uni.showToast({
        title: `${format.toUpperCase()} 格式无法变速`,
        icon: 'none'
      })
      return filePath // 返回原路径，让用户可以正常播放
    }
    
    const t1 = Date.now()
    const outputBuffer = timeStretchBuffer(inputBuffer, speed)
    const t2 = Date.now()
    console.log(`  OLA 处理: ${t2 - t1}ms`)
    
    const outputPath = getTempPath(speed)
    await writeFileFromBuffer(outputPath, outputBuffer)
    console.log(`[time-stretch] ${speed}x 完成! 总耗时: ${Date.now() - t0}ms`)
    return outputPath
  } catch (error) {
    console.error('变速处理出错:', error)
    uni.showToast({
      title: '变速处理失败',
      icon: 'none'
    })
    return filePath // 返回原路径
  }
}
/**
 * 【便捷】一次性生成 0.5x / 1.5x / 2.0x 三档
 * 
 * @param {string} filePath - 录音 WAV 文件路径
 * @returns {Promise<Object>} - { '0.5': path, '1.5': path, '2': path }
 */
export async function timeStretchAll(filePath) {
  const speeds = [0.5, 1.5, 2.0]
  const result = {}
  uni.showLoading({ title: '变速处理中...', mask: true })
  for (const speed of speeds) {
    try {
      result[speed] = await timeStretch(filePath, speed)
    } catch (e) {
      console.error(`${speed}x 处理失败:`, e)
      result[speed] = null
    }
  }
  uni.hideLoading()
  return result
}