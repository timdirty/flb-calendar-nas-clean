#!/bin/bash

echo "======================================"
echo "🔍 診斷：後端事件抓取問題"
echo "======================================"
echo ""

# 在 NAS 上執行此腳本
TARGET_DIR="/volume1/docker/flb-calendar-nas"

echo "📊 步驟 1: 檢查快取狀態"
echo "----------------------------------------"
curl -s "https://calendar.funlearnbar.synology.me/api/events/cache-status" | python3 -m json.tool
echo ""

echo "📝 步驟 2: 檢查最新日誌（後 100 行）"
echo "----------------------------------------"
docker logs flb-calendar-nas --tail 100
echo ""

echo "🔄 步驟 3: 檢查 CalDAV 初始化"
echo "----------------------------------------"
docker logs flb-calendar-nas 2>&1 | grep -i "caldav\|初始化\|login\|登入" | tail -20
echo ""

echo "📅 步驟 4: 檢查事件快取更新"
echo "----------------------------------------"
docker logs flb-calendar-nas 2>&1 | grep -i "快取\|cache\|事件" | tail -30
echo ""

echo "======================================"
echo "💡 診斷完成"
echo "======================================"
echo ""
echo "如果看到 CalDAV 登入失敗或連線錯誤，可能需要："
echo "  1. 檢查 CalDAV 帳號密碼是否正確"
echo "  2. 檢查 Synology Calendar 服務是否正常運行"
echo "  3. 檢查網路連線是否正常"
echo ""

