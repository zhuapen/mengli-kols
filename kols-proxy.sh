#!/bin/bash
# 加载 .env 中所有变量后启动 AI 统一网关
set -a
source ~/.hermes/.env
set +a
exec python3 /Users/tulei/Desktop/网站/kols-proxy.py
