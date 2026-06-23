"""
AI 生成端点 — 添加到 api-server.py
提供文案撰写、图片生成、写稿功能
"""

import os, json, re
from urllib.request import Request, urlopen

# AI API 配置
XIAOMI_API_KEY = os.environ.get("XIAOMI_API_KEY", "")
XIAOMI_URL = "https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages"
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE = os.environ.get("OPENAI_BASE_URL", "https://ai.t8star.org/v1")

# 品牌知识库
BRAND_KNOWLEDGE = {
    "听研 BIOLAB": "超上扬精华（紧致抗垮旗舰品）、乳霜绷带膜（提拉淡纹急救）、龙血神仙水（日常维稳）、黄油次抛（温和入门敏皮友好）、红毯面膜（即时紧致）、水光仪（精华导入）",
    "她多维": "维矿分层锁鲜活性98%、0碘0铜、19种女性刚需、透明包衣掰开验鲜",
    "SLIM蛋": "500亿燃动菌B207+7S代代蛋白、白桃口味紫色条装、李若彤+宋轶双明星",
    "臻钻蛋白粉": "90%高蛋白、22g免疫蛋白、0乳糖0胆固醇、三高友好、一杯顶27倍牛奶",
    "特医": "6大类34种营养、小蓝花标志、中链脂肪酸快消化、白大褂推荐",
    "双萃水光鱼油": "96%高纯鱼油+2.2g琉璃苣油=海陆双萃抗炎因子、痘肌敏敏肌",
}

ALL_BRAND_PRODUCTS = {}
for _brand, _products in BRAND_KNOWLEDGE.items():
    for _item in _products.split("、"):
        _name = _item.split("（")[0].strip()
        if _name:
            ALL_BRAND_PRODUCTS[_name] = _brand

# 文案系统 Prompt
COPYWRITING_PROMPT = """你是萌力互动的资深文案，专精 KOC/UGC 社交文案创作。

品牌调性（铁律）：
- 品牌名：萌力互动
- 标语：创意 · 高效 · 品质
- 品牌个性：年轻、活力、创新、专业、值得信赖
- 语言风格：简洁有力、有记忆点、拒绝废话、拒绝AI腔
- 语言：全中文
- 对标水准：苹果式简洁 + 耐克式力量感

输出规范（铁律）：
1. 正文末尾不带话题标签
2. 每次生成3个备选标题
3. 直接输出文案内容，不要加"好的""以下是"等开场白
4. 不要输出任何解释说明，只输出文案本身
5. 严禁卡审词（见下方禁用词表）

品牌隔离规则（铁律）：
1. 仅围绕当前用户选择的品牌和产品创作，禁止出现未在当前任务中提供的品牌名、产品名、竞品名或企业名
2. 如需举例统一使用"本产品""该产品""该品牌"等中性描述
3. 连带推荐仅限当前品牌的其他产品线，不得跨品牌推荐
4. 禁止引用历史案例中的品牌内容

语气规范：
- 像朋友/姐妹在聊天，不是品牌在说话
- 可以用：姐妹、宝子、大家、我
- 不可以用：小编、本品牌、我们公司
- 短句为主，一段不超过3行
- 善用反问和设问
- 数据+场景双支撑，不要干讲参数

格式规范：
- 禁止使用任何emoji表情符号
- 用「——」做语义转折
- 适当使用网络语

卖点转化公式（铁律）：
上游原料/成分 → 下游用户利益，每一步都要转化

连带推荐规则：
每篇文案结尾必须连带推荐同品牌其他产品线
- 主推品展开讲（占80%篇幅）
- 连带品一句话带过（占20%篇幅）

禁用词→替换词（小红书卡审必查）：
脂肪/燃脂/减脂/减肥→代代/数字管理/轻盈
代谢/促进代谢→代代/循环
独家→专研/新型
最好/第一/唯一→删除
神器/法宝→好物/帮手
塑腰/塑形/瘦身→S腰/腰腹S/健身控制
掉秤→方法论/数字
饱腹感/饱腹→满足感
治疗/治愈→改善/缓解/辅助
医院/医生→白大褂

直接输出文案，不需要解释。"""


