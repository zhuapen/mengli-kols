
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
    if(e.name === 'TypeError' && e.message.includes('fetch')) return '网络连接失败，请检查网络';
    if(e.name === 'AbortError' || e.message.includes('timeout')) return '请求超时，服务器响应太慢';
    return '请求失败：' + (e.message || '未知错误');
  }
  if(data && data.error){
    const err = data.error;
    if(err.includes('API key') || err.includes('Unauthorized') || err.includes('401')) return 'API Key 未配置或已过期';
    if(err.includes('quota') || err.includes('429') || err.includes('rate')) return 'API 调用额度已用完，请稍后再试';
    if(err.includes('timeout') || err.includes('timed out')) return 'AI 生成超时，请缩短内容后重试';
    if(err.includes('content_policy') || err.includes('safety')) return '内容触发安全限制，请修改描述后重试';
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

function getData(){ return currentPlatform==='xhs' ? XHS_DATA : DOUYIN_DATA; }

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
  if(cart.length===0) return alert('请先添加达人');
  alert(`已向 ${cart.length} 位达人发起询单`);
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
    result.textContent = data.explanation || 'AI 已帮你筛选好了';
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
  if(remaining <= 0){ alert('最多上传3张图片'); return; }
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
}

function removeImg2img(index){
  img2imgFiles.splice(index, 1);
  renderImg2imgGrid();
}

async function genImage(){
  // 检查权限
  if (!hasPermission('image_gen')) {
    showUpgradePrompt('image_gen');
    return;
  }

  let prompt = '';
  let requestBody = {};

  if(imgMode === 'text2img'){
    prompt = document.getElementById('imgPrompt').value.trim();
    if(!prompt){ alert('请输入图片描述'); return; }
    requestBody = { action:'image_gen', prompt, size:imgSize };
  } else {
    prompt = document.getElementById('img2imgPrompt').value.trim();
    if(!img2imgFiles.length){ alert('请上传参考图片'); return; }
    if(!prompt){ alert('请输入修改要求'); return; }
    requestBody = { action:'image_edit', prompt, images:img2imgFiles, size:imgSize };
  }

  document.getElementById('imgBtn').disabled = true;
  document.getElementById('imgPlaceholder').style.display = 'none';
  document.getElementById('imgLoading').style.display = 'block';
  document.getElementById('imgResult').style.display = 'none';
  document.getElementById('imgToolbar').classList.remove('show');
  document.getElementById('imgCompare').classList.remove('show');
  document.getElementById('btnCompare').style.display = 'none';
  compareActive = false;

  try{
    const resp = await fetch('/api', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(requestBody)
    });
    const data = await resp.json();
    if(data.image_url){
      document.getElementById('imgLoading').style.display = 'none';
      document.getElementById('imgResult').src = data.image_url;
      document.getElementById('imgResult').style.display = 'block';
      document.getElementById('imgToolbar').classList.add('show');
      saveAsset('image', prompt, data.image_url);

      // 图生图模式：显示对比滑块
      if(imgMode === 'img2img' && img2imgFiles.length > 0){
        showCompare(img2imgFiles[0], data.image_url);
      } else {
        document.getElementById('imgCompare').classList.remove('show');
        document.getElementById('btnCompare').style.display = 'none';
        compareActive = false;
      }

      // 保存历史并显示评分
      if(isLoggedIn()){
        saveGenerationHistory('image_gen', {prompt, size:imgSize}, data.image_url).then(historyId => {
          if(historyId) createStarRating('imgRating', historyId, prompt, 'image_gen');
        });
        savePreference('img_size', imgSize);
      } else {
        // 未登录也显示评分（但不保存）
        createStarRating('imgRating', null, prompt, 'image_gen');
      }
    } else {
      document.getElementById('imgLoading').style.display = 'none';
      document.getElementById('imgPlaceholder').style.display = 'block';
      document.getElementById('imgPlaceholder').innerHTML = '<div class="icon">❌</div><p>'+getApiErrorMessage(null, data)+'</p>';
    }
  } catch(e){
    document.getElementById('imgLoading').style.display = 'none';
    document.getElementById('imgPlaceholder').style.display = 'block';
    document.getElementById('imgPlaceholder').innerHTML = '<div class="icon">❌</div><p>'+getApiErrorMessage(e)+'</p>';
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

  if(!product && !extra){ alert('请至少填写产品名称或补充要求'); return; }

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
    out.textContent = data.text || data.error || '生成失败';
    if(data.text) {
      saveAsset('copy', product || '文案', data.text);

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

function copyText(){
  const text = document.getElementById('copyOutput').textContent;
  if(text && !text.includes('未启动')){
    navigator.clipboard.writeText(text).then(()=>{
      const btn = event.target; btn.textContent = '已复制'; setTimeout(()=>btn.textContent='复制文案',1500);
    });
  }
}

// ========== PAGE LOADER ==========
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('pageLoader').classList.add('hide');
  }, 2000);
});

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
  const name = document.getElementById('brandName').value.trim();
  if(!name){ alert('请输入品牌名称'); return; }
  const brand = {
    id: 'brand_' + Date.now(),
    name: name,
    desc: document.getElementById('brandDesc').value.trim(),
    tone: document.getElementById('brandTone').value.trim(),
    points: document.getElementById('brandPoints').value.trim()
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
  const selects = ['copyBrand', 'articleBrand'];
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

// ========== ARTICLE ==========
async function genArticle(){
  // 检查权限
  if (!hasPermission('article')) {
    showUpgradePrompt('article');
    return;
  }

  const type = document.getElementById('articleType').value;
  const brand = document.getElementById('articleBrand').value;
  const topic = document.getElementById('articleTopic').value.trim();
  const audience = document.getElementById('articleAudience').value.trim();
  const points = document.getElementById('articlePoints').value.trim();
  const extra = document.getElementById('articleExtra').value.trim();

  if(!topic){ alert('请输入文章主题'); return; }

  const btn = document.getElementById('articleBtn');
  const out = document.getElementById('articleOutput');
  const retry = document.getElementById('articleRetry');
  btn.disabled = true; btn.textContent = '创作中...';
  retry.disabled = true;
  out.className = 'article-output'; out.textContent = '';

  try{
    // 获取高分历史案例
    let examples = [];
    if(isLoggedIn()){
      const highRated = await getHighRatedExamples('article');
      examples = highRated.map(h => h.output_content).filter(Boolean);
    }

    const resp = await fetch('/api', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        action:'article',
        type,
        brand,
        topic,
        audience,
        points,
        prompt: extra,
        examples
      })
    });
    const data = await resp.json();
    out.textContent = data.text || data.error || '生成失败';
    if(data.text) {
      saveAsset('article', topic, data.text);

      // 保存历史并显示评分
      const inputParams = {type, brand, topic, audience, points, prompt:extra};
      if(isLoggedIn()){
        saveGenerationHistory('article', inputParams, data.text).then(historyId => {
          if(historyId) createStarRating('articleRating', historyId, data.text, 'article');
        });
        if(type) savePreference('article_type', type);
        if(brand) savePreference('article_brand', brand);
      } else {
        createStarRating('articleRating', null, data.text, 'article');
      }
    }
  } catch(e){
    out.className = 'article-output empty'; out.textContent = getApiErrorMessage(e);
  }
  btn.disabled = false; btn.textContent = '生成写稿';
  retry.style.display = 'inline-flex';
  retry.disabled = false;
}

