#!/bin/bash

echo "🔐 CalDAV密码测试和配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "找到的可用URL:"
echo "  • +funlearnbar.synology.me/...tim14"+
echo "  • +funlearnbar.synology.me/..."+
echo ""
echo "这些URL返回401，说明路径正确，只需要正确的密码"
echo ""

USER="ctctim14"

# 循环直到输入正确的密码
while true; do
read -sp "请输入 $USER 的密码: " PASS
echo ""

echo "🧪 测试密码..."

# 测试第一个URL
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
-u "$USER:$PASS" \
"https://funlearnbar.synology.me:9102/caldav.php/calendars/$USER" 2>/dev/null)

echo "   状态码: $STATUS"

if [[ $STATUS =~ ^2[0-9][0-9]$ ]] || [[ $STATUS == "207" ]]; then
echo "✅ 密码正确！CalDAV连接成功！"
CALDAV_URL="https://funlearnbar.synology.me:9102/caldav.php/calendars/$USER/"
break
elif [[ $STATUS == "401" ]]; then
echo "❌ 密码错误，请重试"
echo ""
read -p "是否继续尝试? (y/n): " RETRY
if [[ "$RETRY" != "y" ]]; then
echo "退出"
exit 1
fi
else
echo "⚠️ 意外的状态码: $STATUS"
echo "尝试使用principals路径..."

STATUS2=$(curl -s -o /dev/null -w "%{http_code}" \
-u "$USER:$PASS" \
"https://funlearnbar.synology.me:9102/caldav.php/principals/$USER/" 2>/dev/null)

if [[ $STATUS2 =~ ^2[0-9][0-9]$ ]] || [[ $STATUS2 == "207" ]]; then
echo "✅ 密码正确！使用principals路径"
CALDAV_URL="https://funlearnbar.synology.me:9102/caldav.php/principals/$USER/"
break
fi

read -p "是否继续尝试? (y/n): " RETRY
if [[ "$RETRY" != "y" ]]; then
exit 1
fi
fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 认证成功！开始配置..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 备份旧配置
cp .env.nas .env.nas.backup.success.$(date +%Y%m%d-%H%M%S) 2>/dev/null

# 创建新配置
cat > .env.nas << ENVEOF
# FLB 講師行事曆 - NAS 環境配置
# CalDAV认证成功
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
echo "🔄 重启Docker容器..."
sudo docker-compose down
sudo docker-compose up -d

echo ""
echo "⏳ 等待容器启动 (15秒)..."
sleep 15

echo ""
echo "🧪 测试API..."
API_RESULT=$(curl -s "http://localhost:3000/api/events?force=true")
SOURCE=$(echo "$API_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('source', 'error'))" 2>/dev/null)
EVENT_COUNT=$(echo "$API_RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))" 2>/dev/null)

echo ""
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
python3 -c "import sys, json; [print(f'  • {t}') for t in json.load(sys.stdin)]"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 下一步: 清除浏览器缓存"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "在浏览器Console执行:"
echo "localStorage.clear(); sessionStorage.clear(); location.reload(true);"
else
echo "⚠️ 数据源是 $SOURCE，可能需要进一步调试"
echo ""
echo "查看Docker日志:"
sudo docker-compose logs --tail=50 | grep -i caldav
fi
