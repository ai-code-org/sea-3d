#!/bin/zsh
# 本地预览：./serve.sh [端口]
set -e
cd "$(dirname "$0")"
PORT=${1:-8766}
echo "→ http://127.0.0.1:$PORT/"
python3 -m http.server "$PORT" --bind 127.0.0.1
