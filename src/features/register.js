/**
 * 萌力互动 · 注册模块
 * 从 app.js 提取
 */

export function showRegisterModal() {
  document.getElementById('registerModal').classList.add('show');
}

export function closeRegisterModal() {
  document.getElementById('registerModal').classList.remove('show');
  document.getElementById('registerError').textContent = '';
  document.getElementById('regEmail').value = '';
  document.getElementById('regPassword').value = '';
  document.getElementById('regName').value = '';
  document.getElementById('regPosition').value = '';
}

export async function handleRegister(event) {
  event.preventDefault();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const name = document.getElementById('regName').value.trim();
  const position = document.getElementById('regPosition').value.trim();
  const errorEl = document.getElementById('registerError');
  const btn = document.getElementById('regSubmitBtn');

  if (!email || !password || !name || !position) {
    errorEl.textContent = '请填写所有必填项（邮箱、密码、姓名、岗位）';
    return;
  }
  if (typeof validator !== 'undefined' && !validator.isEmail(email)) {
    errorEl.textContent = '请输入有效的邮箱地址';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = '密码至少6位';
    return;
  }

  const safeName = typeof validator !== 'undefined' ? validator.escape(name) : name.replace(/[<>&"']/g, '');
  const safePosition = typeof validator !== 'undefined' ? validator.escape(position) : position.replace(/[<>&"']/g, '');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = '提交中...';

  try {
    await apiClient.ai.createUser({
      email, password,
      display_name: safeName,
      position: safePosition,
      status: 'pending'
    });
    try { showToast('注册申请已提交，请等待管理员审核'); } catch (e) { alert('注册申请已提交，请等待管理员审核'); }
    closeRegisterModal();
  } catch (e) {
    let errMsg = e.message || '注册失败';
    if (errMsg.includes('already been registered') || errMsg.includes('already registered')) {
      errMsg = '该邮箱已被注册，请直接登录或换一个邮箱';
    } else if (errMsg.includes('valid email')) {
      errMsg = '请输入有效的邮箱地址';
    } else if (errMsg.includes('password') && errMsg.includes('6')) {
      errMsg = '密码至少需要6位';
    } else if (errMsg.includes('rate limit')) {
      errMsg = '注册请求过于频繁，请稍后再试';
    }
    errorEl.textContent = '注册失败：' + errMsg;
  }

  btn.disabled = false;
  btn.textContent = '提交注册';
}

// 暴露到全局（过渡期兼容）
window.showRegisterModal = showRegisterModal;
window.closeRegisterModal = closeRegisterModal;
window.handleRegister = handleRegister;
