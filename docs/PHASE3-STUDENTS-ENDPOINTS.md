# 📝 階段三：學生管理端點清單

## 🎯 總覽
- **總端點數**: 26 個
- **分類**: Students (10), Temporary Students (8), Attendance (8)
- **預估工作量**: 4-5 小時

## 👥 Students 模組 (10個端點)

### 基礎 API
1. `GET /api/v2/students` - 取得所有學生（合併正常和臨時）
2. `GET /api/v2/students/from-sheets` - 從 Google Sheets 取得學生
3. `GET /api/v2/students/by-course` - 按課程取得學生
4. `GET /api/v2/student-data` - 取得學生資料檔案

### 快取管理
5. `POST /api/v2/students/clear-cache` - 清除學生快取

### 同步管理
6. `GET /api/v2/students/sync/settings` - 取得同步設定
7. `POST /api/v2/students/sync/settings` - 更新同步設定
8. `POST /api/v2/students/sync/trigger` - 手動觸發同步
9. `POST /api/v2/students/sync/start` - 啟動自動同步
10. `POST /api/v2/students/sync/stop` - 停止自動同步

## 🔄 Temporary Students 模組 (8個端點)

### CRUD 操作
1. `GET /api/v2/temporary-students` - 取得臨時學生列表
2. `POST /api/v2/temporary-students` - 新增臨時學生
3. `PUT /api/v2/temporary-students/:id` - 更新臨時學生
4. `DELETE /api/v2/temporary-students/:id` - 刪除臨時學生

### 封存與備份
5. `GET /api/v2/temporary-students/archive` - 取得封存記錄
6. `POST /api/v2/temporary-students/backup` - 建立備份
7. `GET /api/v2/temporary-students/backups` - 取得備份清單
8. `POST /api/v2/temporary-students/restore` - 還原備份

## ✅ Attendance 模組 (8個端點)

### 簽到功能
1. `POST /api/v2/attendance/fast` - 極速簽到
2. `POST /api/v2/attendance/queue` - 簽到隊列（異步處理）
3. `GET /api/v2/attendance/status` - 查詢簽到狀態

### 隊列管理
4. `GET /api/v2/attendance/queue/stats` - 查詢隊列狀態
5. `POST /api/v2/attendance/queue/retry-failed` - 重試失敗記錄

### 管理功能
6. `POST /api/v2/attendance/clear-cache` - 清除快取
7. `GET /api/v2/attendance/debug/students` - 調試學生列表
8. `POST /api/v2/attendance/quick-reply` - Quick Reply 出席回應

## 📋 實施計畫

### Phase 3.1: Students 模組
- 創建 `routes/handlers/studentsHandler.js`
- 創建 `routes/students.js`
- 實施 10 個端點
- 預估時間: 1.5 小時

### Phase 3.2: Temporary Students 模組
- 創建 `routes/handlers/temporaryStudentsHandler.js`
- 創建 `routes/temporary-students.js`
- 實施 8 個端點
- 預估時間: 1.5 小時

### Phase 3.3: Attendance 模組
- 創建 `routes/handlers/attendanceHandler.js`
- 創建 `routes/attendance.js`
- 實施 8 個端點
- 預估時間: 1.5 小時

### Phase 3.4: 整合與測試
- 更新 `routes/index.js`
- 創建 `tests/routes/phase3-complete-test.js`
- 執行完整測試
- 預估時間: 0.5 小時

## 🎯 驗收標準

- [ ] 所有 26 個端點實現
- [ ] 測試通過率 > 85%
- [ ] 向後相容（V1 路由繼續運作）
- [ ] Feature Flag 控制完整
- [ ] 文檔完整

## 📝 注意事項

1. **依賴服務**:
   - googleSheetsStudents
   - fastAttendance
   - attendanceQueueManager
   - safeFile

2. **資料檔案**:
   - `public/student_data.json`
   - `public/temporary_students.json`
   - `data/temporary-students-archive.json`

3. **快取策略**:
   - Students: 使用 googleSheetsStudents 內建快取
   - Attendance: 使用 fastAttendance 快取機制

4. **錯誤處理**:
   - 使用 createInternalError, createBusinessError
   - 統一錯誤格式

5. **安全性**:
   - Sync 相關端點需要管理員權限
   - 使用 verifyAdminToken 中間件
