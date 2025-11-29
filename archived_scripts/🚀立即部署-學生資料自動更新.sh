#!/bin/bash

echo "================================"
echo "🚀 部署學生資料自動更新功能"
echo "================================"
echo ""

# 檢查是否在 NAS 環境
if [ ! -d "/volume1" ]; then
    echo "⚠️  警告：不在 NAS 環境，請在 NAS 上執行此腳本"
    echo ""
fi

# 設定工作目錄
WORK_DIR="/volume1/docker/flb-calendar"
if [ -d "$WORK_DIR" ]; then
    cd "$WORK_DIR"
    echo "📂 工作目錄: $WORK_DIR"
else
    echo "❌ 找不到工作目錄: $WORK_DIR"
    echo "請確認路徑是否正確"
    exit 1
fi

echo ""
echo "📋 新功能說明："
echo "1. ✅ 方案1：每日凌晨 2:00 自動從 Google Sheets 更新學生資料"
echo "2. ✅ 方案3：可設定間隔時間自動更新（預設關閉）"
echo "3. ✅ 新增管理 API 用於控制自動更新排程"
echo "4. ✅ 系統狀態 API 顯示同步狀態"
echo ""

# 備份現有檔案
echo "💾 備份現有檔案..."
BACKUP_DIR="backups/auto-sync-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp server.js "$BACKUP_DIR/" 2>/dev/null
cp system-settings.json "$BACKUP_DIR/" 2>/dev/null
cp package.json "$BACKUP_DIR/" 2>/dev/null
echo "✅ 備份完成: $BACKUP_DIR"
echo ""

# 安裝 node-schedule
echo "📦 檢查並安裝 node-schedule..."
if npm list node-schedule &>/dev/null; then
    echo "✅ node-schedule 已安裝"
else
    echo "📥 安裝 node-schedule..."
    npm install node-schedule --save
fi

echo ""

# 重新構建 Docker 映像
echo "🏗️  重新構建 Docker 映像..."
docker-compose build

echo ""

# 停止現有容器
echo "🛑 停止現有容器..."
docker-compose down

echo ""

# 啟動新容器
echo "🚀 啟動新容器..."
docker-compose up -d

echo ""
echo "⏳ 等待服務啟動..."
sleep 10

# 檢查服務狀態
echo ""
echo "🔍 檢查服務狀態..."
docker-compose ps

# 查看啟動日誌
echo ""
echo "📋 啟動日誌（最後 20 行）："
docker-compose logs --tail=20

echo ""
echo "================================"
echo "✅ 部署完成！"
echo "================================"
echo ""
echo "📊 查看完整日誌："
echo "docker-compose logs -f"
echo ""
echo "🔍 檢查自動更新狀態："
echo "curl http://localhost:3000/api/system-status | jq .data.studentDataSync"
echo ""
echo "📅 預設設定："
echo "- 每日更新時間：凌晨 2:00"
echo "- 間隔更新：關閉（intervalMinutes: 0）"
echo "- 自動更新：啟用"
echo ""
echo "⚙️  修改設定："
echo "編輯 system-settings.json 中的 studentDataSync 區塊"
echo "然後執行：docker-compose restart"
echo ""

