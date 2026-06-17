// ========== REGISTER ==========
function showRegisterModal(){
  document.getElementById('registerModal').classList.add('show');
}
function closeRegisterModal(){
  document.getElementById('registerModal').classList.remove('show');
  document.getElementById('registerError').textContent = '';
  document.getElementById('regEmail').value = '';
  document.getElementById('regPassword').value = '';
  document.getElementById('regName').value = '';
  document.getElementById('regPosition').value = '';
}

async function handleRegister(event){
  event.preventDefault();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const name = document.getElementById('regName').value.trim();
  const position = document.getElementById('regPosition').value.trim();
  const errorEl = document.getElementById('registerError');
  const btn = document.getElementById('regSubmitBtn');

  if(!email || !password || !name || !position){
    errorEl.textContent = '请填写所有必填项（邮箱、密码、姓名、岗位）';
    return;
  }
  // 邮箱格式校验（兼容 validator 未加载的情况）
  if(typeof validator !== 'undefined' && !validator.isEmail(email)){
    errorEl.textContent = '请输入有效的邮箱地址';
    return;
  }
  if(password.length < 6){
    errorEl.textContent = '密码至少6位';
    return;
  }

  // 净化输入（兼容 validator 未加载的情况）
  const safeName = typeof validator !== 'undefined' ? validator.escape(name) : name.replace(/[<>&"']/g, '');
  const safePosition = typeof validator !== 'undefined' ? validator.escape(position) : position.replace(/[<>&"']/g, '');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = '提交中...';

  try {
    const resp = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_user',
        email, password,
        display_name: safeName,
        position: safePosition,
        status: 'pending'
      })
    });
    const result = await resp.json();

    if(result.error){
      errorEl.textContent = '注册失败：' + result.error;
    } else {
      try { showToast('注册申请已提交，请等待管理员审核'); } catch(e) { alert('注册申请已提交，请等待管理员审核'); }
      closeRegisterModal();
    }
  } catch(e){
    errorEl.textContent = '注册失败：' + e.message;
  }

  btn.disabled = false;
  btn.textContent = '提交注册';
}

// ========== TOAST NOTIFICATION (Notyf) ==========
let notyf = null;
try {
  notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    types: [
      { type: 'success', background: '#10B981', icon: { className: 'notyf__icon', tagName: 'span', text: '✓' } },
      { type: 'error', background: '#EF4444', icon: { className: 'notyf__icon', tagName: 'span', text: '✗' } },
      { type: 'warning', background: '#F59E0B', icon: { className: 'notyf__icon', tagName: 'span', text: '⚠' } }
    ]
  });
} catch(e) { console.warn('Notyf 加载失败，使用 fallback:', e); }

function showToast(msg, type){
  if(notyf){
    if(type === 'error') notyf.error(msg);
    else if(type === 'warning') notyf.open({ type:'warning', message:msg });
    else notyf.success(msg);
  } else {
    // fallback: 简单 alert
    alert(msg);
  }
}

