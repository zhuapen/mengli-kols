/**
 * 品牌路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_brands WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(success({ brands: result.rows }));
  } catch (e) {
    console.error('[brands] 获取品牌失败:', e.message);
    res.json(fail('获取失败'));
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { id, name, description, tone, selling_points } = req.body;
    await pool.query(
      `INSERT INTO user_brands (id, user_id, name, description, tone, selling_points)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET name = $3, description = $4, tone = $5, selling_points = $6`,
      [id, req.user.id, name, description || '', tone || '', selling_points || '']
    );
    res.json(success());
  } catch (e) {
    console.error('[brands] 保存品牌失败:', e.message);
    res.json(fail('保存失败'));
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_brands WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json(success());
  } catch (e) {
    console.error('[brands] 删除品牌失败:', e.message);
    res.json(fail('删除失败'));
  }
});

module.exports = router;
