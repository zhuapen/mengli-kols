/**
 * 模板路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_templates WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(success({ templates: result.rows }));
  } catch (e) {
    console.error('[templates] 获取模板失败:', e.message);
    res.json(fail('获取失败'));
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { id, name, prompt, size } = req.body;
    await pool.query(
      `INSERT INTO user_templates (id, user_id, name, prompt, size)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET name = $3, prompt = $4, size = $5`,
      [id, req.user.id, name, prompt || '', size || '1024x1024']
    );
    res.json(success());
  } catch (e) {
    console.error('[templates] 保存模板失败:', e.message);
    res.json(fail('保存失败'));
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_templates WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json(success());
  } catch (e) {
    console.error('[templates] 删除模板失败:', e.message);
    res.json(fail('删除失败'));
  }
});

module.exports = router;
