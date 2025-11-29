/** ======================================
 *  FLB Web API (Batch + Cache, measured)
 *  時區：Asia/Taipei
 *  ====================================== */

const USE_ADV = true; // 一鍵回退開關（false 走 SpreadsheetApp 舊路徑）

/* ----------------- Teacher Bindings 相關函數 ----------------- */
const TB_HEADERS = ['id','userId','teacherName','teacherId','boundAt','isActive'];

function _normalizeTB(s){
  if (s == null) return '';
  s = String(s).trim();
  const f='！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～　';
  const h='!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ';
  return s.replace(/[\uFF01-\uFF5E\u3000]/g, ch => h[f.indexOf(ch)]);
}
function _nowIsoTB(){
  const tz = Session.getScriptTimeZone() || 'Asia/Taipei';
  return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");
}
function _ensureSheetTB(ss, name){
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const first = sheet.getRange(1,1,1,TB_HEADERS.length).getValues()[0];
  const blank = first.every(v => String(v).trim() === '');
  if (blank || _normalizeTB(first[0]) !== 'id'){
    sheet.clear();
    sheet.getRange(1,1,1,TB_HEADERS.length).setValues([TB_HEADERS]);
    try{
      sheet.getRange(1,1,1,TB_HEADERS.length)
        .setBackground('#FFF400').setFontWeight('bold').setHorizontalAlignment('center');
    }catch(_){}
  }
  return sheet;
}
function _rowToObjTB(header,row){ const o={}; header.forEach((k,i)=>o[k]=row[i]); return o; }

function _pickTB(p, key){
  const alias = {
    id: ['id','bindingId','bindId'],
    userId: ['userId','uid','user_id','User ID'],
    teacherName: ['teacherName','teacher_name','tName'],
    teacherId: ['teacherId','teacher_id','tid'],
    boundAt: ['boundAt','bound_at','boundTime','bound_time'],
    isActive: ['isActive','active','enabled','is_active']
  }[key] || [key];
  for (const k of alias) if (p[k] != null) return p[k];
  return undefined;
}

function _findRowTB(sheet, header, data, rec){
  const id = _normalizeTB(String(_pickTB(rec,'id') || ''));
  if (id){
    for (let r=1; r<data.length; r++){
      if (_normalizeTB(String(data[r][0] || '')) === id) return r+1;
    }
    return -1;
  }
  const uid = _normalizeTB(String(_pickTB(rec,'userId') || ''));
  const tid = _normalizeTB(String(_pickTB(rec,'teacherId') || ''));
  if (!uid || !tid) return -2;
  const uidIdx = header.indexOf('userId');
  const tidIdx = header.indexOf('teacherId');
  for (let r=1; r<data.length; r++){
    if (_normalizeTB(String(data[r][uidIdx]||''))===uid &&
        _normalizeTB(String(data[r][tidIdx]||''))===tid){
      return r+1;
    }
  }
  return 0;
}

function _toBooleanTB(val){
  if (typeof val === 'boolean') return val;
  const s = _normalizeTB(String(val)).toLowerCase();
  if (s === '') return null;
  return ['1','true','yes','y','t','on'].includes(s);
}

function _upsertOneBindingTB(sheet, header, rec){
  const data = sheet.getDataRange().getValues();
  const rowNo = _findRowTB(sheet, header, data, rec);
  if (rowNo === -2) return {success:false, message:'缺少必要參數：userId 或 teacherId', input: rec};

  const base = (rowNo > 1) ? data[rowNo-1] : new Array(header.length).fill('');

  const next = header.map((col, i)=>{
    let v = _pickTB(rec, col);
    if (v === undefined || v === null || String(v) === ''){
      if (rowNo <= 1){
        if (col === 'id'){
          const providedId = _pickTB(rec,'id');
          return providedId ? String(providedId) : Utilities.getUuid();
        }
        if (col === 'boundAt') return _nowIsoTB();
        if (col === 'isActive') return true;
      }
      return base[i];
    }
    if (col === 'isActive'){
      const b = _toBooleanTB(v);
      return (b === null) ? base[i] : b;
    }
    return v;
  });

  if (rowNo > 1){
    const oldObj = _rowToObjTB(header, base);
    sheet.getRange(rowNo,1,1,next.length).setValues([next]);
    const newObj = _rowToObjTB(header, next);
    const diffs = [];
    TB_HEADERS.forEach(k=>{
      if (String(oldObj[k]) !== String(newObj[k])) diffs.push({field:k, old:oldObj[k], new:newObj[k]});
    });
    return {success:true, action:'update', rowNumber:rowNo, differences:diffs};
  }else{
    sheet.appendRow(next);
    const newRow = sheet.getLastRow();
    return {success:true, action:'insert', rowNumber:newRow, newData:_rowToObjTB(header,next)};
  }
}

function upsertTeacherBindings_(payload){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = payload.sheetName || '講師綁定表 (teacher_bindings)';
  const sheet = _ensureSheetTB(ss, sheetName);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    const header = TB_HEADERS.slice();
    const records = Array.isArray(payload.list) && payload.list.length ? payload.list : [payload];
    const results = records.map(r => _upsertOneBindingTB(sheet, header, r));
    return {success: results.every(x=>x.success), count: results.length, results};
  }finally{
    lock.releaseLock();
  }
}

/* ----------------- Advanced Sheets 別名 ----------------- */
const SheetsAPI = Sheets.Spreadsheets;
const ValuesAPI = Sheets.Spreadsheets.Values;

/* ----------------- 常數與設定 ----------------- */
const TZ = "Asia/Taipei";              // 統一用 IANA（內部格式化時一律轉 yyyy-MM-dd）
const CACHE_TTL = 300;                 // 5 分鐘
const CACHE_ITEM_LIMIT = 90000;        // ScriptCache 單筆安全字數上限（約 100KB 前先截斷）
const CACHE_STUDENTS = true;           // 若學生名單很大想完全不快取 → 改成 false
const ROSTER_ROW_FETCH_THRESHOLD = 20; // 名單 ≤20 時逐列抓，否則一次矩陣抓
const LINK_SHEET_NAMES = ["上課時間(link calender）", "上課時間(link calender)"];

/* ----------------- 小工具 ----------------- */


const OVERGRID_CACHE_TTL = 300; // 5 分鐘

function _cacheKeyOvergrid(ssid, sheetName, col) {
  const v = "v1"; // 日後若欄位規則改變可調版本
  return `overgrid::${v}::${ssid}::${sheetName}::${col}`;
}

/** 讀取（含快取）Over-grid 圖片 URL 對照表：row → string[]urls */
function getOverGridUrlsCached(sheetName, targetCol1based, folderIdOpt) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ssid = ss.getId();
  const cache = CacheService.getScriptCache();
  const key = _cacheKeyOvergrid(ssid, sheetName, targetCol1based);

  const hit = cache.get(key);
  if (hit) {
    try { return new Map(JSON.parse(hit)); } catch (e) {/* fallthrough */}
  }

  // miss → 掃一次、（有 folderId 才）上傳、快取
  const mapObj = Array.from(
    getOverGridImageUrlsByColumn(sheetName, targetCol1based, folderIdOpt).entries()
  ); // [ [row, [urls...]], ... ]
  cache.put(key, JSON.stringify(mapObj), OVERGRID_CACHE_TTL);
  return new Map(mapObj);
}


/** ===== Cache 與小工具 ===== */
const META_CACHE_TTL = 300; // 秒（5 分鐘）

function _scriptCache() {
  return CacheService.getScriptCache();
}

function _cacheKeyMeta(ssid, course) {
  // 避免同名試算表或版本衝突，可加版本號
  const v = "v1";
  return `meta::${v}::${ssid}::${course}`;
}

// Excel/Sheets 序號 → yyyy-MM-dd（不含時區偏移時差）
function serialToYMD(v, tz) {
  if (typeof v === "number" && !isNaN(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return Utilities.formatDate(new Date(ms), tz || "Asia/Taipei", "yyyy-MM-dd");
  }
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

// 1-based 欄號 → A1 欄字母
function toA1Col(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - 1 - m) / 26;
  }
  return s;
}


/** 在 headerRow 讀整列表頭，回傳第一個匹配到的欄索引（1-based）。找不到回 -1 */
function findColByHeader(sheet, headerRow, candidates){
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0]
                    .map(s => String(s||"").trim());
  const set = new Set(candidates.map(s => String(s).trim()));
  for (let i=0;i<headers.length;i++){
    if (set.has(headers[i])) return i+1;  // 1-based index
  }
  return -1;
}


