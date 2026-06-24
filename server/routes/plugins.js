/**
 * 插件路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { success, fail } = require('../utils/response');

// 获取插件列表（公开）
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plugins ORDER BY created_at DESC');
    res.json(success({ plugins: result.rows }));
  } catch (e) {
    console.error('[plugins] 获取插件失败:', e.message);
    res.json(fail('获取失败'));
  }
});

// 获取单个插件（公开）
router.get('/:id', async (req, res) => {
  try {
    const plugin = await pool.query('SELECT * FROM plugins WHERE id = $1', [req.params.id]);
    if (plugin.rows.length === 0) return res.json(fail('插件不存在'));

    const changelog = await pool.query(
      'SELECT * FROM plugin_changelog WHERE plugin_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json(success({ ...plugin.rows[0], changelog: changelog.rows }));
  } catch (e) {
    console.error('[plugins] 获取插件详情失败:', e.message);
    res.json(fail('获取失败'));
  }
});

// 创建插件（管理员）
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, icon, version, short_desc, description, platforms, install_guide, known_issues, download_url } = req.body;
    const result = await pool.query(
      `INSERT INTO plugins (name, icon, version, short_desc, description, platforms, install_guide, known_issues, download_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [name, icon || '🔌', version || '1.0', short_desc || '', description || '', platforms || '', install_guide || '', known_issues || '', download_url || '#']
    );
    res.json(success({ id: result.rows[0].id }));
  } catch (e) {
    console.error('[plugins] 创建插件失败:', e.message);
    res.json(fail('创建失败'));
  }
});

// 更新插件（管理员）
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, icon, version, short_desc, description, platforms, install_guide, known_issues, download_url } = req.body;
    await pool.query(
      `UPDATE plugins SET name = $1, icon = $2, version = $3, short_desc = $4, description = $5,
       platforms = $6, install_guide = $7, known_issues = $8, download_url = $9, updated_at = NOW()
       WHERE id = $10`,
      [name, icon, version, short_desc, description, platforms, install_guide, known_issues, download_url, req.params.id]
    );
    res.json(success());
  } catch (e) {
    console.error('[plugins] 更新插件失败:', e.message);
    res.json(fail('更新失败'));
  }
});

// 删除插件（管理员）
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM plugins WHERE id = $1', [req.params.id]);
    res.json(success());
  } catch (e) {
    console.error('[plugins] 删除插件失败:', e.message);
    res.json(fail('删除失败'));
  }
});

// 增加下载计数（公开）
router.put('/:id/download', async (req, res) => {
  try {
    await pool.query('UPDATE plugins SET downloads = downloads + 1 WHERE id = $1', [req.params.id]);
    res.json(success());
  } catch (e) {
    console.error('[plugins] 更新下载计数失败:', e.message);
    res.json(fail('更新失败'));
  }
});

module.exports = router;
