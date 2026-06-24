/**
 * 插件反馈路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { success, fail } = require('../utils/response');

// 获取所有反馈（管理员）
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plugin_feedback ORDER BY created_at DESC');
    res.json(success({ feedback: result.rows }));
  } catch (e) {
    console.error('[plugin-feedback] 获取反馈失败:', e.message);
    res.json(fail('获取失败'));
  }
});

// 提交反馈（公开）
router.post('/', async (req, res) => {
  try {
    const { plugin_id, user_id, user_name, feedback_type, content, images } = req.body;
    await pool.query(
      `INSERT INTO plugin_feedback (plugin_id, user_id, user_name, feedback_type, content, images)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [plugin_id, user_id || null, user_name || '匿名用户', feedback_type || 'bug', content, images || null]
    );
    res.json(success(null, '反馈已提交'));
  } catch (e) {
    console.error('[plugin-feedback] 提交反馈失败:', e.message);
    res.json(fail('提交失败'));
  }
});

// 更新反馈状态（管理员）
router.put('/:id/status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE plugin_feedback SET status = $1 WHERE id = $2', [req.body.status, req.params.id]);
    res.json(success());
  } catch (e) {
    console.error('[plugin-feedback] 更新状态失败:', e.message);
    res.json(fail('更新失败'));
  }
});

// 删除反馈（管理员）
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM plugin_feedback WHERE id = $1', [req.params.id]);
    res.json(success());
  } catch (e) {
    console.error('[plugin-feedback] 删除反馈失败:', e.message);
    res.json(fail('删除失败'));
  }
});

module.exports = router;
