#!/bin/bash

echo "🔍 診斷學習歷程上傳 502 錯誤"
echo "================================"
echo ""

# 檢查 Node.js 服務是否運行
echo "1️⃣  檢查 Node.js 服務狀態..."
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Node.js 服務正在運行"
    echo "   PID: $(pgrep -f 'node.*server.js')"
else
    echo "❌ Node.js 服務未運行！"
    echo "   建議：請先啟動服務 'node server.js'"
    exit 1
fi

echo ""

# 檢查端口
echo "2️⃣  檢查端口..."
PORT=3001
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "✅ 端口 $PORT 正在監聽"
else
    echo "❌ 端口 $PORT 未監聽！"
    echo "   建議：檢查 server.js 中的端口配置"
fi

echo ""

# 檢查 NAS 路徑
echo "3️⃣  檢查 NAS 存儲路徑..."
NAS_PATH="/volume1/Fun Learn Bar/學習歷程 automatic"
if [ -d "$NAS_PATH" ]; then
    echo "✅ NAS 路徑存在: $NAS_PATH"
    
    # 檢查寫入權限
    TEST_FILE="$NAS_PATH/.test_write_$(date +%s)"
    if touch "$TEST_FILE" 2>/dev/null; then
        echo "✅ 具有寫入權限"
        rm -f "$TEST_FILE"
    else
        echo "❌ 沒有寫入權限！"
        echo "   建議：請檢查目錄權限"
        echo "   執行：sudo chmod 755 '$NAS_PATH'"
    fi
else
    echo "❌ NAS 路徑不存在: $NAS_PATH"
    echo "   建議：請創建此目錄或修改 server.js 中的路徑配置"
fi

echo ""

# 檢查 multer 臨時目錄
echo "4️⃣  檢查 uploads 臨時目錄..."
UPLOAD_DIR="./uploads"
if [ -d "$UPLOAD_DIR" ]; then
    echo "✅ uploads 目錄存在"
else
    echo "⚠️  uploads 目錄不存在，正在創建..."
    mkdir -p "$UPLOAD_DIR"
    chmod 755 "$UPLOAD_DIR"
    echo "✅ 已創建 uploads 目錄"
fi

echo ""

# 檢查 Node.js 內存限制
echo "5️⃣  檢查 Node.js 配置..."
NODE_VERSION=$(node --version 2>/dev/null || echo "未安裝")
echo "   Node.js 版本: $NODE_VERSION"

# 檢查環境變數
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
else
    echo "⚠️  .env 文件不存在（可選）"
fi

echo ""

# 檢查最近的錯誤日誌
echo "6️⃣  檢查最近的服務日誌..."
echo "   提示：請查看 server.js 的控制台輸出"
echo ""

# 提供建議
echo "================================"
echo "💡 常見 502 錯誤解決方案："
echo ""
echo "1. 重啟 Node.js 服務："
echo "   pkill -f 'node.*server.js'"
echo "   node server.js &"
echo ""
echo "2. 增加文件上傳大小限制（如果使用 Nginx）："
echo "   client_max_body_size 100M;"
echo ""
echo "3. 檢查防火牆設置"
echo ""
echo "4. 查看詳細錯誤日誌："
echo "   在瀏覽器開發者工具的 Network 標籤中查看完整響應"
echo ""
echo "5. 測試 API 端點："
echo "   curl -X POST http://localhost:3001/api/learning-records/upload -F 'test=1'"
echo ""

# 詢問是否重啟服務
read -p "是否要重啟 Node.js 服務？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 正在重啟服務..."
    pkill -f "node.*server.js"
    sleep 2
    
    # 切換到腳本所在目錄
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    cd "$SCRIPT_DIR"
    
    # 啟動服務（背景執行）
    nohup node server.js > server.log 2>&1 &
    
    echo "✅ 服務已重啟"
    echo "   日誌文件: $SCRIPT_DIR/server.log"
    echo "   查看日誌: tail -f server.log"
    
    # 等待服務啟動
    echo "⏳ 等待服務啟動..."
    sleep 3
    
    # 測試服務
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ 服務啟動成功！"
    else
        echo "⚠️  服務可能未完全啟動，請查看日誌"
    fi
fi

echo ""
echo "✨ 診斷完成！"

