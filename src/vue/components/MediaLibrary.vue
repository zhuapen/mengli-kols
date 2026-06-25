<template>
  <div class="media-library-page">
    <!-- 头部 -->
    <div class="media-header">
      <div class="media-header-inner">
        <h1 class="media-title">📚 智能媒体库</h1>
        <p class="media-desc">AI Brief 拆解 · 蒲公英采集 · 达人推荐 · 项目管理</p>
      </div>
    </div>

    <!-- 功能入口 -->
    <div class="media-grid">
      <div class="media-card" @click="activeTab = 'brief'">
        <div class="media-card-icon">📝</div>
        <div class="media-card-title">Brief 分析</div>
        <div class="media-card-desc">AI 拆解营销 brief，生成搜索策略</div>
      </div>
      <div class="media-card" @click="activeTab = 'kols'">
        <div class="media-card-icon">👤</div>
        <div class="media-card-title">KOL 数据库</div>
        <div class="media-card-desc">管理达人数据、报价、标签</div>
      </div>
      <div class="media-card" @click="activeTab = 'tasks'">
        <div class="media-card-icon">📋</div>
        <div class="media-card-title">任务中心</div>
        <div class="media-card-desc">查看采集任务、执行状态</div>
      </div>
      <div class="media-card" @click="activeTab = 'results'">
        <div class="media-card-icon">📊</div>
        <div class="media-card-title">采集结果</div>
        <div class="media-card-desc">查看推荐结果、用户反馈</div>
      </div>
    </div>

    <!-- Brief 分析 -->
    <div v-if="activeTab === 'brief'" class="media-section">
      <h3>📝 Brief 分析</h3>
      <div class="brief-input-area">
        <textarea v-model="briefText" placeholder="粘贴客户 brief..." rows="6"></textarea>
        <button @click="analyzeBrief" :disabled="loading" class="btn-primary">
          {{ loading ? '分析中...' : 'AI 拆解' }}
        </button>
      </div>
      <div v-if="briefAnalysis" class="brief-result">
        <pre>{{ JSON.stringify(briefAnalysis, null, 2) }}</pre>
      </div>
    </div>

    <!-- KOL 数据库 -->
    <div v-if="activeTab === 'kols'" class="media-section">
      <h3>👤 KOL 数据库</h3>
      <div class="kol-list">
        <div v-for="kol in kols" :key="kol.id" class="kol-card">
          <div class="kol-name">{{ kol.name }}</div>
          <div class="kol-stats">
            <span>粉丝: {{ kol.followers || '-' }}</span>
            <span>互动率: {{ kol.engagement_rate || '-' }}%</span>
          </div>
        </div>
        <div v-if="kols.length === 0" class="empty-state">暂无 KOL 数据</div>
      </div>
    </div>

    <!-- 任务中心 -->
    <div v-if="activeTab === 'tasks'" class="media-section">
      <h3>📋 任务中心</h3>
      <div class="task-list">
        <div v-for="task in tasks" :key="task.id" class="task-card">
          <div class="task-type">{{ task.type }}</div>
          <div class="task-status" :class="task.status">{{ task.status }}</div>
          <div class="task-time">{{ formatTime(task.created_at) }}</div>
        </div>
        <div v-if="tasks.length === 0" class="empty-state">暂无任务</div>
      </div>
    </div>

    <!-- 采集结果 -->
    <div v-if="activeTab === 'results'" class="media-section">
      <h3>📊 采集结果</h3>
      <div class="result-list">
        <div v-for="result in results" :key="result.id" class="result-card">
          <div class="result-kol">{{ result.kol_name }}</div>
          <div class="result-score">推荐分: {{ result.score }}</div>
          <div class="result-reason">{{ result.reason }}</div>
        </div>
        <div v-if="results.length === 0" class="empty-state">暂无采集结果</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const activeTab = ref('brief');
const loading = ref(false);
const briefText = ref('');
const briefAnalysis = ref(null);
const kols = ref([]);
const tasks = ref([]);
const results = ref([]);

// 加载数据
onMounted(async () => {
  await loadKols();
  await loadTasks();
});

async function loadKols() {
  try {
    const data = await apiClient.kols.list();
    kols.value = data.kols || [];
  } catch (e) {
    console.error('加载 KOL 失败:', e);
  }
}

async function loadTasks() {
  try {
    const data = await apiClient.tasks.list();
    tasks.value = data.tasks || [];
  } catch (e) {
    console.error('加载任务失败:', e);
  }
}

async function analyzeBrief() {
  if (!briefText.value.trim()) return;
  loading.value = true;
  try {
    // 创建 Brief
    const brief = await apiClient.briefs.create({ original_text: briefText.value });
    // 创建分析任务
    await apiClient.tasks.create({ type: 'brief_intelligence', payload: { brief_id: brief.id } });
    briefAnalysis.value = { status: '任务已创建，等待 Worker 执行', brief_id: brief.id };
  } catch (e) {
    console.error('分析 Brief 失败:', e);
    briefAnalysis.value = { error: e.message };
  } finally {
    loading.value = false;
  }
}

function formatTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}
</script>

<style scoped>
.media-library-page {
  padding: 0 24px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.media-header {
  margin-bottom: 32px;
}

.media-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.media-desc {
  color: #666;
  font-size: 14px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.media-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: all 0.2s;
}

.media-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.media-card-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.media-card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.media-card-desc {
  font-size: 13px;
  color: #666;
}

.media-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.media-section h3 {
  font-size: 18px;
  margin-bottom: 16px;
}

.brief-input-area textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 12px;
}

.btn-primary {
  padding: 10px 24px;
  background: #F4845F;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.brief-result {
  margin-top: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
}

.brief-result pre {
  font-size: 13px;
  white-space: pre-wrap;
}

.kol-card, .task-card, .result-card {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.kol-name, .task-type, .result-kol {
  font-weight: 600;
  margin-bottom: 4px;
}

.kol-stats, .task-status, .result-score {
  font-size: 13px;
  color: #666;
}

.task-status.pending { color: #F59E0B; }
.task-status.running { color: #3B82F6; }
.task-status.done { color: #10B981; }
.task-status.failed { color: #EF4444; }

.empty-state {
  text-align: center;
  color: #999;
  padding: 24px;
}
</style>