function copyArticle(){
  const text = document.getElementById('articleOutput').textContent;
  if(text && !text.includes('未启动')){
    navigator.clipboard.writeText(text).then(()=>{
      const btn = event.target; btn.textContent = '已复制'; setTimeout(()=>btn.textContent='复制全文',1500);
    });
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
    return;
  }

  grid.innerHTML = filtered.map(asset => {
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

  bindAssetsGridEvents();
}

function switchAssetsTab(tab, btn){
  currentAssetTab = tab;
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
  renderAssets();
}

// 评分筛选
let currentRatingFilter = 'all';

function filterByRating(rating, btn){
  currentRatingFilter = rating;
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
  navigator.clipboard.writeText(currentModalText).then(()=>{
    const btn = event.target;
    btn.textContent = '已复制';
    setTimeout(()=>btn.textContent='复制全文', 1500);
  });
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

    // 写稿类型偏好
    const articleTypes = await getUserPreferences('article_type');
    if (articleTypes.length > 0) {
      const select = document.getElementById('articleType');
      if (select) {
        const option = Array.from(select.options).find(o => o.value === articleTypes[0]);
        if (option) select.value = articleTypes[0];
      }
    }

    // 写稿品牌偏好
    const articleBrands = await getUserPreferences('article_brand');
    if (articleBrands.length > 0) {
      const input = document.getElementById('articleBrand');
      if (input && !input.value) input.value = articleBrands[0];
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
    alert('没有可反馈的内容');
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
    alert('请描述不满意的地方');
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
      alert('改进失败：' + data.error);
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
    alert('改进失败：' + e.message);
    btn.disabled = false;
    btn.textContent = '🚀 开始改进';
  }
}

// 保存反馈结果
function saveFeedbackResult() {
  alert('已保存到反馈库！');
  closeFeedbackModal();
  // 如果在反馈库页面，刷新列表
  if (typeof loadFeedbackList === 'function') {
    loadFeedbackList();
  }
}


function openLightbox(src){
  if(!src || !isValidImageUrl(src)) return;
  document.getElementById('lightboxImg').src = src;
  document.getElementById('imgLightbox').classList.add('show');
}
function closeLightbox(e){
  if(e.target === document.getElementById('lightboxImg')) return;
  document.getElementById('imgLightbox').classList.remove('show');
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
  if(!prompt){ alert('请先输入图片描述'); return; }
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
  if(!selectedAssets.size){ alert('请先选择素材'); return; }
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
      else openTextModal(typeLabels[item.gen_type] || item.gen_type, item.output_content || '');
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
    if(params.type) document.getElementById('articleType').value = params.type;
    if(params.brand) document.getElementById('articleBrand').value = params.brand;
    if(params.topic) document.getElementById('articleTopic').value = params.topic;
    if(params.audience) document.getElementById('articleAudience').value = params.audience;
    if(params.points) document.getElementById('articlePoints').value = params.points;
    if(params.prompt) document.getElementById('articleExtra').value = params.prompt;
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
  if(!product && !extra){ alert('请至少填写产品名称或补充要求'); return; }

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
  fetchStream('/api', {
    action:'stream_copywriting', type, brand, platform, product, prompt:extra, examples
  },
  (chunk) => { fullText += chunk; out.textContent = fullText; },
  () => {
    fullText = fullText.replace(/\*+/g, '');
    out.textContent = fullText;
    if(fullText) saveAsset('copy', product || '文案', fullText);
    const inputParams = {type, brand, platform, product, prompt:extra};
    if(isLoggedIn()){
      saveGenerationHistory('copywriting', inputParams, fullText).then(historyId => {
        if(historyId) createStarRating('copyRating', historyId, fullText, 'copywriting');
      });
    } else {
      createStarRating('copyRating', null, fullText, 'copywriting');
    }
    btn.disabled = false; btn.textContent = '生成文案';
    retry.style.display = 'inline-flex'; retry.disabled = false;
  },
  (e) => {
    // 流式失败，回退到普通模式
    console.warn('Stream failed, falling back:', e);
    genCopy();
  });
}

// 流式写稿生成
async function genArticleStream(){
  if(!hasPermission('article')){ showUpgradePrompt('article'); return; }
  const type = document.getElementById('articleType').value;
  const brand = document.getElementById('articleBrand').value;
  const topic = document.getElementById('articleTopic').value.trim();
  const audience = document.getElementById('articleAudience').value.trim();
  const points = document.getElementById('articlePoints').value.trim();
  const extra = document.getElementById('articleExtra').value.trim();
  if(!topic){ alert('请填写文章主题'); return; }

  const btn = document.getElementById('articleBtn');
  const out = document.getElementById('articleOutput');
  const retry = document.getElementById('articleRetry');
  btn.disabled = true; btn.textContent = '创作中...';
  retry.disabled = true;
  out.className = 'article-output'; out.textContent = '';

  let fullText = '';
  fetchStream('/api', {
    action:'stream_article', type, brand, topic, audience, points, prompt:extra
  },
  (chunk) => { fullText += chunk; out.textContent = fullText; },
  () => {
    fullText = fullText.replace(/\*+/g, '');
    out.textContent = fullText;
    if(fullText) saveAsset('article', topic || '写稿', fullText);
    const inputParams = {type, brand, topic, audience, points, prompt:extra};
    if(isLoggedIn()){
      saveGenerationHistory('article', inputParams, fullText).then(historyId => {
        if(historyId) createStarRating('articleRating', historyId, fullText, 'article');
      });
    } else {
      createStarRating('articleRating', null, fullText, 'article');
    }
    btn.disabled = false; btn.textContent = '生成写稿';
    retry.style.display = 'inline-flex'; retry.disabled = false;
  },
  (e) => {
    console.warn('Stream failed, falling back:', e);
    genArticle();
  });
}