function jsonOutput(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function toA1(r, c){
  let col="";
  while(c>0){
    const m=(c-1)%26;
    col=String.fromCharCode(65+m)+col;
    c=Math.floor((c-1)/26);
  }
  return col+String(r);
}
function escapeSheet(name){
  return name.includes(" ")||name.includes("'") ? "'" + name.replace(/'/g,"''") + "'" : name;
}
function withRetry(fn, times=3, base=200){
  for (let i=0;i<times;i++){
    try { return fn(); } catch (e){
      const msg=String(e);
      if (i===times-1 || !/429|Rate Limit|Internal|Service unavailable/i.test(msg)) throw e;
      Utilities.sleep(base*Math.pow(2,i));
    }
  }
}
function safeGetSheetByNames(ss, names){
  for (const n of names){ const sh=ss.getSheetByName(n); if (sh) return sh; }
  return null;
}
function fmtDate(d){ return Utilities.formatDate(new Date(d), TZ, "yyyy-MM-dd"); }

/* ====== 日期解析強韌版 ====== */
// 清洗各式字串日期：移除括號內容、中文時段詞、非必要字元
function cleanDateText(s) {
  return String(s || "")
    .replace(/[（(][^)）]*[)）]/g, "")      // 括號與其內文
    .replace(/上午|下午|早上|晚上|中午/g, "") // 中文時段詞
    .replace(/[^\d\/\-\.,]/g, "")          // 保留數字 / - . 逗號
    .split(",")[0]                         // 逗號分隔只取第一個
    .replace(/\./g, "/")                   // 轉成常見分隔
    .trim();
}

// 把任何（Date/序號/文字）盡量轉成 yyyy-MM-dd（失敗回空字串）
function parseDateFlexible(cell, tz) {
  if (cell == null) return "";

  // A) Date 物件
  if (Object.prototype.toString.call(cell) === "[object Date]" && !isNaN(cell)) {
    return Utilities.formatDate(cell, tz || TZ, "yyyy-MM-dd");
  }

  // B) Sheets 日期序號（number）
  if (typeof cell === "number" && !isNaN(cell)) {
    const ms = Math.round((cell - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    if (!isNaN(dt)) return Utilities.formatDate(dt, tz || TZ, "yyyy-MM-dd");
    return "";
  }

  // C) 文字
  if (typeof cell === "string") {
    const raw = cleanDateText(cell);
    if (!raw) return "";

    // yyyy/mm/dd or yyyy-mm-dd
    let m = raw.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (m) {
      const y=+m[1], mo=+m[2], d=+m[3];
      const dt=new Date(y, mo-1, d);
      if (!isNaN(dt)) return Utilities.formatDate(dt, tz || TZ, "yyyy-MM-dd");
      return "";
    }

    // mm/dd 或 m/d（推斷年份）
    m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
    if (m) {
      const now = new Date();
      const curY = now.getFullYear();
      let mo = +m[1], d = +m[2], y = curY;
      if (mo >= (now.getMonth()+1) + 7) y = curY - 1; // 簡易跨年推斷
      const dt=new Date(y, mo-1, d);
      if (!isNaN(dt)) return Utilities.formatDate(dt, tz || TZ, "yyyy-MM-dd");
      return "";
    }

    // 其他可被 Date() 吞的格式
    const dt = new Date(raw);
    if (!isNaN(dt)) return Utilities.formatDate(dt, tz || TZ, "yyyy-MM-dd");
  }

  return "";
}

// 提供 fallback 的 robust 版本（必要時用 displayValue 再試一次）
function normDateCellRobust(cellValue, fallbackDisplayValue, tz) {
  let s = parseDateFlexible(cellValue, tz);
  if (s) return s;
  if (fallbackDisplayValue != null) {
    s = parseDateFlexible(fallbackDisplayValue, tz);
    if (s) return s;
  }
  return "";
}

/* ====== 與舊程式相容：重寫 fmtCellDate，內部走強韌解析 ====== */
function fmtCellDate(d) {
  return parseDateFlexible(d, TZ);
}

/* ====== 也保留舊的「將儲存格值轉 Date」工具，以供其他情境使用 ====== */
function gsCellToDate(v) {
  if (v instanceof Date) return v;

  if (typeof v === 'number' && !isNaN(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms);
  }

  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;

    if (/^\d+(\.\d+)?$/.test(s)) {
      const num = parseFloat(s);
      const ms = Math.round((num - 25569) * 86400 * 1000);
      return new Date(ms);
    }

    const cleaned = s
      .replace(/[（(][^)）]*[)）]/g, '')
      .replace(/上午|下午|早上|晚上|中午/g, '')
      .replace(/\./g, '/')
      .trim();

    const cand = new Date(cleaned);
    if (!isNaN(cand.getTime())) return cand;
  }
  return null;
}

// 取「上課時間(link calender)」A2:D；同時做快取（日期以序號回來）
function getCourseTimeA2D(ss, spreadsheetId){
  const key = "COURSE_TIME_A2D";
  const hit = cacheGet(key);
  if (hit) return hit;

  const link = safeGetSheetByNames(ss, LINK_SHEET_NAMES);
  if (!link) return null;

  const range = `${escapeSheet(link.getName())}!A2:D`;
  const vr = withRetry(() => ValuesAPI.get(spreadsheetId, range, {
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER"
  }));
  const rows = (vr && vr.values) ? vr.values : [];

  cachePut(key, rows);   // TTL 由 CACHE_TTL 控制（預設 5 分鐘）
  return rows;
}

/* ----------------- 快取工具（安全版） ----------------- */
function cacheGet(key){
  try {
    const raw = CacheService.getScriptCache().get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}
function cachePut(key, val, ttl=CACHE_TTL){
  try {
    const s = JSON.stringify(val);
    if (s.length > CACHE_ITEM_LIMIT) return false; // 超過上限就不存，避免 Argument too large: value
    CacheService.getScriptCache().put(key, s, ttl);
    return true;
  } catch (_) {
    return false;
  }
}
function cacheDel(key){ try { CacheService.getScriptCache().remove(key); } catch (_) {} }

/* ----------------- Debug 計時 ----------------- */
function newTimer(enabled){ const rec=[]; let t=Date.now(); return {
  mark:(label)=>{ if(!enabled) return; const now=Date.now(); rec.push([label, now - t]); t=now; },
  dump:()=> enabled ? rec : undefined
};}

/* ----------------- 字串正規化 / 模糊比對 ----------------- */
function toHalfWidth(s){
  if(!s) return "";
  let out = String(s).replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0)-0xFEE0));
  out = out.replace(/\u3000/g," ");
  out = out
    .replace(/[（）]/g, m => (m === "（" ? "(" : ")"))
    .replace(/[－–—]/g, "-")
    .replace(/[：]/g, ":")
    .replace(/[～~]/g, "~");
  return out.trim().replace(/\s+/g," ");
}
function norm(s){ return toHalfWidth(String(s||"").toLowerCase()); }
function levenshtein(a,b){
  a=norm(a); b=norm(b);
  const m=a.length,n=b.length;
  if(!m) return n; if(!n) return m;
  const dp=Array(n+1).fill(0).map((_,j)=>j);
  for(let i=1;i<=m;i++){
    let prev=i-1; dp[0]=i;
    for(let j=1;j<=n;j++){
      const tmp=dp[j];
      const cost=a[i-1]===b[j-1]?0:1;
      dp[j]=Math.min(dp[j]+1, dp[j-1]+1, prev+cost);
      prev=tmp;
    }
  }
  return dp[n];
}
function similarity(a,b){
  const A=norm(a),B=norm(b);
  if(!A||!B) return 0;
  const lev=levenshtein(A,B);
  const levScore=1-(lev/Math.max(1,Math.max(A.length,B.length)));
  let bonus=0;
  if(A===B) bonus=0.3;
  else if(A.startsWith(B)||B.startsWith(A)) bonus=0.15;
  else if(A.includes(B)) bonus=0.1;
  else if(B.includes(A)) bonus=0.1;
  return Math.min(1, Math.max(0, levScore+bonus));
}
function fuzzyFindCoursePeriod(rows, inputCourse, inputPeriod, wC=0.6, wP=0.4){
  const IN_C=String(inputCourse||""), IN_P=String(inputPeriod||"");
  const cand=[];
  for(const r of rows){
    if(!r||r.length<4) continue;
    const c=r[3], p=r[2];
    if(c==null&&p==null) continue;
    const sC=similarity(IN_C,c), sP=similarity(IN_P,p), score=wC*sC+wP*sP;
    cand.push({course:c, period:p, score});
  }
  cand.sort((a,b)=>b.score-a.score);
  const best=cand[0]; const HIGH=0.80, OK=0.65;
  const suggestions=cand.slice(0,5).map(x=>({course:x.course, period:x.period, score:Number(x.score.toFixed(3))}));
  if(best && best.score>=OK){
    return {found:true, course:best.course, period:best.period, score:Number(best.score.toFixed(3)), confidence:(best.score>=HIGH?"high":"medium"), suggestions};
  }
  return {found:false, course:null, period:null, score:0, confidence:"low", suggestions};
}

