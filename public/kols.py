"""萌力互动 AI 统一网关 — Vercel Serverless Function"""

import json, os, re
from urllib.request import Request, urlopen
from http.server import BaseHTTPRequestHandler


def call_mimo_stream(system_prompt, user_prompt, temperature=0.8):
    """调用小米 MiMo API (Anthropic 格式) — 流式版本，yield 每个文本片段"""
    try:
        req = Request(MIMO_URL, data=json.dumps({
            "model": "mimo-v2.5-pro",
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": 4000,
            "stream": True
        }).encode(), headers={
            "x-api-key": MIMO_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        })
        resp = urlopen(req, timeout=180)
        buffer = ""
        leftover = b""  # 缓存不完整的 UTF-8 字节
        while True:
            chunk = resp.read(1024)
            if not chunk:
                break
            raw = leftover + chunk
            # 尝试解码，末尾可能有不完整的多字节字符
            try:
                text = raw.decode("utf-8")
                leftover = b""
            except UnicodeDecodeError:
                # 找到最后一个完整的 UTF-8 字符边界
                cut = len(raw)
                while cut > 0 and (raw[cut-1] & 0xC0) == 0x80:
                    cut -= 1
                if cut > 0 and raw[cut-1] & 0x80:
                    cut -= 1
                text = raw[:cut].decode("utf-8")
                leftover = raw[cut:]
            buffer += text
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line or not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]":
                    return
                try:
                    event = json.loads(data_str)
                    if event.get("type") == "content_block_delta":
                        delta = event.get("delta", {})
                        text = delta.get("text", "")
                        if text:
                            yield text
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        yield f"ERROR: {e}"

# === API 配置 ===
MIMO_KEY = os.environ.get("XIAOMI_API_KEY", "")
MIMO_URL = "https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages"
IMG_KEY = os.environ.get("OPENAI_API_KEY", "")
IMG_URL = os.environ.get("OPENAI_BASE_URL", "https://ai.t8star.org/v1") + "/images/generations"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://fjlxlkokmcdfmwskgvsp.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

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

COPYWRITING_PROMPT = """你是萌力互动的资深文案，专精 KOC/UGC 社交文案创作。你已系统学习过保健品/健康品类和科技护肤品类的 KOC 文案库。

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
- 善用反问和设问：「有没有想过——」「结果呢？」
- 善用对比：「不是XX，而是XX」
- 数据+场景双支撑，不要干讲参数

格式规范：
- 禁止使用任何emoji表情符号
- 用「——」做语义转折
- 适当使用网络语：尊嘟、踩坑、智商税、封神、卷王、真香

卖点转化公式（铁律）：
上游原料/成分 → 下游用户利益，每一步都要转化
错误：含有54微克K2
正确：K2含量达到54微克，比起效量还高出20%，能精准把钙送进骨头里

连带推荐规则：
每篇文案结尾必须连带推荐同品牌其他产品线
- 主推品展开讲（占80%篇幅）
- 连带品一句话带过（占20%篇幅），点出差异化和适用人群

禁用词→替换词（小红书卡审必查）：
脂肪/燃脂/减脂/减肥→代代/数字管理/轻盈
代谢/促进代谢→代代/循环
独家→专研/新型
最好/第一/唯一→删除
神器/法宝→好物/帮手
塑腰/塑形/瘦身→S腰/腰腹S/健身控制
掉秤→方法论/数字
饱腹感/饱腹→满足感
阻断/清掉/化掉/扫除→清除
治疗/治愈→改善/缓解/辅助
医院/医生→白大褂
标签禁用：#减肥 #减脂 #燃脂 #饱腹感 #身材管理 #瘦身
标签可用：#数字管理 #好物分享 #日常 #生活化

语感模式：
模式A轻活人感（默认）：亲身狼狈场景开场，体感细节砸实，卖点融进体验叙事，emoji密度低
模式B重KOC公式：emoji密度高，网络语多，结构模板化，标签轰炸
默认用模式A，除非用户要求「要更小红书一点」「要KOC风格」或节点促销

7种核心文案模板：
1. 种草科普文：钩子开头→痛点共鸣→认知颠覆→方法论→产品嵌入→卖点拆解→连带推荐→CTA
2. 误区纠正文：身份锚定→症状共鸣→自查清单→科学解释→产品解决方案→升级推荐→金句收尾
3. 场景种草文：场景代入→痛点引爆→原因分析→成分教育→产品展开→体验描述→效果承诺→连带
4. 节点促销文：节点引爆→场景切入→人群细分→权威背书→核心卖点深挖→数据碾压→体验加分→紧迫感
5. 送礼场景文：节日切入→往年对比→情感升华→衰老焦虑→具体症状→产品引出→权威背书→配方深讲→情感收尾
6. 品类教育文：踩坑共鸣→攻略承诺→分点教学→案例佐证→金句收尾
7. 横向对比测评文：钩子标题→人设建立信任铺垫→产品逐一点评（篇幅对等）→小结+四字互斥标签→轮换策略+CTA
铁律：不靠字数倾斜突出主推品，靠卖点表达精准度来自然胜出

{品牌产品信息由 build_copy_prompt() 动态注入，此处不硬编码}

正文共性法则：
1. 素人口吻贯穿，禁「小编」「我们品牌」
2. 第一人称叙事交代身份（年龄/肤质/坐标/场景）
3. 效果用体感描述（脸紧了/下颌线回来了/朋友问我是不是做项目了）
4. 反转埋梗（一开始没发现→后来真香；以为是智商税→打脸了）
5. 产品配角化（产品是生活场景中的一环，不是主角）

直接输出文案，不需要解释。"""


