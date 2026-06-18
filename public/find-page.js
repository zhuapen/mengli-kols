// ============================================================
//  智能媒体库 — 独立 JS 模块
//  从 codex/smart-media-library-incremental-find 分支提取
//  API 地址通过 MEDIA_API_BASE 配置，指向独立服务
// ============================================================

// ===== 配置 =====
// 优先级：window.MEDIA_API_BASE > index.html 中的 meta 标签 > 默认空（同源）
const MEDIA_API_BASE = window.MEDIA_API_BASE
  || document.querySelector('meta[name="media-api-base"]')?.content
  || 'https://media-api.mengliai.cn';  // 生产环境地址

// ===== 状态变量 =====
let currentProjectId = null;
let projects = [];
let currentAnalysis = null;
let collectionTasks = [];
let syntheticCandidates = [];
let recommendations = [];
let feedbacks = JSON.parse(localStorage.getItem('mengli_feedbacks') || '[]');
let memories = JSON.parse(localStorage.getItem('mengli_memories') || '[]');
let excludedUids = new Set();
let databaseCreators = JSON.parse(localStorage.getItem('mengli_database_creators') || '[]');
let databaseTagOverrides = JSON.parse(localStorage.getItem('mengli_database_tag_overrides') || '{}');
let backendDatabaseCreators = [];
let backendRepairRecords = [];
let candidatePool = [];
let serverCandidates = [];
let serverRecommendations = [];
let activeCollector = null;
let activeCodexTask = null;
let findCurrentView = 'findHomeView';
let databasePage = 1;
const DATABASE_PAGE_SIZE = 50;

