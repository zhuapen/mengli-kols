FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p data exports backups

EXPOSE 8890

# railway.toml 的 startCommand 会覆盖这里的 CMD
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8890}"]