# ===== 品牌产品知识库（动态注入，不硬编码到 Prompt） =====
BRAND_KNOWLEDGE = {
    "听研 BIOLAB": "超上扬精华（紧致抗垮旗舰品）、乳霜绷带膜（提拉淡纹急救）、龙血神仙水（日常维稳）、黄油次抛（温和入门敏皮友好）、红毯面膜（即时紧致）、水光仪（精华导入）",
    "她多维": "维矿分层锁鲜活性98%、0碘0铜、19种女性刚需、透明包衣掰开验鲜",
    "SLIM蛋": "500亿燃动菌B207+7S代代蛋白、白桃口味紫色条装、李若彤+宋轶双明星",
    "臻钻蛋白粉": "90%高蛋白、22g免疫蛋白、0乳糖0胆固醇、三高友好、一杯顶27倍牛奶",
    "特医": "6大类34种营养、小蓝花标志、中链脂肪酸快消化、白大褂推荐",
    "双萃水光鱼油": "96%高纯鱼油+2.2g琉璃苣油=海陆双萃抗炎因子、痘肌敏敏肌",
}

# 所有品牌的全量产品名（用于品牌一致性校验）
ALL_BRAND_PRODUCTS = {}
for _brand, _products in BRAND_KNOWLEDGE.items():
    for _item in _products.split("、"):
        _name = _item.split("（")[0].strip()
        if _name:
            ALL_BRAND_PRODUCTS[_name] = _brand


def build_copy_prompt(brand=""):
    """根据用户选择的品牌，动态构建系统 Prompt（只注入当前品牌的产品信息）"""
    base = COPYWRITING_PROMPT

    if brand and brand in BRAND_KNOWLEDGE:
        brand_section = f"\n当前品牌产品信息（仅限使用以下内容，禁止引用其他品牌）：\n{brand}：{BRAND_KNOWLEDGE[brand]}\n"
    elif brand:
        brand_section = f"\n当前品牌：{brand}\n（无预置产品信息，请根据用户提供的产品/主题创作，禁止编造产品名）\n"
    else:
        brand_section = ""

    return base + brand_section


def validate_brand_consistency(text, brand):
    """校验生成内容是否包含其他品牌的产品名，返回违规列表"""
    if not brand or brand not in BRAND_KNOWLEDGE:
        return []

    violations = []
    for product_name, product_brand in ALL_BRAND_PRODUCTS.items():
        if product_brand != brand and product_name in text:
            violations.append(f"{product_name}（属于{product_brand}）")

    return violations


