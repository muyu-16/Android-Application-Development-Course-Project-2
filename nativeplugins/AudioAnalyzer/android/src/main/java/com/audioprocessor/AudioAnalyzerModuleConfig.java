package com.audioprocessor;

import io.dcloud.feature.uniapp.common.UniModule;

/**
 * 模块描述文件
 * 用于注册 AudioAnalyzerModule
 */
public class AudioAnalyzerModuleConfig {

    public static Class<? extends UniModule> getModuleClass() {
        return AudioAnalyzerModule.class;
    }

    public static String getModuleName() {
        return "AudioAnalyzer";
    }
}