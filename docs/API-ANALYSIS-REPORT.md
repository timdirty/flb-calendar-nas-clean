# 📊 API 端點分析報告

> 生成時間: 2025-11-27T08:55:25.553Z

## 📈 摘要統計

- **總端點數**: 452
- **功能域數**: 19
- **依賴模組數**: 4
- **平均複雜度**: 3.40

## 🔧 按方法統計

| 方法 | 數量 |
|------|------|
| get | 178 |
| /frontend-v2 | 2 |
| post | 236 |
| patch | 4 |
| put | 10 |
| delete | 12 |
| /api/v2 | 8 |
| /api/learning-records/upload-drive | 2 |

## 🏗️ 按功能域統計

| 功能域 | 端點數 | 平均複雜度 |
|--------|--------|------------|
| unknown | 188 | 3.41 |
| templates | 16 | 3.25 |
| system | 10 | 2.80 |
| holidays | 10 | 2.60 |
| events | 12 | 2.83 |
| special-events | 14 | 3.86 |
| notifications | 14 | 4.00 |
| attendance | 14 | 3.00 |
| students | 20 | 3.20 |
| admin | 40 | 3.15 |
| calendar | 10 | 3.60 |
| reminders | 28 | 3.64 |
| student-reminders | 10 | 3.80 |
| webhook | 2 | 3.00 |
| temporary-students | 16 | 4.50 |
| learning-records | 16 | 4.00 |
| drive-upload | 6 | 1.00 |
| media | 18 | 3.22 |
| drive-media | 8 | 3.75 |

## 🚀 遷移計畫

### Phase 1: 基礎設施準備

- **端點數**: 0
- **功能域**: 0
- **預估複雜度**: 0
- **依賴**: 

### Phase 2: 獨立模組遷移

- **端點數**: 0
- **功能域**: 0
- **預估複雜度**: 0
- **依賴**: 

### Phase 3: 學生管理模組

- **端點數**: 36
- **功能域**: 3
- **預估複雜度**: 106
- **依賴**: FileSystem

### Phase 4: 通知系統模組

- **端點數**: 50
- **功能域**: 3
- **預估複雜度**: 178
- **依賴**: GoogleSheets, FileSystem, LINE

### Phase 5: 媒體系統模組

- **端點數**: 54
- **功能域**: 4
- **預估複雜度**: 202
- **依賴**: FileSystem, LINE, NotificationManager

### Phase 6: 日曆核心模組

- **端點數**: 312
- **功能域**: 9
- **預估複雜度**: 1050
- **依賴**: FileSystem, GoogleSheets, LINE

## 📋 詳細端點清單

#### get /student_data.json

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3056

#### /frontend-v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3101

#### get /

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3104

#### get /perfect-calendar-optimized-complete2.html/

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3109

#### get /api/flex-templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3478

#### get /api/health

- **功能域**: system
- **優先級**: 3
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3506

#### get /api/holidays

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 2
- **依賴**: 無
- **行號**: 3520

#### get /api/holidays/check/:date

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3540

#### get /api/holidays/:year/:month

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3562

#### post /api/holidays/sync

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3594

#### get /api/holidays/status

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 2
- **依賴**: 無
- **行號**: 3615

#### get /api/logs

- **功能域**: system
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3635

#### get /api/system-time

- **功能域**: system
- **優先級**: 3
- **複雜度**: 4
- **依賴**: 無
- **行號**: 3894

#### get /api/leave-notification-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 3962

#### post /api/leave-notification-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 3994

#### get /api/timer-countdowns

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 4056

#### get /api/events

- **功能域**: events
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 4253

#### post /api/events/refresh-cache

- **功能域**: events
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 4466

#### get /api/events/cache-status

- **功能域**: events
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 4487

#### post /api/events/mark-special

- **功能域**: events
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 4505

#### get /api/special-events/requests

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 5359

#### post /api/special-events/requests

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 5381

#### patch /api/special-events/requests/:id

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 5440

#### post /api/events/remove-special

- **功能域**: events
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 5540

#### post /api/proxy/google-sheets

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: GoogleSheets
- **行號**: 5691

#### post /api/teacher-web-api

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 5804