ARTICLE_OUTLINE_PROMPT = """你是专业公众号写作助手，现在执行「大纲」阶段任务。

## 大纲模板（严格按此格式输出）

**备选标题一**：标题1
**备选标题二**：标题2
**备选标题三**：标题3

---

**引入部分**

核心观点引入 + 背景概述 + 过渡到正文（不超150字）

---

**01**

核心论点1（简要概括）

- 观点展开1
- 观点展开2
- 观点展开3

---

**02**

核心论点2（简要概括）

- 观点展开1
- 观点展开2
- 观点展开3

---

**03**

核心论点3（简要概括）

- 观点展开1
- 观点展开2

---

**结尾**

总结升华 + 金句收尾

## 大纲自检（写完后自行检查）

- 标题是否有怂恿感？普通用户看到会不会想点？
- 引入部分是否在150字内完成背景+观点+过渡？
- 每个Part是否有明确的核心论点（不是描述，是洞察）？
- Part之间是否有递进关系而非并列罗列？
- 结尾是否有金句收尾？

## 写作铁律

- 策略向写作：洞察层（核心观点）→ 策略层（为什么）→ 执行层（怎么做）→ 意义层（行业启示）
- 禁止生硬推销、干巴巴罗列卖点、脱离行业背景自说自话
- 多用动词少用形容词，案例细节具体化
- 禁止使用 * 号等 markdown 格式符号，直接用纯文本输出
- 字数控制在800-1200字
- 标注实际字数"""

ARTICLE_DRAFT_PROMPT = """你是专业公众号写作助手，现在执行「初稿」阶段任务。根据已确认的大纲，将其扩充为完整文章。

## 初稿模板（严格按此格式输出）

**标题**：主标题
**备选标题一**：备选1
**备选标题二**：备选2
**备选标题三**：备选3

---

开篇引入（50-150字）
背景 + 核心观点 + 过渡

+配图：图片说明

---

**01**

核心观点段落1
+配图：图片说明
观点展开段落2
+配图：图片说明

---

**02**

核心观点段落1
+配图：图片说明
观点展开段落2

---

**03**

核心观点段落1
+配图：图片说明
观点展开段落2

---

**写在最后**

总结升华 + 金句收尾

## 格式规范

1. 标题后直接正文，不另起段落
2. Part编号用 01、02、03（不用PART）
3. 每个Part内观点用加粗或单独行突出
4. 图片位置用 "+配图：xxx" 标注
5. 重要数据/结论单独成段
6. 结尾用 "写在最后" 标识
7. 排版简洁，去掉多余的星号*、特殊符号

## 初稿自检

- 是否按大纲结构扩充？每个Part是否3-4倍充实？
- 标题是否有怂恿感？
- 是不是在写"创意策略分析"而不是"技术分析报告"？
- 有没有场景描写太多？删掉，直接讲策略
- 卖点是不是从情境机制里长出来的？
- 结尾是否有展开论述还是只罗列结论？
- 有没有凭空捏造的内容？
- 是不是人话？有没有描述性废话？

## 写作铁律

- 策略向写作：洞察层→策略层→执行层→意义层
- 每个Part包含：描述层（What）+ 洞察层（Why）+ 升华层（How）
- 差异化表达："与大多数品牌不同""打破惯例""重新定义..."
- 高频金句句式："从...到...""这不只是——更是——""最好的营销，不是...而是..."
- 禁止使用 * 号等 markdown 格式符号，直接用纯文本输出
- 标注实际字数"""


