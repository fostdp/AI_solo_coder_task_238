const API_BASE = '';

let dialects = [];
let selectedDialect = null;
let selectedExample = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedAudioUrl = null;
let currentStream = null;
let recordingTimeout = null;
const MAX_RECORDING_TIME = 5 * 60 * 1000;

let playSelectedDialect = null;
let playSelectedExample = null;

let aiSelectedDialect = null;
let aiSelectedExample = null;
let aiMediaRecorder = null;
let aiRecordedChunks = [];
let aiAudioUrl = null;

let currentChallenge = null;
let challengeSelectedDialect = null;
let challengeMediaRecorder = null;
let challengeRecordedChunks = [];
let challengeAudioUrl = null;

document.addEventListener('DOMContentLoaded', init);

function getRatedRecordings() {
  try {
    const data = localStorage.getItem('ratedRecordings');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveRatedRecording(recordingId) {
  try {
    const rated = getRatedRecordings();
    rated[recordingId] = { ratedAt: Date.now() };
    localStorage.setItem('ratedRecordings', JSON.stringify(rated));
  } catch (e) {
    console.error('保存评分记录失败:', e);
  }
}

function hasRated(recordingId) {
  const rated = getRatedRecordings();
  return !!rated[recordingId];
}

function getUserId() {
  let userId = localStorage.getItem('dialectUserId');
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('dialectUserId', userId);
  }
  return userId;
}

async function init() {
  try {
    dialects = await fetch(`${API_BASE}/api/dialects`).then(res => res.json());
    
    populateDialectSelect('dialect-select');
    populateDialectSelect('play-dialect-select');
    populateDialectSelect('ai-dialect-select');
    populateDialectSelect('challenge-dialect-select');
    
    loadPlayExamples();
    loadRecordings();
    loadChallenges();
    loadUserProgress();
  } catch (error) {
    console.error('初始化失败:', error);
  }
  
  setupTabs();
  setupEventListeners();
}

function populateDialectSelect(elementId) {
  const select = document.getElementById(elementId);
  if (!select) return;
  
  if (elementId === 'dialect-select' || elementId === 'ai-dialect-select' || elementId === 'challenge-dialect-select') {
    select.innerHTML = '<option value="">-- 请选择方言 --</option>';
  } else if (elementId === 'play-dialect-select') {
    select.innerHTML = '<option value="">全部方言</option>';
  }
  
  dialects.forEach(dialect => {
    const option = document.createElement('option');
    option.value = dialect.id;
    option.textContent = dialect.name;
    select.appendChild(option);
  });
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      const tabId = tab.dataset.tab;
      const targetTab = document.getElementById(`${tabId}-tab`);
      if (targetTab) {
        targetTab.classList.add('active');
      }
      
      if (tabId === 'play') {
        loadRecordings();
      } else if (tabId === 'map') {
        loadMapStats();
      } else if (tabId === 'challenge') {
        loadChallenges();
        loadUserProgress();
      }
    });
  });
}

function setupEventListeners() {
  document.getElementById('dialect-select')?.addEventListener('change', handleDialectChange);
  document.getElementById('start-btn')?.addEventListener('click', startRecording);
  document.getElementById('stop-btn')?.addEventListener('click', stopRecording);
  document.getElementById('re-record-btn')?.addEventListener('click', resetRecording);
  document.getElementById('upload-btn')?.addEventListener('click', uploadRecording);
  
  document.getElementById('play-dialect-select')?.addEventListener('change', handlePlayDialectChange);
  
  document.getElementById('ai-dialect-select')?.addEventListener('change', handleAiDialectChange);
  document.getElementById('ai-start-btn')?.addEventListener('click', startAiRecording);
  document.getElementById('ai-stop-btn')?.addEventListener('click', stopAiRecording);
  document.getElementById('ai-retry-btn')?.addEventListener('click', resetAiEvaluation);
  
  document.getElementById('view-leaderboard-btn')?.addEventListener('click', showLeaderboard);
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
  
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModals();
      }
    });
  });
  
  document.getElementById('challenge-dialect-select')?.addEventListener('change', handleChallengeDialectChange);
  document.getElementById('challenge-start-btn')?.addEventListener('click', startChallengeRecording);
  document.getElementById('challenge-stop-btn')?.addEventListener('click', stopChallengeRecording);
  document.getElementById('challenge-retry-btn')?.addEventListener('click', resetChallengeRecording);
  document.getElementById('challenge-submit-btn')?.addEventListener('click', submitChallenge);
}