// ===== API 辅助 =====
async function findApiJson(url, options = {}) {
  const fullUrl = MEDIA_API_BASE + url;
  const resp = await fetch(fullUrl, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ===== 视图切换 =====
function showFindView(viewId) {
  findCurrentView = viewId;
  document.querySelectorAll('#pageFind .find-view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(viewId);
  if (el) el.classList.add('active');
}

function openDatabaseView() {
  showFindView('databaseView');
  refreshDatabaseFromBackend().then(() => renderDatabaseView());
}

function openProjectManagementView() {
  showFindView('projectManagementView');
  renderProjectList();
}

function openNewProjectWizard() {
  currentProjectId = null;
  currentAnalysis = null;
  showFindView('projectWizardView');
  document.getElementById('briefInput').value = '';
  renderRequirementForm({});
  renderPlatformChoices([]);
}

function openProjectWizard(projectId) {
  currentProjectId = projectId;
  const project = getCurrentProject();
  if (project) {
    document.getElementById('briefInput').value = project.brief || '';
    currentAnalysis = project.analysis || null;
    if (currentAnalysis) renderRequirementForm(currentAnalysis);
    renderPlatformChoices(currentAnalysis?.platforms || []);
  }
  showFindView('projectWizardView');
}

function openProjectResults(projectId) {
  currentProjectId = projectId;
  showFindView('projectResultsView');
  renderResultsView();
}

// ===== Brief 分析 =====
function localAnalyzeBrief(text) {
  const analysis = {
    brand: '', platforms: [], forms: '', total_budget: 0,
    budgetMin: 0, budgetMax: 0, reportCountMin: 0, rebateMin: 0,
    creatorTypes: [], audienceTags: [], ta: '', cpmMax: 0, cpeMax: 0,
    linkRequired: false, keywords: [], hardRequirements: [], budgetRisk: ''
  };

  // 品牌
  const brandMatch = text.match(/【品牌】\s*([^\n]+)/) || text.match(/品牌[：:]\s*([^\n]+)/);
  if (brandMatch) analysis.brand = brandMatch[1].trim();

  // 平台
  if (/报备|挂链|返点|蒲公英/.test(text)) analysis.platforms.push('pgy');
  if (/小红书|种草|笔记/.test(text)) analysis.platforms.push('xhs');
  if (/星图|巨量/.test(text)) analysis.platforms.push('xingtu');
  if (/抖音/.test(text)) analysis.platforms.push('douyin');
  if (/互选|视频号/.test(text)) analysis.platforms.push('huxuan');
  if (!analysis.platforms.length) analysis.platforms = ['pgy'];

  // 预算
  const budgetMatch = text.match(/总预算[：:]\s*([\d,.]+)\s*[万w]/i);
  if (budgetMatch) analysis.total_budget = parseFloat(budgetMatch[1].replace(/,/g, '')) * 10000;

  const budgetRangeMatch = text.match(/单[个位].*?预算[：:]\s*([\d,.]+)\s*[-~到至]\s*([\d,.]+)\s*[万w]?/i);
  if (budgetRangeMatch) {
    analysis.budgetMin = parseFloat(budgetRangeMatch[1].replace(/,/g, ''));
    analysis.budgetMax = parseFloat(budgetRangeMatch[2].replace(/,/g, ''));
    if (text.includes('万')) { analysis.budgetMin *= 10000; analysis.budgetMax *= 10000; }
  }

  // 返点
  const rebateMatch = text.match(/返点[：:]*\s*(?:不低于)?\s*([\d.]+)\s*%/);
  if (rebateMatch) analysis.rebateMin = parseFloat(rebateMatch[1]);

  // 提报数量
  const reportMatch = text.match(/提报.*?数量.*?(?:不低于|至少)\s*(\d+)/);
  if (reportMatch) analysis.reportCountMin = parseInt(reportMatch[1]);

  // 达人类型
  const typeMatch = text.match(/达人类型[：:]\s*([^\n]+)/);
  if (typeMatch) analysis.creatorTypes = typeMatch[1].split(/[、,，]/).map(s => s.trim()).filter(Boolean);

  // 受众标签
  const tagList = ['上班族', '学生党', '养生党', '精致妈妈', '健身党', '美食党', '护肤党', '穿搭党'];
  analysis.audienceTags = tagList.filter(tag => text.includes(tag));

  // CPM/CPE
  const cpmMatch = text.match(/CPM\s*[<＜不超过]\s*([\d.]+)/i);
  if (cpmMatch) analysis.cpmMax = parseFloat(cpmMatch[1]);
  const cpeMatch = text.match(/CPE\s*[<＜不超过]\s*([\d.]+)/i);
  if (cpeMatch) analysis.cpeMax = parseFloat(cpeMatch[1]);

  // 挂链
  analysis.linkRequired = /挂链|产品链接/.test(text);

  // 关键词
  analysis.keywords = [...analysis.creatorTypes, ...analysis.audienceTags, analysis.brand].filter(Boolean);

  return analysis;
}

function normalizeBriefAnalysis(raw) {
  return {
    brand: raw.brand || '',
    platforms: raw.platforms || ['pgy'],
    forms: raw.forms || '',
    total_budget: raw.total_budget || 0,
    budgetMin: raw.budgetMin || 0,
    budgetMax: raw.budgetMax || 0,
    reportCountMin: raw.reportCountMin || 0,
    rebateMin: raw.rebateMin || 0,
    creatorTypes: raw.creatorTypes || [],
    audienceTags: raw.audienceTags || [],
    ta: raw.ta || '',
    cpmMax: raw.cpmMax || 0,
    cpeMax: raw.cpeMax || 0,
    linkRequired: raw.linkRequired || false,
    keywords: raw.keywords || [],
    hardRequirements: raw.hardRequirements || [],
    budgetRisk: raw.budgetRisk || ''
  };
}

async function analyzeBrief() {
  const text = document.getElementById('briefInput')?.value?.trim();
  if (!text) return alert('请先粘贴 brief 内容');

  const btn = document.getElementById('briefAnalyzeBtn');
  if (btn) { btn.disabled = true; btn.textContent = '拆解中...'; }

  try {
    // 优先调用远程 API
    const result = await findApiJson('/api', {
      method: 'POST',
      body: JSON.stringify({ action: 'brief_analysis', brief: text })
    });
    currentAnalysis = normalizeBriefAnalysis(result);
  } catch (e) {
    // 降级为本地解析
    console.warn('远程 Brief 拆解失败，使用本地解析', e);
    currentAnalysis = localAnalyzeBrief(text);
  }

  renderRequirementForm(currentAnalysis);
  renderPlatformChoices(currentAnalysis.platforms || []);

  if (btn) { btn.disabled = false; btn.textContent = 'AI 拆解需求'; }
}

function loadDemoBrief() {
  const demo = `【品牌】沃隆
【背景档期】2024年618大促
【合作平台】小红书蒲公英报备
【合作形式】报备图文、报备视频，优先视频
【总预算】10万
【提报数量不低于】25个
【单个预算】5000~10000
【达人类型】美食种草类、美食开箱测评类
【TA】18-35岁女性
【返点不低于】22%
【CPM < 70】【CPE < 8】
需要配合站内产品链接挂链`;
  document.getElementById('briefInput').value = demo;
  analyzeBrief();
}

// ===== 需求表单渲染 =====
function renderRequirementForm(a) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('confirmBrand', a.brand);
  set('confirmTargetCount', a.reportCountMin || 25);
  set('confirmTotalBudget', a.total_budget);
  set('confirmRebate', a.rebateMin);
  set('confirmBudgetMin', a.budgetMin);
  set('confirmBudgetMax', a.budgetMax);
  set('confirmCpm', a.cpmMax);
  set('confirmCpe', a.cpeMax);
  set('confirmCreatorTypes', (a.creatorTypes || []).join('、'));
  set('confirmAudienceTags', (a.audienceTags || []).join('、'));
  set('confirmForms', a.forms);
  const cb = document.getElementById('confirmLinkRequired');
  if (cb) cb.checked = !!a.linkRequired;
}

function renderPlatformChoices(platforms) {
  const grid = document.getElementById('platformChoiceGrid');
  if (!grid) return;
  const allPlatforms = [
    { id: 'pgy', label: '小红书蒲公英', meta: '报备/挂链/返点', enabled: true },
    { id: 'xingtu', label: '巨量星图', meta: '抖音达人合作', enabled: false },
    { id: 'huxuan', label: '腾讯互选', meta: '视频号达人合作', enabled: false }
  ];
  grid.innerHTML = allPlatforms.map(p => {
    const active = platforms.includes(p.id);
    const disabled = !p.enabled;
    return `<div class="platform-choice${active ? ' active' : ''}${disabled ? ' disabled' : ''}" onclick="${disabled ? '' : `choosePlatform('${p.id}', this)`}">
      <div class="platform-choice-name">${p.label}</div>
      <div class="platform-choice-meta">${p.meta}${disabled ? ' (即将开放)' : ''}</div>
    </div>`;
  }).join('');
}

function choosePlatform(platformId, el) {
  if (el.classList.contains('disabled')) return;
  el.classList.toggle('active');
}

function saveConfirmedAnalysis() {
  if (!currentAnalysis) currentAnalysis = {};
  const get = (id) => document.getElementById(id)?.value || '';
  currentAnalysis.brand = get('confirmBrand');
  currentAnalysis.reportCountMin = parseInt(get('confirmTargetCount')) || 25;
  currentAnalysis.total_budget = parseFloat(get('confirmTotalBudget')) || 0;
  currentAnalysis.rebateMin = parseFloat(get('confirmRebate')) || 0;
  currentAnalysis.budgetMin = parseFloat(get('confirmBudgetMin')) || 0;
  currentAnalysis.budgetMax = parseFloat(get('confirmBudgetMax')) || 0;
  currentAnalysis.cpmMax = parseFloat(get('confirmCpm')) || 0;
  currentAnalysis.cpeMax = parseFloat(get('confirmCpe')) || 0;
  currentAnalysis.creatorTypes = get('confirmCreatorTypes').split(/[、,，]/).map(s => s.trim()).filter(Boolean);
  currentAnalysis.audienceTags = get('confirmAudienceTags').split(/[、,，]/).map(s => s.trim()).filter(Boolean);
  currentAnalysis.forms = get('confirmForms');
  currentAnalysis.linkRequired = document.getElementById('confirmLinkRequired')?.checked || false;

  const selectedPlatforms = [];
  document.querySelectorAll('#platformChoiceGrid .platform-choice.active').forEach(el => {
    const name = el.querySelector('.platform-choice-name')?.textContent || '';
    if (name.includes('蒲公英')) selectedPlatforms.push('pgy');
    else if (name.includes('星图')) selectedPlatforms.push('xingtu');
    else if (name.includes('互选')) selectedPlatforms.push('huxuan');
  });
  currentAnalysis.platforms = selectedPlatforms.length ? selectedPlatforms : ['pgy'];
  currentAnalysis.keywords = [...currentAnalysis.creatorTypes, ...currentAnalysis.audienceTags, currentAnalysis.brand].filter(Boolean);

  const status = document.getElementById('analysisStatus');
  if (status) { status.className = 'status-pill ok'; status.textContent = '已确认'; }
  alert('需求已确认');
}

// ===== 项目管理 =====
function getCurrentProject() {
  return projects.find(p => p.id === currentProjectId) || null;
}

function persistProjects() {
  localStorage.setItem('mengli_projects', JSON.stringify(projects));
}

function createNewProject() {
  const brief = document.getElementById('briefInput')?.value?.trim() || '';
  const project = {
    id: 'proj_' + Date.now(),
    name: currentAnalysis?.brand || '未命名项目',
    brief,
    analysis: currentAnalysis,
    status: 'confirmed',
    serverId: null,
    createdAt: new Date().toISOString()
  };
  projects.unshift(project);
  currentProjectId = project.id;
  persistProjects();
  return project;
}

function renderProjectList() {
  const container = document.getElementById('projectList');
  if (!container) return;
  if (!projects.length) {
    container.innerHTML = '<div class="assessment-note">暂无项目，点击"新建项目"开始。</div>';
    return;
  }
  container.innerHTML = projects.map(p => `
    <div class="project-card">
      <div class="project-card-title">${escapeHtml(p.name)}</div>
      <div class="project-card-meta">创建：${new Date(p.createdAt).toLocaleDateString('zh-CN')}<br>状态：${p.status || '草稿'}</div>
      <div class="project-card-actions">
        <button class="ghost-btn" onclick="openProjectWizard('${p.id}')">编辑</button>
        <button class="primary-btn" onclick="openProjectResults('${p.id}')">查看结果</button>
      </div>
    </div>
  `).join('');
}

// ===== 找号流程 =====
async function startFindFlow() {
  saveConfirmedAnalysis();
  let project = getCurrentProject();
  if (!project) project = createNewProject();
  else { project.analysis = currentAnalysis; project.brief = document.getElementById('briefInput')?.value?.trim() || ''; persistProjects(); }

  // 同步到后端
  try {
    const result = await findApiJson('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: project.name, brief: project.brief })
    });
    project.serverId = result.id;
    persistProjects();
  } catch (e) {
    console.warn('同步项目到后端失败', e);
  }

  openProjectResults(project.id);
}

// ===== 候选人 =====
function buildCandidatePool() {
  candidatePool = syntheticCandidates.map(normalizeCandidate);
  if (serverCandidates.length) candidatePool = serverCandidates.map(normalizeCandidate);
}

function normalizeCandidate(raw) {
  return {
    uid: raw.platform_id || raw.home_url || raw.name || ('cand_' + Math.random()),
    name: raw.name || raw.platform_id || '未知',
    platformId: raw.platform_id || '',
    homeUrl: raw.home_url || '',
    platformLabel: raw.platform || '小红书蒲公英',
    followers: raw.followers || 0,
    imageQuote: raw.image_quote || 0,
    videoQuote: raw.video_quote || 0,
    exposureMedian: raw.exposure_median || 0,
    readMedian: raw.read_median || 0,
    interactionMedian: raw.interaction_median || 0,
    cpm: raw.cpm || 0,
    cpe: raw.cpe || 0,
    rebatePct: raw.rebate_pct || 0,
    contact: raw.contact || '',
    tags: raw.tags || [],
    audienceTags: raw.audience_tags || [],
    persona: raw.persona || '',
    recentTitles: raw.recent_titles || [],
    verticalScore: raw.vertical_score || 0,
    scores: raw.scores || { budgetScore: 0, contentScore: 0, performanceScore: 0, historyScore: 0, verticalScore: 0, total: 0 },
    efficiency: { cpm: raw.cpm || 0, cpe: raw.cpe || 0 },
    platformFields: raw.platform_fields || {},
    raw
  };
}

function scoreCandidate(row, analysis) {
  if (!analysis) return row;
  const scores = { budgetScore: 0, contentScore: 0, performanceScore: 0, historyScore: 0, verticalScore: row.verticalScore || 0, total: 0 };

  // 预算分
  scores.budgetScore = scoreBudget(row, analysis);
  // 内容分
  const keywords = analysis.keywords || [];
  const text = [row.name, row.persona, ...(row.tags || []), ...(row.audienceTags || [])].join(' ');
  const hits = keywords.filter(k => text.includes(k)).length;
  scores.contentScore = Math.min(100, hits * 20);
  // 数据表现分
  if (analysis.cpmMax && row.cpm) scores.performanceScore = row.cpm <= analysis.cpmMax ? 80 : 40;
  else scores.performanceScore = 50;
  // 历史反馈分
  scores.historyScore = scoreHistory(row);

  scores.total = Math.round(scores.budgetScore * 0.2 + scores.contentScore * 0.3 + scores.performanceScore * 0.3 + scores.historyScore * 0.1 + scores.verticalScore * 0.1);
  row.scores = scores;
  return row;
}

function scoreBudget(row, analysis) {
  const quote = row.imageQuote || row.videoQuote || 0;
  if (!quote || !analysis.budgetMin || !analysis.budgetMax) return 50;
  if (quote >= analysis.budgetMin && quote <= analysis.budgetMax) return 95;
  if (quote < analysis.budgetMin) return 60;
  return 30;
}

function scoreHistory(row) {
  const key = row.platformId || row.name;
  const related = memories.filter(m => (m.note || '').includes(key));
  if (!related.length) return 50;
  const positive = related.filter(m => (m.note || '').includes('通过') || (m.note || '').includes('可用')).length;
  return positive > 0 ? 80 : 30;
}

// ===== 推荐引擎 =====
function autoRecommend(target) {
  buildCandidatePool();
  const analysis = currentAnalysis || getCurrentProject()?.analysis;
  if (!analysis) return;
  candidatePool.forEach(row => scoreCandidate(row, analysis));
  candidatePool.sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0));

  const selected = [];
  const requiredTags = analysis.audienceTags || [];
  const tagCoverage = new Set();

  // 先覆盖必须标签
  for (const tag of requiredTags) {
    const match = candidatePool.find(row => !selected.includes(row) && candidateMatchesTag(row, tag));
    if (match) { selected.push(match); tagCoverage.add(tag); }
  }

  // 填充剩余
  for (const row of candidatePool) {
    if (selected.length >= (target || analysis.reportCountMin || 25)) break;
    if (!selected.includes(row)) selected.push(row);
  }

  recommendations = selected;
}

