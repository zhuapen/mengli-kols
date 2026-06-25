/**
 * 任务调度路由
 * 核心任务管理 API
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

// 创建任务
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, payload, priority } = req.body;
    if (!type) return res.json(fail('任务类型不能为空'));

    const result = await pool.query(
      `INSERT INTO tasks (type, payload, priority, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id, type, status, created_at`,
      [type, JSON.stringify(payload || {}), priority || 0]
    );

    res.json(success(result.rows[0], '任务已创建'));
  } catch (e) {
    console.error('[tasks] 创建任务失败:', e.message);
    res.json(fail('创建任务失败'));
  }
});

// 获取任务列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, type, limit = 50 } = req.query;
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(success({ tasks: result.rows }));
  } catch (e) {
    console.error('[tasks] 获取任务列表失败:', e.message);
    res.json(fail('获取任务列表失败'));
  }
});

// 获取单个任务
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.json(fail('任务不存在'));
    res.json(success(result.rows[0]));
  } catch (e) {
    console.error('[tasks] 获取任务失败:', e.message);
    res.json(fail('获取任务失败'));
  }
});

// Worker 轮询获取下一个任务（无需认证，通过 worker_id 识别）
router.get('/worker/next', async (req, res) => {
  try {
    const { worker_id, type } = req.query;
    if (!worker_id) return res.json(fail('缺少 worker_id'));

    // 更新 worker 状态
    await pool.query(
      `INSERT INTO workers (id, status, last_heartbeat)
       VALUES ($1, 'online', NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'online', last_heartbeat = NOW()`,
      [worker_id]
    );

    // 获取下一个待处理任务
    let query = `
      UPDATE tasks
      SET status = 'running', worker_id = $1, started_at = NOW()
      WHERE id = (
        SELECT id FROM tasks
        WHERE status = 'pending'
        ${type ? 'AND type = $2' : ''}
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;
    const params = type ? [worker_id, type] : [worker_id];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.json(success(null, '没有待处理任务'));
    }

    res.json(success(result.rows[0]));
  } catch (e) {
    console.error('[tasks] 获取任务失败:', e.message);
    res.json(fail('获取任务失败'));
  }
});

// Worker 提交任务结果
router.post('/:id/result', async (req, res) => {
  try {
    const { result, error, worker_id } = req.body;
    const taskId = req.params.id;

    if (error) {
      // 任务失败
      await pool.query(
        `UPDATE tasks
         SET status = 'failed', error = $1, finished_at = NOW(),
             retry_count = retry_count + 1
         WHERE id = $2`,
        [error, taskId]
      );
    } else {
      // 任务成功
      await pool.query(
        `UPDATE tasks
         SET status = 'done', result = $1, finished_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(result), taskId]
      );
    }

    res.json(success(null, '结果已提交'));
  } catch (e) {
    console.error('[tasks] 提交结果失败:', e.message);
    res.json(fail('提交结果失败'));
  }
});

// Worker 心跳
router.post('/worker/heartbeat', async (req, res) => {
  try {
    const { worker_id, status, capabilities } = req.body;
    if (!worker_id) return res.json(fail('缺少 worker_id'));

    await pool.query(
      `INSERT INTO workers (id, status, capabilities, last_heartbeat)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET status = $2, capabilities = $3, last_heartbeat = NOW()`,
      [worker_id, status || 'online', JSON.stringify(capabilities || [])]
    );

    res.json(success());
  } catch (e) {
    console.error('[tasks] 心跳失败:', e.message);
    res.json(fail('心跳失败'));
  }
});

// 获取 Worker 列表
router.get('/workers/list', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workers ORDER BY last_heartbeat DESC');
    res.json(success({ workers: result.rows }));
  } catch (e) {
    console.error('[tasks] 获取 Worker 列表失败:', e.message);
    res.json(fail('获取 Worker 列表失败'));
  }
});

module.exports = router;
