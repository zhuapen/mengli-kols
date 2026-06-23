#!/bin/bash
# 部署 AI 生成功能到腾讯云
# 运行: sudo bash deploy-ai.sh

set -e

echo "🚀 部署 AI 生成功能"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 更新环境变量
cat > /opt/mengli-api/.env << 'EOF'
DATABASE_URL=postgresql://mengli:mengli2024@localhost:5432/mengli_db
MENGLI_HOST=0.0.0.0
MENGLI_PORT=8891
XIAOMI_API_KEY=tp-cz3qg7wpx18o6duu6ynj1zo0o56c60covn6sz0y5wcpxrtae
OPENAI_API_KEY=sk-DyUXCmtjfusFqjUkkIDm7QbGgm5U5JGWiQMCQMlVDBoCEmJo
OPENAI_BASE_URL=https://ai.t8star.org/v1
EOF

# 2. 添加 AI 端点到 server.py
cat >> /opt/mengli-api/server.py << 'PYEOF'

# ===== AI 生成端点 =====
import re as _re
from urllib.request import Request as _Req, urlopen as _urlopen

_XIAOMI_KEY = os.environ.get("XIAOMI_API_KEY", "")
_XIAOMI_URL = "https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages"
_OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
_OPENAI_BASE = os.environ.get("OPENAI_BASE_URL", "https://ai.t8star.org/v1")

_BRAND_KNOWLEDGE = {
    "听研 BIOLAB": "超上扬精华（紧致抗垮旗舰品）、乳霜绷带膜（提拉淡纹急救）、龙血神仙水（日常维稳）、黄油次抛（温和入门敏皮友好）、红毯面膜（即时紧致）、水光仪（精华导入）",
    "她多维": "维矿分层锁鲜活性98%、0碘0铜、19种女性刚需、透明包衣掰开验鲜",
    "SLIM蛋": "500亿燃动菌B207+7S代代蛋白、白桃口味紫色条装、李若彤+宋轶双明星",
    "臻钻蛋白粉": "90%高蛋白、22g免疫蛋白、0乳糖0胆固醇、三高友好、一杯顶27倍牛奶",
    "特医": "6大类34种营养、小蓝花标志、中链脂肪酸快消化、白大褂推荐",
    "双萃水光鱼油": "96%高纯鱼油+2.2g琉璃苣油=海陆双萃抗炎因子、痘肌敏敏肌",
}

_ALL_PRODUCTS = {}
for _b, _p in _BRAND_KNOWLEDGE.items():
    for _i in _p.split("、"):
        _n = _i.split("（")[0].strip()
        if _n: _ALL_PRODUCTS[_n] = _b

_COPY_PROMPT = """你是萌力互动的资深文案，专精 KOC/UGC 社交文案创作。

品牌调性（铁律）：年轻、活力、创新、专业、值得信赖。语言风格：简洁有力、有记忆点、拒绝废话、拒绝AI腔。全中文。

输出规范（铁律）：
1. 正文末尾不带话题标签
2. 每次生成3个备选标题
3. 直接输出文案内容，不要加"好的""以下是"等开场白
4. 不要输出任何解释说明，只输出文案本身

品牌隔离规则（铁律）：
1. 仅围绕当前用户选择的品牌和产品创作，禁止出现未在当前任务中提供的品牌名、产品名
2. 如需举例统一使用"本产品""该产品""该品牌"等中性描述
3. 连带推荐仅限当前品牌的其他产品线，不得跨品牌推荐

语气规范：像朋友/姐妹在聊天。短句为主。善用反问和设问。数据+场景双支撑。
格式规范：禁止使用任何emoji。用「——」做语义转折。适当使用网络语。

禁用词→替换词：脂肪/减肥→代代/数字管理，代谢→代代/循环，最好/第一/唯一→删除，治疗→改善/缓解，医院→白大褂。

直接输出文案，不需要解释。"""


def _build_prompt(brand=""):
    base = _COPY_PROMPT
    if brand and brand in _BRAND_KNOWLEDGE:
        return base + f"\n当前品牌产品信息（仅限使用以下内容，禁止引用其他品牌）：\n{brand}：{_BRAND_KNOWLEDGE[brand]}\n"
    elif brand:
        return base + f"\n当前品牌：{brand}\n（无预置产品信息，请根据用户提供的产品/主题创作，禁止编造产品名）\n"
    return base


