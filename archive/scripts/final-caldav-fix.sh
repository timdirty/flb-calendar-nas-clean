#!/bin/bash

echo "🔧 CalDAV URL 最终修复"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd ~/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 测试两种配置
echo "测试不同的 CALDAV_URL 配置..."
echo ""

# 配置1: /caldav (让代码添加用户名)
echo "1️⃣ 配置: +funlearnbar.synology.me/...aldav"+
echo "   代码会访问: /caldav/testacount/"
echo -n "   测试结果: "
/usr/bin/curl -s -o /dev/null -w "%{http_code}" \
-X PROPFIND -H "Depth: 1" \
-u "testacount:testacount" \
-k "https://funlearnbar.synology.me:9102/caldav/testacount/" 2>/dev/null
echo ""
echo ""

# 配置2: / (让代码添加完整路径)
echo "2️⃣ 配置: +funlearnbar.synology.me/"+
echo "   代码会访问: /testacount/"
echo -n "   测试结果: "
/usr/bin/curl -s -o /dev/null -w "%{http_code}" \
-X PROPFIND -H "Depth: 1" \
-u "testacount:testacount" \
-k "https://funlearnbar.synology.me:9102/testacount/" 2>/dev/null
echo ""
echo ""

# 直接测试已知成功的URL
echo "3️⃣ 已知成功的URL (无尾部斜杠): /caldav/testacount"
echo -n "   测试结果: "
RESULT=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" \
-X PROPFIND -H "Depth: 1" \
-u "testacount:testacount" \
-k "https://funlearnbar.synology.me:9102/caldav/testacount" 2>/dev/null)
echo "$RESULT"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ "$RESULT" == "207" ]] || [[ "$RESULT" =~ ^2[0-9][0-9]$ ]]; then
echo "✅ 解决方案：修改代码，移除自动添加的尾部斜杠"
echo ""
echo "需要修改 caldav-client.js 第20行："
echo "   从: const userUrl = \`\${this.baseUrl}\${this.username}/\`;"
echo "   改为: const userUrl = \`\${this.baseUrl}\${this.username}\`;"
echo ""
echo "或者使用 CALDAV_URL=https://funlearnbar.synology.me:9102/caldav/testacount"
echo "并修改第20行为:"
echo "   const userUrl = this.baseUrl; // 直接使用配置的完整URL"
fi
