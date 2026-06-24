/**
 * 偏好路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1 ORDER BY use_count DESC',
      [req.user.id]
    );
    res.json(success({ preferences: result.rows }));
  } catch (e) {
    console.error('[preferences] 获取偏好失败:', e.message);
    res.json(fail('获取失败'));
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { pref_key, pref_value } = req.body;
    await pool.query(
      `INSERT INTO user_preferences (user_id, pref_key, pref_value, use_count, last_used_at)
       VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (user_id, pref_key) DO UPDATE SET
         pref_value = $3, use_count = user_preferences.use_count + 1, last_used_at = NOW()`,
      [req.user.id, pref_key, pref_value]
    );
    res.json(success());
  } catch (e) {
    console.error('[preferences] 保存偏好失败:', e.message);
    res.json(fail('保存失败'));
  }
});

module.exports = router;
