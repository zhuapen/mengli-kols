FROM python:3.11-slim

WORKDIR /app

# 复制后端脚本
COPY kols-proxy.py .

# 暴露端口
EXPOSE 8899

# 启动服务
CMD ["python3", "kols-proxy.py"]