/* ----------------- 資料存取（快取 + Advanced Sheets） ----------------- */
// 取「學生Data(Sync Notion Class)」A2:U：A(0)=姓名, F(5)=課程, G(6)=時段, I(8)=剩餘堂數, U(20)=userId
function getStudentsA2U(spreadsheetId){
  const key="STUDENTS_A2U";
  if (CACHE_STUDENTS) {
    const hit=cacheGet(key); if(hit) return hit;
  }
  const vr=withRetry(()=>ValuesAPI.get(spreadsheetId, "學生Data(Sync Notion Class)!A2:U"));
  const rows=(vr && vr.values)? vr.values : [];
  if (CACHE_STUDENTS) cachePut(key, rows);
  return rows;
}
function buildStudentIndex(rows){
  const idx = Object.create(null);
  for (const r of rows){
    const name = r[0] || "";
    const course = r[5] || "";
    const period = r[6] || "";
    const remaining = Number(r[8] || 0);    // I欄
    const userId = r[20] || "";             // U欄
    if (!name || !course || !period) continue;
    idx[`${name}|||${course}|||${period}`] = { remaining, userId };
  }
  return idx;
}

// 只快取「小」資料（header/remaining），namesCol 每次現抓，不進快取
// 只快取「小」資料（header/remaining），namesCol 每次現抓，不進快取
function courseSlices(spreadsheetId, courseName, lastColA1 /*例如 "AF" 或 "ZZ"*/){
  const key = `COURSE_SLICES__v3__${courseName}__${lastColA1}`;
  const esc = escapeSheet(courseName);

  const hit = cacheGet(key);
  if (hit) {
    // 命中時仍抓 names（不快取）
    const namesVR = withRetry(() => ValuesAPI.get(spreadsheetId, `${esc}!B7:B`));
    const namesCol = (namesVR && namesVR.values) ? namesVR.values : [];
    return { namesCol, header: hit.header, remainCol: hit.remainCol };
  }

  // 1) 抓 header（raw + display）
  const vrHeader = withRetry(() => ValuesAPI.batchGet(spreadsheetId, {
    ranges: [`${esc}!F6:${lastColA1}6`, `${esc}!F6:${lastColA1}6`],
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  }));
  // 注意：Apps Script 的 batchGet 同一 range 兩次不會自動回兩份；改分兩次抓
  const headerRawVR  = withRetry(() => ValuesAPI.get(spreadsheetId, `${esc}!F6:${lastColA1}6`, {
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER"
  }));
  const headerDispVR = withRetry(() => ValuesAPI.get(spreadsheetId, `${esc}!F6:${lastColA1}6`, {
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING"
  }));

  const headerRaw  = (headerRawVR && headerRawVR.values && headerRawVR.values[0]) ? headerRawVR.values[0] : [];
  const headerDisp = (headerDispVR && headerDispVR.values && headerDispVR.values[0]) ? headerDispVR.values[0] : [];

  // 2) 解析 header → yyyy-MM-dd（日期無法解析的欄位會留空）
  const numCols = Math.max(headerRaw.length, headerDisp.length);
  const header = new Array(numCols);
  for (let i=0;i<numCols;i++){
    header[i] = normDateCellRobust(headerRaw[i], headerDisp[i], TZ) || "";
  }

  // 3) 尋找「剩餘堂數」欄（以 header 第 6 列整列去比對顯示文字）
  const remainKeywords = new Set(["餘", "剩餘", "剩餘堂數", "剩餘課數"]);
  let remainColIndex1Based = -1;
  for (let i=0;i<headerDisp.length;i++){
    const h = String(headerDisp[i] || "").trim();
    if (remainKeywords.has(h)) { remainColIndex1Based = 6 + i; break; } // F 欄是 6
  }

  // 4) 抓 remainCol（若沒找到，就給空陣列，避免壞掉）
  let remainCol = [];
  if (remainColIndex1Based !== -1) {
    const remainColA1 = toA1(1, remainColIndex1Based).replace("1", ""); // 轉成欄字母
    const vrRemain = withRetry(() => ValuesAPI.get(spreadsheetId, `${esc}!${remainColA1}7:${remainColA1}`, {
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER"
    }));
    remainCol = (vrRemain && vrRemain.values) ? vrRemain.values : [];
  }

  // 5) names（不快取）
  const namesVR = withRetry(() => ValuesAPI.get(spreadsheetId, `${esc}!B7:B`));
  const namesCol = (namesVR && namesVR.values) ? namesVR.values : [];

  // 6) 小資料入快取
  cachePut(key, { header, remainCol });

  return { namesCol, header, remainCol };
}


function getRowMarks(spreadsheetId, courseName, row1, lastColA1){
  const range=`${escapeSheet(courseName)}!F${row1}:${lastColA1}${row1}`;
  const vr=withRetry(()=>ValuesAPI.get(spreadsheetId, range));
  return (vr && vr.values && vr.values[0]) ? vr.values[0] : [];
}
function getMatrixMarks(spreadsheetId, courseName, lastRow1, lastColA1){
  const range=`${escapeSheet(courseName)}!F7:${lastColA1}${lastRow1}`;
  const vr=withRetry(()=>ValuesAPI.get(spreadsheetId, range));
  return (vr && vr.values) ? vr.values : [];
}

/* ----------------- 簽到系統處理函數（由 user group ID 上傳.gs 的 doPost 調用） ----------------- */
/**
 * 處理簽到系統相關的 actions
 * 這個函數被 user group ID 上傳.gs 的 doPost 函數調用
 * 不要直接使用這個函數作為 Web App 入口
 */
