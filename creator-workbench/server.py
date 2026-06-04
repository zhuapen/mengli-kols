"""
萌力互动 · 创作者工作台 — 后端服务
统一 API：达人找号 / 文案撰写 / 图片生成
"""
import os, json, yaml, base64, time, io
from pathlib import Path
from datetime import datetime

import requests
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# ─── 加载配置 ───────────────────────────────────────
HERMES_CONFIG = Path.home() / ".hermes" / "config.yaml"
WORKBENCH_DIR = Path.home() / "Desktop" / "creator-workbench"
IMAGE_CACHE = WORKBENCH_DIR / "images"
IMAGE_CACHE.mkdir(exist_ok=True)

def load_config():
    """从 Hermes 配置加载 API 密钥"""
    config = {}
    try:
        with open(HERMES_CONFIG) as f:
            raw = yaml.safe_load(f)
        # LLM — 优先从 custom_providers 读取（model 段的 key 可能过期）
        config["llm_key"] = ""
        config["llm_base"] = "https://api.deepseek.com"
        config["llm_model"] = "deepseek-v4-pro"
        for cp in raw.get("custom_providers", []):
            if "deepseek" in cp.get("base_url", "").lower():
                config["llm_key"] = cp.get("api_key", "")
                config["llm_base"] = cp.get("base_url", "https://api.deepseek.com")
                config["llm_model"] = cp.get("model", "deepseek-v4-pro")
                break
        # 如果 custom_providers 里没有，回退到 model 段的 key
        if not config["llm_key"]:
            config["llm_key"] = raw.get("model", {}).get("api_key", "")
            config["llm_base"] = raw.get("model", {}).get("base_url", "https://api.deepseek.com")
            config["llm_model"] = raw.get("model", {}).get("default", "deepseek-v4-pro")
        # 图片生成 (t8star)
        for cp in raw.get("custom_providers", []):
            if cp.get("model") == "gpt-image-2-all":
                config["img_key"] = cp.get("api_key", "")
                config["img_base"] = cp.get("base_url", "https://ai.t8star.cn/v1")
                config["img_model"] = cp.get("model", "gpt-image-2-all")
                break
    except Exception as e:
        print(f"[WARN] 加载配置失败: {e}")
    return config

CFG = load_config()

# ─── FastAPI 应用 ────────────────────────────────────
app = FastAPI(title="萌力互动 · 创作者工作台", version="1.0")

# ─── 请求模型 ────────────────────────────────────────
class CopywriterRequest(BaseModel):
    product: str = ""
    platform: str = "公众号"
    style: str = "经验分享"
    requirements: str = ""

class ImageGenRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "landscape"  # landscape, square, portrait

class AISearchRequest(BaseModel):
    query: str
    platform: str = "xhs"

# ─── 文案撰写 API ────────────────────────────────────
@app.post("/api/copywriter")
async def copywriter(req: CopywriterRequest):
    """调用 LLM 生成文案"""
    if not CFG.get("llm_key"):
        return JSONResponse({"error": "API 密钥未配置，请检查 ~/.hermes/config.yaml"}, status_code=500)

    system_prompt = f"""你是萌力互动的专业文案撰写助手。
目标平台：{req.platform}
写作风格：{req.style}
产品/主题：{req.product}

写作要求：
1. 根据平台特性调整语气和格式（公众号长文、小红书短笔记、抖音脚本等）
2. 使用目标读者能理解的语言，避免过于专业的术语
3. 标题要有吸引力但不标题党
4. 正文结构清晰，善用小标题、加粗、列表
5. 结尾要有行动号召
6. 文案中避免使用以下敏感词：生病、感冒（用emoji替代）、三高（用三📈）、减肥/瘦（用数字管理/掉秤/轻盈）、治疗/治愈（用改善/缓解/辅助）、医院/医生（用🏥/白大褂）
7. 禁止绝对化用语：最好的、第一、唯一"""

    if req.requirements:
        system_prompt += f"\n额外要求：{req.requirements}"

    try:
        resp = requests.post(
            f"{CFG['llm_base']}/v1/chat/completions",
            headers={"Authorization": f"Bearer {CFG['llm_key']}", "Content-Type": "application/json"},
            json={
                "model": CFG["llm_model"],
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"请为「{req.product}」写一篇{req.platform}文案，风格：{req.style}"}
                ],
                "temperature": 0.8,
                "max_tokens": 3000
            },
            timeout=120
        )
        content = resp.json()["choices"][0]["message"]["content"]
        return {"success": True, "content": content, "platform": req.platform, "style": req.style}
    except Exception as e:
        return JSONResponse({"error": f"生成失败: {str(e)}"}, status_code=500)


