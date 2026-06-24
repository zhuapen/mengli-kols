/**
 * 密码哈希工具（bcrypt）
 */
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  // 兼容旧的 pbkdf2 格式
  if (hash.startsWith('$pbkdf2$')) {
    return verifyPbkdf2(password, hash);
  }
  return bcrypt.compare(password, hash);
}

// 兼容旧的 PBKDF2 格式
const crypto = require('crypto');

function verifyPbkdf2(password, hash) {
  try {
    const parts = hash.split('$');
    const salt = parts[2];
    const storedDigest = parts[3];
    const digest = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return digest === storedDigest;
  } catch (e) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