function cleanupMediaResources() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => {
      track.stop();
    });
    currentStream = null;
  }
  
  if (mediaRecorder) {
    if (mediaRecorder.state === 'recording') {
      try {
        mediaRecorder.stop();
      } catch (e) {
        console.warn('停止 MediaRecorder 失败:', e);
      }
    }
    mediaRecorder.ondataavailable = null;
    mediaRecorder.onstop = null;
    mediaRecorder = null;
  }
  
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
    recordingTimeout = null;
  }
}

function cleanupRecordedData() {
  if (recordedAudioUrl) {
    URL.revokeObjectURL(recordedAudioUrl);
    recordedAudioUrl = null;
  }
  
  if (recordedChunks.length > 0) {
    recordedChunks = [];
  }
  
  const previewAudio = document.getElementById('preview-audio');
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.removeAttribute('src');
    previewAudio.load();
  }
}

async function handleDialectChange(e) {
  const dialectId = e.target.value;
  if (!dialectId) {
    document.getElementById('examples-list').innerHTML = '<p class="empty-tip">请先选择方言</p>';
    selectedDialect = null;
    selectedExample = null;
    return;
  }
  
  selectedDialect = dialects.find(d => d.id === dialectId);
  const examples = await fetch(`${API_BASE}/api/examples/${dialectId}`).then(res => res.json());
  
  renderExamples(examples, 'examples-list', (example) => {
    selectedExample = example;
  });
}

function renderExamples(examples, containerId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  examples.forEach(example => {
    const item = document.createElement('div');
    item.className = 'example-item';
    item.dataset.id = example.id;
    item.dataset.text = example.text;
    
    let html = `<p>${example.text}</p>`;
    if (example.pinyin) {
      html += `<p style="font-size: 0.85rem; color: #667eea; margin-top: 5px;">${example.pinyin}</p>`;
    }
    item.innerHTML = html;
    
    item.addEventListener('click', () => {
      container.querySelectorAll('.example-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      if (onSelect) onSelect(example);
    });
    
    container.appendChild(item);
  });
}

async function startRecording() {
  if (!selectedDialect) {
    showMessage('请先选择方言', 'error');
    return;
  }
  if (!selectedExample) {
    showMessage('请先选择例句', 'error');
    return;
  }
  
  cleanupMediaResources();
  cleanupRecordedData();
  
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(currentStream);
    recordedChunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
      }
      
      if (recordedChunks.length === 0) {
        showMessage('没有录制到音频数据，请重试', 'error');
        cleanupMediaResources();
        return;
      }
      
      const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      
      recordedAudioUrl = URL.createObjectURL(audioBlob);
      
      const previewAudio = document.getElementById('preview-audio');
      previewAudio.src = recordedAudioUrl;
      document.getElementById('audio-preview').style.display = 'block';
      
      cleanupMediaResources();
    };
    
    mediaRecorder.start(1000);
    
    recordingTimeout = setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        showMessage('录音已达到最大时长（5分钟），已自动停止', 'warning');
        stopRecording();
      }
    }, MAX_RECORDING_TIME);
    
    document.getElementById('record-status').textContent = '🔴 录音中...';
    document.getElementById('record-status').classList.add('recording');
    document.getElementById('start-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
    document.getElementById('audio-preview').style.display = 'none';
    
  } catch (error) {
    console.error('录音失败:', error);
    cleanupMediaResources();
    showMessage('无法访问麦克风，请检查权限设置', 'error');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    try {
      mediaRecorder.stop();
    } catch (e) {
      console.warn('停止录音失败:', e);
    }
    
    document.getElementById('record-status').textContent = '录音完成';
    document.getElementById('record-status').classList.remove('recording');
    document.getElementById('start-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
  }
}

