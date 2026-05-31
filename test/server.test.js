const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

let app;
let server;
let baseUrl;

const TEST_PORT = 3099;
const TEST_AUDIO_DIR = path.join(os.tmpdir(), 'dialect-test-audio-' + Date.now());
const TEST_DATA_DIR = path.join(os.tmpdir(), 'dialect-test-data-' + Date.now());

function createTestApp() {
  const express = require('express');
  const multer = require('multer');
  const cors = require('cors');
  
  const testApp = express();
  
  testApp.use(cors());
  testApp.use(express.json());
  
  if (!fs.existsSync(TEST_AUDIO_DIR)) {
    fs.mkdirSync(TEST_AUDIO_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  
  const TEST_RECORDINGS_FILE = path.join(TEST_DATA_DIR, 'recordings.json');
  
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, TEST_AUDIO_DIR);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname) || '.webm';
      cb(null, `recording_${timestamp}${ext}`);
    }
  });
  
  const upload = multer({ storage });
  
  const dialects = [
    { id: 'beijing', name: '北京话' },
    { id: 'shanghai', name: '上海话' }
  ];
  
  const examples = {
    beijing: [
      { id: 'bj1', text: '今天天气真好' }
    ],
    shanghai: [
      { id: 'sh1', text: '侬好呀' }
    ]
  };
  
  function loadRecordings() {
    if (!fs.existsSync(TEST_RECORDINGS_FILE)) {
      return [];
    }
    try {
      return JSON.parse(fs.readFileSync(TEST_RECORDINGS_FILE, 'utf-8'));
    } catch {
      return [];
    }
  }
  
  function saveRecordings(recordings) {
    fs.writeFileSync(TEST_RECORDINGS_FILE, JSON.stringify(recordings, null, 2));
  }
  
  testApp.get('/api/dialects', (req, res) => {
    res.json(dialects);
  });
  
  testApp.get('/api/examples/:dialectId', (req, res) => {
    const { dialectId } = req.params;
    if (examples[dialectId]) {
      res.json(examples[dialectId]);
    } else {
      res.status(404).json({ error: '方言不存在' });
    }
  });
  
  testApp.get('/api/recordings', (req, res) => {
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
  
  testApp.post('/api/recordings', upload.single('audio'), (req, res) => {
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
  
  testApp.post('/api/recordings/:id/rate', (req, res) => {
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
  
  return testApp;
}

test.describe('服务器 API 测试', () => {
  
  test.before(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(TEST_AUDIO_DIR)) {
      fs.rmSync(TEST_AUDIO_DIR, { recursive: true, force: true });
    }
    app = createTestApp();
    server = http.createServer(app);
    return new Promise((resolve) => {
      server.listen(TEST_PORT, () => {
        baseUrl = `http://localhost:${TEST_PORT}`;
        resolve();
      });
    });
  });
  
  test.after(() => {
    return new Promise((resolve) => {
      server.close(() => {
        if (fs.existsSync(TEST_DATA_DIR)) {
          fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
        }
        if (fs.existsSync(TEST_AUDIO_DIR)) {
          fs.rmSync(TEST_AUDIO_DIR, { recursive: true, force: true });
        }
        resolve();
      });
    });
  });
  
  test.describe('方言和例句 API', () => {
    
    test('GET /api/dialects 应该返回方言列表', async () => {
      const response = await fetch(`${baseUrl}/api/dialects`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 2);
      assert.strictEqual(data[0].id, 'beijing');
      assert.strictEqual(data[0].name, '北京话');
    });
    
    test('GET /api/examples/:dialectId 应该返回对应方言的例句', async () => {
      const response = await fetch(`${baseUrl}/api/examples/beijing`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'bj1');
      assert.strictEqual(data[0].text, '今天天气真好');
    });
    
    test('GET /api/examples/:dialectId 对于不存在的方言应该返回404', async () => {
      const response = await fetch(`${baseUrl}/api/examples/unknown`);
      assert.strictEqual(response.status, 404);
    });
  });
  
  test.describe('录音上传 API', () => {
    
    test('POST /api/recordings 应该成功上传录音', async () => {
      const formData = new FormData();
      const audioBlob = new Blob(['test audio content'], { type: 'audio/webm' });
      formData.append('audio', audioBlob, 'test.webm');
      formData.append('dialectId', 'beijing');
      formData.append('dialectName', '北京话');
      formData.append('exampleId', 'bj1');
      formData.append('exampleText', '今天天气真好');
      
      const response = await fetch(`${baseUrl}/api/recordings`, {
        method: 'POST',
        body: formData
      });
      
      assert.strictEqual(response.status, 201);
      
      const data = await response.json();
      assert.ok(data.id);
      assert.strictEqual(data.dialectId, 'beijing');
      assert.strictEqual(data.exampleId, 'bj1');
      assert.ok(data.audioUrl);
      assert.ok(data.filename);
      assert.deepStrictEqual(data.ratings, []);
      assert.strictEqual(data.averageRating, 0);
    });
    
    test('POST /api/recordings 没有音频文件应该返回400', async () => {
      const formData = new FormData();
      formData.append('dialectId', 'beijing');
      formData.append('exampleId', 'bj1');
      
      const response = await fetch(`${baseUrl}/api/recordings`, {
        method: 'POST',
        body: formData
      });
      
      assert.strictEqual(response.status, 400);
    });
    
    test('POST /api/recordings 缺少参数应该返回400', async () => {
      const formData = new FormData();
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });
      formData.append('audio', audioBlob, 'test.webm');
      
      const response = await fetch(`${baseUrl}/api/recordings`, {
        method: 'POST',
        body: formData
      });
      
      assert.strictEqual(response.status, 400);
    });
  });
  
  test.describe('录音列表 API', () => {
    
    test('GET /api/recordings 应该返回所有录音', async () => {
      const response = await fetch(`${baseUrl}/api/recordings`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.ok(Array.isArray(data));
      assert.ok(data.length >= 1);
    });
    
    test('GET /api/recordings 可以按方言筛选', async () => {
      const response = await fetch(`${baseUrl}/api/recordings?dialect=beijing`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      data.forEach(r => {
        assert.strictEqual(r.dialectId, 'beijing');
      });
    });
  });
  
  test.describe('评分机制', () => {
    let testRecordingId;
    
    test.before(async () => {
      const formData = new FormData();
      const audioBlob = new Blob(['rating test audio'], { type: 'audio/webm' });
      formData.append('audio', audioBlob, 'rating-test.webm');
      formData.append('dialectId', 'shanghai');
      formData.append('dialectName', '上海话');
      formData.append('exampleId', 'sh1');
      formData.append('exampleText', '侬好呀');
      
      const response = await fetch(`${baseUrl}/api/recordings`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      testRecordingId = data.id;
    });
    
    test('POST /api/recordings/:id/rate 应该成功评分', async () => {
      const response = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 4 })
      });
      
      assert.strictEqual(response.status, 200);
      
      const data = await response.json();
      assert.strictEqual(data.ratings.length, 1);
      assert.strictEqual(data.ratings[0].rating, 4);
      assert.strictEqual(data.averageRating, 4);
    });
    
    test('评分1分应该正常工作', async () => {
      const response = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 1 })
      });
      
      assert.strictEqual(response.status, 200);
      
      const data = await response.json();
      assert.strictEqual(data.ratings.length, 2);
      assert.strictEqual(data.averageRating, 2.5);
    });
    
    test('评分5分应该正常工作', async () => {
      const response = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 5 })
      });
      
      assert.strictEqual(response.status, 200);
      
      const data = await response.json();
      assert.strictEqual(data.ratings.length, 3);
      assert.strictEqual(data.averageRating, (4 + 1 + 5) / 3);
    });
    
    test('评分0分应该返回400', async () => {
      const response = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 0 })
      });
      
      assert.strictEqual(response.status, 400);
    });
    
    test('评分6分应该返回400', async () => {
      const response = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 6 })
      });
      
      assert.strictEqual(response.status, 400);
    });
    
    test('相同用户不能重复评分（带userId）', async () => {
      const firstResponse = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 5, userId: 'user-123' })
      });
      
      assert.strictEqual(firstResponse.status, 200);
      
      const secondResponse = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 5, userId: 'user-123' })
      });
      
      assert.strictEqual(secondResponse.status, 400);
      const data = await secondResponse.json();
      assert.ok(data.error.includes('已经'));
    });
    
    test('不同用户可以正常评分', async () => {
      const firstResponse = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 5, userId: 'user-456' })
      });
      
      assert.strictEqual(firstResponse.status, 200);
      
      const secondResponse = await fetch(`${baseUrl}/api/recordings/${testRecordingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 5, userId: 'user-789' })
      });
      
      assert.strictEqual(secondResponse.status, 200);
    });
    
    test('对不存在的录音评分应该返回404', async () => {
      const response = await fetch(`${baseUrl}/api/recordings/non-existent-id/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: 3 })
      });
      
      assert.strictEqual(response.status, 404);
    });
  });
  
  test.describe('评分防刷机制', () => {
    
    test('多次评分应该正确计算平均分', async () => {
      const formData = new FormData();
      const audioBlob = new Blob(['avg test audio'], { type: 'audio/webm' });
      formData.append('audio', audioBlob, 'avg-test.webm');
      formData.append('dialectId', 'beijing');
      formData.append('dialectName', '北京话');
      formData.append('exampleId', 'bj1');
      formData.append('exampleText', '今天天气真好');
      
      const createResponse = await fetch(`${baseUrl}/api/recordings`, {
        method: 'POST',
        body: formData
      });
      
      const created = await createResponse.json();
      
      const ratings = [5, 4, 3, 5, 4];
      const expectedAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      
      for (const rating of ratings) {
        await fetch(`${baseUrl}/api/recordings/${created.id}/rate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rating })
        });
      }
      
      const finalResponse = await fetch(`${baseUrl}/api/recordings`);
      const allRecordings = await finalResponse.json();
      const finalRecording = allRecordings.find(r => r.id === created.id);
      
      assert.strictEqual(finalRecording.ratings.length, 5);
      assert.strictEqual(finalRecording.averageRating, expectedAvg);
    });
  });
});