function candidateMatchesTag(row, tag) {
  const text = [row.name, row.persona, ...(row.tags || []), ...(row.audienceTags || [])].join(' ');
  return text.includes(tag);
}

function candidateTier(row) {
  const s = row.scores || {};
  if (s.total >= 70) return 'strict';
  if (s.total >= 50) return 'backup';
  return 'not_recommended';
}

function candidateTierLabel(row) {
  return { strict: '严格达标', backup: '可备选', not_recommended: '不建议' }[candidateTier(row)] || '未知';
}

function candidateTierIssues(row) {
  const issues = [];
  const analysis = currentAnalysis || getCurrentProject()?.analysis;
  if (!analysis) return issues;
  const quote = row.imageQuote || row.videoQuote || 0;
  if (analysis.budgetMin && quote < analysis.budgetMin) issues.push('报价低于预算下限');
  if (analysis.budgetMax && quote > analysis.budgetMax) issues.push('报价超预算上限');
  if (analysis.cpmMax && row.cpm > analysis.cpmMax) issues.push('CPM 超限');
  if (analysis.cpeMax && row.cpe > analysis.cpeMax) issues.push('CPE 超限');
  return issues;
}

function getRecommendedCandidates() {
  return recommendations.length ? recommendations : [];
}

// ===== 渲染函数 =====
function renderResultsView() {
  const project = getCurrentProject();
  if (!project) return;
  const desc = document.getElementById('resultProjectDesc');
  if (desc) desc.textContent = `项目：${project.name}`;

  // 加载后端数据
  if (project.serverId) {
    findApiJson(`/api/projects/${project.serverId}/candidates?hide_excluded=true`).then(data => {
      serverCandidates = data.candidates || data || [];
      buildCandidatePool();
      candidatePool.forEach(row => scoreCandidate(row, project.analysis));
      renderResultTable();
    }).catch(() => {});
    findApiJson(`/api/projects/${project.serverId}/recommendations`).then(data => {
      serverRecommendations = data.recommendations || data || [];
      renderResultTable();
    }).catch(() => {});
  }

  autoRecommend(project.analysis?.reportCountMin || 25);
  renderResultTable();
  buildResultAssessment();
}

