const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/audio', express.static('audio'));

const AUDIO_DIR = path.join(__dirname, 'audio');
const DATA_DIR = path.join(__dirname, 'data');
const RECORDINGS_FILE = path.join(DATA_DIR, 'recordings.json');
const CHALLENGES_FILE = path.join(DATA_DIR, 'challenges.json');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AUDIO_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `recording_${timestamp}${ext}`);
  }
});

const upload = multer({ storage });

const dialects = [
  { id: 'beijing', name: '北京话', region: '华北', lat: 39.9042, lng: 116.4074, color: '#FF6B6B' },
  { id: 'shanghai', name: '上海话', region: '华东', lat: 31.2304, lng: 121.4737, color: '#4ECDC4' },
  { id: 'guangdong', name: '广东话', region: '华南', lat: 23.1291, lng: 113.2644, color: '#45B7D1' },
  { id: 'sichuan', name: '四川话', region: '西南', lat: 30.5728, lng: 104.0668, color: '#96CEB4' },
  { id: 'shaanxi', name: '陕西话', region: '西北', lat: 34.3416, lng: 108.9398, color: '#DDA0DD' }
];

const examples = {
  beijing: [
    { id: 'bj1', text: '今天天气真好，我们出去玩吧！', pinyin: 'jīn tiān tiān qì zhēn hǎo, wǒ men chū qù wán ba！' },
    { id: 'bj2', text: '您吃了吗？这是北京人常说的问候语。', pinyin: 'nín chī le ma？zhè shì běi jīng rén cháng shuō de wèn hòu yǔ。' },
    { id: 'bj3', text: '您瞧好了，我这就给您露一手。', pinyin: 'nín qiáo hǎo le, wǒ zhè jiù gěi nín lòu yī shǒu。' }
  ],
  shanghai: [
    { id: 'sh1', text: '侬好呀，今朝天气老好额！', pinyin: 'nóng hǎo ya, jīn zhāo tiān qì lǎo hǎo é！' },
    { id: 'sh2', text: '谢谢侬，再会！', pinyin: 'xiè xie nóng, zài huì！' },
    { id: 'sh3', text: '额勿晓得啦，侬去问问伊好了。', pinyin: 'é wù xiǎo de la, nóng qù wèn wèn yī hǎo le。' }
  ],
  guangdong: [
    { id: 'gd1', text: '你好，今日天气好好！', pinyin: 'néi hóu, gām yàt tīn héi hóu hóu！' },
    { id: 'gd2', text: '多谢你，再见！', pinyin: 'dō ze néi, zoi gin！' },
    { id: 'gd3', text: '我唔知啊，你去问佢啦。', pinyin: 'ngóh m zī ā, néi heoi man kéoi lā。' }
  ],
  sichuan: [
    { id: 'sc1', text: '今天天气安逸得很，我们出去耍嘛！', pinyin: 'jīn tiān tiān qì ān yì de hěn, wǒ men chū qù shuǎ ma！' },
    { id: 'sc2', text: '你吃了吗？巴适得板！', pinyin: 'nǐ chī le ma？bā shì de bǎn！' },
    { id: 'sc3', text: '我晓得了，你说得对。', pinyin: 'wǒ xiǎo dé le, nǐ shuō dé duì。' }
  ],
  shaanxi: [
    { id: 'sx1', text: '今天天气美滴很，咱们出去逛一逛！', pinyin: 'jīn tiān tiān qì měi dī hěn, zán men chū qù guàng yī guàng！' },
    { id: 'sx2', text: '你吃了么？咥一碗油泼面！', pinyin: 'nǐ chī le mo？dié yī wǎn yóu pō miàn！' },
    { id: 'sx3', text: '我知道咧，你说得对。', pinyin: 'wǒ zhī dào lie, nǐ shuō dé duì。' }
  ]
};