function handleSignInActions(e){
  try{
    // 參數
    const raw=(e.postData && e.postData.contents) || "";
    let data={}; try{ data = raw ? JSON.parse(raw) : {}; }catch(_){ data = {}; }
    const param=(k,def="") => (data[k]!==undefined && data[k]!==null) ? data[k] : (e.parameter && e.parameter[k]!==undefined ? e.parameter[k] : def);

    const action=String(param("action",""));
    const name  =String(param("name",""));
    const debug =String(param("debug","false")).toLowerCase()==="true";
    const t = newTimer(debug);

    const ss=SpreadsheetApp.getActiveSpreadsheet();
    const SPREADSHEET_ID=ss.getId();

    /* ========== 🚀 優化版簽到 fastAttendance（目標 < 500ms） ========== */
    if (action === "fastAttendance") {
      const startTime = Date.now();
      const timing = {};
      
      const name = String(param("name", "")).trim();
      const dateInput = param("date", new Date());
      const present = String(param("present", "")) === "true" || param("present", false) === true;
      
      if (!name) {
        return jsonOutput({ success: false, error: "缺少學生姓名" });
      }
      
      const date = new Date(dateInput);
      const formattedDate = fmtDate(date);
      timing.parseParams = Date.now() - startTime;
      
      // ========== 階段 1：快取查找課程 (< 50ms) ==========
      let t1 = Date.now();
      const cacheKey = `FAST_ATTEND::${name}`;
      let cached = cacheGet(cacheKey);
      
      if (!cached) {
        // 快取未命中，從學生表查找（僅首次慢）
        const students = getStudentsA2U(SPREADSHEET_ID);
        
        for (const r of students) {
          if (String(r[0] || "").trim() === name) {
            cached = {
              course: String(r[5] || "").trim(),
              period: String(r[6] || "").trim()
            };
            cachePut(cacheKey, cached, 3600); // 快取 1 小時
            break;
          }
        }
      }
      
      if (!cached || !cached.course) {
        return jsonOutput({ 
          success: false, 
          error: "找不到該學生對應的課程",
          timing: { total: Date.now() - startTime }
        });
      }
      
      const courseType = cached.course;
      timing.findCourse = Date.now() - t1;
      
      // ========== 階段 2：批次讀取課程表結構 (< 300ms) ==========
      t1 = Date.now();
      const structCacheKey = `STRUCT_v2::${courseType}`;
      let structure = cacheGet(structCacheKey);
      
      if (!structure) {
        const esc = escapeSheet(courseType);
        
        // 🔥 關鍵優化：一次 batchGet 抓取所有需要的資料
        const vr = withRetry(() => ValuesAPI.batchGet(SPREADSHEET_ID, {
          ranges: [
            `${esc}!B7:B200`,   // 學生名單（假設最多 200 人）
            `${esc}!F6:CZ6`     // 表頭日期（到 CZ 欄，104 個日期欄位）
          ],
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "SERIAL_NUMBER"
        }));
        
        const namesRaw = vr?.valueRanges?.[0]?.values || [];
        const headerRaw = vr?.valueRanges?.[1]?.values?.[0] || [];
        
        // 建立 Map（比 Object 查找更快）
        const nameToRowArr = [];
        namesRaw.forEach((r, idx) => {
          const n = String(r[0] || "").trim();
          if (n) nameToRowArr.push([n, 7 + idx]);
        });
        
        const dateToColArr = [];
        let firstEmpty = 6 + headerRaw.length;
        
        headerRaw.forEach((cell, offset) => {
          if (!cell || cell === "") {
            if (6 + offset < firstEmpty) {
              firstEmpty = 6 + offset;
            }
          } else {
            const ds = serialToYMD(cell, TZ);
            if (ds) dateToColArr.push([ds, 6 + offset]);
          }
        });
        
        structure = { 
          nameToRow: nameToRowArr, 
          dateToCol: dateToColArr, 
          firstEmpty 
        };
        cachePut(structCacheKey, structure, 1800); // 快取 30 分鐘
      }
      
      // 從快取還原 Map
      const nameToRow = new Map(structure.nameToRow);
      const dateToCol = new Map(structure.dateToCol);
      
      timing.loadStructure = Date.now() - t1;
      
      // ========== 階段 3：定位目標儲存格 (< 10ms) ==========
      t1 = Date.now();
      const targetRow = nameToRow.get(name);
      if (!targetRow) {
        return jsonOutput({ 
          success: false, 
          error: `課程表中找不到學生：${name}`,
          timing: { ...timing, total: Date.now() - startTime }
        });
      }
      
      let targetCol = dateToCol.get(formattedDate);
      let needHeader = false;
      
      if (!targetCol) {
        targetCol = structure.firstEmpty;
        needHeader = true;
      }
      
      timing.locateCell = Date.now() - t1;
      
      // ========== 階段 4：批次寫入 (< 200ms) ==========
      t1 = Date.now();
      const esc = escapeSheet(courseType);
      const mark = present ? "V" : "X";
      
      // 🔥 關鍵優化：準備批次更新（一次 API 呼叫）
      const updates = [];
      
      if (needHeader) {
        updates.push({
          range: `${esc}!${toA1(6, targetCol)}`,
          values: [[formattedDate]]
        });
      }
      
      updates.push({
        range: `${esc}!${toA1(targetRow, targetCol)}`,
        values: [[mark]]
      });
      
      // 🚀 執行批次更新
      withRetry(() => ValuesAPI.batchUpdate({
        data: updates,
        valueInputOption: "RAW"
      }, SPREADSHEET_ID));
      
      timing.batchWrite = Date.now() - t1;
      
      // ========== 階段 5：更新快取 (< 10ms) ==========
      if (needHeader) {
        // 新增了日期欄，更新結構快取
        structure.dateToCol.push([formattedDate, targetCol]);
        if (targetCol === structure.firstEmpty) {
          structure.firstEmpty++;
        }
        cachePut(structCacheKey, structure, 1800);
      }
      
      timing.total = Date.now() - startTime;
      
      return jsonOutput({
        success: true,
        message: "✅ 簽到成功（優化版）",
        data: {
          name,
          course: courseType,
          date: formattedDate,
          present,
          row: targetRow,
          col: targetCol
        },
        performance: {
          totalMs: timing.total,
          breakdown: timing,
          target: "< 500ms",
          achieved: timing.total < 500 ? "🎉 達標" : "⚠️ 需優化",
          cacheHit: {
            student: !!cached,
            structure: structure !== null
          }
        }
      });
    }

    /* ========== 簽到 update ========== */
    if(action==="update"){
      if(!USE_ADV){
        // 回退版（簡潔）
        const studentData = ss.getSheetByName("學生Data(Sync Notion Class)").getDataRange().getValues();
        let courseType=null;
        for(let i=1;i<studentData.length;i++){ if(studentData[i][0]===name){ courseType=studentData[i][5]; break; } }
        if(!courseType) return jsonOutput({success:false,error:"找不到該學生對應的課程類別"});
        const courseSheet=ss.getSheetByName(courseType);
        if(!courseSheet) return jsonOutput({success:false,error:`找不到課程名稱為「${courseType}」的工作表`});
        const studentNames=courseSheet.getRange("B7:B").getValues().flat();
        const idx=studentNames.indexOf(name); if(idx===-1) return jsonOutput({success:false,error:`課程表中找不到學生名稱：${name}`});
        const targetRow=7+idx;
        const date=new Date(param("date", new Date()));
        const formatted=fmtDate(date);
        const header=courseSheet.getRange(6,6,1,Math.max(1,courseSheet.getLastColumn()-5)).getValues()[0];
        let col=-1;
        for(let i=0;i<header.length;i++){ const d=header[i]; if(d && fmtCellDate(d)===formatted){ col=i+6; break; } }
        if(col===-1){
          for(let i=0;i<header.length;i++){ if(!header[i]){ col=i+6; break; } }
          if(col===-1) col=header.length+6;
          const cell=courseSheet.getRange(6,col);
          if(!cell.getValue()) cell.setValue(formatted);
        }
        const present = param("present", false)===true || String(param("present",""))==="true";
        courseSheet.getRange(targetRow,col).setValue(present?"V":"X");
        cacheDel(`COURSE_SLICES__${courseType}__ZZ`);
        return jsonOutput({success:true,message:"簽到狀態已更新",name,date:formatted,present});
      }

      t.mark("start");
      const students = getStudentsA2U(SPREADSHEET_ID);         t.mark("students A2:U");
      // 找課程
      let courseType=null;
      for(const r of students){ if((r[0]||"")===name){ courseType=r[5]||null; break; } }
      if(!courseType) return jsonOutput({success:false,error:"找不到該學生對應的課程類別"});

      const courseSheet = ss.getSheetByName(courseType);
      if(!courseSheet) return jsonOutput({success:false,error:`找不到課程名稱為「${courseType}」的工作表`});
      const lastColIndex = Math.max(6, courseSheet.getLastColumn()); // 至少 F
      const lastColA1 = toA1(1, lastColIndex).replace("1","");

      const slices = courseSlices(SPREADSHEET_ID, courseType, lastColA1); t.mark("course slices");
      const names = slices.namesCol.map(r=>r?.[0]||"");
      const idx = names.indexOf(name);
      if(idx===-1) return jsonOutput({success:false,error:`課程表中找不到學生名稱：${name}`});

      const targetRow = 7 + idx;
      const date = new Date(param("date", new Date()));
      const formattedDate = fmtDate(date); // 用標準 yyyy-MM-dd

      // 找欄（header 可能是序號/文字/空白）
      let offset=-1;
      for(let i=0;i<slices.header.length;i++){
        const d=slices.header[i];
        if(!d) continue;
        // 先比對解析值
        if (fmtCellDate(d) === formattedDate) { offset=i; break; }
        // 若不行，用 displayValue fallback 一次
        if (offset===-1) {
          const disp = courseSheet.getRange(6, 6+i).getDisplayValue();
          if (normDateCellRobust(d, disp, TZ) === formattedDate) { offset=i; break; }
        }
      }
      if(offset===-1){
        offset = slices.header.findIndex(v => v==null || v==="");
        if(offset===-1) offset = slices.header.length;
      }
      const colIndex = 6 + offset;
      const headerA1 = toA1(6, colIndex), markA1 = toA1(targetRow, colIndex);

      const present = String(param("present",""))==="true" || param("present",false)===true;
      const mark = present ? "V" : "X";

      const writes=[];
      if(!slices.header[offset]) writes.push({ range:`${escapeSheet(courseType)}!${headerA1}`, values:[[formattedDate]] });
      writes.push({ range:`${escapeSheet(courseType)}!${markA1}`, values:[[mark]] });
      withRetry(()=>ValuesAPI.batchUpdate({ data:writes, valueInputOption:"RAW" }, SPREADSHEET_ID));
      cacheDel(`COURSE_SLICES__${courseType}__${lastColA1}`);

      t.mark("batchUpdate done");
      return jsonOutput({success:true,message:"簽到狀態已更新",name,date:formattedDate,present, debug:{timings:t.dump()}});
    }

    /* ========== 查詢 query（剩餘＋出缺勤） ========== */
    if(action==="query"){
      if(!USE_ADV){
        const studentSheet = ss.getSheetByName("學生Data(Sync Notion Class)");
        const studentData = studentSheet ? studentSheet.getDataRange().getValues() : [];
        let courseType=null;
        for(let i=1;i<studentData.length;i++){ if(studentData[i][0]===name){ courseType=studentData[i][5]; break; } }
        if(!courseType) return jsonOutput({success:false,error:"找不到該學生對應的課程類別"});
        const courseSheet=ss.getSheetByName(courseType);
        if(!courseSheet) return jsonOutput({success:false,error:`找不到課程名稱為「${courseType}」的工作表`});
        const names=courseSheet.getRange("B7:B").getValues().flat();
        const idx=names.indexOf(name); if(idx===-1) return jsonOutput({success:false,error:`課程表中找不到學生名稱：${name}`});
        const row=7+idx;

        const remainCol = findColByHeader(courseSheet, 6, ["餘","剩餘堂數","剩餘"]);
        if(remainCol === -1){
          return jsonOutput({success:false,error:"找不到『剩餘堂數』欄位"});
        }
        const remaining = Number(courseSheet.getRange(row, remainCol).getValue() || 0);

        // 可選：除錯看看抓到的表頭
        // Logger.log({remainColIdx, header: courseSheet.getRange(6, remainColIdx).getDisplayValue()});


        const lastCol = Math.max(6, courseSheet.getLastColumn());
        const startCol = 6;
        const numCols  = lastCol - startCol + 1;
        const dateRow  = courseSheet.getRange(6, startCol, 1, numCols).getValues()[0];
        const markRow  = courseSheet.getRange(row, startCol, 1, numCols).getValues()[0];

        const attendance=[];
        for(let i=0;i<dateRow.length;i++){
          const d=dateRow[i]; if(!d) continue;
          // 多帶 displayValue 再試一次
          const ds = normDateCellRobust(d, courseSheet.getRange(6, startCol+i).getDisplayValue(), TZ);
          if(!ds) continue;
          const raw = String(markRow[i]||"").trim();
          const up  = raw.toUpperCase();
          if(up==="V") attendance.push({date:ds,present:true});
          else if(up==="X") attendance.push({date:ds,present:false});
          else if(raw==="假"||raw==="請假") attendance.push({date:ds,present:"leave"});
        }
        return jsonOutput({success:true,name,remaining,attendance});
      }

      const t2 = newTimer(debug);
      t2.mark("start");
      const students = getStudentsA2U(SPREADSHEET_ID);           t2.mark("students A2:U");
      let courseType=null;
      for(const r of students){ if((r[0]||"")===name){ courseType=r[5]||null; break; } }
      if(!courseType) return jsonOutput({success:false,error:"找不到該學生對應的課程類別"});
      const courseSheet=ss.getSheetByName(courseType);
      if(!courseSheet) return jsonOutput({success:false,error:`找不到課程名稱為「${courseType}」的工作表`});
      const lastColA1 = toA1(1, Math.max(6, courseSheet.getLastColumn())).replace("1","");
      const slices = courseSlices(SPREADSHEET_ID, courseType, lastColA1); t2.mark("course slices");

      const names = slices.namesCol.map(r=>r?.[0]||"");
      const idx=names.indexOf(name); if(idx===-1) return jsonOutput({success:false,error:`課程表中找不到學生名稱：${name}`});
      const row1 = 7 + idx;
      const remainColIdx = findColByHeader(courseSheet, 6, ["剩餘堂數","剩餘課數","剩餘"]);
      if (remainColIdx === -1) return jsonOutput({success:false, error:"找不到「剩餘堂數」欄位（請確認表頭在第6列）"});
      const remaining = Number(courseSheet.getRange(row1, remainColIdx).getValue() || 0);
      const rowMarks = getRowMarks(SPREADSHEET_ID, courseType, row1, lastColA1); t2.mark("row marks");

      const attendance=[];
      for(let i=0;i<slices.header.length;i++){
        const d=slices.header[i]; if(!d) continue;
        // header 解析 + 顯示值 fallback
        let ds = fmtCellDate(d);
        if(!ds){
          const disp = courseSheet.getRange(6, 6+i).getDisplayValue();
          ds = normDateCellRobust(d, disp, TZ);
        }
        if(!ds) continue;

        const raw=String(rowMarks[i]==null?"":rowMarks[i]).trim(); const up=raw.toUpperCase();
        if(up==="V") attendance.push({date:ds,present:true});
        else if(up==="X") attendance.push({date:ds,present:false});
        else if(raw==="假"||raw==="請假") attendance.push({date:ds,present:"leave"});
      }
      t2.mark("build");
      return jsonOutput({success:true,name,remaining,attendance, debug:{timings:t2.dump()}});
    }

    /* ========== 取得課程清單 ========== */
    if(action==="getCoursesForSelect"){
      const sh=ss.getSheetByName("課程類別");
      const raw= sh ? sh.getRange("D2:D").getValues().flat().filter(Boolean) : [];
      return jsonOutput({success:true, courses:[...new Set(raw)]});
    }

    /* ========== 某課程所有時段 ========== */
    if(action==="getTimesByCourse"){
      const course = String(param("course",""));
      const timeSheet = safeGetSheetByNames(ss, LINK_SHEET_NAMES);
      if(!timeSheet) return jsonOutput({success:false,error:"找不到「上課時間(link calender）」工作表（含半形/全形）」"});
      const all = timeSheet.getRange("A2:D").getValues();
      const matched = all.filter(r=>r[3]===course).map(r=>r[2]);
      return jsonOutput({success:true, course, periods: matched});
    }

    /* ========== 取得課程清單 +（可選）某課程/全課程的時段與明細（表頭驅動） ========== */
    if (action === "getCourseMeta") {
      // 1) 課程清單
      const courseSheet = ss.getSheetByName("課程類別");
      const rawCourses = courseSheet ? courseSheet.getRange("D2:D").getValues().flat() : [];
      const courses = [...new Set(rawCourses.filter(Boolean))];

      // 2) 參數
      const course = String(param("course", "")).trim();
      const allFlag = String(param("all", "")).toLowerCase() === "true";

      // 預設輸出
      let periods = [];
      let details = [];
      let periodsByCourse = {}; // all=true 時提供

      // 3) 若查時段/明細，讀取「上課時間(link calender）」表
      if (course || allFlag) {
        const timeSheet = safeGetSheetByNames(ss, LINK_SHEET_NAMES);
        if (!timeSheet) {
          return jsonOutput({
            success: false,
            error: "找不到「上課時間(link calender）」工作表（含半形/全形）」",
          });
        }

        const lastRow = Math.max(2, timeSheet.getLastRow());
        const lastCol = timeSheet.getLastColumn();
        const headers = timeSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
        const values = timeSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

        const courseIdx = headers.indexOf("課別");
        if (courseIdx === -1) {
          return jsonOutput({ success: false, error: "表頭裡找不到『課別』欄位" });
        }
        const timeIdx = headers.indexOf("時間"); // 沒有也可運作，只是 periods 會空

        // helper：用表頭生成物件
        const rowToObj = (r) => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = (r[i] ?? "").toString().trim(); });
          return obj;
        };

        if (allFlag && !course) {
          // 3A) 全部課程
          const rows = values.filter(r => String(r[courseIdx]).trim()); // 篩掉空課別列
          details = rows.map(rowToObj);

          // periodsByCourse：彙整每個課別的所有「時間」
          if (timeIdx > -1) {
            periodsByCourse = rows.reduce((acc, r) => {
              const c = String(r[courseIdx]).trim();
              const t = r[timeIdx];
              if (!c) return acc;
              acc[c] = acc[c] || [];
              if (t && !acc[c].includes(t)) acc[c].push(t);
              return acc;
            }, {});
          }
        } else {
          // 3B) 指定單一課程
          const rows = values.filter(r => String(r[courseIdx]).trim() === course);
          details = rows.map(rowToObj);
          if (timeIdx > -1) {
            periods = rows.map(r => r[timeIdx]).filter(Boolean);
          }
        }
      }

      // 4) 輸出
      return jsonOutput({
        success: true,
        courses,          // 全部課程清單
        course,           // 查詢課程（all=true 且未指定時為 ""）
        periods,          // 單一課程的所有「時間」
        periodsByCourse,  // all=true 時提供：{ 課別: [時間, ...], ... }
        details           // 依需求輸出：單一課程或全部課程的完整列（key 為表頭）
      });
    }


    /* ========== 依課程＋時段找學生（剩餘>0） ========== */
    if(action==="getStudentsByCourseAndTime"){
      const course=String(param("course",""));
      const period=String(param("period",""));
      const rows = getStudentsA2U(SPREADSHEET_ID);
      const students = rows.filter(r=>r[5]===course && r[6]===period && Number(r[8]||0)>0).map(r=>r[0]);
      return jsonOutput({success:true, course, period, students});
    }

    /* ========== 新增講師課程資料 ========== */