function resetRecording() {
  cleanupMediaResources();
  cleanupRecordedData();
  
  document.getElementById('audio-preview').style.display = 'none';
  document.getElementById('record-status').textContent = '等待开始';
  document.getElementById('record-status').classList.remove('recording');
  document.getElementById('start-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  document.getElementById('message').style.display = 'none';
}

async function uploadRecording() {
  if (!recordedChunks.length) {
    showMessage('没有可上传的录音', 'error');
    return;
  }
  
  const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('dialectId', selectedDialect.id);
  formData.append('dialectName', selectedDialect.name);
  formData.append('exampleId', selectedExample.id);
  formData.append('exampleText', selectedExample.text);
  
  try {
    const response = await fetch(`${API_BASE}/api/recordings`, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      showMessage('录音上传成功！', 'success');
      resetRecording();
    } else {
      const data = await response.json();
      showMessage(data.error || '上传失败', 'error');
    }
  } catch (error) {
    console.error('上传失败:', error);
    showMessage('上传失败，请重试', 'error');
  }
}

async function handlePlayDialectChange(e) {
  const dialectId = e.target.value;
  if (!dialectId) {
    playSelectedDialect = null;
    playSelectedExample = null;
    document.getElementById('play-examples-list').innerHTML = '<p class="empty-tip">请先选择方言</p>';
  } else {
    playSelectedDialect = dialects.find(d => d.id === dialectId);
    playSelectedExample = null;
    await loadPlayExamples();
  }
  loadRecordings();
}

async function loadPlayExamples() {
  const container = document.getElementById('play-examples-list');
  if (!container) return;
  
  if (!playSelectedDialect) {
    container.innerHTML = '<p class="empty-tip">请先选择方言以查看例句</p>';
    return;
  }
  
  const examples = await fetch(`${API_BASE}/api/examples/${playSelectedDialect.id}`).then(res => res.json());
  renderExamples(examples, 'play-examples-list', (example) => {
    playSelectedExample = example;
    loadRecordings();
  });
}

async function loadRecordings() {
  const container = document.getElementById('recordings-list');
  if (!container) return;
  
  container.innerHTML = '<p class="empty-tip">加载中...</p>';
  
  let url = `${API_BASE}/api/recordings`;
  const params = new URLSearchParams();
  
  if (playSelectedDialect) {
    params.append('dialect', playSelectedDialect.id);
  }
  if (playSelectedExample) {
    params.append('example', playSelectedExample.id);
  }
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  try {
    const recordings = await fetch(url).then(res => res.json());
    
    if (recordings.length === 0) {
      container.innerHTML = '<p class="empty-tip">暂无符合条件的录音</p>';
      return;
    }
    
    container.innerHTML = '';
    recordings.forEach(recording => {
      container.appendChild(createRecordingCard(recording));
    });
  } catch (error) {
    console.error('加载录音失败:', error);
    container.innerHTML = '<p class="empty-tip">加载失败，请刷新页面重试</p>';
  }
}

function createRecordingCard(recording) {
  const card = document.createElement('div');
  card.className = 'recording-card';
  
  const avgRating = recording.averageRating || 0;
  const ratingText = avgRating > 0 ? `平均评分: ${avgRating.toFixed(1)}/5 (${recording.ratings.length}人)` : '暂无评分';
  const alreadyRated = hasRated(recording.id);
  
  card.innerHTML = `
    <div class="recording-header">
      <div class="recording-info">
        <h3>${recording.exampleText}</h3>
        <p>录制时间: ${new Date(recording.createdAt).toLocaleString('zh-CN')}</p>
      </div>
      <span class="recording-badge">${recording.dialectName}</span>
    </div>
    <div class="recording-player">
      <div class="audio-container" data-url="${recording.audioUrl}">
        <div class="audio-loading">
          <span class="loading-spinner"></span>
          <span class="loading-text">音频加载中...</span>
        </div>
        <audio controls style="display: none;" preload="metadata"></audio>
      </div>
    </div>
    <div class="rating-section">
      <div class="average-rating">${ratingText}</div>
      <div class="star-rating" data-id="${recording.id}" data-rated="${alreadyRated}">
        ${alreadyRated 
          ? '<span class="rated-hint">您已评分</span>'
          : `
            <span class="star" data-rating="1">★</span>
            <span class="star" data-rating="2">★</span>
            <span class="star" data-rating="3">★</span>
            <span class="star" data-rating="4">★</span>
            <span class="star" data-rating="5">★</span>
          `
        }
      </div>
    </div>
  `;
  
  const audioContainer = card.querySelector('.audio-container');
  const audioLoading = card.querySelector('.audio-loading');
  const audioEl = card.querySelector('audio');
  
  audioEl.src = recording.audioUrl;
  
  audioEl.addEventListener('loadeddata', () => {
    audioLoading.style.display = 'none';
    audioEl.style.display = 'block';
  });
  
  audioEl.addEventListener('error', () => {
    audioLoading.innerHTML = '<span class="error-text">音频加载失败</span>';
  });
  
  const starContainer = card.querySelector('.star-rating');
  const stars = starContainer.querySelectorAll('.star');
  
  if (!alreadyRated) {
    stars.forEach(star => {
      star.addEventListener('click', async () => {
        const rating = parseInt(star.dataset.rating);
        await submitRating(recording.id, rating, starContainer);
      });
      
      star.addEventListener('mouseenter', () => {
        const rating = parseInt(star.dataset.rating);
        stars.forEach((s, index) => {
          s.classList.toggle('active', index < rating);
        });
      });
    });
    
    starContainer.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('active'));
    });
  }
  
  return card;
}

