#!/bin/bash

echo "🎉 应用正确的 CalDAV 配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CALDAV_URL="https://funlearnbar.synology.me:9102/caldav/testacount"
USER="testacount"
PASS="testacount"

echo "✅ 使用 CalDAV URL: $CALDAV_URL"
echo ""

# 进入项目目录
cd ~/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 备份旧配置
cp .env.nas .env.nas.backup.success.$(date +%Y%m%d-%H%M%S) 2>/dev/null

# 创建新配置
cat > .env.nas << ENVEOF
# FLB 講師行事曆 - NAS 環境配置
# CalDAV URL 测试成功 - testacount 账户
# 更新时间: $(date +"%Y-%m-%d %H:%M:%S")

CALDAV_URL=$CALDAV_URL
CALDAV_USERNAME=$USER
CALDAV_PASSWORD=$PASS

LIFF_CLIENT_ID=2006697806-9J1YDavm
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here

PORT=3000
NODE_ENV=production
TZ=Asia/Taipei
CACHE_TTL=300
ENABLE_CACHE=true
ENVEOF

echo "✅ 配置文件已更新"
echo ""
echo "📋 配置内容:"
cat .env.nas
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 重启 Docker 容器..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

sudo docker-compose down
echo ""
sudo docker-compose up -d --build

echo ""
echo "⏳ 等待容器启动 (25秒)..."
sleep 25

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 测试 API..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

API_RESULT=$(/usr/bin/curl -s "http://localhost:3000/api/events?force=true")

if echo "$API_RESULT" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
SOURCE=$(echo "$API_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('source', 'unknown'))")
EVENT_COUNT=$(echo "$API_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

echo "📊 API 测试结果:"
echo "   数据源: $SOURCE"
echo "   事件数: $EVENT_COUNT"
echo ""

if [[ "$SOURCE" == "caldav" ]] && [[ "$EVENT_COUNT" -gt 0 ]]; then
echo "✅✅✅ 完全成功！CalDAV 连接正常！✅✅✅"
echo ""
echo "👨‍🏫 讲师列表:"
/usr/bin/curl -s "http://localhost:3000/api/teachers" | \
python3 -c "import sys, json; teachers=json.load(sys.stdin); [print(f'  {i+1}. {t}') for i,t in enumerate(teachers)]" 2>/dev/null
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 CalDAV 配置成功！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 下一步：清除浏览器缓存"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "在浏览器 Console (F12) 执行："
echo "localStorage.clear(); sessionStorage.clear(); location.reload(true);"
echo ""
elif [[ "$SOURCE" == "caldav" ]]; then
echo "⚠️ CalDAV 连接成功，但事件数为 0"
echo "   可能是日历中没有事件，或日期范围问题"
else
echo "⚠️ 数据源是: $SOURCE (应该是 caldav)"
echo ""
echo "查看 Docker 日志:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sudo docker-compose logs --tail=50 | grep -i caldav
fi
else
echo "❌ API 返回了无效的 JSON"
echo ""
echo "原始响应:"
echo "$API_RESULT" | head -20
echo ""
echo "查看完整日志:"
sudo docker-compose logs --tail=50
fi