def extract_file_text(file_data):
    """从上传的文件中提取文本内容（支持 txt/pdf/docx）"""
    import base64, io, zipfile, xml.etree.ElementTree as ET

    filename = file_data.get("name", "")
    b64 = file_data.get("base64", "")
    if "," in b64:
        b64 = b64.split(",", 1)[1]

    raw = base64.b64decode(b64)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    try:
        if ext == "txt":
            return raw.decode("utf-8", errors="replace")

        elif ext == "pdf":
            # 纯 Python PDF 文本提取（不依赖第三方库）
            text_parts = []
            content = raw.decode("latin-1", errors="replace")
            # 查找 stream 中的文本内容
            import re
            for match in re.finditer(rb'\(([^)]+)\)', raw):
                try:
                    text_parts.append(match.group(1).decode("utf-8", errors="replace"))
                except Exception:
                    pass
            # 也尝试 BT/ET 块中的 Tj/TJ 操作符
            for match in re.finditer(rb'BT\s*(.*?)\s*ET', raw, re.DOTALL):
                block = match.group(1)
                for tj in re.finditer(rb'\(([^)]*)\)\s*Tj', block):
                    try:
                        text_parts.append(tj.group(1).decode("utf-8", errors="replace"))
                    except Exception:
                        pass
            return "\n".join(text_parts) if text_parts else "（PDF文件无法提取文本，请将内容复制为TXT格式后重新上传）"

        elif ext == "docx":
            # 纯 Python DOCX 文本提取（docx = zip 包含 word/document.xml）
            zf = zipfile.ZipFile(io.BytesIO(raw))
            xml_content = zf.read("word/document.xml")
            root = ET.fromstring(xml_content)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for p in root.iter(f"{{{ns['w']}}}p"):
                texts = []
                for t in p.iter(f"{{{ns['w']}}}t"):
                    if t.text:
                        texts.append(t.text)
                if texts:
                    paragraphs.append("".join(texts))
            return "\n".join(paragraphs)

        else:
            return f"（不支持的文件格式 .{ext}，请上传 TXT、PDF 或 DOCX 文件）"

    except Exception as e:
        return f"（文件解析失败：{e}）"


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
    system_prompt = build_copy_prompt(brand)
    text = call_mimo(system_prompt, full_prompt, temperature=0.65)
    text = re.sub(r'\*+', '', text)
    # 品牌一致性校验
    if brand and text:
        violations = validate_brand_consistency(text, brand)
        if violations:
            import sys
            print(f"[brand_validation_failed] 品牌={brand}, 违规词={violations}", file=sys.stderr)
    return {"text": text}


def article(body):
    mode = body.get("mode", "outline")
    file_data = body.get("file", None)
    extra = body.get("extra", "")

    system_prompt = ARTICLE_OUTLINE_PROMPT if mode == "outline" else ARTICLE_DRAFT_PROMPT

    user_prompt = ""
    if file_data:
        file_text = extract_file_text(file_data)
        user_prompt += f"客户需求文档内容：\n{file_text}\n\n"
    if extra:
        user_prompt += f"补充说明：{extra}\n\n"
    if not user_prompt:
        user_prompt = "（未提供客户需求文档，请根据常识撰写）"

    text = call_mimo(system_prompt, user_prompt, temperature=0.8)
    text = re.sub(r'\*+', '', text)
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


def enhance_image_edit_prompt(prompt, num_images=1):
    """增强图生图提示词，帮助模型更好地理解替换类需求"""
    replace_keywords = ["替换", "换成", "改成", "换做", "变成", "改为", "换上", "放上", "加上", "加上去"]
    has_replace = any(kw in prompt for kw in replace_keywords)

    if num_images > 1:
        # 多图模式：明确告诉模型两张图的关系
        enhanced = f"The first image is the scene/reference. The second image contains the product/element to be placed into the first image. Task: {prompt}. Place the product from the second image into the first image at the appropriate position. Keep the first image's background, lighting, and composition."
    elif has_replace:
        enhanced = f"Based on the reference image, modify it as follows: {prompt}. Keep the original composition, lighting, and background. Only change what is specifically requested. Maintain the same camera angle and style."
    else:
        enhanced = prompt

    return enhanced