async function submitRating(recordingId, rating, starContainer) {
  if (hasRated(recordingId)) {
    showMessage('您已经对该录音评过分了', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/recordings/${recordingId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rating, userId: getUserId() })
    });
    
    if (response.ok) {
      saveRatedRecording(recordingId);
      showMessage('评分成功！', 'success');
      
      starContainer.dataset.rated = 'true';
      starContainer.innerHTML = '<span class="rated-hint">您已评分</span>';
      
      setTimeout(() => {
        loadRecordings();
      }, 500);
    } else {
      const data = await response.json();
      showMessage(data.error || '评分失败', 'error');
    }
  } catch (error) {
    console.error('评分失败:', error);
    showMessage('评分失败，请重试', 'error');
  }
}

async function handleAiDialectChange(e) {
  const dialectId = e.target.value;
  if (!dialectId) {
    document.getElementById('ai-examples-list').innerHTML = '<p class="empty-tip">请先选择方言</p>';
    aiSelectedDialect = null;
    aiSelectedExample = null;
    return;
  }
  
  aiSelectedDialect = dialects.find(d => d.id === dialectId);
  const examples = await fetch(`${API_BASE}/api/examples/${dialectId}`).then(res => res.json());
  
  renderExamples(examples, 'ai-examples-list', (example) => {
    aiSelectedExample = example;
  });
  
  resetAiEvaluation();
}

async function startAiRecording() {
  if (!aiSelectedDialect) {
    showMessage('请先选择方言', 'error');
    return;
  }
  if (!aiSelectedExample) {
    showMessage('请先选择测评例句', 'error');
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    aiMediaRecorder = new MediaRecorder(stream);
    aiRecordedChunks = [];
    
    aiMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        aiRecordedChunks.push(e.data);
      }
    };
    
    aiMediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      
      if (aiRecordedChunks.length === 0) {
        showMessage('没有录制到音频数据，请重试', 'error');
        return;
      }
      
      const audioBlob = new Blob(aiRecordedChunks, { type: 'audio/webm' });
      await evaluateAudio(audioBlob);
    };
    
    aiMediaRecorder.start(1000);
    
    document.getElementById('ai-status').textContent = '🔴 录音中...请朗读例句';
    document.getElementById('ai-status').classList.add('recording');
    document.getElementById('ai-start-btn').disabled = true;
    document.getElementById('ai-stop-btn').disabled = false;
    document.getElementById('ai-evaluating').style.display = 'none';
    document.getElementById('ai-result').style.display = 'none';
    
  } catch (error) {
    console.error('录音失败:', error);
    showMessage('无法访问麦克风，请检查权限设置', 'error');
  }
}

function stopAiRecording() {
  if (aiMediaRecorder && aiMediaRecorder.state === 'recording') {
    aiMediaRecorder.stop();
    
    document.getElementById('ai-status').textContent = '录音完成，正在分析...';
    document.getElementById('ai-status').classList.remove('recording');
    document.getElementById('ai-start-btn').disabled = false;
    document.getElementById('ai-stop-btn').disabled = true;
  }
}

async function evaluateAudio(audioBlob) {
  document.getElementById('ai-recording-section').style.display = 'none';
  document.getElementById('ai-evaluating').style.display = 'flex';
  
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'evaluation.webm');
    formData.append('dialectId', aiSelectedDialect.id);
    formData.append('text', aiSelectedExample.text);
    
    const response = await fetch(`${API_BASE}/api/ai/evaluate`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    displayAiResult(result);
    
  } catch (error) {
    console.error('AI测评失败:', error);
    document.getElementById('ai-recording-section').style.display = 'block';
    document.getElementById('ai-evaluating').style.display = 'none';
    showMessage('AI测评失败，请重试', 'error');
  }
}

