FROM python:3.12-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 创建数据目录
RUN mkdir -p data exports backups

# 暴露端口
EXPOSE ${PORT:-8890}

# 启动
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8890}"]
