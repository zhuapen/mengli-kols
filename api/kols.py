"""萌力互动 AI 统一网关 — Vercel Serverless Function"""

import json, os, re
from urllib.request import Request, urlopen
from http.server import BaseHTTPRequestHandler

# === API 配置 ===
MIMO_KEY = os.environ.get("XIAOMI_API_KEY", "")
MIMO_URL = "https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages"
IMG_KEY = os.environ.get("OPENAI_API_KEY", "")
IMG_URL = os.environ.get("OPENAI_BASE_URL", "https://ai.t8star.org/v1") + "/images/generations"

# === Prompts ===
KOL_SEARCH_PROMPT = """你是一个达人筛选助手。用户的自然语言描述想找什么样的达人，你把它解析成筛选参数，只返回 JSON。

JSON 格式：
{
  "search": "关键词搜索达人昵称/人设, 没有则空字符串",
  "tags": "匹配的标签, 用逗号分隔, 没有则空字符串",
  "maxPrice": 最高预算数字, 没有限制则 999999,
  "maxFollowers": 粉丝上限数字(单位:万), 没有限制则 999,
  "minEngagement": 最低互动率数字(如 3.0 表示 3%), 没有则 0,
  "explanation": "一句话说明你用了什么筛选条件"
}

可用的标签: 母婴, 美妆, 美食, 穿搭, 健身, 旅游, 数码, 宠物, 亲子, 育儿, 护肤, 测评, 探店, 教程, 好物分享, 日常, 辅食, 玩具, 运动, 攻略, 时尚

只返回 JSON，不要其他内容。"""

COPYWRITING_PROMPT = """你是萌力互动的资深文案，专精 KOC/UGC 社交文案创作。

品牌调性：
- 品牌名：萌力互动
- 标语：创意 · 高效 · 品质
- 语言风格：简洁有力、有记忆点、拒绝废话、拒绝AI腔
- 对标水准：苹果式简洁 + 耐克式力量感

写作要求：
- 根据用户选择的文案类型，套用对应的写作模板
- 根据用户选择的品牌，使用该品牌的专属话术和卖点
- 根据用户选择的平台，调整文案风格和长度
- 语气自然、有亲和力，像真人博主在分享
- 适当使用 emoji
- 避免绝对化用语和违禁词

文案类型模板：
1. 种草科普文：钩子开头→痛点共鸣→认知颠覆→方法论→产品嵌入→卖点拆解→CTA
2. 误区纠正文：身份锚定→症状共鸣→自查清单→科学解释→产品解决方案→金句收尾
3. 场景种草文：场景代入→痛点引爆→原因分析→成分教育→产品展开→体验描述→效果承诺
4. 节点促销文：节点引爆→场景切入→人群细分→权威背书→核心卖点深挖→数据碾压→紧迫感
5. 送礼场景文：节日切入→往年对比→情感升华→衰老焦虑→具体症状→产品引出→情感收尾

直接输出文案，不需要解释。"""

ARTICLE_PROMPT = """你是专业的公众号文章创作者，擅长撰写高质量的品牌公众号推文。

写作要求：
1. 标题要有吸引力，能引发点击欲望
2. 开头要抓人，前3句话决定读者是否继续阅读
3. 文章结构清晰，善用小标题分段
4. 语气专业但不生硬，有温度有共鸣
5. 适当使用 emoji 增加可读性
6. 结尾要有引导关注/互动的内容
7. 字数控制在 1200-2000 字

输出格式：
【标题】
文章标题

【摘要】
50字以内的文章摘要

【正文】
完整文章内容

直接输出文章，不需要解释。"""


def call_mimo(system_prompt, user_prompt, temperature=0):
    """调用小米 MiMo API (Anthropic 格式)"""
    try:
        req = Request(MIMO_URL, data=json.dumps({
            "model": "mimo-v2.5-pro",
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": 4000
        }).encode(), headers={
            "x-api-key": MIMO_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        })
        resp = urlopen(req, timeout=180)
        data = json.loads(resp.read())
        # Anthropic 格式：content 是数组，提取 text 类型的内容
        content_blocks = data.get("content", [])
        text_parts = [b["text"] for b in content_blocks if b.get("type") == "text"]
        return "\n".join(text_parts).strip()
    except Exception as e:
        return f"ERROR: {e}"


