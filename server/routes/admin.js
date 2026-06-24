/**
 * 管理员路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { hashPassword } = require('../utils/password');
const { success, fail } = require('../utils/response');

// 获取所有用户
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, position, role, status, is_active, created_at FROM user_profiles ORDER BY created_at DESC'
    );
    res.json(success({ users: result.rows }));
  } catch (e) {
    console.error('[admin] 获取用户列表失败:', e.message);
    res.json(fail('获取用户列表失败'));
  }
});

// 创建用户
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { email, password, display_name, position } = req.body;
    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, display_name, position, status, is_active)
       VALUES ($1, $2, $3, $4, 'approved', true) RETURNING id, email, display_name, role, status`,
      [email, passwordHash, display_name, position]
    );

    // 授予所有权限
    const features = await pool.query('SELECT feature_key FROM feature_permissions');
    for (const f of features.rows) {
      await pool.query(
        'INSERT INTO user_feature_permissions (user_id, feature_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [result.rows[0].id, f.feature_key]
      );
    }

    res.json(success(result.rows[0], '用户创建成功'));
  } catch (e) {
    if (e.code === '23505') return res.json(fail('邮箱已存在'));
    console.error('[admin] 创建用户失败:', e.message);
    res.json(fail('创建用户失败'));
  }
});

// 审批用户
router.put('/users/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'UPDATE user_profiles SET status = $1, approved_at = NOW(), approved_by = $2 WHERE id = $3',
      ['approved', req.user.id, req.params.id]
    );

    // 授予所有权限
    const features = await pool.query('SELECT feature_key FROM feature_permissions');
    for (const f of features.rows) {
      await pool.query(
        'INSERT INTO user_feature_permissions (user_id, feature_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, f.feature_key]
      );
    }

    res.json(success(null, '已审批'));
  } catch (e) {
    console.error('[admin] 审批失败:', e.message);
    res.json(fail('审批失败'));
  }
});

// 拒绝用户
router.put('/users/:id/reject', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE user_profiles SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
    res.json(success(null, '已拒绝'));
  } catch (e) {
    console.error('[admin] 拒绝失败:', e.message);
    res.json(fail('操作失败'));
  }
});

// 切换用户状态
router.put('/users/:id/toggle', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE user_profiles SET is_active = NOT is_active WHERE id = $1 RETURNING is_active',
      [req.params.id]
    );
    res.json(success({ is_active: result.rows[0].is_active }));
  } catch (e) {
    console.error('[admin] 切换状态失败:', e.message);
    res.json(fail('操作失败'));
  }
});

// 删除用户
router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_profiles WHERE id = $1', [req.params.id]);
    res.json(success(null, '已删除'));
  } catch (e) {
    console.error('[admin] 删除用户失败:', e.message);
    res.json(fail('删除失败'));
  }
});

// 更新用户权限
router.put('/users/:id/permissions', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { permissions } = req.body;
    // 先删除旧权限
    await pool.query('DELETE FROM user_feature_permissions WHERE user_id = $1', [req.params.id]);
    // 再添加新权限
    for (const key of permissions) {
      await pool.query(
        'INSERT INTO user_feature_permissions (user_id, feature_key) VALUES ($1, $2)',
        [req.params.id, key]
      );
    }
    res.json(success(null, '权限已更新'));
  } catch (e) {
    console.error('[admin] 更新权限失败:', e.message);
    res.json(fail('更新权限失败'));
  }
});

// 获取用户权限
router.get('/users/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT feature_key FROM user_feature_permissions WHERE user_id = $1',
      [req.params.id]
    );
    res.json(success({ permissions: result.rows.map(r => r.feature_key) }));
  } catch (e) {
    console.error('[admin] 获取权限失败:', e.message);
    res.json(fail('获取权限失败'));
  }
});

// 管理员日志
router.post('/log', authMiddleware, async (req, res) => {
  try {
    const { action, target, details } = req.body;
    await pool.query(
      'INSERT INTO admin_logs (admin_id, admin_name, action, target, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, req.user.email, action, target || '', details || '']
    );
    res.json(success());
  } catch (e) {
    console.error('[admin] 记录日志失败:', e.message);
    res.json(fail('记录失败'));
  }
});

module.exports = router;
