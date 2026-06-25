/**
 * KOL 数据路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

// 获取 KOL 列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { platform, limit = 100, offset = 0, search } = req.query;
    let query = 'SELECT * FROM kols WHERE 1=1';
    const params = [];

    if (platform) {
      params.push(platform);
      query += ` AND platform = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND name ILIKE $${params.length}`;
    }

    query += ` ORDER BY followers DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(success({ kols: result.rows }));
  } catch (e) {
    console.error('[kols] 获取 KOL 列表失败:', e.message);
    res.json(fail('获取失败'));
  }
});

// 获取单个 KOL
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM kols WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.json(fail('KOL 不存在'));
    res.json(success(result.rows[0]));
  } catch (e) {
    console.error('[kols] 获取 KOL 失败:', e.message);
    res.json(fail('获取失败'));
  }
});

// 创建/更新 KOL
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { platform, name, avatar, followers, engagement_rate, price_range, tags, metrics } = req.body;

    const result = await pool.query(
      `INSERT INTO kols (platform, name, avatar, followers, engagement_rate, price_range, tags, metrics)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, avatar = $3, followers = $4, engagement_rate = $5,
         price_range = $6, tags = $7, metrics = $8, updated_at = NOW()
       RETURNING id`,
      [platform, name, avatar, followers, engagement_rate, price_range,
       JSON.stringify(tags || {}), JSON.stringify(metrics || {})]
    );

    res.json(success({ id: result.rows[0].id }));
  } catch (e) {
    console.error('[kols] 创建 KOL 失败:', e.message);
    res.json(fail('创建失败'));
  }
});

// 批量导入 KOL
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { kols } = req.body;
    if (!Array.isArray(kols) || kols.length === 0) return res.json(fail('KOL 列表为空'));

    let imported = 0;
    for (const kol of kols) {
      await pool.query(
        `INSERT INTO kols (platform, name, avatar, followers, engagement_rate, price_range, tags, metrics, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [kol.platform, kol.name, kol.avatar, kol.followers, kol.engagement_rate,
         kol.price_range, JSON.stringify(kol.tags || {}), JSON.stringify(kol.metrics || {}),
         kol.source || 'import']
      );
      imported++;
    }

    res.json(success({ imported }, `成功导入 ${imported} 个 KOL`));
  } catch (e) {
    console.error('[kols] 批量导入失败:', e.message);
    res.json(fail('导入失败'));
  }
});

module.exports = router;
