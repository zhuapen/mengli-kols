#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.dirname(__dirname);
const ROOT_DIR = path.dirname(APP_DIR);
const SERVER = (process.env.MENGLI_SERVER || "http://127.0.0.1:8890").replace(/\/$/, "");
const TASK_ID = process.argv[2] || "";
const NODE_MODULE_DIRS = [
  process.env.MENGLI_NODE_MODULES,
  "/Users/tulei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
  path.join(ROOT_DIR, "node_modules")
].filter(Boolean);

const TAG_BANK = [
  "美食", "种草", "开箱", "测评", "零食", "坚果", "早餐", "轻食", "养生",
  "上班族", "学生党", "精致妈妈", "母婴", "家居", "护肤", "数码", "职场"
];
const SEARCH_URL = "https://pgy.xiaohongshu.com/solar/pre-trade/note/kol";
const MAX_PAGES_PER_KEYWORD = Number(process.env.MENGLI_PGY_MAX_PAGES || 8);
const DEFAULT_TARGET_COUNT = 30;
const MAX_COLLECTION_ROUNDS = 3;

if (!TASK_ID) {
  console.error("用法：node creator-workbench/scripts/run-pgy-task.mjs codex_xxx");
  process.exit(1);
}

const require = createRequire(import.meta.url);

async function loadPlaywright() {
  const resolved = require.resolve("playwright", { paths: NODE_MODULE_DIRS });
  return require(resolved);
}

function resolveChromiumExecutable(chromium) {
  const candidates = [
    chromium.executablePath?.(),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || "";
}

async function api(pathname, options = {}) {
  const resp = await fetch(`${SERVER}${pathname}`, {
    ...options,
    headers: {"Content-Type": "application/json", ...(options.headers || {})}
  });
  const text = await resp.text();
  const data = text ? JSON.parse(text) : {};
  if (!resp.ok) throw new Error(data.detail || data.error || `HTTP ${resp.status}`);
  return data;
}

async function updateTask(status, message = "", collected = undefined, result = {}) {
  await api(`/api/codex-tasks/${encodeURIComponent(TASK_ID)}/status`, {
    method: "POST",
    body: JSON.stringify({status, message, collected_count: collected, result})
  });
  const suffix = message ? `：${message}` : "";
  console.log(`[${new Date().toLocaleTimeString()}] ${status}${suffix}`);
}

function normalizeKeywords(task) {
  const payload = task.payload || {};
  const analysis = payload.analysis || {};
  const collector = payload.collector || {};
  const raw = [
    payload.brand,
    payload.brief,
    ...(collector.keywords || []),
    ...(analysis.keywords || []),
    ...(analysis.creatorTypes || []),
    ...(analysis.requiredAudienceTags || [])
  ];
  const compact = [];
  for (const item of raw) {
    const text = String(item || "").replace(/类$/, "").trim();
    if (text && !compact.includes(text)) compact.push(text);
  }
  const haystack = compact.join(" ");
  const domainRules = [
    {test: /拖鞋|鞋履|鞋|凉拖|凉鞋|穿搭|潮流|白领|单品/, terms: ["拖鞋", "鞋履", "穿搭", "潮流穿搭", "家居拖鞋", "夏季拖鞋", "凉拖"]},
    {test: /美食|零食|坚果|早餐|轻食|养生/, terms: ["美食", "零食", "坚果", "养生"]},
    {test: /护肤|美妆|彩妆|防晒|身体护理|头发/, terms: ["护肤", "美妆", "防晒", "身体护理"]},
    {test: /家居|日用|收纳|清洁|好物/, terms: ["家居", "日用", "家居好物", "生活好物"]},
    {test: /母婴|宝妈|育儿|亲子/, terms: ["母婴", "宝妈", "育儿", "亲子"]},
  ];
  let domains = [];
  for (const rule of domainRules) {
    if (rule.test.test(haystack)) domains.push(...rule.terms);
  }
  const knownTerms = ["拖鞋", "鞋履", "穿搭", "潮流穿搭", "家居拖鞋", "凉拖", "美食", "零食", "坚果", "养生", "护肤", "美妆", "家居", "日用"];
  domains.push(...knownTerms.filter(term => compact.some(item => item.includes(term))));
  domains = [...new Set(domains)].slice(0, 8);
  const audiences = [
    ...(analysis.requiredAudienceTags || []),
    ...(haystack.includes("白领") ? ["白领", "通勤"] : []),
    ...(haystack.includes("小镇中年") ? ["小镇中年", "中年"] : [])
  ].map(item => String(item || "").trim()).filter(Boolean);
  const actions = ["种草", "开箱", "测评", "直推"].filter(term => compact.some(item => item.includes(term)) || haystack.includes(term));
  const combos = [];
  for (const audience of audiences) {
    for (const domain of domains.length ? domains.slice(0, 4) : compact.slice(0, 3)) {
      const text = `${domain}${audience}`;
      if (!combos.includes(text)) combos.push(text);
    }
  }
  for (const domain of domains.length ? domains : compact.slice(0, 4)) {
    for (const action of actions.length ? actions : ["种草", "测评"]) {
      const text = `${domain}${action}`;
      if (!combos.includes(text)) combos.push(text);
    }
  }
  for (const text of ["白领穿搭", "通勤穿搭", "小镇中年穿搭", "拖鞋开箱", "拖鞋种草", "鞋履种草", "鞋履开箱", "夏季拖鞋", "家居拖鞋", "潮流穿搭种草", "单品直推", "办公室零食", "早餐轻食", "低脂轻食", "坚果测评", "零食开箱", "美食开箱测评"]) {
    if (compact.some(item => item.includes(text.slice(0, 2))) && !combos.includes(text)) combos.push(text);
  }
  const merged = [...combos, ...compact];
  return merged.slice(0, 24).length ? merged.slice(0, 24) : ["美食种草", "美食开箱测评", "坚果", "零食"];
}

async function ensureLoggedIn(page, target) {
  await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  if (!(await looksLoginRequired(page))) return true;

  await updateTask("login_required", "备用采集脚本需要登录蒲公英；默认建议由 Codex 使用已登录 Chrome 后台标签采集。", 0);
  console.log("备用脚本正在等待蒲公英登录。最多等待 10 分钟。");
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    if (!(await looksLoginRequired(page))) {
      await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await updateTask("running", "蒲公英登录已确认，开始采集。", 0);
      return true;
    }
  }
  await updateTask("login_required", "等待登录超时，请重新运行同一个待办。", 0, {target});
  return false;
}