# ─── 图片生成 API ────────────────────────────────────
@app.post("/api/image-gen")
async def image_generate(req: ImageGenRequest):
    """调用 t8star API 生成图片（使用 /images/edits + 占位参考图）"""
    if not CFG.get("img_key"):
        return JSONResponse({"error": "图片生成 API 密钥未配置"}, status_code=500)

    size_map = {"landscape": "1792x1024", "portrait": "1024x1792", "square": "1024x1024"}
    size = size_map.get(req.aspect_ratio, "1792x1024")

    try:
        # 生成一张微小的占位参考图（t8star edits 端点必须有 image 参数）
        from PIL import Image as PILImage
        ref_img = PILImage.new('RGB', (64, 64), (128, 128, 128))
        img_buf = io.BytesIO()
        ref_img.save(img_buf, format='PNG')
        img_buf.seek(0)

        resp = requests.post(
            f"{CFG['img_base']}/images/edits",
            headers={"Authorization": f"Bearer {CFG['img_key']}"},
            files={"image": ("ref.png", img_buf, "image/png")},
            data={
                "model": CFG.get("img_model", "gpt-image-2-all"),
                "prompt": req.prompt,
                "n": "1",
                "size": size,
            },
            timeout=180
        )
        data = resp.json()

        if "data" in data and len(data["data"]) > 0:
            img_url = data["data"][0].get("url", "")
            if img_url:
                # 下载到本地
                img_resp = requests.get(img_url, timeout=60)
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                fname = f"gen_{ts}.png"
                fpath = IMAGE_CACHE / fname
                with open(fpath, "wb") as f:
                    f.write(img_resp.content)
                return {"success": True, "image_path": str(fpath), "prompt": req.prompt}

        error_msg = data.get("error", {}).get("message", str(data))
        return JSONResponse({"error": f"生成失败: {error_msg}"}, status_code=500)

    except Exception as e:
        return JSONResponse({"error": f"生成失败: {str(e)}"}, status_code=500)


# ─── 图片列表 API ────────────────────────────────────
@app.get("/api/images")
async def list_images():
    """返回生成历史"""
    images = []
    if IMAGE_CACHE.exists():
        for f in sorted(IMAGE_CACHE.glob("*.png"), reverse=True)[:20]:
            images.append({
                "path": str(f),
                "name": f.name,
                "time": datetime.fromtimestamp(f.stat().st_mtime).strftime("%H:%M:%S")
            })
    return {"images": images}


# ─── KOL 搜索 API（Mock） ─────────────────────────────
# 嵌入 XHS + DOUYIN 数据供前端调用
@app.post("/api/ai-search")
async def ai_search(req: AISearchRequest):
    """AI 语义搜索达人（目前的 Mock 实现，后续接入真实数据源）"""
    # 关键词映射
    tag_map = {
        "母婴": "母婴", "美妆": "美妆", "美食": "美食", "穿搭": "穿搭",
        "健身": "健身", "旅游": "旅游", "数码": "数码", "宠物": "宠物",
        "搞笑": "搞笑", "剧情": "剧情", "知识": "知识", "运动": "运动",
        "萌宠": "宠物", "育儿": "母婴", "护肤": "美妆", "科技": "数码",
        "颜值": "搞笑", "三农": "美食", "舞蹈": "健身", "日常": "日常",
    }

    query = req.query
    # 简单关键词匹配
    search = ""
    tags = ""
    max_price = 999999
    max_followers = 9999
    min_engagement = 0

    # 提取标签
    for kw, tag in tag_map.items():
        if kw in query:
            tags = tag
            break

    # 提取粉丝限制
    import re
    fm = re.search(r'(\d+)\s*万.*?(以下|以内|以内|不超过)', query)
    if fm:
        max_followers = int(fm.group(1))

    # 提取价格限制
    pm = re.search(r'(\d+[万k千]?).*?(预算|报价|价格)', query)
    if pm:
        val = pm.group(1)
        if '万' in val: max_price = int(float(val.replace('万','')) * 10000)
        elif 'k' in val.lower(): max_price = int(float(val.replace('k','').replace('K','')) * 1000)
        else: max_price = int(float(val.replace('千','')) * 1000)

    # 互动率
    if "互动率高" in query or "高互动" in query:
        min_engagement = 3

    return {
        "search": search,
        "tags": tags,
        "maxPrice": max_price,
        "maxFollowers": max_followers,
        "minEngagement": min_engagement,
        "explanation": f"已根据「{query}」筛选达人"
    }


# ─── 静态文件服务 ─────────────────────────────────────
@app.get("/")
async def root():
    return FileResponse(WORKBENCH_DIR / "static" / "index.html")

# 挂载图片目录，前端可直接访问 /images/xxx.png
app.mount("/images", StaticFiles(directory=IMAGE_CACHE), name="images")
app.mount("/static", StaticFiles(directory=WORKBENCH_DIR / "static"), name="static")

if __name__ == "__main__":
    import uvicorn
    print("🚀 萌力互动 · 创作者工作台 启动中...")
    print(f"   LLM: {CFG.get('llm_model', '未配置')} @ {CFG.get('llm_base', 'N/A')}")
    print(f"   图片: {CFG.get('img_model', '未配置')} @ {CFG.get('img_base', 'N/A')}")
    print(f"   地址: http://localhost:8890")
    uvicorn.run(app, host="127.0.0.1", port=8890, log_level="info")
