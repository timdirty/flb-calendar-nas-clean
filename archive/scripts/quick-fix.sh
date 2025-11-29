#!/bin/bash
echo "🧪 测试CalDAV权限..."
echo ""
echo "测试 testacount 用户:"
curl -s -o /dev/null -w "   状态码: %{http_code}\n" -u "testacount:testacount" "https://funlearnbar.synology.me:9102/caldav.php/calendars/testacount/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️ 如果看到 403 或 404，说明权限不足"
echo "💡 推荐：使用管理员账户"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "请输入您的 DSM 管理员用户名: " ADMIN_USER
read -sp "请输入密码: " ADMIN_PASS
echo ""
echo ""
echo "🧪 测试管理员账户..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -u "$ADMIN_USER:$ADMIN_PASS" "https://funlearnbar.synology.me:9102/caldav.php/calendars/$ADMIN_USER/")
echo "   管理员账户状态码: $ADMIN_STATUS"
echo ""

if [[ $ADMIN_STATUS =~ ^2[0-9][0-9]$ ]] || [[ $ADMIN_STATUS == "207" ]]; then
    echo "✅ 管理员账户可访问！更新配置..."
    cp .env.nas .env.nas.backup.admin.$(date +%Y%m%d-%H%M%S)
    cat > .env.nas << ENVEOF
# FLB 講師行事曆 - NAS 環境配置
# 使用管理员账户: $ADMIN_USER
# 更新时间: $(date +"%Y-%m-%d %H:%M:%S")

CALDAV_URL=https://funlearnbar.synology.me:9102/caldav.php/calendars/$ADMIN_USER/
CALDAV_USERNAME=$ADMIN_USER
CALDAV_PASSWORD=$ADMIN_PASS

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
    echo "🔄 重启Docker..."
    sudo docker-compose down
    sudo docker-compose up -d
    echo ""
    echo "⏳ 等待15秒..."
    sleep 15
    echo ""
    echo "🧪 测试API..."
    curl -s "http://localhost:3000/api/events?force=true" | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'✅ Source: {d[\"source\"]}\n✅ Events: {len(d[\"data\"])}\n✅ Instructors: {len(set(e.get(\"instructor\",\"\") for e in d[\"data\"]))}')"
    echo ""
    echo "👨‍🏫 讲师列表:"
    curl -s "http://localhost:3000/api/teachers" | python3 -c "import sys, json; [print(f'  • {t}') for t in json.load(sys.stdin)]"
else
    echo "❌ 管理员账户也无法访问 (状态码: $ADMIN_STATUS)"
    echo "请检查用户名和密码是否正确"
fi