function displayAiResult(result) {
  document.getElementById('ai-evaluating').style.display = 'none';
  document.getElementById('ai-result').style.display = 'block';
  
  document.getElementById('ai-score').textContent = result.overallScore;
  document.getElementById('ai-level').textContent = result.level;
  
  document.getElementById('score-pronunciation').style.width = result.scores.pronunciation + '%';
  document.getElementById('score-pronunciation-val').textContent = result.scores.pronunciation;
  
  document.getElementById('score-tone').style.width = result.scores.tone + '%';
  document.getElementById('score-tone-val').textContent = result.scores.tone;
  
  document.getElementById('score-fluency').style.width = result.scores.fluency + '%';
  document.getElementById('score-fluency-val').textContent = result.scores.fluency;
  
  document.getElementById('score-dialect').style.width = result.scores.dialect + '%';
  document.getElementById('score-dialect-val').textContent = result.scores.dialect;
  
  document.getElementById('ai-comment-text').textContent = result.comment;
  
  const suggestionsList = document.getElementById('ai-suggestions-list');
  suggestionsList.innerHTML = '';
  result.suggestions.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    suggestionsList.appendChild(li);
  });
  
  if (aiAudioUrl) {
    URL.revokeObjectURL(aiAudioUrl);
  }
  aiAudioUrl = URL.createObjectURL(new Blob(aiRecordedChunks, { type: 'audio/webm' }));
}

function resetAiEvaluation() {
  if (aiAudioUrl) {
    URL.revokeObjectURL(aiAudioUrl);
    aiAudioUrl = null;
  }
  aiRecordedChunks = [];
  
  if (aiMediaRecorder && aiMediaRecorder.state === 'recording') {
    aiMediaRecorder.stop();
  }
  
  document.getElementById('ai-result').style.display = 'none';
  document.getElementById('ai-evaluating').style.display = 'none';
  document.getElementById('ai-recording-section').style.display = 'block';
  document.getElementById('ai-status').textContent = '准备开始测评';
  document.getElementById('ai-start-btn').disabled = false;
  document.getElementById('ai-stop-btn').disabled = true;
  document.getElementById('message').style.display = 'none';
}

async function loadMapStats() {
  try {
    const response = await fetch(`${API_BASE}/api/map/stats`);
    const data = await response.json();
    
    document.getElementById('total-recordings').textContent = data.totalRecordings;
    
    data.dialects.forEach(d => {
      const countEl = document.getElementById(`count-${d.id}`);
      if (countEl) {
        countEl.textContent = `${d.count} 条录音`;
      }
    });
    
    renderLegend(data.dialects);
    
  } catch (error) {
    console.error('加载地图数据失败:', error);
  }
}