#### post /api/teacher-report

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: GoogleSheets
- **行號**: 5857

#### get /api/teacher-report/status

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 6040

#### post /api/student-attendance-notification

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 5
- **依賴**: 無
- **行號**: 6302

#### get /api/notification-config

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 6439

#### post /api/notification-config/reload

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 6456

#### get /api/teacher-group-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 6477

#### put /api/teacher-group-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 6511

#### post /api/notification-config/test

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 6573

#### get /

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 6607

#### post /api/attendance/fast

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 3
- **依賴**: GoogleSheets, FileSystem
- **行號**: 6625

#### post /api/attendance/clear-cache

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 6914

#### get /api/course-history

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 6931

#### get /api/course-history/audit

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 6957

#### post /api/course-history/clear-cache

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 6975

#### post /api/leave-attendance

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7000

#### delete /api/leave-attendance

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7218

#### get /api/attendance-status

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 7282

#### post /api/notify-leave

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7312

#### post /api/check-class-absence

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 7369

#### post /api/notify-class-cancellation

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7513

#### post /api/notify-class-resumption

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7652

#### get /api/leave-records

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 7793

#### put /api/leave-records/:id

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: GoogleSheets, FileSystem
- **行號**: 7828

#### get /api/attendance/debug/students

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 8245

#### get /api/students/from-sheets

- **功能域**: students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: GoogleSheets
- **行號**: 8305

#### post /api/students/clear-cache

- **功能域**: students
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 8335

#### get /api/students/by-course

- **功能域**: students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: GoogleSheets
- **行號**: 8360

#### post /api/attendance/queue

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 8395

#### get /api/attendance/queue/stats

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 8741

#### post /api/attendance/queue/retry-failed

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 8758

#### post /api/update-student-attendance

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 8778

#### get /api/admin/student-sheet

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 9020

#### get /api/admin/groups

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 9041

#### patch /api/admin/student-sheet/:row

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 9062

#### post /api/admin/student-sheet

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 9136

#### delete /api/admin/student-sheet/:row

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 9190

#### post /api/update-student-data

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 9233

#### get /api/student-data

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 9266

#### get /api/system-status

- **功能域**: system
- **優先級**: 3
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9311

#### get /api/student-data-sync/settings

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9369

#### post /api/student-data-sync/settings

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 9394

#### post /api/student-data-sync/trigger

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9431

#### post /api/student-data-sync/stop

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9447

#### post /api/student-data-sync/start

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9475

#### post /api/update-course-data

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9496

#### post /api/update-multiple-courses

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9554

#### get /api/teachers

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9623

#### put /api/teachers

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9660

#### post /api/teacher-binding

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9734

#### post /api/quick-bind-by-userid

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9840

#### get /api/settings/teachers

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 9886

#### post /api/settings/teachers

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9918

#### get /api/settings/teacher-list

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9971

#### post /api/settings/teacher-list

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 10000

#### get /api/settings/system

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 10060

#### post /api/settings/system

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 10082

#### post /api/teacher-unbinding

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 10128

#### post /api/templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 10441

#### get /api/templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 10475

#### get /api/flex-templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 10579

#### post /api/flex-templates/reload

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 2
- **依賴**: 無
- **行號**: 10616

#### post /api/flex-templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 10631

#### post /api/flex-templates/:type/send-test

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 10683

#### post /api/flex-templates/student/send-test-multi

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 4
- **依賴**: 無
- **行號**: 10816

#### get /api/calendar-events

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 10944

#### get /api/reminders

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 10999

#### post /api/reminders

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 11037

#### post /api/reminders/:id/send

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 11240

#### post /api/reminders/:id/send-test

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 5
- **依賴**: NotificationManager
- **行號**: 11684

#### post /api/student-reminders/:id/send-test

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 5
- **依賴**: 無
- **行號**: 11812

#### post /api/quick-reply/attendance

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 11919

#### post /api/student-responses

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 11999

#### get /api/student-responses

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 12350

#### get /api/student-responses/summary

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 12379

#### get /api/daily-attendance-reports

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 12701

#### post /api/daily-attendance-report/trigger

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 12720

#### post /api/reminder-scheduler/preflight

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 12744

