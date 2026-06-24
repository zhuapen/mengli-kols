/**
 * 认证路由
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

// 注册
router.post('/register', async (req, res) => {
  try {
    const { email, password, display_name, position } = req.body;
    if (!email || !password || !display_name || !position) {
      return res.json(fail('请填写所有必填项'));
    }
    if (password.length < 6) {
      return res.json(fail('密码至少6位'));
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, display_name, position)
       VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, role, status`,
      [email, passwordHash, display_name, position]
    );

    res.json(success(result.rows[0], '注册成功，等待管理员审批'));
  } catch (e) {
    if (e.code === '23505') {
      return res.json(fail('该邮箱已被注册'));
    }
    console.error('[auth] 注册失败:', e.message);
    res.json(fail('注册失败'));
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json(fail('请输入邮箱和密码'));
    }

    const result = await pool.query(
      'SELECT * FROM user_profiles WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.json(fail('邮箱或密码错误'));
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.json(fail('账号已被禁用'));
    }

    if (user.status === 'pending') {
      return res.json(fail('账号正在审核中'));
    }

    if (user.status === 'rejected') {
      return res.json(fail('注册申请未通过审核'));
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.json(fail('邮箱或密码错误'));
    }

    const token = generateToken(user);

    res.json(success({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        status: user.status
      }
    }));
  } catch (e) {
    console.error('[auth] 登录失败:', e.message);
    res.json(fail('登录失败'));
  }
});

// 登出
router.post('/logout', authMiddleware, async (req, res) => {
  // JWT 无状态，前端删除 token 即可
  res.json(success(null, '已登出'));
});

// 获取当前用户
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, position, role, status, is_active, created_at FROM user_profiles WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json(fail('用户不存在'));
    }

    res.json(success(result.rows[0]));
  } catch (e) {
    console.error('[auth] 获取用户信息失败:', e.message);
    res.json(fail('获取用户信息失败'));
  }
});

// 更新个人信息
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { display_name, position } = req.body;
    await pool.query(
      'UPDATE user_profiles SET display_name = COALESCE($1, display_name), position = COALESCE($2, position), updated_at = NOW() WHERE id = $3',
      [display_name, position, req.user.id]
    );
    res.json(success(null, '更新成功'));
  } catch (e) {
    console.error('[auth] 更新个人信息失败:', e.message);
    res.json(fail('更新失败'));
  }
});

module.exports = router;