function renderLegend(dialects) {
  const legendList = document.getElementById('dialect-legend-list');
  if (!legendList) return;
  
  legendList.innerHTML = '';
  
  dialects.forEach(d => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-color" style="background: ${d.color}"></div>
      <span class="legend-name">${d.name}</span>
      <span class="legend-count">${d.count} 条</span>
    `;
    legendList.appendChild(item);
  });
}

async function loadChallenges() {
  const container = document.getElementById('challenges-list');
  if (!container) return;
  
  container.innerHTML = '<p class="empty-tip">加载挑战中...</p>';
  
  try {
    const challenges = await fetch(`${API_BASE}/api/challenges`).then(res => res.json());
    
    if (challenges.length === 0) {
      container.innerHTML = '<p class="empty-tip">暂无挑战</p>';
      return;
    }
    
    container.innerHTML = '';
    challenges.forEach(challenge => {
      container.appendChild(createChallengeCard(challenge));
    });
  } catch (error) {
    console.error('加载挑战失败:', error);
    container.innerHTML = '<p class="empty-tip">加载失败，请刷新页面重试</p>';
  }
}

function createChallengeCard(challenge) {
  const card = document.createElement('div');
  card.className = 'challenge-card';
  
  const difficultyMap = {
    easy: { text: '简单', class: 'easy' },
    medium: { text: '中等', class: 'medium' },
    hard: { text: '困难', class: 'hard' }
  };
  
  const difficulty = difficultyMap[challenge.difficulty] || difficultyMap.medium;
  
  card.innerHTML = `
    <h3>${challenge.name}</h3>
    <p>${challenge.description}</p>
    <div class="challenge-card-footer">
      <span class="difficulty-badge ${difficulty.class}">${difficulty.text}</span>
      <span class="reward-badge">🎁 +${challenge.reward} 积分</span>
    </div>
  `;
  
  card.addEventListener('click', () => openChallengeModal(challenge));
  
  return card;
}

async function openChallengeModal(challenge) {
  currentChallenge = challenge;
  challengeSelectedDialect = null;
  
  document.getElementById('modal-challenge-name').textContent = challenge.name;
  document.getElementById('modal-reward').textContent = challenge.reward;
  
  const difficultyMap = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };
  const difficultyBadge = document.getElementById('modal-difficulty');
  difficultyBadge.textContent = difficultyMap[challenge.difficulty] || '中等';
  difficultyBadge.className = `difficulty-badge ${challenge.difficulty}`;
  
  const select = document.getElementById('challenge-dialect-select');
  select.innerHTML = '<option value="">-- 请选择方言 --</option>';
  dialects.forEach(d => {
    const option = document.createElement('option');
    option.value = d.id;
    option.textContent = d.name;
    select.appendChild(option);
  });
  
  document.getElementById('challenge-example-section').style.display = 'none';
  document.getElementById('challenge-result').style.display = 'none';
  document.getElementById('challenge-preview').style.display = 'none';
  document.getElementById('challenge-status').textContent = '准备开始';
  
  document.getElementById('challenge-modal').style.display = 'flex';
}

async function handleChallengeDialectChange(e) {
  const dialectId = e.target.value;
  if (!dialectId) {
    document.getElementById('challenge-example-section').style.display = 'none';
    challengeSelectedDialect = null;
    return;
  }
  
  challengeSelectedDialect = dialects.find(d => d.id === dialectId);
  
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${currentChallenge.id}?dialectId=${dialectId}`);
    const challengeData = await response.json();
    
    if (challengeData.example) {
      document.getElementById('challenge-example-text').textContent = challengeData.example.text;
      document.getElementById('challenge-example-hint').textContent = '💡 ' + challengeData.example.hint;
      document.getElementById('challenge-example-section').style.display = 'block';
    }
  } catch (error) {
    console.error('加载挑战详情失败:', error);
    showMessage('加载挑战详情失败', 'error');
  }
}

async function startChallengeRecording() {
  if (!challengeSelectedDialect) {
    showMessage('请先选择方言', 'error');
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    challengeMediaRecorder = new MediaRecorder(stream);
    challengeRecordedChunks = [];
    
    challengeMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        challengeRecordedChunks.push(e.data);
      }
    };
    
    challengeMediaRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      
      if (challengeRecordedChunks.length === 0) {
        showMessage('没有录制到音频数据，请重试', 'error');
        return;
      }
      
      const audioBlob = new Blob(challengeRecordedChunks, { type: 'audio/webm' });
      
      if (challengeAudioUrl) {
        URL.revokeObjectURL(challengeAudioUrl);
      }
      challengeAudioUrl = URL.createObjectURL(audioBlob);
      
      const previewAudio = document.getElementById('challenge-audio');
      previewAudio.src = challengeAudioUrl;
      document.getElementById('challenge-preview').style.display = 'block';
    };
    
    challengeMediaRecorder.start(1000);
    
    document.getElementById('challenge-status').textContent = '🔴 录音中...';
    document.getElementById('challenge-status').classList.add('recording');
    document.getElementById('challenge-start-btn').disabled = true;
    document.getElementById('challenge-stop-btn').disabled = false;
    
  } catch (error) {
    console.error('录音失败:', error);
    showMessage('无法访问麦克风，请检查权限设置', 'error');
  }
}

function stopChallengeRecording() {
  if (challengeMediaRecorder && challengeMediaRecorder.state === 'recording') {
    challengeMediaRecorder.stop();
    
    document.getElementById('challenge-status').textContent = '录音完成';
    document.getElementById('challenge-status').classList.remove('recording');
    document.getElementById('challenge-start-btn').disabled = false;
    document.getElementById('challenge-stop-btn').disabled = true;
  }
}

