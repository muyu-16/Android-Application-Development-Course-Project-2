if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const _imports_0 = "/static/菠萝录音键.png";
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$1 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const isRecording = vue.ref(false);
      const statusText = vue.ref("");
      const recordDuration = vue.ref(0);
      const lastRecordPath = vue.ref("");
      const lastRecordDuration = vue.ref(0);
      const recordings = vue.ref([]);
      const isPlaying = vue.ref(false);
      const currentPlayingIndex = vue.ref(-1);
      const playbackRate = vue.ref(1);
      const audioContextObj = vue.ref(null);
      const swipedIndex = vue.ref(-1);
      const touchStartX = vue.ref(0);
      const touchStartY = vue.ref(0);
      let recorderManager = null;
      let audioContext = null;
      let touchTimer = null;
      let durationTimer = null;
      const statusClass = vue.computed(() => {
        if (statusText.value.includes("录音中") || statusText.value.includes("播放中")) {
          return "status-active";
        }
        if (statusText.value.includes("完成")) {
          return "status-success";
        }
        if (statusText.value.includes("失败") || statusText.value.includes("错误")) {
          return "status-error";
        }
        return "";
      });
      vue.onMounted(() => {
        recorderManager = uni.getRecorderManager();
        recorderManager.onStart(() => {
          isRecording.value = true;
          statusText.value = "正在录音...";
          startDurationTimer();
        });
        recorderManager.onStop((res) => {
          isRecording.value = false;
          stopDurationTimer();
          lastRecordPath.value = res.tempFilePath;
          formatAppLog("log", "at pages/index/index.vue:167", "=================================");
          formatAppLog("log", "at pages/index/index.vue:168", "录音停止事件触发");
          formatAppLog("log", "at pages/index/index.vue:169", "res 对象完整内容:", JSON.stringify(res));
          formatAppLog("log", "at pages/index/index.vue:170", "res.tempFilePath:", res.tempFilePath);
          formatAppLog("log", "at pages/index/index.vue:171", "res.duration:", res.duration);
          formatAppLog("log", "at pages/index/index.vue:172", "recordDuration.value:", recordDuration.value);
          formatAppLog("log", "at pages/index/index.vue:173", "=================================");
          const duration = res.duration || recordDuration.value || 0;
          lastRecordDuration.value = duration;
          recordDuration.value = duration;
          statusText.value = "录音完成，自动播放中...";
          playAudio(res.tempFilePath);
        });
        recorderManager.onError((err) => {
          isRecording.value = false;
          stopDurationTimer();
          statusText.value = "录音失败: " + err.errMsg;
        });
        loadRecordings();
      });
      vue.onUnmounted(() => {
        stopCurrentPlayback();
        if (touchTimer) {
          clearTimeout(touchTimer);
        }
        if (durationTimer) {
          clearInterval(durationTimer);
        }
      });
      const startDurationTimer = () => {
        recordDuration.value = 0;
        durationTimer = setInterval(() => {
          recordDuration.value += 100;
          if (recordDuration.value >= 6e4) {
            stopRecording();
          }
        }, 100);
      };
      const stopDurationTimer = () => {
        if (durationTimer) {
          clearInterval(durationTimer);
          durationTimer = null;
        }
      };
      const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1e3);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
      };
      const formatRecordTime = (timestamp) => {
        if (!timestamp)
          return "";
        const date = new Date(timestamp);
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${month}/${day} ${hours}:${minutes}`;
      };
      const handleTouchStart = (e) => {
        e.preventDefault();
        touchTimer = setTimeout(() => {
          startRecording();
        }, 100);
      };
      const handleTouchEnd = (e) => {
        e.preventDefault();
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
        stopRecording();
      };
      const startRecording = () => {
        if (isRecording.value)
          return;
        statusText.value = "准备录音...";
        stopCurrentPlayback();
        recorderManager.start({
          format: "mp3",
          duration: 6e4,
          sampleRate: 48e3,
          bitRate: 128e3,
          numberOfChannels: 2,
          encodeBitRate: 128e3
        });
      };
      const stopRecording = () => {
        if (isRecording.value) {
          recorderManager.stop();
        }
      };
      const playAudio = (filePath) => {
        if (filePath.startsWith("file://") || filePath.startsWith("wxfile://") || filePath.includes("tmp://") || filePath.includes("temp://") || !filePath.startsWith("http")) {
          playWithNativeAudio(filePath);
          return;
        }
        if (typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined") {
          const AudioContextClass = AudioContext || webkitAudioContext;
          const audioContext2 = new AudioContextClass();
          uni.request({
            url: filePath,
            responseType: "arraybuffer",
            success: (res) => {
              audioContext2.decodeAudioData(res.data, (buffer) => {
                const source = audioContext2.createBufferSource();
                source.buffer = buffer;
                const pitchShifter = audioContext2.createScriptProcessor(4096, 1, 1);
                const currentPlaybackRate = playbackRate.value;
                let position = 0;
                const bufferSize = 4096;
                pitchShifter.onaudioprocess = (event) => {
                  const outputData = event.outputBuffer.getChannelData(0);
                  for (let i = 0; i < bufferSize; i++) {
                    position += currentPlaybackRate;
                    if (position >= buffer.length) {
                      position = buffer.length - 1;
                      try {
                        source.stop();
                      } catch (e) {
                      }
                      isPlaying.value = false;
                      currentPlayingIndex.value = -1;
                      statusText.value = "播放完成 ✓";
                      return;
                    }
                    const index = Math.floor(position);
                    const fraction = position - index;
                    if (index < buffer.length - 1) {
                      outputData[i] = buffer.getChannelData(0)[index] * (1 - fraction) + buffer.getChannelData(0)[index + 1] * fraction;
                    } else {
                      outputData[i] = 0;
                    }
                  }
                };
                source.connect(pitchShifter);
                pitchShifter.connect(audioContext2.destination);
                source.start();
                isPlaying.value = true;
                statusText.value = "播放中...";
                audioContextObj.value = {
                  context: audioContext2,
                  source,
                  pitchShifter
                };
              }, (err) => {
                formatAppLog("error", "at pages/index/index.vue:339", "解码音频失败:", err);
                playWithNativeAudio(filePath);
              });
            },
            fail: (err) => {
              formatAppLog("error", "at pages/index/index.vue:344", "加载音频失败:", err);
              playWithNativeAudio(filePath);
            }
          });
        } else {
          playWithNativeAudio(filePath);
        }
      };
      const playWithNativeAudio = (filePath) => {
        if (audioContext) {
          audioContext.destroy();
        }
        audioContext = uni.createInnerAudioContext();
        audioContext.src = filePath;
        audioContext.playbackRate = playbackRate.value;
        audioContext.onPlay(() => {
          isPlaying.value = true;
          statusText.value = "播放中...";
        });
        audioContext.onEnded(() => {
          isPlaying.value = false;
          currentPlayingIndex.value = -1;
          statusText.value = "播放完成 ✓";
        });
        audioContext.onError((err) => {
          isPlaying.value = false;
          currentPlayingIndex.value = -1;
          statusText.value = "播放失败: " + err.errMsg;
          formatAppLog("error", "at pages/index/index.vue:376", "播放失败:", err);
        });
        audioContext.play();
      };
      const setSpeed = (rate) => {
        playbackRate.value = rate;
        if (audioContext) {
          audioContext.playbackRate = rate;
        }
        if (audioContextObj.value) {
          if (isPlaying.value && lastRecordPath.value) {
            stopCurrentPlayback();
            playAudio(lastRecordPath.value);
          } else if (isPlaying.value && currentPlayingIndex.value >= 0 && recordings.value[currentPlayingIndex.value]) {
            stopCurrentPlayback();
            playAudio(recordings.value[currentPlayingIndex.value].path);
          }
        }
      };
      const stopCurrentPlayback = () => {
        if (audioContext) {
          audioContext.stop();
          audioContext.destroy();
          audioContext = null;
        }
        if (audioContextObj.value) {
          if (audioContextObj.value.source) {
            try {
              audioContextObj.value.source.stop();
            } catch (e) {
              formatAppLog("log", "at pages/index/index.vue:410", "音频已停止:", e);
            }
          }
          if (audioContextObj.value.pitchShifter) {
            audioContextObj.value.pitchShifter.disconnect();
          }
          if (audioContextObj.value.context) {
            audioContextObj.value.context.close();
          }
          audioContextObj.value = null;
        }
        isPlaying.value = false;
        currentPlayingIndex.value = -1;
      };
      const replayLast = () => {
        if (lastRecordPath.value) {
          stopCurrentPlayback();
          playAudio(lastRecordPath.value);
        }
      };
      const saveRecording = () => {
        if (!lastRecordPath.value)
          return;
        const timestamp = Date.now();
        const fileName = `recording_${timestamp}.mp3`;
        const isApp = typeof plus !== "undefined";
        const isWx = typeof wx !== "undefined" && wx.env !== "undefined";
        const isH5 = typeof window !== "undefined" && !isApp && !isWx;
        if (isApp) {
          plus.io.resolveLocalFileSystemURL(lastRecordPath.value, (tempEntry) => {
            plus.io.resolveLocalFileSystemURL("_doc/", (docEntry) => {
              tempEntry.copyTo(docEntry, fileName, (res) => {
                doSaveSuccess(res.fullPath);
              }, (err) => {
                formatAppLog("error", "at pages/index/index.vue:448", "复制文件失败，尝试直接保存:", err);
                doSaveWithNativeAPI(lastRecordPath.value, fileName);
              });
            }, (err) => {
              formatAppLog("error", "at pages/index/index.vue:452", "访问文档目录失败:", err);
              doSaveWithNativeAPI(lastRecordPath.value, fileName);
            });
          }, (err) => {
            formatAppLog("error", "at pages/index/index.vue:456", "访问临时文件失败:", err);
            doSaveWithNativeAPI(lastRecordPath.value, fileName);
          });
        } else if (isWx) {
          const savedPath = `${wx.env.USER_DATA_PATH}/${fileName}`;
          uni.saveFile({
            tempFilePath: lastRecordPath.value,
            filePath: savedPath,
            success: (res) => {
              doSaveSuccess(res.savedFilePath);
            },
            fail: (err) => {
              formatAppLog("error", "at pages/index/index.vue:468", "保存录音失败:", err);
              statusText.value = "保存失败，请重试";
            }
          });
        } else if (isH5) {
          doSaveForH5(lastRecordPath.value, fileName);
        } else {
          doSaveWithNativeAPI(lastRecordPath.value, fileName);
        }
      };
      const doSaveSuccess = (savedPath) => {
        formatAppLog("log", "at pages/index/index.vue:480", "=================================");
        formatAppLog("log", "at pages/index/index.vue:481", "doSaveSuccess 被调用");
        formatAppLog("log", "at pages/index/index.vue:482", "lastRecordDuration.value:", lastRecordDuration.value);
        formatAppLog("log", "at pages/index/index.vue:483", "typeof lastRecordDuration.value:", typeof lastRecordDuration.value);
        formatAppLog("log", "at pages/index/index.vue:484", "recordDuration.value:", recordDuration.value);
        formatAppLog("log", "at pages/index/index.vue:485", "=================================");
        const duration = lastRecordDuration.value || recordDuration.value || 0;
        formatAppLog("log", "at pages/index/index.vue:488", "计算后的 duration:", duration);
        const newRecording = {
          path: savedPath,
          duration: formatTime(duration),
          timestamp: Date.now()
        };
        formatAppLog("log", "at pages/index/index.vue:496", "=================================");
        formatAppLog("log", "at pages/index/index.vue:497", "录音记录存盘成功！");
        formatAppLog("log", "at pages/index/index.vue:498", "姓名：梁栩浩");
        formatAppLog("log", "at pages/index/index.vue:499", "操作前录音列表长度:", recordings.value.length);
        recordings.value.unshift(newRecording);
        formatAppLog("log", "at pages/index/index.vue:501", "操作后录音列表长度:", recordings.value.length);
        formatAppLog("log", "at pages/index/index.vue:502", "=================================");
        saveRecordingsToStorage();
        lastRecordPath.value = "";
        lastRecordDuration.value = 0;
        recordDuration.value = 0;
        statusText.value = "已保存到录音记录 ✓";
      };
      const doSaveWithNativeAPI = (tempPath, fileName) => {
        uni.saveFile({
          tempFilePath: tempPath,
          filePath: fileName,
          success: (res) => {
            doSaveSuccess(res.savedFilePath);
          },
          fail: (err) => {
            formatAppLog("error", "at pages/index/index.vue:519", "Native API保存失败:", err);
            statusText.value = "保存失败，请重试";
          }
        });
      };
      const doSaveForH5 = (filePath, fileName) => {
        const link = document.createElement("a");
        link.href = filePath;
        link.download = fileName;
        link.click();
        const newRecording = {
          path: filePath,
          duration: formatTime(lastRecordDuration.value),
          timestamp: Date.now()
        };
        recordings.value.unshift(newRecording);
        saveRecordingsToStorage();
        lastRecordPath.value = "";
        lastRecordDuration.value = 0;
        recordDuration.value = 0;
        statusText.value = "已保存到录音记录 ✓";
      };
      const deleteLast = () => {
        lastRecordPath.value = "";
        lastRecordDuration.value = 0;
        recordDuration.value = 0;
        statusText.value = "已删除";
      };
      const playHistory = (item) => {
        stopCurrentPlayback();
        currentPlayingIndex.value = recordings.value.indexOf(item);
        playAudio(item.path);
      };
      const deleteHistory = (index) => {
        recordings.value.splice(index, 1);
        saveRecordingsToStorage();
        swipedIndex.value = -1;
      };
      const onTouchStart = (index, event) => {
        const touch = event.touches[0];
        touchStartX.value = touch.clientX;
        touchStartY.value = touch.clientY;
      };
      const onTouchMove = (index, event) => {
        const touch = event.touches[0];
        const diffX = touchStartX.value - touch.clientX;
        if (diffX > 60) {
          swipedIndex.value = index;
        } else if (diffX < -60) {
          swipedIndex.value = -1;
        }
      };
      const onTouchEnd = (index) => {
        if (swipedIndex.value === index) {
          return;
        }
        swipedIndex.value = -1;
      };
      const handleItemClick = (index, item) => {
        if (swipedIndex.value === index) {
          swipedIndex.value = -1;
        } else {
          swipedIndex.value = -1;
          playHistory(item);
        }
      };
      const loadRecordings = async () => {
        try {
          const saved = uni.getStorageSync("recordings");
          if (saved) {
            const loadedRecordings = JSON.parse(saved);
            const validRecordings = [];
            for (const item of loadedRecordings) {
              try {
                const fileInfo = await new Promise((resolve, reject) => {
                  uni.getFileInfo({
                    filePath: item.path,
                    success: resolve,
                    fail: reject
                  });
                });
                validRecordings.push(item);
              } catch (e) {
                formatAppLog("log", "at pages/index/index.vue:615", "录音文件已失效:", item.path);
              }
            }
            recordings.value = validRecordings;
            if (validRecordings.length !== loadedRecordings.length) {
              saveRecordingsToStorage();
            }
          }
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:625", "加载录音记录失败", e);
        }
      };
      const saveRecordingsToStorage = () => {
        try {
          uni.setStorageSync("recordings", JSON.stringify(recordings.value));
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:633", "保存录音记录失败", e);
        }
      };
      const clearAllRecordings = () => {
        recordings.value = [];
        uni.removeStorageSync("recordings");
        statusText.value = "已清空所有录音";
      };
      const __returned__ = { isRecording, statusText, recordDuration, lastRecordPath, lastRecordDuration, recordings, isPlaying, currentPlayingIndex, playbackRate, audioContextObj, swipedIndex, touchStartX, touchStartY, get recorderManager() {
        return recorderManager;
      }, set recorderManager(v) {
        recorderManager = v;
      }, get audioContext() {
        return audioContext;
      }, set audioContext(v) {
        audioContext = v;
      }, get touchTimer() {
        return touchTimer;
      }, set touchTimer(v) {
        touchTimer = v;
      }, get durationTimer() {
        return durationTimer;
      }, set durationTimer(v) {
        durationTimer = v;
      }, statusClass, startDurationTimer, stopDurationTimer, formatTime, formatRecordTime, handleTouchStart, handleTouchEnd, startRecording, stopRecording, playAudio, playWithNativeAudio, setSpeed, stopCurrentPlayback, replayLast, saveRecording, doSaveSuccess, doSaveWithNativeAPI, doSaveForH5, deleteLast, playHistory, deleteHistory, onTouchStart, onTouchMove, onTouchEnd, handleItemClick, loadRecordings, saveRecordingsToStorage, clearAllRecordings, ref: vue.ref, computed: vue.computed, onMounted: vue.onMounted, onUnmounted: vue.onUnmounted };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("view", { class: "pineapple-decoration left" }, "🍍"),
        vue.createElementVNode("view", { class: "title-area" }, [
          vue.createElementVNode("text", { class: "title" }, "菠萝录音"),
          vue.createElementVNode("text", { class: "subtitle" }, "甜蜜声音 🍍")
        ]),
        vue.createElementVNode("view", { class: "pineapple-decoration right" }, "🍍")
      ]),
      vue.createElementVNode("view", { class: "record-section" }, [
        $setup.isRecording ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "timer"
        }, [
          vue.createElementVNode(
            "text",
            { class: "timer-num" },
            vue.toDisplayString($setup.formatTime($setup.recordDuration)),
            1
            /* TEXT */
          )
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("view", { class: "btn-wrapper" }, [
          vue.createElementVNode("view", { class: "leaf left-leaf" }),
          vue.createElementVNode("view", { class: "leaf right-leaf" }),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["ripple", { "active": $setup.isRecording }])
            },
            null,
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["record-btn", { "recording": $setup.isRecording }]),
              onTouchstart: $setup.handleTouchStart,
              onTouchend: $setup.handleTouchEnd,
              onTouchcancel: $setup.handleTouchEnd
            },
            [
              vue.createElementVNode("image", {
                class: "pineapple-bg",
                src: _imports_0,
                mode: "aspectFit"
              })
            ],
            34
            /* CLASS, NEED_HYDRATION */
          )
        ]),
        vue.createElementVNode(
          "text",
          { class: "hint" },
          vue.toDisplayString($setup.isRecording ? "松开结束" : "按住说话"),
          1
          /* TEXT */
        )
      ]),
      $setup.statusText ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "status"
      }, [
        vue.createElementVNode(
          "text",
          { class: "status-text" },
          vue.toDisplayString($setup.statusText),
          1
          /* TEXT */
        )
      ])) : vue.createCommentVNode("v-if", true),
      $setup.isPlaying ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "speed-control"
      }, [
        vue.createElementVNode("view", { class: "speed-label" }, "播放速度"),
        vue.createElementVNode("view", { class: "speed-buttons" }, [
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["speed-btn", { active: $setup.playbackRate === 0.5 }]),
              onClick: _cache[0] || (_cache[0] = ($event) => $setup.setSpeed(0.5))
            },
            "0.5x",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["speed-btn", { active: $setup.playbackRate === 0.75 }]),
              onClick: _cache[1] || (_cache[1] = ($event) => $setup.setSpeed(0.75))
            },
            "0.75x",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["speed-btn", { active: $setup.playbackRate === 1 }]),
              onClick: _cache[2] || (_cache[2] = ($event) => $setup.setSpeed(1))
            },
            "1x",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["speed-btn", { active: $setup.playbackRate === 1.25 }]),
              onClick: _cache[3] || (_cache[3] = ($event) => $setup.setSpeed(1.25))
            },
            "1.25x",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["speed-btn", { active: $setup.playbackRate === 1.5 }]),
              onClick: _cache[4] || (_cache[4] = ($event) => $setup.setSpeed(1.5))
            },
            "1.5x",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["speed-btn", { active: $setup.playbackRate === 2 }]),
              onClick: _cache[5] || (_cache[5] = ($event) => $setup.setSpeed(2))
            },
            "2x",
            2
            /* CLASS */
          )
        ])
      ])) : vue.createCommentVNode("v-if", true),
      $setup.lastRecordPath && !$setup.isRecording ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "actions"
      }, [
        vue.createElementVNode("view", {
          class: "action-btn",
          onClick: $setup.replayLast
        }, [
          vue.createElementVNode("text", { class: "action-text" }, "重播")
        ]),
        vue.createElementVNode("view", {
          class: "action-btn primary",
          onClick: $setup.saveRecording
        }, [
          vue.createElementVNode("text", { class: "action-text" }, "保存")
        ])
      ])) : vue.createCommentVNode("v-if", true),
      $setup.recordings.length > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 3,
        class: "history"
      }, [
        vue.createElementVNode("view", { class: "history-title" }, "录音记录"),
        vue.createElementVNode("scroll-view", {
          class: "history-list",
          "scroll-y": ""
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($setup.recordings, (item, index) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: index,
                class: "history-item-container"
              }, [
                vue.createElementVNode("view", {
                  class: "history-delete-area",
                  onClick: ($event) => $setup.deleteHistory(index)
                }, [
                  vue.createElementVNode("text", { class: "delete-text" }, "删除")
                ], 8, ["onClick"]),
                vue.createElementVNode("view", {
                  class: vue.normalizeClass(["history-item", { "swiped": $setup.swipedIndex === index }]),
                  onTouchstart: ($event) => $setup.onTouchStart(index, $event),
                  onTouchmove: ($event) => $setup.onTouchMove(index, $event),
                  onTouchend: ($event) => $setup.onTouchEnd(index),
                  onClick: ($event) => $setup.handleItemClick(index, item)
                }, [
                  vue.createElementVNode("view", { class: "history-info" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "history-name" },
                      "录音 " + vue.toDisplayString(index + 1),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "history-time" },
                      vue.toDisplayString($setup.formatRecordTime(item.timestamp)),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode(
                    "text",
                    { class: "history-duration" },
                    vue.toDisplayString(item.duration),
                    1
                    /* TEXT */
                  )
                ], 42, ["onTouchstart", "onTouchmove", "onTouchend", "onClick"])
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__file", "D:/安卓project/record/record/pages/index/index.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:4", "App Launch");
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:7", "App Show");
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:10", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "D:/安卓project/record/record/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
