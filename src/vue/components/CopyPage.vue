<template>
  <div class="page active" id="pageCopy" v-show="active">
    <div class="gen-container">
      <h2 class="gen-title">✍️ 文案撰写</h2>

      <!-- 输入区 -->
      <div class="gen-input-area">
        <div class="gen-row">
          <select class="gen-textarea" v-model="form.type" style="min-height:auto;padding:16px;cursor:pointer">
            <option value="">选择文案类型</option>
            <option value="种草笔记">种草笔记</option>
            <option value="产品测评">产品测评</option>
            <option value="好物推荐">好物推荐</option>
            <option value="使用教程">使用教程</option>
            <option value="品牌故事">品牌故事</option>
            <option value="活动推广">活动推广</option>
            <option value="短视频脚本">短视频脚本</option>
          </select>

          <select class="gen-textarea" v-model="form.brand" style="min-height:auto;padding:16px;cursor:pointer">
            <option value="">选择品牌（可选）</option>
            <option v-for="brand in brands" :key="brand" :value="brand">{{ brand }}</option>
          </select>
        </div>

        <div class="gen-row">
          <select class="gen-textarea" v-model="form.platform" style="min-height:auto;padding:16px;cursor:pointer">
            <option value="">选择平台</option>
            <option value="小红书">小红书</option>
            <option value="抖音">抖音</option>
            <option value="微信公众号">微信公众号</option>
            <option value="微博">微博</option>
            <option value="B站">B站</option>
          </select>

          <input
            type="text"
            class="gen-textarea"
            v-model="form.product"
            placeholder="如：超上扬精华、钙片、蛋白粉..."
            style="min-height:auto;padding:16px"
          >
        </div>

        <textarea
          class="gen-textarea"
          v-model="form.extra"
          placeholder="如：突出性价比、强调温和不刺激、200字左右..."
        ></textarea>

        <button
          class="gen-btn"
          @click="generate"
          :disabled="loading"
        >
          {{ loading ? '创作中...' : '生成文案' }}
        </button>
      </div>

      <!-- 输出区 -->
      <div class="copy-output-area" v-if="output">
        <div class="copy-output-header">
          <span class="copy-output-label">生成结果</span>
          <button class="edit-toggle-btn" @click="toggleEdit" v-if="!editMode">编辑</button>
        </div>

        <!-- 编辑模式 -->
        <div v-if="editMode" class="copy-edit-area">
          <textarea
            class="gen-textarea"
            v-model="editText"
            style="min-height:200px"
          ></textarea>
          <div class="edit-actions">
            <button class="gen-btn" @click="saveEdit">保存</button>
            <button class="gen-btn secondary" @click="cancelEdit">取消</button>
          </div>
        </div>

        <!-- 显示模式 -->
        <div
          v-else
          class="copy-output"
          v-html="renderedOutput"
        ></div>

        <!-- 快捷指令 -->
        <div class="quick-refine-bar">
          <span class="quick-refine-label">快捷优化：</span>
          <button
            v-for="cmd in quickCommands"
            :key="cmd"
            class="quick-refine-btn"
            @click="quickRefine(cmd)"
            :disabled="loading"
          >
            {{ cmd }}
          </button>
        </div>

        <!-- 继续优化 -->
        <div class="follow-up-bar">
          <input
            v-model="followUpText"
            placeholder="输入修改要求，如：保留前半部分，把结尾改得更有种草感"
            @keydown.enter="refine"
          >
          <button class="gen-btn" @click="refine" :disabled="loading || !followUpText">
            优化
          </button>
        </div>

        <!-- 操作按钮 -->
        <div class="copy-actions">
          <button class="gen-btn" @click="generate" :disabled="loading">重新生成</button>
          <button class="save-tpl-btn" @click="saveAsTemplate">保存为模板</button>
          <button class="copy-btn" @click="copyText">复制文案</button>
        </div>

        <!-- 评分 -->
        <div ref="ratingEl"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  active: { type: Boolean, default: false }
});

// 表单数据
const form = ref({
  type: '',
  brand: '',
  platform: '',
  product: '',
  extra: ''
});

// 品牌列表
const brands = ref([]);

// 状态
const loading = ref(false);
const output = ref('');
const editMode = ref(false);
const editText = ref('');
const followUpText = ref('');
const ratingEl = ref(null);

