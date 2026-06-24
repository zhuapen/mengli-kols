# 萌力互动 · 协作开发规范

## 分支规范

| 分支 | 用途 | 保护规则 |
|------|------|----------|
| `main` | 生产分支，对应 www.mengliai.cn | 必须通过 PR，至少 1 人审批，禁止直接 Push |
| `develop` | 测试/集成分支 | 必须通过 PR，至少 1 人审批 |
| `feature/*` | 功能分支 | 无限制，自由开发 |
| `fix/*` | Bug 修复 | 无限制 |
| `hotfix/*` | 紧急修复 | 无限制 |

## 开发流程

### 1. 开发前：同步最新代码

```bash
git checkout develop
git pull origin develop
```

### 2. 创建功能分支

```bash
git checkout -b feature/功能名
```

命名示例：
- `feature/media-library` — 智能媒体库
- `feature/image-editor` — 图片编辑器
- `feature/auth-refactor` — 认证重构
- `feature/copywriting-vue` — 文案页 Vue 迁移

### 3. 开发并提交

```bash
git add -A
git commit -m "feat: 功能描述"
git push origin feature/功能名
```

提交信息规范：
- `feat:` — 新功能
- `fix:` — Bug 修复
- `refactor:` — 重构
- `perf:` — 性能优化
- `docs:` — 文档
- `chore:` — 构建/工具

### 4. 创建 PR

```
feature/* → develop
```

- 填写 PR 描述（做了什么、为什么、怎么测试）
- 等待 CI 检查通过
- 至少 1 人 Code Review 审批

### 5. 测试验证

- Vercel 自动生成 Preview 环境
- 在预览环境完成功能测试
- 确认无问题后合并

### 6. 合并到 develop

- 所有功能联调通过后，从 develop 创建 PR 到 main
- 同样需要 1 人审批

### 7. 发布到生产

```
develop → main
```

- 合并到 main 后，Vercel 自动发布到生产环境
- 线上地址：https://www.mengliai.cn

## 分支保护规则

### main 分支
- ✅ 禁止直接 Push
- ✅ 必须通过 PR 合并
- ✅ 至少 1 人审批
- ✅ 禁止 force push
- ✅ 禁止删除

### develop 分支
- ✅ 禁止直接 Push
- ✅ 必须通过 PR 合并
- ✅ 至少 1 人审批
- ✅ 禁止 force push
- ✅ 禁止删除

## 智能媒体库

智能媒体库保持独立架构：

- **前端**：Vercel（现有网站）
- **后端**：独立部署（Railway 或独立服务器）
- **数据库**：媒体库独立数据库
- **通信**：通过 API，不修改现有核心功能

不影响的功能：
- 登录认证
- 品牌隔离
- 流式生成
- 图生图
- 编辑模式
- 版本管理

## 常用命令

```bash
# 查看当前分支
git branch

# 切换分支
git checkout 分支名

# 同步远程
git fetch origin

# 查看分支状态
git branch -vv

# 删除本地分支
git branch -d 分支名

# 删除远程分支
git push origin --delete 分支名
```

## 注意事项

1. **不要直接 Push 到 main 或 develop**
2. **开发前先同步 develop 最新代码**
3. **提交信息要清晰描述改动**
4. **PR 描述要完整（做了什么、为什么、怎么测试）**
5. **合并前确认 CI 检查通过**
6. **合并后及时删除已合并的 feature 分支**
