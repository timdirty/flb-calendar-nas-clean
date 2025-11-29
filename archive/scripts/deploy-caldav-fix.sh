#!/bin/bash

echo "🚀 部署 CalDAV 修复到 NAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

NAS_USER="ctctim14"
NAS_HOST="funlearnbar.synology.me"
NAS_DIR="/volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

echo "1️⃣ 上传修改后的 caldav-client.js..."
scp caldav-client.js "$NAS_USER@$NAS_HOST:$NAS_DIR/caldav-client.js"

if [ $? -ne 0 ]; then
echo "❌ 上传失败"
exit 1
fi

echo "✅ 上传成功"
echo ""
echo "2️⃣ 在 NAS 上重启 Docker..."

ssh -t "$NAS_USER@$NAS_HOST" << 'NASCOMMANDS'
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

echo "📋 更新 .env.nas 配置..."
cat > .env.nas << 'ENVEOF'
# FLB 講師行事曆 - NAS 環境配置
# CalDAV 修复：移除尾部斜杠

CALDAV_URL=https://funlearnbar.synology.me:9102/caldav/
CALDAV_USERNAME=testacount
CALDAV_PASSWORD=testacount

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
echo "🔄 重启 Docker..."
sudo docker-compose down
sudo docker-compose up -d --build

sleep 25

echo ""
echo "🧪 测试 API..."
/usr/bin/curl -s "http://localhost:3000/api/events?force=true" | python3 -c "
import sys, json
try:
d = json.load(sys.stdin)
print(f'数据源: {d.get(\"source\", \"unknown\")}')
print(f'事件数: {len(d.get(\"data\", []))}')
if d.get('source') == 'caldav' and len(d.get('data', [])) > 0:
print('✅ CalDAV 连接成功！')
else:
print('⚠️ 需要进一步检查')
except:
print('❌ API 返回无效 JSON')
"

echo ""
echo "👨‍🏫 讲师列表:"
/usr/bin/curl -s "http://localhost:3000/api/teachers" | python3 -c "
import sys, json
try:
teachers = json.load(sys.stdin)
for i, t in enumerate(teachers):
print(f'  {i+1}. {t}')
except:
print('  无法获取讲师列表')
"
NASCOMMANDS

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 部署完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
