/**
 * JWT 认证中间件
 */
const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'mengli-jwt-secret-2026';

/**
 * 验证 JWT token
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(fail('未登录'));
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json(fail('token 已过期，请重新登录'));
    }
    return res.status(401).json(fail('token 无效'));
  }
}

/**
 * 生成 JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