// 快捷指令
const quickCommands = [
  '更口语化',
  '更专业',
  '增加种草感',
  '缩短到300字以内',
  '扩写内容',
  '改成小红书风格',
  '增加3个标题'
];

// 渲染 Markdown
const renderedOutput = computed(() => {
  if (!output.value) return '';
  try {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(marked.parse(output.value, { breaks: true, gfm: true }));
    }
  } catch (e) { /* fallback */ }
  return output.value.replace(/\n/g, '<br>');
});

// 加载品牌列表
onMounted(async () => {
  try {
    if (typeof getUserBrands === 'function') {
      const data = await getUserBrands();
      brands.value = data.map(b => b.name || b);
    }
  } catch (e) { /* 静默 */ }
});

// 生成文案
async function generate() {
  if (!form.value.product && !form.value.extra) {
    showToast('请至少填写产品名称或补充要求', 'warning');
    return;
  }

  loading.value = true;
  output.value = '';
  editMode.value = false;

  try {
    // 获取高分案例
    let examples = [];
    if (typeof isLoggedIn === 'function' && isLoggedIn() && typeof getHighRatedExamples === 'function') {
      const highRated = await getHighRatedExamples('copywriting');
      examples = highRated.map(h => h.output_content).filter(Boolean);
    }

    const data = await apiClient.ai.copywriting({
      type: form.value.type,
      brand: form.value.brand,
      platform: form.value.platform,
      product: form.value.product,
      prompt: form.value.extra,
      examples
    });

    output.value = data.text || data.error || '生成失败';

    if (data.text) {
      // 保存到素材库
      if (typeof saveAsset === 'function') {
        saveAsset('copy', form.value.product || '文案', data.text);
      }

      // 保存历史
      if (typeof isLoggedIn === 'function' && isLoggedIn() && typeof saveGenerationHistory === 'function') {
        const inputParams = {
          type: form.value.type,
          brand: form.value.brand,
          platform: form.value.platform,
          product: form.value.product,
          prompt: form.value.extra
        };
        saveGenerationHistory('copywriting', inputParams, data.text).then(historyId => {
          if (historyId && typeof createStarRating === 'function') {
            createStarRating(ratingEl.value, historyId, data.text, 'copywriting');
          }
        });
      }

      // 保存偏好
      if (typeof savePreference === 'function') {
        if (form.value.type) savePreference('copy_type', form.value.type);
        if (form.value.brand) savePreference('copy_brand', form.value.brand);
        if (form.value.platform) savePreference('copy_platform', form.value.platform);
      }
    }
  } catch (e) {
    output.value = '生成失败：' + (e.message || '网络错误');
  } finally {
    loading.value = false;
  }
}

// 编辑模式
function toggleEdit() {
  editMode.value = true;
  editText.value = output.value;
}

function saveEdit() {
  output.value = editText.value;
  editMode.value = false;
}

function cancelEdit() {
  editMode.value = false;
}

// 快捷优化
async function quickRefine(command) {
  await doRefine(`请将文案${command}`);
}

// 继续优化
async function refine() {
  if (!followUpText.value) return;
  await doRefine(followUpText.value);
  followUpText.value = '';
}

// 通用优化逻辑
async function doRefine(instruction) {
  loading.value = true;
  try {
    const data = await apiClient.ai.copywriting({
      type: form.value.type,
      brand: form.value.brand,
      platform: form.value.platform,
      product: form.value.product,
      prompt: instruction,
      current_text: output.value
    });

    if (data.text) {
      output.value = data.text;
    }
  } catch (e) {
    showToast('优化失败：' + (e.message || '请重试'), 'error');
  } finally {
    loading.value = false;
  }
}

// 复制文案
function copyText() {
  if (!output.value) return;
  navigator.clipboard.writeText(output.value).then(() => {
    showToast('文案已复制到剪贴板');
  }).catch(() => {
    // fallback
    const textarea = document.createElement('textarea');
    textarea.value = output.value;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('文案已复制到剪贴板');
  });
}

// 保存为模板
function saveAsTemplate() {
  if (!output.value) return;
  if (typeof saveCurrentAsTemplate === 'function') {
    // 调用 legacy 的模板保存
    const name = prompt('请输入模板名称：');
    if (name) {
      saveUserTemplate({
        name: name,
        type: 'copy',
        content: output.value,
        params: { ...form.value }
      });
      showToast('模板已保存');
    }
  }
}

// 暴露方法
defineExpose({ generate });
</script>
