/**
 * 统一响应格式
 */

function success(data = null, msg = 'success') {
  return { code: 0, msg, data };
}

function fail(msg = 'error', code = -1) {
  return { code, msg, data: null };
}

module.exports = { success, fail };
