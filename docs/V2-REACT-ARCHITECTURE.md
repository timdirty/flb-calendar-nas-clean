# 🚀 FLB 學習歷程上傳系統 V2.0 - React 架構設計

## 📁 專案結構

```
frontend-v2/                        # React 新版本專案
├── public/
├── src/
│   ├── pages/                     # 頁面
│   │   ├── CourseSelection.tsx
│   │   ├── StudentUpload.tsx
│   │   ├── OverviewUpload.tsx
│   │   └── History.tsx
│   │
│   ├── components/                # 元件
│   │   ├── course/               # 課程相關
│   │   ├── student/              # 學生相關
│   │   ├── media/                # 媒體相關
│   │   └── ui/                   # UI 元件
│   │
│   ├── hooks/                    # 自訂 Hooks
│   ├── services/                 # 業務邏輯
│   ├── store/                    # 狀態管理
│   ├── types/                    # TypeScript 定義
│   └── utils/                    # 工具函數
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🛠️ 技術棧

### 核心
- React 18 + TypeScript
- Vite (建構工具)
- TailwindCSS + Shadcn/ui
- Zustand (狀態管理)
- React Query (伺服器狀態)

### 功能
- React Hook Form (表單)
- Axios (HTTP)
- Zod (驗證)
- Framer Motion (動畫)

## 🎯 完整功能列表

### ✅ 第一階段：核心功能
1. 課程選擇與篩選
2. 學生列表管理
3. 照片/影片上傳
4. 進度追蹤
5. 評語輸入
6. 課程總覽

### 🚧 第二階段：進階功能
7. 歷史記錄查看
8. 圖片壓縮
9. 影片縮圖
10. 離線支援

### 💡 第三階段：企業功能
11. 批次操作
12. 範本管理
13. 數據分析
14. 錯誤追蹤

## 🔌 API 設計

### 新版 API 端點
```
POST /api/v2/upload/init
POST /api/v2/upload/chunk  
POST /api/v2/upload/complete
GET  /api/v2/courses
GET  /api/v2/students
```

## 📱 響應式設計

- 手機: 單欄 + 底部導航
- 平板: 雙欄 + 側邊欄
- 桌面: 三欄 + 完整功能

## 🚀 開發時程：14 天

- Week 1: 基礎架構 + 核心功能
- Week 2: 進階功能 + 測試部署

_詳細規劃見其他文件_