def image_edit(body):
    """图生图/局部重绘。支持两种模式：URL模式（images_urls/mask_url）和Base64模式（images/mask）"""
    prompt = body.get("prompt", "")
    size = body.get("size", "1024x1024")

    # URL 模式：前端已上传到 Storage，传 URL 过来
    images_urls = body.get("images_urls", [])
    mask_url = body.get("mask_url", "")

    # Base64 模式：直接传 base64 数据（兼容旧逻辑）
    images_b64 = body.get("images", [])
    mask_b64 = body.get("mask", "")

    if not images_urls and not images_b64:
        return {"error": "请上传参考图片"}
    if not prompt:
        return {"error": "请输入修改要求"}

    # 统一处理：把 URL 或 base64 都转为 bytes
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

    # 获取图片数据
    image_bytes_list = []
    if images_urls:
        for url in images_urls:
            data = download_url(url)
            if data:
                image_bytes_list.append(data)
    else:
        for b64 in images_b64:
            image_bytes_list.append(decode_b64(b64))

    # 获取 mask 数据
    mask_bytes = None
    if mask_url:
        mask_bytes = download_url(mask_url)
    elif mask_b64:
        mask_bytes = decode_b64(mask_b64)

    if not image_bytes_list:
        return {"error": "图片下载失败"}

    num_images = len(image_bytes_list)

    # 方式A：/images/edits 端点
    edits_url = IMG_URL.replace("/images/generations", "/images/edits")
    try:
        boundary = "----FormBoundary" + str(hash(prompt))[:16]
        parts = []

        # 多图支持：API 的 image 字段支持多图，每张图都用 name="image"
        for i, img_data in enumerate(image_bytes_list):
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="ref{i}.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + img_data)

        # mask
        if mask_bytes:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="mask"; filename="mask.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + mask_bytes)

        # 增强提示词：帮助模型理解"替换"类需求（用原始图片数量，不是合并后的）
        enhanced_prompt = enhance_image_edit_prompt(prompt, num_images)
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n{enhanced_prompt}'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-2-all'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n{size}'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1'.encode())

        body_bytes = b"\r\n".join(parts) + f"\r\n--{boundary}--\r\n".encode()
        req = Request(edits_url, data=body_bytes, headers={
            "Authorization": f"Bearer {IMG_KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        })
        import sys
        print(f"[image_edit] 请求 AI API: images={num_images}张, mask={'有' if mask_bytes else '无'}, size={size}", file=sys.stderr)
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        image_url = data["data"][0]["url"] if data.get("data") else data.get("url", "")
        print(f"[image_edit] 成功: {image_url[:80] if image_url else 'empty'}", file=sys.stderr)
        return {"image_url": image_url, "method": "edits"}
    except Exception as e:
        import sys
        err_detail = ""
        if hasattr(e, "read"):
            try: err_detail = e.read().decode()[:200]
            except: pass
        print(f"[image_edit] 方式A失败: {e} | {err_detail}", file=sys.stderr)
        # 传了 mask 时不做回退——回退端点不支持 mask，静默忽略遮罩会导致整图重绘
        if mask_bytes:
            return {"error": f"局部重绘失败：{e}"}

    # 方式B：回退到 /images/generations（仅无 mask 时，且仅 base64 模式可用）
    if not images_urls:
        try:
            import base64 as _b64
            enhanced_prompt = f"Based on the reference image, modify it: {enhance_image_edit_prompt(prompt, num_images)}"
            req = Request(IMG_URL, data=json.dumps({
                "model": "gpt-image-2-all",
                "prompt": enhanced_prompt,
                "n": 1,
                "size": size,
                "quality": "medium",
                "image": _b64.b64encode(image_bytes_list[0]).decode(),
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

    return {"error": "图生图失败，请重试"}


def chat(body):
    query = body.get("query", "")
    if not query:
        return {"error": "请输入内容"}
    text = call_mimo("你是萌力互动AI助手，用中文回答，简洁专业。", query, temperature=0.7)
    return {"text": text}


def stream_copywriting(body):
    """流式文案生成 — 返回生成器，yield SSE 格式数据"""
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
    # 品牌一致性校验
    if brand and full_text:
        violations = validate_brand_consistency(full_text, brand)
        if violations:
            import sys
            print(f"[brand_validation_failed] 品牌={brand}, 违规词={violations}", file=sys.stderr)


def stream_refine(body):
    """继续优化 — 基于当前文案 + 用户修改要求，流式返回优化结果"""
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

请输出修改后的完整文案。保留用户满意的部分，只修改需要改动的地方。严格遵循系统 Prompt 中的所有规范。"""

    full_text = ""
    for chunk in call_mimo_stream(system_prompt, user_prompt, temperature=0.65):
        full_text += chunk
        yield chunk
    # 品牌一致性校验
    if brand and full_text:
        violations = validate_brand_consistency(full_text, brand)
        if violations:
            import sys
            print(f"[brand_validation_failed:refine] 品牌={brand}, 违规词={violations}", file=sys.stderr)


def stream_article(body):
    """流式写稿生成 — 返回生成器，yield SSE 格式数据"""
    mode = body.get("mode", "outline")
    file_data = body.get("file", None)
    extra = body.get("extra", "")

    system_prompt = ARTICLE_OUTLINE_PROMPT if mode == "outline" else ARTICLE_DRAFT_PROMPT

    user_prompt = ""
    if file_data:
        file_text = extract_file_text(file_data)
        user_prompt += f"客户需求文档内容：\n{file_text}\n\n"
    if extra:
        user_prompt += f"补充说明：{extra}\n\n"
    if not user_prompt:
        user_prompt = "（未提供客户需求文档，请根据常识撰写）"

    for chunk in call_mimo_stream(system_prompt, user_prompt, temperature=0.8):
        yield chunk


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


def create_user(body):
    """管理员创建用户或用户注册（通过 Supabase Admin API）"""
    if not SUPABASE_SERVICE_KEY:
        return {"error": "服务端未配置 SUPABASE_SERVICE_ROLE_KEY"}

    email = body.get("email", "").strip()
    password = body.get("password", "")
    display_name = body.get("display_name", "")
    position = body.get("position", "")
    status = body.get("status", "approved")  # 管理员创建默认 approved，注册默认 pending

    if not email:
        return {"error": "请输入邮箱"}
    if not password or len(password) < 6:
        return {"error": "密码至少6位"}

    try:
        payload = json.dumps({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "display_name": display_name,
                "position": position
            }
        }).encode()

        req = Request(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            data=payload,
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "apikey": SUPABASE_SERVICE_KEY,
                "Content-Type": "application/json"
            }
        )
        resp = urlopen(req, timeout=30)
        data = json.loads(resp.read())
        user_id = data.get("id", "")

        # 设置 user_profiles 的 status（注册用户为 pending）
        if status != "approved" and user_id:
            update_payload = json.dumps({"status": status}).encode()
            update_req = Request(
                f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}",
                data=update_payload,
                method="PATCH",
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Content-Type": "application/json"
                }
            )
            try:
                urlopen(update_req, timeout=30)
            except Exception:
                pass  # 不影响主流程

        return {"success": True, "user_id": user_id}
    except Exception as e:
        err_detail = ""
        if hasattr(e, "read"):
            try:
                err_detail = json.loads(e.read()).get("msg", "")
            except Exception:
                pass
        return {"error": err_detail or str(e)}


def delete_user(body):
    """管理员删除用户（先删 user_profiles 再删 auth 用户）"""
    if not SUPABASE_SERVICE_KEY:
        return {"error": "服务端未配置 SUPABASE_SERVICE_ROLE_KEY"}

    user_id = body.get("user_id", "")
    if not user_id:
        return {"error": "缺少 user_id"}

    try:
        # 1. 先删除 user_profiles（解除外键约束）
        req = Request(
            f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}",
            method="DELETE",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "apikey": SUPABASE_SERVICE_KEY
            }
        )
        urlopen(req, timeout=30)

        # 2. 再删除 auth 用户
        req = Request(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            method="DELETE",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "apikey": SUPABASE_SERVICE_KEY
            }
        )
        urlopen(req, timeout=30)
        return {"success": True}
    except Exception as e:
        err_detail = ""
        if hasattr(e, "read"):
            try:
                err_detail = json.loads(e.read()).get("msg", "")
            except Exception:
                pass
        return {"error": err_detail or str(e)}


def upload_plugin_file(body):
    """管理员上传插件文件到 Supabase Storage（使用 service_role）"""
    if not SUPABASE_SERVICE_KEY:
        return {"error": "服务端未配置 SUPABASE_SERVICE_ROLE_KEY"}

    file_b64 = body.get("file_base64", "")
    filename = body.get("filename", "plugin.zip")

    if not file_b64:
        return {"error": "未提供文件数据"}

    # 去掉 data:xxx;base64, 前缀
    if "," in file_b64:
        file_b64 = file_b64.split(",", 1)[1]

    try:
        import base64, re as _re
        file_data = base64.b64decode(file_b64)
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "zip"
        # 文件名只保留字母数字下划线，中文等非ASCII替换为plugin
        safe_name = _re.sub(r'[^a-zA-Z0-9_\-]', '', filename.rsplit(".", 1)[0])
        if not safe_name:
            safe_name = "plugin"
        storage_path = f"{int(__import__('time').time()*1000)}_{safe_name}.{ext}"

        # 用 service_role 上传到 Storage
        upload_url = f"{SUPABASE_URL}/storage/v1/object/plugins/{storage_path}"
        req = Request(upload_url, data=file_data, method="POST", headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "apikey": SUPABASE_SERVICE_KEY,
            "Content-Type": "application/octet-stream"
        })
        resp = urlopen(req, timeout=60)

        # 获取公开 URL
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/plugins/{storage_path}"
        return {"success": True, "url": public_url, "path": storage_path}

    except Exception as e:
        err_detail = ""
        if hasattr(e, "read"):
            try:
                err_detail = e.read().decode()[:200]
            except Exception:
                pass
        return {"error": f"文件上传失败：{err_detail or str(e)}"}


def upload_image_file(body):
    """上传图片到 Supabase Storage（用于图生图/遮罩，避免请求体超限）"""
    if not SUPABASE_SERVICE_KEY:
        return {"error": "服务端未配置 SUPABASE_SERVICE_ROLE_KEY"}

    file_b64 = body.get("file_base64", "")
    filename = body.get("filename", "image.png")

    if not file_b64:
        return {"error": "未提供文件数据"}

    if "," in file_b64:
        file_b64 = file_b64.split(",", 1)[1]

    try:
        import base64, re as _re, time
        file_data = base64.b64decode(file_b64)
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "png"
        safe_name = _re.sub(r'[^a-zA-Z0-9_\-]', '', filename.rsplit(".", 1)[0]) or "image"
        storage_path = f"images/{int(time.time()*1000)}_{safe_name}.{ext}"

        upload_url = f"{SUPABASE_URL}/storage/v1/object/plugins/{storage_path}"
        req = Request(upload_url, data=file_data, method="POST", headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "apikey": SUPABASE_SERVICE_KEY,
            "Content-Type": "image/png"
        })
        urlopen(req, timeout=60)

        public_url = f"{SUPABASE_URL}/storage/v1/object/public/plugins/{storage_path}"
        return {"success": True, "url": public_url}

    except Exception as e:
        err_detail = ""
        if hasattr(e, "read"):
            try:
                err_detail = e.read().decode()[:200]
            except Exception:
                pass
        return {"error": f"图片上传失败：{err_detail or str(e)}"}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        action = body.get("action", "chat")

        # 流式 action — 逐块写入 SSE 格式
        if action in ("stream_copywriting", "stream_article", "stream_refine"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            gen_fn = {"stream_copywriting": stream_copywriting, "stream_article": stream_article, "stream_refine": stream_refine}[action]
            for chunk in gen_fn(body):
                sse_data = json.dumps({"text": chunk}, ensure_ascii=False)
                self.wfile.write(f"data: {sse_data}\n\n".encode())
                self.wfile.flush()
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
            return

        # 普通 action — JSON 响应
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
        elif action == "create_user":
            result = create_user(body)
        elif action == "delete_user":
            result = delete_user(body)
        elif action == "upload_plugin_file":
            result = upload_plugin_file(body)
        elif action == "upload_image_file":
            result = upload_image_file(body)
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
