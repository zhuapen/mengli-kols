#!/bin/bash
# 将 AI 端点集成到 api-server.py

# 1. 添加 AI 端点代码
cat /tmp/add-ai-endpoints.py >> /opt/mengli-api/server.py

# 2. 添加路由到 server.py
cat >> /opt/mengli-api/server.py << 'ROUTES'


# ===== AI 生成路由 =====
@app.post("/api")
async def api_dispatch(request: Request):
    body = await request.json()
    action = body.get("action", "")

    if action == "stream_copywriting":
        from fastapi.responses import StreamingResponse
        import json as _json
        def generate():
            for chunk in stream_copywriting(body):
                yield f"data: {_json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(generate(), media_type="text/event-stream")

    elif action == "stream_article":
        from fastapi.responses import StreamingResponse
        import json as _json
        def generate():
            for chunk in stream_article(body):
                yield f"data: {_json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(generate(), media_type="text/event-stream")

    elif action == "stream_refine":
        from fastapi.responses import StreamingResponse
        import json as _json
        def generate():
            for chunk in stream_refine(body):
                yield f"data: {_json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(generate(), media_type="text/event-stream")

    elif action == "copywriting":
        return copywriting(body)

    elif action == "image_gen":
        return image_gen(body)

    elif action == "image_edit":
        return image_edit(body)

    elif action == "article":
        return article(body)

    elif action == "feedback":
        return feedback(body)

    elif action == "brief_analysis":
        from add_ai_endpoints import localAnalyzeBrief
        brief = body.get("brief", "")
        return localAnalyzeBrief(brief)

    else:
        return {"error": f"未知 action: {action}"}
ROUTES

# 3. 配置环境变量
cat >> /opt/mengli-api/.env << 'ENV'

# AI API 配置
XIAOMI_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://ai.t8star.org/v1
ENV

# 4. 重启服务
systemctl restart mengli-api
sleep 2

# 5. 验证
curl -s http://localhost:8891/health && echo ""

echo "✅ AI 端点集成完成"
echo "⚠️ 需要配置 XIAOMI_API_KEY 和 OPENAI_API_KEY 才能使用生成功能"
