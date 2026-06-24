"""
萌力互动 · 全量后端 API
替代 Supabase，提供认证 + 业务 + 文件存储
"""
from __future__ import annotations
import os, json, uuid, hashlib, time, base64, re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

# ===== 配置 =====
DATABASE_URL = os.environ.get("DATABASE_URL", "")
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="萌力互动 API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 数据库连接 =====
def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

@contextmanager
def db_conn():
    conn = get_db()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# ===== 密码哈希（bcrypt 替代方案，纯 Python） =====
import hmac, struct

def _hash_password(password: str) -> str:
    """SHA-256 + salt 密码哈希"""
    salt = uuid.uuid4().hex[:16]
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"$pbkdf2${salt}${h.hex()}"

def _verify_password(password: str, hashed: str) -> bool:
    """验证密码"""
    if hashed.startswith("$pbkdf2$"):
        parts = hashed.split("$")
        salt = parts[2]
        expected = parts[3]
        h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return hmac.compare_digest(h.hex(), expected)
    # 兼容 bcrypt 格式（旧数据）
    return False

def _gen_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex

# ===== 请求模型 =====
class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str = ""
    position: str = ""

class LoginRequest(BaseModel):
    email: str
    password: str

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    position: Optional[str] = None

# ===== 认证中间件 =====
def get_current_user(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(401, "未登录")
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM user_profiles WHERE session_token = %s", (token,))
            user = cur.fetchone()
    if not user:
        raise HTTPException(401, "会话已过期，请重新登录")
    return dict(user)

def require_approved(user):
    if user["status"] != "approved":
        raise HTTPException(403, "账号待审批")

def require_admin(user):
    if user["role"] != "admin":
        raise HTTPException(403, "需要管理员权限")

# ===== 认证 API =====
@app.post("/auth/register")
def register(req: RegisterRequest):
    if not req.email or not req.password:
        raise HTTPException(400, "邮箱和密码不能为空")
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM user_profiles WHERE email = %s", (req.email,))
            if cur.fetchone():
                raise HTTPException(400, "邮箱已注册")
            cur.execute(
                """INSERT INTO user_profiles (email, password_hash, display_name, position, status)
                   VALUES (%s, %s, %s, %s, 'pending') RETURNING id, email, display_name, role, status""",
                (req.email, _hash_password(req.password), req.display_name, req.position)
            )
            user = cur.fetchone()
    return {"user": dict(user), "message": "注册成功，等待管理员审批"}

@app.post("/auth/login")
def login(req: LoginRequest):
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM user_profiles WHERE email = %s", (req.email,))
            user = cur.fetchone()
    if not user or not _verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "邮箱或密码错误")
    if not user["is_active"]:
        raise HTTPException(403, "账号已被禁用")
    token = _gen_token()
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET session_token = %s WHERE id = %s", (token, user["id"]))
    return {
        "token": token,
        "user": {
            "id": str(user["id"]),
            "email": user["email"],
            "display_name": user["display_name"],
            "role": user["role"],
            "position": user["position"],
            "status": user["status"],
        }
    }