def kol_search(body):
    query = body.get("query", "")
    if not query:
        return {"error": "请提供搜索条件"}
    try:
        content = call_mimo(KOL_SEARCH_PROMPT, query)
        content = re.sub(r'^```(?:json)?\s*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)
        return json.loads(content)
    except json.JSONDecodeError:
        return {"search": query, "tags": "", "maxPrice": 999999, "maxFollowers": 999, "minEngagement": 0, "explanation": content[:100]}
    except Exception as e:
        return {"error": str(e), "search": query, "tags": "", "maxPrice": 999999, "maxFollowers": 999, "minEngagement": 0}


def copywriting(body):
    copy_type = body.get("type", "通用文案")
    brand = body.get("brand", "")
    platform = body.get("platform", "小红书")
    prompt = body.get("prompt", "")
    product = body.get("product", "")
    full_prompt = f"请写一篇「{copy_type}」类型的{platform}文案"
    if brand:
        full_prompt += f"\n品牌：{brand}"
    if product:
        full_prompt += f"\n产品/主题：{product}"
    if prompt:
        full_prompt += f"\n补充要求：{prompt}"
    full_prompt += "\n\n请严格按照对应的文案类型模板来写，保持品牌调性。"
    text = call_mimo(COPYWRITING_PROMPT, full_prompt, temperature=0.8)
    return {"text": text}


def article(body):
    topic = body.get("topic", "")
    article_type = body.get("type", "种草推荐")
    brand = body.get("brand", "")
    audience = body.get("audience", "")
    points = body.get("points", "")
    prompt = body.get("prompt", "")
    full_prompt = f"请写一篇关于「{topic}」的公众号推文"
    full_prompt += f"\n文章类型：{article_type}"
    if brand:
        full_prompt += f"\n品牌：{brand}"
    if audience:
        full_prompt += f"\n目标人群：{audience}"
    if points:
        full_prompt += f"\n核心要点：{points}"
    if prompt:
        full_prompt += f"\n补充要求：{prompt}"
    text = call_mimo(ARTICLE_PROMPT, full_prompt, temperature=0.8)
    return {"text": text}


def image_gen(body):
    prompt = body.get("prompt", "")
    size = body.get("size", "1024x1024")
    if not prompt:
        return {"error": "请提供图片描述"}
    try:
        req = Request(IMG_URL, data=json.dumps({
            "model": "gpt-image-2-all",
            "prompt": prompt,
            "n": 1,
            "size": size,
            "quality": "medium"
        }).encode(), headers={
            "Authorization": f"Bearer {IMG_KEY}",
            "Content-Type": "application/json"
        })
        resp = urlopen(req, timeout=60)
        data = json.loads(resp.read())
        image_url = data["data"][0]["url"] if data.get("data") else data.get("url", "")
        return {"image_url": image_url}
    except Exception as e:
        return {"error": str(e)}


def image_edit(body):
    """图生图：传入参考图 + 修改要求，生成新图"""
    prompt = body.get("prompt", "")
    images = body.get("images", [])  # base64 数组，最多3张
    size = body.get("size", "1024x1024")
    if not images:
        return {"error": "请上传参考图片"}
    if not prompt:
        return {"error": "请输入修改要求"}

    # 去掉 data:image/xxx;base64, 前缀，只保留纯 base64
    clean_images = []
    for img in images:
        if "," in img:
            img = img.split(",", 1)[1]
        clean_images.append(img)

    # 方式A：尝试 /images/edits 端点
    edits_url = IMG_URL.replace("/images/generations", "/images/edits")
    try:
        import base64, io, mimetypes
        # 构造 multipart/form-data 请求
        boundary = "----FormBoundary" + str(hash(prompt))[:16]
        parts = []

        # 第一张图作为 image
        img_data = base64.b64decode(clean_images[0])
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="ref.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + img_data)

        # 如果有多张图，作为额外的 reference images
        for i, img_b64 in enumerate(clean_images[1:], 1):
            img_data = base64.b64decode(img_b64)
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image{i}"; filename="ref{i}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + img_data)

        # prompt 字段
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n{prompt}'.encode())
        # model 字段
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-2-all'.encode())
        # size 字段
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n{size}'.encode())
        # n 字段
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1'.encode())

        body_bytes = b"\r\n".join(parts) + f"\r\n--{boundary}--\r\n".encode()
        req = Request(edits_url, data=body_bytes, headers={
            "Authorization": f"Bearer {IMG_KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        })
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        image_url = data["data"][0]["url"] if data.get("data") else data.get("url", "")
        return {"image_url": image_url, "method": "edits"}
    except Exception:
        pass

    # 方式B：回退到 /images/generations，在 prompt 中描述参考图
    try:
        enhanced_prompt = f"基于以下参考图片进行修改：{prompt}"
        req = Request(IMG_URL, data=json.dumps({
            "model": "gpt-image-2-all",
            "prompt": enhanced_prompt,
            "n": 1,
            "size": size,
            "quality": "medium",
            "image": clean_images[0],
            "images": clean_images if len(clean_images) > 1 else None
        }).encode(), headers={
            "Authorization": f"Bearer {IMG_KEY}",
            "Content-Type": "application/json"
        })
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        image_url = data["data"][0]["url"] if data.get("data") else data.get("url", "")
        return {"image_url": image_url, "method": "generations"}
    except Exception as e:
        return {"error": f"图生图失败：{e}"}


def chat(body):
    query = body.get("query", "")
    if not query:
        return {"error": "请输入内容"}
    text = call_mimo("你是萌力互动AI助手，用中文回答，简洁专业。", query, temperature=0.7)
    return {"text": text}


FEEDBACK_PROMPT = """你是内容优化专家。用户对生成的内容不满意，请根据反馈进行改进。

要求：
1. 根据用户反馈改进内容，保持原有风格和意图
2. 用简洁的中文列出修改了哪些地方
3. 总结学习到了什么（用户偏好）

返回 JSON 格式：
{
  "improved_content": "改进后的完整内容",
  "changes_summary": ["修改点1", "修改点2", "修改点3"],
  "learnings": "学习总结：用户偏好..."
}

只返回 JSON，不要其他内容。"""


def feedback(body):
    """处理用户反馈，改进内容"""
    original = body.get("original_content", "")
    feedback_text = body.get("feedback_text", "")
    gen_type = body.get("gen_type", "copywriting")

    if not original:
        return {"error": "缺少原始内容"}
    if not feedback_text:
        return {"error": "请描述不满意的地方"}

    prompt = f"原始内容（类型：{gen_type}）：\n{original}\n\n用户反馈：\n{feedback_text}"

    try:
        content = call_mimo(FEEDBACK_PROMPT, prompt, temperature=0.7)
        # 去掉 markdown 代码块
        content = re.sub(r'^```(?:json)?\s*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)
        result = json.loads(content)
        return result
    except json.JSONDecodeError:
        return {
            "improved_content": content,
            "changes_summary": ["内容已优化"],
            "learnings": "根据用户反馈进行了改进"
        }
    except Exception as e:
        return {"error": str(e)}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        action = body.get("action", "chat")

        if action == "kol_search":
            result = kol_search(body)
        elif action == "copywriting":
            result = copywriting(body)
        elif action == "image_gen":
            result = image_gen(body)
        elif action == "image_edit":
            result = image_edit(body)
        elif action == "article":
            result = article(body)
        elif action == "chat":
            result = chat(body)
        elif action == "feedback":
            result = feedback(body)
        else:
            result = {"error": f"未知 action: {action}"}

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
