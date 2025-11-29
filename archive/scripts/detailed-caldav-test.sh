#!/bin/bash

echo "🔍 详细 CalDAV 测试（包含错误信息）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

USER="testacount"
PASS="testacount"

# 测试1: 基本连接
echo "1️⃣ 测试基本连接（不带认证）..."
curl -v -k https://funlearnbar.synology.me:9102/caldav/ 2>&1 | grep -E "HTTP|< |>" | head -20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 测试2: 带认证的 GET
echo "2️⃣ 测试带认证的 GET..."
curl -v -k -u "$USER:$PASS" https://funlearnbar.synology.me:9102/caldav/ 2>&1 | grep -E "HTTP|< |>" | head -20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 测试3: PROPFIND 方法
echo "3️⃣ 测试 PROPFIND 方法..."
curl -v -k \
-X PROPFIND \
-H "Depth: 0" \
-H "Content-Type: application/xml" \
-u "$USER:$PASS" \
https://funlearnbar.synology.me:9102/caldav/ 2>&1 | grep -E "HTTP|< |>" | head -30

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 测试4: 测试不同路径
declare -a PATHS=(
"/caldav/"
"/caldav.php/"
"/caldav/calendars/$USER/"
"/caldav.php/calendars/$USER/"
)

echo "4️⃣ 测试不同路径的状态码..."
for PATH in "${PATHS[@]}"; do
URL="https://funlearnbar.synology.me:9102${PATH}"
echo -n "测试: $URL → "

# 获取状态码，显示错误
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -k -u "$USER:$PASS" "$URL" 2>&1)

echo "$STATUS"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 测试完成"
echo ""
echo "💡 如果看到 200, 207, 或其他数字，说明连接正常"
echo "   如果仍然是空的，可能是 DNS 或证书问题"