// ========== MARKDOWN RENDERER ==========
function renderMarkdown(text){
  if(!text) return '';
  try {
    if(typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined'){
      const html = marked.parse(text, { breaks:true, gfm:true });
      return DOMPurify.sanitize(html);
    }
  } catch(e) { console.warn('Markdown 渲染失败，使用纯文本:', e); }
  // fallback: 转义 HTML 后返回
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 保存原始文本供复制使用
let _lastCopyText = '';
let _lastArticleText = '';

// ========== SECURITY HELPERS ==========
function escapeHtml(str){
  if(!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isValidImageUrl(url){
  if(!url) return false;
  if(url.startsWith('data:')){
    return /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(url);
  }
  try {
    const u = new URL(url, location.href);
    return ['http:','https:','blob:'].includes(u.protocol);
  } catch(e) {
    return false;
  }
}

// ========== ERROR HELPER ==========
function getApiErrorMessage(e, data){
  if(e){
    if(e.name === 'TypeError' && e.message.includes('fetch')) return '网络连接失败，请检查网络后重试';
    if(e.name === 'AbortError' || e.message.includes('timeout')) return '请求超时，服务器繁忙，请稍后重试';
    if(e.message.includes('Failed to fetch')) return '网络连接失败，请检查网络';
    if(e.message.includes('500')) return '服务器内部错误，请稍后重试';
    if(e.message.includes('502') || e.message.includes('503')) return '服务暂时不可用，请稍后重试';
    return '请求失败：' + (e.message || '未知错误');
  }
  if(data && data.error){
    const err = data.error;
    if(err.includes('API key') || err.includes('Unauthorized') || err.includes('401')) return 'API Key 未配置或已过期，请联系管理员';
    if(err.includes('quota') || err.includes('429') || err.includes('rate')) return '当前使用人数较多，请稍后再试';
    if(err.includes('timeout') || err.includes('timed out')) return 'AI 生成超时，请缩短内容后重试';
    if(err.includes('content_policy') || err.includes('safety')) return '内容触发安全限制，请修改描述后重试';
    if(err.includes('权限') || err.includes('permission')) return '权限不足，请联系管理员开通';
    return err;
  }
  return '生成失败，请稍后重试';
}

// ========== DATA ==========
const XHS_DATA = [
  {name:"小羊咩咩",id:"xiaoyangmeme",followers:8.5,tags:["母婴","好物分享"],persona:"新手宝妈",engagement:3.2,price_img:2000,price_video:3500,contact:"微信: xiaoyang888",avatar:"🐑"},
  {name:"辣妈CC",id:"lamacc",followers:15.2,tags:["母婴","育儿"],persona:"二胎妈妈",engagement:2.8,price_img:5000,price_video:8000,contact:"微信: ccmom666",avatar:"👩‍👧"},
  {name:"贝贝日记",id:"beibei_diary",followers:6.8,tags:["母婴","辅食"],persona:"营养师宝妈",engagement:4.1,price_img:1500,price_video:2800,contact:"小红书私信",avatar:"🍼"},
  {name:"豆豆妈妈",id:"doudoumama",followers:22.1,tags:["母婴","穿搭"],persona:"时尚宝妈",engagement:1.9,price_img:8000,price_video:12000,contact:"微信: doudou520",avatar:"👗"},
  {name:"童趣盒子",id:"tongqu_box",followers:4.2,tags:["母婴","玩具"],persona:"早教老师",engagement:5.6,price_img:1200,price_video:2000,contact:"小红书私信",avatar:"🧸"},
  {name:"护肤达人Lily",id:"lily_skincare",followers:32.6,tags:["美妆","护肤"],persona:"成分党",engagement:1.5,price_img:15000,price_video:25000,contact:"微信: lilybeauty",avatar:"💄"},
  {name:"美妆测评室",id:"beauty_lab",followers:18.3,tags:["美妆","测评"],persona:"专业测评",engagement:2.3,price_img:7000,price_video:11000,contact:"小红书私信",avatar:"🧪"},
  {name:"吃货小分队",id:"food_squad",followers:55.8,tags:["美食","探店"],persona:"美食博主",engagement:2.1,price_img:20000,price_video:35000,contact:"微信: yummy888",avatar:"🍜"},
  {name:"厨房小白进阶",id:"kitchen_newbie",followers:3.1,tags:["美食","教程"],persona:"新手厨师",engagement:6.2,price_img:800,price_video:1500,contact:"微信: cook123",avatar:"🍳"},
  {name:"穿搭日记",id:"outfit_diary",followers:42.1,tags:["穿搭","时尚"],persona:"时尚博主",engagement:1.7,price_img:12000,price_video:20000,contact:"微信: outfit888",avatar:"👠"},
  {name:"健身小王",id:"fit_king_wang",followers:28.3,tags:["健身","运动"],persona:"健身教练",engagement:2.5,price_img:6000,price_video:10000,contact:"微信: fitwang666",avatar:"💪"},
  {name:"旅行喵",id:"travel_cat_meow",followers:12.7,tags:["旅游","探店"],persona:"旅行博主",engagement:3.8,price_img:4000,price_video:7000,contact:"小红书私信",avatar:"✈️"},
  {name:"数码控老张",id:"digital_zhang",followers:9.4,tags:["数码","测评"],persona:"数码极客",engagement:4.3,price_img:3500,price_video:6000,contact:"微信: digizhang",avatar:"📱"},
  {name:"家有萌宠",id:"cute_pets_home",followers:38.9,tags:["宠物","日常"],persona:"宠物博主",engagement:3.5,price_img:9000,price_video:15000,contact:"微信: petlover99",avatar:"🐶"},
  {name:"柚柚成长记",id:"youyou_grow",followers:10.5,tags:["母婴","亲子"],persona:"全职妈妈",engagement:3.5,price_img:3000,price_video:5000,contact:"微信: youyoumm",avatar:"👶"},
];

const DOUYIN_DATA = [
  {name:"疯狂小杨哥",id:"crazy_yang",followers:999.9,tags:["搞笑","剧情"],persona:"搞笑剧情达人",avg_plays:"5000万+",completion:62,likes_avg:"120万",shares_avg:"8.5万",engagement_dy:4.8,price_oral:350000,price_植入:500000,price_custom:800000,fans_profile:"18-35岁 男62% 新一线城市",avatar:"😂"},
  {name:"李佳琦Austin",id:"lijiaqi",followers:850.2,tags:["美妆","带货"],persona:"顶流带货主播",avg_plays:"2000万+",completion:55,likes_avg:"85万",shares_avg:"12万",engagement_dy:5.2,price_oral:500000,price_植入:800000,price_custom:1200000,fans_profile:"22-35岁 女78% 一二线城市",avatar:"💋"},
  {name:"痞幼",id:"piyou_official",followers:320.5,tags:["颜值","机车"],persona:"机车女神",avg_plays:"800万+",completion:48,likes_avg:"42万",shares_avg:"3.2万",engagement_dy:4.2,price_oral:180000,price_植入:250000,price_custom:400000,fans_profile:"18-30岁 男72%",avatar:"🏍️"},
  {name:"张同学",id:"zhang_tongxue",followers:180.3,tags:["三农","日常"],persona:"乡村生活记录者",avg_plays:"600万+",completion:71,likes_avg:"38万",shares_avg:"6.8万",engagement_dy:5.5,price_oral:80000,price_植入:120000,price_custom:200000,fans_profile:"25-45岁 男女均衡 下沉城市",avatar:"🏡"},
  {name:"小八美食",id:"xiaoba_food",followers:65.8,tags:["美食","教程"],persona:"家常菜达人",avg_plays:"200万+",completion:68,likes_avg:"12万",shares_avg:"4.5万",engagement_dy:5.8,price_oral:35000,price_植入:55000,price_custom:90000,fans_profile:"25-40岁 女65% 家庭用户",avatar:"🍲"},
];

// ========== STATE ==========
let currentPage = 'home';
let currentPlatform = 'xhs';
let activeTag = null;
let cart = JSON.parse(localStorage.getItem('kols_cart') || '[]');
let assets = JSON.parse(localStorage.getItem('menlil_assets') || '[]');
let currentAssetTab = 'all';
let assetsPage = 1;
const ASSETS_PER_PAGE = 20;

function getData(){ return currentPlatform==='xhs' ? XHS_DATA : DOUYIN_DATA; }

// ========== RECENT RESULT CACHE (sessionStorage) ==========
function saveRecentResult(type, data){
  try { sessionStorage.setItem('gen_' + type, JSON.stringify(data)); } catch(e){}
}

function restoreRecentResults(){
  // 恢复图片
  try {
    const img = JSON.parse(sessionStorage.getItem('gen_image') || 'null');
    if(img && img.url && isValidImageUrl(img.url)){
      const el = document.getElementById('imgResult');
      const ph = document.getElementById('imgPlaceholder');
      const tb = document.getElementById('imgToolbar');
      el.onerror = () => { sessionStorage.removeItem('gen_image'); el.style.display = 'none'; ph.style.display = 'block'; };
      el.src = img.url;
      el.style.display = 'block';
      ph.style.display = 'none';
      if(tb) tb.classList.add('show');
    }
  } catch(e){}
  // 恢复文案
  try {
    const copy = JSON.parse(sessionStorage.getItem('gen_copy') || 'null');
    if(copy && copy.text){
      const out = document.getElementById('copyOutput');
      _lastCopyText = copy.text;
      out.innerHTML = renderMarkdown(copy.text);
      out.className = 'copy-output';
      document.getElementById('copyRetry').style.display = 'inline-flex';
    }
  } catch(e){}
  // 恢复写稿
  try {
    const article = JSON.parse(sessionStorage.getItem('gen_article') || 'null');
    if(article && article.text){
      const out = document.getElementById('articleOutput');
      _lastArticleText = article.text;
      out.innerHTML = renderMarkdown(article.text);
      out.className = 'article-output';
      document.getElementById('articleRetry').style.display = 'inline-flex';
    }
  } catch(e){}
}

// ========== PAGE NAVIGATION ==========
function showPage(page){
  // 检查页面权限（首页始终允许）
  if (page !== 'home' && typeof hasPermission === 'function' && !hasPermission(page)) {
    showUpgradePrompt(page);
    return;
  }

  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1)).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.nav-link[data-page="${page}"]`).classList.add('active');

  if(page === 'find'){
    initFilters();
    render();
  }
  if(page === 'assets'){
    loadAssets().then(() => renderAssets());
  }
  if(page === 'history'){
    renderHistory();
  }
  if(page === 'plugin'){
    initPluginPage();
  }
}

// ========== FILTERS ==========
function getAvailableTags(){
  const tags = new Set();
  getData().forEach(k => k.tags.forEach(t => tags.add(t)));
  return [...tags].sort();
}

function initFilters(){
  const row = document.getElementById('filterRow');
  const tags = getAvailableTags();
  const isXHS = currentPlatform === 'xhs';

  let html = `<input type="text" class="filter-input" id="searchInput" placeholder="搜索..." style="width:180px" oninput="render()">`;
  html += '<div class="filter-sep"></div>';
  tags.forEach(tag => {
    html += `<button class="filter-chip tag-chip" data-tag="${tag}" onclick="toggleTag(this,'${tag}')">${tag}</button>`;
  });
  html += '<div class="filter-sep"></div>';
  html += `<span class="filter-label">报价 ≤</span><input type="number" class="filter-input" id="priceMax" placeholder="不限" style="width:100px" onchange="render()">`;
  html += `<span class="filter-label">粉丝 ≤</span><input type="number" class="filter-input" id="followerMax" placeholder="不限" style="width:100px" onchange="render()">`;
  html += `<select class="filter-select" id="engFilter" onchange="render()">
    <option value="">全部互动率</option>
    <option value="high">≥ 3%</option>
    <option value="mid">2%-3%</option>
    <option value="low">&lt; 2%</option>
  </select>`;

  row.innerHTML = html;
}

function toggleTag(btn, tag){
  document.querySelectorAll('.tag-chip').forEach(b => b.classList.remove('active'));
  if(activeTag === tag) activeTag = null;
  else { activeTag = tag; btn.classList.add('active'); }
  render();
}

// ========== RENDER ==========
function render(){
  const data = getData();
  const isXHS = currentPlatform === 'xhs';
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const priceMax = parseInt(document.getElementById('priceMax')?.value) || 99999999;
  const followerMax = parseFloat(document.getElementById('followerMax')?.value) || 9999;
  const engFilter = document.getElementById('engFilter')?.value || '';

  let filtered = data.filter(k => {
    if(search && !k.name.toLowerCase().includes(search) && !k.id.toLowerCase().includes(search) && !k.persona.toLowerCase().includes(search)) return false;
    if(activeTag && !k.tags.includes(activeTag)) return false;
    const lowestPrice = isXHS ? Math.min(k.price_img, k.price_video) : Math.min(k.price_oral, k.price_植入||k.price_oral, k.price_custom||k.price_oral);
    if(lowestPrice > priceMax) return false;
    if(k.followers > followerMax) return false;
    const eng = isXHS ? k.engagement : k.engagement_dy;
    if(engFilter === 'high' && eng < 3) return false;
    if(engFilter === 'mid' && (eng < 2 || eng >= 3)) return false;
    if(engFilter === 'low' && eng >= 2) return false;
    return true;
  });

  const thead = document.getElementById('tableHead');
  if(isXHS){
    thead.innerHTML = `<tr><th>达人</th><th>粉丝</th><th>标签</th><th>人设</th><th>互动率</th><th>图文报价</th><th>视频报价</th><th>联系方式</th><th>操作</th></tr>`;
  } else {
    thead.innerHTML = `<tr><th>达人</th><th>粉丝</th><th>标签</th><th>人设</th><th>播放量</th><th>完播率</th><th>互动率</th><th>口播报价</th><th>植入报价</th><th>操作</th></tr>`;
  }

  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');

  if(filtered.length === 0){
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = filtered.map(k => {
      const inCart = cart.includes(k.id);
      const eng = isXHS ? k.engagement : k.engagement_dy;
      const engClass = eng >= 4 ? 'high' : eng >= 2.5 ? 'mid' : 'low';

      if(isXHS){
        return `<tr>
          <td><div class="kol-name"><div class="kol-avatar">${k.avatar||'👤'}</div><div class="kol-info"><div class="name">${k.name}</div><div class="id">@${k.id}</div></div></div></td>
          <td><span class="follower-num">${fmtFollowers(k.followers)}</span></td>
          <td>${k.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</td>
          <td>${k.persona}</td>
          <td><span class="eng ${engClass}">${k.engagement}%</span></td>
          <td class="price">¥${k.price_img.toLocaleString()}</td>
          <td class="price">¥${k.price_video.toLocaleString()}</td>
          <td style="font-size:12px;color:var(--gray-400)">${k.contact}</td>
          <td><button class="add-btn ${inCart?'added':''}" onclick="toggleCart('${k.id}')">${inCart?'已加入':'加入'}</button></td>
        </tr>`;
      } else {
        return `<tr>
          <td><div class="kol-name"><div class="kol-avatar">${k.avatar||'👤'}</div><div class="kol-info"><div class="name">${k.name}</div><div class="id">@${k.id}</div></div></div></td>
          <td><span class="follower-num">${fmtFollowers(k.followers)}</span></td>
          <td>${k.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</td>
          <td>${k.persona}</td>
          <td style="font-weight:600">${k.avg_plays}</td>
          <td><span class="eng ${k.completion>=60?'high':'mid'}">${k.completion}%</span></td>
          <td><span class="eng ${engClass}">${k.engagement_dy}%</span></td>
          <td class="price">¥${(k.price_oral/10000).toFixed(1)}<small>万</small></td>
          <td class="price">¥${(k.price_植入/10000).toFixed(1)}<small>万</small></td>
          <td><button class="add-btn ${inCart?'added':''}" onclick="toggleCart('${k.id}')">${inCart?'已加入':'加入'}</button></td>
        </tr>`;
      }
    }).join('');
  }

  updateCartBadge();
}

function fmtFollowers(n){
  if(n >= 10000) return (n/10000).toFixed(1)+'万';
  if(n >= 1000) return (n/1000).toFixed(1)+'k';
  return n.toString();
}

// ========== CART ==========
function toggleCart(id){
  const idx = cart.indexOf(id);
  if(idx >= 0) cart.splice(idx,1);
  else cart.push(id);
  localStorage.setItem('kols_cart', JSON.stringify(cart));
  render();
  if(document.getElementById('cartSidebar').classList.contains('open')) renderCartSidebar();
}

function openCart(){
  document.getElementById('cartSidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  renderCartSidebar();
}
function closeCart(){
  document.getElementById('cartSidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function renderCartSidebar(){
  const body = document.getElementById('cartBody');
  const allData = [...XHS_DATA, ...DOUYIN_DATA];
  const items = cart.map(id => allData.find(d => d.id === id)).filter(Boolean);

  if(items.length===0){
    body.innerHTML = '<div class="empty-state"><div class="icon">🛒</div><h3>询单车是空的</h3></div>';
  } else {
    body.innerHTML = items.map(item => {
      const isXHS = XHS_DATA.includes(item);
      const price = isXHS ? `图文¥${item.price_img.toLocaleString()} / 视频¥${item.price_video.toLocaleString()}` : `口播¥${(item.price_oral/10000).toFixed(1)}万`;
      return `<div class="cart-item">
        <div><div class="name">${item.name}</div><div class="meta">${fmtFollowers(item.followers)}粉丝 · ${item.tags.join(' / ')} · ${price}</div></div>
        <button class="remove" onclick="toggleCart('${item.id}')">移除</button>
      </div>`;
    }).join('');
  }

  const total = items.reduce((sum,item)=>{
    const isXHS = XHS_DATA.includes(item);
    if(isXHS) return sum + Math.round((item.price_img+item.price_video)/2);
    return sum + item.price_oral;
  }, 0);

  document.getElementById('cartTotal').textContent = '¥'+total.toLocaleString();
  document.getElementById('cartItemCount').textContent = items.length;
}

function submitInquiry(){
  if(cart.length===0) return showToast('请先添加达人', 'warning');
  showToast(`已向 ${cart.length} 位达人发起询单`);
  cart = [];
  localStorage.setItem('kols_cart', JSON.stringify(cart));
  closeCart();
  render();
}

function updateCartBadge(){
  document.getElementById('cartBadge').textContent = cart.length;
}

// ========== AI SEARCH ==========
async function aiSearch(){
  // 检查权限
  if (!hasPermission('search')) {
    showUpgradePrompt('search');
    return;
  }

  const input = document.getElementById('aiInput');
  const query = input.value.trim();
  if(!query) return;

  const btn = document.getElementById('aiBtn');
  btn.disabled = true; btn.textContent = '思考中...';
  document.getElementById('aiResult').style.display = 'none';

  try{
    const resp = await fetch('/api', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'kol_search', query, platform: currentPlatform })
    });
    const data = await resp.json();

    document.getElementById('searchInput').value = data.search || '';
    if(data.tags){
      const t = data.tags.split(',')[0].trim();
      document.querySelectorAll('.tag-chip').forEach(b => b.classList.toggle('active', b.dataset.tag === t));
      activeTag = t;
    }
    document.getElementById('priceMax').value = data.maxPrice >= 999999 ? '' : data.maxPrice;
    document.getElementById('followerMax').value = data.maxFollowers >= 9999 ? '' : data.maxFollowers;

    if(data.minEngagement){
      const eng = data.minEngagement;
      const sel = document.getElementById('engFilter');
      if(eng >= 3) sel.value = 'high';
      else if(eng >= 2) sel.value = 'mid';
      else sel.value = 'low';
    } else {
      document.getElementById('engFilter').value = '';
    }

    const result = document.getElementById('aiResult');
    result.style.display = 'block';
    result.innerHTML = renderMarkdown(data.explanation || 'AI 已帮你筛选好了');
    render();
  } catch(e){
    const result = document.getElementById('aiResult');
    result.style.display = 'block';
    result.textContent = '搜索失败：' + getApiErrorMessage(e);
  }

  btn.disabled = false; btn.textContent = 'AI 搜索';
}

// ========== IMAGE GEN ==========
let imgSize = '1024x1024';
let imgMode = 'text2img';
let img2imgFiles = []; // base64 数组，最多3张

// Mask editor state
let maskEditorOpen = false;
let maskCanvas, maskCtx;
let maskDrawing = false;
let maskTool = 'brush';       // 'brush' | 'eraser'
let maskBrushSize = 30;
let maskHistory = [];          // 撤销栈（ImageData 快照）
let maskImageData = null;      // 当前遮罩的 ImageData（与原图同尺寸）
let maskOriginalImg = null;    // 当前编辑的原图 Image 对象
let maskLastX = null, maskLastY = null; // 笔触插值用

function setImgSize(size, btn){
  imgSize = size;
  document.querySelectorAll('.gen-size-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function switchImgMode(mode, btn){
  imgMode = mode;
  document.querySelectorAll('.gen-mode-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('text2imgSection').style.display = mode === 'text2img' ? 'block' : 'none';
  document.getElementById('img2imgSection').style.display = mode === 'img2img' ? 'block' : 'none';
}

function handleImgUpload(event){
  const files = Array.from(event.target.files);
  if(!files.length) return;
  processImgFiles(files);
  event.target.value = '';
}

// 通用图片文件处理（点击上传 & 拖拽上传共用）
function processImgFiles(files){
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if(!imageFiles.length) return;
  const remaining = 3 - img2imgFiles.length;
  if(remaining <= 0){ showToast('最多上传3张图片', 'warning'); return; }
  const toAdd = imageFiles.slice(0, remaining);
  let loaded = 0;
  toAdd.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e){
      img2imgFiles.push(e.target.result);
      loaded++;
      if(loaded === toAdd.length) renderImg2imgGrid();
    };
    reader.readAsDataURL(file);
  });
}

// 拖拽上传
function initDragDrop(){
  const zone = document.getElementById('imgUpload');
  if(!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    processImgFiles(files);
  });
}

function renderImg2imgGrid(){
  const grid = document.getElementById('img2imgGrid');
  const upload = document.getElementById('imgUpload');
  grid.innerHTML = img2imgFiles.map((b64, i) =>
    `<div class="img2img-thumb"><img src="${b64}"><button class="remove-btn" onclick="removeImg2img(${i})">×</button></div>`
  ).join('');
  upload.style.display = img2imgFiles.length >= 3 ? 'none' : '';

  // 有参考图时显示局部重绘入口
  const maskEntry = document.getElementById('maskEntry');
  if (maskEntry) {
    maskEntry.style.display = img2imgFiles.length > 0 ? 'flex' : 'none';
    if (img2imgFiles.length === 0) {
      maskImageData = null;
      window._maskBase64 = null;
      document.getElementById('maskStatus').textContent = '未设置遮罩';
      document.getElementById('maskStatus').className = 'mask-entry-hint';
    }
  }
}

function removeImg2img(index){
  img2imgFiles.splice(index, 1);
  renderImg2imgGrid();
}

// ========== MASK EDITOR (双层 Canvas 架构) ==========
// 底层 maskBaseCanvas: 原图（只读，永远不变）
// 顶层 maskCanvas:     遮罩层（透明底 + 红色笔触，橡皮擦直接 clearRect）

function openMaskEditor(){
  if(!img2imgFiles.length){ showToast('请先上传参考图片', 'warning'); return; }
  const baseCanvas = document.getElementById('maskBaseCanvas');
  const baseCtx = baseCanvas.getContext('2d');
  maskCanvas = document.getElementById('maskCanvas');
  maskCtx = maskCanvas.getContext('2d');

  const img = new Image();
  img.onload = function(){
    // 两层 canvas 尺寸均 = 原图尺寸（API 要求 mask 与原图一致）
    baseCanvas.width = img.naturalWidth;
    baseCanvas.height = img.naturalHeight;
    maskCanvas.width = img.naturalWidth;
    maskCanvas.height = img.naturalHeight;
    maskOriginalImg = img;

    // 底层绘制原图
    baseCtx.drawImage(img, 0, 0);

    // 如果已有遮罩数据，恢复到遮罩层
    if(maskImageData){
      maskCtx.putImageData(maskImageData, 0, 0);
    }

    // 同步两层 canvas 的显示尺寸（CSS 缩放）
    syncMaskCanvasDisplaySize();

    maskHistory = [];
    saveMaskSnapshot();

    maskEditorOpen = true;
    document.getElementById('maskEditor').classList.add('show');
    updateMaskCoverage();
  };
  img.src = img2imgFiles[0];
}

function syncMaskCanvasDisplaySize(){
  // 让底层 canvas 和顶层 canvas 保持相同的 CSS 尺寸
  const baseCanvas = document.getElementById('maskBaseCanvas');
  const displayH = maskCanvas.style.height || getComputedStyle(maskCanvas).height;
  const displayW = maskCanvas.style.width || getComputedStyle(maskCanvas).width;
  baseCanvas.style.width = displayW;
  baseCanvas.style.height = displayH;
}

function closeMaskEditor(){
  maskEditorOpen = false;
  maskDrawing = false;
  document.getElementById('maskEditor').classList.remove('show');
}

function initMaskCanvasEvents(){
  const canvas = document.getElementById('maskCanvas');
  // Pointer Events — 兼容 PC/手机/平板
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    maskDrawing = true;
    canvas.setPointerCapture(e.pointerId);
    maskLastX = null;
    maskLastY = null;
    drawMaskStroke(e);
  });
  canvas.addEventListener('pointermove', e => {
    if(maskDrawing) drawMaskStroke(e);
  });
  canvas.addEventListener('pointerup', e => {
    if(maskDrawing){
      maskDrawing = false;
      saveMaskSnapshot();
      updateMaskCoverage();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    if(maskDrawing){
      maskDrawing = false;
      saveMaskSnapshot();
      updateMaskCoverage();
    }
  });
}

// 上一次笔触位置（用于间距插值，声明在全局变量区）

function drawMaskStroke(e){
  const rect = maskCanvas.getBoundingClientRect();
  const scaleX = maskCanvas.width / rect.width;
  const scaleY = maskCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const radius = maskBrushSize * scaleX / 2;

  if(maskTool === 'eraser'){
    // 橡皮擦：直接清除遮罩层像素，底层原图自然露出
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'destination-out';
    // 柔边橡皮擦：径向渐变从中心不透明到边缘透明
    const grad = maskCtx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.8)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    maskCtx.fillStyle = grad;
    maskCtx.beginPath();
    maskCtx.arc(x, y, radius, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();
  } else {
    // 画笔：柔边雾化效果
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'source-over';
    // 连续笔触插值：两点之间按间距填充 dab，避免快速滑动时断点
    if(maskLastX !== null){
      const dx = x - maskLastX, dy = y - maskLastY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = Math.max(radius * 0.3, 1);
      const count = Math.ceil(dist / step);
      for(let i = 1; i <= count; i++){
        const t = i / count;
        const ix = maskLastX + dx * t;
        const iy = maskLastY + dy * t;
        drawBrushDab(ix, iy, radius);
      }
    } else {
      drawBrushDab(x, y, radius);
    }
    maskCtx.restore();
    maskLastX = x;
    maskLastY = y;
  }
}

function drawBrushDab(x, y, radius){
  // 径向渐变柔边：中心 0.25 alpha → 边缘 0 alpha
  const grad = maskCtx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, 'rgba(255, 40, 40, 0.25)');
  grad.addColorStop(0.6, 'rgba(255, 40, 40, 0.15)');
  grad.addColorStop(1, 'rgba(255, 40, 40, 0)');
  maskCtx.fillStyle = grad;
  maskCtx.beginPath();
  maskCtx.arc(x, y, radius, 0, Math.PI * 2);
  maskCtx.fill();
}

function setMaskTool(tool){
  maskTool = tool;
  document.querySelectorAll('.mask-tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  maskCanvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
}

function saveMaskSnapshot(){
  const data = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  maskHistory.push(data);
  if(maskHistory.length > 30) maskHistory.shift();
}

function undoMask(){
  if(maskHistory.length <= 1) return;
  maskHistory.pop();
  const prev = maskHistory[maskHistory.length - 1];
  maskCtx.putImageData(prev, 0, 0);
  updateMaskCoverage();
}

function clearMask(){
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskHistory = [];
  saveMaskSnapshot();
  updateMaskCoverage();
}

function getMaskCoveragePercent(){
  const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const pixels = imageData.data;
  let maskPixels = 0;
  const total = pixels.length / 4;
  // 柔边画笔 alpha 较低，用 10 作为阈值（区分完全透明和半透明笔触）
  for(let i = 3; i < pixels.length; i += 4){
    if(pixels[i] > 10) maskPixels++;
  }
  return Math.round(maskPixels / total * 100);
}

function updateMaskCoverage(){
  const pct = getMaskCoveragePercent();
  const el = document.getElementById('maskCoverage');
  if(pct > 70){
    el.textContent = `遮罩覆盖率：${pct}% — 当前修改区域较大，建议直接使用图生图模式获得更好的生成效果`;
    el.className = 'mask-coverage warning';
  } else {
    el.textContent = `遮罩覆盖率：${pct}%`;
    el.className = 'mask-coverage';
  }
}

function confirmMask(){
  const coverage = getMaskCoveragePercent();
  if(coverage > 70){
    if(!confirm('当前遮罩覆盖率超过 70%，建议直接使用图生图模式。是否继续？')) return;
  }
  if(coverage < 1){
    showToast('请至少涂抹一小块区域作为修改范围', 'warning');
    return;
  }

  // 导出：白色=重绘区域，黑色=保持区域
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = maskCanvas.width;
  exportCanvas.height = maskCanvas.height;
  const exportCtx = exportCanvas.getContext('2d');

  // 黑色底（保持区域）
  exportCtx.fillStyle = '#000';
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // 从遮罩层提取有内容的区域，转为白色
  const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const exportData = exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
  for(let i = 0; i < maskData.data.length; i += 4){
    if(maskData.data[i + 3] > 10){ // alpha > 10 视为遮罩区域
      exportData.data[i] = 255;
      exportData.data[i + 1] = 255;
      exportData.data[i + 2] = 255;
      exportData.data[i + 3] = 255;
    }
  }
  exportCtx.putImageData(exportData, 0, 0);

  // 保存 mask base64 + ImageData（用于重新打开编辑器时恢复）
  maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  window._maskBase64 = exportCanvas.toDataURL('image/png');

  // 更新状态提示
  const status = document.getElementById('maskStatus');
  status.textContent = `已设置遮罩 · 覆盖率 ${coverage}%`;
  status.className = 'mask-entry-hint active';

  closeMaskEditor();
}

function resetMaskState(){
  maskImageData = null;
  window._maskBase64 = null;
  maskHistory = [];
  maskLastX = null;
  maskLastY = null;
  const status = document.getElementById('maskStatus');
  if(status){
    status.textContent = '未设置遮罩';
    status.className = 'mask-entry-hint';
  }
}

// 图片生成计时器（防重复创建）
let _imgTimer = null;
let _imgWaitSec = 0;
function startImgTimer(){
  stopImgTimer();
  _imgWaitSec = 0;
  const tipEl = document.querySelector('#imgLoading .gen-loading-tip');
  const secEl = document.querySelector('#imgLoading .gen-loading-sec');
  _imgTimer = setInterval(() => {
    _imgWaitSec++;
    if(secEl) secEl.textContent = `已等待 ${_imgWaitSec} 秒`;
    if(tipEl){
      if(_imgWaitSec >= 55) tipEl.textContent = '生成时间较长，如本次失败可尝试简化提示词或稍后重试';
      else if(_imgWaitSec >= 45) tipEl.textContent = '服务繁忙，请耐心等待...';
      else if(_imgWaitSec >= 30) tipEl.textContent = '当前任务较复杂，生成时间可能较长...';
      else if(_imgWaitSec >= 10) tipEl.textContent = '正在生成，请稍候...';
    }
  }, 1000);
}
function stopImgTimer(){
  if(_imgTimer){ clearInterval(_imgTimer); _imgTimer = null; }
  _imgWaitSec = 0;
  const tipEl = document.querySelector('#imgLoading .gen-loading-tip');
  const secEl = document.querySelector('#imgLoading .gen-loading-sec');
  if(tipEl) tipEl.textContent = '';
  if(secEl) secEl.textContent = '';
}

// ========== IMAGE GENERATION WITH FULL STABILITY ==========
const IMG_LOG = (msg) => console.log(`[img2img] ${msg}`);
const IMG_ERR = (msg) => console.error(`[img2img] ${msg}`);

// 状态文字更新
function setImgStatus(text){
  const tipEl = document.querySelector('#imgLoading .gen-loading-tip');
  if(tipEl) tipEl.textContent = text;
}

// 通用重试函数
async function withRetry(fn, maxRetries, delayMs, label){
  for(let attempt = 1; attempt <= maxRetries; attempt++){
    try {
      return await fn(attempt);
    } catch(e){
      IMG_ERR(`${label} 第${attempt}次失败: ${e.message}`);
      if(attempt >= maxRetries) throw e;
      setImgStatus(`${label}失败，${delayMs/1000}秒后重试 (${attempt}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// 图片格式校验
function validateImage(b64DataUrl, filename){
  const validTypes = ['data:image/jpeg','data:image/png','data:image/webp'];
  if(!validTypes.some(t => b64DataUrl.startsWith(t))){
    throw new Error(`"${filename}" 格式不支持，请使用 JPG/PNG/WebP`);
  }
  // 估算 base64 大小
  const sizeKB = Math.round(b64DataUrl.length * 3 / 4 / 1024);
  if(sizeKB > 8 * 1024){
    throw new Error(`"${filename}" 过大 (${Math.round(sizeKB/1024)}MB)，请压缩到 8MB 以内`);
  }
  return sizeKB;
}

// 智能压缩
async function smartCompress(b64DataUrl, filename){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const origW = w, origH = h;

      // 策略：最长边 > 2048 → 缩到 2048
      const maxSide = 2048;
      if(w > maxSide || h > maxSide){
        const ratio = Math.min(maxSide / w, maxSide / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      // 策略：根据大小选择质量
      const sizeKB = Math.round(b64DataUrl.length * 3 / 4 / 1024);
      let quality = 0.85;
      if(sizeKB > 1024) quality = 0.7;
      else if(sizeKB > 512) quality = 0.8;

      const result = canvas.toDataURL('image/jpeg', quality);
      const newKB = Math.round(result.length * 3 / 4 / 1024);
      IMG_LOG(`压缩 ${filename}: ${origW}x${origH} ${sizeKB}KB → ${w}x${h} ${newKB}KB (quality=${quality})`);
      setImgStatus(`压缩完成: ${sizeKB}KB → ${newKB}KB`);
      resolve(result);
    };
    img.onerror = () => {
      IMG_ERR(`压缩失败，使用原图: ${filename}`);
      resolve(b64DataUrl);
    };
    img.src = b64DataUrl;
  });
}

// 上传单张图片（带重试）
async function uploadSingleImage(b64DataUrl, filename, index, total){
  return withRetry(async (attempt) => {
    setImgStatus(`上传图片 (${index+1}/${total})${attempt > 1 ? ` 重试${attempt}` : ''}...`);
    IMG_LOG(`上传 ${filename} 第${attempt}次`);

    const resp = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload_image_file', file_base64: b64DataUrl, filename })
    });
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    if(result.error) throw new Error(result.error);
    IMG_LOG(`上传成功: ${filename} → ${result.url?.substring(0,60)}...`);
    return result.url;
  }, 3, 2000, '图片上传');
}

// AI 生成（带重试）
async function callImageEdit(requestBody){
  return withRetry(async (attempt) => {
    setImgStatus(`AI 生成中${attempt > 1 ? ` (重试${attempt}/3)` : ''}...`);
    IMG_LOG(`调用 image_edit 第${attempt}次`);

    const resp = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if(!resp.ok){
      const text = await resp.text().catch(() => '');
      if(resp.status === 429) throw new Error('限流');
      if(resp.status === 504 || resp.status === 502) throw new Error('超时');
      throw new Error(text.substring(0, 100) || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    if(data.error) throw new Error(data.error);
    if(!data.image_url) throw new Error('未返回图片URL');
    return data;
  }, 3, 3000, 'AI生成');
}

// 预加载图片（带重试）
function preloadImage(url){
  return withRetry(async (attempt) => {
    setImgStatus(`加载结果图片${attempt > 1 ? ` (重试${attempt})` : ''}...`);
    IMG_LOG(`预加载图片 第${attempt}次`);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { IMG_LOG('预加载成功'); resolve(url); };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
      // 超时 30 秒
      setTimeout(() => reject(new Error('图片加载超时')), 30000);
    });
  }, 2, 2000, '图片加载');
}

async function genImage(){
  if (!hasPermission('image_gen')) {
    showUpgradePrompt('image_gen');
    return;
  }

  let prompt = '';
  let requestBody = {};

  if(imgMode === 'text2img'){
    prompt = document.getElementById('imgPrompt').value.trim();
    if(!prompt){ showToast('请输入图片描述', 'warning'); return; }
    requestBody = { action:'image_gen', prompt, size:imgSize };
  } else {
    // ===== 图生图完整流程 =====
    prompt = document.getElementById('img2imgPrompt').value.trim();
    if(!img2imgFiles.length){ showToast('请上传参考图片', 'warning'); return; }
    if(!prompt){ showToast('请输入修改要求', 'warning'); return; }

    // UI 初始化
    document.getElementById('imgBtn').disabled = true;
    document.getElementById('imgPlaceholder').style.display = 'none';
    document.getElementById('imgLoading').style.display = 'block';
    document.getElementById('imgResult').style.display = 'none';
    document.getElementById('imgToolbar').classList.remove('show');
    document.getElementById('imgCompare').classList.remove('show');
    document.getElementById('btnCompare').style.display = 'none';
    compareActive = false;
    startImgTimer();

    try {
      // Step 1: 校验图片
      IMG_LOG('=== 开始图生图流程 ===');
      setImgStatus('校验图片...');
      for(let i = 0; i < img2imgFiles.length; i++){
        validateImage(img2imgFiles[i], `图片${i+1}`);
      }
      IMG_LOG(`校验通过，共 ${img2imgFiles.length} 张图`);

      // Step 2: 压缩图片
      setImgStatus('压缩图片...');
      const compressedImages = [];
      for(let i = 0; i < img2imgFiles.length; i++){
        setImgStatus(`压缩图片 (${i+1}/${img2imgFiles.length})...`);
        compressedImages.push(await smartCompress(img2imgFiles[i], `ref_${i}.png`));
      }

      // Step 3: 上传图片（带重试）
      const imagesUrls = [];
      for(let i = 0; i < compressedImages.length; i++){
        const url = await uploadSingleImage(compressedImages[i], `ref_${i}.png`, i, compressedImages.length);
        imagesUrls.push(url);
      }

      // Step 4: 上传遮罩（如有）
      let maskUrl = '';
      if(window._maskBase64){
        setImgStatus('上传遮罩...');
        IMG_LOG('上传遮罩');
        maskUrl = await uploadSingleImage(window._maskBase64, 'mask.png', 0, 1);
      }

      IMG_LOG(`全部上传完成，images=${imagesUrls.length}, mask=${maskUrl ? '有' : '无'}`);

      // Step 5: AI 生成（带重试）
      requestBody = { action:'image_edit', prompt, images_urls: imagesUrls, size:imgSize };
      if(maskUrl) requestBody.mask_url = maskUrl;

      const data = await callImageEdit(requestBody);
      IMG_LOG(`AI 返回: ${data.image_url?.substring(0,80)}...`);

      // Step 6: 预加载结果图片（带重试）
      try {
        await preloadImage(data.image_url);
      } catch(loadErr){
        IMG_ERR('预加载失败，直接显示: ' + loadErr.message);
      }

      // Step 7: 显示结果
      document.getElementById('imgLoading').style.display = 'none';
      document.getElementById('imgResult').src = data.image_url;
      document.getElementById('imgResult').style.display = 'block';
      document.getElementById('imgToolbar').classList.add('show');

      // 对比滑块
      if(img2imgFiles.length > 0){
        showCompare(img2imgFiles[0], data.image_url);
      }

      // 评分
      if(isLoggedIn()){
        saveGenerationHistory('image_gen', {prompt, size:imgSize}, data.image_url).then(historyId => {
          if(historyId) createStarRating('imgRating', historyId, prompt, 'image_gen');
        });
        savePreference('img_size', imgSize);
      } else {
        createStarRating('imgRating', null, prompt, 'image_gen');
      }

      // 并行保存
      saveAsset('image', prompt, data.image_url);
      saveRecentResult('image', {url: data.image_url, prompt});
      resetMaskState();

      IMG_LOG('=== 图生图完成 ===');

    } catch(e){
      IMG_ERR('流程失败: ' + e.message);
      document.getElementById('imgLoading').style.display = 'none';
      document.getElementById('imgPlaceholder').style.display = 'block';
      document.getElementById('imgPlaceholder').innerHTML = `<div class="icon">❌</div><p>${e.message}</p>`;
    } finally {
      stopImgTimer();
      document.getElementById('imgBtn').disabled = false;
    }
    return; // 图生图流程结束，不走下面的文生图逻辑
  }

  // ===== 文生图流程（保持不变） =====
  document.getElementById('imgBtn').disabled = true;
  document.getElementById('imgPlaceholder').style.display = 'none';
  document.getElementById('imgLoading').style.display = 'block';
  document.getElementById('imgResult').style.display = 'none';
  document.getElementById('imgToolbar').classList.remove('show');
  document.getElementById('imgCompare').classList.remove('show');
  document.getElementById('btnCompare').style.display = 'none';
  compareActive = false;

  startImgTimer();

  try{
    const resp = await fetch('/api', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(requestBody)
    });
    const data = await resp.json();
    if(data.image_url){
      const preloader = new Image();
      preloader.onload = () => {
        document.getElementById('imgLoading').style.display = 'none';
        document.getElementById('imgResult').src = data.image_url;
        document.getElementById('imgResult').style.display = 'block';
        document.getElementById('imgToolbar').classList.add('show');

        if(imgMode === 'img2img' && img2imgFiles.length > 0){
          showCompare(img2imgFiles[0], data.image_url);
        } else {
          document.getElementById('imgCompare').classList.remove('show');
          document.getElementById('btnCompare').style.display = 'none';
          compareActive = false;
        }

        if(isLoggedIn()){
          saveGenerationHistory('image_gen', {prompt, size:imgSize}, data.image_url).then(historyId => {
            if(historyId) createStarRating('imgRating', historyId, prompt, 'image_gen');
          });
          savePreference('img_size', imgSize);
        } else {
          createStarRating('imgRating', null, prompt, 'image_gen');
        }
      };
      preloader.onerror = () => {
        document.getElementById('imgLoading').style.display = 'none';
        document.getElementById('imgPlaceholder').style.display = 'block';
        document.getElementById('imgPlaceholder').innerHTML = '<div class="icon">❌</div><p>图片加载失败，请重试</p>';
      };
      preloader.src = data.image_url;

      saveAsset('image', prompt, data.image_url);
      saveRecentResult('image', {url: data.image_url, prompt});
      resetMaskState();
    } else {
      document.getElementById('imgLoading').style.display = 'none';
      document.getElementById('imgPlaceholder').style.display = 'block';
      document.getElementById('imgPlaceholder').innerHTML = '<div class="icon">❌</div><p>'+getApiErrorMessage(null, data)+'</p>';
    }
  } catch(e){
    document.getElementById('imgLoading').style.display = 'none';
    document.getElementById('imgPlaceholder').style.display = 'block';
    document.getElementById('imgPlaceholder').innerHTML = '<div class="icon">❌</div><p>'+getApiErrorMessage(e)+'</p>';
  } finally {
    stopImgTimer();
  }
  document.getElementById('imgBtn').disabled = false;
}

// ========== COPYWRITING ==========
async function genCopy(){
  // 检查权限
  if (!hasPermission('copywriting')) {
    showUpgradePrompt('copywriting');
    return;
  }

  const type = document.getElementById('copyType').value;
  const brand = document.getElementById('copyBrand').value;
  const platform = document.getElementById('copyPlatform').value;
  const product = document.getElementById('copyProduct').value.trim();
  const extra = document.getElementById('copyExtra').value.trim();

  if(!product && !extra){ showToast('请至少填写产品名称或补充要求', 'warning'); return; }

  const btn = document.getElementById('copyBtn');
  const out = document.getElementById('copyOutput');
  const retry = document.getElementById('copyRetry');
  btn.disabled = true; btn.textContent = '创作中...';
  retry.disabled = true;
  out.className = 'copy-output'; out.textContent = '';

  try{
    // 获取高分历史案例
    let examples = [];
    if(isLoggedIn()){
      const highRated = await getHighRatedExamples('copywriting');
      examples = highRated.map(h => h.output_content).filter(Boolean);
    }

    const resp = await fetch('/api', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'copywriting', type, brand, platform, product, prompt:extra, examples })
    });
    const data = await resp.json();
    const resultText = data.text || data.error || '生成失败';
    _lastCopyText = data.text || '';
    out.innerHTML = renderMarkdown(resultText);
    if(data.text) {
      saveAsset('copy', product || '文案', data.text);
      saveRecentResult('copy', {text: data.text});

      // 保存历史并显示评分
      const inputParams = {type, brand, platform, product, prompt:extra};
      if(isLoggedIn()){
        saveGenerationHistory('copywriting', inputParams, data.text).then(historyId => {
          if(historyId) createStarRating('copyRating', historyId, data.text, 'copywriting');
        });
        if(type) savePreference('copy_type', type);
        if(brand) savePreference('copy_brand', brand);
        if(platform) savePreference('copy_platform', platform);
      } else {
        createStarRating('copyRating', null, data.text, 'copywriting');
      }
    }
  } catch(e){
    out.className = 'copy-output empty'; out.textContent = getApiErrorMessage(e);
  }
  btn.disabled = false; btn.textContent = '生成文案';
  retry.style.display = 'inline-flex';
  retry.disabled = false;
}