def _validate_brand(text, brand):
    if not brand or brand not in _BRAND_KNOWLEDGE: return []
    return [f"{n}（属于{b}）" for n, b in _ALL_PRODUCTS.items() if b != brand and n in text]


def _mimo_stream(sys_prompt, user_prompt, temp=0.65):
    try:
        req = _Req(_XIAOMI_URL, data=json.dumps({
            "model": "mimo-v2.5-pro", "system": sys_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": temp, "max_tokens": 4000, "stream": True
        }).encode(), headers={"x-api-key": _XIAOMI_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"})
        resp = _urlopen(req, timeout=180)
        buf = ""
        while True:
            chunk = resp.read(1024)
            if not chunk: break
            buf += chunk.decode("utf-8", errors="ignore")
            while "\n" in buf:
                line, buf = buf.split("\n", 1)
                line = line.strip()
                if not line or not line.startswith("data: "): continue
                data = line[6:]
                if data == "[DONE]": return
                try:
                    obj = json.loads(data)
                    delta = obj.get("delta", {})
                    if delta.get("type") == "content_block_delta":
                        yield delta.get("delta", {}).get("text", "")
                except: pass
    except Exception as e:
        yield f"[错误: {e}]"


def _mimo_call(sys_prompt, user_prompt, temp=0.65):
    try:
        req = _Req(_XIAOMI_URL, data=json.dumps({
            "model": "mimo-v2.5-pro", "system": sys_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": temp, "max_tokens": 4000
        }).encode(), headers={"x-api-key": _XIAOMI_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"})
        resp = _urlopen(req, timeout=180)
        data = json.loads(resp.read())
        return data.get("content", [{}])[0].get("text", "")
    except Exception as e:
        return f"[错误: {e}]"


from fastapi.responses import StreamingResponse

@app.post("/api")
async def api_dispatch(request: Request):
    body = await request.json()
    action = body.get("action", "")

    if action == "stream_copywriting":
        brand = body.get("brand", "")
        prompt = f"请写一篇「{body.get('type','通用文案')}」类型的{body.get('platform','小红书')}文案"
        if brand: prompt += f"\n品牌：{brand}"
        if body.get("product"): prompt += f"\n产品/主题：{body['product']}"
        if body.get("prompt"): prompt += f"\n补充要求：{body['prompt']}"
        prompt += "\n\n请严格按照对应的文案类型模板来写，保持品牌调性。"
        def gen():
            full = ""
            for chunk in _mimo_stream(_build_prompt(brand), prompt):
                full += chunk
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(gen(), media_type="text/event-stream")

    elif action == "stream_refine":
        original = body.get("original", "")
        instruction = body.get("instruction", "")
        ctx = body.get("context", {})
        brand = ctx.get("brand", "")
        prompt = f"以下是当前文案：\n---\n{original}\n---\n\n修改要求：{instruction}\n\n请输出修改后的完整文案。保留满意的部分，只修改需要改动的地方。"
        def gen():
            for chunk in _mimo_stream(_build_prompt(brand), prompt):
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(gen(), media_type="text/event-stream")

    elif action == "stream_article":
        mode = body.get("mode", "outline")
        extra = body.get("extra", "")
        sys_p = "你是专业公众号写作助手。直接输出文章，不要解释。"
        if mode == "outline":
            sys_p = "你是专业公众号写作助手。输出结构化大纲（800-1200字），含标题、论点框架。直接输出。"
        def gen():
            for chunk in _mimo_stream(sys_p, extra or "请写一篇公众号文章"):
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(gen(), media_type="text/event-stream")

    elif action == "copywriting":
        brand = body.get("brand", "")
        prompt = f"请写一篇「{body.get('type','通用文案')}」类型的{body.get('platform','小红书')}文案"
        if brand: prompt += f"\n品牌：{brand}"
        if body.get("product"): prompt += f"\n产品/主题：{body['product']}"
        if body.get("prompt"): prompt += f"\n补充要求：{body['prompt']}"
        text = _mimo_call(_build_prompt(brand), prompt)
        return {"text": _re.sub(r'\*+', '', text)}

    elif action == "image_gen":
        p = body.get("prompt", "")
        s = body.get("size", "1024x1024")
        try:
            req = _Req(_OPENAI_BASE + "/images/generations", data=json.dumps({
                "model": "gpt-image-2-all", "prompt": p, "n": 1, "size": s, "quality": "medium"
            }).encode(), headers={"Authorization": f"Bearer {_OPENAI_KEY}", "Content-Type": "application/json"})
            resp = _urlopen(req, timeout=120)
            data = json.loads(resp.read())
            return {"image_url": data.get("data", [{}])[0].get("url", "") if data.get("data") else data.get("url", "")}
        except Exception as e:
            return {"error": str(e)}

    elif action == "image_edit":
        prompt = body.get("prompt", "")
        urls = body.get("images_urls", [])
        b64s = body.get("images", [])
        size = body.get("size", "1024x1024")
        imgs = []
        if urls:
            for u in urls:
                try: imgs.append(_urlopen(u, timeout=30).read())
                except: pass
        else:
            import base64
            for b in b64s:
                if "," in b: b = b.split(",", 1)[1]
                imgs.append(base64.b64decode(b))
        if not imgs: return {"error": "图片下载失败"}
        n = len(imgs)
        ep = _OPENAI_BASE.replace("/images/generations", "/images/edits")
        try:
            bd = "----FB" + str(hash(prompt))[:16]
            pts = []
            for i, d in enumerate(imgs):
                pts.append(f'--{bd}\r\nContent-Disposition: form-data; name="image"; filename="r{i}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + d)
            ep2 = prompt
            if n > 1: ep2 = f"The first image is the scene. The second contains the product. Task: {prompt}."
            pts.append(f'--{bd}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n{ep2}'.encode())
            pts.append(f'--{bd}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-2-all'.encode())
            pts.append(f'--{bd}\r\nContent-Disposition: form-data; name="size"\r\n\r\n{size}'.encode())
            pts.append(f'--{bd}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1'.encode())
            body_bytes = b"\r\n".join(pts) + f"\r\n--{bd}--\r\n".encode()
            req = _Req(ep, data=body_bytes, headers={"Authorization": f"Bearer {_OPENAI_KEY}", "Content-Type": f"multipart/form-data; boundary={bd}"})
            resp = _urlopen(req, timeout=120)
            data = json.loads(resp.read())
            return {"image_url": data["data"][0]["url"] if data.get("data") else data.get("url", "")}
        except Exception as e:
            return {"error": f"图生图失败：{e}"}

    elif action == "article":
        text = _mimo_call("你是专业公众号写作助手。直接输出文章。", body.get("extra", "") or "请写一篇公众号文章", 0.8)
        return {"text": text}

    elif action == "feedback":
        original = body.get("original_content", "")
        fb = body.get("feedback_text", "")
        sys_p = '你是文案改进助手。输出JSON：{"improved_content":"改进后文案","changes_summary":["修改点"],"learnings":"总结"}'
        text = _mimo_call(sys_p, f"原文案：\n{original}\n\n反馈：{fb}", 0.7)
        try:
            if text.startswith("```"): text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(text.strip())
        except: return {"improved_content": text, "changes_summary": [], "learnings": ""}

    elif action == "brief_analysis":
        return {"error": "brief_analysis 暂未集成"}

    else:
        return {"error": f"未知 action: {action}"}
PYEOF

# 3. 更新 Nginx — /api 指向本地
cat > /etc/nginx/sites-available/mengli-web << 'NGINX'
server {
    listen 80;
    server_name www.mengliai.cn mengliai.cn;
    return 301 https://www.mengliai.cn$request_uri;
}
server {
    listen 443 ssl http2;
    server_name www.mengliai.cn mengliai.cn;
    ssl_certificate /etc/letsencrypt/live/www.mengliai.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.mengliai.cn/privkey.pem;
    root /var/www/mengli;
    index index.html;
    client_max_body_size 50m;

    # 所有 API → 本地 api-server.py
    location ~ ^/(auth|admin|history|assets|brands|templates|preferences|feedback|permissions|plugins|plugin-feedback|upload|uploads|health|backup|api) {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

nginx -t && systemctl restart nginx

# 4. 重启 API 服务
systemctl restart mengli-api
sleep 2

# 5. 验证
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:8891/health | grep -q "ok"; then
    echo "✅ API 服务正常"
else
    echo "❌ API 服务异常"
    journalctl -u mengli-api -n 10 --no-pager
fi

echo ""
echo "✅ AI 功能部署完成"
echo "📍 文案生成: POST /api {action: stream_copywriting}"
echo "📍 图片生成: POST /api {action: image_gen}"
echo "📍 图生图:   POST /api {action: image_edit}"
