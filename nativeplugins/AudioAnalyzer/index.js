'use strict';

const NATIVE_EVENT_NAME = 'onAudioAnalyzerData';
const MODULE_NAME = 'AudioAnalyzer';

let nativeModule = null;
let isListening = false;

// 获取原生模块
function getNativeModule() {
    if (!nativeModule) {
        try {
            nativeModule = uni.requireNativePlugin(MODULE_NAME);
            console.log('AudioAnalyzer 原生模块加载成功');
        } catch (e) {
            console.error('AudioAnalyzer 原生模块加载失败:', e);
            return null;
        }
    }
    return nativeModule;
}

// 音频分析器类
class AudioAnalyzer {
    constructor() {
        this.callback = null;
        this.isRecording = false;
    }

    // 设置数据回调
    setCallback(callback) {
        this.callback = callback;
    }

    // 开始录音分析
    start(options = {}) {
        const mod = getNativeModule();
        if (!mod) {
            console.error('原生模块未加载');
            return false;
        }

        const config = {
            sampleRate: options.sampleRate || 44100,
            channel: options.channel || 1,
            fftSize: options.fftSize || 256
        };

        try {
            // 订阅原生事件
            if (!isListening) {
                uni.subscribeNativeEvent(NATIVE_EVENT_NAME, (data) => {
                    if (this.callback && data && data.frequencies) {
                        this.callback(data.frequencies);
                    }
                });
                isListening = true;
            }

            // 调用原生方法
            mod.start(config);
            this.isRecording = true;
            console.log('AudioAnalyzer 开始录音分析, 配置:', config);
            return true;
        } catch (e) {
            console.error('启动录音分析失败:', e);
            return false;
        }
    }

    // 停止录音分析
    stop() {
        const mod = getNativeModule();
        if (!mod) {
            return false;
        }

        try {
            mod.stop();
            this.isRecording = false;
            console.log('AudioAnalyzer 停止录音分析');
            return true;
        } catch (e) {
            console.error('停止录音分析失败:', e);
            return false;
        }
    }

    // 检查是否正在录音
    isRecording() {
        return this.isRecording;
    }

    // 释放资源
    release() {
        const mod = getNativeModule();
        if (mod) {
            try {
                mod.release();
            } catch (e) {
                console.error('释放资源失败:', e);
            }
        }
        this.isRecording = false;
        this.callback = null;
    }
}

// 导出单例
const audioAnalyzer = new AudioAnalyzer();

module.exports = {
    AudioAnalyzer,
    audioAnalyzer,
    default: audioAnalyzer
};