async function looksLoginRequired(page) {
  const url = page.url();
  const body = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch (_) {
    pathname = "";
  }
  if (/login|passport|signin/i.test(url)) return true;
  if (pathname === "/" && /账号登录|立即入驻|好产品种草第一站/.test(body)) return true;
  if (/登录|扫码|验证码/.test(body) && !/找博主|搜索达人|博主广场|达人列表/.test(body)) return true;
  return false;
}

async function searchKeyword(page, keyword) {
  await updateTask("searching", `搜索关键词：${keyword}`);
  try {
    const searchInput = page.locator("input[placeholder*='按笔记关键词找博主']").first();
    await searchInput.waitFor({state: "visible", timeout: 6000});
    await searchInput.click({force: true});
    await searchInput.fill("");
    await searchInput.fill(keyword);
    await searchInput.press("Enter");
    await page.waitForTimeout(2800);
    const value = await searchInput.inputValue().catch(() => "");
    if (value.includes(keyword)) return true;
  } catch (_) {
    // Fall back to DOM-level input below for minor UI changes.
  }

  let found = false;
  for (let i = 0; i < 20; i += 1) {
    found = await page.evaluate(() => {
      const visible = (el) => {
        if (!el || !(el instanceof Element)) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      return [...document.querySelectorAll("input,textarea,[contenteditable='true']")]
        .some(el => visible(el) && /搜索|达人|博主|关键词|昵称|小红书号|账号/.test([
          el.getAttribute("placeholder"),
          el.getAttribute("aria-label"),
          el.getAttribute("title"),
          el.className,
          el.id,
          el.name
        ].join(" ")));
    });
    if (found) break;
    await page.waitForTimeout(500);
  }
  if (!found) return false;

  found = await page.evaluate((kw) => {
    const panelText = "萌力蒲公英采集器";
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      if (el.innerText && el.innerText.includes(panelText)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const nodes = [...document.querySelectorAll("input,textarea,[contenteditable='true']")]
      .filter(visible)
      .map((el) => {
        const text = [
          el.getAttribute("placeholder"),
          el.getAttribute("aria-label"),
          el.getAttribute("title"),
          el.className,
          el.id,
          el.name
        ].join(" ");
        let score = 0;
        if (/搜索|达人|博主|关键词|昵称|小红书号|账号/.test(text)) score += 10;
        if (/input|search/i.test(text)) score += 3;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.6) score += 2;
        return {el, score};
      })
      .sort((a, b) => b.score - a.score);
    const input = nodes[0]?.score > 0 ? nodes[0].el : nodes[0]?.el;
    if (!input) return false;
    input.focus();
    if (input.isContentEditable) {
      input.textContent = kw;
    } else {
      const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(input, kw);
      else input.value = kw;
    }
    input.dispatchEvent(new Event("input", {bubbles: true}));
    input.dispatchEvent(new Event("change", {bubbles: true}));

    const inputRect = input.getBoundingClientRect();
    const buttons = [...document.querySelectorAll("button,[role='button'],.ant-btn")].filter(visible);
    const searchButton = buttons.find((el) => /搜索|查询/.test((el.innerText || el.textContent || "").trim()))
      || input.closest("form")?.querySelector("button")
      || input.closest(".ant-input-group,.ant-input-search,[class*='search'],[class*='Search']")?.querySelector("button,[role='button'],.ant-btn")
      || buttons.find((el) => {
        const rect = el.getBoundingClientRect();
        const verticalOverlap = rect.top < inputRect.bottom + 12 && rect.bottom > inputRect.top - 12;
        const rightSide = rect.left >= inputRect.right - 8 && rect.left <= inputRect.right + 120;
        return verticalOverlap && rightSide;
      });
    if (searchButton && visible(searchButton)) {
      searchButton.click();
    } else {
      for (const type of ["keydown", "keypress", "keyup"]) {
        input.dispatchEvent(new KeyboardEvent(type, {key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true}));
      }
    }
    return true;
  }, keyword);
  await page.waitForTimeout(1800);
  return found;
}

function budgetPriceLabel(analysis = {}) {
  const min = Number(analysis.budgetMin || 0);
  const max = Number(analysis.budgetMax || 0);
  if (min >= 50000) return "5万及以上";
  if (min >= 10000 && (!max || max <= 50000)) return "1万～5万";
  if (min >= 5000 && (!max || max <= 10000)) return "0.5万～1万";
  if (min >= 1000 && (!max || max <= 5000)) return "0.1万～0.5万";
  if (max && max <= 1000) return "0.1万以下";
  if (max && max <= 10000) return "0.5万～1万";
  if (max && max <= 50000) return "1万～5万";
  return "";
}

async function clickTextOption(page, containerSelector, label) {
  return page.evaluate(({containerSelector, label}) => {
    const compact = (text) => String(text || "").replace(/\s+/g, "").trim();
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const root = [...document.querySelectorAll(containerSelector)].reverse().find(visible) || document;
    const nodes = [...root.querySelectorAll(".d-option-content,.d-option-name,button,[role='button'],.d-button,span,div")]
      .filter(visible);
    const target = nodes.find(el => compact(el.innerText || el.textContent) === compact(label));
    const clickable = target?.closest(".d-option-content,button,[role='button'],.d-button,.d-grid-item,.d-clickable") || target;
    if (!clickable) return false;
    clickable.click();
    return true;
  }, {containerSelector, label});
}

async function confirmPopover(page, selector) {
  return page.evaluate((selector) => {
    const compact = (text) => String(text || "").replace(/\s+/g, "").trim();
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const popover = [...document.querySelectorAll(selector)].reverse().find(visible);
    const button = popover
      ? [...popover.querySelectorAll("button,[role='button'],.d-button")].reverse().find(el => visible(el) && compact(el.innerText || el.textContent) === "确定")
      : null;
    if (!button) return false;
    button.click();
    return true;
  }, selector);
}

async function selectPriceInput(page, inputIndex, label) {
  try {
    const panel = page.locator(".d-popover.header-cover .filter-select-popover").filter({hasText: "图文笔记"}).last();
    await panel.locator("input[placeholder='请选择']").nth(inputIndex).click({force: true, timeout: 5000});
    await page.waitForTimeout(500);
    await page.locator(".d-popover.filters-item-custom .d-option-name").filter({hasText: label}).last().click({force: true, timeout: 5000});
    await page.waitForTimeout(400);
    await page.locator(".d-popover.filters-item-custom button").filter({hasText: "确定"}).last().click({force: true, timeout: 1200}).catch(() => {});
    await page.waitForTimeout(600);
    return true;
  } catch (_) {
    // Fall back to DOM-level selection below.
  }

  const opened = await page.evaluate((inputIndex) => {
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const popover = [...document.querySelectorAll(".d-popover.header-cover .filter-select-popover")]
      .reverse()
      .find(el => visible(el) && /图文笔记/.test(el.innerText || "") && /视频笔记/.test(el.innerText || ""));
    const inputs = popover ? [...popover.querySelectorAll("input[placeholder='请选择']")].filter(visible) : [];
    const input = inputs[inputIndex];
    const button = input?.closest(".tag.custom-selector__button") || input;
    if (!button) return false;
    button.click();
    return true;
  }, inputIndex);
  if (!opened) return false;
  await page.waitForTimeout(400);
  const selected = await clickTextOption(page, ".d-popover.filters-item-custom", label);
  if (!selected) return false;
  await page.waitForTimeout(250);
  await confirmPopover(page, ".d-popover.filters-item-custom");
  await page.waitForTimeout(350);
  return true;
}

async function applyBudgetFilter(page, analysis) {
  const label = budgetPriceLabel(analysis);
  if (!label) return false;
  await updateTask("running", `设置蒲公英报价筛选：${label}`);
  await page.evaluate(() => document.querySelector(".solar_body")?.scrollTo(0, 0));
  let opened = false;
  try {
    await page.locator(".custom-selector__button").filter({hasText: /^合作报价$/}).first().click({force: true, timeout: 5000});
    opened = true;
  } catch (_) {
    opened = await page.evaluate(() => {
      const compact = (text) => String(text || "").replace(/\s+/g, "").trim();
      const visible = (el) => {
        if (!el || !(el instanceof Element)) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const button = [...document.querySelectorAll(".custom-selector__button,.tag.--interactive")]
        .find(el => visible(el) && compact(el.innerText || el.textContent) === "合作报价");
      if (!button) return false;
      button.click();
      return true;
    });
  }
  if (!opened) return false;
  await page.waitForTimeout(600);
  const imageOk = await selectPriceInput(page, 0, label);
  const videoOk = await selectPriceInput(page, 1, label);
  const confirmed = await confirmPopover(page, ".d-popover.header-cover");
  await page.waitForTimeout(1800);
  return imageOk || videoOk || confirmed;
}

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = String(value || "").replace(/[,，]/g, "").trim();
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(万|w|W|千|k|K)?/);
  if (!match) return 0;
  let num = Number(match[1]);
  if (/万|w/i.test(match[2] || "")) num *= 10000;
  if (/千|k/i.test(match[2] || "")) num *= 1000;
  return Math.round(num);
}