const aiEvaluationTemplates = {
  pronunciation: [
    '发音非常标准，语调自然流畅！',
    '整体发音不错，注意有些字的声母需要更清晰。',
    '声调掌握得很好，建议多练习儿化音。',
    '方言特色表现到位，继续保持！',
    '咬字清晰，语速适中，表现优秀！'
  ],
  suggestions: [
    '建议多听本地音频，模仿当地人的语调。',
    '可以尝试放慢语速，让每个字更饱满。',
    '注意轻声和重音的区分。',
    '多练习连读，让说话更自然。',
    '可以录制更长的句子来提升连贯性。'
  ],
  improvement: [
    '声母发音需要加强练习。',
    '声调变化可以更明显一些。',
    '语速可以适当调整。',
    '方言特色词汇可以更地道。',
    '整体表现很好，继续加油！'
  ]
};

const challenges = [
  {
    id: 'daily_tongue',
    name: '日常绕口令',
    description: '挑战方言绕口令，看谁说得又快又准！',
    difficulty: 'medium',
    reward: 100,
    examples: {
      beijing: { text: '出东门，过大桥，大桥底下一树枣。', hint: '注意儿化音和连读' },
      shanghai: { text: '七巷一个漆匠，西巷一个锡匠。', hint: '注意平翘舌区分' },
      guangdong: { text: '各个国家有各个国家的国歌。', hint: '注意入声字的短促' },
      sichuan: { text: '四是四，十是十，十四是十四。', hint: '注意平翘舌' },
      shaanxi: { text: '扁担长，板凳宽，扁担绑在板凳上。', hint: '注意前后鼻音' }
    }
  },
  {
    id: 'classic_lines',
    name: '经典台词',
    description: '用方言演绎电影经典台词！',
    difficulty: 'easy',
    reward: 50,
    examples: {
      beijing: { text: '曾经有一份真挚的爱情摆在我面前。', hint: '带点京味儿的调侃' },
      shanghai: { text: '做人最重要的就是开心。', hint: '上海话的温柔语气' },
      guangdong: { text: '做人如果冇梦想，同条咸鱼有乜分别？', hint: '地道粤语表达' },
      sichuan: { text: '巴适得板！安逸得很！', hint: '四川话的豪迈' },
      shaanxi: { text: '美滴很！撩咋咧！', hint: '陕西话的直爽' }
    }
  },
  {
    id: 'proverb_challenge',
    name: '谚语达人',
    description: '用方言说谚语，感受方言智慧！',
    difficulty: 'hard',
    reward: 150,
    examples: {
      beijing: { text: '不听老人言，吃亏在眼前。', hint: '地道北京腔' },
      shanghai: { text: '路遥知马力，日久见人心。', hint: '上海话的沉稳' },
      guangdong: { text: '有志者事竟成。', hint: '粤语的铿锵有力' },
      sichuan: { text: '吃不穷，穿不穷，不会打算一世穷。', hint: '四川话的韵味' },
      shaanxi: { text: '三百六十行，行行出状元。', hint: '陕西话的厚重' }
    }
  },
  {
    id: 'foodie_speak',
    name: '美食家',
    description: '用方言介绍当地美食，让人流口水！',
    difficulty: 'medium',
    reward: 80,
    examples: {
      beijing: { text: '北京烤鸭，外酥里嫩，那叫一个香！', hint: '北京人的自豪' },
      shanghai: { text: '小笼包皮薄馅大，汤汁鲜美！', hint: '上海话的细腻' },
      guangdong: { text: '早茶点心，一盅两件，人生几何！', hint: '广东人的悠闲' },
      sichuan: { text: '火锅麻辣烫，巴适得板！', hint: '四川人的火辣' },
      shaanxi: { text: '肉夹馍配凉皮，嘹咋咧！', hint: '陕西人的实在' }
    }
  }
];

