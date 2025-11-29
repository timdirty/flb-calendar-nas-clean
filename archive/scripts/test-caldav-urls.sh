#!/bin/bash
echo "🔍 测试所有可能的CalDAV URL路径..."
echo ""

USER="ctctim14"
PASS="您的密码"  # 替换为实际密码

read -sp "请输入密码: " PASS
echo ""
echo ""

declare -a URLS=(
"https://funlearnbar.synology.me:9102/caldav.php"
"https://funlearnbar.synology.me:9102/caldav.php/"
"https://funlearnbar.synology.me:9102/caldav.php/calendars"
"https://funlearnbar.synology.me:9102/caldav.php/calendars/"
"https://funlearnbar.synology.me:9102/caldav.php/calendars/$USER"
"https://funlearnbar.synology.me:9102/caldav.php/calendars/$USER/"
"https://funlearnbar.synology.me:9102/caldav.php/principals"
"https://funlearnbar.synology.me:9102/caldav.php/principals/"
"https://funlearnbar.synology.me:9102/caldav.php/principals/$USER"
"https://funlearnbar.synology.me:9102/caldav.php/principals/$USER/"
"https://funlearnbar.synology.me:9102/caldav"
"https://funlearnbar.synology.me:9102/caldav/"
"https://funlearnbar.synology.me:9102/caldav/$USER"
"https://funlearnbar.synology.me:9102/caldav/$USER/"
)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试结果："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FOUND_URL=""
BEST_CODE=999

for URL in "${URLS[@]}"; do
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -u "$USER:$PASS" "$URL" 2>/dev/null || echo "000")

printf "%-70s → %s" "$URL" "$STATUS"

if [[ $STATUS =~ ^2[0-9][0-9]$ ]] || [[ $STATUS == "207" ]]; then
echo " ✅ 成功!"
FOUND_URL="$URL"
BEST_CODE=$STATUS
break
elif [[ $STATUS == "401" ]]; then
echo " 🔐 认证失败"
elif [[ $STATUS == "403" ]]; then
echo " ⚠️ 权限不足"
if [[ $BEST_CODE -gt 403 ]]; then
FOUND_URL="$URL"
BEST_CODE=403
fi
elif [[ $STATUS == "404" ]]; then
echo " ❌ 不存在"
else
echo " ❓ 未知"
fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ -n "$FOUND_URL" ]]; then
if [[ $BEST_CODE =~ ^2[0-9][0-9]$ ]] || [[ $BEST_CODE == "207" ]]; then
echo "✅ 找到可用的URL: $FOUND_URL"
echo "   状态码: $BEST_CODE"
else
echo "⚠️ 找到最接近的URL: $FOUND_URL"
echo "   状态码: $BEST_CODE (需要配置权限)"
fi
else
echo "❌ 未找到任何可用的URL"
echo ""
echo "💡 可能的原因："
echo "   1. Calendar服务未运行"
echo "   2. CalDAV功能未启用"
echo "   3. 需要在DSM Calendar中获取正确的URL"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
