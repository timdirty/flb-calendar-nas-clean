#!/bin/bash

echo "🔧 使用官方 CalDAV URL 配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "官方 URL: +funlearnbar.synology.me/..."+
echo ""

# 测试可能的完整路径
declare -a URLS=(
"https://funlearnbar.synology.me:9102/caldav/"
"https://funlearnbar.synology.me:9102/caldav/ctctim14/"
"https://funlearnbar.synology.me:9102/caldav/calendars/ctctim14/"
)

USER="ctctim14"
read -sp "请输入 $USER 的密码: " PASS
echo ""
echo ""

FOUND_URL=""
BEST_CODE=999

echo "🧪 测试 CalDAV 路径..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for URL in "${URLS[@]}"; do
echo "测试: $URL"

# 使用 PROPFIND 方法测试
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
-X PROPFIND \
-H "Depth: 0" \
-u "$USER:$PASS" \
"$URL" 2>/dev/null)

echo "   PROPFIND 状态码: $STATUS"

if [[ $STATUS =~ ^2[0-9][0-9]$ ]] || [[ $STATUS == "207" ]]; then
echo "   ✅ 成功！找到正确路径！"
FOUND_URL="$URL"
BEST_CODE=$STATUS
break
fi

# 也尝试 GET 方法
STATUS_GET=$(curl -s -o /dev/null -w "%{http_code}" \
-u "$USER:$PASS" \
"$URL" 2>/dev/null)

echo "   GET 状态码: $STATUS_GET"

if [[ $STATUS_GET =~ ^2[0-9][0-9]$ ]] || [[ $STATUS_GET == "207" ]]; then
echo "   ✅ GET 成功！"
FOUND_URL="$URL"
BEST_CODE=$STATUS_GET
break
elif [[ $STATUS_GET == "403" ]] && [[ $BEST_CODE -gt 403 ]]; then
FOUND_URL="$URL"
BEST_CODE=403
fi

echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ -z "$FOUND_URL" ]]; then
# 如果都没找到，使用基础URL
echo "⚠️ 使用基础 URL: +funlearnbar.synology.me/..."[2]+
FOUND_URL="https://funlearnbar.synology.me:9102/caldav/"
fi

echo "✅ 将使用 URL: $FOUND_URL"
echo "   状态码: $BEST_CODE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 备份旧配置
cp .env.nas .env.nas.backup.official.$(date +%Y%m%d-%H%M%S) 2>/dev/null

# 创建新配置
cat > .env.nas << ENVEOF
# FLB 講師行事曆 - NAS 環境配置
# 使用官方 CalDAV URL
# 更新时间: $(date +"%Y-%m-%d %H:%M:%S")

CALDAV_URL=$FOUND_URL
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
echo "⏳ 等待容器启动 (20秒)..."
sleep 20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 测试 API..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

API_RESULT=$(curl -s "http://localhost:3000/api/events?force=true")

if echo "$API_RESULT" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
SOURCE=$(echo "$API_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('source', 'unknown'))")
EVENT_COUNT=$(echo "$API_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

echo "📊 测试结果:"
echo "   数据源: $SOURCE"
echo "   事件数: $EVENT_COUNT"
echo ""

if [[ "$SOURCE" == "caldav" ]]; then
echo "✅✅✅ 成功！CalDAV 连接正常！✅✅✅"
echo ""
echo "👨‍🏫 讲师列表:"
curl -s "http://localhost:3000/api/teachers" | \
python3 -c "import sys, json; teachers=json.load(sys.stdin); [print(f'  {i+1}. {t}') for i,t in enumerate(teachers)]" 2>/dev/null
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 下一步：清除浏览器缓存"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "在浏览器 Console (F12) 执行："
echo "localStorage.clear(); sessionStorage.clear(); location.reload(true);"
echo ""
else
echo "⚠️ 数据源是: $SOURCE (应该是 caldav)"
echo ""
echo "查看 Docker 日志:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sudo docker-compose logs --tail=100 | grep -A 5 -B 5 -i "caldav\|error"
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

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 配置完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