#### post /api/student-responses/cleanup

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 12796

#### get /api/student-responses/export.xlsx

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 12820

#### post /webhook/line

- **功能域**: webhook
- **優先級**: 2
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 12935

#### put /api/reminders/:id

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 13416

#### delete /api/reminders/:id

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 13485

#### post /api/reminder-scheduler/start

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 13556

#### post /api/reminder-scheduler/stop

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 13575

#### get /api/reminder-scheduler/status

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 13591

#### get /api/students

- **功能域**: students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 13608

#### get /api/parent-users

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 13694

#### post /api/temporary-students/backup

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 13714

#### get /api/temporary-students/backups

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 13738

#### post /api/temporary-students/restore

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 13793

#### get /api/temporary-students

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 13846

#### get /api/temporary-students/archive

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: 無
- **行號**: 13892

#### post /api/temporary-students

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: LINE, FileSystem
- **行號**: 13996

#### put /api/temporary-students/:id

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 14186

#### delete /api/temporary-students/:id

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 14254

#### post /api/send-temporary-student-notification

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: LINE, FileSystem
- **行號**: 14284

#### get /api/student-reminders

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 14403

#### post /api/student-reminders

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 14428

#### post /api/student-reminders/:id/send

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: NotificationManager, LINE
- **行號**: 14465

#### post /api/student-reminders/batch-send

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 14594

#### get /api/student-reminder-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 14742

#### post /api/reminders/reset-today

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 14773

#### post /api/reminders/reset-before-class

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 14823

#### post /api/reminders/reset-by-calendar

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 14882

#### post /api/reminders/reset-before-class-by-calendar

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 14940

#### post /api/reminders/reset-before-class-individual

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15013

#### post /api/reminders/cleanup

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 15114

#### post /api/student-reminder-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15133

#### get /api/schedule-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 15185

#### post /api/schedule-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15241

#### get /api/timezone-debug

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15321

#### get /api/reminder-scheduler/diagnostic

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 15402

#### post /api/reminder-scheduler/run

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 15483

#### post /api/reminder-scheduler/generate-student-reminders

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15500

#### post /api/reminder-scheduler/test

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 15525

#### post /api/reminder-scheduler/midnight-cleanup

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 15581

#### post /api/reminders/retry-failed

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15602

#### post /api/reminders/batch-send

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: LINE
- **行號**: 15658

#### post /api/calendar/force-refresh

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15961

#### get /api/address-mappings

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 15991

#### post /api/address-mappings

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16025

#### post /api/admin/login

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 16089

#### get /api/admin/system-settings

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 16114

#### post /api/admin/system-settings

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16131

#### get /api/admin/student-reminder-settings

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 16173

#### post /api/admin/student-reminder-settings

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16191

#### get /api/admin/teacher-data

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 16218

#### post /api/admin/teacher-data/add

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16236

#### post /api/admin/teacher-data/delete

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16277

#### get /api/admin/teacher-list-data

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16318

#### post /api/admin/backup/create

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16343

#### get /api/admin/backup/history

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16381

#### post /api/admin/backup/restore

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16417

#### post /api/admin/test-reminder

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 16467

#### get /api/course-sync/notion/config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16486

#### post /api/course-sync/notion/config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16506

#### post /api/course-sync/notion/test

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16526

#### get /api/course-sync/notion/properties

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16543

#### post /api/course-sync/notion/mappings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16561

#### post /api/course-sync/notion/secret

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 16578

#### post /api/course-sync/notion/import

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16612

#### post /api/course-sync/notion/export

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16629

#### post /api/course-sync/notion/preview

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16646

#### get /api/course-sync/notion/logs

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16662

#### delete /api/course-sync/notion/logs

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16679

#### /api/v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: LINE, FileSystem
- **行號**: 16709

#### /api/v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: LINE, FileSystem
- **行號**: 16711

#### /api/v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 16725

#### /api/v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 16735

#### get /api/admin/info

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 16743

#### post /api/admin/set

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 16774

#### post /api/test-line-notification

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: LINE
- **行號**: 16836

#### get /api/system-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16908

#### post /api/system-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 16935

#### get /api/course-colors

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 16989

