/**
 * 文件上传路由（COS）
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

// multer 配置（内存存储）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// COS 客户端（延迟初始化）
let cosClient = null;
function getCosClient() {
  if (cosClient) return cosClient;
  const COS = require('cos-nodejs-sdk-v5');
  cosClient = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY,
  });
  return cosClient;
}

// 上传图片
router.post('/image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json(fail('请选择文件'));
    }

    const ext = req.file.originalname.split('.').pop() || 'png';
    const filename = `${Date.now()}_${uuidv4().substring(0, 8)}.${ext}`;
    const key = `uploads/${filename}`;

    // 如果配置了 COS，上传到 COS
    if (process.env.COS_SECRET_ID && process.env.COS_BUCKET) {
      const cos = getCosClient();
      await cos.putObject({
        Bucket: process.env.COS_BUCKET,
        Region: process.env.COS_REGION,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });
      const url = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com/${key}`;
      return res.json(success({ url, filename }));
    }

    // 否则保存到本地
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
    res.json(success({ url: `/uploads/${filename}`, filename }));
  } catch (e) {
    console.error('[upload] 上传失败:', e.message);
    res.json(fail('上传失败'));
  }
});

module.exports = router;