function renderResultTable() {
  const tbody = document.getElementById('resultTableBody');
  const empty = document.getElementById('resultEmpty');
  const rows = getRecommendedCandidates();
  if (!rows.length) {
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (tbody) {
    tbody.innerHTML = rows.map(row => {
      const tier = candidateTier(row);
      const issues = candidateTierIssues(row);
      return `<tr>
        <td><strong>${escapeHtml(row.name)}</strong><br><span class="muted-text">${escapeHtml(row.platformId)}</span></td>
        <td>${escapeHtml(row.platformLabel)}</td>
        <td>${fmtFollowers(row.followers)}</td>
        <td>${money(row.imageQuote)} / ${money(row.videoQuote)}</td>
        <td>${row.rebatePct ? row.rebatePct + '%' : '-'}</td>
        <td>${(row.tags || []).slice(0, 3).join('、')}</td>
        <td class="metric-line">CPM:${row.cpm || '-'}<br>阅读:${numberText(row.readMedian)}<br>互动:${numberText(row.interactionMedian)}</td>
        <td>${issues.length ? `<span class="hit-warn">${issues.join('、')}</span>` : '<span class="hit-ok">全部达标</span>'}</td>
        <td><span class="tier-pill ${tier}">${candidateTierLabel(row)}</span></td>
      </tr>`;
    }).join('');
  }
}

function buildResultAssessment() {
  const el = document.getElementById('resultAssessment');
  if (!el) return;
  const rows = getRecommendedCandidates();
  const strict = rows.filter(r => candidateTier(r) === 'strict').length;
  const backup = rows.filter(r => candidateTier(r) === 'backup').length;
  el.innerHTML = `<div class="assessment-grid">
    <div class="assessment-item"><div class="assessment-label">总推荐</div><div class="assessment-value">${rows.length}</div></div>
    <div class="assessment-item"><div class="assessment-label">严格达标</div><div class="assessment-value">${strict}</div></div>
    <div class="assessment-item"><div class="assessment-label">可备选</div><div class="assessment-value">${backup}</div></div>
    <div class="assessment-item"><div class="assessment-label">不建议</div><div class="assessment-value">${rows.length - strict - backup}</div></div>
  </div>`;
}

// ===== 媒体库 =====
async function refreshDatabaseFromBackend() {
  try {
    const data = await findApiJson('/api/database/creators?limit=3000');
    backendDatabaseCreators = data.creators || data || [];
    backendRepairRecords = data.repair_records || [];
  } catch (e) {
    console.warn('加载媒体库失败', e);
  }
}

function getDatabaseRows() {
  let rows = backendDatabaseCreators.length ? backendDatabaseCreators : databaseCreators;
  const platform = document.getElementById('databasePlatformFilter')?.value;
  const intake = document.getElementById('databaseIntakeFilter')?.value;
  const search = (document.getElementById('databaseSearchInput')?.value || '').toLowerCase();
  const tag = (document.getElementById('databaseTagInput')?.value || '').toLowerCase();
  const followerMin = parseFloat(document.getElementById('databaseFollowerMin')?.value) || 0;
  const followerMax = parseFloat(document.getElementById('databaseFollowerMax')?.value) || Infinity;
  const priceMin = parseFloat(document.getElementById('databasePriceMin')?.value) || 0;
  const priceMax = parseFloat(document.getElementById('databasePriceMax')?.value) || Infinity;
  const rebateMin = parseFloat(document.getElementById('databaseRebateMin')?.value) || 0;
  const rebateMax = parseFloat(document.getElementById('databaseRebateMax')?.value) || Infinity;

  return rows.filter(row => {
    if (platform && row.platform !== platform && row.platform_id?.indexOf(platform) === -1) return false;
    if (intake && intake !== 'all' && row.intake_status !== intake) return false;
    if (search) {
      const text = [row.name, row.persona, ...(row.tags || [])].join(' ').toLowerCase();
      if (!text.includes(search)) return false;
    }
    if (tag) {
      const tags = (row.tags || []).join(' ').toLowerCase();
      if (!tags.includes(tag)) return false;
    }
    const followers = row.followers || 0;
    if (followers < followerMin || followers > followerMax) return false;
    const quote = row.image_quote || row.video_quote || 0;
    if (quote < priceMin || quote > priceMax) return false;
    const rebate = row.rebate_pct || 0;
    if (rebate < rebateMin || rebate > rebateMax) return false;
    return true;
  });
}

function renderDatabaseView() {
  const rows = getDatabaseRows();
  const tbody = document.getElementById('databaseTableBody');
  const empty = document.getElementById('databaseEmpty');
  if (!rows.length) {
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const totalPages = Math.ceil(rows.length / DATABASE_PAGE_SIZE);
  if (databasePage > totalPages) databasePage = totalPages;
  const start = (databasePage - 1) * DATABASE_PAGE_SIZE;
  const pageRows = rows.slice(start, start + DATABASE_PAGE_SIZE);

  if (tbody) {
    tbody.innerHTML = pageRows.map(row => `<tr>
      <td><strong>${escapeHtml(row.name || '')}</strong></td>
      <td><span class="status-pill ${row.intake_status === 'formal' ? 'ok' : row.intake_status === 'repair' ? 'warn' : 'wait'}">${row.intake_status || '正式'}</span></td>
      <td>${escapeHtml(row.platform_id || '')}</td>
      <td>${row.home_url ? `<a href="${escapeHtml(row.home_url)}" target="_blank">查看</a>` : '-'}</td>
      <td>${money(row.image_quote)}</td>
      <td>${money(row.video_quote)}</td>
      <td class="metric-line">曝光:${numberText(row.exposure_median)}<br>阅读:${numberText(row.read_median)}<br>互动:${numberText(row.interaction_median)}</td>
      <td>${row.title_status || '-'}</td>
      <td>${row.cpm || '-'}</td>
      <td>${row.read_unit_price || '-'}</td>
      <td>${row.interaction_unit_price || '-'}</td>
      <td>${row.rebate_pct ? row.rebate_pct + '%' : '-'}</td>
      <td>${escapeHtml(row.contact || '')}</td>
      <td>${(row.tags || []).slice(0, 3).join('、')}</td>
      <td>${escapeHtml(row.repair_reason || '')}</td>
      <td>${escapeHtml(row.source || '')}</td>
      <td>-</td>
    </tr>`).join('');
  }

  renderDatabasePager(rows.length, totalPages);
}

function renderDatabasePager(total, totalPages) {
  const pager = document.getElementById('databasePager');
  if (!pager) return;
  pager.innerHTML = `<span>共 ${total} 条</span><div class="database-pager-actions">
    <button class="database-page-btn" onclick="databasePage=1;renderDatabaseView()" ${databasePage <= 1 ? 'disabled' : ''}>首页</button>
    <button class="database-page-btn" onclick="databasePage--;renderDatabaseView()" ${databasePage <= 1 ? 'disabled' : ''}>上一页</button>
    <span class="database-page-state">${databasePage} / ${totalPages}</span>
    <button class="database-page-btn" onclick="databasePage++;renderDatabaseView()" ${databasePage >= totalPages ? 'disabled' : ''}>下一页</button>
    <button class="database-page-btn" onclick="databasePage=${totalPages};renderDatabaseView()" ${databasePage >= totalPages ? 'disabled' : ''}>末页</button>
  </div>`;
}

function handleDatabaseFilterChange() {
  databasePage = 1;
  renderDatabaseView();
}

async function handleDatabaseImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  // 简单的 CSV/TSV 解析
  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return alert('文件内容为空');
  const delimiter = text.includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cells = line.split(delimiter);
    const row = {};
    headers.forEach((h, i) => row[h] = (cells[i] || '').trim());
    return row;
  });
  processDatabaseImportRows(rows);
}