#### get /api/student-filter-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17043

#### post /api/student-filter-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 17103

#### post /api/calendar-config

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17149

#### post /api/reminder-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17205

#### get /api/line-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: LINE
- **行號**: 17269

#### post /api/line-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: LINE, FileSystem
- **行號**: 17296

#### get /api/special-events-config

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 17402

#### post /api/special-events-config

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17421

#### get /api/special-event-types

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17478

#### get /api/special-event-keywords

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 17557

#### post /api/detect-special-event

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 17585

#### post /api/detect-batch-events

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 17635

#### get /api/google-api-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 17700

#### post /api/google-api-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 17715

#### post /api/events/clear-cache

- **功能域**: events
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 17729

#### post /api/cache/clear-all

- **功能域**: system
- **優先級**: 3
- **複雜度**: 2
- **依賴**: 無
- **行號**: 17742

#### get /api/learning-records/today-completed-courses

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18160

#### post /api/drive-upload/init

- **功能域**: drive-upload
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18848

#### post /api/drive-upload/chunk

- **功能域**: drive-upload
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18849

#### post /api/drive-upload/complete

- **功能域**: drive-upload
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18850

#### post /api/media/videos/init

- **功能域**: media
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18852

#### post /api/media/videos/chunk

- **功能域**: media
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18853

#### post /api/media/videos/complete

- **功能域**: media
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18854

#### get /api/drive-media/records

- **功能域**: drive-media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18874

#### get /api/drive-media/records/:recordId

- **功能域**: drive-media
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 18904

#### get /api/media/videos

- **功能域**: media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18921

#### get /api/media/videos/:recordId

- **功能域**: media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18922

#### get /api/media/videos/:recordId/download

- **功能域**: media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18923

#### get /api/media/videos/:recordId/thumbnail

- **功能域**: media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18924

#### post /api/learning-records/save

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18929

#### /api/learning-records/upload-drive undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 19066

#### post /api/learning-records/upload-drive

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 19112

#### get /api/learning-records/history-drive

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19362

#### get /api/learning-records/index/course

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 19434

#### get /api/learning-records/index

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 19469

#### delete /api/learning-records/drive/*

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19489

#### post /api/learning-records/drive/batch-delete

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 19556

#### get /api/media/photos/:photoId/preview

- **功能域**: media
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19615

#### get /api/media/photos/:photoId/original

- **功能域**: media
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19700

#### get /api/drive-media/*

- **功能域**: drive-media
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19773

#### post /api/drive-media/url

- **功能域**: drive-media
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 19903

#### get /health

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 19944

#### get /api/debug/video-status

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 19981

#### post /api/clean-metadata

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 20118

#### post /api/clean-all-metadata

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 20228

#### get /student_data.json

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3056

#### /frontend-v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3101

#### get /

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3104

#### get /perfect-calendar-optimized-complete2.html/

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3109

#### get /api/flex-templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3478

#### get /api/health

- **功能域**: system
- **優先級**: 3
- **複雜度**: 1
- **依賴**: 無
- **行號**: 3506

#### get /api/holidays

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 2
- **依賴**: 無
- **行號**: 3520

#### get /api/holidays/check/:date

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3540

#### get /api/holidays/:year/:month

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3562

#### post /api/holidays/sync

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3594

#### get /api/holidays/status

- **功能域**: holidays
- **優先級**: 3
- **複雜度**: 2
- **依賴**: 無
- **行號**: 3615

#### get /api/logs

- **功能域**: system
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 3635

#### get /api/system-time

- **功能域**: system
- **優先級**: 3
- **複雜度**: 4
- **依賴**: 無
- **行號**: 3894

#### get /api/leave-notification-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 3962

#### post /api/leave-notification-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 3994

#### get /api/timer-countdowns

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 4056

#### get /api/events

- **功能域**: events
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 4253

#### post /api/events/refresh-cache

- **功能域**: events
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 4466

#### get /api/events/cache-status

- **功能域**: events
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 4487

#### post /api/events/mark-special

- **功能域**: events
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 4505

#### get /api/special-events/requests

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 5359

#### post /api/special-events/requests

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 5381

#### patch /api/special-events/requests/:id

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 5440

