package com.audioprocessor;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.common.UniModule;

/**
 * Uni-app 原生模块 - 音频频谱分析器
 * 使用 AudioRecord 获取 PCM 数据并进行 FFT 变换
 */
public class AudioAnalyzerModule extends UniModule {

    private static final String TAG = "AudioAnalyzerModule";
    private AudioProcessor audioProcessor;

    public AudioAnalyzerModule() {
        audioProcessor = new AudioProcessor();
        Log.d(TAG, "AudioAnalyzerModule 初始化");
    }

    /**
     * 开始录音并分析
     * @param options 配置参数 {sampleRate: 44100, channel: 1, fftSize: 256}
     */
    @UniJSMethod
    public void start(JSONObject options) {
        try {
            int sampleRate = options.has("sampleRate") ? options.getInt("sampleRate") : 44100;
            int channel = options.has("channel") ? options.getInt("channel") : 1;
            int fftSize = options.has("fftSize") ? options.getInt("fftSize") : 256;

            Log.d(TAG, "开始配置: sampleRate=" + sampleRate + ", channel=" + channel + ", fftSize=" + fftSize);

            audioProcessor.setConfig(sampleRate, channel, fftSize);

            audioProcessor.setCallback(new AudioProcessor.AudioDataCallback() {
                @Override
                public void onAudioData(float[] frequencies) {
                    sendAudioDataEvent(frequencies);
                }

                @Override
                public void onError(String error) {
                    Log.e(TAG, "错误: " + error);
                }
            });

            boolean success = audioProcessor.start();
            Log.d(TAG, "启动结果: " + success);

        } catch (Exception e) {
            Log.e(TAG, "启动失败: " + e.getMessage());
        }
    }

    /**
     * 停止录音分析
     */
    @UniJSMethod
    public void stop() {
        audioProcessor.stop();
        Log.d(TAG, "停止录音分析");
    }

    /**
     * 是否正在录音
     */
    @UniJSMethod
    public void isRecording(android.os.Message message) {
        message.arg1 = audioProcessor.isRecording() ? 1 : 0;
    }

    /**
     * 发送音频数据事件到 JS
     */
    private void sendAudioDataEvent(float[] frequencies) {
        try {
            JSONArray array = new JSONArray();
            for (float f : frequencies) {
                array.put(f);
            }

            JSONObject data = new JSONObject();
            data.put("frequencies", array);
            data.put("timestamp", System.currentTimeMillis());

            // 发送事件
            sendEvent("onAudioAnalyzerData", data);

        } catch (Exception e) {
            Log.e(TAG, "发送事件失败: " + e.getMessage());
        }
    }

    /**
     * 释放资源
     */
    @UniJSMethod
    public void release() {
        audioProcessor.release();
        Log.d(TAG, "释放资源");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        release();
    }
}