// 统一复制封装
async function copyToClipboard(text, btn, originalLabel){
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ 已复制到剪贴板');
    if(btn){
      btn.textContent = '✓ 已复制';
      btn.classList.add('copy-success');
      setTimeout(()=>{ btn.textContent = originalLabel; btn.classList.remove('copy-success'); }, 1500);
    }
    return true;
  } catch(err){
    showToast('❌ 复制失败，请手动选择复制');
    return false;
  }
}

function copyText(){
  const text = _lastCopyText || document.getElementById('copyOutput').textContent;
  if(text && !text.includes('未启动')){
    copyToClipboard(text, event.target, '复制文案');
  }
}

// ========== PAGE LOADER ==========
const _loaderStartTime = Date.now();
let _loaderHidden = false;
function hideLoader(){
  if(_loaderHidden) return;
  _loaderHidden = true;
  const loader = document.getElementById('pageLoader');
  if(!loader) return;
  const elapsed = Date.now() - _loaderStartTime;
  const remaining = Math.max(0, 1000 - elapsed);
  setTimeout(() => loader.classList.add('hide'), remaining);
}
document.addEventListener('DOMContentLoaded', hideLoader);

// ========== SCROLL ANIMATIONS ==========
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
  const animatedElements = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .scale-in');
  animatedElements.forEach(el => observer.observe(el));
});