function loadRecordings() {
  if (!fs.existsSync(RECORDINGS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(RECORDINGS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveRecordings(recordings) {
  fs.writeFileSync(RECORDINGS_FILE, JSON.stringify(recordings, null, 2));
}

function loadChallengesProgress() {
  if (!fs.existsSync(CHALLENGES_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(CHALLENGES_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveChallengesProgress(progress) {
  fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(progress, null, 2));
}

function getDialectStats() {
  const recordings = loadRecordings();
  const stats = {};
  
  dialects.forEach(d => {
    stats[d.id] = {
      ...d,
      count: 0,
      avgRating: 0,
      totalRatings: 0
    };
  });
  
  recordings.forEach(r => {
    if (stats[r.dialectId]) {
      stats[r.dialectId].count++;
      if (r.averageRating > 0) {
        stats[r.dialectId].totalRatings += r.averageRating;
      }
    }
  });
  
  Object.keys(stats).forEach(id => {
    if (stats[id].count > 0) {
      stats[id].avgRating = stats[id].totalRatings / stats[id].count;
    }
  });
  
  return Object.values(stats);
}

function generateAIEvaluation(text, dialectId) {
  const randomIndex = () => Math.floor(Math.random() * 5);
  
  const overallScore = Math.floor(Math.random() * 30) + 70;
  const pronunciationScore = Math.floor(Math.random() * 30) + 70;
  const toneScore = Math.floor(Math.random() * 30) + 70;
  const fluencyScore = Math.floor(Math.random() * 30) + 70;
  const dialectScore = Math.floor(Math.random() * 30) + 70;
  
  const comment = aiEvaluationTemplates.pronunciation[randomIndex()];
  const suggestions = [
    aiEvaluationTemplates.suggestions[randomIndex()],
    aiEvaluationTemplates.suggestions[randomIndex()]
  ].filter((v, i, a) => a.indexOf(v) === i);
  
  const improvements = [
    aiEvaluationTemplates.improvement[randomIndex()],
    aiEvaluationTemplates.improvement[randomIndex()]
  ].filter((v, i, a) => a.indexOf(v) === i);
  
  let level = '入门';
  if (overallScore >= 90) level = '方言达人';
  else if (overallScore >= 80) level = '熟练';
  else if (overallScore >= 70) level = '进阶';
  
  return {
    overallScore,
    level,
    scores: {
      pronunciation: pronunciationScore,
      tone: toneScore,
      fluency: fluencyScore,
      dialect: dialectScore
    },
    comment,
    suggestions,
    improvements,
    dialect: dialects.find(d => d.id === dialectId)?.name || '未知方言'
  };
}

app.get('/api/dialects', (req, res) => {
  res.json(dialects);
});

app.get('/api/examples/:dialectId', (req, res) => {
  const { dialectId } = req.params;
  if (examples[dialectId]) {
    res.json(examples[dialectId]);
  } else {
    res.status(404).json({ error: '方言不存在' });
  }
});

app.get('/api/recordings', (req, res) => {
  const { dialect, example } = req.query;
  let recordings = loadRecordings();
  
  if (dialect) {
    recordings = recordings.filter(r => r.dialectId === dialect);
  }
  if (example) {
    recordings = recordings.filter(r => r.exampleId === example);
  }
  
  res.json(recordings);
});

app.post('/api/recordings', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传音频文件' });
  }
  
  const { dialectId, exampleId, exampleText, dialectName } = req.body;
  
  if (!dialectId || !exampleId) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const recording = {
    id: Date.now().toString(),
    dialectId,
    exampleId,
    exampleText,
    dialectName,
    filename: req.file.filename,
    audioUrl: `/audio/${req.file.filename}`,
    createdAt: new Date().toISOString(),
    ratings: [],
    averageRating: 0
  };
  
  const recordings = loadRecordings();
  recordings.push(recording);
  saveRecordings(recordings);
  
  res.status(201).json(recording);
});

app.post('/api/recordings/:id/rate', (req, res) => {
  const { id } = req.params;
  const { rating, userId } = req.body;
  
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: '评分必须在1-5之间' });
  }
  
  const recordings = loadRecordings();
  const recording = recordings.find(r => r.id === id);
  
  if (!recording) {
    return res.status(404).json({ error: '录音不存在' });
  }
  
  if (userId) {
    const existingRating = recording.ratings.find(r => r.userId === userId);
    if (existingRating) {
      return res.status(400).json({ error: '您已经对该录音评过分了' });
    }
  }
  
  const newRating = {
    rating: Number(rating),
    createdAt: new Date().toISOString()
  };
  
  if (userId) {
    newRating.userId = userId;
  }
  
  recording.ratings.push(newRating);
  
  const total = recording.ratings.reduce((sum, r) => sum + r.rating, 0);
  recording.averageRating = total / recording.ratings.length;
  
  saveRecordings(recordings);
  
  res.json(recording);
});

app.get('/api/map/stats', (req, res) => {
  const stats = getDialectStats();
  res.json({
    dialects: stats,
    totalRecordings: stats.reduce((sum, s) => sum + s.count, 0)
  });
});

app.post('/api/ai/evaluate', upload.single('audio'), (req, res) => {
  const { dialectId, text } = req.body;
  
  if (!dialectId || !text) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  setTimeout(() => {
    const evaluation = generateAIEvaluation(text, dialectId);
    res.json(evaluation);
  }, 1500);
});

app.get('/api/challenges', (req, res) => {
  const { dialectId } = req.query;
  let availableChallenges = challenges;
  
  if (dialectId) {
    availableChallenges = challenges.filter(c => c.examples[dialectId]);
  }
  
  res.json(availableChallenges.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    difficulty: c.difficulty,
    reward: c.reward
  })));
});