function processDatabaseImportRows(rows) {
  let imported = 0;
  for (const row of rows) {
    const creator = {
      name: row.name || row['达人昵称'] || '',
      platform_id: row.platform_id || row['小红书号'] || '',
      home_url: row.home_url || row['蒲公英主页链接'] || '',
      image_quote: parseFloat(row.image_quote || row['图文报价'] || 0),
      video_quote: parseFloat(row.video_quote || row['视频报价'] || 0),
      followers: parseFloat(row.followers || row['粉丝数'] || 0),
      tags: (row.tags || row['标签'] || '').split(/[、/]/).filter(Boolean),
      source: '导入'
    };
    if (creator.name) { databaseCreators.push(creator); imported++; }
  }
  localStorage.setItem('mengli_database_creators', JSON.stringify(databaseCreators));
  renderDatabaseView();
  alert(`成功导入 ${imported} 条记录`);
}

// ===== 反馈与记忆 =====
async function saveFeedbackMemory(silent = false) {
  const project = getCurrentProject();
  if (!project) return;
  const usability = document.getElementById('feedbackUsability')?.value || '可用';
  const pass = document.getElementById('feedbackPass')?.value || '待确认';
  const keyword = document.getElementById('feedbackKeyword')?.value || '精准';
  const reason = document.getElementById('feedbackReason')?.value || '';
  const note = document.getElementById('feedbackNote')?.value || '';
  const selected = getRecommendedCandidates().map(c => c.name).join('、') || '暂无推荐';

  const feedback = { id: 'fb_' + Date.now(), projectId: currentProjectId, projectName: project.name, usability, pass, keyword, reason, note, selected, createdAt: new Date().toISOString() };
  feedbacks.unshift(feedback);
  memories.unshift({ id: 'mem_' + Date.now(), projectId: currentProjectId, title: `${project.name} · ${usability} · ${pass}`, note: `达人：${selected}。关键词：${keyword}。${reason ? '替换原因：' + reason + '。' : ''}${note || ''}`, createdAt: feedback.createdAt });

  localStorage.setItem('mengli_feedbacks', JSON.stringify(feedbacks));
  localStorage.setItem('mengli_memories', JSON.stringify(memories));

  if (project.serverId) {
    findApiJson(`/api/projects/${project.serverId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ usability, client_passed: pass, keyword_accuracy: keyword, replaced_reason: reason, note })
    }).then(() => refreshDatabaseFromBackend()).catch(e => console.warn('反馈同步失败', e));
  }

  const status = document.getElementById('feedbackStatus');
  if (status) { status.className = 'status-pill ok'; status.textContent = '已记录'; }
  if (!silent) alert('反馈已写入记忆');
}

function clearProjectMemory() {
  memories = memories.filter(m => m.projectId !== currentProjectId);
  feedbacks = feedbacks.filter(f => f.projectId !== currentProjectId);
  localStorage.setItem('mengli_memories', JSON.stringify(memories));
  localStorage.setItem('mengli_feedbacks', JSON.stringify(feedbacks));
  alert('已清空');
}

// ===== 导出 =====
function toggleRecommendationExportMenu() {
  const menu = document.getElementById('recommendationExportMenu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

async function exportRecommendations(scope = 'all') {
  const rows = getRecommendedCandidates();
  let filtered = rows;
  if (scope === 'strict') filtered = rows.filter(r => candidateTier(r) === 'strict');
  else if (scope === 'backup') filtered = rows.filter(r => candidateTier(r) === 'backup');

  if (!filtered.length) return alert('暂无可导出数据');

  const label = { strict: '严格达标', backup: '可备选', all: '全部推荐' }[scope] || '全部';
  const project = getCurrentProject();

  // 尝试后端导出
  if (project?.serverId) {
    try {
      const resp = await fetch(`${MEDIA_API_BASE}/api/projects/${project.serverId}/export?scope=${scope}`);
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${project.name}-${label}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (e) { console.warn('后端导出失败，使用前端导出', e); }
  }

  // 前端导出
  const headers = ['达人昵称', '平台', '推荐分层', '小红书号', '粉丝数', '图文报价', '视频报价', 'CPM', '返点', '标签', '综合分'];
  const body = filtered.map(r => [r.name, r.platformLabel, candidateTierLabel(r), r.platformId, r.followers, r.imageQuote, r.videoQuote, r.cpm, r.rebatePct, (r.tags || []).join('/'), r.scores?.total]);
  const table = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const blob = new Blob([`<html><head><meta charset="UTF-8"></head><body>${table}</body></html>`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${project?.name || '推荐'}-${label}.xls`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== 工具函数（复用主模块的 escapeHtml，这里提供独立版本避免冲突） =====
function fmtFollowers(n) {
  const num = Number(n || 0);
  if (num >= 10000) return (num / 10000).toFixed(1) + '亿';
  return num.toFixed(num >= 100 ? 0 : 1) + '万';
}
function fmtMoney(n) { return Number(n || 0).toLocaleString('zh-CN'); }
function money(n) { return n ? '¥' + fmtMoney(n) : '-'; }
function numberText(n) { return n ? Number(n).toLocaleString('zh-CN') : '-'; }

// ===== 初始化 =====
function initFindWorkbench() {
  projects = JSON.parse(localStorage.getItem('mengli_projects') || '[]');
  showFindView('findHomeView');
}
