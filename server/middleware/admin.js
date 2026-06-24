/**
 * 管理员权限中间件
 */
const { fail } = require('../utils/response');

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json(fail('权限不足'));
  }
  next();
}

module.exports = { requireAdmin };
