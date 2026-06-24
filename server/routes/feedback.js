/**
 * 反馈路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(success({ feedback: result.rows }));
  } catch (e) {
    console.error('[feedback] 获取反馈失败:', e.message);
    res.json(fail('获取失败'));
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { history_id, gen_type, original_content, feedback_text, improved_content, changes_summary, learnings, rating } = req.body;
    await pool.query(
      `INSERT INTO feedback (user_id, history_id, gen_type, original_content, feedback_text, improved_content, changes_summary, learnings, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [req.user.id, history_id, gen_type, original_content, feedback_text, improved_content, changes_summary, learnings, rating]
    );
    res.json(success());
  } catch (e) {
    console.error('[feedback] 保存反馈失败:', e.message);
    res.json(fail('保存失败'));
  }
});

module.exports = router;