// ========== MAGNETIC BUTTONS ==========
document.addEventListener('DOMContentLoaded', () => {
  const magneticBtns = document.querySelectorAll('.magnetic');
  magneticBtns.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
    });
  });
});

// ========== KNOWLEDGE ==========
function toggleKnowledgeCard(card){
  card.classList.toggle('open');
}

// ========== CUSTOM BRANDS ==========
function getCustomBrands(){
  try{ return JSON.parse(localStorage.getItem('custom_brands') || '[]'); }catch(e){ return []; }
}
function saveCustomBrands(brands){
  localStorage.setItem('custom_brands', JSON.stringify(brands));
}

// 从 Supabase 加载品牌并缓存到 localStorage
async function loadCustomBrandsFromRemote(){
  if(typeof getUserBrands === 'function' && isLoggedIn()){
    try {
      const remote = await getUserBrands();
      if(remote.length > 0){
        saveCustomBrands(remote);
        return remote;
      }
    } catch(e){ console.warn('从 Supabase 加载品牌失败:', e); }
  }
  return getCustomBrands();
}

function openAddBrandModal(){
  document.getElementById('brandName').value = '';
  document.getElementById('brandDesc').value = '';
  document.getElementById('brandTone').value = '';
  document.getElementById('brandPoints').value = '';
  document.getElementById('brandModal').classList.add('show');
}
function closeAddBrandModal(){
  document.getElementById('brandModal').classList.remove('show');
}
function saveBrand(){
  const rawName = document.getElementById('brandName').value.trim();
  if(!rawName){ showToast('请输入品牌名称', 'warning'); return; }
  // 净化输入
  const esc = typeof validator !== 'undefined' ? (s) => validator.escape(s || '') : (s) => s;
  const brand = {
    id: 'brand_' + Date.now(),
    name: esc(rawName),
    desc: esc(document.getElementById('brandDesc').value.trim()),
    tone: esc(document.getElementById('brandTone').value.trim()),
    points: esc(document.getElementById('brandPoints').value.trim())
  };
  const brands = getCustomBrands();
  brands.push(brand);
  saveCustomBrands(brands);
  // 登录时同步到 Supabase
  if(typeof saveUserBrand === 'function' && isLoggedIn()){
    saveUserBrand(brand);
  }
  closeAddBrandModal();
  renderCustomBrands();
  refreshBrandSelects();
}
function deleteBrand(id){
  if(!confirm('确定删除该品牌？')) return;
  const brands = getCustomBrands().filter(b => b.id !== id);
  saveCustomBrands(brands);
  // 登录时同步删除 Supabase
  if(typeof deleteUserBrand === 'function' && isLoggedIn()){
    deleteUserBrand(id);
  }
  renderCustomBrands();
  refreshBrandSelects();
}
function renderCustomBrands(){
  const grid = document.getElementById('brandGrid');
  const brands = getCustomBrands();
  // 先移除已有的自定义品牌卡片
  grid.querySelectorAll('.custom-brand-card').forEach(el => el.remove());
  brands.forEach(brand => {
    const card = document.createElement('div');
    card.className = 'knowledge-card custom-brand-card';
    card.onclick = function(){ toggleKnowledgeCard(this); };
    let bodyHtml = '';
    if(brand.desc) bodyHtml += `<div class="knowledge-item"><span class="knowledge-label">简介</span>${brand.desc}</div>`;
    if(brand.tone) bodyHtml += `<div class="knowledge-item"><span class="knowledge-label">语言风格</span>${brand.tone}</div>`;
    if(brand.points) bodyHtml += `<div class="knowledge-item"><span class="knowledge-label">核心卖点</span>${brand.points}</div>`;
    bodyHtml += `<div style="margin-top:12px;text-align:right"><button onclick="event.stopPropagation();deleteBrand('${brand.id}')" style="padding:6px 12px;background:#FEE2E2;color:#EF4444;border:none;border-radius:6px;font-size:12px;cursor:pointer">删除品牌</button></div>`;
    card.innerHTML = `
      <div class="knowledge-card-header">
        <span>${brand.name}</span>
        <span class="knowledge-arrow">→</span>
      </div>
      <div class="knowledge-card-body">${bodyHtml}</div>
    `;
    grid.appendChild(card);
  });
}
function refreshBrandSelects(){
  const brands = getCustomBrands();
  const selects = ['copyBrand'];
  selects.forEach(selId => {
    const sel = document.getElementById(selId);
    if(!sel) return;
    // 移除旧的自定义品牌选项
    sel.querySelectorAll('.custom-brand-opt').forEach(el => el.remove());
    // 添加新的
    brands.forEach(brand => {
      const opt = document.createElement('option');
      opt.className = 'custom-brand-opt';
      opt.value = brand.name;
      opt.textContent = brand.name + (brand.desc ? ' - ' + brand.desc : '');
      sel.appendChild(opt);
    });
  });
}
// 页面加载时渲染自定义品牌
renderCustomBrands();
refreshBrandSelects();

// ========== ASSETS SEARCH ==========
function searchAssets(){ renderAssets(); }

// ========== WORD COUNT ==========
function updateWordCount(outEl, text){
  let badge = outEl.parentElement.querySelector('.word-count');
  if(!badge){
    badge = document.createElement('div');
    badge.className = 'word-count';
    outEl.parentElement.style.position = 'relative';
    outEl.parentElement.appendChild(badge);
  }
  const count = text.replace(/\s/g, '').length;
  badge.textContent = count + ' 字';
}

// ========== SAVE AS TEMPLATE ==========
function saveAsTemplate(type, text, title){
  const name = prompt('输入模板名称：', title || '');
  if(!name) return;
  const templates = JSON.parse(localStorage.getItem('mengli_copy_templates') || '[]');
  templates.unshift({ id: Date.now(), name, type, text, date: new Date().toLocaleDateString('zh-CN') });
  localStorage.setItem('mengli_copy_templates', JSON.stringify(templates));
  showToast('模板已保存');
}

function getSavedTemplates(){
  return JSON.parse(localStorage.getItem('mengli_copy_templates') || '[]');
}

function applySavedTemplate(templateId){
  const templates = getSavedTemplates();
  const tpl = templates.find(t => t.id === templateId);
  if(!tpl) return;
  const out = document.getElementById('copyOutput') || document.getElementById('articleOutput');
  if(out){ out.textContent = tpl.text; out.className = out.className.replace('empty','').trim(); }
}

// ========== PLUGIN CENTER ==========
let pluginList = [];
let currentPlugin = null;
let currentPluginChangelog = [];
let pluginFeedbackType = 'bug';

async function initPluginPage(){
  await loadPluginList();
}

async function loadPluginList(){
  const grid = document.getElementById('pluginGrid');
  const banner = document.getElementById('pluginBanner');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999">加载中...</div>';

  try {
    const { data, error } = await supabase
      .from('plugins')
      .select('*')
      .order('updated_at', { ascending: false });
    if(error) throw error;
    pluginList = data || [];
  } catch(e){
    console.error('加载插件列表失败:', e);
    pluginList = [];
  }

  // Banner
  const latest = pluginList[0];
  const latestDate = latest ? new Date(latest.updated_at).toLocaleDateString('zh-CN') : '—';
  banner.innerHTML = `
    <div class="plugin-banner-info">
      <h2>🧩 插件中心</h2>
      <p>持续更新 · 提供运营工具、浏览器插件、自动化工具下载</p>
    </div>
    <div class="plugin-banner-meta">
      ${latest ? `最新版本：${latest.name} ${latest.version}` : '暂无插件'}<br>
      最近更新：${latestDate}
    </div>`;

  renderPluginList();
}

