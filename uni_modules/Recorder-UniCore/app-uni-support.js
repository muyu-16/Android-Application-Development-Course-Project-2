/**
Recorder-UniCore uni-app App端支持文件
使用 H5 录音 + 可视化方式
**/
import Recorder from 'recorder-core'
import 'recorder-core/src/engine/mp3'
import 'recorder-core/src/engine/mp3-engine'

var App = {}

App.LM = '2025-01-01'

App.UniPageOnShow = function(proxy) {}
App.UniWebViewActivate = function(proxy) {}

App.Support = function(call) {
	call(true)
}

App.CanProcess = function() {
	return true
}

var _recorder = null
var _isRecording = false
var _onProcessCallback = null

App.RequestPermission = function(success, fail) {
	success()
}

App.Start = function(opt) {
	_recorder = new Recorder({
		type: opt.type || 'mp3',
		sampleRate: opt.sampleRate || 16000,
		bitRate: opt.bitRate || 16,
		onProcess: function(buffers, power, duration, sampleRate) {
			if (_onProcessCallback) {
				_onProcessCallback(buffers, power, duration, sampleRate)
			}
		}
	})

	_onProcessCallback = opt.onProcess
	_isRecording = true

	_recorder.start(function() {
		console.log('H5录音已开始')
	}, function(err) {
		console.error('录音启动失败:', err)
	})
}

App.Stop = function(success, fail) {
	_isRecording = false
	_onProcessCallback = null

	if (_recorder) {
		_recorder.stop(function(blob, duration) {
			success({ blob: blob }, duration * 1000)
		}, function(err) {
			fail(err)
		})
		_recorder.close()
		_recorder = null
	} else {
		success(null, 0)
	}
}

App.Close = function() {
	_isRecording = false
	if (_recorder) {
		_recorder.close()
		_recorder = null
	}
}

export default App