if (action === "appendTeacherCourse") {
  const teacherName = data.teacherName,
        sheetName   = data.sheetName,
        courseTitle = data.課程名稱,
        courseTime  = data.上課時間,     // 用於 B 欄比對
        courseDate  = data.課程日期,     // 用於 C 欄比對
        taInfo      = data["助教/學生"],
        content     = data.課程內容;

  const reportSheet = ss.getSheetByName("報表連結");
  const reportData  = reportSheet ? reportSheet.getDataRange().getValues() : [];
  let teacherLink = null;
  for (let i = 1; i < reportData.length; i++) {
    if (reportData[i][0] === teacherName) { teacherLink = reportData[i][1]; break; }
  }
  if (!teacherLink) return jsonOutput({ success:false, error:"找不到講師連結" });

  const m = teacherLink.match(/\/d\/(.+?)\//);
  if (!m) return jsonOutput({ success:false, error:"無效的 Google Sheet 連結" });

  const teacherSheet = SpreadsheetApp.openById(m[1]);
  const target = teacherSheet.getSheetByName(sheetName);
  if (!target) return jsonOutput({ success:false, error:`找不到工作表：${sheetName}` });

  // === 參考：最終要寫入的一列資料 ===
  const newRow = [courseTitle, courseTime, courseDate, taInfo, content];

  // === 正規化工具：時間與日期同時支援字串 / Date ===
  const normalizeTime = (v) => {
    if (v == null) return "";
    if (Object.prototype.toString.call(v) === "[object Date]") {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), "HH:mm");
    }
    return String(v).trim();
  };
  const normalizeDate = (v) => {
    if (v == null) return "";
    if (Object.prototype.toString.call(v) === "[object Date]") {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    // 將各種常見日期字串嘗試轉成 yyyy-MM-dd；失敗則回傳原字串
    const s = String(v).trim().replace(/\./g, "/").replace(/-/g, "/");
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    return String(v).trim();
  };

  // 將傳入參數先正規化一次
  const cmpTime = normalizeTime(courseTime);
  const cmpDate = normalizeDate(courseDate);

  const lastRow = target.getLastRow();
  const lastCol = target.getLastColumn();
  let updated = false;

  if (lastRow >= 2) {
    // 讀取第 2 列到最後一列（假設第 1 列為表頭）
    const numRows = lastRow - 1;
    const displayValues = target.getRange(2, 1, numRows, lastCol).getDisplayValues();

    for (let i = 0; i < displayValues.length; i++) {
      const row = displayValues[i];
      const bTime = normalizeTime(row[1]); // B 欄（上課時間）
      const cDate = normalizeDate(row[2]); // C 欄（上課日期）

      if (bTime === cmpTime && cDate === cmpDate) {
        // 命中同一堂課 → 覆蓋
        target.getRange(i + 2, 1, 1, newRow.length).setValues([newRow]);
        updated = true;
        break;
      }
    }
  }

  if (!updated) {
    // 沒找到同堂課 → 直接新增一列
    target.appendRow(newRow);
  }

  return jsonOutput({
    success: true,
    message: updated ? "資料已更新（同堂課覆蓋：B+C 相同）" : "資料新增成功",
    row: newRow
  });
}



    /* ========== getTeacherList ========== */
    if(action==="getTeacherList"){
      const sh=ss.getSheetByName("報表連結"); if(!sh) return jsonOutput({success:false,error:"找不到報表連結工作表"});
      const data=sh.getDataRange().getValues(); const out=[];
      for(let i=1;i<data.length;i++){
        const nm=data[i][0], link=data[i][1], web=data[i][2], rep=data[i][3], uid=data[i][4];
        if(nm&&link) out.push({name:nm,link,webApi:web||"",reportApi:rep||"",userId:uid||""});
      }
      return jsonOutput({success:true,teachers:out});
    }

    if (action === "getStudentList") {
      return getStudentList(data);
    }

    /* ========== getCoursesByTeacher（保留原語意） ========== */
    if(action==="getCoursesByTeacher"){
      const teacherFromInput=String(param("teacher",""));
      const cleaned=teacherFromInput.replace(/[^a-zA-Z]/g,"").toLowerCase();
      const sourceRaw=String(param("source","both")).trim().toLowerCase();
      const exactSheet=String(param("exactSheet","")).trim();

      const today=new Date(new Date().toLocaleString("en-US",{timeZone:TZ}));
      const currentDay=today.getDay();
      const dayMap={"日":0,"一":1,"二":2,"三":3,"四":4,"五":5,"六":6};

      const SOURCES={ main:["上課時間"], link: LINK_SHEET_NAMES };
      let cands=[]; if(exactSheet) cands=[exactSheet]; else if(sourceRaw==="main") cands=SOURCES.main; else if(sourceRaw==="link") cands=SOURCES.link; else cands=[...SOURCES.main,...SOURCES.link];

      function idxByHeader(h){ const head=h.map(x=>String(x).trim());
        const f=(names)=>head.findIndex(v=>names.includes(v));
        return {
          displayName: f(["備註","備註/說明","備註說明"]),
          time:        f(["時間","上課時間","詳細時間"]),
          course:      f(["課程類別","課程名稱","課程","科目"]),
          teacher:     f(["授課老師","老師","講師","任課教師"]),
          students:    f(["學生","學生名單","學員","學生清單"]),
          reportApi:   f(["報表API","報表 API","報表連結","報表","課程類別"])
        };
      }
      function collect(sh, sourceTag){
        const values=sh.getDataRange().getValues(); if(!values||values.length<2) return [];
        const idx=idxByHeader(values[0]);
        const col={
          displayName: idx.displayName!==-1?idx.displayName:4,
          time:        idx.time!==-1?idx.time:2,
          course:      idx.course!==-1?idx.course:3,
          teacher:     idx.teacher!==-1?idx.teacher:6,
          students:    idx.students!==-1?idx.students:7,
          reportApi:   idx.reportApi!==-1?idx.reportApi:3
        };
        const out=[];
        for(let r=1;r<values.length;r++){
          const row=values[r]; const t=row[col.teacher], ti=row[col.time], c=row[col.course];
          const note1=row[col.displayName]||"", note2=row[col.displayName+1]||"";
          const dn=(note1 && note2) ? `${note1} / ${note2}` : (note1 || note2);
          if(!t||!ti||!c) continue;
          const names=String(t).split(/[,\s]+/).map(n=>n.replace(/[^a-zA-Z]/g,"").toLowerCase()).filter(Boolean);
          if(!names.includes(cleaned)) continue;
          let isToday=false; const m=String(ti).match(/^([一二三四五六日]+)/);
          if(m) for(const ch of m[1]){ if(dayMap[ch]===currentDay){ isToday=true; break; } }
          out.push({label:`${c}（${dn||ti}）`, course:c, time:ti, reportApi:row[col.reportApi]||"", students:row[col.students]||"", note:dn, source:sourceTag, isToday});
        }
        return out;
      }

      let results=[], found=[];
      for(const nm of cands){ const sh=ss.getSheetByName(nm); if(!sh) continue; found.push(nm); results=results.concat(collect(sh,nm)); }
      const single=!!exactSheet || sourceRaw==="main" || sourceRaw==="link";
      if(single && found.length===0){
        return jsonOutput({success:true, teacher:teacherFromInput, sourceRequested:exactSheet||sourceRaw, sheetFound:false, foundSheets:[], courseTimes:[]});
      }
      results.sort((a,b)=>Number(b.isToday)-Number(a.isToday)); results.forEach(x=>delete x.isToday);
      return jsonOutput({success:true, teacher:teacherFromInput, sourceRequested:exactSheet||sourceRaw, sheetFound:found.length>0, foundSheets:found, courseTimes:results});
    }

    /* ========== getRosterAttendance（批量＋快取＋自動策略 + userId/檢查某日） ========== */
    if(action==="getRosterAttendance"){
      try{
        const course=String(param("course","")).trim();
        const period=String(param("period","")).trim();
        const onlyPositive=String(param("onlyPositiveRemaining","true")).toLowerCase()!=="false";
        const nameFilter=String(param("name","")).trim();
        if(!course || !period) return jsonOutput({success:false, error:"缺少必要參數：course / period"});

        const t3 = newTimer(debug);
        t3.mark("start");
        const timeRows = getCourseTimeA2D(ss, SPREADSHEET_ID);  t3.mark("time A2:D");
        if(!timeRows) return jsonOutput({success:true, resolution:"sheet_missing", message:"找不到「上課時間(link calender）」工作表（含半形/全形）", count:0, students:[]});
        const nonEmpty = timeRows.filter(r=>r && r.length>=4 && (r[3]||r[2]));
        if(nonEmpty.length===0) return jsonOutput({success:true, resolution:"empty_rows", message:"「上課時間(link calender)」沒有資料列（A2:D 為空）。", count:0, students:[]});

        const fuzzy = fuzzyFindCoursePeriod(nonEmpty, course, period);
        if(!fuzzy.found){
          return jsonOutput({success:true, resolution:"no_match", message:"未找到相近的課程/時段，可從建議清單中選擇或重新輸入",
            input:{course,period}, course:null, period:null, fuzzyMatched:false, fuzzyScore:0, fuzzyConfidence:"low", suggestions:fuzzy.suggestions, count:0, students:[]});
        }
        const canonicalCourse=fuzzy.course, canonicalPeriod=fuzzy.period;

        const students = getStudentsA2U(SPREADSHEET_ID);       t3.mark("students A2:U");
        const sIndex = buildStudentIndex(students);

        const roster = students
          .filter(r=>{
            const match=(r[5]===canonicalCourse && r[6]===canonicalPeriod);
            if(!match) return false;
            if(nameFilter && r[0]!==nameFilter) return false;
            return !onlyPositive || Number(r[8]||0)>0;
          })
          .map(r=>r[0]);

        // 要檢查的日期：預設「明天（台北）」；也可傳 checkDate: "YYYY-MM-DD"
        const checkDateRaw = String(param("checkDate","")).trim();
        let checkDate = checkDateRaw ? new Date(checkDateRaw + "T00:00:00+08:00")
                                     : new Date(new Date().toLocaleString("en-US",{timeZone:TZ}));
        if (!checkDateRaw) checkDate.setDate(checkDate.getDate()+1);
        const checkDateStr = fmtCellDate(checkDate);

        if(roster.length===0){
          return jsonOutput({success:true, resolution:"ok", course:canonicalCourse, period:canonicalPeriod,
            fuzzyMatched:true, fuzzyScore:fuzzy.score, fuzzyConfidence:fuzzy.confidence, suggestions:fuzzy.suggestions,
            count:0, students:[], absentList:[], notAbsentList:[], debug:{timings:t3.dump()}});
        }

        const courseSheet=ss.getSheetByName(canonicalCourse);
        if(!courseSheet) return jsonOutput({success:true, resolution:"course_sheet_missing", message:`找不到課程同名工作表：「${canonicalCourse}」`,
          course:canonicalCourse, period:canonicalPeriod, fuzzyMatched:true, fuzzyScore:fuzzy.score, fuzzyConfidence:fuzzy.confidence, count:0, students:[]});

        const lastColA1 = toA1(1, Math.max(6, courseSheet.getLastColumn())).replace("1","");
        const slices = courseSlices(SPREADSHEET_ID, canonicalCourse, lastColA1);  t3.mark("course slices");
        const flatNames = slices.namesCol.map(r=>r?.[0]||"");

        // 找 checkDate 在 header 的欄位偏移（解析 + fallback）
        let checkColOffset = -1;
        for (let i=0;i<slices.header.length;i++){
          const d = slices.header[i]; if (!d) continue;
          if (fmtCellDate(d) === checkDateStr) { checkColOffset = i; break; }
          if (checkColOffset===-1) {
            const disp = courseSheet.getRange(6, 6+i).getDisplayValue();
            if (normDateCellRobust(d, disp, TZ) === checkDateStr) { checkColOffset = i; break; }
          }
        }

        function markToStatus(raw){
          const s = String(raw||"").trim();
          const up = s.toUpperCase();
          if (up === "V") return "present";
          if (up === "X") return "absent";
          if (s === "假" || s === "請假") return "leave";
          return "";
        }

        const results=[];
        if(roster.length > ROSTER_ROW_FETCH_THRESHOLD){
          // 一次矩陣抓
          const lastRow1 = 7 + (flatNames.length-1);
          const matrix = getMatrixMarks(SPREADSHEET_ID, canonicalCourse, lastRow1, lastColA1);  t3.mark("matrix marks");
          for(const stu of roster){
            const pos=flatNames.indexOf(stu);
            if(pos===-1){
              results.push({ name:stu, userId:"", remaining:null, remainingFromStudents:null, statusForDate:"", foundInCourseSheet:false, attendance:[] });
              continue;
            }
            const rowMarks = matrix[pos] || [];
            const attendance=[];
            for(let i=0;i<slices.header.length;i++){
              const d=slices.header[i]; if (!d) continue;
              let ds = fmtCellDate(d);
              if(!ds){
                const disp = courseSheet.getRange(6, 6+i).getDisplayValue();
                ds = normDateCellRobust(d, disp, TZ);
              }
              if(!ds) continue;
              const status=markToStatus(rowMarks[i]);
              if (status) attendance.push({ date:ds, present:(status==="present"?true:status==="absent"?false:undefined), status });
            }
            const remainFromSheet = Number((slices.remainCol[pos]?.[0]) || 0);
            const idxKey = `${stu}|||${canonicalCourse}|||${canonicalPeriod}`;
            const fromStudents = sIndex[idxKey] || { remaining:null, userId:"" };
            const statusForDate = (checkColOffset>=0) ? markToStatus(rowMarks[checkColOffset]) : "";
            results.push({
              name: stu,
              userId: fromStudents.userId,
              remaining: remainFromSheet,                  // 課程表 T 欄
              remainingFromStudents: fromStudents.remaining, // 學生Data(Sync Notion Class) I 欄
              statusForDate,                               // "", "present", "absent", "leave"
              foundInCourseSheet: true,
              attendance
            });
          }
        }else{
          // 逐列抓（名單小時省流量）
          for(const stu of roster){
            const pos=flatNames.indexOf(stu);
            if(pos===-1){
              results.push({ name:stu, userId:"", remaining:null, remainingFromStudents:null, statusForDate:"", foundInCourseSheet:false, attendance:[] });
              continue;
            }
            const row1 = 7 + pos;
            const rowMarks = getRowMarks(SPREADSHEET_ID, canonicalCourse, row1, lastColA1);
            const attendance=[];
            for(let i=0;i<slices.header.length;i++){
              const d=slices.header[i]; if (!d) continue;
              let ds = fmtCellDate(d);
              if(!ds){
                const disp = courseSheet.getRange(6, 6+i).getDisplayValue();
                ds = normDateCellRobust(d, disp, TZ);
              }
              if(!ds) continue;
              const status=markToStatus(rowMarks[i]);
              if (status) {
                attendance.push({
                  date: ds,
                  present: (status === "present" ? true : status === "absent" ? false : undefined),
                  status
                });
              }
            }
            const remainFromSheet = Number((slices.remainCol[pos]?.[0]) || 0);
            const idxKey = `${stu}|||${canonicalCourse}|||${canonicalPeriod}`;
            const fromStudents = sIndex[idxKey] || { remaining:null, userId:"" };
            const statusForDate = (checkColOffset>=0) ? markToStatus(rowMarks[checkColOffset]) : "";
            results.push({
              name: stu,
              userId: fromStudents.userId,
              remaining: remainFromSheet,
              remainingFromStudents: fromStudents.remaining,
              statusForDate,
              foundInCourseSheet: true,
              attendance
            });
          }
        }

        // 供推播用的兩個清單
        const absentList    = results.filter(x => x.statusForDate === "absent")
                                     .map(x => ({ name:x.name, userId:x.userId }));
        const notAbsentList = results.filter(x => x.statusForDate && x.statusForDate !== "absent")
                                     .map(x => ({ name:x.name, userId:x.userId }));

        t3.mark("build");
        return jsonOutput({success:true, resolution:"ok", course:canonicalCourse, period:canonicalPeriod,
          fuzzyMatched:true, fuzzyScore:fuzzy.score, fuzzyConfidence:fuzzy.confidence, suggestions:fuzzy.suggestions,
          count:results.length, students:results,
          absentList, notAbsentList,
          debug:{timings:t3.dump()}});
      }catch(err){
        return jsonOutput({success:true, resolution:"exception", message:`getRosterAttendance 例外：${err && err.message ? err.message : err}`, count:0, students:[]});
      }
    }

    function openSheetByName(sheetName) {
      return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    }

    function getSheetJson(sheet) {
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      return data.map(row => {
        const obj = {};
        row.forEach((cell, i) => {
          obj[String(headers[i] || "").trim()] = cell;
        });
        return obj;
      });
    }

    /**
 * 批次預載多個課程的 meta：header raw、有效末欄 index、endColA1、headerDates。
 * - 讀取範圍：各課程表的 F6:ZZ6（raw）
 * - 自動找最後一個非空欄位，換算成 endColA1
 * - 結果寫入 ScriptCache（5 分鐘）
 */