app.get('/api/challenges/:id', (req, res) => {
  const { id } = req.params;
  const { dialectId } = req.query;
  
  const challenge = challenges.find(c => c.id === id);
  
  if (!challenge) {
    return res.status(404).json({ error: '挑战不存在' });
  }
  
  if (dialectId && !challenge.examples[dialectId]) {
    return res.status(404).json({ error: '该挑战不支持此方言' });
  }
  
  const result = {
    id: challenge.id,
    name: challenge.name,
    description: challenge.description,
    difficulty: challenge.difficulty,
    reward: challenge.reward
  };
  
  if (dialectId) {
    result.example = challenge.examples[dialectId];
  }
  
  res.json(result);
});

app.post('/api/challenges/:id/submit', upload.single('audio'), (req, res) => {
  const { id } = req.params;
  const { dialectId, userId } = req.body;
  
  if (!dialectId) {
    return res.status(400).json({ error: '缺少方言参数' });
  }
  
  const challenge = challenges.find(c => c.id === id);
  
  if (!challenge) {
    return res.status(404).json({ error: '挑战不存在' });
  }
  
  if (!challenge.examples[dialectId]) {
    return res.status(400).json({ error: '该挑战不支持此方言' });
  }
  
  const score = Math.floor(Math.random() * 30) + 70;
  
  let stars = 1;
  if (score >= 90) stars = 3;
  else if (score >= 80) stars = 2;
  
  const progress = loadChallengesProgress();
  const userKey = userId || 'guest';
  
  if (!progress[userKey]) {
    progress[userKey] = {
      totalScore: 0,
      completedChallenges: [],
      history: []
    };
  }
  
  const userProgress = progress[userKey];
  const isFirstTime = !userProgress.completedChallenges.includes(id);
  
  const reward = isFirstTime ? challenge.reward : Math.floor(challenge.reward / 2);
  
  userProgress.totalScore += reward;
  if (isFirstTime) {
    userProgress.completedChallenges.push(id);
  }
  userProgress.history.push({
    challengeId: id,
    dialectId,
    score,
    stars,
    reward,
    completedAt: new Date().toISOString()
  });
  
  saveChallengesProgress(progress);
  
  res.json({
    success: true,
    score,
    stars,
    reward,
    isFirstTime,
    totalScore: userProgress.totalScore,
    comment: score >= 90 ? '太棒了！方言达人！' : 
             score >= 80 ? '表现不错，继续加油！' : 
             '还需要多多练习哦！'
  });
});

app.get('/api/user/progress', (req, res) => {
  const { userId } = req.query;
  const userKey = userId || 'guest';
  const progress = loadChallengesProgress();
  
  res.json(progress[userKey] || {
    totalScore: 0,
    completedChallenges: [],
    history: []
  });
});

app.get('/api/leaderboard', (req, res) => {
  const progress = loadChallengesProgress();
  const leaderboard = Object.entries(progress)
    .map(([userId, data]) => ({
      userId,
      totalScore: data.totalScore,
      completedCount: data.completedChallenges.length,
      lastActive: data.history.length > 0 
        ? data.history[data.history.length - 1].completedAt 
        : null
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10);
  
  res.json(leaderboard);
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