#### post /api/events/remove-special

- **功能域**: events
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 5540

#### post /api/proxy/google-sheets

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: GoogleSheets
- **行號**: 5691

#### post /api/teacher-web-api

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 5804

#### post /api/teacher-report

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: GoogleSheets
- **行號**: 5857

#### get /api/teacher-report/status

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 6040

#### post /api/student-attendance-notification

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 5
- **依賴**: 無
- **行號**: 6302

#### get /api/notification-config

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 6439

#### post /api/notification-config/reload

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 6456

#### get /api/teacher-group-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 6477

#### put /api/teacher-group-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 6511

#### post /api/notification-config/test

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 6573

#### get /

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 6607

#### post /api/attendance/fast

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 3
- **依賴**: GoogleSheets, FileSystem
- **行號**: 6625

#### post /api/attendance/clear-cache

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 6914

#### get /api/course-history

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 6931

#### get /api/course-history/audit

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 6957

#### post /api/course-history/clear-cache

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 6975

#### post /api/leave-attendance

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7000

#### delete /api/leave-attendance

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7218

#### get /api/attendance-status

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 7282

#### post /api/notify-leave

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7312

#### post /api/check-class-absence

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 7369

#### post /api/notify-class-cancellation

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7513

#### post /api/notify-class-resumption

- **功能域**: notifications
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 7652

#### get /api/leave-records

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 7793

#### put /api/leave-records/:id

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: GoogleSheets, FileSystem
- **行號**: 7828

#### get /api/attendance/debug/students

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 8245

#### get /api/students/from-sheets

- **功能域**: students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: GoogleSheets
- **行號**: 8305

#### post /api/students/clear-cache

- **功能域**: students
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 8335

#### get /api/students/by-course

- **功能域**: students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: GoogleSheets
- **行號**: 8360

#### post /api/attendance/queue

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 8395

#### get /api/attendance/queue/stats

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 8741

#### post /api/attendance/queue/retry-failed

- **功能域**: attendance
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 8758

#### post /api/update-student-attendance

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 8778

#### get /api/admin/student-sheet

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 9020

#### get /api/admin/groups

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 9041

#### patch /api/admin/student-sheet/:row

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 9062

#### post /api/admin/student-sheet

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 9136

#### delete /api/admin/student-sheet/:row

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 9190

#### post /api/update-student-data

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 9233

#### get /api/student-data

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 9266

#### get /api/system-status

- **功能域**: system
- **優先級**: 3
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9311

#### get /api/student-data-sync/settings

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9369

#### post /api/student-data-sync/settings

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 9394

#### post /api/student-data-sync/trigger

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9431

#### post /api/student-data-sync/stop

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9447

#### post /api/student-data-sync/start

- **功能域**: students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9475

#### post /api/update-course-data

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9496

#### post /api/update-multiple-courses

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9554

#### get /api/teachers

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9623

#### put /api/teachers

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9660

#### post /api/teacher-binding

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9734

#### post /api/quick-bind-by-userid

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9840

#### get /api/settings/teachers

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 9886

#### post /api/settings/teachers

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 9918

#### get /api/settings/teacher-list

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 9971

#### post /api/settings/teacher-list

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 10000

#### get /api/settings/system

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 10060

#### post /api/settings/system

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 10082

#### post /api/teacher-unbinding

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 10128

#### post /api/templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 10441

#### get /api/templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 10475

#### get /api/flex-templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 10579

#### post /api/flex-templates/reload

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 2
- **依賴**: 無
- **行號**: 10616

#### post /api/flex-templates

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 10631

#### post /api/flex-templates/:type/send-test

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 3
- **依賴**: 無
- **行號**: 10683

#### post /api/flex-templates/student/send-test-multi

- **功能域**: templates
- **優先級**: 3
- **複雜度**: 4
- **依賴**: 無
- **行號**: 10816

#### get /api/calendar-events

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 10944

#### get /api/reminders

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 10999

#### post /api/reminders

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 11037

#### post /api/reminders/:id/send

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 11240

#### post /api/reminders/:id/send-test

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 5
- **依賴**: NotificationManager
- **行號**: 11684

