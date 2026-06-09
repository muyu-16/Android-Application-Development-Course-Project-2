'use strict';

exports.main = async (event, context) => {
	const { base64, cloudPath, duration, nickname, deviceId } = event || {};

	if (!base64 || !cloudPath) {
		return { success: false, error: '参数缺失：base64 / cloudPath 必填' };
	}

	try {
		// 1. base64 → Buffer
		const buffer = Buffer.from(base64, 'base64');

		// 2. 上传到云存储（在云函数里，uniCloud.uploadFile 接收 fileContent 即可，无需本地路径）
		const uploadResult = await uniCloud.uploadFile({
			cloudPath: cloudPath,
			fileContent: buffer
		});

		const fileID = uploadResult.fileID;

		// 3. 写元数据到数据库
		const db = uniCloud.database();
		await db.collection('recordings').add({
			fileID: fileID,
			duration: typeof duration === 'number' ? duration : 0,
			createTime: Date.now(),
			nickname: nickname || '匿名同学',
			deviceId: deviceId || ''
		});

		return { success: true, fileID: fileID };
	} catch (e) {
		return { success: false, error: e.message || String(e) };
	}
};