function resetChallengeRecording() {
  if (challengeAudioUrl) {
    URL.revokeObjectURL(challengeAudioUrl);
    challengeAudioUrl = null;
  }
  challengeRecordedChunks = [];
  
  if (challengeMediaRecorder && challengeMediaRecorder.state === 'recording') {
    challengeMediaRecorder.stop();
  }
  
  document.getElementById('challenge-preview').style.display = 'none';
  document.getElementById('challenge-status').textContent = '准备开始';
  document.getElementById('challenge-start-btn').disabled = false;
  document.getElementById('challenge-stop-btn').disabled = true;
}

async function submitChallenge() {
  if (challengeRecordedChunks.length === 0) {
    showMessage('没有可提交的录音', 'error');
    return;
  }
  
  const audioBlob = new Blob(challengeRecordedChunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', audioBlob, 'challenge.webm');
  formData.append('dialectId', challengeSelectedDialect.id);
  formData.append('userId', getUserId());
  
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${currentChallenge.id}/submit`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      displayChallengeResult(result);
      loadUserProgress();
    } else {
      showMessage(result.error || '提交失败', 'error');
    }
  } catch (error) {
    console.error('提交挑战失败:', error);
    showMessage('提交失败，请重试', 'error');
  }
}

function displayChallengeResult(result) {
  document.getElementById('challenge-preview').style.display = 'none';
  document.getElementById('challenge-result').style.display = 'block';
  
  const stars = '⭐'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
  document.getElementById('result-stars').textContent = stars;
  document.getElementById('result-score').textContent = result.score;
  document.getElementById('result-comment').textContent = result.comment;
  document.getElementById('result-reward').textContent = '+' + result.reward;
  
  const firstTimeBadge = document.getElementById('first-time-badge');
  if (result.isFirstTime) {
    firstTimeBadge.style.display = 'inline';
  } else {
    firstTimeBadge.style.display = 'none';
  }
}

async function loadUserProgress() {
  try {
    const response = await fetch(`${API_BASE}/api/user/progress?userId=${getUserId()}`);
    const progress = await response.json();
    
    document.getElementById('user-score').textContent = progress.totalScore;
    document.getElementById('completed-count').textContent = progress.completedChallenges.length;
  } catch (error) {
    console.error('加载用户进度失败:', error);
  }
}

async function showLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  container.innerHTML = '<p class="empty-tip">加载中...</p>';
  
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard`);
    const leaderboard = await response.json();
    
    if (leaderboard.length === 0) {
      container.innerHTML = '<p class="empty-tip">暂无排名数据</p>';
    } else {
      container.innerHTML = '';
      leaderboard.forEach((item, index) => {
        const rankItem = document.createElement('div');
        rankItem.className = 'leaderboard-item';
        
        let rankClass = '';
        if (index === 0) rankClass = 'rank-1';
        else if (index === 1) rankClass = 'rank-2';
        else if (index === 2) rankClass = 'rank-3';
        
        rankItem.innerHTML = `
          <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-user">用户 ${item.userId.slice(-6)}</div>
            <div class="leaderboard-detail">完成 ${item.completedCount} 个挑战</div>
          </div>
          <div class="leaderboard-score">${item.totalScore}</div>
        `;
        
        container.appendChild(rankItem);
      });
    }
  } catch (error) {
    console.error('加载排行榜失败:', error);
    container.innerHTML = '<p class="empty-tip">加载失败</p>';
  }
  
  document.getElementById('leaderboard-modal').style.display = 'flex';
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });
  
  if (challengeMediaRecorder && challengeMediaRecorder.state === 'recording') {
    challengeMediaRecorder.stop();
  }
  
  if (challengeAudioUrl) {
    URL.revokeObjectURL(challengeAudioUrl);
    challengeAudioUrl = null;
  }
  challengeRecordedChunks = [];
}

function showMessage(text, type) {
  const messageEl = document.getElementById('message');
  if (!messageEl) {
    alert(text);
    return;
  }
  
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';
  
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

window.addEventListener('beforeunload', () => {
  cleanupMediaResources();
  cleanupRecordedData();
  
  if (aiAudioUrl) {
    URL.revokeObjectURL(aiAudioUrl);
  }
  if (challengeAudioUrl) {
    URL.revokeObjectURL(challengeAudioUrl);
  }
});