function preloadCourseMeta(SSID, courseNames, tz) {
  const cache = _scriptCache();
  const miss = [];
  const metaMap = new Map();

  // 先試著從 cache 撈
  for (const c of courseNames) {
    const hit = cache.get(_cacheKeyMeta(SSID, c));
    if (hit) {
      metaMap.set(c, JSON.parse(hit));
    } else {
      miss.push(c);
    }
  }
  if (miss.length === 0) return metaMap;

  // 有 cache miss → 一次 batchGet
  const ranges = miss.map(c => `${escapeSheet(c)}!F6:ZZ6`);
  const vr = withRetry(() =>
    ValuesAPI.batchGet(SSID, {
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER"
    })
  );

  miss.forEach((c, i) => {
    const rawRow = vr?.valueRanges?.[i]?.values?.[0] || [];
    // 找最後一個非空欄（避免抓到 ZZ 的冗餘空欄）
    let lastIdx = rawRow.length - 1;
    while (lastIdx >= 0 && (rawRow[lastIdx] === "" || rawRow[lastIdx] == null)) lastIdx--;
    // raw[0] 對應 F 欄（第 6 欄），所以有效末欄 = 6 + lastIdx
    const endColIndex = lastIdx >= 0 ? (6 + lastIdx) : 6; // 至少 F
    const endColA1 = toA1Col(endColIndex);
    const headerDates = rawRow.slice(0, lastIdx + 1).map(v => serialToYMD(v, tz || "Asia/Taipei"));

    const meta = { endColIndex, endColA1, headerDates };
    metaMap.set(c, meta);
    cache.put(_cacheKeyMeta(SSID, c), JSON.stringify(meta), META_CACHE_TTL);
  });

  return metaMap;
}

