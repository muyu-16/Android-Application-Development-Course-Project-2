package com.audioprocessor;

/**
 * 快速傅里叶变换 (FFT) 实现
 * Cooley-Tukey 算法
 */
public class FFT {

    private int n;
    private int m;
    private float[] cos;
    private float[] sin;

    public FFT(int n) {
        this.n = n;
        this.m = (int) (Math.log(n) / Math.log(2));

        // 计算旋转因子
        cos = new float[n / 2];
        sin = new float[n / 2];

        for (int i = 0; i < n / 2; i++) {
            cos[i] = (float) Math.cos(-2 * Math.PI * i / n);
            sin[i] = (float) Math.sin(-2 * Math.PI * i / n);
        }
    }

    /**
     * 执行 FFT 变换
     * @param real 实部数组
     * @param imag 虚部数组
     */
    public void fft(float[] real, float[] imag) {
        if (real.length != n || imag.length != n) {
            throw new IllegalArgumentException("数组长度必须为 " + n);
        }

        // 位反转排序
        int j = 0;
        for (int i = 0; i < n - 1; i++) {
            if (i < j) {
                float temp = real[i];
                real[i] = real[j];
                real[j] = temp;

                temp = imag[i];
                imag[i] = imag[j];
                imag[j] = temp;
            }

            int k = n / 2;
            while (k <= j) {
                j -= k;
                k /= 2;
            }
            j += k;
        }

        // 蝶形运算
        for (int size = 2; size <= n; size *= 2) {
            int halfsize = size / 2;
            int tablestep = n / size;

            for (int i = 0; i < n; i += size) {
                int k = 0;
                for (int jj = i; jj < i + halfsize; jj++) {
                    float treal = real[jj + halfsize] * cos[k] - imag[jj + halfsize] * sin[k];
                    float timag = real[jj + halfsize] * sin[k] + imag[jj + halfsize] * cos[k];

                    real[jj + halfsize] = real[jj] - treal;
                    imag[jj + halfsize] = imag[jj] - timag;

                    real[jj] = real[jj] + treal;
                    imag[jj] = imag[jj] + timag;

                    k += tablestep;
                }
            }
        }
    }

    /**
     * 获取 FFT 大小
     */
    public int getSize() {
        return n;
    }
}