function parseMoney(value) {
  return parseCount(value);
}

function uniqueText(items) {
  const out = [];
  for (const item of items) {
    const text = String(item || "").trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

function flattenContentTags(contentTags = []) {
  const tags = [];
  for (const item of contentTags || []) {
    if (!item) continue;
    if (typeof item === "string") {
      tags.push(item);
      continue;
    }
    if (item.taxonomy1Tag) tags.push(item.taxonomy1Tag);
    for (const tag of item.taxonomy2Tags || []) tags.push(tag);
  }
  return tags;
}

function rowBudgetMatch(row, analysis = {}) {
  const min = Number(analysis.budgetMin || 0);
  const max = Number(analysis.budgetMax || 0);
  if (!min && !max) return true;
  const prices = analysis.preferredForm === "视频"
    ? [row.video_quote || row.image_quote].map(Number).filter(Boolean)
    : [row.image_quote || row.video_quote, row.quote_low, row.quote_high].map(Number).filter(Boolean);
  if (!prices.length) return false;
  return prices.some(price => (!min || price >= min) && (!max || price <= max));
}

function pgyDetailUrl(userId) {
  return `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${encodeURIComponent(String(userId || "").trim())}`;
}

function normalizePgyApiKol(kol, sourceKeyword, analysis = {}) {
  const userId = String(kol.userId || kol.resourceId || "").trim();
  const redId = String(kol.redId || kol.red_id || "").trim();
  const imageQuote = parseMoney(kol.picturePrice ?? kol.imageQuote ?? kol.lowerPrice);
  const videoQuote = parseMoney(kol.videoPrice ?? kol.videoQuote ?? kol.lowerPrice);
  const preferredQuote = analysis.preferredForm === "视频" ? (videoQuote || imageQuote) : (imageQuote || videoQuote);
  const exposureMedian = parseCount(
    analysis.preferredForm === "视频"
      ? (kol.accumVideoCommonImpMedinNum30d || kol.accumCommonImpMedinNum30d || kol.accumCoopImpMedinNum30d || kol.predictiveExposure)
      : (kol.accumPicCommonImpMedinNum30d || kol.accumCommonImpMedinNum30d || kol.accumCoopImpMedinNum30d || kol.predictiveExposure)
  );
  const readMedian = parseCount(
    analysis.preferredForm === "视频"
      ? (kol.videoClickMidNum || kol.clickMidNum || kol.readMidCoop30)
      : (kol.pictureClickMidNum || kol.clickMidNum || kol.readMidCoop30)
  );
  const interactionMedian = parseCount(
    analysis.preferredForm === "视频"
      ? (kol.videoInterMidNum || kol.interMidNum || kol.interMidCoop30)
      : (kol.pictureInterMidNum || kol.interMidNum || kol.interMidCoop30)
  );
  const officialCpm = Number(
    analysis.preferredForm === "视频" ? (kol.estimateVideoCpm || 0) : (kol.estimatePictureCpm || 0)
  );
  const officialEngageCost = Number(
    analysis.preferredForm === "视频" ? (kol.estimateVideoEngageCost || 0) : (kol.estimatePictureEngageCost || 0)
  );
  const cpm = officialCpm || (preferredQuote && exposureMedian ? Number((preferredQuote / exposureMedian * 1000).toFixed(1)) : 0);
  const cpe = officialEngageCost || (preferredQuote && interactionMedian ? Number((preferredQuote / interactionMedian).toFixed(1)) : 0);
  const contentTags = uniqueText([
    ...flattenContentTags(kol.contentTags),
    ...(kol.featureTags || []),
  ]);
  const audienceTags = uniqueText([
    ...(kol.personalTags || []),
    kol.gender ? `${kol.gender}性` : "",
    kol.location || "",
  ]);
  const persona = uniqueText([
    ...(kol.personalTags || []),
    ...(kol.featureTags || []),
    kol.location || "",
    kol.tradeType || "",
  ]).slice(0, 10).join(" / ");

  return {
    name: String(kol.name || "").trim(),
    platform_id: redId,
    home_url: userId ? pgyDetailUrl(userId) : "",
    persona,
    primary_category: contentTags[0] || "",
    followers: parseCount(kol.fansNum || kol.fansCount),
    image_quote: imageQuote,
    video_quote: videoQuote || imageQuote,
    quote_low: parseMoney(kol.lowerPrice || imageQuote || videoQuote),
    quote_high: Math.max(imageQuote || 0, videoQuote || 0, parseMoney(kol.lowerPrice || 0)),
    exposure_median: exposureMedian,
    read_median: readMedian,
    interaction_median: interactionMedian,
    cpm,
    cpe,
    vertical_score: verticalScoreFromKol(kol, contentTags, audienceTags, analysis),
    tags: contentTags,
    audience_tags: audienceTags,
    recent_titles: [],
    title_status: "missing",
    title_error: "详情页标题待补采",
    source_keyword: sourceKeyword,
    source_url: SEARCH_URL,
    current_url: userId ? pgyDetailUrl(userId) : SEARCH_URL,
    page_excerpt: JSON.stringify({
      userId,
      redId,
      name: kol.name,
      contentTags,
      audienceTags,
      readMedian,
      interactionMedian,
      exposureMedian,
      imageQuote,
      videoQuote,
      cpm,
      cpe,
    }).slice(0, 500),
  };
}

function verticalScoreFromKol(kol, contentTags, audienceTags, analysis = {}) {
  const haystack = [
    kol.name,
    kol.tradeType,
    ...(contentTags || []),
    ...(audienceTags || []),
  ].join(" ");
  const keywords = [
    ...(analysis.keywords || []),
    ...(analysis.creatorTypes || []),
    ...(analysis.requiredAudienceTags || []),
  ].map(item => String(item || "").replace(/类$/, "").trim()).filter(Boolean);
  let score = 62;
  if (/美食|零食|坚果|饮品|低脂|轻食|养生|探店|测评|开箱/.test(haystack)) score += 18;
  for (const keyword of keywords) {
    if (keyword && haystack.includes(keyword)) score += 4;
  }
  if ((kol.contentTags || []).length) score += 4;
  return Math.max(45, Math.min(98, score));
}

async function fetchPgyApiRows(page, keyword, pageNum, analysis) {
  return page.evaluate(async ({keyword, pageNum}) => {
    const payload = {
      searchType: 1,
      keyword,
      column: "comprehensiverank",
      sort: "desc",
      pageNum,
      pageSize: 20,
    };
    const resp = await fetch("/api/solar/cooperator/blogger/v2", {
      method: "POST",
      credentials: "include",
      headers: {"content-type": "application/json"},
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = {raw: text};
    }
    return {
      ok: resp.ok && data.code === 0,
      status: resp.status,
      message: data.msg || data.message || "",
      rows: data?.data?.kols || [],
    };
  }, {keyword, pageNum, analysis});
}

function extractTitlesFromDetailText(body) {
  const lines = String(body || "")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  const start = lines.findIndex(line => line === "笔记案例");
  if (start < 0) return [];
  const stopCandidates = ["前往TA的小红书APP主页", "数据表现", "粉丝分析"];
  let stop = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (stopCandidates.includes(lines[i])) {
      stop = i;
      break;
    }
  }
  const skip = new Set([
    "笔记案例", "按笔记类型", "按内容特征", "按内容类目", "最新发布", "全部流量", "全部类型",
    "合作笔记", "图文笔记", "视频笔记", "仅展示跨域合作笔记", "含推广流量", "阅读", "点赞",
    "收藏", "评论", "分享", "发布时间", "查看更多", "数据概览", "笔记数据",
    "加载中，请稍等", "暂无笔记案例", "暂无数据", "数据积累中，请耐心等待...",
  ]);
  const titles = [];
  for (const line of lines.slice(start + 1, stop)) {
    if (skip.has(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(line)) continue;
    if (/^[0-9,，.]+$/.test(line)) continue;
    if (/^¥/.test(line)) continue;
    if (line.length < 6) continue;
    titles.push(line);
  }
  return uniqueText(titles).slice(0, 50);
}

async function enrichRowsWithDetailPages(context, rows, updateEvery = async () => {}) {
  const detailPage = await context.newPage();
  try {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.home_url) {
        row.title_status = "failed";
        row.title_error = "缺蒲公英主页，无法打开详情页补标题";
        continue;
      }
      try {
        await detailPage.goto(row.home_url, {waitUntil: "domcontentloaded", timeout: 45000});
        let body = "";
        let titles = [];
        for (let attempt = 0; attempt < 7; attempt += 1) {
          await detailPage.waitForTimeout(attempt === 0 ? 2600 : 900);
          body = await detailPage.locator("body").innerText({timeout: 8000});
          titles = extractTitlesFromDetailText(body);
          if (titles.length) break;
          await detailPage.evaluate(() => {
            const target = [...document.querySelectorAll("*")]
              .find(el => (el.innerText || "").trim() === "笔记案例");
            target?.scrollIntoView({block: "center"});
            document.querySelector(".solar_body")?.scrollBy(0, 420);
            window.scrollBy(0, 420);
          }).catch(() => {});
        }
        const redIdMatch = body.match(/小红书号[:：]?\s*\n?\s*([A-Za-z0-9_.-]+)/);
        if (redIdMatch && redIdMatch[1] && !row.platform_id) row.platform_id = redIdMatch[1].trim();
        row.recent_titles = titles;
        row.title_status = titles.length ? "collected" : "failed";
        row.title_error = titles.length ? "" : "详情页未识别到笔记案例标题";
        row.page_excerpt = body.slice(0, 500);
      } catch (err) {
        row.title_status = "failed";
        row.title_error = `详情页打开失败：${err.message || err}`;
      }
      if ((index + 1) % 10 === 0 || index === rows.length - 1) {
        await updateEvery(index + 1, rows.length);
      }
    }
  } finally {
    await detailPage.close().catch(() => {});
  }
}

async function extractRows(page) {
  return page.evaluate((tagBank) => {
    const badName = /粉丝|报价|图文|视频|CPM|CPE|互动|阅读|曝光|收藏|赞|评论|主页|合作|服务费|mcn|机构|账号|查看|详情|发起邀约|添加合作|更多操作/;
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const normalize = (text) => String(text || "").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
    const parseNumber = (value) => {
      const text = String(value || "").replace(/[,，]/g, "").trim();
      const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(万|w|W|千|k|K)?/);
      if (!match) return 0;
      let num = Number(match[1]);
      if (/万|w/i.test(match[2] || "")) num *= 10000;
      if (/千|k/i.test(match[2] || "")) num *= 1000;
      return Math.round(num);
    };
    const pickText = (text, patterns) => {
      for (const pattern of patterns) {
        const match = String(text || "").match(pattern);
        if (match) return String(match[1] || match[0] || "").trim();
      }
      return "";
    };
    const pickNumber = (text, patterns) => parseNumber(pickText(text, patterns));
    const directNumber = (text) => parseNumber(String(text || ""));
    const isPgyDetailUrl = (url) => /pgy\.xiaohongshu\.com\/.*\/blogger-detail\/[^/?#]+/.test(String(url || ""));
    const idFromUrl = (url) => {
      const match = String(url || "").match(/blogger-detail\/([^/?#]+)/);
      return match ? match[1] : "";
    };
    const isName = (text) => {
      if (!text || text.length < 2 || text.length > 40) return false;
      if (badName.test(text)) return false;
      if (/^\d+(\.\d+)?(万|w|k)?$/i.test(text)) return false;
      return /[\u4e00-\u9fa5A-Za-z]/.test(text);
    };
    const pickName = (node, body) => {
      const lines = body.split("\n").map(line => line.trim()).filter(Boolean);
      const cellName = lines.find(isName);
      if (cellName) return cellName.slice(0, 40);
      const linkName = [...node.querySelectorAll("a")].map(a => normalize(a.innerText || "")).find(isName);
      return (linkName || "").slice(0, 40);
    };
    const tableRows = [...document.querySelectorAll("table.d-new-table tbody tr, .d-table__body tr, tbody tr")]
      .filter(visible);
    const rows = tableRows.length ? tableRows : [];
    const seen = new Set();
    return rows.map((node) => {
      const body = normalize(node.innerText || node.textContent || "");
      const cells = [...node.querySelectorAll("td")].map(cell => normalize(cell.innerText || cell.textContent || ""));
      const links = [...node.querySelectorAll("a[href]")].map(a => new URL(a.getAttribute("href"), location.href).href);
      const homeUrl = links.find(isPgyDetailUrl) || "";
      const name = pickName(node, cells[0] || body);
      const platformId = pickText(body, [
        /小红书号[:：\s]*([A-Za-z0-9_.-]+)/,
        /账号ID[:：\s]*([A-Za-z0-9_.-]+)/,
        /ID[:：\s]*([A-Za-z0-9_.-]+)/
      ]) || idFromUrl(homeUrl);
      const key = platformId || homeUrl || name;
      if (!name || !key || seen.has(key)) return null;
      seen.add(key);
      const tags = tagBank.filter(tag => body.includes(tag));
      const firstCellLines = (cells[0] || "").split("\n").map(line => line.trim()).filter(Boolean);
      const personaParts = firstCellLines.filter(line => line !== name && !/^\d+\+$/.test(line)).slice(0, 8);
      const quote = directNumber(cells[5]) || pickNumber(body, [/¥\s*([0-9.,]+\s*(?:万|w|W|k|K)?)/, /全部报价[^0-9]*([0-9.,]+\s*(?:万|w|W|k|K)?)/]);
      const readMedian = directNumber(cells[3]) || pickNumber(body, [/阅读中位数?[^0-9]*([0-9.,]+\s*(?:万|w|W|k|K)?)/]);
      const interactionMedian = directNumber(cells[4]) || pickNumber(body, [/互动中位数?[^0-9]*([0-9.,]+\s*(?:万|w|W|k|K)?)/, /互动量?[^0-9]*([0-9.,]+\s*(?:万|w|W|k|K)?)/]);
      const inferredCpm = quote && readMedian ? Number((quote / readMedian * 1000).toFixed(1)) : 0;
      const inferredCpe = quote && interactionMedian ? Number((quote / interactionMedian).toFixed(1)) : 0;
      return {
        name,
        platform_id: platformId,
        home_url: homeUrl,
        persona: personaParts.join(" / "),
        primary_category: tags[0] || "",
        followers: directNumber(cells[2]) || pickNumber(body, [/粉丝(?:数|量)?[^0-9]*([0-9.,]+\s*(?:万|w|W|k|K)?)/, /([0-9.,]+\s*(?:万|w|W|k|K)?)\s*粉丝/]),
        image_quote: quote,
        video_quote: quote,
        exposure_median: pickNumber(body, [/曝光中位数?[^0-9]*([0-9.,]+\s*(?:万|w|W|k|K)?)/]),
        read_median: readMedian,
        interaction_median: interactionMedian,
        cpm: pickNumber(body, [/(?:CPM|cpm)[^0-9]*([0-9.]+)/]) || inferredCpm,
        cpe: pickNumber(body, [/(?:CPE|cpe|互动单价)[^0-9]*([0-9.]+)/]) || inferredCpe,
        tags,
        recent_titles: [],
        source_url: location.href,
        current_url: homeUrl || location.href,
        page_excerpt: body.slice(0, 500)
      };
    }).filter(row => row && (row.platform_id || row.home_url || row.followers || row.video_quote || row.image_quote));
  }, TAG_BANK);
}

async function goNextPage(page) {
  const before = await page.locator("body").innerText({timeout: 5000}).catch(() => "");
  const clicked = await page.evaluate(() => {
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    document.querySelector(".solar_body")?.scrollTo(0, 999999);

    const pgyPagination = document.querySelector(".d-pagination");
    if (pgyPagination) {
      const pages = [...pgyPagination.querySelectorAll(".d-pagination-page.d-clickable")]
        .filter(el => visible(el) && !String(el.className || "").includes("disabled"));
      const nextArrow = [...pages].reverse().find(el => !(el.innerText || el.textContent || "").trim());
      if (nextArrow) {
        nextArrow.scrollIntoView({block: "center", inline: "center"});
        nextArrow.click();
        return true;
      }
    }

    const selectors = [
      ".ant-pagination-next:not(.ant-pagination-disabled) button",
      ".ant-pagination-next:not(.ant-pagination-disabled)",
      "button[aria-label='Next Page']",
      "button[aria-label='下一页']",
      "[title='下一页']:not(.ant-pagination-disabled)"
    ];
    let next = selectors.map(selector => document.querySelector(selector)).find(el => el && visible(el));
    if (next?.closest("button,[role='button'],li")) next = next.closest("button,[role='button'],li");
    if (!next || next.disabled || next.getAttribute("aria-disabled") === "true" || next.classList?.contains("ant-pagination-disabled")) return false;
    next.click();
    return true;
  });
  if (!clicked) return false;
  for (let i = 0; i < 12; i += 1) {
    await page.waitForTimeout(500);
    const after = await page.locator("body").innerText({timeout: 5000}).catch(() => "");
    if (after && after !== before) return true;
  }
  return true;
}

function mergeRows(target, rows) {
  const seen = new Set(target.map(row => row.platform_id || row.home_url || row.name));
  let added = 0;
  for (const row of rows) {
    const key = row.platform_id || row.home_url || row.name;
    if (!key || seen.has(key)) continue;
    target.push(row);
    seen.add(key);
    added += 1;
  }
  return added;
}

function initialListTarget(target) {
  return target + Math.max(10, Math.ceil(target * 0.3));
}

function nextListTarget(currentListTarget, target, recommendations) {
  const gap = Math.max(1, target - recommendations);
  return Math.min(300, currentListTarget + gap + Math.max(5, Math.ceil(gap * 0.5)));
}

async function collectRowsUntil(page, keywords, analysis, collected, fallbackRows, listTarget, target, round) {
  for (const keyword of keywords) {
    if (collected.length >= listTarget) break;
    for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_KEYWORD; pageIndex += 1) {
      const apiResult = await fetchPgyApiRows(page, keyword, pageIndex + 1, analysis);
      if (!apiResult.ok) {
        await updateTask("running", `第 ${round} 轮：关键词「${keyword}」第 ${pageIndex + 1} 页接口未返回结果：${apiResult.message || apiResult.status}`, collected.length, {keywords, target, listTarget, round});
        break;
      }
      const rows = apiResult.rows.map(kol => normalizePgyApiKol(kol, keyword, analysis));
      const preferred = rows.filter(row => rowBudgetMatch(row, analysis));
      const backup = rows.filter(row => !rowBudgetMatch(row, analysis));
      const added = mergeRows(collected, preferred);
      mergeRows(fallbackRows, backup);
      await updateTask("running", `第 ${round} 轮：关键词「${keyword}」第 ${pageIndex + 1} 页，新增 ${added} 个预算内账号，累计列表 ${collected.length}/${listTarget} 个。`, collected.length, {keywords, target, listTarget, round});
      if (collected.length >= listTarget) break;
      if (!apiResult.rows.length) break;
    }
  }

  if (collected.length < listTarget && fallbackRows.length) {
    const before = collected.length;
    mergeRows(collected, fallbackRows);
    await updateTask("running", `第 ${round} 轮：预算内账号不足 ${listTarget} 个，补入 ${collected.length - before} 个可复核账号。`, collected.length, {keywords, target, listTarget, round});
  }
}

async function main() {
  const taskData = await api(`/api/codex-tasks/${encodeURIComponent(TASK_ID)}`);
  const task = taskData.task;
  const target = Math.max(1, Math.min(300, Number(task.targetCount || DEFAULT_TARGET_COUNT)));
  let listTarget = initialListTarget(target);
  const keywords = normalizeKeywords(task);
  const { chromium } = await loadPlaywright();
  const profileDir = path.join(APP_DIR, "data", "browser-profiles", "pgy");
  fs.mkdirSync(profileDir, { recursive: true });

  await updateTask("running", `启动蒲公英采集脚本，正式目标 ${target} 个，首轮列表预抓 ${listTarget} 个。`, 0, {keywords, target, listTarget, round: 1});
  const executablePath = resolveChromiumExecutable(chromium);
  if (!executablePath) {
    throw new Error("找不到可用的 Chrome/Chromium，请先安装 Chrome 或运行 playwright install chromium。");
  }
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless: false,
    viewport: {width: 1440, height: 960},
    locale: "zh-CN"
  });
  const page = context.pages()[0] || await context.newPage();

  try {
    const loggedIn = await ensureLoggedIn(page, target);
    if (!loggedIn) return;
    const analysis = task.payload?.analysis || {};
    await applyBudgetFilter(page, analysis).catch((err) => {
      console.warn(`报价筛选未生效：${err.message || err}`);
    });

    const collected = [];
    const fallbackRows = [];
    let ingest = null;
    let round = 1;

    while (round <= MAX_COLLECTION_ROUNDS) {
      await collectRowsUntil(page, keywords, analysis, collected, fallbackRows, listTarget, target, round);

      if (!collected.length) {
        await updateTask("running", "API没有返回可用账号，切换到页面DOM兜底采集。", 0, {keywords, target, listTarget, round});
        for (const keyword of keywords) {
          if (collected.length >= listTarget) break;
          const searched = await searchKeyword(page, keyword);
          if (!searched) {
            await updateTask("error", `没有识别到蒲公英搜索框，停在关键词：${keyword}`, collected.length, {keywords, target, listTarget, round});
            return;
          }
          for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_KEYWORD; pageIndex += 1) {
            await page.waitForTimeout(1200);
            const rows = await extractRows(page);
            const added = mergeRows(collected, rows);
            await updateTask("running", `第 ${round} 轮 DOM兜底：关键词「${keyword}」第 ${pageIndex + 1} 页，新增 ${added} 个，累计列表 ${collected.length}/${listTarget} 个。`, collected.length, {keywords, target, listTarget, round});
            if (collected.length >= listTarget) break;
            const moved = await goNextPage(page);
            if (!moved) break;
          }
        }
      }

      if (!collected.length) {
        await updateTask("error", "没有采集到可入库达人，请检查蒲公英页面结构或关键词。", 0, {keywords, target, listTarget, round});
        return;
      }

      const rowsToIngest = collected.slice(0, listTarget);
      const rowsToEnrich = rowsToIngest.filter(row => !row.__detailChecked);
      await updateTask("running", `第 ${round} 轮：已拿到 ${rowsToIngest.length} 个账号ID，本轮补详情 ${rowsToEnrich.length} 个，正式目标 ${target} 个。`, rowsToIngest.length, {keywords, target, listTarget, round});
      if (rowsToEnrich.length) {
        await enrichRowsWithDetailPages(context, rowsToEnrich, async (done, total) => {
          await updateTask("running", `第 ${round} 轮：详情页补标题 ${done}/${total}。`, rowsToIngest.length, {keywords, target, listTarget, round});
        });
        rowsToEnrich.forEach(row => {
          row.__detailChecked = true;
        });
      }

      ingest = await api("/api/collector/ingest", {
        method: "POST",
        body: JSON.stringify({project_id: task.projectId, platform: "pgy", rows: rowsToIngest})
      });
      const recommendations = ingest.recommendations?.length || 0;
      if (recommendations >= target || round >= MAX_COLLECTION_ROUNDS) break;
      listTarget = nextListTarget(listTarget, target, recommendations);
      round += 1;
      await updateTask("running", `推荐结果 ${recommendations}/${target}，进入第 ${round} 轮补采，列表目标扩大到 ${listTarget} 个。`, ingest.ingested || collected.length, {keywords, target, listTarget, round, recommendations});
    }

    ingest = ingest || {ingested: 0, repairCount: 0, recommendations: []};
    const ingestedCount = ingest.ingested || 0;
    const repairCount = ingest.repairCount || 0;
    const recommendations = ingest.recommendations?.length || 0;
    const doneMessage = ingestedCount >= target
      ? `采集完成：正式入库 ${ingestedCount} 个，推荐 ${recommendations}/${target} 个，待修复 ${repairCount} 个。`
      : `采集完成：正式入库 ${ingestedCount}/${target} 个，推荐 ${recommendations}/${target} 个，待修复 ${repairCount} 个；严格达标不足，已展示可备选/需人工复核。`;
    await updateTask("done", doneMessage, ingestedCount, {
      keywords,
      target,
      listTarget,
      rounds: round,
      collected: ingestedCount,
      repairCount,
      recommendations
    });
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch(async (err) => {
  console.error(err);
  await updateTask("error", err.message || String(err)).catch(() => {});
  process.exit(1);
});
