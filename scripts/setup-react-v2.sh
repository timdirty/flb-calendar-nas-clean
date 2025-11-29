#!/bin/bash

# ============================================
# FLB 學習歷程上傳系統 V2.0 - React 專案初始化腳本
# ============================================

set -e  # 遇到錯誤立即退出

echo "🚀 開始初始化 React V2 專案..."

# 檢查 Node.js 版本
echo "📦 檢查 Node.js 版本..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Node.js 版本過舊，請升級到 18.0.0 以上"
    exit 1
fi
echo "✅ Node.js 版本: $(node -v)"

# 創建專案
echo "📁 創建 React 專案..."
npm create vite@latest frontend-v2 -- --template react-ts

cd frontend-v2

# 安裝核心依賴
echo "📦 安裝核心依賴..."
npm install

# 安裝 UI 框架
echo "🎨 安裝 UI 框架..."
npm install tailwindcss postcss autoprefixer
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select
npm install lucide-react
npm install framer-motion

# 安裝狀態管理
echo "🔄 安裝狀態管理..."
npm install zustand
npm install @tanstack/react-query

# 安裝表單處理
echo "📝 安裝表單處理..."
npm install react-hook-form zod @hookform/resolvers

# 安裝工具庫
echo "🛠️ 安裝工具庫..."
npm install axios
npm install clsx tailwind-merge
npm install date-fns

# 安裝開發工具
echo "🔧 安裝開發工具..."
npm install -D @types/node
npm install -D eslint prettier eslint-config-prettier
npm install -D vitest @testing-library/react @testing-library/jest-dom

# 初始化 TailwindCSS
echo "🎨 初始化 TailwindCSS..."
npx tailwindcss init -p

# 創建目錄結構
echo "📁 創建目錄結構..."
mkdir -p src/pages
mkdir -p src/components/course
mkdir -p src/components/student
mkdir -p src/components/media
mkdir -p src/components/ui
mkdir -p src/hooks
mkdir -p src/services/api
mkdir -p src/services/upload
mkdir -p src/store
mkdir -p src/types
mkdir -p src/utils

echo "✅ React V2 專案初始化完成！"
echo ""
echo "📝 下一步："
echo "1. cd frontend-v2"
echo "2. npm run dev"
echo "3. 訪問 http://localhost:5173"
echo ""
echo "🎉 開始開發吧！"
