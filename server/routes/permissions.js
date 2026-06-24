/**
 * 权限路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

// 获取所有功能定义
router.get('/features', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM feature_permissions ORDER BY id');
    res.json(success(result.rows));
  } catch (e) {
    console.error('[permissions] 获取功能列表失败:', e.message);
    res.json(fail('获取失败'));
  }
});

// 获取当前用户权限
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT feature_key FROM user_feature_permissions WHERE user_id = $1',
      [req.user.id]
    );
    res.json(success({ permissions: result.rows.map(r => r.feature_key) }));
  } catch (e) {
    console.error('[permissions] 获取权限失败:', e.message);
    res.json(fail('获取失败'));
  }
});

module.exports = router;
