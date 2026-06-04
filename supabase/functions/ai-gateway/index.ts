import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const MIMO_KEY = Deno.env.get('XIAOMI_API_KEY') || ''
const MIMO_URL = 'https://api.xiaomimimo.com/v1/chat/completions'
const IMG_KEY = Deno.env.get('OPENAI_API_KEY') || ''
const IMG_BASE = (Deno.env.get('OPENAI_BASE_URL') || 'https://ai.t8star.org/v1')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const KOL_SEARCH_PROMPT = `你是一个达人筛选助手。用户的自然语言描述想找什么样的达人，你把它解析成筛选参数，只返回 JSON。

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

只返回 JSON，不要其他内容。`

const COPYWRITING_PROMPT = `你是萌力互动的资深文案，专精 KOC/UGC 社交文案创作。

## 品牌调性
- 品牌名：萌力互动
- 标语：创意 · 高效 · 品质
- 语言风格：简洁有力、有记忆点、拒绝废话、拒绝AI腔
- 对标水准：苹果式简洁 + 耐克式力量感

## 输出规范（铁律）
1. 正文末尾不带话题标签
2. 每次生成3个备选标题
3. 直接输出文案内容，不要加"好的""以下是"等开场白
4. 不要输出任何解释说明，只输出文案本身

## 语气规范
- 像朋友/姐妹在聊天，不是品牌在说话
- 可以用：姐妹、宝子、大家、我
- 不可以用：小编、本品牌、我们公司
- 短句为主，一段不超过3行
- 善用反问和设问：「有没有想过——」「结果呢？」
- 善用对比：「不是XX，而是XX」

## emoji 使用规范
- emoji密度适中，每段1-2个
- 只用语义相关的emoji（🦴=骨，💪=力量，⚠️=注意，✅=优点，❌=缺点）
- 善用「~」收尾营造轻松感
- 用「——」做语义转折
- 不要堆砌emoji，不要用 😭😂😆😇 等表情emoji

## 禁止事项（绝对不能出现）
- 禁止AI腔：「在当今时代」「值得注意的是」「综上所述」「总而言之」
- 禁止空洞形容词：「极致」「非凡」「卓越」「领先」
- 禁止过度emoji：不要用 🎉🎊✨💖 等装饰性emoji
- 禁止话题标签：正文末尾不要加 #话题标签
- 禁止开场白：不要说「好的」「以下是为您生成的文案」

## 卖点转化公式
上游原料/成分 → 下游用户利益，每一步都要转化：
- ❌ 错误：含有54微克K2
- ✅ 正确：K2含量达到54微克，比起效量还高出20%，能精准把钙送进骨头里🦴

## 6种文案类型模板

### 1. 种草科普文
结构：钩子开头→痛点共鸣→认知颠覆→方法论→产品嵌入→卖点拆解→CTA
示例开头：「急急急！现在谁还在交XX智商税？」

### 2. 误区纠正文
结构：身份锚定→症状共鸣→自查清单→科学解释→产品解决方案→金句收尾
示例开头：「补钙5年都错了？快来自查误区！」

### 3. 场景种草文
结构：场景代入→痛点引爆→原因分析→成分教育→产品展开→体验描述→效果承诺
示例开头：「减脂期运动量翻倍，每天暴汗……」

### 4. 节点促销文
结构：节点引爆→场景切入→人群细分→权威背书→核心卖点深挖→数据碾压→紧迫感
示例开头：「一年一度的618又双叒来了😆」

### 5. 送礼场景文
结构：节日切入→往年对比→情感升华→衰老焦虑→具体症状→产品引出→情感收尾
示例开头：「又到XX节选礼物纠结症犯的时候了」

### 6. 品类教育文
结构：踩坑共鸣→攻略承诺→分点教学→案例佐证→金句收尾
示例开头：「跟风给XX买XX，我也踩过无数坑😭」

请根据用户选择的文案类型，严格对应模板结构输出。直接输出文案，不需要解释。`

const ARTICLE_PROMPT = `你是专业的公众号文章创作者，擅长撰写高质量的品牌公众号文章。

## 输出规范（铁律）
1. 直接输出文章内容，不要加"好的""以下是"等开场白
2. 不要输出任何解释说明，只输出文章本身
3. 严格按下方格式输出

## 写作要求
1. 标题要有吸引力，能引发点击欲望，提供3个备选标题
2. 开头要抓人，前3句话决定读者是否继续阅读
3. 文章结构清晰，善用小标题分段（用 01、02、03 编号）
4. 语气专业但不生硬，有温度有共鸣
5. emoji 极简，只在关键处用1-2个，不要堆砌
6. 结尾要有引导关注/互动的内容
7. 字数控制在 1500-2500 字

## 禁止事项（绝对不能出现）
- 禁止AI腔：「在当今时代」「值得注意的是」「综上所述」「总而言之」「随着...的发展」
- 禁止空洞形容词：「极致」「非凡」「卓越」「领先」「颠覆性」
- 禁止过度emoji：不要用 🎉🎊✨💖🔥 等装饰性emoji
- 禁止开场白：不要说「好的」「以下是为您生成的文章」
- 禁止机械过渡：不要用「首先...其次...最后」这种模板感强的过渡

## 策略分析口吻
- 行业观察者视角：「复盘来看」「值得注意的是」「答案恰恰在于」
- 差异化表达：「与大多数品牌不同」「走出了一条截然不同的道路」
- 金句句式：「这不只是——更是——」「...的背后，是...」「最好的营销，不是...而是...」

## 输出格式

【备选标题】
标题1
标题2
标题3

【推荐标题】
推荐的标题

【摘要】
50字以内的文章摘要

【正文】
01 小标题
正文内容...

02 小标题
正文内容...

03 小标题
正文内容...

写在最后
收尾内容...

直接输出文章，不需要解释。`

