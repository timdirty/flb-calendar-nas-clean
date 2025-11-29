#!/bin/bash

echo "🔍 搜索正确的 CalDAV 路径"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

USER="testacount"
PASS="testacount"
BASE_URL="https://funlearnbar.synology.me:9102"

# 完整的路径列表
declare -a PATHS=(
"/"
"/caldav"
"/caldav/"
"/caldav.php"
"/caldav.php/"
"/caldav/$USER"
"/caldav/$USER/"
"/caldav.php/$USER"
"/caldav.php/$USER/"
"/calendars"
"/calendars/"
"/calendars/$USER"
"/calendars/$USER/"
"/caldav/calendars"
"/caldav/calendars/"
"/caldav/calendars/$USER"
"/caldav/calendars/$USER/"
"/caldav.php/calendars"
"/caldav.php/calendars/"
"/caldav.php/calendars/$USER"
"/caldav.php/calendars/$USER/"
"/principals"
"/principals/"
"/principals/$USER"
"/principals/$USER/"
"/caldav/principals/$USER/"
"/caldav.php/principals/$USER/"
)

echo "测试 ${#PATHS[@]} 个可能的路径..."
echo ""

FOUND_PATHS=()

for PATH in "${PATHS[@]}"; do
URL="${BASE_URL}${PATH}"

# 使用完整的curl路径
STATUS=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" \
-X PROPFIND \
-H "Depth: 0" \
-u "$USER:$PASS" \
-k "$URL" 2>/dev/null || echo "000")

printf "%-60s → %s" "$PATH" "$STATUS"

if [[ $STATUS =~ ^2[0-9][0-9]$ ]] || [[ $STATUS == "207" ]]; then
echo " ✅ 成功!"
FOUND_PATHS+=("$URL")
elif [[ $STATUS == "401" ]]; then
echo " 🔐 认证失败（路径可能对，但密码错）"
elif [[ $STATUS == "403" ]]; then
echo " ⚠️ 禁止访问（路径对，但权限不足）"
elif [[ $STATUS == "404" ]]; then
echo " ❌ 不存在"
elif [[ $STATUS == "405" ]]; then
echo " ⚠️ 方法不允许（不是CalDAV路径）"
else
echo " ❓ $STATUS"
fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FOUND_PATHS[@]} -gt 0 ]; then
echo "✅ 找到 ${#FOUND_PATHS[@]} 个可用路径:"
for URL in "${FOUND_PATHS[@]}"; do
echo "  • $URL"
done
else
echo "❌ 未找到任何可用的 CalDAV 路径"
echo ""
echo "💡 下一步建议："
echo "   1. 在 DSM Calendar 中查看官方 CalDAV 设置"
echo "   2. 尝试使用 ctctim14 账户（管理员）而不是 testacount"
echo "   3. 检查是否需要应用程序专用密码"
fi