def build_copy_prompt(brand=""):
    base = COPYWRITING_PROMPT
    if brand and brand in BRAND_KNOWLEDGE:
        return base + f"\n当前品牌产品信息（仅限使用以下内容，禁止引用其他品牌）：\n{brand}：{BRAND_KNOWLEDGE[brand]}\n"
    elif brand:
        return base + f"\n当前品牌：{brand}\n（无预置产品信息，请根据用户提供的产品/主题创作，禁止编造产品名）\n"
    return base


def validate_brand_consistency(text, brand):
    if not brand or brand not in BRAND_KNOWLEDGE:
        return []
    violations = []
    for product_name, product_brand in ALL_BRAND_PRODUCTS.items():
        if product_brand != brand and product_name in text:
            violations.append(f"{product_name}（属于{product_brand}）")
    return violations


def call_mimo_stream(system_prompt, user_prompt, temperature=0.65):
    """流式调用 MiMo API"""
    try:
        req = Request(XIAOMI_URL, data=json.dumps({
            "model": "mimo-v2.5-pro",
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": temperature,
            "max_tokens": 4000,
            "stream": True
        }).encode(), headers={
            "x-api-key": XIAOMI_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        })
        resp = urlopen(req, timeout=180)
        buffer = ""
        while True:
            chunk = resp.read(1024)
            if not chunk:
                break
            text = chunk.decode("utf-8", errors="ignore")
            buffer += text
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    return
                try:
                    obj = json.loads(data)
                    delta = obj.get("delta", {})
                    if delta.get("type") == "content_block_delta":
                        yield delta.get("delta", {}).get("text", "")
                except json.JSONDecodeError:
                    pass
    except Exception as e:
        yield f"[错误: {e}]"


def call_mimo(system_prompt, user_prompt, temperature=0.65):
    """非流式调用 MiMo API"""
    try:
        req = Request(XIAOMI_URL, data=json.dumps({
            "model": "mimo-v2.5-pro",
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": temperature,
            "max_tokens": 4000
        }).encode(), headers={
            "x-api-key": XIAOMI_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        })
        resp = urlopen(req, timeout=180)
        data = json.loads(resp.read())
        return data.get("content", [{}])[0].get("text", "")
    except Exception as e:
        return f"[错误: {e}]"


def stream_copywriting(body):
    """流式文案生成"""
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
    system_prompt = build_copy_prompt(brand)
    full_text = ""
    for chunk in call_mimo_stream(system_prompt, full_prompt, temperature=0.65):
        full_text += chunk
        yield chunk
    if brand and full_text:
        violations = validate_brand_consistency(full_text, brand)
        if violations:
            import sys
            print(f"[brand_validation_failed] 品牌={brand}, 违规词={violations}", file=sys.stderr)


def stream_refine(body):
    """继续优化"""
    original = body.get("original", "")
    instruction = body.get("instruction", "")
    context = body.get("context", {})
    brand = context.get("brand", "")
    copy_type = context.get("type", "通用文案")
    platform = context.get("platform", "小红书")
    system_prompt = build_copy_prompt(brand)
    user_prompt = f"""以下是当前「{copy_type}」类型的{platform}文案：
---
{original}
---

用户希望做以下修改：{instruction}

请输出修改后的完整文案。保留用户满意的部分，只修改需要改动的地方。"""
    for chunk in call_mimo_stream(system_prompt, user_prompt, temperature=0.65):
        yield chunk


def copywriting(body):
    """非流式文案生成"""
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
    system_prompt = build_copy_prompt(brand)
    text = call_mimo(system_prompt, full_prompt, temperature=0.65)
    text = re.sub(r'\*+', '', text)
    return {"text": text}


def image_gen(body):
    """文生图"""
    prompt = body.get("prompt", "")
    size = body.get("size", "1024x1024")
    if not prompt:
        return {"error": "请提供图片描述"}
    try:
        req = Request(OPENAI_BASE + "/images/generations", data=json.dumps({
            "model": "gpt-image-2-all",
            "prompt": prompt,
            "n": 1,
            "size": size,
            "quality": "medium"
        }).encode(), headers={
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json"
        })
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        image_url = data.get("data", [{}])[0].get("url", "") if data.get("data") else data.get("url", "")
        return {"image_url": image_url}
    except Exception as e:
        return {"error": str(e)}


