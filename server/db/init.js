/**
 * 数据库初始化脚本
 * 运行: npm run db:init
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function init() {
  console.log('[db] 开始初始化数据库...');

  try {
    // 读取 schema.sql
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    // 执行建表语句
    await pool.query(schema);
    console.log('[db] ✅ 表结构创建完成');

    // 创建默认管理员（如果不存在）
    const bcrypt = require('bcryptjs');
    const adminEmail = '3121950980@qq.com';
    const adminPassword = 'Mengli2026!';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, display_name, role, status, is_active)
       VALUES ($1, $2, '管理员', 'admin', 'approved', true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [adminEmail, passwordHash]
    );

    if (result.rows.length > 0) {
      console.log('[db] ✅ 默认管理员已创建:', adminEmail);
      // 授予所有权限
      const features = await pool.query('SELECT feature_key FROM feature_permissions');
      for (const f of features.rows) {
        await pool.query(
          'INSERT INTO user_feature_permissions (user_id, feature_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [result.rows[0].id, f.feature_key]
        );
      }
      console.log('[db] ✅ 管理员权限已授予');
    } else {
      console.log('[db] ℹ️ 管理员已存在，跳过');
    }

    console.log('[db] ✅ 数据库初始化完成');
  } catch (e) {
    console.error('[db] ❌ 初始化失败:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