/** 讀單一課程 meta（若 cache 無則打一次 API 後寫 cache） */
function getCourseMetaFromCache(SSID, course, tz) {
  const cache = _scriptCache();
  const key = _cacheKeyMeta(SSID, course);
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const vr = withRetry(() =>
    ValuesAPI.batchGet(SSID, {
      ranges: [`${escapeSheet(course)}!F6:ZZ6`],
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER"
    })
  );
  const rawRow = vr?.valueRanges?.[0]?.values?.[0] || [];
  let lastIdx = rawRow.length - 1;
  while (lastIdx >= 0 && (rawRow[lastIdx] === "" || rawRow[lastIdx] == null)) lastIdx--;
  const endColIndex = lastIdx >= 0 ? (6 + lastIdx) : 6;
  const endColA1 = toA1Col(endColIndex);
  const headerDates = rawRow.slice(0, lastIdx + 1).map(v => serialToYMD(v, tz || "Asia/Taipei"));

  const meta = { endColIndex, endColA1, headerDates };
  cache.put(key, JSON.stringify(meta), META_CACHE_TTL);
  return meta;
}


/* ========== getStudentList：Advanced Sheets 版本（全批量、零 getRange、無 try/catch） ========== */
function getStudentList(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const SPREADSHEET_ID = ss.getId();
  const TZ = "Asia/Taipei";
  const ROSTER_ROW_FETCH_THRESHOLD = 20;

  // 0) 學生Data(Sync Notion Class) A2:U + W 欄（使用 getStudentsA2U 快取；W 欄一次 batch）
  const students = getStudentsA2U(SPREADSHEET_ID);
  const escRoster = escapeSheet("學生Data(Sync Notion Class)");
  const vrRoster = withRetry(() =>
    ValuesAPI.batchGet(SPREADSHEET_ID, {
      ranges: [escRoster + "!W2:W"],
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    })
  );
  const planCol = (vrRoster?.valueRanges?.[0]?.values || [])
    .map(r => String((r && r[0]) || "").trim());

  // 分組
  const rows = students.map((r, i) => ({ r, i })).filter(x => x.r[0] && x.r[5]);
  const byCourse = new Map();
  for (const { r, i } of rows) {
    const item = {
      name:      String(r[0]  || "").trim(),
      course:    String(r[5]  || "").trim(),
      period:    String(r[6]  || "").trim(),
      remaining: Number(r[8]  || 0),
      userId:    String(r[20] || "").trim(),
      coursePlan: planCol[i] || ""
    };
    if (!byCourse.has(item.course)) byCourse.set(item.course, []);
    byCourse.get(item.course).push(item);
  }
  const courses = [...byCourse.keys()];
  if (courses.length === 0) return jsonOutput({ success: true, count: 0, students: [] });

  // ★ 1) 批次預載所有課程的 meta（含 endColA1、headerDates）+ 快取
  const metaMap = preloadCourseMeta(SPREADSHEET_ID, courses, TZ);

  // 2) 批次抓各課程的 B7:B（姓名）與 T7:T（剩餘）
  const metaRanges = [];
  courses.forEach(c => {
    const esc = escapeSheet(c);
    metaRanges.push(`${esc}!B7:B`);
    metaRanges.push(`${esc}!T7:T`);
  });
  const vrMeta = withRetry(() =>
    ValuesAPI.batchGet(SPREADSHEET_ID, {
      ranges: metaRanges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    })
  );

  // 組 names / index map / remain
  const namesMapByCourse = new Map();
  const nameToIdxByCourse = new Map();
  const remainColByCourse = new Map();
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    const namesCol = vrMeta?.valueRanges?.[i * 2]?.values || [];
    const remainCol = vrMeta?.valueRanges?.[i * 2 + 1]?.values || [];
    const names = namesCol.map(r => (r && r[0]) ? String(r[0]).trim() : "");
    const nameToIdx = new Map();
    names.forEach((n, idx) => { if (n) nameToIdx.set(n, idx); });
    namesMapByCourse.set(c, names);
    nameToIdxByCourse.set(c, nameToIdx);
    remainColByCourse.set(c, remainCol);
  }

  // 3) 規劃第三批：出勤資料
  const bigRanges = [];
  const smallRanges = [];
  const smallKeys = [];

  for (const c of courses) {
    const list = byCourse.get(c);
    if (!list || list.length === 0) continue;

    const meta = metaMap.get(c) || getCourseMetaFromCache(SPREADSHEET_ID, c, TZ);
    const { endColA1, headerDates } = meta;

    const names = namesMapByCourse.get(c) || [];
    const nameToIdx = nameToIdxByCourse.get(c) || new Map();
    const useMatrix = list.length > ROSTER_ROW_FETCH_THRESHOLD;

    if (useMatrix && names.length > 0) {
      const lastRow = 7 + (names.length - 1);
      bigRanges.push({ c, range: `${escapeSheet(c)}!F7:${endColA1}${lastRow}` });
    } else {
      const wantIdx = new Set();
      for (const it of list) {
        const idx = nameToIdx.get(it.name);
        if (typeof idx === "number" && idx >= 0) wantIdx.add(idx);
      }
      for (const idx of [...wantIdx].sort((a,b)=>a-b)) {
        const r = 7 + idx;
        smallRanges.push(`${escapeSheet(c)}!F${r}:${endColA1}${r}`);
        smallKeys.push({ c, idx });
      }
    }
  }

  // 3A) 大名單矩陣
  const matrixByCourse = new Map();
  if (bigRanges.length) {
    const vrBig = withRetry(() =>
      ValuesAPI.batchGet(SPREADSHEET_ID, {
        ranges: bigRanges.map(x => x.range),
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      })
    );
    bigRanges.forEach((x, i) => {
      matrixByCourse.set(x.c, vrBig?.valueRanges?.[i]?.values || []);
    });
  }

  // 3B) 小名單多列
  const rowsByKey = new Map();
  if (smallRanges.length) {
    const vrSmall = withRetry(() =>
      ValuesAPI.batchGet(SPREADSHEET_ID, {
        ranges: smallRanges,
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      })
    );
    smallRanges.forEach((_, i) => {
      const { c, idx } = smallKeys[i];
      const row = vrSmall?.valueRanges?.[i]?.values?.[0] || [];
      rowsByKey.set(`${c}#${idx}`, row);
    });
  }

  // 4) 組裝回傳
  const results = [];
  const markToStatus = (raw) => {
    const s = String(raw || "").trim();
    const up = s.toUpperCase();
    if (up === "V") return { present: true };
    if (up === "X") return { present: false };
    if (s === "假" || s === "請假") return { present: "leave" };
    return null;
  };

  for (const c of courses) {
    const list = byCourse.get(c);
    if (!list || list.length === 0) continue;

    const { headerDates } = metaMap.get(c) || getCourseMetaFromCache(SPREADSHEET_ID, c, TZ);
    const names  = namesMapByCourse.get(c) || [];
    const idxMap = nameToIdxByCourse.get(c) || new Map();
    const remain = remainColByCourse.get(c) || [];
    const useMatrix = list.length > ROSTER_ROW_FETCH_THRESHOLD;
    const matrix = matrixByCourse.get(c);

    for (const it of list) {
      const idx = idxMap.get(it.name);
      const remainingFromCourse = (typeof idx === "number" && idx >= 0 && remain[idx] && remain[idx][0] != null)
        ? Number(remain[idx][0]) : 0;

      let marksRow = null;
      if (typeof idx === "number" && idx >= 0) {
        marksRow = useMatrix ? (matrix && matrix[idx]) : rowsByKey.get(`${c}#${idx}`);
      }

      const attendance = [];
      if (marksRow) {
        for (let i = 0; i < headerDates.length; i++) {
          const d = headerDates[i];
          if (!d) continue;
          const st = markToStatus(marksRow[i]);
          if (st) attendance.push({ date: d, present: st.present });
        }
      }

      results.push({
        ...it,
        remainingFromCourseSheet: remainingFromCourse,
        attendance
      });
    }
  }

  return jsonOutput({ success: true, count: results.length, students: results });
}






    // === 📌 小工具：抓某個學生的出缺席資料（獨立表） ===
    function getStudentAttendance(course, period, studentName) {
      const sheet = openSheetByName("出缺勤紀錄");
      if (!sheet) return [];

      const records = getSheetJson(sheet);
      return records
        .filter(r =>
          String(r["課程"] || "") === course &&
          String(r["時段"] || "") === period &&
          String(r["姓名"] || "") === studentName
        )
        .map(r => ({
          date: r["日期"],
          status: r["出缺勤"]
        }));
    }

    /* ========== 未知 action ========== */
    return jsonOutput({success:false, error:"未知的 action 類型"});

  }catch(err){
    return jsonOutput({success:false, error: err && err.message ? err.message : String(err)});
  }
}