def image_edit(body):
    """图生图"""
    prompt = body.get("prompt", "")
    images_urls = body.get("images_urls", [])
    images_b64 = body.get("images", [])
    size = body.get("size", "1024x1024")
    if not images_urls and not images_b64:
        return {"error": "请上传参考图片"}
    if not prompt:
        return {"error": "请输入修改要求"}

    def download_url(url):
        try:
            resp = urlopen(url, timeout=30)
            return resp.read()
        except Exception:
            return None

    def decode_b64(b64_str):
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        import base64
        return base64.b64decode(b64_str)

    image_bytes_list = []
    if images_urls:
        for url in images_urls:
            data = download_url(url)
            if data:
                image_bytes_list.append(data)
    else:
        for b64 in images_b64:
            image_bytes_list.append(decode_b64(b64))

    if not image_bytes_list:
        return {"error": "图片下载失败"}

    num_images = len(image_bytes_list)
    edits_url = OPENAI_BASE.replace("/images/generations", "/images/edits")
    try:
        boundary = "----FormBoundary" + str(hash(prompt))[:16]
        parts = []
        for i, img_data in enumerate(image_bytes_list):
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="ref{i}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + img_data)

        enhanced_prompt = prompt
        if num_images > 1:
            enhanced_prompt = f"The first image is the scene. The second image contains the product to place. Task: {prompt}. Place the product from the second image into the first image."

        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n{enhanced_prompt}'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-2-all'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n{size}'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1'.encode())

        body_bytes = b"\r\n".join(parts) + f"\r\n--{boundary}--\r\n".encode()
        req = Request(edits_url, data=body_bytes, headers={
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        })
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        image_url = data["data"][0]["url"] if data.get("data") else data.get("url", "")
        return {"image_url": image_url, "method": "edits"}
    except Exception as e:
        return {"error": f"图生图失败：{e}"}


def stream_article(body):
    """流式写稿"""
    mode = body.get("mode", "outline")
    extra = body.get("extra", "")
    file_data = body.get("file", None)

    ARTICLE_OUTLINE_PROMPT = """你是专业公众号写作助手，现在执行「大纲」阶段任务。

## 大纲模板（严格按此格式输出）
1. 推荐标题（3个备选）
2. 开头段（钩子+痛点）
3. 三个核心论点（每个含小标题+2-3个要点）
4. 结尾段（总结+引导互动）

字数目标：800-1200字。直接输出大纲，不要解释。"""

    ARTICLE_DRAFT_PROMPT = """你是专业公众号写作助手，现在执行「初稿」阶段任务。

## 写作要求
1. 标题有吸引力，提供3个备选
2. 开头抓人，前3句话决定读者是否继续
3. 结构清晰，善用小标题分段（01、02、03编号）
4. 语气专业但不生硬，有温度有共鸣
5. emoji极简，只在关键处用1-2个
6. 结尾引导关注/互动
7. 字数1500-2500字

禁止AI腔、禁止空洞形容词、禁止开场白。直接输出文章。"""

    system_prompt = ARTICLE_OUTLINE_PROMPT if mode == "outline" else ARTICLE_DRAFT_PROMPT
    user_prompt = ""
    if extra:
        user_prompt += f"补充说明：{extra}\n\n"
    if not user_prompt:
        user_prompt = "（未提供需求文档，请根据常识撰写）"

    for chunk in call_mimo_stream(system_prompt, user_prompt, temperature=0.8):
        yield chunk


def article(body):
    """非流式写稿"""
    mode = body.get("mode", "outline")
    extra = body.get("extra", "")
    system_prompt = "你是专业公众号写作助手。直接输出文章，不要解释。"
    user_prompt = extra or "请写一篇公众号文章"
    text = call_mimo(system_prompt, user_prompt, temperature=0.8)
    return {"text": text}


def feedback(body):
    """反馈改进"""
    original = body.get("original_content", "")
    feedback_text = body.get("feedback_text", "")
    FEEDBACK_PROMPT = """你是文案改进助手。用户对之前的文案不满意，请根据反馈改进。

输出JSON格式：
{
    "improved_content": "改进后的完整文案",
    "changes_summary": ["修改点1", "修改点2"],
    "learnings": "本次改进的要点总结"
}"""
    user_prompt = f"原文案：\n{original}\n\n用户反馈：{feedback_text}"
    text = call_mimo(FEEDBACK_PROMPT, user_prompt, temperature=0.7)
    try:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except Exception:
        return {"improved_content": text, "changes_summary": [], "learnings": ""}