#### post /api/student-reminders/:id/send-test

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 5
- **依賴**: 無
- **行號**: 11812

#### post /api/quick-reply/attendance

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 11919

#### post /api/student-responses

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 11999

#### get /api/student-responses

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 12350

#### get /api/student-responses/summary

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 12379

#### get /api/daily-attendance-reports

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 12701

#### post /api/daily-attendance-report/trigger

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 12720

#### post /api/reminder-scheduler/preflight

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 12744

#### post /api/student-responses/cleanup

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 12796

#### get /api/student-responses/export.xlsx

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 12820

#### post /webhook/line

- **功能域**: webhook
- **優先級**: 2
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 12935

#### put /api/reminders/:id

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 13416

#### delete /api/reminders/:id

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 13485

#### post /api/reminder-scheduler/start

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 13556

#### post /api/reminder-scheduler/stop

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 13575

#### get /api/reminder-scheduler/status

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 13591

#### get /api/students

- **功能域**: students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 13608

#### get /api/parent-users

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 13694

#### post /api/temporary-students/backup

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 13714

#### get /api/temporary-students/backups

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 13738

#### post /api/temporary-students/restore

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 13793

#### get /api/temporary-students

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 13846

#### get /api/temporary-students/archive

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: 無
- **行號**: 13892

#### post /api/temporary-students

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: LINE, FileSystem
- **行號**: 13996

#### put /api/temporary-students/:id

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 14186

#### delete /api/temporary-students/:id

- **功能域**: temporary-students
- **優先級**: 2
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 14254

#### post /api/send-temporary-student-notification

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: LINE, FileSystem
- **行號**: 14284

#### get /api/student-reminders

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 14403

#### post /api/student-reminders

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 14428

#### post /api/student-reminders/:id/send

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: NotificationManager, LINE
- **行號**: 14465

#### post /api/student-reminders/batch-send

- **功能域**: student-reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 14594

#### get /api/student-reminder-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 14742

#### post /api/reminders/reset-today

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: 無
- **行號**: 14773

#### post /api/reminders/reset-before-class

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 14823

#### post /api/reminders/reset-by-calendar

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 14882

#### post /api/reminders/reset-before-class-by-calendar

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 14940

#### post /api/reminders/reset-before-class-individual

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15013

#### post /api/reminders/cleanup

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 2
- **依賴**: 無
- **行號**: 15114

#### post /api/student-reminder-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15133

#### get /api/schedule-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 15185

#### post /api/schedule-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15241

#### get /api/timezone-debug

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15321

#### get /api/reminder-scheduler/diagnostic

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: FileSystem
- **行號**: 15402

#### post /api/reminder-scheduler/run

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 15483

#### post /api/reminder-scheduler/generate-student-reminders

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15500

#### post /api/reminder-scheduler/test

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 15525

#### post /api/reminder-scheduler/midnight-cleanup

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 15581

#### post /api/reminders/retry-failed

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15602

#### post /api/reminders/batch-send

- **功能域**: reminders
- **優先級**: 2
- **複雜度**: 3
- **依賴**: LINE
- **行號**: 15658

#### post /api/calendar/force-refresh

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 15961

#### get /api/address-mappings

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 15991

#### post /api/address-mappings

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16025

#### post /api/admin/login

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 16089

#### get /api/admin/system-settings

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 16114

#### post /api/admin/system-settings

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16131

#### get /api/admin/student-reminder-settings

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 16173

#### post /api/admin/student-reminder-settings

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16191

#### get /api/admin/teacher-data

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 16218

#### post /api/admin/teacher-data/add

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16236

#### post /api/admin/teacher-data/delete

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16277

#### get /api/admin/teacher-list-data

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16318

#### post /api/admin/backup/create

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16343

#### get /api/admin/backup/history

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16381

#### post /api/admin/backup/restore

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16417

#### post /api/admin/test-reminder

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 16467

#### get /api/course-sync/notion/config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16486

#### post /api/course-sync/notion/config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16506

#### post /api/course-sync/notion/test

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16526

#### get /api/course-sync/notion/properties

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16543

#### post /api/course-sync/notion/mappings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16561

#### post /api/course-sync/notion/secret

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 16578

#### post /api/course-sync/notion/import

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16612

