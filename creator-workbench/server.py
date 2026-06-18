"""
萌力互动 · 本地 AI 选号系统

首版本地闭环：
- 项目 / brief
- AI 拆解（本地规则，可替换为后端 LLM）
- 小红书蒲公英真实采集任务（Chrome 登录态 + 本地回传）
- 统一候选池
- 自动推荐名单
- 人工反馈与记忆沉淀
- Excel 导出
"""

from __future__ import annotations

import base64
import hashlib
import html
import io
import json
import math
import random
import re
import sqlite3
import time
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Union
from urllib.parse import quote
from xml.etree import ElementTree as ET

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


APP_DIR = Path(__file__).resolve().parent
ROOT_DIR = APP_DIR.parent
STATIC_DIR = APP_DIR / "static"
DATA_DIR = APP_DIR / "data"
EXPORT_DIR = APP_DIR / "exports"
DB_PATH = DATA_DIR / "mengli_creator_selection.sqlite3"

DATA_DIR.mkdir(exist_ok=True)
EXPORT_DIR.mkdir(exist_ok=True)

app = FastAPI(title="萌力互动本地 AI 选号系统", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_private_network_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


PLATFORMS = {
    "pgy": {
        "label": "小红书蒲公英",
        "adapter": "pgyAdapter",
        "host": "pgy.xiaohongshu.com",
        "queue": "serial",
        "first_version": 1,
        "enabled": 1,
    },
    "xhs": {
        "label": "小红书站内",
        "adapter": "xhsAdapter",
        "host": "www.xiaohongshu.com",
        "queue": "isolated",
        "first_version": 0,
        "enabled": 0,
    },
    "xingtu": {
        "label": "巨量星图",
        "adapter": "xingtuAdapter",
        "host": "www.xingtu.cn",
        "queue": "isolated",
        "first_version": 0,
        "enabled": 0,
    },
    "douyin": {
        "label": "抖音",
        "adapter": "douyinAdapter",
        "host": "www.douyin.com",
        "queue": "isolated",
        "first_version": 0,
        "enabled": 0,
    },
    "huxuan": {
        "label": "腾讯互选 / 视频号",
        "adapter": "huxuanAdapter",
        "host": "huxuan.qq.com",
        "queue": "isolated",
        "first_version": 0,
        "enabled": 0,
    },
}

DEFAULT_BRIEF = """【品牌】沃隆
【背景&档期】新品发布，新品预计6月左右上市，具体上新时间还未定，发布档期暂定五月底到6月底前，具体档期可以品牌确认上新日期后二核
【合作平台】小红书
【合作形式】报备图文/视频，优先视频合作
【总预算】10w
【提报要求】
1、注意！新品产品链接出来后，需要达人带上站内的产品链接！需要配合挂链！如不配合无需提报
2、提报数量不低于25个，返点不低于22%
【量级数量&单个预算】
单个预算：5k-1w
达人类型：美食种草类、美食开箱测评类（需要有上班族、学生党、养生党、精致妈妈标签，每个标签都需要合作）
TA：22-50岁
【数据要求】CPM＜70，CPE<8"""


class ProjectCreate(BaseModel):
    name: str = ""
    brief: str


class AnalysisUpdate(BaseModel):
    analysis: dict[str, Any]


class CandidateStatusUpdate(BaseModel):
    locked: Optional[bool] = None
    excluded: Optional[bool] = None


class RecommendationStatusUpdate(BaseModel):
    locked: Optional[bool] = None
    status: Optional[str] = None


class FeedbackCreate(BaseModel):
    usability: str = "可用"
    client_passed: str = "待确认"
    keyword_accuracy: str = "精准"
    replaced_reason: str = ""
    note: str = ""


class CollectorIngest(BaseModel):
    project_id: str
    platform: str = "pgy"
    rows: list[dict[str, Any]]


class RepairRecordUpdate(BaseModel):
    platform_id: str = ""
    home_url: str = ""
    recent_titles: list[str] = Field(default_factory=list)
    title_status: str = ""
    title_error: str = ""
    note: str = ""


class CollectorProgress(BaseModel):
    platform: str = "pgy"
    status: str = "running"
    collected_count: int = 0
    error: str = ""


class CodexTaskStatusUpdate(BaseModel):
    status: str
    message: str = ""
    collected_count: Optional[int] = None
    result: dict[str, Any] = Field(default_factory=dict)


class XlsxParseRequest(BaseModel):
    filename: str = ""
    dataBase64: str


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def jdump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def jload(value: Optional[str], fallback: Any = None) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            create table if not exists platforms (
              id text primary key,
              label text not null,
              adapter text not null,
              host text not null,
              queue text not null,
              enabled integer not null default 0,
              first_version integer not null default 0,
              status text not null default 'idle',
              updated_at text not null
            );

            create table if not exists projects (
              id text primary key,
              name text not null,
              brand text not null,
              brief text not null,
              analysis_json text not null,
              status text not null default 'draft',
              created_at text not null,
              updated_at text not null
            );

            create table if not exists collection_tasks (
              id text primary key,
              project_id text not null,
              platform text not null,
              status text not null,
              target_count integer not null default 30,
              collected_count integer not null default 0,
              error text not null default '',
              created_at text not null,
              updated_at text not null
            );

            create table if not exists codex_tasks (
              id text primary key,
              project_id text not null,
              type text not null,
              platform text not null,
              status text not null,
              target_count integer not null default 50,
              payload_json text not null,
              result_json text not null,
              error text not null default '',
              created_at text not null,
              updated_at text not null
            );

            create table if not exists creators (
              id text primary key,
              name text not null,
              primary_category text not null,
              persona text not null,
              created_at text not null
            );

            create table if not exists creator_platform_profiles (
              id text primary key,
              creator_id text not null,
              platform text not null,
              platform_id text not null,
              home_url text not null,
              followers real not null default 0,
              tags_json text not null,
              audience_tags_json text not null,
              quote_low integer not null default 0,
              quote_high integer not null default 0,
              image_quote integer not null default 0,
              video_quote integer not null default 0,
              supports_link integer not null default 0,
              rebate_pct real not null default 0,
              created_at text not null
            );

            create table if not exists media_library_entries (
              id text primary key,
              profile_id text not null unique,
              source_type text not null,
              source_project_id text not null default '',
              note text not null default '',
              created_at text not null,
              updated_at text not null
            );

            create table if not exists creator_metrics (
              id text primary key,
              profile_id text not null,
              exposure_median integer not null default 0,
              read_median integer not null default 0,
              interaction_median integer not null default 0,
              cpm real not null default 0,
              cpe real not null default 0,
              vertical_score real not null default 0,
              recent_titles_json text not null,
              title_status text not null default '',
              title_error text not null default '',
              collected_at text not null
            );

            create table if not exists candidates (
              id text primary key,
              project_id text not null,
              profile_id text not null,
              platform text not null,
              status text not null default 'active',
              scores_json text not null,
              reason text not null,
              risk text not null,
              evidence text not null,
              locked integer not null default 0,
              excluded integer not null default 0,
              created_at text not null
            );

            create table if not exists recommendations (
              id text primary key,
              project_id text not null,
              candidate_id text not null,
              rank integer not null,
              status text not null default 'pending',
              reason text not null,
              risk text not null,
              locked integer not null default 0,
              created_at text not null
            );

            create table if not exists creator_repair_records (
              id text primary key,
              project_id text not null default '',
              candidate_id text not null default '',
              profile_id text not null default '',
              platform text not null,
              status text not null default 'pending',
              name text not null default '',
              platform_id text not null default '',
              home_url text not null default '',
              list_data_json text not null,
              source_keyword text not null default '',
              source_url text not null default '',
              current_url text not null default '',
              reason text not null,
              action text not null,
              retry_count integer not null default 0,
              page_excerpt text not null default '',
              screenshot_path text not null default '',
              title_status text not null default '',
              title_error text not null default '',
              note text not null default '',
              created_at text not null,
              updated_at text not null,
              resolved_at text not null default ''
            );

            create table if not exists feedback (
              id text primary key,
              project_id text not null,
              recommendation_id text not null default '',
              creator_name text not null default '',
              usability text not null,
              client_passed text not null,
              keyword_accuracy text not null,
              replaced_reason text not null,
              note text not null,
              created_at text not null
            );

            create table if not exists memories (
              id text primary key,
              scope text not null,
              memory_key text not null,
              value text not null,
              weight real not null default 0,
              source_project_id text not null,
              source_feedback_id text not null,
              created_at text not null
            );

            create table if not exists ai_call_logs (
              id text primary key,
              project_id text not null,
              action text not null,
              provider text not null,
              prompt_hash text not null,
              request_json text not null,
              response_json text not null,
              token_count integer not null default 0,
              cost real not null default 0,
              cache_hit integer not null default 0,
              created_at text not null
            );
            """
        )
        metric_columns = {row["name"] for row in conn.execute("pragma table_info(creator_metrics)").fetchall()}
        if "exposure_median" not in metric_columns:
            conn.execute("alter table creator_metrics add column exposure_median integer not null default 0")
        if "title_status" not in metric_columns:
            conn.execute("alter table creator_metrics add column title_status text not null default ''")
        if "title_error" not in metric_columns:
            conn.execute("alter table creator_metrics add column title_error text not null default ''")
        invalid_rows = conn.execute(
            """
            select
              c.id candidate_id,
              c.project_id,
              p.id profile_id,
              p.creator_id,
              p.platform,
              p.platform_id,
              p.home_url,
              p.followers,
              p.tags_json,
              p.audience_tags_json,
              p.quote_low,
              p.quote_high,
              p.image_quote,
              p.video_quote,
              p.rebate_pct,
              cr.name,
              cr.primary_category,
              cr.persona,
              coalesce(m.exposure_median, 0) exposure_median,
              coalesce(m.read_median, 0) read_median,
              coalesce(m.interaction_median, 0) interaction_median,
              coalesce(m.cpm, 0) cpm,
              coalesce(m.cpe, 0) cpe,
              coalesce(m.vertical_score, 0) vertical_score,
              coalesce(m.recent_titles_json, '[]') recent_titles_json,
              coalesce(m.title_status, '') title_status,
              coalesce(m.title_error, '') title_error
            from candidates c
            join creator_platform_profiles p on p.id=c.profile_id
            join creators cr on cr.id=p.creator_id
            left join creator_metrics m on m.profile_id=p.id
            where p.platform='pgy'
              and (
                p.platform_id='' or p.platform_id=cr.name
                or p.home_url=''
                or p.home_url not like '%pgy.xiaohongshu.com%/blogger-detail/%'
              )
            """
        ).fetchall()
        for row in invalid_rows:
            issues = []
            if not row["platform_id"] or row["platform_id"] == row["name"]:
                issues.append("缺小红书号")
            if not row["home_url"] or "pgy.xiaohongshu.com" not in row["home_url"] or "/blogger-detail/" not in row["home_url"]:
                issues.append("缺蒲公英主页")
            repair_exists = conn.execute(
                "select 1 from creator_repair_records where candidate_id=? limit 1",
                (row["candidate_id"],),
            ).fetchone()
            if not repair_exists:
                list_data = {
                    "name": row["name"],
                    "platform": row["platform"],
                    "platform_id": row["platform_id"],
                    "home_url": row["home_url"],
                    "primary_category": row["primary_category"],
                    "persona": row["persona"],
                    "followers": row["followers"],
                    "tags": jload(row["tags_json"], []),
                    "audience_tags": jload(row["audience_tags_json"], []),
                    "quote_low": row["quote_low"],
                    "quote_high": row["quote_high"],
                    "image_quote": row["image_quote"],
                    "video_quote": row["video_quote"],
                    "rebate_pct": row["rebate_pct"],
                    "exposure_median": row["exposure_median"],
                    "read_median": row["read_median"],
                    "interaction_median": row["interaction_median"],
                    "cpm": row["cpm"],
                    "cpe": row["cpe"],
                    "vertical_score": row["vertical_score"],
                    "recent_titles": jload(row["recent_titles_json"], []),
                    "title_status": row["title_status"] or "missing",
                    "title_error": row["title_error"],
                }
                reason = "、".join(issues or ["关键字段缺失"])
                conn.execute(
                    """
                    insert into creator_repair_records(
                      id,project_id,candidate_id,profile_id,platform,status,name,platform_id,home_url,
                      list_data_json,source_keyword,source_url,current_url,reason,action,retry_count,
                      page_excerpt,screenshot_path,title_status,title_error,note,created_at,updated_at,resolved_at
                    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        make_id("repair"),
                        row["project_id"],
                        row["candidate_id"],
                        "",
                        row["platform"],
                        "pending",
                        row["name"],
                        row["platform_id"],
                        row["home_url"],
                        jdump(list_data),
                        "",
                        "",
                        "",
                        reason,
                        "从详情页重新补取小红书号和蒲公英主页链接；失败后人工补充",
                        0,
                        "",
                        "",
                        list_data["title_status"],
                        list_data["title_error"],
                        "旧数据自动转入待修复",
                        now(),
                        now(),
                        "",
                    ),
                )
            conn.execute("delete from recommendations where candidate_id=?", (row["candidate_id"],))
            conn.execute("delete from media_library_entries where profile_id=?", (row["profile_id"],))
            conn.execute("delete from candidates where id=?", (row["candidate_id"],))
            conn.execute("delete from creator_metrics where profile_id=?", (row["profile_id"],))
            conn.execute("delete from creator_platform_profiles where id=?", (row["profile_id"],))
            conn.execute("delete from creators where id=?", (row["creator_id"],))
        for key, item in PLATFORMS.items():
            conn.execute(
                """
                insert into platforms(id,label,adapter,host,queue,enabled,first_version,status,updated_at)
                values(?,?,?,?,?,?,?,?,?)
                on conflict(id) do update set
                  label=excluded.label,
                  adapter=excluded.adapter,
                  host=excluded.host,
                  queue=excluded.queue,
                  enabled=excluded.enabled,
                  first_version=excluded.first_version,
                  updated_at=excluded.updated_at
                """,
                (
                    key,
                    item["label"],
                    item["adapter"],
                    item["host"],
                    item["queue"],
                    item["enabled"],
                    item["first_version"],
                    "ready" if item["enabled"] else "reserved",
                    now(),
                ),
            )


init_db()


def parse_money(raw: str) -> int:
    text = raw.strip().replace(",", "").replace(" ", "").lower()
    match = re.search(r"(\d+(?:\.\d+)?)(w|万|k|千)?", text)
    if not match:
        return 0
    value = float(match.group(1))
    unit = match.group(2) or ""
    if unit in {"w", "万"}:
        value *= 10000
    elif unit in {"k", "千"}:
        value *= 1000
    return int(round(value))


def money_to_text(value: Union[int, float]) -> str:
    value = int(round(value or 0))
    if value >= 10000 and value % 10000 == 0:
        return f"{value // 10000}w"
    if value >= 10000:
        return f"{value / 10000:.1f}w"
    if value >= 1000 and value % 1000 == 0:
        return f"{value // 1000}k"
    return str(value)


def pick_between(text: str, labels: list[str], stop_labels: list[str]) -> str:
    for label in labels:
        start = text.find(label)
        if start >= 0:
            start += len(label)
            tail = text[start:]
            stops = [tail.find(stop) for stop in stop_labels if tail.find(stop) >= 0]
            end = min(stops) if stops else len(tail)
            return tail[:end].strip(" 】】\n：:")
    return ""


def dedupe(items: list[str]) -> list[str]:
    seen = set()
    out = []
    for item in items:
        clean = str(item).strip(" ，,、。；;（）()[]【】\n\t")
        if clean and clean not in seen:
            seen.add(clean)
            out.append(clean)
    return out


BRIEF_TOP_LABELS = [
    "品牌",
    "背景&档期",
    "背景",
    "档期",
    "推广时间",
    "合作平台",
    "推广平台",
    "合作形式",
    "内容形式",
    "博主类型",
    "达人类型",
    "账号类型",
    "KOL类型",
    "核心要求",
    "与上一轮投放的关联",
    "计划推广数量",
    "推广数量",
    "投放数量",
    "提报数量",
    "推荐数量",
    "各赛道账号分布",
    "账号分布",
    "粉丝量级",
    "其他要求",
    "提报要求",
    "量级数量&单个预算",
    "单个预算",
    "单博主预算",
    "单人预算",
    "总预算",
    "项目预算",
    "预算总额",
    "数据要求",
    "TA",
    "Brief",
]
REQUIRED_TAG_CONTEXT = re.compile(r"必须覆盖|每个标签都需要|每个标签都要|都需要合作|需要有[^。\n]*标签|每类都要")


def clean_brief_line(line: str) -> str:
    text = str(line or "").strip()
    text = re.sub(r"^[\s\-•*·]+", "", text)
    text = re.sub(r"^[0-9]+[、.)）]\s*", "", text)
    text = re.sub(r"^[❗️!！]+", "", text)
    return text.strip()


