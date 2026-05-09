package com.audioprocessor;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 音频录制与频谱分析器
 * 使用 AudioRecord 获取 PCM 数据并进行 FFT 变换
 */
public class AudioProcessor {
    private static final String TAG = "AudioProcessor";

    private AudioRecord audioRecord;
    private int sampleRate;
    private int channelConfig;
    private int audioFormat;
    private int bufferSize;
    private int fftSize;

    private ExecutorService executor;
    private AtomicBoolean isRecording;
    private Handler mainHandler;

    // FFT 相关
    private FFT fft;
    private float[] realPart;
    private float[] imagPart;
    private float[] magnitudes;

    // 回调接口
    public interface AudioDataCallback {
        void onAudioData(float[] frequencies);
        void onError(String error);
    }

    private AudioDataCallback callback;

    public AudioProcessor() {
        this.sampleRate = 44100;
        this.channelConfig = AudioFormat.CHANNEL_IN_MONO;
        this.audioFormat = AudioFormat.ENCODING_PCM_16BIT;
        this.fftSize = 256;
        this.isRecording = new AtomicBoolean(false);
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    /**
     * 配置参数
     */
    public void setConfig(int sampleRate, int channel, int fftSize) {
        this.sampleRate = sampleRate;
        this.channelConfig = channel == 1 ? AudioFormat.CHANNEL_IN_MONO : AudioFormat.CHANNEL_IN_STEREO;
        this.fftSize = fftSize;

        // 计算缓冲区大小
        this.bufferSize = AudioRecord.getMinBufferSize(
                this.sampleRate,
                this.channelConfig,
                this.audioFormat
        ) * 2;

        // 初始化 FFT
        this.fft = new FFT(this.fftSize);
        this.realPart = new float[this.fftSize];
        this.imagPart = new float[this.fftSize];
        this.magnitudes = new float[this.fftSize / 2];

        Log.d(TAG, "配置完成: sampleRate=" + sampleRate + ", fftSize=" + fftSize + ", bufferSize=" + bufferSize);
    }

    /**
     * 设置数据回调
     */
    public void setCallback(AudioDataCallback callback) {
        this.callback = callback;
    }

    /**
     * 开始录音
     */
    public boolean start() {
        if (isRecording.get()) {
            Log.w(TAG, "已经在录音中");
            return true;
        }

        try {
            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    sampleRate,
                    channelConfig,
                    audioFormat,
                    bufferSize
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord 初始化失败");
                if (callback != null) {
                    callback.onError("AudioRecord 初始化失败");
                }
                return false;
            }

            executor = Executors.newSingleThreadExecutor();
            audioRecord.startRecording();
            isRecording.set(true);

            executor.execute(this::readAudioData);

            Log.d(TAG, "开始录音");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "启动录音失败: " + e.getMessage());
            if (callback != null) {
                callback.onError("启动录音失败: " + e.getMessage());
            }
            return false;
        }
    }

    /**
     * 停止录音
     */
    public void stop() {
        isRecording.set(false);

        if (executor != null) {
            executor.shutdown();
            executor = null;
        }

        if (audioRecord != null) {
            try {
                audioRecord.stop();
                audioRecord.release();
            } catch (Exception e) {
                Log.e(TAG, "停止录音失败: " + e.getMessage());
            }
            audioRecord = null;
        }

        Log.d(TAG, "停止录音");
    }

    /**
     * 读取音频数据并处理
     */
    private void readAudioData() {
        short[] buffer = new short[bufferSize / 2];

        while (isRecording.get()) {
            int readSize = audioRecord.read(buffer, 0, buffer.length);

            if (readSize > 0) {
                // 转换为 float 并进行 FFT
                for (int i = 0; i < fftSize && i < readSize; i++) {
                    realPart[i] = buffer[i] / 32768.0f;
                    imagPart[i] = 0;
                }

                // 执行 FFT
                fft.fft(realPart, imagPart);

                // 计算幅度
                for (int i = 0; i < fftSize / 2; i++) {
                    float real = realPart[i];
                    float imag = imagPart[i];
                    magnitudes[i] = (float) Math.sqrt(real * real + imag * imag);
                }

                // 归一化
                normalizeMagnitudes();

                // 回调结果
                final float[] result = Arrays.copyOf(magnitudes, magnitudes.length);
                mainHandler.post(() -> {
                    if (callback != null) {
                        callback.onAudioData(result);
                    }
                });
            }
        }
    }

    /**
     * 归一化幅度值到 0-1 范围
     */
    private void normalizeMagnitudes() {
        float max = 0;
        for (float m : magnitudes) {
            if (m > max) max = m;
        }

        if (max > 0) {
            for (int i = 0; i < magnitudes.length; i++) {
                magnitudes[i] = magnitudes[i] / max;
            }
        }
    }

    /**
     * 是否正在录音
     */
    public boolean isRecording() {
        return isRecording.get();
    }

    /**
     * 释放资源
     */
    public void release() {
        stop();
    }
}