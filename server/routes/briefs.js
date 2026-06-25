/**
 * Brief 分析路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

// 获取 Brief 列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = 'SELECT * FROM briefs WHERE user_id = $1';
    const params = [req.user.id];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(success({ briefs: result.rows }));
  } catch (e) {
    console.error('[briefs] 获取 Brief 列表失败:', e.message);
    res.json(fail('获取失败'));
  }
});

// 获取单个 Brief
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM briefs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.json(fail('Brief 不存在'));
    res.json(success(result.rows[0]));
  } catch (e) {
    console.error('[briefs] 获取 Brief 失败:', e.message);
    res.json(fail('获取失败'));
  }
});

// 创建 Brief
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { project_id, original_text } = req.body;
    if (!original_text) return res.json(fail('Brief 内容不能为空'));

    const result = await pool.query(
      `INSERT INTO briefs (project_id, user_id, original_text, status)
       VALUES ($1, $2, $3, 'draft') RETURNING id, created_at`,
      [project_id, req.user.id, original_text]
    );

    res.json(success(result.rows[0], 'Brief 已创建'));
  } catch (e) {
    console.error('[briefs] 创建 Brief 失败:', e.message);
    res.json(fail('创建失败'));
  }
});

// 更新 Brief 分析结果
router.put('/:id/analysis', authMiddleware, async (req, res) => {
  try {
    const { analysis } = req.body;
    await pool.query(
      'UPDATE briefs SET analysis = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(analysis), req.params.id]
    );
    res.json(success(null, '分析结果已更新'));
  } catch (e) {
    console.error('[briefs] 更新分析失败:', e.message);
    res.json(fail('更新失败'));
  }
});

// 确认 Brief
router.put('/:id/confirm', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      "UPDATE briefs SET status = 'confirmed', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );
    res.json(success(null, 'Brief 已确认'));
  } catch (e) {
    console.error('[briefs] 确认 Brief 失败:', e.message);
    res.json(fail('确认失败'));
  }
});

module.exports = router;
