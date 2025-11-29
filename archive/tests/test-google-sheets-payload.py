import requests
import json

url = "https://script.google.com/macros/s/AKfycbyDg0tcYZgovEF1PbgVUvB8fmiVCckuer75-qNuXmCRY5CTEVEOVaShazjcUryeyUN6/exec"

# 測試 1: 使用用戶提供的欄位名稱 "人數_助教"
print("=" * 80)
print("測試 1: 使用欄位名稱 '人數_助教'")
print("=" * 80)
payload1 = json.dumps({
    "action": "appendTeacherCourse",
    "sheetName": "報表",
    "teacherName": "Ted",
    "課程名稱": "AI 課前導讀 [測試1]",
    "上課時間": "15:00-16:30",
    "課程日期": "2025/10/02",
    "人數_助教": "10",
    "課程內容": "測試1: 使用人數_助教欄位"
})
headers = {
    'Content-Type': 'application/json'
}

try:
    response1 = requests.post(url, headers=headers, data=payload1, timeout=10)
    print(f"狀態碼: {response1.status_code}")
    print(f"回應內容: {response1.text}")
except Exception as e:
    print(f"錯誤: {e}")

print("\n")

# 測試 2: 使用 server.js 中的欄位名稱 "助教/學生"
print("=" * 80)
print("測試 2: 使用欄位名稱 '助教/學生'")
print("=" * 80)
payload2 = json.dumps({
    "action": "appendTeacherCourse",
    "sheetName": "報表",
    "teacherName": "Ted",
    "課程名稱": "AI 課前導讀 [測試2]",
    "上課時間": "15:00-16:30",
    "課程日期": "2025/10/02",
    "助教/學生": "20",
    "課程內容": "測試2: 使用助教/學生欄位"
})

try:
    response2 = requests.post(url, headers=headers, data=payload2, timeout=10)
    print(f"狀態碼: {response2.status_code}")
    print(f"回應內容: {response2.text}")
except Exception as e:
    print(f"錯誤: {e}")

print("\n")

# 測試 3: 同時使用兩個欄位名稱
print("=" * 80)
print("測試 3: 同時使用兩個欄位名稱")
print("=" * 80)
payload3 = json.dumps({
    "action": "appendTeacherCourse",
    "sheetName": "報表",
    "teacherName": "Ted",
    "課程名稱": "AI 課前導讀 [測試3]",
    "上課時間": "15:00-16:30",
    "課程日期": "2025/10/02",
    "人數_助教": "30",
    "助教/學生": "30",
    "課程內容": "測試3: 同時使用兩個欄位"
})

try:
    response3 = requests.post(url, headers=headers, data=payload3, timeout=10)
    print(f"狀態碼: {response3.status_code}")
    print(f"回應內容: {response3.text}")
except Exception as e:
    print(f"錯誤: {e}")

print("\n" + "=" * 80)
print("測試完成！請檢查 Google Sheets 中的資料")
print("=" * 80)






