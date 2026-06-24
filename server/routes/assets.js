/**
 * 素材路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_assets WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(success({ assets: result.rows }));
  } catch (e) {
    console.error('[assets] 获取素材失败:', e.message);
    res.json(fail('获取失败'));
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, title, content } = req.body;
    await pool.query(
      'INSERT INTO user_assets (user_id, type, title, content) VALUES ($1, $2, $3, $4)',
      [req.user.id, type, title, content]
    );
    res.json(success());
  } catch (e) {
    console.error('[assets] 保存素材失败:', e.message);
    res.json(fail('保存失败'));
  }
});

router.put('/:id/rating', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE user_assets SET rating = $1 WHERE id = $2 AND user_id = $3',
      [req.body.rating, req.params.id, req.user.id]
    );
    res.json(success());
  } catch (e) {
    console.error('[assets] 更新评分失败:', e.message);
    res.json(fail('更新失败'));
  }
});

router.delete('/batch', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    await pool.query(
      'DELETE FROM user_assets WHERE id = ANY($1) AND user_id = $2',
      [ids, req.user.id]
    );
    res.json(success());
  } catch (e) {
    console.error('[assets] 删除素材失败:', e.message);
    res.json(fail('删除失败'));
  }
});

module.exports = router;
