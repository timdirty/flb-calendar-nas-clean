#!/bin/bash

echo "🔐 测试 testacount 账户的 CalDAV 连接"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

USER="testacount"
PASS="testacount"
BASE_URL="https://funlearnbar.synology.me:9102"

declare -a PATHS=(
"/caldav/"
"/caldav.php/"
"/caldav/$USER/"
"/caldav.php/$USER/"
"/caldav/calendars/$USER/"
"/caldav.php/calendars/$USER/"
"/caldav/principals/$USER/"
"/caldav.php/principals/$USER/"
"/$USER/"
"/calendars/$USER/"
"/principals/$USER/"
)

echo "🧪 测试所有可能的 CalDAV 路径..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FOUND_URL=""
BEST_CODE=999

for PATH in "${PATHS[@]}"; do
URL="${BASE_URL}${PATH}"

echo "测试: $URL"

PROPFIND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
-X PROPFIND \
-H "Depth: 0" \
-H "Content-Type: application/xml" \
-u "$USER:$PASS" \
-k "$URL" 2>/dev/null)

echo "   PROPFIND: $PROPFIND_STATUS"

if [[ $PROPFIND_STATUS =~ ^2[0-9][0-9]$ ]] || [[ $PROPFIND_STATUS == "207" ]]; then
echo "   ✅ PROPFIND 成功！"
FOUND_URL="$URL"
BEST_CODE=$PROPFIND_STATUS
break
fi

OPTIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
-X OPTIONS \
-u "$USER:$PASS" \
-k "$URL" 2>/dev/null)

echo "   OPTIONS:  $OPTIONS_STATUS"

if [[ $OPTIONS_STATUS =~ ^2[0-9][0-9]$ ]]; then
echo "   ✅ OPTIONS 成功！"
if [[ -z "$FOUND_URL" ]]; then
FOUND_URL="$URL"
BEST_CODE=$OPTIONS_STATUS
fi
fi

GET_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
-u "$USER:$PASS" \
-k "$URL" 2>/dev/null)

echo "   GET:      $GET_STATUS"

if [[ $GET_STATUS =~ ^2[0-9][0-9]$ ]] || [[ $GET_STATUS == "207" ]]; then
echo "   ✅ GET 成功！"
if [[ -z "$FOUND_URL" ]]; then
FOUND_URL="$URL"
BEST_CODE=$GET_STATUS
fi
fi

if [[ $PROPFIND_STATUS == "207" ]] || [[ $OPTIONS_STATUS =~ ^2[0-9][0-9]$ ]] || [[ $GET_STATUS =~ ^2[0-9][0-9]$ ]]; then
if [[ -z "$FOUND_URL" ]]; then
FOUND_URL="$URL"
BEST_CODE=$PROPFIND_STATUS
fi
elif [[ $PROPFIND_STATUS == "403" ]] && [[ $BEST_CODE -gt 403 ]]; then
FOUND_URL="$URL"
BEST_CODE=403
elif [[ $PROPFIND_STATUS == "401" ]] && [[ $BEST_CODE -gt 401 ]]; then
FOUND_URL="$URL"
BEST_CODE=401
fi

echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ -n "$FOUND_URL" ]]; then
if [[ $BEST_CODE =~ ^2[0-9][0-9]$ ]] || [[ $BEST_CODE == "207" ]]; then
echo "✅✅✅ 找到可用的 CalDAV URL！"
echo "   URL: $FOUND_URL"
echo "   状态码: $BEST_CODE"
echo ""

read -p "是否立即使用此URL配置系统? (y/n): " CONFIGURE

if [[ "$CONFIGURE" == "y" ]]; then
cd ~/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

cp .env.nas .env.nas.backup.testacount.$(date +%Y%m%d-%H%M%S) 2>/dev/null

cat > .env.nas << ENVEOF
# FLB 講師行事曆 - NAS 環境配置
# 使用 testacount 账户
# CalDAV URL 测试成功
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

echo "✅ 配置已更新"
echo ""
echo "📋 配置内容:"
cat .env.nas
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 重启 Docker..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sudo docker-compose down
sudo docker-compose up -d --build

sleep 20

echo ""
echo "🧪 测试 API..."
API_RESULT=$(curl -s "http://localhost:3000/api/events?force=true")

if echo "$API_RESULT" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
SOURCE=$(echo "$API_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('source', 'unknown'))")
EVENT_COUNT=$(echo "$API_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试结果:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   数据源: $SOURCE"
echo "   事件数: $EVENT_COUNT"
echo ""

if [[ "$SOURCE" == "caldav" ]] && [[ "$EVENT_COUNT" -gt 0 ]]; then
echo "✅✅✅ 完全成功！✅✅✅"
echo ""
echo "👨‍🏫 讲师列表:"
curl -s "http://localhost:3000/api/teachers" | \
python3 -c "import sys, json; [print(f'  {i+1}. {t}') for i,t in enumerate(json.load(sys.stdin))]"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 CalDAV 连接成功！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
echo "⚠️ 数据源: $SOURCE (应该是 caldav)"
echo ""
echo "查看日志:"
sudo docker-compose logs --tail=30 | grep -i caldav
fi
else
echo "查看完整日志:"
sudo docker-compose logs --tail=50
fi
fi
else
echo "⚠️ 找到最接近的 URL，但需要权限配置"
echo "   URL: $FOUND_URL"
echo "   状态码: $BEST_CODE"
fi
else
echo "❌ 未找到任何可用的 CalDAV URL"
echo ""
echo "💡 建议："
echo "   1. 确认 testacount 用户在 DSM Calendar 中有权限"
echo "   2. 检查 Calendar 服务是否正在运行"
fi
