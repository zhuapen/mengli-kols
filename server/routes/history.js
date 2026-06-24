/**
 * 生成历史路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

// 获取历史列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { gen_type, limit = 50 } = req.query;
    let query = 'SELECT * FROM generation_history WHERE user_id = $1 AND deleted_at IS NULL';
    const params = [req.user.id];

    if (gen_type && gen_type !== 'all') {
      query += ' AND gen_type = $2';
      params.push(gen_type);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(success({ history: result.rows }));
  } catch (e) {
    console.error('[history] 获取历史失败:', e.message);
    res.json(fail('获取历史失败'));
  }
});

// 创建历史记录
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { gen_type, input_params, output_content, rating, version, parent_id, root_id, original_content, operation_type } = req.body;

    const result = await pool.query(
      `INSERT INTO generation_history (user_id, gen_type, input_params, output_content, rating, version, parent_id, root_id, original_content, operation_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [req.user.id, gen_type, JSON.stringify(input_params), output_content, rating || null,
       version || 1, parent_id || null, root_id || null, original_content || null, operation_type || 'generate']
    );

    // 如果是 v1，设置 root_id 为自身
    if (!root_id && (!version || version === 1)) {
      await pool.query('UPDATE generation_history SET root_id = $1 WHERE id = $1', [result.rows[0].id]);
    }

    res.json(success({ id: result.rows[0].id }));
  } catch (e) {
    console.error('[history] 创建历史失败:', e.message);
    res.json(fail('创建失败'));
  }
});

// 更新评分
router.put('/:id/rating', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE generation_history SET rating = $1 WHERE id = $2 AND user_id = $3',
      [req.body.rating, req.params.id, req.user.id]
    );
    res.json(success());
  } catch (e) {
    console.error('[history] 更新评分失败:', e.message);
    res.json(fail('更新失败'));
  }
});

// 软删除
router.put('/:id/soft-delete', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE generation_history SET deleted_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json(success());
  } catch (e) {
    console.error('[history] 删除失败:', e.message);
    res.json(fail('删除失败'));
  }
});

// 获取高分案例
router.get('/high-rated', authMiddleware, async (req, res) => {
  try {
    const { gen_type = 'copywriting', limit = 3 } = req.query;
    const result = await pool.query(
      `SELECT * FROM generation_history
       WHERE user_id = $1 AND gen_type = $2 AND rating >= 4 AND deleted_at IS NULL
       ORDER BY rating DESC, created_at DESC LIMIT $3`,
      [req.user.id, gen_type, parseInt(limit)]
    );
    res.json(success({ examples: result.rows }));
  } catch (e) {
    console.error('[history] 获取高分案例失败:', e.message);
    res.json(fail('获取失败'));
  }
});

module.exports = router;
