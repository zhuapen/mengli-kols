/**
 * 任务系统数据库初始化脚本
 * 运行: node db/init-tasks.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function init() {
  console.log('[db] 开始初始化任务系统表...');

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'tasks-schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('[db] ✅ 任务系统表创建完成');
    console.log('[db] ✅ 初始化完成');
  } catch (e) {
    console.error('[db] ❌ 初始化失败:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