function renderPluginList(){
  const grid = document.getElementById('pluginGrid');
  if(!pluginList.length){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#999"><div style="font-size:48px;margin-bottom:12px">🔌</div><p>暂无插件，敬请期待</p></div>';
    return;
  }
  grid.innerHTML = pluginList.map(p => `
    <div class="plugin-card">
      <div class="plugin-card-top">
        <div class="plugin-card-icon">${p.icon || '🔌'}</div>
        <div>
          <div class="plugin-card-name">${p.name}</div>
          <div class="plugin-card-version">${p.version} · ${new Date(p.updated_at).toLocaleDateString('zh-CN')}</div>
        </div>
      </div>
      <div class="plugin-card-desc">${p.short_desc || ''}</div>
      <div class="plugin-card-actions">
        <button class="plugin-download-btn" onclick="downloadPlugin('${p.id}','${(p.download_url||'#').replace(/'/g,"\\'")}')">立即下载</button>
        <button class="plugin-detail-btn" onclick="showPluginDetail('${p.id}')">查看详情</button>
      </div>
    </div>
  `).join('');
}

function filterPlugins(){
  const query = (document.getElementById('pluginSearchInput')?.value || '').toLowerCase();
  document.querySelectorAll('.plugin-card').forEach(card => {
    const name = card.querySelector('.plugin-card-name')?.textContent.toLowerCase() || '';
    const desc = card.querySelector('.plugin-card-desc')?.textContent.toLowerCase() || '';
    card.style.display = (!query || name.includes(query) || desc.includes(query)) ? '' : 'none';
  });
}