def starts_with_brief_label(line: str) -> bool:
    clean = clean_brief_line(line)
    if not clean:
        return False
    if re.match(r"Brief[：:]", clean, re.I):
        return True
    if re.match(r"^【[^】]+】", clean):
        return True
    return any(clean == label or clean.startswith(f"{label}：") or clean.startswith(f"{label}:") for label in BRIEF_TOP_LABELS)


def extract_brief_block(text: str, labels: list[str]) -> str:
    lines = str(text or "").splitlines()
    for index, line in enumerate(lines):
        clean = clean_brief_line(line)
        for label in labels:
            patterns = [
                rf"^【\s*{re.escape(label)}\s*】\s*(.*)$",
                rf"^{re.escape(label)}\s*[：:]\s*(.*)$",
                rf"^{re.escape(label)}\s*$",
            ]
            match = next((re.match(pattern, clean) for pattern in patterns if re.match(pattern, clean)), None)
            if not match:
                continue
            out: list[str] = []
            inline = (match.group(1) if match.lastindex else "").strip()
            if inline:
                out.append(inline)
            for next_line in lines[index + 1 :]:
                if not next_line.strip():
                    continue
                if starts_with_brief_label(next_line):
                    break
                out.append(next_line.strip())
            return "\n".join(out).strip()
    return ""


def extract_brief_line(text: str, labels: list[str]) -> str:
    block = extract_brief_block(text, labels)
    return block.splitlines()[0].strip() if block else ""


def parse_money_range_text(text: str) -> tuple[int, int] | None:
    match = re.search(
        r"(\d+(?:\.\d+)?)\s*(w|万|k|千)?\s*(?:-|－|—|~|～|到|至)\s*(\d+(?:\.\d+)?)\s*(w|万|k|千)?",
        text,
        re.I,
    )
    if match:
        unit = match.group(4) or match.group(2) or ""
        return parse_money(match.group(1) + (match.group(2) or unit)), parse_money(match.group(3) + unit)
    single = re.search(r"(\d+(?:\.\d+)?)\s*(w|万|k|千)?", text, re.I)
    if single:
        return 0, parse_money(single.group(1) + (single.group(2) or ""))
    return None


def parse_money_range_for_labels(text: str, labels: list[str]) -> tuple[int, int] | None:
    for label in labels:
        block = extract_brief_block(text, [label])
        if not block:
            continue
        parsed = parse_money_range_text(block)
        if parsed:
            return parsed
    return None


def parse_percent_for_labels(text: str, labels: list[str]) -> float:
    for label in labels:
        block = extract_brief_block(text, [label])
        if not block:
            continue
        match = re.search(r"(\d+(?:\.\d+)?)\s*%", block)
        if match:
            return float(match.group(1))
    return 0.0


def split_brief_parts(value: str) -> list[str]:
    parts = []
    for item in re.split(r"[、,，/；;\n|]+", str(value or "")):
        clean = clean_brief_line(item).strip().rstrip("等").strip()
        if clean:
            parts.append(clean)
    return dedupe(parts)


def parse_report_count(text: str) -> int:
    block = extract_brief_block(text, ["计划推广数量", "推广数量", "投放数量", "提报数量", "推荐数量"])
    if block:
        match = re.search(r"(?:共投放|不低于|不少于|至少)?\s*(\d+)\s*(?:位|个|名|人)?", block)
        if match:
            return int(match.group(1))
    compact = re.sub(r"\s+", "", text)
    match = re.search(r"(?:计划推广数量|推广数量|投放数量|提报数量|推荐数量)[^0-9]*(?:共投放|不低于|不少于|至少)?(\d+)(?:位|个|名|人)?", compact)
    return int(match.group(1)) if match else 0


def extract_creator_details(text: str) -> tuple[list[str], list[dict[str, Any]]]:
    block = extract_brief_block(text, ["博主类型", "达人类型", "账号类型", "KOL类型"])
    creator_types: list[str] = []
    details: list[dict[str, Any]] = []
    if block:
        for raw_line in block.splitlines():
            line = clean_brief_line(raw_line)
            no_note = re.sub(r"（.*?）|\(.*?\)", "", line).strip()
            colon_match = re.match(r"^((?:P\d+\s*)?[^：:]{2,28}?(?:类|博主|达人|KOL))\s*[：:]\s*(.+)$", no_note, re.I)
            if colon_match:
                category = colon_match.group(1).strip()
                examples = split_brief_parts(colon_match.group(2))
                creator_types.append(category)
                details.append({"category": category, "examples": examples})
                continue
            for part in split_brief_parts(no_note):
                if not re.search(r"需要|标签|TA|预算|CPM|CPE", part):
                    creator_types.append(part)
    if not creator_types:
        fallbacks = [
            (r"种草", "种草类"),
            (r"时尚|穿搭|优衣库", "时尚类"),
            (r"设计|绘画|手工|拼豆", "设计类"),
            (r"美食|零食|坚果", "美食种草类"),
            (r"开箱|测评", "开箱测评类"),
            (r"数码|科技|AI|电脑", "数码测评类"),
            (r"母婴|育儿|宝妈", "母婴种草类"),
        ]
        for pattern, label in fallbacks:
            if re.search(pattern, text):
                creator_types.append(label)
    return dedupe(creator_types)[:12], details


def extract_required_audience_tags(text: str) -> list[str]:
    possible_tags = [
        "上班族",
        "学生党",
        "学生",
        "毕业学生",
        "养生党",
        "精致妈妈",
        "宝妈",
        "新手妈妈",
        "白领",
        "职场人",
        "健身党",
        "成分党",
        "数码党",
        "宠物",
        "家庭内容",
        "乐迷",
        "情侣",
        "有梗",
    ]
    context = "\n".join(
        filter(
            None,
            [
                extract_brief_block(text, ["必须覆盖标签"]),
                extract_brief_block(text, ["达人类型", "博主类型"]),
                extract_brief_block(text, ["提报要求"]),
                extract_brief_block(text, ["量级数量&单个预算"]),
            ],
        )
    )
    if not REQUIRED_TAG_CONTEXT.search(context):
        return []
    return [tag for tag in possible_tags if tag in context]


def extract_content_angles(text: str) -> tuple[list[str], str]:
    block = extract_brief_block(text, ["与上一轮投放的关联", "内容切入标签", "内容偏好", "人设标签"])
    if not block:
        return [], ""
    normalized = block.replace("（毕业）学生", "毕业学生").replace("“", "").replace("”", "")
    known = ["宠物", "家庭内容", "毕业学生", "学生", "乐迷", "情侣", "有梗", "新鲜事物", "购物分享", "开箱测评", "好物推荐", "穿搭", "绘画", "手工", "拼豆", "裸辞创业者"]
    found = [tag for tag in known if tag in normalized]
    for part in split_brief_parts(normalized):
        clean = re.sub(r"^达人本身", "", part).strip()
        clean = re.sub(r"^(拥有|愿意表达)", "", clean).strip()
        if 1 < len(clean) <= 12 and not re.search(r"关联|切入|制作衣服|元素", clean):
            if any(clean != tag and tag in clean for tag in found):
                continue
            found.append(clean)
    found = dedupe(found)
    if "毕业学生" in found:
        found = [item for item in found if item != "学生"]
    return found[:12], block


def extract_account_distribution(text: str) -> list[str]:
    block = extract_brief_block(text, ["各赛道账号分布", "账号分布", "粉丝量级", "量级数量"])
    source = block or text
    rows: list[str] = []
    for raw_line in source.splitlines():
        line = clean_brief_line(raw_line)
        match = re.match(r"^(.{2,24}?)(\d+(?:\.\d+)?)%\s*[（(]?([^）)]*)[）)]?", line)
        if match:
            label = match.group(1).strip()
            ratio = float(match.group(2))
            ratio_text = f"{ratio:g}%"
            followers = match.group(3).strip()
            rows.append(f"{label}{ratio_text}{f'（{followers}）' if followers else ''}")
    out: list[str] = []
    seen: set[str] = set()
    for row in rows:
        if row not in seen:
            seen.add(row)
            out.append(row)
    return out


def analyze_brief(brief: str) -> dict[str, Any]:
    text = brief.strip()
    compact = re.sub(r"\s+", "", text)

    brand = ""
    brand = extract_brief_line(text, ["品牌"])
    if not brand:
        brand = "未命名品牌"

    background = extract_brief_block(text, ["背景&档期", "背景"])
    launch_window = ""
    launch_window = extract_brief_line(text, ["推广时间", "档期"])
    window_match = re.search(r"(五月底到6月底前|5月底到6月底前|6月左右|\d+月\d+日\s*(?:-|－|—|~|～|到|至)\s*\d+月\d+日|[一二三四五六七八九十0-9]+月底?[到至\\-][一二三四五六七八九十0-9]+月底?前?)", text)
    if window_match:
        launch_window = window_match.group(1)

    cooperation_platform = extract_brief_line(text, ["合作平台", "推广平台"])
    cooperation_form = extract_brief_line(text, ["合作形式", "内容形式"])
    content_form = extract_brief_line(text, ["内容形式"]) or cooperation_form
    requirement_line = extract_brief_block(text, ["提报要求"])
    core_requirements = extract_brief_block(text, ["核心要求"])
    other_requirements = extract_brief_block(text, ["其他要求"])
    content_angles, content_angle_note = extract_content_angles(text)
    account_distribution = extract_account_distribution(text)

    platforms: list[str] = []
    platform_source = cooperation_platform or text
    if "小红书" in platform_source or "蒲公英" in platform_source:
        platforms.append("pgy")
    if "星图" in platform_source or "巨量" in platform_source:
        platforms.append("xingtu")
    if "抖音" in platform_source:
        platforms.append("douyin")
    if "腾讯互选" in platform_source or "视频号" in platform_source or "互选" in platform_source:
        platforms.append("huxuan")
    if not platforms:
        platforms = ["pgy"]
    platforms = dedupe(platforms)

    forms = []
    form_source = content_form or text
    if "不限" in form_source:
        forms.append("不限")
    if "图文" in form_source:
        forms.append("报备图文" if "报备图文" in form_source else "图文")
    if "视频" in form_source and "视频号" not in form_source:
        forms.append("报备视频" if "报备视频" in form_source else "视频")
    if "口播" in form_source:
        forms.append("口播")
    if "植入" in form_source:
        forms.append("植入")
    preferred_form = "视频优先" if re.search(r"优先视频|视频合作", text) else ("不限" if "不限" in form_source else (forms[0] if forms else "按 brief 确认"))

    total_budget_range = parse_money_range_for_labels(text, ["总预算", "项目预算", "预算总额", "整体预算"])
    total_budget = total_budget_range[1] if total_budget_range else 0
    single_budget_range = parse_money_range_for_labels(text, ["单个预算", "单博主预算", "单人预算", "单个达人预算", "单账号预算", "单博主报价"])
    budget_min = single_budget_range[0] if single_budget_range else 0
    budget_max = single_budget_range[1] if single_budget_range else 0

    report_count_min = parse_report_count(text)

    rebate_min_pct = 0.0
    if re.search(r"返点|返佣|佣金", text):
        rebate_min_pct = parse_percent_for_labels(text, ["返点", "返佣", "佣金", "提报要求"])

    creator_types, creator_type_details = extract_creator_details(text)
    required_audience_tags = extract_required_audience_tags(text)
    if creator_type_details:
        creator_requirement_text = "\n".join(
            f"{item.get('category', '')}{'：' + '、'.join(item.get('examples') or []) if item.get('examples') else ''}"
            for item in creator_type_details
            if item.get("category")
        )
    else:
        creator_requirement_text = "\n".join(
            part
            for part in [
                "、".join(creator_types),
                f"必须覆盖：{'、'.join(required_audience_tags)}" if required_audience_tags else "",
            ]
            if part
        )

    ta = ""
    ta_match = re.search(r"TA[：:]\s*([^\n【]+)", text)
    if ta_match:
        ta = ta_match.group(1).strip()
    elif re.search(r"\d+\s*[-到至]\s*\d+\s*岁", text):
        ta = re.search(r"\d+\s*[-到至]\s*\d+\s*岁", text).group(0)

    cpm_max = None
    cpe_max = None
    cpm_match = re.search(r"CPM\s*[<＜≤<=]*\s*(\d+(?:\.\d+)?)", compact, re.I)
    cpe_match = re.search(r"CPE\s*[<＜≤<=]*\s*(\d+(?:\.\d+)?)", compact, re.I)
    if cpm_match:
        cpm_max = float(cpm_match.group(1))
    if cpe_match:
        cpe_max = float(cpe_match.group(1))

    link_required = bool(re.search(r"挂链|产品链接|站内.*链接|不配合无需提报", text))

    keywords = []
    keywords.extend(creator_types)
    keywords.extend(required_audience_tags)
    keywords.extend(content_angles)
    if brand and brand != "未命名品牌":
        keywords.append(brand)
    if "美食" in text:
        keywords.extend(["美食", "零食", "坚果", "开箱", "测评", "办公室零食", "早餐", "轻食", "养生"])
    if re.search(r"时尚|穿搭|优衣库", text):
        keywords.extend(["时尚", "穿搭", "新鲜事物体验"])
    if re.search(r"设计|绘画|手工|拼豆", text):
        keywords.extend(["设计", "绘画", "手工", "拼豆"])
    if "新品" in text:
        keywords.append("新品")
    if "视频" in text:
        keywords.append("视频种草")
    keywords = dedupe(keywords)

    hard_requirements = []
    if report_count_min:
        hard_requirements.append(f"提报数量不低于 {report_count_min} 个")
    if account_distribution:
        hard_requirements.append("粉丝量级分布：" + "、".join(account_distribution))
    if required_audience_tags:
        hard_requirements.append("必须覆盖标签：" + "、".join(required_audience_tags))
    if cpm_max is not None:
        hard_requirements.append(f"CPM < {cpm_max:g}")
    if cpe_max is not None:
        hard_requirements.append(f"CPE < {cpe_max:g}")
    if preferred_form == "视频优先":
        hard_requirements.append("优先视频合作")

    budget_risk = ""
    if total_budget and budget_min and report_count_min:
        min_total = budget_min * report_count_min
        if min_total > total_budget:
            budget_risk = (
                f"按最低单价 {money_to_text(budget_min)} 提报 {report_count_min} 个，刊例价约 {money_to_text(min_total)}，"
                f"超过总预算 {money_to_text(total_budget)}。"
            )
        else:
            budget_risk = "数量和单价按最低值测算可以进入总预算。"
    elif not total_budget:
        budget_risk = "brief 未写明总预算，只能按单博主预算筛选。"
    requirement_note = "\n".join(
        dedupe(
            [
                content_form if re.search(r"好看|好玩|精致|有趣|创意", content_form) else "",
                core_requirements,
                other_requirements,
            ]
        )
    )

    return {
        "brand": brand,
        "background": background,
        "launchWindow": launch_window,
        "cooperationPlatform": cooperation_platform,
        "platforms": platforms,
        "platformStrategy": "首版仅跑小红书蒲公英，其他平台保留底层适配器入口。" if platforms == ["pgy"] else "按 brief 保留多平台需求；本地首版优先蒲公英，视频号/星图暂作同步或人工补充。",
        "forms": forms or ["待确认"],
        "preferredForm": preferred_form,
        "totalBudget": total_budget,
        "budgetMin": budget_min,
        "budgetMax": budget_max,
        "reportCountMin": report_count_min,
        "targetCount": report_count_min,
        "recommendationTarget": report_count_min or 10,
        "rebateMinPct": rebate_min_pct,
        "creatorRequirementText": creator_requirement_text,
        "creatorTypes": creator_types,
        "creatorTypeDetails": creator_type_details,
        "requiredAudienceTags": required_audience_tags,
        "contentAngles": content_angles,
        "contentAngleNote": content_angle_note,
        "accountDistribution": account_distribution,
        "coreRequirements": core_requirements,
        "otherRequirements": other_requirements,
        "syncRequirement": other_requirements if re.search(r"同步|分发", other_requirements) else "",
        "contentQualityRequirement": content_form if re.search(r"好看|好玩|精致|有趣|创意", content_form) else "",
        "requirementNote": requirement_note,
        "ta": ta,
        "metrics": {"cpmMax": cpm_max, "cpeMax": cpe_max},
        "linkRequired": link_required,
        "keywords": keywords,
        "hardRequirements": hard_requirements,
        "budgetRisk": budget_risk,
        "version": "local-rules-0.1",
    }


def planned_collection_target(analysis: dict[str, Any], default: int = 30) -> int:
    requested = int(analysis.get("reportCountMin") or analysis.get("targetCount") or analysis.get("recommendationTarget") or default)
    requested = max(1, requested)
    return requested + max(10, math.ceil(requested * 0.3))


