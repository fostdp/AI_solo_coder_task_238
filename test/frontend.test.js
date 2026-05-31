const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const frontendCode = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app.js'),
  'utf-8'
);

test.describe('前端逻辑测试', () => {
  
  test.describe('录音生命周期 - 资源管理', () => {
    
    test('应该包含 cleanupMediaResources 函数', () => {
      assert.ok(frontendCode.includes('function cleanupMediaResources'), '缺少 cleanupMediaResources 函数');
    });
    
    test('cleanupMediaResources 应该清理 currentStream', () => {
      assert.ok(frontendCode.includes('currentStream.getTracks().forEach'), '没有清理 mediaStream 轨道');
      assert.ok(frontendCode.includes('currentStream = null'), '没有将 currentStream 置为 null');
    });
    
    test('cleanupMediaResources 应该清理 mediaRecorder', () => {
      assert.ok(frontendCode.includes('mediaRecorder.stop()'), '没有停止 MediaRecorder');
      assert.ok(frontendCode.includes('mediaRecorder.ondataavailable = null'), '没有清除 ondataavailable 监听器');
      assert.ok(frontendCode.includes('mediaRecorder.onstop = null'), '没有清除 onstop 监听器');
      assert.ok(frontendCode.includes('mediaRecorder = null'), '没有将 mediaRecorder 置为 null');
    });
    
    test('cleanupMediaResources 应该清理 recordingTimeout', () => {
      assert.ok(frontendCode.includes('clearTimeout(recordingTimeout)'), '没有清除 recordingTimeout');
      assert.ok(frontendCode.includes('recordingTimeout = null'), '没有将 recordingTimeout 置为 null');
    });
    
    test('应该包含 cleanupRecordedData 函数', () => {
      assert.ok(frontendCode.includes('function cleanupRecordedData'), '缺少 cleanupRecordedData 函数');
    });
    
    test('cleanupRecordedData 应该释放对象URL', () => {
      assert.ok(frontendCode.includes('URL.revokeObjectURL'), '没有调用 URL.revokeObjectURL 释放资源');
      assert.ok(frontendCode.includes('recordedAudioUrl = null'), '没有将 recordedAudioUrl 置为 null');
    });
    
    test('cleanupRecordedData 应该清理 recordedChunks', () => {
      assert.ok(frontendCode.includes('recordedChunks = []'), '没有清理 recordedChunks 数组');
    });
    
    test('startRecording 前应该调用清理函数', () => {
      const startRecordingMatch = frontendCode.match(/async function startRecording\(\)[\s\S]*?try\s*\{[\s\S]*?cleanupMediaResources\(\)/);
      assert.ok(startRecordingMatch, 'startRecording 开始时没有调用 cleanupMediaResources');
      
      const cleanupDataMatch = frontendCode.match(/cleanupMediaResources\(\);[\s\S]*cleanupRecordedData\(\)/);
      assert.ok(cleanupDataMatch, 'startRecording 开始时没有调用 cleanupRecordedData');
    });
    
    test('应该在页面卸载时清理资源', () => {
      assert.ok(frontendCode.includes('window.addEventListener(\'beforeunload\''), '没有监听 beforeunload 事件');
      assert.ok(frontendCode.match(/beforeunload[\s\S]*cleanupMediaResources\(\)/), 'beforeunload 时没有清理媒体资源');
      assert.ok(frontendCode.match(/beforeunload[\s\S]*cleanupRecordedData\(\)/), 'beforeunload 时没有清理录制数据');
    });
  });
  
  test.describe('录音时长限制', () => {
    
    test('应该定义最大录音时长', () => {
      assert.ok(frontendCode.includes('MAX_RECORDING_TIME'), '缺少 MAX_RECORDING_TIME 常量');
      
      const timeMatch = frontendCode.match(/const MAX_RECORDING_TIME\s*=\s*([^;]+)/);
      assert.ok(timeMatch, 'MAX_RECORDING_TIME 格式不正确');
      
      const timeExpression = timeMatch[1].trim();
      assert.ok(timeExpression.includes('5 * 60 * 1000') || timeExpression === '300000', '最大录音时长应该是5分钟（300000毫秒）');
    });
    
    test('应该设置录音超时定时器', () => {
      assert.ok(frontendCode.includes('recordingTimeout = setTimeout'), '没有设置录音超时定时器');
      assert.ok(frontendCode.includes('MAX_RECORDING_TIME'), '定时器没有使用 MAX_RECORDING_TIME');
    });
    
    test('超时后应该自动停止录音', () => {
      const timeoutMatch = frontendCode.match(/setTimeout\([\s\S]*?stopRecording\(\)/);
      assert.ok(timeoutMatch, '超时后没有调用 stopRecording');
    });
    
    test('mediaRecorder.onstop 应该清除超时定时器', () => {
      const onstopMatch = frontendCode.match(/mediaRecorder\.onstop[\s\S]*?clearTimeout\(recordingTimeout\)/);
      assert.ok(onstopMatch, 'onstop 回调中没有清除 recordingTimeout');
    });
  });
  
  test.describe('评分防刷机制 - localStorage', () => {
    
    test('应该包含 getRatedRecordings 函数', () => {
      assert.ok(frontendCode.includes('function getRatedRecordings'), '缺少 getRatedRecordings 函数');
    });
    
    test('getRatedRecordings 应该从 localStorage 读取', () => {
      assert.ok(frontendCode.match(/localStorage\.getItem\(['"]ratedRecordings['"]\)/), '没有从 localStorage 读取 ratedRecordings');
    });
    
    test('应该包含 saveRatedRecording 函数', () => {
      assert.ok(frontendCode.includes('function saveRatedRecording'), '缺少 saveRatedRecording 函数');
    });
    
    test('saveRatedRecording 应该写入 localStorage', () => {
      assert.ok(frontendCode.match(/localStorage\.setItem\(['"]ratedRecordings['"]/), '没有写入 localStorage');
    });
    
    test('应该包含 hasRated 函数', () => {
      assert.ok(frontendCode.includes('function hasRated'), '缺少 hasRated 函数');
    });
    
    test('submitRating 应该先检查是否已评分', () => {
      const checkMatch = frontendCode.match(/async function submitRating[\s\S]*?hasRated\(recordingId\)/);
      assert.ok(checkMatch, 'submitRating 没有先检查是否已评分');
    });
    
    test('已评分应该阻止重复评分', () => {
      const blockMatch = frontendCode.match(/hasRated\(recordingId\)[\s\S]*?showMessage[\s\S]*?已经/);
      assert.ok(blockMatch, '已评分时没有显示提示信息');
      
      const returnMatch = frontendCode.match(/已经.*评过分.*[\s\S]*?return;/);
      assert.ok(returnMatch, '已评分时没有提前返回阻止提交');
    });
    
    test('成功评分后应该保存记录', () => {
      const saveMatch = frontendCode.match(/response\.ok[\s\S]*?saveRatedRecording\(recordingId\)/);
      assert.ok(saveMatch, '成功评分后没有保存到 localStorage');
    });
    
    test('已评分的录音应该显示不同UI', () => {
      assert.ok(frontendCode.includes('alreadyRated'), '没有检查 alreadyRated 状态');
      assert.ok(frontendCode.includes('您已评分'), '没有显示"您已评分"提示');
      assert.ok(frontendCode.includes('rated-hint'), '没有使用 rated-hint 样式类');
    });
    
    test('data-rated 属性应该用于状态追踪', () => {
      assert.ok(frontendCode.includes('data-rated="${alreadyRated}"'), '没有设置 data-rated 属性');
      assert.ok(frontendCode.includes('dataset.rated'), '没有检查 dataset.rated');
    });
  });
  
  test.describe('音频加载状态', () => {
    
    test('应该包含 audio-loading 容器', () => {
      assert.ok(frontendCode.includes('class="audio-loading"'), '没有 audio-loading 容器');
    });
    
    test('应该包含加载动画 spinner', () => {
      assert.ok(frontendCode.includes('class="loading-spinner"'), '没有 loading-spinner 元素');
    });
    
    test('应该显示加载文字', () => {
      assert.ok(frontendCode.includes('音频加载中...'), '没有显示"音频加载中..."文字');
    });
    
    test('应该监听 loadeddata 事件', () => {
      assert.ok(frontendCode.includes('addEventListener(\'loadeddata\''), '没有监听 loadeddata 事件');
    });
    
    test('loadeddata 后应该隐藏 loading 并显示播放器', () => {
      const loadedMatch = frontendCode.match(/loadeddata[\s\S]*?audioLoading\.style\.display\s*=\s*['"]none['"]/);
      assert.ok(loadedMatch, '加载完成后没有隐藏 loading');
      
      const showPlayerMatch = frontendCode.match(/loadeddata[\s\S]*?audioEl\.style\.display\s*=\s*['"]block['"]/);
      assert.ok(showPlayerMatch, '加载完成后没有显示播放器');
    });
    
    test('应该监听 error 事件', () => {
      assert.ok(frontendCode.includes('addEventListener(\'error\''), '没有监听 error 事件');
    });
    
    test('error 时应该显示错误提示', () => {
      assert.ok(frontendCode.includes('音频加载失败'), '没有显示"音频加载失败"错误提示');
      assert.ok(frontendCode.includes('error-text'), '没有使用 error-text 样式类');
    });
    
    test('应该使用 preload="metadata" 优化加载', () => {
      assert.ok(frontendCode.includes('preload="metadata"'), 'audio 元素没有设置 preload="metadata"');
    });
  });
  
  test.describe('代码质量检查', () => {
    
    test('应该定义 currentStream 变量', () => {
      assert.ok(frontendCode.includes('let currentStream'), '没有定义 currentStream 变量');
    });
    
    test('应该定义 recordingTimeout 变量', () => {
      assert.ok(frontendCode.includes('let recordingTimeout'), '没有定义 recordingTimeout 变量');
    });
    
    test('recordedChunks 变量应该存在', () => {
      assert.ok(frontendCode.includes('let recordedChunks'), '没有定义 recordedChunks 变量');
    });
    
    test('mediaRecorder 变量应该存在', () => {
      assert.ok(frontendCode.includes('let mediaRecorder'), '没有定义 mediaRecorder 变量');
    });
    
    test('startRecording 应该有 try-catch', () => {
      const tryCatchMatch = frontendCode.match(/async function startRecording[\s\S]*?try\s*\{[\s\S]*?catch\s*\(/);
      assert.ok(tryCatchMatch, 'startRecording 没有 try-catch 错误处理');
    });
    
    test('uploadRecording 应该有 try-catch', () => {
      const tryCatchMatch = frontendCode.match(/async function uploadRecording[\s\S]*?try\s*\{[\s\S]*?catch\s*\(/);
      assert.ok(tryCatchMatch, 'uploadRecording 没有 try-catch 错误处理');
    });
    
    test('submitRating 应该有 try-catch', () => {
      const tryCatchMatch = frontendCode.match(/async function submitRating[\s\S]*?try\s*\{[\s\S]*?catch\s*\(/);
      assert.ok(tryCatchMatch, 'submitRating 没有 try-catch 错误处理');
    });
  });
  
  test.describe('录音数据安全', () => {
    
    test('mediaRecorder.ondataavailable 应该检查数据大小', () => {
      const dataCheck = frontendCode.match(/ondataavailable[\s\S]*?e\.data\.size\s*>\s*0/);
      assert.ok(dataCheck, '没有检查 e.data.size > 0');
    });
    
    test('onstop 应该检查 recordedChunks 是否为空', () => {
      const emptyCheck = frontendCode.match(/onstop[\s\S]*?recordedChunks\.length\s*===\s*0/);
      assert.ok(emptyCheck, 'onstop 没有检查 recordedChunks 是否为空');
    });
    
    test('上传前应该检查 recordedChunks', () => {
      const uploadCheck = frontendCode.match(/uploadRecording[\s\S]*?recordedChunks\.length/);
      assert.ok(uploadCheck, 'uploadRecording 没有检查 recordedChunks');
    });
    
    test('URL.createObjectURL 后应该释放旧的', () => {
      const revokeMatch = frontendCode.match(/recordedAudioUrl[\s\S]*?URL\.revokeObjectURL\(recordedAudioUrl\)/);
      assert.ok(revokeMatch, '创建新 URL 前没有释放旧的');
    });
  });
});

test.describe('前端关键功能验证', () => {
  
  test('评分防刷 - localStorage 完整流程验证', () => {
    const hasRatedExists = frontendCode.includes('function hasRated');
    const getRatedExists = frontendCode.includes('function getRatedRecordings');
    const saveRatedExists = frontendCode.includes('function saveRatedRecording');
    const checkBeforeSubmit = frontendCode.includes('if (hasRated(recordingId))');
    const saveAfterSubmit = frontendCode.match(/response\.ok[\s\S]*?saveRatedRecording/);
    
    assert.ok(hasRatedExists, '缺少 hasRated 函数');
    assert.ok(getRatedExists, '缺少 getRatedRecordings 函数');
    assert.ok(saveRatedExists, '缺少 saveRatedRecording 函数');
    assert.ok(checkBeforeSubmit, '提交前没有检查');
    assert.ok(saveAfterSubmit, '提交后没有保存');
  });
  
  test('内存释放 - 完整清理流程验证', () => {
    const cleanupMedia = frontendCode.includes('function cleanupMediaResources');
    const cleanupData = frontendCode.includes('function cleanupRecordedData');
    const beforeStart = frontendCode.match(/startRecording[\s\S]*?cleanupMediaResources\(\);[\s\S]*cleanupRecordedData\(\)/);
    const onUnload = frontendCode.includes('beforeunload');
    
    assert.ok(cleanupMedia, '缺少 cleanupMediaResources');
    assert.ok(cleanupData, '缺少 cleanupRecordedData');
    assert.ok(beforeStart, '开始前没有清理');
    assert.ok(onUnload, '没有卸载清理');
  });
  
  test('音频加载 - 完整状态管理验证', () => {
    const loadingUI = frontendCode.includes('audio-loading');
    const loadeddataEvent = frontendCode.includes('loadeddata');
    const errorEvent = frontendCode.includes('error');
    const showPlayer = frontendCode.match(/loadeddata[\s\S]*?audioEl\.style\.display/);
    const hideLoading = frontendCode.match(/loadeddata[\s\S]*?audioLoading\.style\.display/);
    
    assert.ok(loadingUI, '缺少 loading UI');
    assert.ok(loadeddataEvent, '缺少 loadeddata 监听');
    assert.ok(errorEvent, '缺少 error 监听');
    assert.ok(showPlayer, '没有显示播放器');
    assert.ok(hideLoading, '没有隐藏 loading');
  });
});
