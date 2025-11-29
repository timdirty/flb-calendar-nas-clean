<!-- e20f110a-01bf-41aa-9ad0-b7b32555d2d7 40e3b3f8-1f1b-49f9-b7fe-32405754c592 -->
# 加入桌機／平板日曆視圖計畫

1. 規劃日曆切換區塊

- 在 `public/perfect-calendar-optimized-complete2.html` 桌機／平板版面新增視圖切換按鈕並保留原列表視圖。

2. 導入 FullCalendar 套件

- 以 `<link>` 與 `<script>` 載入 FullCalendar 样式與核心腳本，並以 lazy load 或裝置偵測確保僅桌機／平板載入。

3. 建立週/月日曆初始化

- 用既有事件資料串接 FullCalendar，設定預設週視圖、支援月視圖切換與原列表視圖同步更新。

4. 設計響應式與互動邏輯

- 加入媒體查詢讓切換區塊僅在桌機／平板顯示，確保切換時介面狀態一致並維持效能優化機制。

### To-dos

- [ ] 在 perfect-calendar-optimized-complete2.html 建立桌機／平板專屬的視圖切換 UI
- [ ] 載入 FullCalendar 並以現有行事曆資料初始化週／月視圖
- [ ] 完成桌機／平板限定顯示、資料同步與切換互動