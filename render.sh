#!/bin/zsh
# 低占用渲染《云海鲸歌》
#   nice -n 20      : 最低调度优先级
#   taskpolicy -b   : 后台 QoS，进一步降低对前台应用的影响
#
# 用法: ./render.sh [宽x高] [采样数] [机位 A-E]
set -e
cd "$(dirname "$0")"
RES=${1:-1280x720}
SAMPLES=${2:-32}
CAM=${3:-E}
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"

nice -n 20 taskpolicy -b "$BLENDER" -b -noaudio --factory-startup \
    --python build_scene.py -- \
    --res "$RES" --samples "$SAMPLES" --cam "$CAM" \
    --blend build/sky_whale.blend \
    --out  renders/sky_whale.png