#### post /api/course-sync/notion/export

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16629

#### post /api/course-sync/notion/preview

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16646

#### get /api/course-sync/notion/logs

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16662

#### delete /api/course-sync/notion/logs

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 16679

#### /api/v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: LINE, FileSystem
- **行號**: 16709

#### /api/v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: LINE, FileSystem
- **行號**: 16711

#### /api/v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 16725

#### /api/v2 undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 16735

#### get /api/admin/info

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 3
- **依賴**: LINE, FileSystem
- **行號**: 16743

#### post /api/admin/set

- **功能域**: admin
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 16774

#### post /api/test-line-notification

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: LINE
- **行號**: 16836

#### get /api/system-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 16908

#### post /api/system-settings

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 16935

#### get /api/course-colors

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 16989

#### get /api/student-filter-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17043

#### post /api/student-filter-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: FileSystem
- **行號**: 17103

#### post /api/calendar-config

- **功能域**: calendar
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17149

#### post /api/reminder-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17205

#### get /api/line-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: LINE
- **行號**: 17269

#### post /api/line-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: LINE, FileSystem
- **行號**: 17296

#### get /api/special-events-config

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 17402

#### post /api/special-events-config

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17421

#### get /api/special-event-types

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 17478

#### get /api/special-event-keywords

- **功能域**: special-events
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 17557

#### post /api/detect-special-event

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 17585

#### post /api/detect-batch-events

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 17635

#### get /api/google-api-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 17700

#### post /api/google-api-config

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: FileSystem
- **行號**: 17715

#### post /api/events/clear-cache

- **功能域**: events
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 17729

#### post /api/cache/clear-all

- **功能域**: system
- **優先級**: 3
- **複雜度**: 2
- **依賴**: 無
- **行號**: 17742

#### get /api/learning-records/today-completed-courses

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18160

#### post /api/drive-upload/init

- **功能域**: drive-upload
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18848

#### post /api/drive-upload/chunk

- **功能域**: drive-upload
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18849

#### post /api/drive-upload/complete

- **功能域**: drive-upload
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18850

#### post /api/media/videos/init

- **功能域**: media
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18852

#### post /api/media/videos/chunk

- **功能域**: media
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18853

#### post /api/media/videos/complete

- **功能域**: media
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 18854

#### get /api/drive-media/records

- **功能域**: drive-media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18874

#### get /api/drive-media/records/:recordId

- **功能域**: drive-media
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 18904

#### get /api/media/videos

- **功能域**: media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18921

#### get /api/media/videos/:recordId

- **功能域**: media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18922

#### get /api/media/videos/:recordId/download

- **功能域**: media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18923

#### get /api/media/videos/:recordId/thumbnail

- **功能域**: media
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18924

#### post /api/learning-records/save

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 18929

#### /api/learning-records/upload-drive undefined

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 2
- **依賴**: 無
- **行號**: 19066

#### post /api/learning-records/upload-drive

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 19112

#### get /api/learning-records/history-drive

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19362

#### get /api/learning-records/index/course

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 19434

#### get /api/learning-records/index

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 19469

#### delete /api/learning-records/drive/*

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19489

#### post /api/learning-records/drive/batch-delete

- **功能域**: learning-records
- **優先級**: 1
- **複雜度**: 4
- **依賴**: 無
- **行號**: 19556

#### get /api/media/photos/:photoId/preview

- **功能域**: media
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19615

#### get /api/media/photos/:photoId/original

- **功能域**: media
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19700

#### get /api/drive-media/*

- **功能域**: drive-media
- **優先級**: 1
- **複雜度**: 5
- **依賴**: 無
- **行號**: 19773

#### post /api/drive-media/url

- **功能域**: drive-media
- **優先級**: 1
- **複雜度**: 3
- **依賴**: 無
- **行號**: 19903

#### get /health

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 1
- **依賴**: 無
- **行號**: 19944

#### get /api/debug/video-status

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 19981

#### post /api/clean-metadata

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 20118

#### post /api/clean-all-metadata

- **功能域**: unknown
- **優先級**: 1
- **複雜度**: 4
- **依賴**: FileSystem
- **行號**: 20228

