#!/bin/bash
# 同步 index.html 到 public/index.html
cp "$(dirname "$0")/index.html" "$(dirname "$0")/public/index.html"
