<template>
  <div class="home-page">
    <div class="home-hero">
      <h1>萌力互动<br>AI创作平台</h1>
      <p>AI 驱动的全域营销创作工具</p>
    </div>
    <div class="home-features">
      <div class="feature-card" @click="$router.push('/media')">
        <div class="feature-icon">📚</div>
        <div class="feature-title">智能媒体库</div>
        <div class="feature-desc">AI Brief 拆解 · 蒲公英采集 · 达人推荐</div>
      </div>
      <div class="feature-card" @click="$router.push('/image')">
        <div class="feature-icon">🎨</div>
        <div class="feature-title">图片生成</div>
        <div class="feature-desc">AI 图片生成 · 图生图 · 遮罩编辑</div>
      </div>
      <div class="feature-card" @click="$router.push('/copy')">
        <div class="feature-icon">✍️</div>
        <div class="feature-title">文案撰写</div>
        <div class="feature-desc">AI 文案生成 · 流式输出 · 版本管理</div>
      </div>
      <div class="feature-card" @click="$router.push('/datacenter')">
        <div class="feature-icon">📊</div>
        <div class="feature-title">数据中心</div>
        <div class="feature-desc">插件工具 · 数据分析 · 系统管理</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  padding: 40px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.home-hero {
  text-align: center;
  margin-bottom: 48px;
}

.home-hero h1 {
  font-size: 48px;
  font-weight: 900;
  line-height: 1.2;
  margin-bottom: 16px;
}

.home-hero p {
  font-size: 18px;
  color: #666;
}

.home-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}

.feature-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: all 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}

.feature-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.feature-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.feature-desc {
  font-size: 14px;
  color: #666;
}
</style>
