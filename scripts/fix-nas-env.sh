#!/bin/bash
# ============================================
# 修復 NAS 上 Docker 容器的 SYNOLOGY_HOST 環境變數
# ============================================

echo "🔍 檢查 NAS 上的 .env.nas 檔案..."

# 檢查 SYNOLOGY_HOST 是否存在
if grep -q "^SYNOLOGY_HOST=" .env.nas; then
    echo "✅ .env.nas 檔案包含 SYNOLOGY_HOST"
    grep "^SYNOLOGY_HOST=" .env.nas
else
    echo "❌ .env.nas 檔案缺少 SYNOLOGY_HOST"
    echo "📝 正在添加 SYNOLOGY_HOST..."
    
    # 在 Synology Drive 區塊添加 SYNOLOGY_HOST
    if grep -q "# Synology Drive" .env.nas; then
        # 使用 sed 在 Synology Drive 註釋後添加
        sed -i.bak '/# Synology Drive（2025-11-08 新增）🆕/a\
SYNOLOGY_HOST=funlearnbar.synology.me
' .env.nas
        echo "✅ 已添加 SYNOLOGY_HOST=funlearnbar.synology.me"
    else
        # 如果沒有找到註釋，在檔案末尾添加
        echo "" >> .env.nas
        echo "# Synology Drive（2025-11-08 新增）🆕" >> .env.nas
        echo "SYNOLOGY_HOST=funlearnbar.synology.me" >> .env.nas
        echo "✅ 已在檔案末尾添加 SYNOLOGY_HOST"
    fi
fi

echo ""
echo "📋 檢查所有 SYNOLOGY 環境變數："
grep "^SYNOLOGY_" .env.nas || echo "⚠️ 未找到任何 SYNOLOGY 環境變數"

echo ""
echo "🔄 重啟 Docker 容器以載入新的環境變數..."
echo "執行: docker-compose restart flb-calendar"
echo ""
echo "或完全重建:"
echo "  docker-compose down"
echo "  docker-compose up -d"
echo ""
echo "驗證環境變數是否載入："
echo "  docker exec flb-calendar-nas env | grep SYNOLOGY"




