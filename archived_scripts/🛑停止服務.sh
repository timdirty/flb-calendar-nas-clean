#!/bin/bash

# 🛑 停止 Nginx + Node.js 服務

echo "================================"
echo "🛑 停止 Nginx + Node.js 服務"
echo "================================"
echo ""

# 1. 停止 Node.js
echo "🔄 停止 Node.js 服務..."
if ps aux | grep -v grep | grep "node server.js" > /dev/null; then
    pkill -f "node server.js"
    echo "✅ Node.js 服務已停止"
else
    echo "ℹ️  Node.js 服務未運行"
fi

# 2. 停止 Nginx
echo "🔄 停止 Nginx 服務..."
if ps aux | grep -v grep | grep nginx > /dev/null; then
    brew services stop nginx
    echo "✅ Nginx 服務已停止"
else
    echo "ℹ️  Nginx 服務未運行"
fi

# 3. 清理日誌（可選）
read -p "是否清理日誌檔案？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f /tmp/flb-backend.log
    echo "✅ 日誌已清理"
fi

echo ""
echo "================================"
echo "✅ 服務已全部停止"
echo "================================"
echo ""