async function showPluginDetail(id){
  const listView = document.getElementById('pluginListView');
  const detailView = document.getElementById('pluginDetailView');
  const detail = document.getElementById('pluginDetail');

  listView.style.display = 'none';
  detailView.style.display = 'block';

  // 加载插件信息
  try {
    const [{data: plugin}, {data: changelog}] = await Promise.all([
      supabase.from('plugins').select('*').eq('id', id).single(),
      supabase.from('plugin_changelog').select('*').eq('plugin_id', id).order('created_at', {ascending: false})
    ]);
    currentPlugin = plugin;
    currentPluginChangelog = changelog || [];
  } catch(e){
    detail.innerHTML = '<p style="color:red;padding:48px">加载失败</p>';
    return;
  }

  const p = currentPlugin;
  const installSteps = (p.install_guide || '').split('\n').filter(s=>s.trim());
  const issues = (p.known_issues || '').split('\n').filter(s=>s.trim());

  detail.innerHTML = `
    <div class="plugin-detail">
      <div class="plugin-detail-hero">
        <div class="plugin-detail-icon">${p.icon || '🔌'}</div>
        <div>
          <div class="plugin-detail-name">${p.name}</div>
          <div class="plugin-detail-meta">${p.version} · 支持：${p.platforms || '—'}</div>
        </div>
      </div>

      <div class="plugin-download-area">
        <button class="plugin-download-big" onclick="downloadPlugin('${p.id}','${(p.download_url||'#').replace(/'/g,"\\'")}')">⬇ 下载最新版</button>
      </div>

      <div class="plugin-section">
        <div class="plugin-section-title">📋 插件介绍</div>
        <div class="plugin-section-body">${(p.description || '暂无介绍').replace(/\n/g,'<br>')}</div>
      </div>

      ${installSteps.length ? `
      <div class="plugin-section">
        <div class="plugin-section-title">🔧 安装教程</div>
        <div class="install-steps">
          ${installSteps.map((s,i) => `
            <div class="install-step">
              <div class="install-step-num">${i+1}</div>
              <div class="install-step-text">${s.replace(/^\d+[\.\、]\s*/,'')}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      ${currentPluginChangelog.length ? `
      <div class="plugin-section">
        <div class="plugin-section-title">📝 更新日志</div>
        <div class="plugin-timeline">
          ${currentPluginChangelog.map(c => `
            <div class="timeline-item">
              <div class="timeline-version">${c.version}</div>
              <div class="timeline-date">${new Date(c.created_at).toLocaleDateString('zh-CN')}</div>
              <div class="timeline-content">${c.content.replace(/\n/g,'<br>')}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      ${issues.length ? `
      <div class="plugin-section">
        <div class="plugin-section-title">⚠️ 已知问题</div>
        <div class="plugin-issues">
          <ul>${issues.map(i => `<li>${i.replace(/^[\*\-]\s*/,'')}</li>`).join('')}</ul>
        </div>
      </div>` : ''}

      <div class="plugin-section">
        <div class="plugin-section-title">💬 用户反馈</div>
        <div class="plugin-feedback-form">
          <div class="feedback-type-tabs">
            <button class="feedback-type-tab active" onclick="setPluginFeedbackType('bug',this)">🐛 Bug反馈</button>
            <button class="feedback-type-tab" onclick="setPluginFeedbackType('feature',this)">💡 功能建议</button>
            <button class="feedback-type-tab" onclick="setPluginFeedbackType('question',this)">❓ 使用问题</button>
          </div>
          <textarea id="pluginFeedbackContent" placeholder="请描述你遇到的问题或建议..."></textarea>
          <div class="feedback-images-section">
            <label style="font-size:12px;font-weight:600;color:#666;margin-bottom:6px;display:block">📷 上传截图（最多3张，选填）</label>
            <div class="feedback-images-list" id="feedbackImagesList">
              <label class="feedback-image-add" id="feedbackImageAdd">
                <input type="file" id="feedbackImageInput" accept="image/*" multiple style="display:none" onchange="addFeedbackImages(event)">
                <span>+ 添加图片</span>
              </label>
            </div>
          </div>
          <button class="plugin-feedback-submit" onclick="submitPluginFeedback('${p.id}')">提交反馈</button>
        </div>
      </div>
    </div>`;
}

function showPluginList(){
  document.getElementById('pluginListView').style.display = 'block';
  document.getElementById('pluginDetailView').style.display = 'none';
  currentPlugin = null;
}

async function downloadPlugin(id, url){
  // 更新下载计数
  try {
    const plugin = pluginList.find(p => p.id === id);
    if(plugin){
      await supabase.from('plugins').update({ downloads: (plugin.downloads||0) + 1 }).eq('id', id);
      plugin.downloads = (plugin.downloads||0) + 1;
    }
  } catch(e){ console.warn('更新下载计数失败:', e); }
  if(url && url !== '#') window.open(url, '_blank');
  else showToast('下载链接暂未配置');
}

function setPluginFeedbackType(type, btn){
  pluginFeedbackType = type;
  document.querySelectorAll('.feedback-type-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

let feedbackImages = []; // {file, preview}

function addFeedbackImages(event){
  const files = Array.from(event.target.files);
  const remaining = 3 - feedbackImages.length;
  if(remaining <= 0){ showToast('最多上传3张图片'); return; }
  files.slice(0, remaining).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      feedbackImages.push({ file, preview: e.target.result });
      renderFeedbackImages();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function removeFeedbackImage(index){
  feedbackImages.splice(index, 1);
  renderFeedbackImages();
}

function renderFeedbackImages(){
  const list = document.getElementById('feedbackImagesList');
  const addBtn = document.getElementById('feedbackImageAdd');
  if(!list) return;
  let html = feedbackImages.map((img, i) =>
    `<div class="feedback-image-thumb">
      <img src="${img.preview}">
      <button class="feedback-image-remove" onclick="removeFeedbackImage(${i})">×</button>
    </div>`
  ).join('');
  if(feedbackImages.length < 3){
    html += `<label class="feedback-image-add" id="feedbackImageAdd">
      <input type="file" id="feedbackImageInput" accept="image/*" multiple style="display:none" onchange="addFeedbackImages(event)">
      <span>+ 添加图片</span>
    </label>`;
  }
  list.innerHTML = html;
}

async function submitPluginFeedback(pluginId){
  const rawContent = document.getElementById('pluginFeedbackContent').value.trim();
  if(!rawContent){ showToast('请输入反馈内容', 'warning'); return; }
  // 净化输入
  const content = typeof validator !== 'undefined' ? validator.escape(rawContent) : rawContent;

  const btn = document.querySelector('.plugin-feedback-submit');
  if(!btn) return;
  btn.disabled = true; btn.textContent = '提交中...';

  try {
    // 上传图片到 Storage（失败不阻塞反馈提交）
    const imageUrls = [];
    for(const img of feedbackImages){
      try {
        const ext = img.file.name.split('.').pop();
        const path = `${pluginId}/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('feedback-images')
          .upload(path, img.file);
        if(uploadErr) { console.warn('图片上传失败，跳过:', uploadErr.message); continue; }
        const { data: urlData } = supabase.storage.from('feedback-images').getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      } catch(imgErr) {
        console.warn('图片上传异常，跳过:', imgErr);
      }
    }

    const insertData = {
      plugin_id: pluginId,
      user_id: currentUser?.id || null,
      user_name: currentUser ? (userProfile?.display_name || currentUser.email) : '匿名用户',
      feedback_type: pluginFeedbackType,
      content: content,
      images: imageUrls.length ? imageUrls : null
    };

    const { error } = await supabase.from('plugin_feedback').insert(insertData);
    if(error) throw error;

    showToast('✅ 反馈已提交，感谢！');
    try {
      document.getElementById('pluginFeedbackContent').value = '';
      feedbackImages = [];
      renderFeedbackImages();
    } catch(e2){ /* 清理失败不影响主流程 */ }
  } catch(e){
    console.error('反馈提交失败:', e);
    showToast('提交失败：' + (e.message || '未知错误'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '提交反馈';
  }
}

// ========== ARTICLE ==========
let articleFiles = [];   // {name, size, base64, type}
let articleMode = 'outline'; // 'outline' | 'draft'

function setArticleMode(mode, btn){
  articleMode = mode;
  document.querySelectorAll('.article-mode-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const hint = document.getElementById('articleModeHint');
  if(mode === 'outline'){
    hint.textContent = '输出结构化大纲（800-1200字），包含标题、论点框架和要点展开';
  } else {
    hint.textContent = '输出完整初稿（2000-4000字），按大纲结构扩充，含配图标注';
  }
}

function handleArticleFileUpload(event){
  const files = Array.from(event.target.files);
  if(!files.length) return;
  processArticleFiles(files);
  event.target.value = '';
}

function processArticleFiles(files){
  // 只保留一个文件
  const file = files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    articleFiles = [{
      name: file.name,
      size: file.size,
      base64: e.target.result,
      type: file.type
    }];
    renderArticleFileList();
  };
  reader.readAsDataURL(file);
}

function renderArticleFileList(){
  const list = document.getElementById('articleFileList');
  if(!articleFiles.length){ list.innerHTML = ''; return; }
  const f = articleFiles[0];
  const sizeStr = f.size > 1024*1024
    ? (f.size/1024/1024).toFixed(1)+'MB'
    : (f.size/1024).toFixed(0)+'KB';
  const ext = f.name.split('.').pop().toLowerCase();
  const icons = {pdf:'📕',doc:'📘',docx:'📘',txt:'📄'};
  list.innerHTML = `
    <div class="article-file-item">
      <span class="file-icon">${icons[ext]||'📎'}</span>
      <div class="file-info">
        <div class="file-name">${f.name}</div>
        <div class="file-size">${sizeStr}</div>
      </div>
      <button class="file-remove" onclick="removeArticleFile()">×</button>
    </div>`;
}

function removeArticleFile(){
  articleFiles = [];
  renderArticleFileList();
}

function initArticleDragDrop(){
  const zone = document.getElementById('articleUpload');
  if(!zone) return;
  zone.addEventListener('dragover', e=>{e.preventDefault();zone.classList.add('drag-over')});
  zone.addEventListener('dragleave', e=>{e.preventDefault();zone.classList.remove('drag-over')});
  zone.addEventListener('drop', e=>{
    e.preventDefault();zone.classList.remove('drag-over');
    processArticleFiles(Array.from(e.dataTransfer.files));
  });
}

function copyArticle(){
  const text = _lastArticleText || document.getElementById('articleOutput').textContent;
  if(text && !text.includes('未启动')){
    copyToClipboard(text, event.target, '复制全文');
  }
}

// ========== ASSETS ==========
function saveAsset(type, title, content, rating){
  const asset = {
    id: Date.now(),
    type,
    title,
    content,
    rating: rating || null,
    date: new Date().toLocaleDateString('zh-CN')
  };
  assets.unshift(asset);
  localStorage.setItem('menlil_assets', JSON.stringify(assets));
  // 登录时同步到 Supabase
  if(typeof saveUserAsset === 'function' && isLoggedIn()){
    saveUserAsset(asset);
  }
}

// 更新素材评分
function updateAssetRating(content, rating){
  const asset = assets.find(a => a.content === content);
  if(asset){
    asset.rating = rating;
    localStorage.setItem('menlil_assets', JSON.stringify(assets));
    // 登录时同步到 Supabase
    if(typeof updateUserAssetRating === 'function' && isLoggedIn()){
      updateUserAssetRating(asset.id, rating);
    }
  }
}

// 加载素材（Supabase 或 localStorage）
async function loadAssets(){
  if(typeof getUserAssets === 'function' && isLoggedIn()){
    try {
      const remote = await getUserAssets();
      if(remote.length > 0){
        assets = remote.map(a => ({
          id: a.id,
          type: a.type,
          title: a.title,
          content: a.content,
          rating: a.rating,
          date: new Date(a.created_at).toLocaleDateString('zh-CN')
        }));
        return;
      }
    } catch(e){ console.warn('从 Supabase 加载素材失败，使用本地:', e); }
  }
  // 降级到 localStorage
  assets = JSON.parse(localStorage.getItem('menlil_assets') || '[]');
}

// 素材卡片点击事件委托（只绑定一次）
let _assetsGridBound = false;
function bindAssetsGridEvents(){
  if(_assetsGridBound) return;
  const grid = document.getElementById('assetsGrid');
  if(!grid) return;
  grid.addEventListener('click', (e) => {
    // 复选框点击
    const checkbox = e.target.closest('.batch-checkbox');
    if(checkbox){
      const card = checkbox.closest('.asset-card');
      if(card) toggleAssetSelect(Number(card.dataset.id));
      return;
    }
    // 卡片点击
    const card = e.target.closest('.asset-card');
    if(!card) return;
    const id = Number(card.dataset.id);
    const asset = assets.find(a => a.id === id);
    if(!asset) return;
    if(batchMode){
      toggleAssetSelect(id);
    } else if(asset.type === 'image'){
      openLightbox(asset.content);
    } else {
      openTextModal(asset.title, asset.content);
    }
  });
  _assetsGridBound = true;
}

function renderAssets(){
  const grid = document.getElementById('assetsGrid');
  try {
    const search = (document.getElementById('assetsSearchInput')?.value || '').toLowerCase();

    let filtered = assets;
    if(currentAssetTab !== 'all'){
      filtered = filtered.filter(a => a.type === currentAssetTab);
    }
    if(search){
      filtered = filtered.filter(a => a.title.toLowerCase().includes(search) || (a.content && a.content.toLowerCase().includes(search)));
    }
    // 评分筛选
    if(currentRatingFilter !== 'all'){
      filtered = filtered.filter(a => a.rating && a.rating >= currentRatingFilter && a.rating < currentRatingFilter + 1);
    }

    if(filtered.length === 0){
      grid.innerHTML = '<div class="asset-empty"><div class="icon">📁</div><h3>暂无素材，去生成图片或文案吧</h3></div>';
      const pager = document.getElementById('assetsPager');
      if(pager) pager.innerHTML = '';
      return;
    }

    // 分页
    const totalPages = Math.ceil(filtered.length / ASSETS_PER_PAGE);
    if(assetsPage > totalPages) assetsPage = totalPages;
    const paged = filtered.slice((assetsPage - 1) * ASSETS_PER_PAGE, assetsPage * ASSETS_PER_PAGE);

    grid.innerHTML = paged.map(asset => {
      const ratingHtml = asset.rating ? `<div style="font-size:11px;color:#F59E0B;margin-top:4px">${'★'.repeat(asset.rating)}${'☆'.repeat(5-asset.rating)}</div>` : '';
      const selected = selectedAssets.has(asset.id);
      const checkboxHtml = batchMode ? `<div class="batch-checkbox ${selected ? 'checked' : ''}">${selected ? '✓' : ''}</div>` : '';
      const safeTitle = escapeHtml(asset.title);
      if(asset.type === 'image'){
        const safeSrc = isValidImageUrl(asset.content) ? asset.content : '';
        return `<div class="asset-card ${selected ? 'selected' : ''}" data-id="${asset.id}">
          ${checkboxHtml}
          <div class="asset-preview"><img src="${safeSrc}" alt="${safeTitle}"></div>
          <div class="asset-info">
            <div class="asset-title">${safeTitle}</div>
            <div class="asset-meta">图片 · ${escapeHtml(asset.date)}</div>
            ${ratingHtml}
          </div>
        </div>`;
      } else {
        const typeLabel = asset.type === 'article' ? '写稿' : '文案';
        return `<div class="asset-card ${selected ? 'selected' : ''}" data-id="${asset.id}">
          ${checkboxHtml}
          <div class="asset-preview" style="padding:20px;font-size:14px;color:var(--gray-600);text-align:left;overflow:hidden">${escapeHtml(asset.content.substring(0,100))}...</div>
          <div class="asset-info">
            <div class="asset-title">${safeTitle}</div>
            <div class="asset-meta">${typeLabel} · ${escapeHtml(asset.date)}</div>
            ${ratingHtml}
          </div>
        </div>`;
      }
    }).join('');

    // 渲染分页按钮
    const pager = document.getElementById('assetsPager');
    if(pager){
      if(totalPages <= 1){
        pager.innerHTML = '';
      } else {
        let pagerHtml = '';
        if(assetsPage > 1) pagerHtml += `<button class="pager-btn" onclick="assetsPage=${assetsPage-1};renderAssets()">‹</button>`;
        for(let i = 1; i <= totalPages; i++){
          pagerHtml += `<button class="pager-btn ${i===assetsPage?'active':''}" onclick="assetsPage=${i};renderAssets()">${i}</button>`;
        }
        if(assetsPage < totalPages) pagerHtml += `<button class="pager-btn" onclick="assetsPage=${assetsPage+1};renderAssets()">›</button>`;
        pager.innerHTML = pagerHtml;
      }
    }

    bindAssetsGridEvents();
  } catch(e){
    console.error('renderAssets error:', e);
    grid.innerHTML = '<div class="asset-empty"><div class="icon">❌</div><h3>渲染出错，请刷新页面</h3></div>';
  }
}

function switchAssetsTab(tab, btn){
  currentAssetTab = tab;
  assetsPage = 1;
  document.querySelectorAll('.assets-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const assetsGrid = document.getElementById('assetsGrid');
  const feedbackGrid = document.getElementById('feedbackGrid');
  const ratingFilter = document.getElementById('ratingFilter');
  const searchBar = document.getElementById('assetsSearch');

  if(tab === 'feedback'){
    assetsGrid.style.display = 'none';
    feedbackGrid.style.display = 'grid';
    ratingFilter.style.display = 'none';
    searchBar.style.display = 'none';
    loadFeedbackList();
  } else {
    assetsGrid.style.display = 'grid';
    feedbackGrid.style.display = 'none';
    ratingFilter.style.display = 'flex';
    searchBar.style.display = 'flex';
    renderAssets();
  }
}

function filterAssets(){
  assetsPage = 1;
  renderAssets();
}

// 评分筛选
let currentRatingFilter = 'all';

function filterByRating(rating, btn){
  currentRatingFilter = rating;
  assetsPage = 1;
  document.querySelectorAll('.rating-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAssets();
}

// 加载反馈列表
async function loadFeedbackList(){
  const grid = document.getElementById('feedbackGrid');

  if(!isLoggedIn()){
    grid.innerHTML = '<div class="asset-empty"><div class="icon">🔒</div><h3>请先登录</h3><p>登录后可查看反馈记录</p></div>';
    return;
  }

  grid.innerHTML = '<div class="asset-empty"><div class="icon">⏳</div><h3>加载中...</h3></div>';

  try {
    const feedbackList = await getFeedbackList();
    renderFeedbackList(feedbackList);
  } catch(e) {
    grid.innerHTML = '<div class="asset-empty"><div class="icon">❌</div><h3>加载失败</h3></div>';
  }
}

// 渲染反馈列表
function renderFeedbackList(list){
  const grid = document.getElementById('feedbackGrid');
  try {

  if(!list || list.length === 0){
    grid.innerHTML = '<div class="asset-empty"><div class="icon">💬</div><h3>暂无反馈记录</h3><p>在生成内容后点击"反馈改进"按钮添加反馈</p></div>';
    return;
  }

  const typeLabels = { copywriting: '文案', article: '写稿', image_gen: '图片' };

  // 学习概览统计
  const totalCount = list.length;
  const ratedItems = list.filter(i => i.rating);
  const avgRating = ratedItems.length ? (ratedItems.reduce((s, i) => s + i.rating, 0) / ratedItems.length).toFixed(1) : '-';
  const highRated = ratedItems.filter(i => i.rating >= 4).length;
  const highRatedPct = ratedItems.length ? Math.round(highRated / ratedItems.length * 100) : 0;
  // 提取反馈关键词
  const feedbackTexts = list.map(i => i.feedback_text || '').join('，');
  const keywords = {};
  ['语气','生硬','卖点','开头','结尾','太长','太短','不够','突出','自然','吸引','专业','亲切','emoji','格式'].forEach(kw => {
    const count = (feedbackTexts.match(new RegExp(kw, 'g')) || []).length;
    if(count > 0) keywords[kw] = count;
  });
  const topKeywords = Object.entries(keywords).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const keywordsHtml = topKeywords.map(([kw, n]) => `<span style="display:inline-block;padding:4px 10px;background:#F3E8FF;color:#7C3AED;border-radius:12px;font-size:12px;margin:2px">${kw} (${n})</span>`).join('');

  const overviewHtml = `
    <div style="background:linear-gradient(135deg,#EFF6FF,#F0FDF4);border:1px solid #BFDBFE;border-radius:12px;padding:20px;margin-bottom:20px">
      <h3 style="margin:0 0 16px;font-size:16px;color:#1E40AF">📊 学习概览</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center">
        <div><div style="font-size:28px;font-weight:800;color:#1E40AF">${totalCount}</div><div style="font-size:12px;color:#6B7280">总反馈次数</div></div>
        <div><div style="font-size:28px;font-weight:800;color:#F59E0B">${avgRating}${avgRating !== '-' ? '★' : ''}</div><div style="font-size:12px;color:#6B7280">平均评分</div></div>
        <div><div style="font-size:28px;font-weight:800;color:#10B981">${highRatedPct}%</div><div style="font-size:12px;color:#6B7280">高分占比</div></div>
        <div><div style="font-size:28px;font-weight:800;color:#8B5CF6">${ratedItems.length}</div><div style="font-size:12px;color:#6B7280">已评分</div></div>
      </div>
      ${topKeywords.length ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #BFDBFE"><div style="font-size:12px;color:#6B7280;margin-bottom:8px">🔤 高频反馈关键词</div>${keywordsHtml}</div>` : ''}
    </div>
  `;

  grid.innerHTML = overviewHtml + list.map(item => {
    const date = new Date(item.created_at).toLocaleDateString('zh-CN');
    const typeLabel = typeLabels[item.gen_type] || escapeHtml(item.gen_type);
    const changes = item.changes_summary || [];
    const changesHtml = changes.map(c => `<div class="feedback-card-change">• ${escapeHtml(c)}</div>`).join('');

    return `
      <div class="feedback-card">
        <div class="feedback-card-header">
          <div>
            <span class="feedback-card-type">${typeLabel}</span>
            ${item.rating ? `<span style="margin-left:8px;font-size:12px;color:#9CA3AF">原评分：${'★'.repeat(item.rating)}</span>` : ''}
          </div>
          <span class="feedback-card-date">${escapeHtml(date)}</span>
        </div>
        <div class="feedback-card-body">
          <div class="feedback-compare">
            <div class="feedback-compare-box">
              <div class="feedback-compare-label before">❌ 反馈前</div>
              <div class="feedback-compare-content">${escapeHtml(item.original_content)}</div>
            </div>
            <div class="feedback-compare-box">
              <div class="feedback-compare-label after">✅ 反馈后</div>
              <div class="feedback-compare-content">${escapeHtml(item.improved_content) || '无'}</div>
            </div>
          </div>
          <div class="feedback-card-feedback">
            <strong>💬 用户反馈：</strong>${escapeHtml(item.feedback_text)}
          </div>
          ${changesHtml ? `<div class="feedback-card-changes"><h4>📝 修改说明</h4>${changesHtml}</div>` : ''}
          ${item.learnings ? `<div class="feedback-card-learning"><strong>🧠 学习记录：</strong>${escapeHtml(item.learnings)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  } catch(e){
    console.error('renderFeedbackList error:', e);
    grid.innerHTML = '<div class="asset-empty"><div class="icon">❌</div><h3>渲染出错，请刷新页面</h3></div>';
  }
}

// ========== LIGHTBOX (use imgLightbox) ==========
// openLightbox/closeLightbox/downloadImage defined at end of file

// ========== TEXT MODAL ==========
let currentModalText = '';
function openTextModal(title, text){
  currentModalText = text;
  document.getElementById('textModalTitle').textContent = title;
  document.getElementById('textModalBody').textContent = text;
  document.getElementById('textModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeTextModal(){
  document.getElementById('textModal').classList.remove('show');
  document.body.style.overflow = '';
}
function copyModalText(){
  copyToClipboard(currentModalText, event.target, '复制全文');
}

// ========== AUTO-FILL PREFERENCES ==========
async function autoFillPreferences() {
  if (!isLoggedIn()) return;

  try {
    // 文案类型偏好
    const copyTypes = await getUserPreferences('copy_type');
    if (copyTypes.length > 0) {
      const select = document.getElementById('copyType');
      if (select) {
        const option = Array.from(select.options).find(o => o.value === copyTypes[0]);
        if (option) select.value = copyTypes[0];
      }
    }

    // 文案品牌偏好
    const copyBrands = await getUserPreferences('copy_brand');
    if (copyBrands.length > 0) {
      const input = document.getElementById('copyBrand');
      if (input && !input.value) input.value = copyBrands[0];
    }

    // 文案平台偏好
    const copyPlatforms = await getUserPreferences('copy_platform');
    if (copyPlatforms.length > 0) {
      const select = document.getElementById('copyPlatform');
      if (select) {
        const option = Array.from(select.options).find(o => o.value === copyPlatforms[0]);
        if (option) select.value = copyPlatforms[0];
      }
    }

    // 图片尺寸偏好
    const imgSizes = await getUserPreferences('img_size');
    if (imgSizes.length > 0) {
      imgSize = imgSizes[0];
      document.querySelectorAll('.gen-size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(imgSize === '1024x1024' ? '1:1' : imgSize === '1792x1024' ? '16:9' : '9:16'));
      });
    }

    console.log('偏好已自动填充');
  } catch (e) {
    console.warn('自动填充偏好失败:', e);
  }
}

// 登录后自动填充偏好
const originalUpdateAuthUI = window.updateAuthUI;
if (typeof originalUpdateAuthUI === 'function') {
  window.updateAuthUI = function() {
    originalUpdateAuthUI();
    if (isLoggedIn()) {
      setTimeout(autoFillPreferences, 500);
    }
  };
}

// ========== STAR RATING SYSTEM ==========
const ratingHistoryIds = {}; // 存储每个生成的历史ID
const ratingContents = {}; // 存储每个生成的内容
const ratingTypes = {}; // 存储每个生成的类型

function createStarRating(containerId, historyId, content, genType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  ratingHistoryIds[containerId] = historyId;
  ratingContents[containerId] = content || '';
  ratingTypes[containerId] = genType || 'copywriting';

  container.innerHTML = `
    <div class="star-rating">
      <span class="star-rating-label">这次生成满意吗？</span>
      <div class="star-rating-stars" id="${containerId}_stars">
        <span class="star" data-value="1" onclick="rateGeneration('${containerId}', 1)">★</span>
        <span class="star" data-value="2" onclick="rateGeneration('${containerId}', 2)">★</span>
        <span class="star" data-value="3" onclick="rateGeneration('${containerId}', 3)">★</span>
        <span class="star" data-value="4" onclick="rateGeneration('${containerId}', 4)">★</span>
        <span class="star" data-value="5" onclick="rateGeneration('${containerId}', 5)">★</span>
      </div>
      <button class="feedback-btn" onclick="openFeedbackFromRating('${containerId}')">💬 反馈改进</button>
      <span class="star-rating-msg" id="${containerId}_msg">点击星星评分</span>
    </div>
  `;

  // 添加 hover 效果
  const stars = container.querySelectorAll('.star');
  stars.forEach(star => {
    star.addEventListener('mouseenter', function() {
      const val = parseInt(this.dataset.value);
      stars.forEach(s => {
        s.classList.toggle('hover', parseInt(s.dataset.value) <= val);
      });
    });
    star.addEventListener('mouseleave', function() {
      stars.forEach(s => s.classList.remove('hover'));
    });
  });
}

// 从评分组件打开反馈对话框
function openFeedbackFromRating(containerId) {
  const historyId = ratingHistoryIds[containerId];
  const content = ratingContents[containerId];
  const genType = ratingTypes[containerId];
  const rating = document.querySelectorAll(`#${containerId}_stars .star.active`).length || null;

  if (!content) {
    showToast('没有可反馈的内容', 'warning');
    return;
  }

  openFeedbackModal(historyId, genType, content, rating);
}

async function rateGeneration(containerId, rating) {
  const historyId = ratingHistoryIds[containerId];
  const content = ratingContents[containerId];

  const stars = document.querySelectorAll(`#${containerId}_stars .star`);
  stars.forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= rating);
    s.classList.remove('hover');
  });

  const msg = document.getElementById(`${containerId}_msg`);
  msg.textContent = '感谢评分！';
  msg.className = 'star-rating-msg success';

  // 保存评分到数据库（如果已登录且有 historyId）
  if(historyId && isLoggedIn()){
    await updateGenerationRating(historyId, rating);
  }

  // 更新素材库中的评分
  if(content){
    updateAssetRating(content, rating);
  }

  // 3秒后隐藏提示
  setTimeout(() => {
    msg.style.display = 'none';
  }, 3000);
}

// ========== INIT ==========
initFilters();
render();
initDragDrop();
initMaskCanvasEvents();
initArticleDragDrop();
restoreRecentResults();


  // 如果 auth.js 加载失败，确保登录按钮可见
  setTimeout(function() {
    var us = document.getElementById('userSection');
    if (us && us.children.length === 0) {
      us.innerHTML = '<button onclick="showLoginModal()" style="padding:8px 24px;background:#F4845F;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-left:auto;">登录</button>';
    }
  }, 2000);


// 反馈相关变量
let feedbackData = {
  history_id: null,
  gen_type: '',
  original_content: '',
  rating: null
};

// 打开反馈对话框
function openFeedbackModal(historyId, genType, originalContent, rating) {
  feedbackData = { history_id: historyId, gen_type: genType, original_content: originalContent, rating: rating };

  document.getElementById('feedbackOriginal').textContent = originalContent;
  document.getElementById('feedbackText').value = '';
  document.getElementById('feedbackImproved').textContent = '';
  document.getElementById('feedbackChangesList').innerHTML = '';
  document.getElementById('feedbackLearnings').textContent = '';

  document.getElementById('feedbackInputSection').style.display = 'block';
  document.getElementById('feedbackResultSection').style.display = 'none';
  document.getElementById('feedbackSubmitBtn').style.display = 'inline-block';
  document.getElementById('feedbackSubmitBtn').disabled = false;
  document.getElementById('feedbackSubmitBtn').textContent = '🚀 开始改进';
  document.getElementById('feedbackSaveBtn').style.display = 'none';

  document.getElementById('feedbackModal').classList.add('show');
}

// 关闭反馈对话框
function closeFeedbackModal() {
  document.getElementById('feedbackModal').classList.remove('show');
}

// 提交反馈
async function submitFeedback() {
  const feedbackText = document.getElementById('feedbackText').value.trim();
  if (!feedbackText) {
    showToast('请描述不满意的地方', 'warning');
    return;
  }

  const btn = document.getElementById('feedbackSubmitBtn');
  btn.disabled = true;
  btn.textContent = '改进中...';

  try {
    const resp = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'feedback',
        original_content: feedbackData.original_content,
        feedback_text: feedbackText,
        gen_type: feedbackData.gen_type
      })
    });

    const data = await resp.json();

    if (data.error) {
      showToast('改进失败：' + data.error, 'error');
      btn.disabled = false;
      btn.textContent = '🚀 开始改进';
      return;
    }

    // 显示结果
    document.getElementById('feedbackInputSection').style.display = 'none';
    document.getElementById('feedbackResultSection').style.display = 'block';
    document.getElementById('feedbackImproved').textContent = data.improved_content || '';

    // 显示修改说明
    const changesList = document.getElementById('feedbackChangesList');
    changesList.innerHTML = '';
    if (data.changes_summary && data.changes_summary.length > 0) {
      data.changes_summary.forEach(change => {
        const div = document.createElement('div');
        div.className = 'feedback-change-item';
        div.innerHTML = '<span>•</span><span>' + change + '</span>';
        changesList.appendChild(div);
      });
    }

    // 显示学习记录
    const learningsDiv = document.getElementById('feedbackLearnings');
    if (data.learnings) {
      learningsDiv.innerHTML = '<strong>🧠 学习记录：</strong>' + data.learnings;
      learningsDiv.style.display = 'block';
    } else {
      learningsDiv.style.display = 'none';
    }

    // 保存到数据库
    const feedbackId = await saveFeedback({
      ...feedbackData,
      feedback_text: feedbackText,
      improved_content: data.improved_content,
      changes_summary: data.changes_summary,
      learnings: data.learnings
    });

    btn.style.display = 'none';
    document.getElementById('feedbackSaveBtn').style.display = 'inline-block';

  } catch (e) {
    showToast('改进失败：' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = '🚀 开始改进';
  }
}

// 保存反馈结果
function saveFeedbackResult() {
  showToast('已保存到反馈库！');
  closeFeedbackModal();
  // 如果在反馈库页面，刷新列表
  if (typeof loadFeedbackList === 'function') {
    loadFeedbackList();
  }
}


let lightboxGallery = [];
let lightboxIndex = 0;
let lightboxScale = 1;

function openLightbox(src, gallery){
  if(!src || !isValidImageUrl(src)) return;
  lightboxGallery = gallery || [src];
  lightboxIndex = lightboxGallery.indexOf(src);
  if(lightboxIndex < 0) lightboxIndex = 0;
  lightboxScale = 1;
  const img = document.getElementById('lightboxImg');
  img.src = src;
  img.style.transform = 'scale(1)';
  document.getElementById('imgLightbox').classList.add('show');
  // 显示/隐藏导航箭头
  const prevBtn = document.querySelector('.lightbox-nav.prev');
  const nextBtn = document.querySelector('.lightbox-nav.next');
  if(prevBtn) prevBtn.style.display = lightboxGallery.length > 1 ? '' : 'none';
  if(nextBtn) nextBtn.style.display = lightboxGallery.length > 1 ? '' : 'none';
}
function closeLightbox(e){
  if(e && e.target === document.getElementById('lightboxImg')) return;
  document.getElementById('imgLightbox').classList.remove('show');
  lightboxScale = 1;
}
function lightboxNav(dir){
  if(lightboxGallery.length <= 1) return;
  lightboxIndex = (lightboxIndex + dir + lightboxGallery.length) % lightboxGallery.length;
  const img = document.getElementById('lightboxImg');
  img.src = lightboxGallery[lightboxIndex];
  lightboxScale = 1;
  img.style.transform = 'scale(1)';
}
function lightboxZoom(dir){
  if(dir === 0) lightboxScale = 1;
  else lightboxScale = Math.max(0.5, Math.min(3, lightboxScale + dir * 0.25));
  document.getElementById('lightboxImg').style.transform = `scale(${lightboxScale})`;
}
function downloadImage(){
  const src = document.getElementById('imgResult').src;
  if(!src) return;
  const a = document.createElement('a');
  a.href = src;
  a.download = 'mengli-image-' + Date.now() + '.png';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ========== IMAGE COMPARE SLIDER ==========
let compareActive = false;
let compareOriginalSrc = '';

function showCompare(originalSrc, generatedSrc){
  compareOriginalSrc = originalSrc;
  const container = document.getElementById('imgCompare');
  const before = document.getElementById('imgCompareBefore');
  const after = document.getElementById('imgCompareAfter');
  const overlay = document.getElementById('imgCompareOverlay');
  const handle = document.getElementById('imgCompareHandle');

  before.src = originalSrc;
  after.src = generatedSrc;
  overlay.style.width = '50%';
  handle.style.left = '50%';

  // 等 after 图加载完后，同步 before 图宽度
  after.onload = function(){
    before.style.width = container.offsetWidth + 'px';
  };
  // 如果已经缓存
  if(after.complete) before.style.width = container.offsetWidth + 'px';

  document.getElementById('imgResult').style.display = 'none';
  container.classList.add('show');
  document.getElementById('btnCompare').style.display = '';
  compareActive = true;
}

function toggleCompare(){
  const container = document.getElementById('imgCompare');
  const result = document.getElementById('imgResult');
  if(compareActive){
    container.classList.remove('show');
    result.style.display = 'block';
    compareActive = false;
    document.getElementById('btnCompare').textContent = '🔄 对比原图';
  } else {
    container.classList.add('show');
    result.style.display = 'none';
    compareActive = true;
    document.getElementById('btnCompare').textContent = '🖼 查看生成图';
  }
}

// 对比滑块拖拽
(function(){
  const container = document.getElementById('imgCompare');
  if(!container) return;
  let dragging = false;

  function updatePos(x){
    const rect = container.getBoundingClientRect();
    let pct = ((x - rect.left) / rect.width) * 100;
    pct = Math.max(5, Math.min(95, pct));
    document.getElementById('imgCompareOverlay').style.width = pct + '%';
    document.getElementById('imgCompareHandle').style.left = pct + '%';
  }

  container.addEventListener('mousedown', function(e){ dragging = true; updatePos(e.clientX); e.preventDefault(); });
  document.addEventListener('mousemove', function(e){ if(dragging) updatePos(e.clientX); });
  document.addEventListener('mouseup', function(){ dragging = false; });

  container.addEventListener('touchstart', function(e){ dragging = true; updatePos(e.touches[0].clientX); e.preventDefault(); }, {passive:false});
  document.addEventListener('touchmove', function(e){ if(dragging) updatePos(e.touches[0].clientX); });
  document.addEventListener('touchend', function(){ dragging = false; });

  // 窗口缩放时同步 before 图宽度
  window.addEventListener('resize', function(){
    if(compareActive){
      const before = document.getElementById('imgCompareBefore');
      before.style.width = container.offsetWidth + 'px';
    }
  });
})();


// ========== PROMPT TEMPLATES ==========
const BUILTIN_TEMPLATES = [
  { id:'builtin_1', name:'产品展示图', prompt:'产品名 产品描述，白色背景，专业产品摄影，柔和光线，高清细节', size:'1024x1024' },
  { id:'builtin_2', name:'生活场景图', prompt:'温馨的生活场景，自然光线，真实感，高质量摄影', size:'1024x1024' },
  { id:'builtin_3', name:'营销海报', prompt:'品牌营销海报，主题文字区域，吸引眼球的配色，专业设计感', size:'1024x1792' },
  { id:'builtin_4', name:'社交媒体竖版', prompt:'适合小红书的竖版图片，清新风格，吸引眼球，高品质', size:'1024x1792' },
  { id:'builtin_5', name:'横版Banner', prompt:'网站横幅广告，简洁大气，品牌色调，有号召力', size:'1792x1024' },
];

function getCustomTemplates(){
  try{ return JSON.parse(localStorage.getItem('prompt_templates') || '[]'); }catch(e){ return []; }
}
function saveCustomTemplates(tpls){
  localStorage.setItem('prompt_templates', JSON.stringify(tpls));
}

// 从 Supabase 加载模板并缓存到 localStorage
async function loadCustomTemplatesFromRemote(){
  if(typeof getUserTemplates === 'function' && isLoggedIn()){
    try {
      const remote = await getUserTemplates();
      if(remote.length > 0){
        saveCustomTemplates(remote);
        return remote;
      }
    } catch(e){ console.warn('从 Supabase 加载模板失败:', e); }
  }
  return getCustomTemplates();
}

function toggleTemplatePanel(){
  const panel = document.getElementById('templatePanel');
  if(!panel) return;
  panel.classList.toggle('show');
  if(panel.classList.contains('show')) renderTemplatePanel();
}

// 模板面板事件委托（只绑定一次）
let _tplPanelBound = false;
function bindTemplatePanelEvents(){
  if(_tplPanelBound) return;
  const panel = document.getElementById('templatePanel');
  if(!panel) return;
  panel.addEventListener('click', (e) => {
    // 删除按钮
    const del = e.target.closest('.tpl-delete');
    if(del){
      e.stopPropagation();
      deleteTemplate(del.dataset.id);
      return;
    }
    // 保存按钮
    if(e.target.closest('.tpl-save-btn')){
      saveCurrentAsTemplate();
      return;
    }
    // 模板项点击
    const item = e.target.closest('.tpl-item');
    if(item){
      applyTemplate(item.dataset.prompt, item.dataset.size);
    }
  });
  _tplPanelBound = true;
}

function renderTemplatePanel(){
  const panel = document.getElementById('templatePanel');
  const customs = getCustomTemplates();
  let html = '<div class="tpl-section"><div class="tpl-section-title">内置模板</div>';
  BUILTIN_TEMPLATES.forEach(t => {
    html += `<div class="tpl-item" data-prompt="${escapeHtml(t.prompt)}" data-size="${t.size}">
      <div class="tpl-item-name">${escapeHtml(t.name)}</div>
      <div class="tpl-item-preview">${escapeHtml(t.prompt.substring(0,40))}...</div>
    </div>`;
  });
  html += '</div>';
  if(customs.length){
    html += '<div class="tpl-section"><div class="tpl-section-title">我的模板</div>';
    customs.forEach(t => {
      html += `<div class="tpl-item" data-prompt="${escapeHtml(t.prompt)}" data-size="${t.size}">
        <div class="tpl-item-name">${escapeHtml(t.name)} <span class="tpl-delete" data-id="${t.id}">✕</span></div>
        <div class="tpl-item-preview">${escapeHtml(t.prompt.substring(0,40))}...</div>
      </div>`;
    });
    html += '</div>';
  }
  html += '<div class="tpl-save-btn">💾 保存当前为模板</div>';
  panel.innerHTML = html;
  bindTemplatePanelEvents();
}

function applyTemplate(prompt, size){
  document.getElementById('imgPrompt').value = prompt;
  setImgSize(size, document.querySelector(`.gen-size-btn[onclick*="${size}"]`) || document.querySelector('.gen-size-btn'));
  document.getElementById('templatePanel').classList.remove('show');
}

function saveCurrentAsTemplate(){
  const prompt = document.getElementById('imgPrompt').value.trim();
  if(!prompt){ showToast('请先输入图片描述', 'warning'); return; }
  const name = prompt.substring(0, 20) || '我的模板';
  const tpl = { id:'tpl_'+Date.now(), name, prompt, size:imgSize };
  const customs = getCustomTemplates();
  customs.push(tpl);
  saveCustomTemplates(customs);
  // 登录时同步到 Supabase
  if(typeof saveUserTemplate === 'function' && isLoggedIn()){
    saveUserTemplate(tpl);
  }
  renderTemplatePanel();
}

function deleteTemplate(id){
  const customs = getCustomTemplates().filter(t => t.id !== id);
  saveCustomTemplates(customs);
  // 登录时同步删除 Supabase
  if(typeof deleteUserTemplate === 'function' && isLoggedIn()){
    deleteUserTemplate(id);
  }
  renderTemplatePanel();
}


// ========== BATCH ASSET OPERATIONS ==========
let batchMode = false;
let selectedAssets = new Set();

function toggleBatchMode(){
  batchMode = !batchMode;
  selectedAssets.clear();
  const btn = document.getElementById('batchToggleBtn');
  const toolbar = document.getElementById('batchToolbar');
  if(btn) btn.textContent = batchMode ? '取消批量' : '批量管理';
  if(toolbar) toolbar.style.display = batchMode ? 'flex' : 'none';
  renderAssets();
}

function toggleAssetSelect(id){
  if(selectedAssets.has(id)) selectedAssets.delete(id);
  else selectedAssets.add(id);
  updateBatchCount();
  // 更新卡片样式
  const card = document.querySelector(`.asset-card[data-id="${id}"]`);
  if(card) card.classList.toggle('selected', selectedAssets.has(id));
}

function selectAllAssets(){
  const filtered = getFilteredAssets();
  if(selectedAssets.size === filtered.length){
    selectedAssets.clear();
  } else {
    filtered.forEach(a => selectedAssets.add(a.id));
  }
  updateBatchCount();
  renderAssets();
}

function getFilteredAssets(){
  const search = (document.getElementById('assetsSearchInput')?.value || '').toLowerCase();
  let filtered = assets;
  if(currentAssetTab !== 'all') filtered = filtered.filter(a => a.type === currentAssetTab);
  if(search) filtered = filtered.filter(a => a.title.toLowerCase().includes(search) || (a.content && a.content.toLowerCase().includes(search)));
  if(currentRatingFilter !== 'all') filtered = filtered.filter(a => a.rating && a.rating >= currentRatingFilter && a.rating < currentRatingFilter + 1);
  return filtered;
}

function updateBatchCount(){
  const count = document.getElementById('batchCount');
  if(count) count.textContent = selectedAssets.size;
}

function deleteSelectedAssets(){
  if(!selectedAssets.size){ showToast('请先选择素材', 'warning'); return; }
  if(!confirm(`确定删除选中的 ${selectedAssets.size} 个素材？`)) return;
  const ids = [...selectedAssets];
  assets = assets.filter(a => !selectedAssets.has(a.id));
  localStorage.setItem('menlil_assets', JSON.stringify(assets));
  // 登录时同步删除 Supabase
  if(typeof deleteUserAssets === 'function' && isLoggedIn()){
    deleteUserAssets(ids);
  }
  selectedAssets.clear();
  updateBatchCount();
  renderAssets();
}


// ========== GENERATION HISTORY ==========
// 历史数据缓存（供事件委托使用）
let _historyData = [];
let _historyGridBound = false;
function bindHistoryGridEvents(){
  if(_historyGridBound) return;
  const container = document.getElementById('historyList');
  if(!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if(!btn) return;
    const card = btn.closest('.history-card');
    if(!card) return;
    const idx = Number(card.dataset.idx);
    const item = _historyData[idx];
    if(!item) return;
    const inputPreview = item.input_params ? JSON.parse(typeof item.input_params === 'string' ? item.input_params : JSON.stringify(item.input_params)) : {};
    if(btn.dataset.action === 'view'){
      if(item.gen_type === 'image_gen') openLightbox(item.output_content);
      else {
        // 展示输入参数 + 完整输出
        const params = inputPreview;
        let detail = '';
        if(params.prompt) detail += '提示词：' + params.prompt + '\n\n';
        if(params.extra) detail += '补充说明：' + params.extra + '\n\n';
        if(params.mode) detail += '模式：' + (params.mode === 'outline' ? '大纲' : '初稿') + '\n\n';
        if(detail) detail += '——— 生成结果 ———\n\n';
        detail += item.output_content || '';
        openTextModal(typeLabels[item.gen_type] || item.gen_type, detail || item.output_content || '');
      }
    } else if(btn.dataset.action === 'reuse'){
      reuseHistoryInput(item.gen_type, inputPreview);
    }
  });
  // 图片点击也打开灯箱
  container.addEventListener('click', (e) => {
    const img = e.target.closest('.history-preview img');
    if(img && img.src) openLightbox(img.src);
  });
  _historyGridBound = true;
}

const typeLabels = { image_gen:'图片', copywriting:'文案', article:'写稿' };

async function renderHistory(){
  const container = document.getElementById('historyList');
  if(!container) return;

  if(!isLoggedIn()){
    container.innerHTML = '<div class="asset-empty"><div class="icon">🔒</div><h3>请先登录</h3><p>登录后可查看生成历史</p></div>';
    return;
  }

  container.innerHTML = '<div class="asset-empty"><div class="icon">⏳</div><h3>加载中...</h3></div>';

  try {
    const historyList = await getGenerationHistoryList();
    _historyData = historyList || [];
    if(!_historyData.length){
      container.innerHTML = '<div class="asset-empty"><div class="icon">📭</div><h3>暂无生成历史</h3><p>去生成图片或文案吧</p></div>';
      return;
    }

    container.innerHTML = _historyData.map((item, idx) => {
      const date = new Date(item.created_at).toLocaleString('zh-CN');
      const typeLabel = typeLabels[item.gen_type] || escapeHtml(item.gen_type);
      const ratingHtml = item.rating ? `<span class="history-rating">${'★'.repeat(item.rating)}${'☆'.repeat(5-item.rating)}</span>` : '';
      const inputPreview = item.input_params ? JSON.parse(typeof item.input_params === 'string' ? item.input_params : JSON.stringify(item.input_params)) : {};
      const inputSummary = escapeHtml(inputPreview.prompt || inputPreview.product || inputPreview.topic || '-');

      if(item.gen_type === 'image_gen'){
        const safeSrc = isValidImageUrl(item.output_content) ? item.output_content : '';
        return `<div class="history-card" data-idx="${idx}">
          <div class="history-preview"><img src="${safeSrc}" alt=""></div>
          <div class="history-info">
            <div class="history-meta"><span class="history-type">${typeLabel}</span>${ratingHtml}<span class="history-date">${escapeHtml(date)}</span></div>
            <div class="history-input">${inputSummary}</div>
            <div class="history-actions">
              <button data-action="view">查看大图</button>
              <button data-action="reuse">使用此输入</button>
            </div>
          </div>
        </div>`;
      } else {
        return `<div class="history-card" data-idx="${idx}">
          <div class="history-text-preview">${escapeHtml((item.output_content||'').substring(0,120))}...</div>
          <div class="history-info">
            <div class="history-meta"><span class="history-type">${typeLabel}</span>${ratingHtml}<span class="history-date">${escapeHtml(date)}</span></div>
            <div class="history-input">输入：${inputSummary}</div>
            <div class="history-actions">
              <button data-action="view">查看完整</button>
              <button data-action="reuse">使用此输入</button>
            </div>
          </div>
        </div>`;
      }
    }).join('');

    bindHistoryGridEvents();
  } catch(e) {
    container.innerHTML = '<div class="asset-empty"><div class="icon">❌</div><h3>加载失败</h3></div>';
  }
}

function reuseHistoryInput(genType, params){
  if(genType === 'image_gen'){
    showPage('image');
    if(params.prompt) document.getElementById('imgPrompt').value = params.prompt;
    if(params.size){
      imgSize = params.size;
      document.querySelectorAll('.gen-size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(params.size === '1024x1024' ? '1:1' : params.size === '1792x1024' ? '16:9' : '9:16'));
      });
    }
  } else if(genType === 'copywriting'){
    showPage('copy');
    if(params.type) document.getElementById('copyType').value = params.type;
    if(params.brand) document.getElementById('copyBrand').value = params.brand;
    if(params.platform) document.getElementById('copyPlatform').value = params.platform;
    if(params.product) document.getElementById('copyProduct').value = params.product;
    if(params.prompt) document.getElementById('copyExtra').value = params.prompt;
  } else if(genType === 'article'){
    showPage('article');
    if(params.extra) document.getElementById('articleExtra').value = params.extra;
  }
}

function filterHistory(btn, genType){
  document.querySelectorAll('.history-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHistoryFiltered(genType);
}

async function renderHistoryFiltered(genType){
  const container = document.getElementById('historyList');
  if(!container || !isLoggedIn()) return;
  container.innerHTML = '<div class="asset-empty"><div class="icon">⏳</div><h3>加载中...</h3></div>';
  try {
    const historyList = await getGenerationHistoryList(genType);
    // 复用 renderHistory 的渲染逻辑
    if(!historyList || !historyList.length){
      container.innerHTML = '<div class="asset-empty"><div class="icon">📭</div><h3>暂无记录</h3></div>';
      return;
    }
    // 触发完整渲染
    renderHistory();
  } catch(e){
    container.innerHTML = '<div class="asset-empty"><div class="icon">❌</div><h3>加载失败</h3></div>';
  }
}


// ========== STREAMING API ==========
async function fetchStream(url, body, onChunk, onDone, onError){
  try {
    const resp = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, {stream:true});
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留未完成的行
      for(const line of lines){
        if(line.startsWith('data: ')){
          const data = line.slice(6).trim();
          if(data === '[DONE]'){ onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            if(parsed.text) onChunk(parsed.text);
          } catch(e){}
        }
      }
    }
    onDone();
  } catch(e){
    onError(e);
  }
}

// 流式文案生成
async function genCopyStream(){
  if(!hasPermission('copywriting')){ showUpgradePrompt('copywriting'); return; }
  const type = document.getElementById('copyType').value;
  const brand = document.getElementById('copyBrand').value;
  const platform = document.getElementById('copyPlatform').value;
  const product = document.getElementById('copyProduct').value.trim();
  const extra = document.getElementById('copyExtra').value.trim();
  if(!product && !extra){ showToast('请至少填写产品名称或补充要求', 'warning'); return; }

  const btn = document.getElementById('copyBtn');
  const out = document.getElementById('copyOutput');
  const retry = document.getElementById('copyRetry');
  btn.disabled = true; btn.textContent = '创作中...';
  retry.disabled = true;
  out.className = 'copy-output'; out.textContent = '';

  let examples = [];
  if(isLoggedIn()){
    try { const highRated = await getHighRatedExamples('copywriting'); examples = highRated.map(h => h.output_content).filter(Boolean); } catch(e){}
  }

  let fullText = '';
  let completed = false;

  function finalizeCopy(text){
    if(completed) return;
    completed = true;
    text = text.replace(/\*+/g, '');
    _lastCopyText = text;
    out.innerHTML = renderMarkdown(text);
    if(text){ saveAsset('copy', product || '文案', text); saveRecentResult('copy', {text}); }
    const inputParams = {type, brand, platform, product, prompt:extra};
    if(isLoggedIn()){
      saveGenerationHistory('copywriting', inputParams, text).then(historyId => {
        if(historyId) createStarRating('copyRating', historyId, text, 'copywriting');
      });
    } else {
      createStarRating('copyRating', null, text, 'copywriting');
    }
    btn.disabled = false; btn.textContent = '生成文案';
    retry.style.display = 'inline-flex'; retry.disabled = false;
    const tplBtn = document.getElementById('copySaveTpl');
    if(tplBtn) tplBtn.style.display = 'inline-flex';
  }

  fetchStream('/api', {
    action:'stream_copywriting', type, brand, platform, product, prompt:extra, examples
  },
  (chunk) => { fullText += chunk; _lastCopyText = fullText; out.innerHTML = renderMarkdown(fullText); updateWordCount(out, fullText); },
  () => { finalizeCopy(fullText); },
  (e) => {
    console.warn('Stream failed:', e);
    if(fullText.trim().length >= 30){
      showToast('⚠️ 流式中断，已保留已生成内容');
      finalizeCopy(fullText);
    } else {
      genCopy();
    }
  });
}

// 流式写稿生成
async function genArticleStream(){
  if(!hasPermission('article')){ showUpgradePrompt('article'); return; }

  const extra = document.getElementById('articleExtra').value.trim();
  const file = articleFiles.length > 0 ? articleFiles[0] : null;

  const btn = document.getElementById('articleBtn');
  const out = document.getElementById('articleOutput');
  const retry = document.getElementById('articleRetry');
  btn.disabled = true; btn.textContent = '创作中...';
  retry.disabled = true;
  out.className = 'article-output'; out.textContent = '';

  let fullText = '';
  let completed = false;

  function finalizeArticle(text){
    if(completed) return;
    completed = true;
    text = text.replace(/\*+/g, '');
    _lastArticleText = text;
    out.innerHTML = renderMarkdown(text);
    const label = articleMode === 'outline' ? '大纲' : '初稿';
    if(text){ saveAsset('article', label + (file ? ' — '+file.name : ''), text); saveRecentResult('article', {text}); }
    const inputParams = {mode:articleMode, extra};
    if(isLoggedIn()){
      saveGenerationHistory('article', inputParams, text).then(historyId => {
        if(historyId) createStarRating('articleRating', historyId, text, 'article');
      });
    } else {
      createStarRating('articleRating', null, text, 'article');
    }
    btn.disabled = false; btn.textContent = '生成写稿';
    retry.style.display = 'inline-flex'; retry.disabled = false;
    const tplBtn = document.getElementById('articleSaveTpl');
    if(tplBtn) tplBtn.style.display = 'inline-flex';
  }

  const body = { action:'stream_article', mode:articleMode, extra };
  if(file) body.file = { name:file.name, base64:file.base64, type:file.type };

  fetchStream('/api', body,
  (chunk) => { fullText += chunk; _lastArticleText = fullText; out.innerHTML = renderMarkdown(fullText); updateWordCount(out, fullText); },
  () => { finalizeArticle(fullText); },
  (e) => {
    console.warn('Stream failed:', e);
    if(fullText.trim().length >= 30){
      showToast('⚠️ 流式中断，已保留已生成内容');
      finalizeArticle(fullText);
    } else {
      // 非流式回退
      fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(r=>r.json()).then(d=>{ _lastArticleText=d.text||''; out.innerHTML=renderMarkdown(d.text||d.error||'生成失败'); finalizeArticle(d.text||''); })
        .catch(()=>{ out.className='article-output empty'; out.textContent=getApiErrorMessage(e); });
    }
  });
}