async function callMimo(systemPrompt: string, userPrompt: string, temperature = 0) {
  const resp = await fetch(MIMO_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MIMO_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mimo-v2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: 4000
    })
  })
  const data = await resp.json()
  return data.choices[0].message.content.trim()
}

async function kolSearch(body: any) {
  const query = body.query || ''
  if (!query) return { error: '请提供搜索条件' }
  try {
    let content = await callMimo(KOL_SEARCH_PROMPT, query)
    content = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(content)
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { search: query, tags: '', maxPrice: 999999, maxFollowers: 999, minEngagement: 0, explanation: String(e).slice(0, 100) }
    }
    return { error: String(e), search: query, tags: '', maxPrice: 999999, maxFollowers: 999, minEngagement: 0 }
  }
}

async function copywriting(body: any) {
  const copyType = body.type || '通用文案'
  const brand = body.brand || ''
  const platform = body.platform || '小红书'
  const prompt = body.prompt || ''
  const product = body.product || ''
  const examples = body.examples || []

  let fullPrompt = `请写一篇「${copyType}」类型的${platform}文案`
  if (brand) fullPrompt += `\n品牌：${brand}`
  if (product) fullPrompt += `\n产品/主题：${product}`
  if (prompt) fullPrompt += `\n补充要求：${prompt}`

  if (examples.length > 0) {
    fullPrompt += '\n\n以下是用户之前评价较高的文案示例，请参考风格和质量：'
    examples.slice(0, 3).forEach((ex: string, i: number) => {
      fullPrompt += `\n\n示例${i + 1}：\n${String(ex).slice(0, 500)}`
    })
  }

  fullPrompt += '\n\n请严格按照对应的文案类型模板来写，保持品牌调性。'
  const text = await callMimo(COPYWRITING_PROMPT, fullPrompt, 0.8)
  return { text }
}

async function article(body: any) {
  const topic = body.topic || ''
  const articleType = body.type || '种草推荐'
  const brand = body.brand || ''
  const audience = body.audience || ''
  const points = body.points || ''
  const prompt = body.prompt || ''
  const examples = body.examples || []

  let fullPrompt = `请写一篇关于「${topic}」的公众号写稿`
  fullPrompt += `\n文章类型：${articleType}`
  if (brand) fullPrompt += `\n品牌：${brand}`
  if (audience) fullPrompt += `\n目标人群：${audience}`
  if (points) fullPrompt += `\n核心要点：${points}`
  if (prompt) fullPrompt += `\n补充要求：${prompt}`

  if (examples.length > 0) {
    fullPrompt += '\n\n以下是用户之前评价较高的文章示例，请参考风格和质量：'
    examples.slice(0, 3).forEach((ex: string, i: number) => {
      fullPrompt += `\n\n示例${i + 1}：\n${String(ex).slice(0, 500)}`
    })
  }

  const text = await callMimo(ARTICLE_PROMPT, fullPrompt, 0.8)
  return { text }
}

async function imageGen(body: any) {
  const prompt = body.prompt || ''
  const size = body.size || '1024x1024'
  if (!prompt) return { error: '请提供图片描述' }
  try {
    const resp = await fetch(IMG_BASE + '/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IMG_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-2-all',
        prompt,
        n: 1,
        size,
        quality: 'medium'
      })
    })
    const data = await resp.json()
    const imageUrl = data.data?.[0]?.url || data.url || ''
    return { image_url: imageUrl }
  } catch (e) {
    return { error: String(e) }
  }
}

async function chat(body: any) {
  const query = body.query || ''
  if (!query) return { error: '请输入内容' }
  const text = await callMimo('你是萌力互动AI助手，用中文回答，简洁专业。', query, 0.7)
  return { text }
}

const dispatch: Record<string, (body: any) => Promise<any>> = {
  kol_search: kolSearch,
  copywriting,
  article,
  image_gen: imageGen,
  chat
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'ok', service: '萌力互动 AI 网关' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json()
    const action = body.action || 'chat'
    const fn = dispatch[action]

    if (!fn) {
      return new Response(
        JSON.stringify({ error: `未知 action: ${action}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await fn(body)
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
