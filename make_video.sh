#!/bin/zsh
# 把 build/frames 里的 PNG 序列合成 MP4
set -e
cd "$(dirname "$0")"
FPS=${1:-24}
ffmpeg -y -loglevel error -framerate "$FPS" -i build/frames/f_%04d.png \
    -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
    -movflags +faststart renders/sky_whale_swim.mp4
echo "-> renders/sky_whale_swim.mp4"
