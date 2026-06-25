<template>
  <div class="media-page">
    <div class="page-header">
      <h1>📚 智能媒体库</h1>
      <p>AI Brief 拆解 · 蒲公英采集 · 达人推荐 · 项目管理</p>
    </div>

    <div class="media-grid">
      <div class="media-card" @click="activeTab = 'brief'">
        <div class="card-icon">📝</div>
        <div class="card-title">Brief 分析</div>
        <div class="card-desc">AI 拆解营销 brief，生成搜索策略</div>
      </div>
      <div class="media-card" @click="activeTab = 'kols'">
        <div class="card-icon">👤</div>
        <div class="card-title">KOL 数据库</div>
        <div class="card-desc">管理达人数据、报价、标签</div>
      </div>
      <div class="media-card" @click="activeTab = 'tasks'">
        <div class="card-icon">📋</div>
        <div class="card-title">任务中心</div>
        <div class="card-desc">查看采集任务、执行状态</div>
      </div>
    </div>

    <!-- Brief 分析 -->
    <div v-if="activeTab === 'brief'" class="section">
      <h3>📝 Brief 分析</h3>
      <textarea v-model="briefText" placeholder="粘贴客户 brief..." rows="6"></textarea>
      <button @click="analyzeBrief" :disabled="loading" class="btn-primary">
        {{ loading ? '分析中...' : 'AI 拆解' }}
      </button>
      <div v-if="briefResult" class="result-box">
        <pre>{{ JSON.stringify(briefResult, null, 2) }}</pre>
      </div>
    </div>

    <!-- KOL 数据库 -->
    <div v-if="activeTab === 'kols'" class="section">
      <h3>👤 KOL 数据库</h3>
      <div v-for="kol in kols" :key="kol.id" class="kol-item">
        <span class="kol-name">{{ kol.name }}</span>
        <span class="kol-stats">粉丝: {{ kol.followers || '-' }}</span>
      </div>
      <div v-if="kols.length === 0" class="empty">暂无 KOL 数据</div>
    </div>

    <!-- 任务中心 -->
    <div v-if="activeTab === 'tasks'" class="section">
      <h3>📋 任务中心</h3>
      <div v-for="task in tasks" :key="task.id" class="task-item">
        <span class="task-type">{{ task.type }}</span>
        <span class="task-status" :class="task.status">{{ task.status }}</span>
      </div>
      <div v-if="tasks.length === 0" class="empty">暂无任务</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { get, post } from '../core/request.js';
import { toast } from '../core/utils/toast.js';

const activeTab = ref('brief');
const loading = ref(false);
const briefText = ref('');
const briefResult = ref(null);
const kols = ref([]);
const tasks = ref([]);

onMounted(async () => {
  try {
    const kolsData = await get('/kols');
    kols.value = kolsData.kols || [];
  } catch (e) { console.error(e); }

  try {
    const tasksData = await get('/tasks');
    tasks.value = tasksData.tasks || [];
  } catch (e) { console.error(e); }
});

async function analyzeBrief() {
  if (!briefText.value.trim()) return;
  loading.value = true;
  try {
    const brief = await post('/briefs', { original_text: briefText.value });
    await post('/tasks', { type: 'brief_intelligence', payload: { brief_id: brief.id } });
    briefResult.value = { status: '任务已创建', brief_id: brief.id };
    toast('Brief 分析任务已创建', 'success');
  } catch (e) {
    briefResult.value = { error: e.message };
    toast('创建失败: ' + e.message, 'error');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.media-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  margin-bottom: 8px;
}

.page-header p {
  color: #666;
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

.card-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-desc {
  font-size: 13px;
  color: #666;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.section h3 {
  margin-bottom: 16px;
}

textarea {
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
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
}

.result-box {
  margin-top: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
}

.result-box pre {
  font-size: 13px;
  white-space: pre-wrap;
}

.kol-item, .task-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
}

.kol-name, .task-type {
  font-weight: 600;
}

.task-status.pending { color: #F59E0B; }
.task-status.running { color: #3B82F6; }
.task-status.done { color: #10B981; }
.task-status.failed { color: #EF4444; }

.empty {
  text-align: center;
  color: #999;
  padding: 24px;
}
</style>
