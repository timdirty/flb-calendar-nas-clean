#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "  課前提醒防護機制完整檢查"
echo "════════════════════════════════════════════════════════"
echo ""

echo "📋 檢查 1: createRemindersForEvent() - 動態創建保護"
grep -n "已發送，跳過創建" reminder-scheduler.js && echo "✅ 通過" || echo "❌ 缺少"
echo ""

echo "📋 檢查 2: cleanupExpiredReminders() - 課前提醒清理保護"
grep -n "課前提醒已發送，保持狀態" reminder-scheduler.js && echo "✅ 通過" || echo "❌ 缺少"
echo ""

echo "📋 檢查 3: resetBeforeClassReminders() - 重置保護"
grep -A2 "if (beforeClassTime > now" reminder-scheduler.js | grep "status !== 'sent'" && echo "✅ 通過" || echo "❌ 缺少"
echo ""

echo "📋 檢查 4: server.js API - /api/reminders/reset-before-class"
grep -n "只重置未發送過的" ../server.js && echo "✅ 通過" || echo "❌ 缺少"
echo ""

echo "════════════════════════════════════════════════════════"
echo "  檢查完成"
echo "════════════════════════════════════════════════════════"
