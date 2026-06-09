#!/bin/bash
# 同步 index.html + style.css + app.js + auth.js 到 public/
DIR="$(dirname "$0")"
cp "$DIR/index.html" "$DIR/public/index.html"
cp "$DIR/style.css" "$DIR/public/style.css"
cp "$DIR/app.js" "$DIR/public/app.js"
cp "$DIR/auth.js" "$DIR/public/auth.js"
echo "synced: index.html, style.css, app.js, auth.js → public/"