@app.post("/auth/logout")
def logout(request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET session_token = '' WHERE id = %s", (user["id"],))
    return {"message": "已退出"}

@app.get("/auth/me")
def get_me(request: Request):
    user = get_current_user(request)
    return {
        "id": str(user["id"]),
        "email": user["email"],
        "display_name": user["display_name"],
        "role": user["role"],
        "position": user["position"],
        "status": user["status"],
        "is_active": user["is_active"],
    }

@app.put("/auth/profile")
def update_profile(req: UpdateProfileRequest, request: Request):
    user = get_current_user(request)
    updates = []
    values = []
    if req.display_name is not None:
        updates.append("display_name = %s")
        values.append(req.display_name)
    if req.position is not None:
        updates.append("position = %s")
        values.append(req.position)
    if not updates:
        return {"message": "无更新"}
    values.append(user["id"])
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE user_profiles SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s", values)
    return {"message": "更新成功"}

# ===== 管理员 API =====
@app.get("/admin/users")
def list_users(request: Request):
    user = get_current_user(request)
    require_admin(user)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, display_name, role, position, is_active, status, created_at FROM user_profiles ORDER BY created_at DESC")
            users = cur.fetchall()
    return {"users": [dict(u) for u in users]}

@app.post("/admin/users")
def create_user(request: Request, body: dict):
    user = get_current_user(request)
    require_admin(user)
    email = body.get("email", "")
    password = body.get("password", "")
    display_name = body.get("display_name", "")
    role = body.get("role", "user")
    position = body.get("position", "")
    status = body.get("status", "approved")
    if not email or not password:
        raise HTTPException(400, "邮箱和密码不能为空")
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM user_profiles WHERE email = %s", (email,))
            if cur.fetchone():
                raise HTTPException(400, "邮箱已注册")
            cur.execute(
                """INSERT INTO user_profiles (email, password_hash, display_name, role, position, status, is_active)
                   VALUES (%s, %s, %s, %s, %s, %s, true) RETURNING id""",
                (email, _hash_password(password), display_name, role, position, status)
            )
            new_user = cur.fetchone()
            # 授予所有权限
            cur.execute("SELECT feature_key FROM feature_permissions")
            features = cur.fetchall()
            for f in features:
                cur.execute("INSERT INTO user_feature_permissions (user_id, feature_key) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                           (new_user["id"], f["feature_key"]))
    return {"message": "创建成功", "user_id": str(new_user["id"])}

@app.put("/admin/users/{user_id}/approve")
def approve_user(user_id: str, request: Request):
    admin = get_current_user(request)
    require_admin(admin)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET status = 'approved', approved_at = NOW(), approved_by = %s WHERE id = %s", (admin["id"], user_id))
            # 授予所有权限
            cur.execute("SELECT feature_key FROM feature_permissions")
            for f in cur.fetchall():
                cur.execute("INSERT INTO user_feature_permissions (user_id, feature_key) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                           (user_id, f["feature_key"]))
    return {"message": "已审批通过"}

@app.put("/admin/users/{user_id}/reject")
def reject_user(user_id: str, request: Request):
    admin = get_current_user(request)
    require_admin(admin)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET status = 'rejected' WHERE id = %s", (user_id,))
    return {"message": "已拒绝"}

@app.put("/admin/users/{user_id}/toggle")
def toggle_user(user_id: str, request: Request):
    admin = get_current_user(request)
    require_admin(admin)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET is_active = NOT is_active WHERE id = %s", (user_id,))
    return {"message": "已切换状态"}

@app.delete("/admin/users/{user_id}")
def delete_user(user_id: str, request: Request):
    admin = get_current_user(request)
    require_admin(admin)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_profiles WHERE id = %s", (user_id,))
    return {"message": "已删除"}

@app.put("/admin/users/{user_id}/permissions")
def update_permissions(user_id: str, body: dict, request: Request):
    admin = get_current_user(request)
    require_admin(admin)
    permissions = body.get("permissions", [])
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_feature_permissions WHERE user_id = %s", (user_id,))
            for perm in permissions:
                cur.execute("INSERT INTO user_feature_permissions (user_id, feature_key) VALUES (%s, %s)", (user_id, perm))
    return {"message": "权限已更新"}

@app.get("/admin/users/{user_id}/permissions")
def get_user_permissions(user_id: str, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT feature_key FROM user_feature_permissions WHERE user_id = %s", (user_id,))
            perms = [r["feature_key"] for r in cur.fetchall()]
    return {"permissions": perms}

# ===== 权限 API =====
@app.get("/permissions/features")
def list_features(request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM feature_permissions ORDER BY id")
            features = cur.fetchall()
    return {"features": [dict(f) for f in features]}

@app.get("/permissions/my")
def my_permissions(request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT feature_key FROM user_feature_permissions WHERE user_id = %s", (user["id"],))
            perms = [r["feature_key"] for r in cur.fetchall()]
    return {"permissions": perms}

# ===== 生成历史 API =====
@app.get("/history")
def list_history(request: Request, gen_type: str = None, limit: int = 50):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            if gen_type and gen_type != 'all':
                cur.execute("SELECT * FROM generation_history WHERE user_id = %s AND gen_type = %s AND deleted_at IS NULL ORDER BY created_at DESC LIMIT %s",
                           (user["id"], gen_type, limit))
            else:
                cur.execute("SELECT * FROM generation_history WHERE user_id = %s AND deleted_at IS NULL ORDER BY created_at DESC LIMIT %s",
                           (user["id"], limit))
            rows = cur.fetchall()
    return {"history": [dict(r) for r in rows]}

@app.post("/history")
def create_history(body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO generation_history (user_id, gen_type, input_params, output_content, rating, version, parent_id, root_id, original_content, operation_type)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (user["id"], body.get("gen_type"), json.dumps(body.get("input_params", {})),
                 body.get("output_content"), body.get("rating"),
                 body.get("version", 1), body.get("parent_id"), body.get("root_id"),
                 body.get("original_content"), body.get("operation_type", "generate"))
            )
            new_id = cur.fetchone()["id"]
            # 初次生成时设置 root_id
            if body.get("version") == 1 and not body.get("root_id"):
                cur.execute("UPDATE generation_history SET root_id = %s WHERE id = %s", (new_id, new_id))
    return {"id": new_id}

@app.put("/history/{history_id}/rating")
def update_rating(history_id: int, body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE generation_history SET rating = %s WHERE id = %s AND user_id = %s",
                       (body.get("rating"), history_id, user["id"]))
    return {"message": "评分已更新"}

@app.put("/history/{history_id}/soft-delete")
def soft_delete_history(history_id: int, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE generation_history SET deleted_at = NOW() WHERE id = %s AND user_id = %s",
                       (history_id, user["id"]))
    return {"message": "已删除"}

@app.get("/history/high-rated")
def get_high_rated(request: Request, gen_type: str = "copywriting", limit: int = 3):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM generation_history WHERE user_id = %s AND gen_type = %s AND rating >= 4 AND deleted_at IS NULL ORDER BY rating DESC, created_at DESC LIMIT %s",
                       (user["id"], gen_type, limit))
            rows = cur.fetchall()
    return {"examples": [dict(r) for r in rows]}

# ===== 素材库 API =====
@app.get("/assets")
def list_assets(request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM user_assets WHERE user_id = %s ORDER BY created_at DESC", (user["id"],))
            rows = cur.fetchall()
    return {"assets": [dict(r) for r in rows]}

@app.post("/assets")
def create_asset(body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO user_assets (user_id, type, title, content, rating) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (user["id"], body.get("type"), body.get("title"), body.get("content"), body.get("rating"))
            )
            new_id = cur.fetchone()["id"]
    return {"id": new_id}

@app.put("/assets/{asset_id}/rating")
def update_asset_rating(asset_id: int, body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_assets SET rating = %s WHERE id = %s AND user_id = %s",
                       (body.get("rating"), asset_id, user["id"]))
    return {"message": "评分已更新"}

@app.delete("/assets/batch")
def delete_assets(body: dict, request: Request):
    user = get_current_user(request)
    ids = body.get("ids", [])
    if not ids:
        return {"message": "无删除"}
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_assets WHERE id = ANY(%s) AND user_id = %s", (ids, user["id"]))
    return {"message": f"已删除 {len(ids)} 条"}

# ===== 品牌库 API =====
@app.get("/brands")
def list_brands(request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM user_brands WHERE user_id = %s ORDER BY created_at DESC", (user["id"],))
            rows = cur.fetchall()
    return {"brands": [dict(r) for r in rows]}

@app.post("/brands")
def save_brand(body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO user_brands (id, user_id, name, description, tone, selling_points)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
                   tone=EXCLUDED.tone, selling_points=EXCLUDED.selling_points""",
                (body.get("id", str(uuid.uuid4())), user["id"], body.get("name"),
                 body.get("description", ""), body.get("tone", ""), body.get("selling_points", ""))
            )
    return {"message": "保存成功"}

@app.delete("/brands/{brand_id}")
def delete_brand(brand_id: str, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_brands WHERE id = %s AND user_id = %s", (brand_id, user["id"]))
    return {"message": "已删除"}

# ===== 模板 API =====
@app.get("/templates")
def list_templates(request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM user_templates WHERE user_id = %s ORDER BY created_at DESC", (user["id"],))
            rows = cur.fetchall()
    return {"templates": [dict(r) for r in rows]}

@app.post("/templates")
def save_template(body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO user_templates (id, user_id, name, prompt, size)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, prompt=EXCLUDED.prompt, size=EXCLUDED.size""",
                (body.get("id", str(uuid.uuid4())), user["id"], body.get("name"),
                 body.get("prompt", ""), body.get("size", "1024x1024"))
            )
    return {"message": "保存成功"}

@app.delete("/templates/{template_id}")
def delete_template(template_id: str, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_templates WHERE id = %s AND user_id = %s", (template_id, user["id"]))
    return {"message": "已删除"}

# ===== 偏好 API =====
@app.get("/preferences")
def list_preferences(request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT pref_key, pref_value, use_count FROM user_preferences WHERE user_id = %s ORDER BY use_count DESC", (user["id"],))
            rows = cur.fetchall()
    return {"preferences": [dict(r) for r in rows]}

@app.post("/preferences")
def save_preference(body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO user_preferences (user_id, pref_key, pref_value, use_count, last_used_at)
                   VALUES (%s, %s, %s, 1, NOW())
                   ON CONFLICT (user_id, pref_key, pref_value) DO UPDATE SET use_count = user_preferences.use_count + 1, last_used_at = NOW()""",
                (user["id"], body.get("pref_key"), body.get("pref_value"))
            )
    return {"message": "保存成功"}

# ===== 反馈 API =====
@app.get("/feedback")
def list_feedback(request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM feedback WHERE user_id = %s ORDER BY created_at DESC", (user["id"],))
            rows = cur.fetchall()
    return {"feedback": [dict(r) for r in rows]}

@app.post("/feedback")
def save_feedback(body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO feedback (user_id, history_id, gen_type, original_content, feedback_text, improved_content, changes_summary, learnings, rating)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (user["id"], body.get("history_id"), body.get("gen_type"),
                 body.get("original_content", ""), body.get("feedback_text", ""),
                 body.get("improved_content", ""), body.get("changes_summary", ""),
                 body.get("learnings", ""), body.get("rating"))
            )
    return {"id": cur.fetchone()["id"]}

# ===== 插件 API =====
@app.get("/plugins")
def list_plugins():
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM plugins ORDER BY created_at DESC")
            rows = cur.fetchall()
    return {"plugins": [dict(r) for r in rows]}

@app.get("/plugins/{plugin_id}")
def get_plugin(plugin_id: str):
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM plugins WHERE id = %s", (plugin_id,))
            plugin = cur.fetchone()
            if not plugin:
                raise HTTPException(404, "插件不存在")
            cur.execute("SELECT * FROM plugin_changelog WHERE plugin_id = %s ORDER BY created_at DESC", (plugin_id,))
            changelog = cur.fetchall()
    return {"plugin": dict(plugin), "changelog": [dict(c) for c in changelog]}

@app.post("/plugins")
def create_plugin(body: dict, request: Request):
    user = get_current_user(request)
    require_admin(user)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO plugins (name, icon, version, short_desc, description, platforms, install_guide, known_issues, download_url)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (body.get("name"), body.get("icon", ""), body.get("version"),
                 body.get("short_desc", ""), body.get("description", ""),
                 body.get("platforms", ""), body.get("install_guide", ""),
                 body.get("known_issues", ""), body.get("download_url", ""))
            )
            new_id = cur.fetchone()["id"]
    return {"id": new_id}

@app.put("/plugins/{plugin_id}")
def update_plugin(plugin_id: str, body: dict, request: Request):
    user = get_current_user(request)
    require_admin(user)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE plugins SET name=%s, icon=%s, version=%s, short_desc=%s, description=%s,
                   platforms=%s, install_guide=%s, known_issues=%s, download_url=%s, updated_at=NOW()
                   WHERE id=%s""",
                (body.get("name"), body.get("icon", ""), body.get("version"),
                 body.get("short_desc", ""), body.get("description", ""),
                 body.get("platforms", ""), body.get("install_guide", ""),
                 body.get("known_issues", ""), body.get("download_url", ""), plugin_id)
            )
    return {"message": "更新成功"}

@app.delete("/plugins/{plugin_id}")
def delete_plugin(plugin_id: str, request: Request):
    user = get_current_user(request)
    require_admin(user)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM plugins WHERE id = %s", (plugin_id,))
    return {"message": "已删除"}

@app.put("/plugins/{plugin_id}/download")
def increment_download(plugin_id: str):
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE plugins SET downloads = downloads + 1 WHERE id = %s", (plugin_id,))
    return {"message": "ok"}

# ===== 插件反馈 API =====
@app.get("/plugin-feedback")
def list_plugin_feedback(request: Request):
    user = get_current_user(request)
    require_admin(user)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM plugin_feedback ORDER BY created_at DESC")
            rows = cur.fetchall()
    return {"feedback": [dict(r) for r in rows]}

@app.post("/plugin-feedback")
def submit_plugin_feedback(body: dict):
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO plugin_feedback (plugin_id, user_id, user_name, feedback_type, content, images)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (body.get("plugin_id"), body.get("user_id", ""),
                 body.get("user_name", ""), body.get("feedback_type", "bug"),
                 body.get("content"), body.get("images", ""))
            )
    return {"message": "提交成功"}

@app.put("/plugin-feedback/{feedback_id}/status")
def update_feedback_status(feedback_id: str, body: dict, request: Request):
    user = get_current_user(request)
    require_admin(user)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE plugin_feedback SET status = %s WHERE id = %s", (body.get("status"), feedback_id))
    return {"message": "状态已更新"}

@app.delete("/plugin-feedback/{feedback_id}")
def delete_plugin_feedback(feedback_id: str, request: Request):
    user = get_current_user(request)
    require_admin(user)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM plugin_feedback WHERE id = %s", (feedback_id,))
    return {"message": "已删除"}

# ===== 文件上传 API =====
@app.post("/upload/image")
async def upload_image(file: UploadFile = File(...), request: Request = None):
    user = get_current_user(request)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename
    content = await file.read()
    filepath.write_bytes(content)
    url = f"/uploads/{filename}"
    return {"url": url, "filename": filename}

@app.get("/uploads/{filename}")
def serve_upload(filename: str):
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(filepath)

# ===== 管理员日志 =====
@app.post("/admin/log")
def log_admin_action(body: dict, request: Request):
    user = get_current_user(request)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO admin_logs (admin_id, admin_name, action, target, details) VALUES (%s, %s, %s, %s, %s)",
                (user["id"], user["display_name"], body.get("action"), body.get("target", ""), body.get("details", ""))
            )
    return {"message": "ok"}

# ===== 健康检查 =====
@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
