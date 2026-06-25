/**
 * 萌力互动 · Node.js API 服务器
 * Express + PostgreSQL + JWT + COS
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== 中间件 =====

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true,
}));

// Body 解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件（本地上传）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== 路由 =====

app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/permissions', require('./routes/permissions'));
app.use('/history', require('./routes/history'));
app.use('/assets', require('./routes/assets'));
app.use('/brands', require('./routes/brands'));
app.use('/templates', require('./routes/templates'));
app.use('/preferences', require('./routes/preferences'));
app.use('/feedback', require('./routes/feedback'));
app.use('/plugins', require('./routes/plugins'));
app.use('/plugin-feedback', require('./routes/plugin-feedback'));
app.use('/upload', require('./routes/upload'));

// 任务调度系统路由
app.use('/tasks', require('./routes/tasks'));
app.use('/briefs', require('./routes/briefs'));
app.use('/kols', require('./routes/kols'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', runtime: 'node.js' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: -1, msg: 'Not Found', data: null });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[server] 未捕获错误:', err.message);
  res.status(500).json({ code: -1, msg: '服务器内部错误', data: null });
});

// ===== 启动 =====

app.listen(PORT, () => {
  console.log(`[server] 萌力互动 API 已启动: http://localhost:${PORT}`);
  console.log(`[server] 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[server] 数据库: ${process.env.DATABASE_URL ? '已配置' : '❌ 未配置'}`);
  console.log(`[server] COS: ${process.env.COS_SECRET_ID ? '已配置' : '未配置（使用本地存储）'}`);
});