def insert_ai_log(conn: sqlite3.Connection, project_id: str, action: str, request: Any, response: Any) -> None:
    prompt_hash = hashlib.sha256(jdump(request).encode("utf-8")).hexdigest()[:16]
    conn.execute(
        """
        insert into ai_call_logs(id,project_id,action,provider,prompt_hash,request_json,response_json,token_count,cost,cache_hit,created_at)
        values(?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            make_id("ai"),
            project_id,
            action,
            "local-rules",
            prompt_hash,
            jdump(request),
            jdump(response),
            0,
            0,
            1,
            now(),
        ),
    )


def row_project(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "brand": row["brand"],
        "brief": row["brief"],
        "analysis": jload(row["analysis_json"], {}),
        "status": row["status"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


@app.get("/")
async def root() -> RedirectResponse:
    return RedirectResponse("/index.html?page=find", status_code=302)


@app.get("/index.html")
async def site_index() -> FileResponse:
    return FileResponse(ROOT_DIR / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/kols-dashboard.html")
async def site_dashboard() -> FileResponse:
    return FileResponse(ROOT_DIR / "kols-dashboard.html", headers={"Cache-Control": "no-store"})


@app.get("/logo.jpg")
async def site_logo() -> FileResponse:
    return FileResponse(ROOT_DIR / "logo.jpg")


@app.get("/kols.json")
async def site_kols() -> FileResponse:
    return FileResponse(ROOT_DIR / "kols.json")


@app.post("/api")
async def legacy_site_api(body: dict[str, Any]) -> dict[str, Any]:
    """兼容网站静态页现有的 /api 调用，方便本地和 GitHub 页面共用同一套 UI。"""
    action = body.get("action")
    if action == "brief_analysis":
        brief = str(body.get("brief") or "")
        return analyze_brief(brief)
    return {"error": "本地选号服务暂只接入 brief_analysis"}


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "db": str(DB_PATH), "time": now()}


@app.post("/api/tools/parse-xlsx")
async def parse_xlsx(req: XlsxParseRequest) -> dict[str, Any]:
    try:
        payload = req.dataBase64.split(",", 1)[-1]
        raw = base64.b64decode(payload)
        rows = parse_xlsx_rows(raw)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="不是有效的 .xlsx 文件") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Excel 解析失败：{exc}") from exc
    return {"rows": rows}


@app.get("/api/demo-brief")
async def demo_brief() -> dict[str, str]:
    return {"brief": DEFAULT_BRIEF}


@app.get("/api/platforms")
async def list_platforms() -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute("select * from platforms order by first_version desc, id").fetchall()
    return {"platforms": [dict(row) for row in rows]}


@app.get("/api/projects")
async def list_projects() -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute("select * from projects order by created_at desc").fetchall()
        projects = []
        for row in rows:
            project = row_project(row)
            project["counts"] = get_project_counts(conn, project["id"])
            projects.append(project)
    return {"projects": projects}


@app.post("/api/projects")
async def create_project(req: ProjectCreate) -> dict[str, Any]:
    brief = req.brief.strip()
    if not brief:
        raise HTTPException(status_code=400, detail="brief 不能为空")
    analysis = analyze_brief(brief)
    project_id = make_id("project")
    name = req.name.strip() or f"{analysis['brand']} 选号项目"
    with db() as conn:
        conn.execute(
            """
            insert into projects(id,name,brand,brief,analysis_json,status,created_at,updated_at)
            values(?,?,?,?,?,?,?,?)
            """,
            (project_id, name, analysis["brand"], brief, jdump(analysis), "analyzed", now(), now()),
        )
        insert_ai_log(conn, project_id, "brief_analysis", {"brief": brief}, analysis)
        project = row_project(conn.execute("select * from projects where id=?", (project_id,)).fetchone())
        project["counts"] = get_project_counts(conn, project_id)
    return {"project": project}


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="项目不存在")
        project = row_project(row)
        project["counts"] = get_project_counts(conn, project_id)
    return {"project": project}


def collector_keywords(analysis: dict[str, Any]) -> list[str]:
    base = []
    base.extend(analysis.get("creatorTypes") or [])
    base.extend(analysis.get("requiredAudienceTags") or [])
    base.extend(analysis.get("keywords") or [])
    compact = []
    for item in base:
        clean = str(item).replace("类", "").strip()
        if clean and clean not in compact:
            compact.append(clean)
    return compact[:10] or ["美食", "种草", "开箱测评"]


DEFAULT_PGY_TARGET_COUNT = 30


def collector_payload(project_id: str, analysis: dict[str, Any], target_count: int = DEFAULT_PGY_TARGET_COUNT) -> dict[str, Any]:
    return {
        "projectId": project_id,
        "platform": "pgy",
        "targetCount": target_count,
        "keywords": collector_keywords(analysis),
        "pgyUrl": "https://pgy.xiaohongshu.com/solar/pre-trade/note/kol",
        "ingestUrl": f"http://127.0.0.1:8890/api/collector/ingest",
        "progressUrl": f"http://127.0.0.1:8890/api/projects/{project_id}/real-collection/progress",
        "scriptUrl": f"http://127.0.0.1:8890/api/projects/{project_id}/collector-script.js",
    }


def upsert_collection_task(
    conn: sqlite3.Connection,
    project_id: str,
    platform: str,
    status: str,
    target_count: int,
    collected_count: int = 0,
    error: str = "",
) -> sqlite3.Row:
    conn.execute("delete from collection_tasks where project_id=? and platform=?", (project_id, platform))
    task_id = make_id("task")
    conn.execute(
        """
        insert into collection_tasks(id,project_id,platform,status,target_count,collected_count,error,created_at,updated_at)
        values(?,?,?,?,?,?,?,?,?)
        """,
        (task_id, project_id, platform, status, target_count, collected_count, error, now(), now()),
    )
    return conn.execute("select * from collection_tasks where id=?", (task_id,)).fetchone()


def row_codex_task(row: sqlite3.Row) -> dict[str, Any]:
    payload = jload(row["payload_json"], {})
    result = jload(row["result_json"], {})
    return {
        "id": row["id"],
        "projectId": row["project_id"],
        "type": row["type"],
        "platform": row["platform"],
        "status": row["status"],
        "targetCount": row["target_count"],
        "payload": payload,
        "result": result,
        "error": row["error"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def create_codex_find_task(conn: sqlite3.Connection, project_id: str, target_count: int) -> tuple[sqlite3.Row, sqlite3.Row, dict[str, Any]]:
    target_count = max(1, min(300, int(target_count or DEFAULT_PGY_TARGET_COUNT)))
    row = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="项目不存在")
    analysis = jload(row["analysis_json"], {})
    collector = collector_payload(project_id, analysis, target_count)
    task_id = make_id("codex")
    payload = {
        "projectId": project_id,
        "projectName": row["name"],
        "brand": row["brand"],
        "brief": row["brief"],
        "analysis": analysis,
        "collector": collector,
        "runner": "codex_chrome_background_tab",
        "runnerNote": "Codex 使用用户已登录的 Chrome 后台标签采集蒲公英，不依赖插件。",
    }
    conn.execute(
        """
        insert into codex_tasks(id,project_id,type,platform,status,target_count,payload_json,result_json,error,created_at,updated_at)
        values(?,?,?,?,?,?,?,?,?,?,?)
        """,
        (task_id, project_id, "pgy_find", "pgy", "queued", target_count, jdump(payload), "{}", "", now(), now()),
    )
    collection_task = upsert_collection_task(
        conn,
        project_id,
        "pgy",
        "queued",
        target_count,
        0,
        f"等待 Codex 使用已登录 Chrome 后台采集：在对话里发送 处理网站待办 {task_id}",
    )
    conn.execute("update projects set status='codex_queued', updated_at=? where id=?", (now(), project_id))
    task = conn.execute("select * from codex_tasks where id=?", (task_id,)).fetchone()
    return task, collection_task, collector


@app.post("/api/projects/{project_id}/codex-find/start")
async def start_codex_find_task(project_id: str, target_count: int = Query(DEFAULT_PGY_TARGET_COUNT, ge=1, le=300)) -> dict[str, Any]:
    with db() as conn:
        task, collection_task, collector = create_codex_find_task(conn, project_id, target_count)
    return {"codexTask": row_codex_task(task), "task": dict(collection_task), "collector": collector}


@app.get("/api/codex-tasks")
async def list_codex_tasks(
    status: str = Query("", max_length=40),
    project_id: str = Query("", max_length=80),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    where = []
    params: list[Any] = []
    if status:
        where.append("status=?")
        params.append(status)
    if project_id:
        where.append("project_id=?")
        params.append(project_id)
    sql = "select * from codex_tasks"
    if where:
        sql += " where " + " and ".join(where)
    sql += " order by updated_at desc, created_at desc limit ?"
    params.append(limit)
    with db() as conn:
        rows = [row_codex_task(row) for row in conn.execute(sql, params).fetchall()]
    return {"tasks": rows}


@app.get("/api/codex-tasks/{task_id}")
async def get_codex_task(task_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("select * from codex_tasks where id=?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Codex 待办不存在")
    return {"task": row_codex_task(row)}


@app.post("/api/codex-tasks/{task_id}/status")
async def update_codex_task_status(task_id: str, req: CodexTaskStatusUpdate) -> dict[str, Any]:
    status = req.status if req.status in {"queued", "running", "searching", "login_required", "done", "error"} else "running"
    with db() as conn:
        row = conn.execute("select * from codex_tasks where id=?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Codex 待办不存在")
        result = req.result or jload(row["result_json"], {})
        error = req.message if status in {"login_required", "error"} else ""
        conn.execute(
            """
            update codex_tasks
            set status=?, result_json=?, error=?, updated_at=?
            where id=?
            """,
            (status, jdump(result), error, now(), task_id),
        )
        target_count = int(row["target_count"] or DEFAULT_PGY_TARGET_COUNT)
        collected = int(req.collected_count if req.collected_count is not None else (result.get("collected") or 0))
        task_error = req.message if status in {"login_required", "error"} else (f"Codex 待办 {task_id}" if status != "done" else "")
        collection_task = upsert_collection_task(conn, row["project_id"], row["platform"], status, target_count, collected, task_error)
        project_status = {
            "queued": "codex_queued",
            "running": "codex_running",
            "searching": "codex_running",
            "login_required": "codex_login_required",
            "done": "recommended",
            "error": "codex_error",
        }.get(status, "codex_running")
        conn.execute("update projects set status=?, updated_at=? where id=?", (project_status, now(), row["project_id"]))
        updated = conn.execute("select * from codex_tasks where id=?", (task_id,)).fetchone()
    return {"codexTask": row_codex_task(updated), "task": dict(collection_task)}


@app.post("/api/projects/{project_id}/real-collection/start")
async def start_real_collection(project_id: str, target_count: int = Query(DEFAULT_PGY_TARGET_COUNT, ge=1, le=300)) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="项目不存在")
        analysis = jload(row["analysis_json"], {})
        payload = collector_payload(project_id, analysis, target_count)
        task = upsert_collection_task(
            conn,
            project_id,
            "pgy",
            "login_required",
            target_count,
            0,
            "请在已登录蒲公英的 Chrome 页面运行采集脚本",
        )
        conn.execute("update projects set status='real_collection_waiting', updated_at=? where id=?", (now(), project_id))
    return {"task": dict(task), "collector": payload}


@app.get("/api/projects/{project_id}/real-collection")
async def get_real_collection(project_id: str, target_count: int = Query(DEFAULT_PGY_TARGET_COUNT, ge=1, le=300)) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="项目不存在")
        analysis = jload(row["analysis_json"], {})
        tasks = [dict(item) for item in conn.execute("select * from collection_tasks where project_id=? order by created_at", (project_id,)).fetchall()]
    return {"tasks": tasks, "collector": collector_payload(project_id, analysis, target_count)}


@app.post("/api/projects/{project_id}/real-collection/progress")
async def update_real_collection_progress(project_id: str, req: CollectorProgress) -> dict[str, Any]:
    status = req.status if req.status in {"login_required", "searching", "running", "done", "error"} else "running"
    with db() as conn:
        row = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="项目不存在")
        task = upsert_collection_task(
            conn,
            project_id,
            req.platform,
            status,
            max(req.collected_count, 50),
            req.collected_count,
            req.error,
        )
    return {"task": dict(task)}


@app.get("/api/projects/{project_id}/collector-script.js")
async def collector_script(project_id: str, target_count: int = Query(DEFAULT_PGY_TARGET_COUNT, ge=1, le=300)) -> Response:
    with db() as conn:
        row = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="项目不存在")
        analysis = jload(row["analysis_json"], {})
    payload = collector_payload(project_id, analysis, target_count)
    audience_tags = analysis.get("requiredAudienceTags") or []
    script = f"""
(async () => {{
  const CONFIG = {json.dumps(payload, ensure_ascii=False)};
  const AUDIENCE_TAGS = {json.dumps(audience_tags, ensure_ascii=False)};
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const text = (node) => (node && (node.innerText || node.textContent) || '').replace(/\\s+/g, ' ').trim();
  const lines = (value) => String(value || '').split(/\\n|\\r|\\s{{2,}}/).map(v => v.trim()).filter(Boolean);
  const pickNumber = (value, patterns) => {{
    for (const pattern of patterns) {{
      const match = String(value || '').match(pattern);
      if (match) return match[1] || match[0];
    }}
    return '';
  }};
  const postProgress = async (status, count, error='') => {{
    try {{
      await fetch(CONFIG.progressUrl, {{
        method: 'POST',
        headers: {{'Content-Type': 'application/json'}},
        body: JSON.stringify({{platform:'pgy', status, collected_count: count, error}})
      }});
    }} catch (err) {{}}
  }};
  const setSearchValue = (input, keyword) => {{
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, keyword); else input.value = keyword;
    input.dispatchEvent(new Event('input', {{bubbles:true}}));
    input.dispatchEvent(new Event('change', {{bubbles:true}}));
  }};
  const isPgyDetailUrl = (url) => /pgy\\.xiaohongshu\\.com\\/.*\\/blogger-detail\\/[^/?#]+/.test(String(url || ''));
  const idFromUrl = (url) => {{
    const match = String(url || '').match(/blogger-detail\\/([^/?#]+)/);
    return match ? match[1] : '';
  }};
  const searchKeyword = async (keyword) => {{
    const input = [...document.querySelectorAll('input, textarea')].find(el => /搜索|达人|关键词|博主|账号/i.test(el.placeholder || el.getAttribute('aria-label') || text(el)));
    if (!input) return false;
    input.focus();
    setSearchValue(input, keyword);
    input.dispatchEvent(new KeyboardEvent('keydown', {{key:'Enter', code:'Enter', bubbles:true}}));
    const button = [...document.querySelectorAll('button')].find(btn => /搜索|查询|确定/.test(text(btn)));
    if (button) button.click();
    await sleep(2600);
    return true;
  }};
  const scrollAndCollect = async (store) => {{
    for (let i = 0; i < 8 && store.size < CONFIG.targetCount; i++) {{
      collectVisible(store);
      window.scrollBy(0, Math.max(600, window.innerHeight * 0.85));
      await sleep(900);
    }}
    collectVisible(store);
  }};
  const candidateRoots = () => {{
    const anchors = [...document.querySelectorAll('a[href*=\"blogger\"], a[href*=\"creator\"], a[href*=\"author\"]')];
    const roots = anchors.map(anchor => {{
      let node = anchor;
      for (let i = 0; i < 5 && node?.parentElement; i++) {{
        node = node.parentElement;
        if (text(node).length > 40) break;
      }}
      return node || anchor;
    }});
    const rowRoots = [...document.querySelectorAll('tr, [role=\"row\"]')].filter(node => text(node).length > 30);
    return [...new Set([...roots, ...rowRoots])];
  }};
  const collectVisible = (store) => {{
    for (const root of candidateRoots()) {{
      const body = text(root);
      if (!body || body.length < 12) continue;
      const links = [...(root.querySelectorAll?.('a[href]') || [])].map(anchor => anchor.href);
      const link = links.find(isPgyDetailUrl) || '';
      if (!link && !/粉丝|报价|CPM|CPE|阅读|互动/.test(body)) continue;
      const firstLines = lines(root.innerText || root.textContent || body);
      const name = firstLines.find(line => line.length >= 2 && line.length <= 28 && !/粉丝|报价|CPM|CPE|阅读|互动|筛选|搜索/.test(line)) || '';
      if (!name) continue;
      const platformId = idFromUrl(link);
      const key = platformId || link || name;
      const tags = CONFIG.keywords.filter(keyword => body.includes(keyword)).slice(0, 8);
      const audience = AUDIENCE_TAGS.filter(tag => body.includes(tag));
      const recentTitles = firstLines.filter(line => line.length > 6 && line.length < 60 && CONFIG.keywords.some(keyword => line.includes(keyword))).slice(0, 50);
      store.set(key, {{
        name,
        platform_id: platformId,
        home_url: link,
        followers: pickNumber(body, [/粉丝(?:数|量)?[^0-9]*([0-9.,]+\\s*(?:万|w|W|k|K)?)/, /([0-9.,]+\\s*(?:万|w|W))\\s*粉丝/]),
        image_quote: pickNumber(body, [/图文[^0-9]*([0-9.,]+\\s*(?:万|w|W|k|K)?)/]),
        video_quote: pickNumber(body, [/视频[^0-9]*([0-9.,]+\\s*(?:万|w|W|k|K)?)/]),
        exposure_median: pickNumber(body, [/曝光中位数?[^0-9]*([0-9.,]+\\s*(?:万|w|W|k|K)?)/]),
        read_median: pickNumber(body, [/阅读中位数?[^0-9]*([0-9.,]+\\s*(?:万|w|W|k|K)?)/]),
        interaction_median: pickNumber(body, [/互动中位数?[^0-9]*([0-9.,]+\\s*(?:万|w|W|k|K)?)/]),
        cpm: pickNumber(body, [/CPM[^0-9]*([0-9.]+)/i]),
        cpe: pickNumber(body, [/CPE[^0-9]*([0-9.]+)/i]),
        tags,
        audience_tags: audience,
        recent_titles: recentTitles,
        source_text: body.slice(0, 500),
        source_url: location.href,
        current_url: link || location.href,
        page_excerpt: body.slice(0, 500)
      }});
    }}
  }};
  const run = async () => {{
    const store = new Map();
    await postProgress('searching', 0);
    for (const keyword of CONFIG.keywords) {{
      if (store.size >= CONFIG.targetCount) break;
      await searchKeyword(keyword);
      await scrollAndCollect(store);
      await postProgress('running', Math.min(store.size, CONFIG.targetCount));
    }}
    const rows = [...store.values()].slice(0, CONFIG.targetCount);
    const ingestResp = await fetch(CONFIG.ingestUrl, {{
      method: 'POST',
      headers: {{'Content-Type': 'application/json'}},
      body: JSON.stringify({{project_id: CONFIG.projectId, platform: 'pgy', rows}})
    }});
    const ingest = await ingestResp.json().catch(() => ({{}}));
    if (!ingestResp.ok) throw new Error(ingest.detail || `HTTP ${{ingestResp.status}}`);
    console.log(`萌力蒲公英采集完成：正式入库 ${{ingest.ingested || 0}} 个，待修复 ${{ingest.repairCount || 0}} 个`, rows);
    alert(`萌力蒲公英采集完成：正式入库 ${{ingest.ingested || 0}} 个，待修复 ${{ingest.repairCount || 0}} 个`);
  }};
  try {{
    await run();
  }} catch (err) {{
    await postProgress('error', 0, String(err && err.message || err));
    console.error('萌力蒲公英采集失败', err);
    alert('萌力蒲公英采集失败：' + (err && err.message || err));
  }}
}})();
"""
    return Response(script, media_type="application/javascript; charset=utf-8", headers={"Cache-Control": "no-store"})


@app.put("/api/projects/{project_id}/analysis")
async def update_analysis(project_id: str, req: AnalysisUpdate) -> dict[str, Any]:
    analysis = req.analysis
    if not isinstance(analysis, dict):
        raise HTTPException(status_code=400, detail="analysis 必须是对象")
    brand = str(analysis.get("brand") or "未命名品牌")
    with db() as conn:
        row = conn.execute("select id from projects where id=?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="项目不存在")
        conn.execute(
            "update projects set brand=?, analysis_json=?, status='confirmed', updated_at=? where id=?",
            (brand, jdump(analysis), now(), project_id),
        )
        project = row_project(conn.execute("select * from projects where id=?", (project_id,)).fetchone())
        project["counts"] = get_project_counts(conn, project_id)
    return {"project": project}


def get_project_counts(conn: sqlite3.Connection, project_id: str) -> dict[str, int]:
    candidate_count = conn.execute("select count(*) from candidates where project_id=?", (project_id,)).fetchone()[0]
    recommendation_count = conn.execute("select count(*) from recommendations where project_id=?", (project_id,)).fetchone()[0]
    feedback_count = conn.execute("select count(*) from feedback where project_id=?", (project_id,)).fetchone()[0]
    task_count = conn.execute("select count(*) from collection_tasks where project_id=?", (project_id,)).fetchone()[0]
    return {
        "tasks": task_count,
        "candidates": candidate_count,
        "recommendations": recommendation_count,
        "feedback": feedback_count,
    }


@app.post("/api/projects/{project_id}/collection-tasks")
async def create_collection_tasks(project_id: str) -> dict[str, Any]:
    with db() as conn:
        project = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        analysis = jload(project["analysis_json"], {})
        platforms = analysis.get("platforms") or ["pgy"]
        target = planned_collection_target(analysis)
        conn.execute("delete from collection_tasks where project_id=?", (project_id,))
        for platform in platforms:
            status = "queued" if platform == "pgy" else "paused"
            error = "" if platform == "pgy" else "本地首版暂未接入该平台采集节点"
            conn.execute(
                """
                insert into collection_tasks(id,project_id,platform,status,target_count,collected_count,error,created_at,updated_at)
                values(?,?,?,?,?,?,?,?,?)
                """,
                (make_id("task"), project_id, platform, status, target if platform == "pgy" else 0, 0, error, now(), now()),
            )
        conn.execute("update projects set status='task_ready', updated_at=? where id=?", (now(), project_id))
        tasks = [dict(row) for row in conn.execute("select * from collection_tasks where project_id=?", (project_id,)).fetchall()]
    return {"tasks": tasks}


@app.get("/api/projects/{project_id}/collection-tasks")
async def get_collection_tasks(project_id: str) -> dict[str, Any]:
    with db() as conn:
        tasks = [dict(row) for row in conn.execute("select * from collection_tasks where project_id=? order by created_at", (project_id,)).fetchall()]
    return {"tasks": tasks}


FOOD_NAME_LEFT = ["饭饭", "栗子", "阿柚", "小满", "安安", "小鹿", "乔乔", "叮当", "米粒", "桃桃", "南瓜", "小椰", "姜姜", "白桃", "悠悠"]
FOOD_NAME_RIGHT = ["零食铺", "开箱记", "办公室餐桌", "轻食日记", "妈妈厨房", "早餐研究所", "测评局", "好物手帐", "养生食堂", "追剧零食柜"]
TITLE_TEMPLATES = [
    "{tag}真实体验，哪些细节最打动我",
    "新品开箱测评，从外观到使用感完整记录",
    "近期好物推荐，适合收藏的灵感清单",
    "{tag}人群会喜欢吗，实际使用后说说优缺点",
    "生活方式分享：把新鲜体验做得更好看",
    "视频实测：这个创意点到底有没有记忆点",
    "购物分享和开箱测评，哪些卖点更容易种草",
    "从内容质感看转化，真实体验比硬广重要",
    "适合日常发布的内容切入角度复盘",
    "同类产品怎么拍更有趣，给你几个参考点",
]


def seeded_random(project_id: str, analysis: dict[str, Any]) -> random.Random:
    seed_text = project_id + jdump(analysis)
    seed = int(hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:12], 16)
    return random.Random(seed)


def generate_titles(rng: random.Random, tags: list[str], brand: str, count: int = 50) -> list[str]:
    titles = []
    for i in range(count):
        tag = rng.choice(tags or ["美食"])
        title = rng.choice(TITLE_TEMPLATES).format(tag=tag)
        if i % 9 == 0 and brand and brand != "未命名品牌":
            title = f"{brand}新品相关：{title}"
        titles.append(title)
    return titles


def generate_pgy_rows(project_id: str, analysis: dict[str, Any], target_count: int) -> list[dict[str, Any]]:
    rng = seeded_random(project_id, analysis)
    required_tags = analysis.get("requiredAudienceTags") or analysis.get("contentAngles") or ["内容匹配"]
    creator_types = analysis.get("creatorTypes") or ["种草类"]
    brand = analysis.get("brand") or ""
    budget_min = int(analysis.get("budgetMin") or 3500)
    budget_max = int(analysis.get("budgetMax") or 12000)

    rows = []
    for index in range(target_count):
        audience = required_tags[index % len(required_tags)] if required_tags else rng.choice(["上班族", "学生党", "养生党", "精致妈妈"])
        creator_type = creator_types[index % len(creator_types)] if creator_types else "美食种草类"
        side_candidates = dedupe((analysis.get("contentAngles") or []) + (analysis.get("keywords") or []) + ["开箱测评", "好物推荐", "生活方式"])
        side_tag = rng.choice(side_candidates)
        tags = dedupe([creator_type.replace("类", ""), side_tag, audience])
        base = max(2500, budget_min - 2500)
        top = max(base + 2000, budget_max + 3500)
        video_quote = int(round(rng.randint(base, top) / 100)) * 100
        image_quote = int(round(video_quote * rng.uniform(0.55, 0.75) / 100)) * 100
        if index % 11 == 0:
            video_quote = int(round(video_quote * 1.35 / 100)) * 100
        followers = round(rng.uniform(2.5, 28.0), 1)
        read_median = int(video_quote / rng.uniform(42, 88) * 1000)
        read_median = max(9000, min(read_median, 240000))
        interaction_median = int(video_quote / rng.uniform(5.2, 11.5))
        interaction_median = max(260, min(interaction_median, 8500))
        cpm = round(video_quote / max(read_median, 1) * 1000, 1)
        cpe = round(video_quote / max(interaction_median, 1), 1)
        supports_link = rng.random() > 0.12
        rebate_pct = round(rng.uniform(18, 28), 1)
        if index % 7 == 0:
            rebate_pct = round(rng.uniform(22, 30), 1)
        if index % 13 == 0:
            supports_link = False
        vertical_score = round(rng.uniform(70, 96), 1)
        if "美食" in " ".join(tags):
            vertical_score = min(98, vertical_score + 4)
        titles = generate_titles(rng, tags, brand)
        display_name = f"{rng.choice(FOOD_NAME_LEFT)}{rng.choice(FOOD_NAME_RIGHT)}{index + 1:03d}"
        platform_id = re.sub(r"[^a-zA-Z0-9_]", "", f"pgy_food_{index + 1:03d}")
        rows.append(
            {
                "name": display_name,
                "platform": "pgy",
                "platform_id": platform_id,
                "home_url": f"https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/{platform_id}",
                "primary_category": "美食",
                "persona": f"{audience} / {creator_type.replace('类', '')}",
                "followers": followers,
                "tags": tags,
                "audience_tags": [audience],
                "quote_low": image_quote,
                "quote_high": video_quote,
                "image_quote": image_quote,
                "video_quote": video_quote,
                "supports_link": supports_link,
                "rebate_pct": rebate_pct,
                "read_median": read_median,
                "interaction_median": interaction_median,
                "cpm": cpm,
                "cpe": cpe,
                "vertical_score": vertical_score,
                "recent_titles": titles,
            }
        )
    return rows


def get_project_analysis(conn: sqlite3.Connection, project_id: str) -> dict[str, Any]:
    row = conn.execute("select analysis_json from projects where id=?", (project_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="项目不存在")
    return jload(row["analysis_json"], {})


def get_memory_rows(conn: sqlite3.Connection, analysis: dict[str, Any]) -> list[sqlite3.Row]:
    brand = analysis.get("brand") or ""
    keywords = analysis.get("keywords") or []
    clauses = []
    params: list[Any] = []
    if brand:
        clauses.append("memory_key like ?")
        params.append(f"%{brand}%")
    for keyword in keywords[:8]:
        clauses.append("memory_key like ?")
        params.append(f"%{keyword}%")
    if not clauses:
        return []
    return conn.execute(
        f"select * from memories where {' or '.join(clauses)} order by created_at desc limit 50",
        params,
    ).fetchall()


def text_overlap_score(keywords: list[str], fields: list[str]) -> int:
    haystack = " ".join(fields)
    hits = 0
    for keyword in keywords:
        if keyword and keyword in haystack:
            hits += 1
    return hits


CONTENT_ACTION_TERMS = {"种草", "开箱", "测评"}
CONTENT_STOP_TERMS = {"新品", "视频", "视频种草", "报备图文", "报备视频", "图文", "小红书", "蒲公英"}
KNOWN_CONTENT_TERMS = [
    "美食",
    "零食",
    "坚果",
    "办公室零食",
    "早餐",
    "轻食",
    "养生",
    "烘焙",
    "饮品",
    "咖啡",
    "穿搭",
    "潮流穿搭",
    "拖鞋",
    "鞋履",
    "鞋",
    "凉鞋",
    "凉拖",
    "家居鞋",
    "家居",
    "日用",
    "好物",
    "单品",
    "单品直推",
    "种草",
    "开箱",
    "测评",
]
AUDIENCE_TAG_ALIASES = {
    "上班族": ["上班族", "职场", "白领", "打工人", "通勤", "上班"],
    "白领": ["白领", "职场", "通勤", "上班", "打工人"],
    "小镇中年": ["小镇中年", "中年", "熟龄", "家庭", "妈妈"],
    "学生党": ["学生党", "学生", "大学生", "校园"],
    "养生党": ["养生党", "养生", "健康", "轻食"],
    "精致妈妈": ["精致妈妈", "妈妈", "宝妈", "母婴", "育儿", "亲子"],
}


def metric_limit(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def candidate_haystack(row: dict[str, Any]) -> str:
    tags = row.get("tags") or row.get("contentTags") or []
    audience_tags = row.get("audienceTags") or row.get("audience_tags") or []
    titles = row.get("recentTitles") or row.get("recent_titles") or []
    return " ".join(
        [
            str(row.get("name") or ""),
            str(row.get("persona") or ""),
            str(row.get("primaryCategory") or row.get("primary_category") or ""),
            " ".join(tags),
            " ".join(audience_tags),
            " ".join(titles[:30]),
        ]
    )


def audience_tag_hits(row: dict[str, Any], required_tags: list[str]) -> list[str]:
    haystack = candidate_haystack(row)
    hits = []
    for tag in required_tags:
        aliases = AUDIENCE_TAG_ALIASES.get(tag, [tag])
        if any(alias and alias in haystack for alias in aliases):
            hits.append(tag)
    return hits


def content_relevance_terms(analysis: dict[str, Any]) -> dict[str, list[str]]:
    brand = str(analysis.get("brand") or "").strip()
    audience_terms = set(analysis.get("requiredAudienceTags") or [])
    raw_terms = [brand, *(analysis.get("creatorTypes") or []), *(analysis.get("keywords") or [])]
    domain_terms: list[str] = []
    action_terms: list[str] = []

    for raw in raw_terms:
        clean = str(raw or "").strip(" ，,、。；;（）()[]【】\n\t")
        clean = re.sub(r"(达人|账号|博主)$", "", clean)
        clean = clean.removesuffix("类")
        if not clean or clean == brand or clean in audience_terms or clean in CONTENT_STOP_TERMS:
            continue

        pieces = [clean]
        pieces.extend(term for term in KNOWN_CONTENT_TERMS if term in clean)
        for piece in pieces:
            piece = piece.strip(" ，,、。；;（）()[]【】\n\t")
            if not piece or piece == brand or piece in audience_terms or piece in CONTENT_STOP_TERMS:
                continue
            if piece in CONTENT_ACTION_TERMS:
                action_terms.append(piece)
            else:
                domain_terms.append(piece)

    return {"domain": dedupe(domain_terms), "action": dedupe(action_terms)}


def content_relevance_summary(row: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    terms = content_relevance_terms(analysis)
    haystack = candidate_haystack(row)
    domain_hits = [term for term in terms["domain"] if term in haystack]
    action_hits = [term for term in terms["action"] if term in haystack]
    required_terms = terms["domain"] or terms["action"]
    passes = not required_terms or bool(domain_hits if terms["domain"] else action_hits)
    return {
        "terms": terms,
        "domainHits": domain_hits,
        "actionHits": action_hits,
        "pass": passes,
    }


def evaluate_row(row: dict[str, Any], analysis: dict[str, Any], memories: list[sqlite3.Row]) -> tuple[dict[str, int], str, str, str]:
    form_mode = form_requirement_mode(analysis)
    if form_mode == "video":
        quote = int(row.get("video_quote") or row.get("quote_high") or 0)
        quote_label = "视频报价"
    elif form_mode == "image":
        quote = int(row.get("image_quote") or row.get("quote_low") or 0)
        quote_label = "图文报价"
    else:
        quote = int(row.get("video_quote") or row.get("quote_high") or row.get("image_quote") or row.get("quote_low") or 0)
        quote_label = "视频报价" if row.get("video_quote") or row.get("quote_high") else "图文报价"
    budget_min = int(analysis.get("budgetMin") or 0)
    budget_max = int(analysis.get("budgetMax") or 0)
    metrics = analysis.get("metrics") or {}
    cpm_max = metric_limit(metrics.get("cpmMax"))
    cpe_max = metric_limit(metrics.get("cpeMax"))
    keywords = analysis.get("keywords") or []
    required_tags = analysis.get("requiredAudienceTags") or []

    if budget_min and budget_max:
        if budget_min <= quote <= budget_max:
            budget_score = 95
        elif quote < budget_min:
            budget_score = round(48 + min(1, quote / max(1, budget_min)) * 30)
        elif quote <= budget_max * 1.2:
            budget_score = 70
        else:
            budget_score = 46
    else:
        budget_score = 78
    budget_score = max(0, min(100, budget_score))

    titles = row.get("recent_titles") or []
    tags = row.get("tags") or []
    relevance = content_relevance_summary(row, analysis)
    content_hits = len(relevance["domainHits"]) * 2 + len(relevance["actionHits"])
    matched_audience_tags = audience_tag_hits(row, required_tags)
    audience_hits = len(matched_audience_tags)
    content_score = min(100, 42 + content_hits * 8 + audience_hits * 16)
    if relevance["terms"]["domain"] and not relevance["domainHits"]:
        content_score -= 26
    elif relevance["terms"]["action"] and not relevance["actionHits"]:
        content_score -= 16
    if required_tags and not audience_hits:
        content_score -= 10
    content_score = max(0, content_score)

    performance_score = 74
    cpm = float(row.get("cpm") or 0)
    cpe = float(row.get("cpe") or 0)
    read_median = int(row.get("read_median") or 0)
    interaction_median = int(row.get("interaction_median") or 0)
    if read_median >= 60000:
        performance_score += 8
    if interaction_median >= 1000:
        performance_score += 7
    if cpm_max is not None:
        if not cpm:
            performance_score -= 20
        elif cpm > float(cpm_max):
            performance_score -= min(24, int((cpm - float(cpm_max)) / 4) + 10)
    if cpe_max is not None:
        if not cpe:
            performance_score -= 20
        elif cpe > float(cpe_max):
            performance_score -= min(24, int((cpe - float(cpe_max)) * 2) + 8)
    performance_score = max(0, min(100, performance_score))

    history_score = 72
    memory_text = "\n".join([m["value"] for m in memories])
    if row.get("name") and row["name"] in memory_text:
        if re.search(r"通过|好用|优先|提高", memory_text):
            history_score += 12
        if re.search(r"排除|避雷|替换|不用", memory_text):
            history_score -= 22
    if analysis.get("brand") and analysis["brand"] in memory_text:
        history_score += 5
    history_score = max(0, min(100, history_score))

    vertical_score = int(round(float(row.get("vertical_score") or 75)))
    total = round(
        budget_score * 0.2
        + content_score * 0.3
        + performance_score * 0.3
        + history_score * 0.1
        + vertical_score * 0.1
    )
    scores = {
        "budget": int(budget_score),
        "content": int(content_score),
        "performance": int(performance_score),
        "history": int(history_score),
        "vertical": int(vertical_score),
        "total": int(total),
    }

    reasons = []
    if relevance["domainHits"]:
        reasons.append("内容命中" + "、".join(relevance["domainHits"][:3]))
    if matched_audience_tags:
        reasons.append("覆盖" + "、".join(matched_audience_tags))
    if budget_min and budget_max and budget_min <= quote <= budget_max:
        reasons.append(f"{quote_label} {money_to_text(quote)} 在单个预算内")
    if cpm_max is not None and cpm and cpm <= float(cpm_max):
        reasons.append(f"CPM {cpm:g} 达标")
    if cpe_max is not None and cpe and cpe <= float(cpe_max):
        reasons.append(f"CPE {cpe:g} 达标")
    reason = "；".join(reasons[:5]) or "基础字段完整，可进入人工复核。"

    risks = []
    if budget_min and quote < budget_min:
        risks.append(f"报价 {money_to_text(quote)} 低于单个预算下限")
    if budget_max and quote > budget_max:
        risks.append(f"报价 {money_to_text(quote)} 高于单个预算上限")
    if cpm_max is not None:
        if not cpm:
            risks.append("CPM缺失")
        elif cpm > float(cpm_max):
            risks.append(f"CPM {cpm:g} 超出 {float(cpm_max):g}")
    if cpe_max is not None:
        if not cpe:
            risks.append("CPE缺失")
        elif cpe > float(cpe_max):
            risks.append(f"CPE {cpe:g} 超出 {float(cpe_max):g}")
    risk = "；".join(risks) if risks else "暂无明显硬性风险"

    matched_titles = [title for title in titles if text_overlap_score(keywords, [title]) > 0][:3]
    title_evidence = " / ".join(matched_titles) if matched_titles else (titles[0] if titles else "暂未采集最近标题")
    evidence = (
        f"最近标题 {len(titles)} 条；阅读中位数 {read_median}，互动中位数 {interaction_median}；"
        f"代表标题：{title_evidence}"
    )
    return scores, reason, risk, evidence


def insert_candidate_row(conn: sqlite3.Connection, project_id: str, row: dict[str, Any], analysis: dict[str, Any], memories: list[sqlite3.Row]) -> str:
    creator_id = make_id("creator")
    profile_id = make_id("profile")
    metric_id = make_id("metric")
    candidate_id = make_id("candidate")
    conn.execute(
        "insert into creators(id,name,primary_category,persona,created_at) values(?,?,?,?,?)",
        (creator_id, row["name"], row.get("primary_category", ""), row.get("persona", ""), now()),
    )
    conn.execute(
        """
        insert into creator_platform_profiles(
          id,creator_id,platform,platform_id,home_url,followers,tags_json,audience_tags_json,
          quote_low,quote_high,image_quote,video_quote,supports_link,rebate_pct,created_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            profile_id,
            creator_id,
            row.get("platform", "pgy"),
            row.get("platform_id", ""),
            row.get("home_url", ""),
            float(row.get("followers") or 0),
            jdump(row.get("tags") or []),
            jdump(row.get("audience_tags") or []),
            int(row.get("quote_low") or row.get("image_quote") or 0),
            int(row.get("quote_high") or row.get("video_quote") or 0),
            int(row.get("image_quote") or 0),
            int(row.get("video_quote") or 0),
            1 if row.get("supports_link") else 0,
            float(row.get("rebate_pct") or 0),
            now(),
        ),
    )
    conn.execute(
        """
        insert into creator_metrics(
          id,profile_id,exposure_median,read_median,interaction_median,cpm,cpe,
          vertical_score,recent_titles_json,title_status,title_error,collected_at
        )
        values(?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            metric_id,
            profile_id,
            int(row.get("exposure_median") or 0),
            int(row.get("read_median") or 0),
            int(row.get("interaction_median") or 0),
            float(row.get("cpm") or 0),
            float(row.get("cpe") or 0),
            float(row.get("vertical_score") or 0),
            jdump(row.get("recent_titles") or []),
            row.get("title_status") or ("collected" if row.get("recent_titles") else "missing"),
            row.get("title_error") or ("" if row.get("recent_titles") else "采集器未返回最近标题"),
            now(),
        ),
    )
    scores, reason, risk, evidence = evaluate_row(row, analysis, memories)
    status = "active"
    if "应排除" in risk:
        status = "risk"
    conn.execute(
        """
        insert into candidates(id,project_id,profile_id,platform,status,scores_json,reason,risk,evidence,locked,excluded,created_at)
        values(?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            candidate_id,
            project_id,
            profile_id,
            row.get("platform", "pgy"),
            status,
            jdump(scores),
            reason,
            risk,
            evidence,
            0,
            0,
            now(),
        ),
    )
    return candidate_id


@app.post("/api/projects/{project_id}/collect")
async def run_local_collection(project_id: str, target_count: int = Query(0, ge=0, le=1000)) -> dict[str, Any]:
    with db() as conn:
        analysis = get_project_analysis(conn, project_id)
        task = conn.execute(
            "select * from collection_tasks where project_id=? and platform='pgy'",
            (project_id,),
        ).fetchone()
        requested_target = target_count or planned_collection_target(analysis)
        if not task:
            target = requested_target
            conn.execute(
                """
                insert into collection_tasks(id,project_id,platform,status,target_count,collected_count,error,created_at,updated_at)
                values(?,?,?,?,?,?,?,?,?)
                """,
                (make_id("task"), project_id, "pgy", "queued", target, 0, "", now(), now()),
            )
        else:
            target = max(int(task["target_count"]), requested_target)

        conn.execute("update collection_tasks set status='running', target_count=?, updated_at=? where project_id=? and platform='pgy'", (target, now(), project_id))
        clear_project_selection(conn, project_id)
        memories = get_memory_rows(conn, analysis)
        rows = generate_pgy_rows(project_id, analysis, target)
        for row in rows:
            insert_candidate_row(conn, project_id, row, analysis, memories)
        conn.execute(
            "update collection_tasks set status='done', collected_count=?, error='', updated_at=? where project_id=? and platform='pgy'",
            (len(rows), now(), project_id),
        )
        conn.execute("update projects set status='collected', updated_at=? where id=?", (now(), project_id))
    return {"collected": len(rows), "platform": "pgy"}


def clear_project_selection(conn: sqlite3.Connection, project_id: str) -> None:
    profile_rows = conn.execute("select profile_id from candidates where project_id=?", (project_id,)).fetchall()
    profile_ids = [row["profile_id"] for row in profile_rows]
    conn.execute("delete from recommendations where project_id=?", (project_id,))
    conn.execute("delete from candidates where project_id=?", (project_id,))
    conn.execute("delete from creator_repair_records where project_id=?", (project_id,))
    for profile_id in profile_ids:
        media_entry = conn.execute(
            "select 1 from media_library_entries where profile_id=? limit 1",
            (profile_id,),
        ).fetchone()
        if media_entry:
            continue
        creator = conn.execute("select creator_id from creator_platform_profiles where id=?", (profile_id,)).fetchone()
        conn.execute("delete from creator_metrics where profile_id=?", (profile_id,))
        conn.execute("delete from creator_platform_profiles where id=?", (profile_id,))
        if creator:
            conn.execute("delete from creators where id=?", (creator["creator_id"],))


def mark_media_library_profile(
    conn: sqlite3.Connection,
    profile_id: str,
    project_id: str,
    source_type: str,
    note: str = "",
) -> None:
    if not profile_id:
        return
    conn.execute(
        """
        insert into media_library_entries(id,profile_id,source_type,source_project_id,note,created_at,updated_at)
        values(?,?,?,?,?,?,?)
        on conflict(profile_id) do update set
          source_type=excluded.source_type,
          source_project_id=case
            when media_library_entries.source_project_id='' then excluded.source_project_id
            else media_library_entries.source_project_id
          end,
          note=case when excluded.note!='' then excluded.note else media_library_entries.note end,
          updated_at=excluded.updated_at
        """,
        (make_id("media"), profile_id, source_type, project_id or "", note, now(), now()),
    )


def mark_recommendations_as_media(
    conn: sqlite3.Connection,
    project_id: str,
    recommendation_items: list[dict[str, Any]],
    source_type: str,
    note: str = "",
) -> None:
    for item in recommendation_items:
        mark_media_library_profile(conn, item.get("profileId", ""), project_id, source_type, note)


@app.post("/api/collector/ingest")
async def collector_ingest(req: CollectorIngest) -> dict[str, Any]:
    """真实采集节点把蒲公英采到的数据写入候选池。"""
    if req.platform not in PLATFORMS:
        raise HTTPException(status_code=400, detail="未知平台")
    with db() as conn:
        analysis = get_project_analysis(conn, req.project_id)
        target = planned_collection_target(analysis)
        if not req.rows:
            task = upsert_collection_task(conn, req.project_id, req.platform, "error", target, 0, "采集器没有从当前蒲公英页面识别到达人")
            return {"ingested": 0, "task": dict(task)}
        clear_project_selection(conn, req.project_id)
        memories = get_memory_rows(conn, analysis)
        count = 0
        repair_count = 0
        seen: set[str] = set()
        for item in req.rows:
            normalized = normalize_ingest_row(req.platform, item)
            key = f"{normalized.get('platform_id') or normalized.get('home_url') or normalized.get('name')}"
            if not normalized.get("name") or key in seen:
                continue
            seen.add(key)
            issues = required_field_issues(normalized)
            if issues:
                insert_repair_record(conn, req.project_id, normalized, "、".join(issues))
                repair_count += 1
                continue
            candidate_id = insert_candidate_row(conn, req.project_id, normalized, analysis, memories)
            count += 1
            if normalized.get("title_status") in {"missing", "failed"}:
                insert_repair_record(
                    conn,
                    req.project_id,
                    normalized,
                    normalized.get("title_error") or "标题抓取失败",
                    candidate_id=candidate_id,
                    status="pending",
                )
                repair_count += 1
        task = upsert_collection_task(conn, req.project_id, req.platform, "done", max(target, count + repair_count), count, "")
        rec_target = max(1, min(80, int(analysis.get("reportCountMin") or analysis.get("recommendationTarget") or 25)))
        recs = save_auto_recommendations(conn, req.project_id, rec_target)
    return {"ingested": count, "repairCount": repair_count, "task": dict(task), "recommendations": recs}


def normalize_ingest_row(platform: str, row: dict[str, Any]) -> dict[str, Any]:
    def pick(*keys: str) -> Any:
        for key in keys:
            if key in row and row[key] not in (None, ""):
                return row[key]
        return ""

    def as_list(value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        text = str(value or "")
        if not text:
            return []
        return dedupe([part for part in re.split(r"[、,，/；;\n|]+", text) if part.strip()])

    def as_number(value: Any, money: bool = False, count: bool = False) -> float:
        if isinstance(value, (int, float)):
            number = float(value)
            if not money and not count and number >= 10000:
                return number / 10000
            return number
        text = str(value or "").replace(",", "").strip()
        if not text:
            return 0.0
        match = re.search(r"(\d+(?:\.\d+)?)\s*(w|W|万|k|K|千)?", text)
        if not match:
            return 0.0
        number = float(match.group(1))
        unit = match.group(2) or ""
        if unit in {"w", "W", "万"}:
            number *= 10000 if money or count else 1
        elif unit in {"k", "K", "千"}:
            number *= 1000 if money or count else 0.1
        elif not money and not count and number >= 10000:
            number /= 10000
        return number

    tags = as_list(pick("tags", "contentTags", "内容标签", "账号标签", "内容类目", "账号行业"))
    audience_tags = as_list(pick("audience_tags", "audienceTags", "人群标签", "TA标签", "账号画像"))
    recent_titles = as_list(pick("recent_titles", "recentTitles", "最近50条标题", "最近标题", "笔记标题", "作品标题"))
    image_quote = int(as_number(pick("image_quote", "imageQuote", "图文报价", "平台报价（含10%服务费）", "平台裸价"), money=True))
    video_quote = int(as_number(pick("video_quote", "videoQuote", "视频报价", "报价"), money=True))
    if not video_quote:
        video_quote = image_quote
    title_status = str(pick("title_status", "titleStatus", "标题状态") or "").strip()
    title_error = str(pick("title_error", "titleError", "标题采集失败原因", "标题失败原因") or "").strip()
    if not title_status:
        if recent_titles:
            title_status = "collected"
        elif title_error:
            title_status = "failed"
        else:
            title_status = "missing"
            title_error = "采集器未返回最近标题"
    return {
        "name": pick("name", "creatorName", "达人名称", "达人昵称", "账号昵称", "昵称") or "未命名达人",
        "platform": platform,
        "platform_id": pick("platform_id", "platformId", "平台ID", "达人id", "达人ID", "小红书号") or "",
        "home_url": pick("home_url", "homeUrl", "主页链接", "蒲公英主页", "蒲公英链接", "蒲公英主页链接", "小红书主页") or "",
        "primary_category": pick("primary_category", "垂类", "内容类目", "账号行业") or "",
        "persona": pick("persona", "账号画像", "账号简介") or "",
        "followers": as_number(pick("followers", "粉丝数", "粉丝量", "粉丝量/w")),
        "tags": tags,
        "audience_tags": audience_tags,
        "quote_low": int(as_number(pick("quote_low", "图文报价", "imageQuote"), money=True) or image_quote),
        "quote_high": int(as_number(pick("quote_high", "视频报价", "videoQuote", "报价"), money=True) or video_quote),
        "image_quote": image_quote,
        "video_quote": video_quote,
        "supports_link": True,
        "rebate_pct": as_number(pick("rebate_pct", "rebatePct", "返点", "返点比例")),
        "exposure_median": int(as_number(pick("exposure_median", "exposureMedian", "曝光中位数", "中位曝光", "曝光中位"), count=True)),
        "read_median": int(as_number(pick("read_median", "readMedian", "阅读中位数", "中位阅读"), count=True)),
        "interaction_median": int(as_number(pick("interaction_median", "interactionMedian", "互动中位数", "中位互动量"), count=True)),
        "cpm": as_number(pick("cpm", "CPM", "预期CPM", "预估CPM")),
        "cpe": as_number(pick("cpe", "CPE", "预期CPE", "预估CPE")),
        "vertical_score": as_number(pick("vertical_score", "verticalScore", "垂直度分")) or 75,
        "recent_titles": recent_titles,
        "title_status": title_status,
        "title_error": title_error,
        "source_keyword": pick("source_keyword", "sourceKeyword", "来源关键词") or "",
        "source_url": pick("source_url", "sourceUrl", "来源链接", "列表页链接") or "",
        "current_url": pick("current_url", "currentUrl", "当前URL", "当前链接") or "",
        "page_excerpt": pick("page_excerpt", "pageExcerpt", "页面片段摘要", "source_text", "sourceText") or "",
    }


def is_valid_pgy_home_url(value: Any) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    try:
        parsed = re.match(r"https?://([^/]+)(/[^?#]*)?", text)
        if not parsed:
            return False
        host = parsed.group(1)
        path = parsed.group(2) or ""
    except Exception:
        return False
    if "pgy.xiaohongshu.com" not in host:
        return False
    if "/blogger-detail/" not in path:
        return False
    if "/note/kol" in path or "/pre-trade/note" in path:
        return False
    return True


def is_valid_platform_id(value: Any, name: Any = "") -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    if text == str(name or "").strip():
        return False
    if len(text) < 2 or len(text) > 80:
        return False
    return bool(re.search(r"[A-Za-z0-9_\-.]", text))


def required_field_issues(row: dict[str, Any]) -> list[str]:
    issues = []
    if not str(row.get("name") or "").strip():
        issues.append("缺达人昵称")
    if not is_valid_platform_id(row.get("platform_id"), row.get("name")):
        issues.append("缺小红书号")
    if not is_valid_pgy_home_url(row.get("home_url")):
        issues.append("缺蒲公英主页")
    return issues


def title_status_label(status: str, titles: list[str], error: str = "") -> str:
    if status == "collected" and titles:
        return f"已采集标题（{len(titles)}条）"
    if status == "failed":
        return f"标题采集失败：{error or '未写明原因'}"
    if status == "missing":
        return f"未采集标题：{error or '待补采'}"
    return f"已采集标题（{len(titles)}条）" if titles else "未采集标题：待补采"


def next_repair_action(reason: str) -> str:
    if "详情打不开" in reason:
        return "自动重试详情页3次，仍失败后人工确认入口"
    if "缺蒲公英主页" in reason:
        return "从列表链接、详情页URL、昵称入口重新补取；失败后人工填写蒲公英达人详情链接"
    if "缺小红书号" in reason:
        return "从详情页账号信息、主页跳转链接、页面文本重新补取；失败后人工填写小红书号"
    if "标题" in reason:
        return "重新进入达人详情页补采最近标题，或人工标记暂不处理"
    return "自动重试，失败后人工补充"


def insert_repair_record(
    conn: sqlite3.Connection,
    project_id: str,
    row: dict[str, Any],
    reason: str,
    *,
    candidate_id: str = "",
    profile_id: str = "",
    status: str = "pending",
) -> str:
    repair_id = make_id("repair")
    title_status = str(row.get("title_status") or "").strip()
    title_error = str(row.get("title_error") or "").strip()
    conn.execute(
        """
        insert into creator_repair_records(
          id,project_id,candidate_id,profile_id,platform,status,name,platform_id,home_url,
          list_data_json,source_keyword,source_url,current_url,reason,action,retry_count,
          page_excerpt,screenshot_path,title_status,title_error,note,created_at,updated_at,resolved_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            repair_id,
            project_id,
            candidate_id,
            profile_id,
            row.get("platform", "pgy"),
            status,
            row.get("name", ""),
            row.get("platform_id", ""),
            row.get("home_url", ""),
            jdump(row),
            row.get("source_keyword", ""),
            row.get("source_url", ""),
            row.get("current_url", ""),
            reason,
            next_repair_action(reason),
            int(row.get("retry_count") or 0),
            str(row.get("page_excerpt") or "")[:1200],
            str(row.get("screenshot_path") or ""),
            title_status,
            title_error,
            str(row.get("note") or ""),
            now(),
            now(),
            "",
        ),
    )
    return repair_id


def candidate_query() -> str:
    return """
      select
        c.*,
        cr.name,
        cr.primary_category,
        cr.persona,
        p.platform_id,
        p.home_url,
        p.followers,
        p.tags_json,
        p.audience_tags_json,
        p.quote_low,
        p.quote_high,
        p.image_quote,
        p.video_quote,
        p.supports_link,
        p.rebate_pct,
        m.exposure_median,
        m.read_median,
        m.interaction_median,
        m.cpm,
        m.cpe,
        m.vertical_score,
        m.recent_titles_json,
        coalesce(m.title_status, '') title_status,
        coalesce(m.title_error, '') title_error
      from candidates c
      join creator_platform_profiles p on p.id=c.profile_id
      join creators cr on cr.id=p.creator_id
      join creator_metrics m on m.profile_id=p.id
    """


def row_candidate(row: sqlite3.Row) -> dict[str, Any]:
    scores = jload(row["scores_json"], {})
    recent_titles = jload(row["recent_titles_json"], [])
    title_status = row["title_status"] or ("collected" if recent_titles else "missing")
    title_error = row["title_error"] or ("" if recent_titles else "采集器未返回最近标题")
    return {
        "id": row["id"],
        "projectId": row["project_id"],
        "profileId": row["profile_id"],
        "platform": row["platform"],
        "platformLabel": PLATFORMS.get(row["platform"], {}).get("label", row["platform"]),
        "status": row["status"],
        "name": row["name"],
        "primaryCategory": row["primary_category"],
        "persona": row["persona"],
        "platformId": row["platform_id"],
        "homeUrl": row["home_url"],
        "followers": row["followers"],
        "tags": jload(row["tags_json"], []),
        "audienceTags": jload(row["audience_tags_json"], []),
        "quoteLow": row["quote_low"],
        "quoteHigh": row["quote_high"],
        "imageQuote": row["image_quote"],
        "videoQuote": row["video_quote"],
        "supportsLink": bool(row["supports_link"]),
        "rebatePct": row["rebate_pct"],
        "exposureMedian": row["exposure_median"],
        "readMedian": row["read_median"],
        "interactionMedian": row["interaction_median"],
        "cpm": row["cpm"],
        "cpe": row["cpe"],
        "verticalScore": row["vertical_score"],
        "recentTitles": recent_titles,
        "titleStatus": title_status,
        "titleError": title_error,
        "titleStatusLabel": title_status_label(title_status, recent_titles, title_error),
        "intakeStatus": "正式入库",
        "repairReason": "",
        "scores": scores,
        "reason": row["reason"],
        "risk": row["risk"],
        "evidence": row["evidence"],
        "locked": bool(row["locked"]),
        "excluded": bool(row["excluded"]),
        "createdAt": row["created_at"],
    }


def row_database_creator(row: sqlite3.Row) -> dict[str, Any]:
    tags = dedupe([*(jload(row["tags_json"], []) or []), *(jload(row["audience_tags_json"], []) or [])])
    project_names = [name for name in str(row["project_names"] or "").split("||") if name]
    project_ids = [project_id for project_id in str(row["project_ids"] or "").split("||") if project_id]
    source_type = row["media_source_type"] or ""
    recent_titles = jload(row["recent_titles_json"], [])
    title_status = row["title_status"] or ("collected" if recent_titles else "missing")
    title_error = row["title_error"] or ("" if recent_titles else "采集器未返回最近标题")
    if project_names:
        source = f"项目沉淀：{'、'.join(project_names)}"
    elif source_type == "manual":
        source = "人工修正"
    else:
        source = "媒体库沉淀"
    return {
        "profileId": row["profile_id"],
        "creatorId": row["creator_id"],
        "platform": row["platform"],
        "platformLabel": PLATFORMS.get(row["platform"], {}).get("label", row["platform"]),
        "name": row["name"],
        "platformId": row["platform_id"],
        "homeUrl": row["home_url"],
        "primaryCategory": row["primary_category"],
        "persona": row["persona"],
        "followers": row["followers"],
        "tags": tags,
        "quoteLow": row["quote_low"],
        "quoteHigh": row["quote_high"],
        "imageQuote": row["image_quote"],
        "videoQuote": row["video_quote"],
        "supportsLink": bool(row["supports_link"]),
        "rebatePct": row["rebate_pct"],
        "exposureMedian": row["exposure_median"],
        "readMedian": row["read_median"],
        "interactionMedian": row["interaction_median"],
        "cpm": row["cpm"],
        "cpe": row["cpe"],
        "verticalScore": row["vertical_score"],
        "recentTitles": recent_titles,
        "titleStatus": title_status,
        "titleError": title_error,
        "titleStatusLabel": title_status_label(title_status, recent_titles, title_error),
        "intakeStatus": "正式入库",
        "repairReason": "",
        "source": source,
        "mediaSourceType": source_type,
        "mediaNote": row["media_note"] or "",
        "sourceProjectIds": project_ids,
        "sourceProjectNames": project_names,
        "createdAt": row["profile_created_at"],
        "collectedAt": row["collected_at"],
    }


def row_repair_record(row: sqlite3.Row) -> dict[str, Any]:
    list_data = jload(row["list_data_json"], {}) or {}
    recent_titles = list_data.get("recent_titles") or list_data.get("recentTitles") or []
    if not isinstance(recent_titles, list):
        recent_titles = []
    title_status = row["title_status"] or list_data.get("title_status") or ("collected" if recent_titles else "missing")
    title_error = row["title_error"] or list_data.get("title_error") or ("" if recent_titles else "待补采标题")
    return {
        "repairId": row["id"],
        "projectId": row["project_id"],
        "candidateId": row["candidate_id"],
        "profileId": row["profile_id"],
        "platform": row["platform"],
        "platformLabel": PLATFORMS.get(row["platform"], {}).get("label", row["platform"]),
        "status": row["status"],
        "name": row["name"] or list_data.get("name", ""),
        "platformId": row["platform_id"] or list_data.get("platform_id", ""),
        "homeUrl": row["home_url"] or list_data.get("home_url", ""),
        "primaryCategory": list_data.get("primary_category", ""),
        "persona": list_data.get("persona", ""),
        "followers": list_data.get("followers", 0),
        "tags": list_data.get("tags", []),
        "audienceTags": list_data.get("audience_tags", []),
        "quoteLow": list_data.get("quote_low", 0),
        "quoteHigh": list_data.get("quote_high", 0),
        "imageQuote": list_data.get("image_quote", 0),
        "videoQuote": list_data.get("video_quote", 0),
        "rebatePct": list_data.get("rebate_pct", 0),
        "exposureMedian": list_data.get("exposure_median", 0),
        "readMedian": list_data.get("read_median", 0),
        "interactionMedian": list_data.get("interaction_median", 0),
        "cpm": list_data.get("cpm", 0),
        "cpe": list_data.get("cpe", 0),
        "verticalScore": list_data.get("vertical_score", 0),
        "recentTitles": recent_titles,
        "titleStatus": title_status,
        "titleError": title_error,
        "titleStatusLabel": title_status_label(title_status, recent_titles, title_error),
        "intakeStatus": "已修复" if row["status"] == "resolved" else "待修复",
        "repairReason": row["reason"],
        "repairAction": row["action"],
        "sourceKeyword": row["source_keyword"],
        "sourceUrl": row["source_url"],
        "currentUrl": row["current_url"],
        "pageExcerpt": row["page_excerpt"],
        "screenshotPath": row["screenshot_path"],
        "note": row["note"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "resolvedAt": row["resolved_at"],
    }


@app.get("/api/database/creators")
async def list_database_creators(
    platform: str = Query("all"),
    limit: int = Query(2000, ge=1, le=10000),
) -> dict[str, Any]:
    where = []
    params: list[Any] = []
    if platform != "all":
        where.append("p.platform=?")
        params.append(platform)
    params.append(limit)
    sql = """
      select
        p.id profile_id,
        p.creator_id,
        p.platform,
        p.platform_id,
        p.home_url,
        p.followers,
        p.tags_json,
        p.audience_tags_json,
        p.quote_low,
        p.quote_high,
        p.image_quote,
        p.video_quote,
        p.supports_link,
        p.rebate_pct,
        p.created_at profile_created_at,
        cr.name,
        cr.primary_category,
        cr.persona,
        coalesce(m.exposure_median, 0) exposure_median,
        coalesce(m.read_median, 0) read_median,
        coalesce(m.interaction_median, 0) interaction_median,
        coalesce(m.cpm, 0) cpm,
        coalesce(m.cpe, 0) cpe,
        coalesce(m.vertical_score, 0) vertical_score,
        coalesce(m.recent_titles_json, '[]') recent_titles_json,
        coalesce(m.title_status, '') title_status,
        coalesce(m.title_error, '') title_error,
        coalesce(m.collected_at, p.created_at) collected_at,
        ml.source_type media_source_type,
        ml.note media_note,
        ml.source_project_id project_ids_raw,
        coalesce(pr.name, '') project_names_raw
      from media_library_entries ml
      join creator_platform_profiles p on p.id=ml.profile_id
      join creators cr on cr.id=p.creator_id
      left join creator_metrics m on m.profile_id=p.id
      left join projects pr on pr.id=ml.source_project_id
    """
    if where:
        sql += " where " + " and ".join(where)
    sql += """
      order by datetime(ml.updated_at) desc, datetime(coalesce(m.collected_at, p.created_at)) desc
      limit ?
    """
    with db() as conn:
        rows = []
        for raw in conn.execute(sql, params).fetchall():
            # sqlite group_concat cannot use a custom separator with distinct.
            item = dict(raw)
            item["project_ids"] = str(item.pop("project_ids_raw") or "").replace(",", "||")
            item["project_names"] = str(item.pop("project_names_raw") or "").replace(",", "||")
            rows.append(row_database_creator(item))
        repair_where = ["1=1"]
        repair_params: list[Any] = []
        if platform != "all":
            repair_where.append("platform=?")
            repair_params.append(platform)
        repair_params.append(limit)
        repair_rows = [
            row_repair_record(row)
            for row in conn.execute(
                "select * from creator_repair_records where "
                + " and ".join(repair_where)
                + " order by datetime(updated_at) desc limit ?",
                repair_params,
            ).fetchall()
        ]
    return {"creators": rows, "repairs": repair_rows}


@app.patch("/api/repair-records/{repair_id}/resolve")
async def resolve_repair_record(repair_id: str, req: RepairRecordUpdate) -> dict[str, Any]:
    platform_id = req.platform_id.strip()
    home_url = req.home_url.strip()
    with db() as conn:
        repair = conn.execute("select * from creator_repair_records where id=?", (repair_id,)).fetchone()
        if not repair:
            raise HTTPException(status_code=404, detail="待修复记录不存在")
        original_row = jload(repair["list_data_json"], {}) or {}
    if not is_valid_platform_id(platform_id, original_row.get("name") or ""):
        raise HTTPException(status_code=400, detail="小红书号不能为空，且不能用达人昵称代替")
    if not is_valid_pgy_home_url(home_url):
        raise HTTPException(status_code=400, detail="蒲公英主页必须是蒲公英达人详情链接")
    with db() as conn:
        repair = conn.execute("select * from creator_repair_records where id=?", (repair_id,)).fetchone()
        if not repair:
            raise HTTPException(status_code=404, detail="待修复记录不存在")
        row = jload(repair["list_data_json"], {}) or {}
        row["platform"] = repair["platform"]
        row["platform_id"] = platform_id
        row["home_url"] = home_url
        if req.recent_titles:
            row["recent_titles"] = req.recent_titles
            row["title_status"] = req.title_status or "collected"
            row["title_error"] = req.title_error
        else:
            row["title_status"] = req.title_status or row.get("title_status") or "missing"
            row["title_error"] = req.title_error or row.get("title_error") or "待补采标题"
        issues = required_field_issues(row)
        if issues:
            raise HTTPException(status_code=400, detail="、".join(issues))
        analysis = get_project_analysis(conn, repair["project_id"]) if repair["project_id"] else {}
        memories = get_memory_rows(conn, analysis) if repair["project_id"] else []
        candidate_exists = None
        if repair["candidate_id"]:
            candidate_exists = conn.execute(
                "select id from candidates where id=?",
                (repair["candidate_id"],),
            ).fetchone()
        candidate_id = repair["candidate_id"] if candidate_exists else ""
        if repair["project_id"] and not candidate_exists:
            candidate_id = insert_candidate_row(conn, repair["project_id"], row, analysis, memories)
            rec_target = max(1, min(80, int(analysis.get("reportCountMin") or analysis.get("recommendationTarget") or 25)))
            save_auto_recommendations(conn, repair["project_id"], rec_target)
        elif repair["profile_id"]:
            conn.execute(
                "update creator_platform_profiles set platform_id=?, home_url=? where id=?",
                (platform_id, home_url, repair["profile_id"]),
            )
        conn.execute(
            """
            update creator_repair_records
            set status='resolved', platform_id=?, home_url=?, list_data_json=?, title_status=?,
                title_error=?, note=?, updated_at=?, resolved_at=?
            where id=?
            """,
            (
                platform_id,
                home_url,
                jdump(row),
                row.get("title_status", ""),
                row.get("title_error", ""),
                req.note,
                now(),
                now(),
                repair_id,
            ),
        )
        updated = conn.execute("select * from creator_repair_records where id=?", (repair_id,)).fetchone()
    return {"repair": row_repair_record(updated), "candidateId": candidate_id}


def form_requirement_mode(analysis: dict[str, Any]) -> str:
    form_text = str(analysis.get("preferredForm") or "") + " " + " ".join(analysis.get("forms") or [])
    if not form_text.strip() or re.search(r"不限|待确认", form_text):
        return "any"
    if re.search(r"优先视频|视频合作|报备视频", form_text):
        return "video"
    has_video = "视频" in form_text
    has_image = "图文" in form_text
    if has_video and not has_image:
        return "video"
    if has_image and not has_video:
        return "image"
    return "any"


def recommendation_quote(row: dict[str, Any], analysis: dict[str, Any]) -> int:
    mode = form_requirement_mode(analysis)
    if mode == "video":
        return int(row.get("videoQuote") or row.get("quoteHigh") or 0)
    if mode == "image":
        return int(row.get("imageQuote") or row.get("quoteLow") or 0)
    return int(row.get("videoQuote") or row.get("quoteHigh") or row.get("imageQuote") or row.get("quoteLow") or 0)


def passes_recommendation_hard_filter(row: dict[str, Any], analysis: dict[str, Any]) -> bool:
    platforms = analysis.get("platforms") or ["pgy"]
    if platforms and row.get("platform") not in platforms:
        return False
    if not content_relevance_summary(row, analysis)["pass"]:
        return False
    quote = recommendation_quote(row, analysis)
    if not quote:
        return False
    budget_min = int(analysis.get("budgetMin") or 0)
    budget_max = int(analysis.get("budgetMax") or 0)
    if budget_min and quote < budget_min:
        return False
    if budget_max and quote > budget_max:
        return False
    metrics = analysis.get("metrics") or {}
    cpm_max = metric_limit(metrics.get("cpmMax"))
    cpe_max = metric_limit(metrics.get("cpeMax"))
    cpm = float(row.get("cpm") or 0)
    cpe = float(row.get("cpe") or 0)
    if cpm_max is not None and (not cpm or cpm > float(cpm_max)):
        return False
    if cpe_max is not None and (not cpe or cpe > float(cpe_max)):
        return False
    return True


def candidate_matches_analysis_tag(row: dict[str, Any], tag: str) -> bool:
    return bool(tag and tag in audience_tag_hits(row, [tag]))


def recommendation_issue_labels(row: dict[str, Any], analysis: dict[str, Any], checks: dict[str, bool]) -> list[str]:
    issues = []
    metrics = analysis.get("metrics") or {}
    cpm_max = metric_limit(metrics.get("cpmMax"))
    cpe_max = metric_limit(metrics.get("cpeMax"))
    cpm = float(row.get("cpm") or 0)
    cpe = float(row.get("cpe") or 0)
    required_tags = analysis.get("requiredAudienceTags") or []
    title_status = str(row.get("titleStatus") or "").strip()
    recent_titles = row.get("recentTitles") or []
    form_mode = form_requirement_mode(analysis)

    if not checks.get("platform", False):
        issues.append("平台不符")
    if not checks.get("content", False):
        issues.append("内容不相关")
    if not checks.get("quote", False):
        issues.append("视频报价缺失" if form_mode == "video" else ("图文报价缺失" if form_mode == "image" else "报价缺失"))
    if not checks.get("budgetMin", False):
        issues.append("低于预算下限")
    if not checks.get("budgetMax", False):
        issues.append("超过预算上限")
    if cpm_max is not None and not checks.get("cpm", False):
        issues.append("CPM缺失" if not cpm else "CPM超标")
    if cpe_max is not None and not checks.get("cpe", False):
        issues.append("CPE缺失" if not cpe else "CPE超标")
    if required_tags and not audience_tag_hits(row, required_tags):
        issues.append("标签待复核")
    if not recent_titles or title_status in {"missing", "failed"}:
        issues.append("标题待修复")
    return dedupe(issues)


def recommendation_gate_details(row: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    platforms = analysis.get("platforms") or ["pgy"]
    quote = recommendation_quote(row, analysis)
    budget_min = int(analysis.get("budgetMin") or 0)
    budget_max = int(analysis.get("budgetMax") or 0)
    metrics = analysis.get("metrics") or {}
    cpm_max = metric_limit(metrics.get("cpmMax"))
    cpe_max = metric_limit(metrics.get("cpeMax"))
    cpm = float(row.get("cpm") or 0)
    cpe = float(row.get("cpe") or 0)
    relevance = content_relevance_summary(row, analysis)

    checks = {
        "platform": (not platforms) or row.get("platform") in platforms,
        "content": relevance["pass"],
        "quote": bool(quote),
        "budgetMin": (not budget_min) or quote >= budget_min,
        "budgetMax": (not budget_max) or quote <= budget_max,
        "cpm": cpm_max is None or (bool(cpm) and cpm <= float(cpm_max)),
        "cpe": cpe_max is None or (bool(cpe) and cpe <= float(cpe_max)),
    }
    issues = recommendation_issue_labels(row, analysis, checks)
    strict_pass = all(checks.values())
    backup_pass = (
        not strict_pass
        and checks["platform"]
        and checks["content"]
        and checks["quote"]
        and checks["budgetMin"]
        and checks["budgetMax"]
    )
    tier = "strict" if strict_pass else ("backup" if backup_pass else "not_recommended")

    return {
        "quote": quote,
        "cpm": cpm,
        "cpe": cpe,
        "checks": checks,
        "content": {
            "domainTerms": relevance["terms"]["domain"],
            "actionTerms": relevance["terms"]["action"],
            "domainHits": relevance["domainHits"],
            "actionHits": relevance["actionHits"],
        },
        "issues": issues,
        "currentHardPass": passes_recommendation_hard_filter(row, analysis),
        "strictPass": strict_pass,
        "backupPass": backup_pass,
        "tier": tier,
        "tierLabel": {"strict": "严格达标", "backup": "可备选", "not_recommended": "不建议"}.get(tier, "不建议"),
        "tierIssues": [] if tier == "strict" else issues,
        "missing": {
            "platformId": not row.get("platformId") or row.get("platformId") == row.get("name"),
            "homeUrl": not row.get("homeUrl"),
            "audienceTags": not bool(row.get("audienceTags")),
            "recentTitles": not bool(row.get("recentTitles")),
            "cpm": cpm_max is not None and not bool(cpm),
            "cpe": cpe_max is not None and not bool(cpe),
        },
    }


def build_recommendation_diagnostics(conn: sqlite3.Connection, project_id: str) -> dict[str, Any]:
    analysis = get_project_analysis(conn, project_id)
    project = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    rows = [
        row_candidate(row)
        for row in conn.execute(
            candidate_query()
            + " where c.project_id=? and c.excluded=0 and c.status!='excluded' order by json_extract(c.scores_json,'$.total') desc",
            (project_id,),
        ).fetchall()
    ]
    recommendation_ids = {
        row["candidate_id"]
        for row in conn.execute("select candidate_id from recommendations where project_id=?", (project_id,)).fetchall()
    }
    repair_counts = {
        "pending": 0,
        "resolved": 0,
        "total": 0,
    }
    for row in conn.execute(
        "select status, count(*) count from creator_repair_records where project_id=? group by status",
        (project_id,),
    ).fetchall():
        repair_counts[row["status"]] = row["count"]
        repair_counts["total"] += row["count"]

    gates = [recommendation_gate_details(row, analysis) for row in rows]
    pass_counts = {
        "total": len(rows),
        "platform": sum(1 for gate in gates if gate["checks"]["platform"]),
        "content": sum(1 for gate in gates if gate["checks"]["content"]),
        "budgetMin": sum(1 for gate in gates if gate["checks"]["budgetMin"]),
        "budgetMax": sum(1 for gate in gates if gate["checks"]["budgetMax"]),
        "budgetRange": sum(1 for gate in gates if gate["checks"]["budgetMin"] and gate["checks"]["budgetMax"]),
        "cpm": sum(1 for gate in gates if gate["checks"]["cpm"]),
        "cpe": sum(1 for gate in gates if gate["checks"]["cpe"]),
        "currentHard": sum(1 for gate in gates if gate["currentHardPass"]),
        "strict": sum(1 for gate in gates if gate["strictPass"]),
    }
    strong_count = pass_counts["strict"]
    backup_count = sum(
        1
        for gate in gates
        if gate["backupPass"]
    )
    recommendation_buckets = {
        "strong": strong_count,
        "backup": backup_count,
        "notRecommended": max(0, len(rows) - strong_count - backup_count),
    }

    failure_groups: dict[str, int] = {}
    missing_counts = {"platformId": 0, "homeUrl": 0, "audienceTags": 0, "recentTitles": 0, "cpm": 0, "cpe": 0}
    for gate in gates:
        label = "通过严格条件" if gate["strictPass"] else "、".join(gate["issues"] or ["未归类"])
        failure_groups[label] = failure_groups.get(label, 0) + 1
        for key, missing in gate["missing"].items():
            if missing:
                missing_counts[key] += 1

    required_tags = analysis.get("requiredAudienceTags") or []
    tag_coverage = [
        {
            "tag": tag,
            "count": sum(1 for row in rows if candidate_matches_analysis_tag(row, tag)),
            "strictCount": sum(
                1
                for row, gate in zip(rows, gates)
                if gate["strictPass"] and candidate_matches_analysis_tag(row, tag)
            ),
        }
        for tag in required_tags
    ]

    top_candidates = []
    for row, gate in zip(rows[:30], gates[:30]):
        top_candidates.append(
            {
                "id": row["id"],
                "name": row["name"],
                "platform": row["platform"],
                "quote": gate["quote"],
                "cpm": gate["cpm"],
                "cpe": gate["cpe"],
                "score": row.get("scores", {}).get("total", 0),
                "tags": row.get("tags", []),
                "audienceTags": row.get("audienceTags", []),
                "contentHits": [*gate["content"]["domainHits"], *gate["content"]["actionHits"]],
                "currentHardPass": gate["currentHardPass"],
                "strictPass": gate["strictPass"],
                "backupPass": gate["backupPass"],
                "recommendationTier": gate["tier"],
                "tierLabel": gate["tierLabel"],
                "tierIssues": gate["tierIssues"],
                "recommended": row["id"] in recommendation_ids,
                "issues": gate["issues"],
            }
        )

    return {
        "project": {"id": project["id"], "name": project["name"], "brand": project["brand"], "status": project["status"]},
        "analysis": {
            "platforms": analysis.get("platforms") or [],
            "budgetMin": analysis.get("budgetMin") or 0,
            "budgetMax": analysis.get("budgetMax") or 0,
            "target": analysis.get("reportCountMin") or analysis.get("recommendationTarget") or 0,
            "requiredAudienceTags": required_tags,
            "metrics": analysis.get("metrics") or {},
            "preferredForm": analysis.get("preferredForm") or "",
        },
        "passCounts": pass_counts,
        "failureGroups": sorted(
            [{"reason": key, "count": value} for key, value in failure_groups.items()],
            key=lambda item: item["count"],
            reverse=True,
        ),
        "missingData": missing_counts,
        "repairCounts": repair_counts,
        "recommendationBuckets": recommendation_buckets,
        "tagCoverage": tag_coverage,
        "topCandidates": top_candidates,
        "recommendationCount": len(recommendation_ids),
    }


@app.get("/api/projects/{project_id}/candidates")
async def list_candidates(
    project_id: str,
    platform: str = Query("all"),
    keyword: str = Query(""),
    hide_excluded: bool = Query(False),
) -> dict[str, Any]:
    where = ["c.project_id=?"]
    params: list[Any] = [project_id]
    if platform != "all":
        where.append("c.platform=?")
        params.append(platform)
    if hide_excluded:
        where.append("c.excluded=0")
    sql = candidate_query() + " where " + " and ".join(where) + " order by json_extract(c.scores_json,'$.total') desc"
    with db() as conn:
        rows = [row_candidate(row) for row in conn.execute(sql, params).fetchall()]
    if keyword:
        needle = keyword.lower()
        rows = [
            row
            for row in rows
            if needle
            in " ".join(
                [
                    row["name"],
                    row["platformId"],
                    row["persona"],
                    " ".join(row["tags"]),
                    " ".join(row["audienceTags"]),
                    row["reason"],
                ]
            ).lower()
        ]
    return {"candidates": rows}


@app.patch("/api/candidates/{candidate_id}/status")
async def update_candidate_status(candidate_id: str, req: CandidateStatusUpdate) -> dict[str, Any]:
    sets = []
    params: list[Any] = []
    if req.locked is not None:
        sets.append("locked=?")
        params.append(1 if req.locked else 0)
    if req.excluded is not None:
        sets.append("excluded=?")
        params.append(1 if req.excluded else 0)
        sets.append("status=?")
        params.append("excluded" if req.excluded else "active")
    if not sets:
        raise HTTPException(status_code=400, detail="没有需要更新的字段")
    params.append(candidate_id)
    with db() as conn:
        conn.execute(f"update candidates set {','.join(sets)} where id=?", params)
        row = conn.execute(candidate_query() + " where c.id=?", (candidate_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="候选不存在")
    return {"candidate": row_candidate(row)}


def save_auto_recommendations(conn: sqlite3.Connection, project_id: str, target: int) -> list[dict[str, Any]]:
    analysis = get_project_analysis(conn, project_id)
    rows = [
        row_candidate(row)
        for row in conn.execute(
            candidate_query()
            + " where c.project_id=? and c.excluded=0 and c.status!='excluded' order by json_extract(c.scores_json,'$.total') desc",
            (project_id,),
        ).fetchall()
    ]
    conn.execute("delete from recommendations where project_id=?", (project_id,))
    gates = {row["id"]: recommendation_gate_details(row, analysis) for row in rows}
    strict_rows = [row for row in rows if gates[row["id"]]["tier"] == "strict"]
    backup_rows = [row for row in rows if gates[row["id"]]["tier"] == "backup"]
    if not strict_rows and not backup_rows:
        conn.execute("update projects set status='recommended', updated_at=? where id=?", (now(), project_id))
        return []

    required_tags = analysis.get("requiredAudienceTags") or []
    selected: list[dict[str, Any]] = []
    used_ids = set()

    def append_with_coverage(pool: list[dict[str, Any]]) -> None:
        for tag in required_tags:
            if len(selected) >= target:
                return
            if any(candidate_matches_analysis_tag(row, tag) for row in selected):
                continue
            match = next((row for row in pool if row["id"] not in used_ids and candidate_matches_analysis_tag(row, tag)), None)
            if match:
                selected.append(match)
                used_ids.add(match["id"])
        for row in pool:
            if len(selected) >= target:
                return
            if row["id"] not in used_ids:
                selected.append(row)
                used_ids.add(row["id"])

    append_with_coverage(strict_rows)
    if len(selected) < target:
        append_with_coverage(backup_rows)

    for index, row in enumerate(selected[:target], start=1):
        gate = gates[row["id"]]
        tier_label = gate["tierLabel"]
        tier_issues = "、".join(gate["tierIssues"])
        reason = f"{tier_label}｜{row['reason']}"
        risk = row["risk"]
        if gate["tier"] == "backup":
            risk = "；".join([part for part in [risk if risk != "暂无明显硬性风险" else "", f"可备选缺口：{tier_issues or '需人工复核'}"] if part])
        conn.execute(
            """
            insert into recommendations(id,project_id,candidate_id,rank,status,reason,risk,locked,created_at)
            values(?,?,?,?,?,?,?,?,?)
            """,
            (
                make_id("rec"),
                project_id,
                row["id"],
                index,
                "pending",
                reason,
                risk or "暂无明显硬性风险",
                0,
                now(),
            ),
        )
    conn.execute("update projects set status='recommended', updated_at=? where id=?", (now(), project_id))
    return get_recommendations_for_project(conn, project_id)


@app.post("/api/projects/{project_id}/recommendations/auto")
async def auto_recommend(project_id: str, target: int = Query(10, ge=1, le=80)) -> dict[str, Any]:
    with db() as conn:
        recs = save_auto_recommendations(conn, project_id, target)
    return {"recommendations": recs}


@app.get("/api/projects/{project_id}/recommendation-diagnostics")
async def recommendation_diagnostics(project_id: str) -> dict[str, Any]:
    with db() as conn:
        return build_recommendation_diagnostics(conn, project_id)


def get_recommendations_for_project(conn: sqlite3.Connection, project_id: str) -> list[dict[str, Any]]:
    analysis = get_project_analysis(conn, project_id)
    rows = conn.execute(
        """
        select r.id rec_id,r.rank,r.status rec_status,r.reason rec_reason,r.risk rec_risk,r.locked rec_locked,r.created_at rec_created_at,
               q.*
        from recommendations r
        join (
        """
        + candidate_query()
        + """
        ) q on q.id=r.candidate_id
        where r.project_id=?
        order by r.rank
        """,
        (project_id,),
    ).fetchall()
    recs = []
    for row in rows:
        item = row_candidate(row)
        gate = recommendation_gate_details(item, analysis)
        item["recommendationId"] = row["rec_id"]
        item["rank"] = row["rank"]
        item["recommendationStatus"] = row["rec_status"]
        item["recommendationReason"] = row["rec_reason"]
        item["recommendationRisk"] = row["rec_risk"]
        item["recommendationLocked"] = bool(row["rec_locked"])
        item["recommendationCreatedAt"] = row["rec_created_at"]
        item["recommendationTier"] = gate["tier"]
        item["tierLabel"] = gate["tierLabel"]
        item["tierIssues"] = gate["tierIssues"]
        item["strictPass"] = gate["strictPass"]
        item["backupPass"] = gate["backupPass"]
        recs.append(item)
    return recs


@app.get("/api/projects/{project_id}/recommendations")
async def list_recommendations(project_id: str) -> dict[str, Any]:
    with db() as conn:
        recs = get_recommendations_for_project(conn, project_id)
    return {"recommendations": recs}


@app.patch("/api/recommendations/{recommendation_id}/status")
async def update_recommendation_status(recommendation_id: str, req: RecommendationStatusUpdate) -> dict[str, Any]:
    sets = []
    params: list[Any] = []
    if req.locked is not None:
        sets.append("locked=?")
        params.append(1 if req.locked else 0)
    if req.status is not None:
        sets.append("status=?")
        params.append(req.status)
    if not sets:
        raise HTTPException(status_code=400, detail="没有需要更新的字段")
    params.append(recommendation_id)
    with db() as conn:
        conn.execute(f"update recommendations set {','.join(sets)} where id=?", params)
        if req.locked:
            row = conn.execute(
                """
                select r.project_id, c.profile_id
                from recommendations r
                join candidates c on c.id=r.candidate_id
                where r.id=?
                """,
                (recommendation_id,),
            ).fetchone()
            if row:
                mark_media_library_profile(
                    conn,
                    row["profile_id"],
                    row["project_id"],
                    "locked_recommendation",
                    "推荐名单锁定后沉淀",
                )
    return {"ok": True}


@app.post("/api/projects/{project_id}/feedback")
async def create_feedback(project_id: str, req: FeedbackCreate) -> dict[str, Any]:
    feedback_id = make_id("fb")
    with db() as conn:
        project = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        analysis = jload(project["analysis_json"], {})
        conn.execute(
            """
            insert into feedback(id,project_id,recommendation_id,creator_name,usability,client_passed,keyword_accuracy,replaced_reason,note,created_at)
            values(?,?,?,?,?,?,?,?,?,?)
            """,
            (feedback_id, project_id, "", "", req.usability, req.client_passed, req.keyword_accuracy, req.replaced_reason, req.note, now()),
        )
        memory_items = feedback_to_memories(project_id, feedback_id, analysis, req)
        for item in memory_items:
            conn.execute(
                """
                insert into memories(id,scope,memory_key,value,weight,source_project_id,source_feedback_id,created_at)
                values(?,?,?,?,?,?,?,?)
                """,
                (make_id("mem"), item["scope"], item["key"], item["value"], item["weight"], project_id, feedback_id, now()),
            )
        if req.usability in {"可用", "部分可用"} or req.client_passed in {"通过", "部分通过"}:
            mark_recommendations_as_media(
                conn,
                project_id,
                get_recommendations_for_project(conn, project_id),
                "positive_feedback",
                "反馈可用或客户通过后沉淀",
            )
        conn.execute("update projects set status='feedback_saved', updated_at=? where id=?", (now(), project_id))
        feedback = conn.execute("select * from feedback where id=?", (feedback_id,)).fetchone()
    return {"feedback": dict(feedback), "memoriesCreated": len(memory_items)}


def feedback_to_memories(project_id: str, feedback_id: str, analysis: dict[str, Any], req: FeedbackCreate) -> list[dict[str, Any]]:
    brand = analysis.get("brand") or "未知品牌"
    platforms = "、".join(analysis.get("platforms") or [])
    keywords = "、".join(analysis.get("keywords") or [])
    items = [
        {
            "scope": "brand",
            "key": f"{brand}:选号反馈",
            "value": f"{brand} 项目反馈：推荐可用性={req.usability}，客户通过={req.client_passed}，关键词={req.keyword_accuracy}。{req.note}",
            "weight": 1.0 if req.client_passed in {"通过", "部分通过"} else -0.2,
        },
        {
            "scope": "keyword",
            "key": f"{brand}:关键词:{keywords}",
            "value": f"关键词表现：{req.keyword_accuracy}。替换/排除原因：{req.replaced_reason or '无'}",
            "weight": 0.8 if req.keyword_accuracy == "精准" else -0.6,
        },
        {
            "scope": "platform",
            "key": f"{brand}:平台:{platforms}",
            "value": f"平台经验：{platforms}，可用性={req.usability}，客户结果={req.client_passed}",
            "weight": 0.5,
        },
    ]
    return items


@app.get("/api/projects/{project_id}/feedback")
async def list_feedback(project_id: str) -> dict[str, Any]:
    with db() as conn:
        rows = [dict(row) for row in conn.execute("select * from feedback where project_id=? order by created_at desc", (project_id,)).fetchall()]
    return {"feedback": rows}


@app.get("/api/memories")
async def list_memories(q: str = Query("")) -> dict[str, Any]:
    with db() as conn:
        if q:
            rows = conn.execute(
                "select * from memories where memory_key like ? or value like ? order by created_at desc limit 200",
                (f"%{q}%", f"%{q}%"),
            ).fetchall()
        else:
            rows = conn.execute("select * from memories order by created_at desc limit 200").fetchall()
    return {"memories": [dict(row) for row in rows]}


@app.delete("/api/memories/{memory_id}")
async def delete_memory(memory_id: str) -> dict[str, Any]:
    with db() as conn:
        conn.execute("delete from memories where id=?", (memory_id,))
    return {"ok": True}


def export_row(candidate: dict[str, Any], rank: Optional[int] = None) -> dict[str, Any]:
    titles = candidate.get("recentTitles") or []
    scores = candidate.get("scores") or {}
    quote_for_unit = int(candidate.get("videoQuote") or candidate.get("imageQuote") or candidate.get("quoteHigh") or 0)
    read_median = int(candidate.get("readMedian") or 0)
    interaction_median = int(candidate.get("interactionMedian") or 0)
    read_unit_price = round(quote_for_unit / read_median, 2) if quote_for_unit and read_median else ""
    interaction_unit_price = candidate.get("cpe") or (round(quote_for_unit / interaction_median, 2) if quote_for_unit and interaction_median else "")
    tier = candidate.get("recommendationTier") or candidate.get("tier") or ""
    tier_label = candidate.get("tierLabel") or {"strict": "严格达标", "backup": "可备选", "not_recommended": "不建议"}.get(tier, "")
    tier_issues = candidate.get("tierIssues") or candidate.get("issues") or []
    return {
        "推荐排序": rank or "",
        "推荐分层": tier_label,
        "未达标原因": "、".join(tier_issues),
        "是否严格达标": "是" if tier == "strict" or candidate.get("strictPass") else "否",
        "达人昵称": candidate.get("name", ""),
        "平台": candidate.get("platformLabel", ""),
        "小红书号": candidate.get("platformId", ""),
        "蒲公英主页链接": candidate.get("homeUrl", ""),
        "入库状态": candidate.get("intakeStatus", "正式入库"),
        "标题状态": candidate.get("titleStatusLabel") or title_status_label(
            candidate.get("titleStatus", ""),
            titles,
            candidate.get("titleError", ""),
        ),
        "修复原因": candidate.get("repairReason", ""),
        "粉丝数(万)": candidate.get("followers", ""),
        "图文报价": candidate.get("imageQuote", ""),
        "视频报价": candidate.get("videoQuote", ""),
        "返点": candidate.get("rebatePct", ""),
        "标签": "、".join(candidate.get("tags") or []),
        "人群标签": "、".join(candidate.get("audienceTags") or []),
        "曝光中位数": candidate.get("exposureMedian", ""),
        "阅读中位数": candidate.get("readMedian", ""),
        "互动中位数": candidate.get("interactionMedian", ""),
        "CPM": candidate.get("cpm", ""),
        "阅读单价": read_unit_price,
        "互动单价": interaction_unit_price,
        "预算匹配分": scores.get("budget", ""),
        "内容相关分": scores.get("content", ""),
        "数据表现分": scores.get("performance", ""),
        "历史反馈分": scores.get("history", ""),
        "垂直度分": scores.get("vertical", ""),
        "综合推荐分": scores.get("total", ""),
        "最近50条标题": " | ".join(titles[:50]),
    }


def with_recommendation_tier(candidate: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    gate = recommendation_gate_details(candidate, analysis)
    item = dict(candidate)
    item["recommendationTier"] = gate["tier"]
    item["tierLabel"] = gate["tierLabel"]
    item["tierIssues"] = gate["tierIssues"]
    item["strictPass"] = gate["strictPass"]
    item["backupPass"] = gate["backupPass"]
    return item


@app.get("/api/projects/{project_id}/export")
async def export_project(project_id: str, scope: str = Query("all", pattern="^(strict|backup|all)$")) -> Response:
    with db() as conn:
        project = conn.execute("select * from projects where id=?", (project_id,)).fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        analysis = get_project_analysis(conn, project_id)
        candidates = [
            with_recommendation_tier(row_candidate(row), analysis)
            for row in conn.execute(
                candidate_query() + " where c.project_id=? order by json_extract(c.scores_json,'$.total') desc",
                (project_id,),
            ).fetchall()
        ]
        recs = get_recommendations_for_project(conn, project_id)
        if scope != "all":
            recs = [item for item in recs if item.get("recommendationTier") == scope]
        mark_recommendations_as_media(conn, project_id, recs, "exported_recommendation", f"导出推荐名单：{scope}")
        repair_rows = [
            row_repair_record(row)
            for row in conn.execute(
                "select * from creator_repair_records where project_id=? order by datetime(updated_at) desc",
                (project_id,),
            ).fetchall()
        ]
        feedback_rows = [dict(row) for row in conn.execute("select * from feedback where project_id=? order by created_at desc", (project_id,)).fetchall()]
        memory_rows = [dict(row) for row in conn.execute("select * from memories where source_project_id=? order by created_at desc", (project_id,)).fetchall()]

    if not candidates and not recs and not repair_rows:
        raise HTTPException(status_code=400, detail="没有可导出的候选数据")

    rec_sheet = [export_row(item, item.get("rank")) for item in recs]
    candidate_sheet = [export_row(item) for item in candidates]
    repair_sheet = [export_row(item) for item in repair_rows]
    feedback_sheet = [
        {
            "时间": row["created_at"],
            "推荐可用性": row["usability"],
            "客户是否通过": row["client_passed"],
            "关键词是否精准": row["keyword_accuracy"],
            "替换/排除原因": row["replaced_reason"],
            "备注": row["note"],
        }
        for row in feedback_rows
    ]
    memory_sheet = [
        {
            "时间": row["created_at"],
            "范围": row["scope"],
            "记忆键": row["memory_key"],
            "记忆内容": row["value"],
            "权重": row["weight"],
        }
        for row in memory_rows
    ]
    recommendation_sheet = rec_sheet if (rec_sheet or scope != "all") else candidate_sheet[:10]
    workbook = make_xlsx(
        {
            "推荐名单": recommendation_sheet,
            "统一候选池": candidate_sheet,
            "待修复账号": repair_sheet,
            "反馈记录": feedback_sheet,
            "记忆沉淀": memory_sheet,
        }
    )
    filename = f"{project['brand'] or project['name']}-选号结果.xlsx"
    safe_name = re.sub(r'[\\/:*?"<>|]+', "_", filename)
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(safe_name)}"}
    return Response(
        content=workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


def parse_xlsx_rows(raw: bytes) -> list[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(raw), "r") as zf:
        sheet_path = choose_xlsx_sheet_path(zf)
        shared_strings = parse_xlsx_shared_strings(zf)
        sheet_xml_bytes = zf.read(sheet_path)
    root = ET.fromstring(sheet_xml_bytes)
    rows: list[list[str]] = []
    for row_el in root.findall(".//{*}sheetData/{*}row"):
        values: dict[int, str] = {}
        max_index = -1
        for cell in row_el.findall("{*}c"):
            col_index = xlsx_col_index(cell.attrib.get("r", ""))
            max_index = max(max_index, col_index)
            values[col_index] = xlsx_cell_text(cell, shared_strings)
        if max_index >= 0:
            rows.append([values.get(index, "") for index in range(max_index + 1)])
    rows = [row for row in rows if any(str(cell).strip() for cell in row)]
    if not rows:
        return []
    headers = [str(cell).strip() for cell in rows[0]]
    parsed: list[dict[str, str]] = []
    for row in rows[1:]:
        item = {
            header: str(row[index]).strip() if index < len(row) else ""
            for index, header in enumerate(headers)
            if header
        }
        if any(item.values()):
            parsed.append(item)
    return parsed


def choose_xlsx_sheet_path(zf: zipfile.ZipFile) -> str:
    names = set(zf.namelist())
    if "xl/worksheets/sheet1.xml" in names:
        return "xl/worksheets/sheet1.xml"
    for name in sorted(names):
        if name.startswith("xl/worksheets/") and name.endswith(".xml"):
            return name
    raise ValueError("没有找到工作表")


def parse_xlsx_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for item in root.findall("{*}si"):
        texts = [node.text or "" for node in item.findall(".//{*}t")]
        values.append("".join(texts))
    return values


def xlsx_col_index(ref: str) -> int:
    letters = re.sub(r"[^A-Z]", "", ref.upper())
    index = 0
    for char in letters:
        index = index * 26 + (ord(char) - ord("A") + 1)
    return max(index - 1, 0)


def xlsx_cell_text(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t", "")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//{*}t"))
    value_el = cell.find("{*}v")
    value = value_el.text if value_el is not None else ""
    if cell_type == "s" and value != "":
        index = int(float(value))
        return shared_strings[index] if 0 <= index < len(shared_strings) else ""
    return value or ""


def cell_ref(col: int, row: int) -> str:
    name = ""
    while col:
        col, rem = divmod(col - 1, 26)
        name = chr(65 + rem) + name
    return f"{name}{row}"


def sheet_xml(rows: list[dict[str, Any]]) -> str:
    headers = list(rows[0].keys()) if rows else ["暂无数据"]
    all_rows = [headers] + [[row.get(header, "") for header in headers] for row in rows]
    xml_rows = []
    for row_index, values in enumerate(all_rows, start=1):
        cells = []
        for col_index, value in enumerate(values, start=1):
            ref = cell_ref(col_index, row_index)
            if isinstance(value, (int, float)) and not isinstance(value, bool) and value != "":
                cells.append(f'<c r="{ref}"><v>{value}</v></c>')
            else:
                text = html.escape(str(value or ""), quote=False)
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>')
        xml_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    last_ref = cell_ref(len(headers), max(1, len(all_rows)))
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<dimension ref="A1:{last_ref}"/>'
        "<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>"
        "<sheetData>"
        + "".join(xml_rows)
        + "</sheetData>"
        f'<autoFilter ref="A1:{cell_ref(len(headers), 1)}"/>'
        "</worksheet>"
    )


def make_xlsx(sheets: dict[str, list[dict[str, Any]]]) -> bytes:
    output = io.BytesIO()
    sheet_items = list(sheets.items())
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
"""
            + "".join(
                f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                for i in range(1, len(sheet_items) + 1)
            )
            + "\n</Types>",
        )
        zf.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""",
        )
        zf.writestr(
            "xl/workbook.xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
"""
            + "".join(
                f'<sheet name="{html.escape(name[:31])}" sheetId="{i}" r:id="rId{i}"/>'
                for i, (name, _) in enumerate(sheet_items, start=1)
            )
            + "\n</sheets></workbook>",
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
"""
            + "".join(
                f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
                for i in range(1, len(sheet_items) + 1)
            )
            + "\n</Relationships>",
        )
        for i, (_, rows) in enumerate(sheet_items, start=1):
            zf.writestr(f"xl/worksheets/sheet{i}.xml", sheet_xml(rows))
    return output.getvalue()


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


if __name__ == "__main__":
    import uvicorn

    print("萌力互动本地 AI 选号系统启动中")
    print(f"数据文件: {DB_PATH}")
    print("访问地址: http://127.0.0.1:8890")
    uvicorn.run(app, host="127.0.0.1", port=8890, log_level="info")
