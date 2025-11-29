/************************************************************
 * FLB Reader (Users + Teacher Bindings + Schedules + SchedulesLink + Groups) - Single File
 * 新增：Groups（群組資料表）
 *  Groups (GET):
 *    ?action=listGroups[&q=..&type=..&limit=..&offset=..&orderBy=..&order=..&fields=..]
 *    ?action=getGroup&groupId=Cxxx[&fields=...]
 *    ?action=listAllGroups[&fields=...]
 *  Groups (POST):
 *    action=upsertGroups
 *      list=[{groupId, groupName, type, firstSeenAt, lastActivityAt, memberCount, description}, ...]
 ************************************************************/

/** ==================== 0) 設定 ==================== */
var CONFIG = this.CONFIG || {
  SPREADSHEET_ID: '1A2dPb0iyvaqVGTOKqGcsq7aC6UHNttVcJ82r-G0xevk',
  SHEET_USERS: '使用者資料表 (users)',
  SHEET_BINDINGS: '講師綁定表 (teacher_bindings)',
  SHEET_GROUPS: '群組資料表 (groups)', // ← 新增
  SHEET_SCHEDULE: '上課時間',
  SHEET_SCHEDULE_LINK: '上課時間(link calender）)',
  MAX_LIMIT: 500,
  ENABLE_API_KEY: false,
  API_KEY: 'REPLACE_ME'
};

var USERS_HEADERS = this.USERS_HEADERS || [
  'userId','displayName','userName','pictureUrl','email',
  'registeredAt','lastLogin','teacherName','teacherId'
];

var BIND_HEADERS = this.BIND_HEADERS || [
  'id','userId','teacherName','teacherId','boundAt','isActive','userName'
];

// ← 新增群組表頭
var GROUPS_HEADERS = this.GROUPS_HEADERS || [
  'groupId','groupName','type','firstSeenAt','lastActivityAt','memberCount','description'
];

var SCHEDULE_HEADERS = this.SCHEDULE_HEADERS || [
  '週次','時段','時間','課別','備註1','備註2','授課的老師'
];

/** ==================== 1) 共用工具 ==================== */
function _normalize(s){
  if (s == null) return '';
  s = String(s).trim();
  var f='！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～　';
  var h='!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ';
  return s.replace(/[\uFF01-\uFF5E\u3000]/g, function(ch){ return h[f.indexOf(ch)]; });
}
function _ss(){ return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }
function _getSheet(name){
  var s = _ss().getSheetByName(name);
  if (!s) throw new Error('找不到工作表：' + name);
  return s;
}
function _readTable(sheet){
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  var header = values[0].map(String);
  return values.slice(1).map(function(row){
    var o = {};
    header.forEach(function(k,i){ o[k] = row[i]; });
    return o;
  });
}
function _pickFields(obj, fields){
  if (!fields || !fields.length) return obj;
  var out = {};
  fields.forEach(function(f){ out[f] = obj[f]; });
  return out;
}
function _compare(a,b,key,order){
  var va = (a[key] ?? '').toString();
  var vb = (b[key] ?? '').toString();
  if (va === vb) return 0;
  var res = va > vb ? 1 : -1;
  return order === 'desc' ? -res : res;
}
function _bool(val){
  if (typeof val === 'boolean') return val;
  var s = _normalize(String(val)).toLowerCase();
  if (s === '') return null;
  return ['1','true','yes','y','t','on'].includes(s);
}
function _ensureApiKey(p){
  if (!CONFIG.ENABLE_API_KEY) return;
  if (!p.key || p.key !== CONFIG.API_KEY) throw new Error('Unauthorized (invalid API key)');
}
function _idxOfHeader(headerArr, name, fallbackIdx){
  function nz(s){ return _normalize(String(s == null ? '' : s)); }
  var n = headerArr.findIndex(function(h){ return nz(h) === nz(name); });
  return n >= 0 ? n : fallbackIdx;
}

function _buildUserNameIndex_(){
  var sheet = _getSheet(_usersSheetName({}));
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {};
  var header = values[0].map(String);

  function idxOf(name, fb){ return _idxOfHeader(header, name, fb); }
  function nz(s){ return _normalize(String(s == null ? '' : s)); }

  var uidIdx = idxOf('userId', 0);
  var unameIdx = idxOf('userName', null);
  var dnameIdx = idxOf('displayName', null);

  var map = {};
  for (var r=1; r<values.length; r++){
    var row = values[r];
    var uid = nz(row[uidIdx]);
    if (!uid) continue;
    var uname = (unameIdx != null) ? String(row[unameIdx] || '') : '';
    if (!uname && dnameIdx != null) uname = String(row[dnameIdx] || '');
    map[uid] = uname || '';
  }
  return map;
}

function _attachUserName_(rows){
  if (!rows || !rows.length) return rows || [];
  var idx = _buildUserNameIndex_();
  rows.forEach(function(r){
    var uid = _normalize(String(r.userId || ''));
    r.userName = idx[uid] || '';
  });
  return rows;
}

/** ==================== A) 依老師回傳課表 ==================== */
function listTeacherCourseTimes_(p){
  _ensureApiKey(p);
  var teacher = _normalize(p.teacher || p.t || '');
  var source  = (p.source || p.src || 'link').toLowerCase();
  var targetSheets = (source === 'plain')
    ? [CONFIG.SHEET_SCHEDULE]
    : [CONFIG.SHEET_SCHEDULE_LINK];

  var foundSheets = targetSheets.filter(function(name){
    try { _getSheet(name); return true; } catch(e){ return false; }
  });
  if (!foundSheets.length){
    return {
      success: true,
      teacher: teacher || null,
      sourceRequested: (source === 'plain' ? 'plain' : 'link'),
      sheetFound: false,
      foundSheets: [],
      courseTimes: []
    };
  }

  var out = [];
  foundSheets.forEach(function(name){
    var sheet = _getSheet(name);
    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) return;

    var header = values[0].map(String);
    function idxOf(h, fb){ return _idxOfHeader(header, h, fb); }
    function nz(s){ return _normalize(String(s == null ? '' : s)); }

    var COL = {
      week:    idxOf('週次', 0),
      period:  idxOf('時段', 1),
      time:    idxOf('時間', 2),
      course:  idxOf('課別', 3),
      note1:   idxOf('備註1', 4),
      note2:   idxOf('備註2', 5),
      teacher: idxOf('授課的老師', 6)
    };

    for (var r=1; r<values.length; r++){
      var row = values[r];
      var rowTeacher = nz(row[COL.teacher]);
      if (teacher && rowTeacher.indexOf(teacher) === -1) continue;

      var week   = nz(row[COL.week]);
      var period = nz(row[COL.period]);
      var time   = nz(row[COL.time]);
      var course = String(row[COL.course] || '');
      var note1  = String(row[COL.note1]  || '');
      var note2  = String(row[COL.note2]  || '');

      var timeForApi = time || ([week, period].filter(Boolean).join(' ')) || week;

      var label = course + (period ? '（' + period + '）' : '');
      out.push({
        label: label,
        course: course,
        time: timeForApi,
        reportApi: course,
        students: '',
        note: (note1 || note2 || ''),
        source: name
      });
    }
  });

  return {
    success: true,
    teacher: teacher || null,
    sourceRequested: (source === 'plain' ? 'plain' : 'link'),
    sheetFound: true,
    foundSheets: foundSheets,
    courseTimes: out
  };
}

/** ==================== 2) Users 讀取 ==================== */
function _usersSheetName(p){ return p.sheetName || CONFIG.SHEET_USERS; }

function getUser_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(_usersSheetName(p));
  var all = _readTable(sheet);
  var userId = _normalize(p.userId || p.uid || '');
  if (!userId) return {success:false, message:'缺少必要參數：userId'};
  var item = all.find(function(r){ return _normalize(String(r.userId)) === userId; });
  if (!item) return {success:false, message:'查無此 userId', userId:userId};
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  return {success:true, data:_pickFields(item, fields)};
}

function listUsers_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(_usersSheetName(p));
  var all = _readTable(sheet);

  var q = _normalize(p.q || '');
  var teacherId = _normalize(p.teacherId || p.tid || '');
  var email = _normalize(p.email || '');
  var registeredAfter = p.registeredAfter || '';
  var lastLoginAfter = p.lastLoginAfter || '';

  var filtered = all.filter(function(r){
    if (teacherId && _normalize(String(r.teacherId)) !== teacherId) return false;
    if (email && _normalize(String(r.email)) !== email) return false;
    if (q){
      var hay = [r.userId, r.displayName, r.userName, r.email, r.teacherName, r.teacherId]
        .map(function(v){ return _normalize(String(v || '')); }).join(' ');
      if (!hay.includes(q)) return false;
    }
    if (registeredAfter){
      var a = new Date(registeredAfter).getTime();
      var b = new Date(r.registeredAt || '').getTime();
      if (!isNaN(a) && !isNaN(b) && b < a) return false;
    }
    if (lastLoginAfter){
      var a2 = new Date(lastLoginAfter).getTime();
      var b2 = new Date(r.lastLogin || '').getTime();
      if (!isNaN(a2) && !isNaN(b2) && b2 < a2) return false;
    }
    return true;
  });

  var orderBy = (p.orderBy || '').trim();
  var order = (p.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  if (orderBy && USERS_HEADERS.includes(orderBy)){
    filtered.sort(function(a,b){ return _compare(a,b,orderBy,order); });
  }

  var total = filtered.length;
  var limit = Math.max(0, Math.min(+p.limit || 50, CONFIG.MAX_LIMIT));
  var offset = Math.max(0, +p.offset || 0);
  var page = filtered.slice(offset, offset + limit);

  _attachUserName_(page);

  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var data = page.map(function(item){ return _pickFields(item, fields); });

  return {success:true, total:total, limit:limit, offset:offset, orderBy:orderBy || null, order:order, data:data};
}

function exportUsersCsv_(p){
  _ensureApiKey(p);
  var list = listUsers_(Object.assign({}, p, {limit: CONFIG.MAX_LIMIT, offset: 0}));
  var rows = list.data || [];
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var header = fields.length ? fields : USERS_HEADERS;

  var csv = [header.join(',')];
  rows.forEach(function(r){
    var line = header.map(function(k){
      var v = r[k] != null ? String(r[k]) : '';
      return /[,\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',');
    csv.push(line);
  });
  return csv.join('\n');
}

function listAllUsers_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(_usersSheetName(p));
  var all = _readTable(sheet);
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var data = all.map(function(it){ return _pickFields(it, fields); });
  _attachUserName_(data);
  return {success:true, total:data.length, data:data};
}

/** ==================== 2-b) Users 寫入（新增或更新） ==================== */
function upsertUsers_(p){
  _ensureApiKey(p);
  
  var list = p.list || [];
  if (!Array.isArray(list) || list.length === 0){
    return {success:false, message:'list[] 為空或無效'};
  }

  var sheetName = _usersSheetName(p);
  var spreadsheet = _ss();
  var sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet){
    console.log('工作表不存在，建立新工作表:', sheetName);
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setValues([USERS_HEADERS]);
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  var lastRow = sheet.getLastRow();
  var existingData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, USERS_HEADERS.length).getValues() : [];
  var existingMap = new Map();
  
  existingData.forEach(function(row, index){
    if (row[0]){
      existingMap.set(String(row[0]), index + 2);
    }
  });
  
  var updated = 0, added = 0;
  list.forEach(function(user){
    var userId = String(user.userId || '');
    if (!userId) return;
    
    var rowData = [
      userId,
      user.displayName || '',
      user.userName || '',
      user.pictureUrl || '',
      user.email || '',
      user.registeredAt || new Date().toISOString(),
      user.lastLogin || '',
      user.teacherName || '',
      user.teacherId || ''
    ];
    
    if (existingMap.has(userId)){
      var rowNum = existingMap.get(userId);
      sheet.getRange(rowNum, 1, 1, USERS_HEADERS.length).setValues([rowData]);
      console.log('更新使用者:', userId);
      updated++;
    } else {
      sheet.appendRow(rowData);
      console.log('新增使用者:', userId);
      added++;
    }
  });
  
  return {
    success: true,
    message: '成功處理 ' + list.length + ' 個使用者（新增:' + added + ', 更新:' + updated + '）',
    processedCount: list.length,
    added: added,
    updated: updated
  };
}

/** ==================== 3) Bindings 讀取 ==================== */
function _bindSheetName(p){ return p.bindSheetName || CONFIG.SHEET_BINDINGS; }

function getBinding_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(_bindSheetName(p));
  var all = _readTable(sheet);
  var id  = _normalize(p.id || '');
  var uid = _normalize(p.userId || p.uid || '');
  var tid = _normalize(p.teacherId || p.tid || '');

  var item = null;
  if (id){
    item = all.find(function(r){ return _normalize(String(r.id)) === id; });
  } else if (uid && tid){
    item = all.find(function(r){
      return _normalize(String(r.userId)) === uid && _normalize(String(r.teacherId)) === tid;
    });
  } else {
    return {success:false, message:'缺少必要參數：id 或 (userId + teacherId)'};
  }
  if (!item) return {success:false, message:'查無此綁定'};

  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  return {success:true, data:_pickFields(item, fields)};
}

function listBindings_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(_bindSheetName(p));
  var all = _readTable(sheet);

  var q = _normalize(p.q || '');
  var uid = _normalize(p.userId || p.uid || '');
  var tid = _normalize(p.teacherId || p.tid || '');
  var isActive = (typeof p.isActive !== 'undefined') ? _bool(p.isActive) : null;

  var filtered = all.filter(function(r){
    if (uid && _normalize(String(r.userId)) !== uid) return false;
    if (tid && _normalize(String(r.teacherId)) !== tid) return false;
    if (isActive !== null && _bool(r.isActive) !== isActive) return false;
    if (q){
      var hay = [r.id, r.userId, r.teacherName, r.teacherId]
        .map(function(v){ return _normalize(String(v || '')); }).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  var orderBy = (p.orderBy || '').trim();
  var order = (p.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  if (orderBy && BIND_HEADERS.includes(orderBy)){
    filtered.sort(function(a,b){ return _compare(a,b,orderBy,order); });
  }

  var total = filtered.length;
  var limit = Math.max(0, Math.min(+p.limit || 50, CONFIG.MAX_LIMIT));
  var offset = Math.max(0, +p.offset || 0);
  var page = filtered.slice(offset, offset + limit);

  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var data = page.map(function(it){ return _pickFields(it, fields); });

  return {success:true, total:total, limit:limit, offset:offset, orderBy:orderBy || null, order:order, data:data};
}

function exportBindingsCsv_(p){
  _ensureApiKey(p);
  var list = listBindings_(Object.assign({}, p, {limit: CONFIG.MAX_LIMIT, offset: 0}));
  var rows = list.data || [];
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var header = fields.length ? fields : BIND_HEADERS;

  rows = _attachUserName_(rows);

  var csv = [header.join(',')];
  rows.forEach(function(r){
    var line = header.map(function(k){
      var v = r[k] != null ? String(r[k]) : '';
      return /[,\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',');
    csv.push(line);
  });
  return csv.join('\n');
}

function listAllBindings_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(_bindSheetName(p));
  var all = _readTable(sheet);
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var data = all.map(function(it){ return _pickFields(it, fields); });
  return {success:true, total:data.length, data:data};
}

/** ==================== 3-b) Groups（群組資料表） ==================== */
function _groupsSheetName(p){ return p.groupsSheetName || CONFIG.SHEET_GROUPS; }

// POST: 新增或更新群組（批次）
function upsertGroups_(p){
  _ensureApiKey(p);
  
  var list = p.list || [];
  if (!Array.isArray(list) || list.length === 0){
    return {success:false, message:'list[] 為空或無效'};
  }

  var sheetName = _groupsSheetName(p);
  var spreadsheet = _ss();
  var sheet = spreadsheet.getSheetByName(sheetName);
  
  // 如果工作表不存在，自動建立
  if (!sheet){
    console.log('工作表不存在，建立新工作表:', sheetName);
    sheet = spreadsheet.insertSheet(sheetName);
    
    // 設定標題列
    var headers = GROUPS_HEADERS;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  // 取得現有資料
  var lastRow = sheet.getLastRow();
  var existingData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 7).getValues() : [];
  var existingMap = new Map();
  
  existingData.forEach(function(row, index){
    if (row[0]){ // 如果 groupId 存在
      existingMap.set(String(row[0]), index + 2); // +2 因為從第2行開始，且陣列從0開始
    }
  });
  
  console.log('現有群組數量:', existingMap.size);
  
  // 處理每個群組
  var updated = 0, added = 0;
  list.forEach(function(group){
    var groupId = String(group.groupId || '');
    if (!groupId) return; // 跳過沒有 groupId 的
    
    var rowData = [
      groupId,
      group.groupName || '未知群組',
      group.type || 'group',
      group.firstSeenAt || new Date().toISOString(),
      group.lastActivityAt || new Date().toISOString(),
      group.memberCount || 0,
      group.description || ''
    ];
    
    if (existingMap.has(groupId)){
      // 更新現有群組
      var rowNum = existingMap.get(groupId);
      sheet.getRange(rowNum, 1, 1, 7).setValues([rowData]);
      console.log('更新群組:', groupId, group.groupName);
      updated++;
    } else {
      // 新增群組
      sheet.appendRow(rowData);
      console.log('新增群組:', groupId, group.groupName);
      added++;
    }
  });
  
  return {
    success: true,
    message: '成功處理 ' + list.length + ' 個群組（新增:' + added + ', 更新:' + updated + '）',
    processedCount: list.length,
    added: added,
    updated: updated
  };
}

// GET: 讀取群組列表
function listGroups_(p){
  _ensureApiKey(p);
  
  var sheetName = _groupsSheetName(p);
  try {
    var sheet = _getSheet(sheetName);
  } catch(e) {
    return {
      success: true,
      message: '群組資料表尚未建立',
      total: 0,
      limit: 0,
      offset: 0,
      data: []
    };
  }
  
  var all = _readTable(sheet);
  
  var q = _normalize(p.q || '');
  var type = _normalize(p.type || '');
  
  var filtered = all.filter(function(r){
    if (type && _normalize(String(r.type)) !== type) return false;
    if (q){
      var hay = [r.groupId, r.groupName, r.type, r.description]
        .map(function(v){ return _normalize(String(v || '')); }).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  
  var orderBy = (p.orderBy || '').trim();
  var order = (p.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  if (orderBy && GROUPS_HEADERS.includes(orderBy)){
    filtered.sort(function(a,b){ return _compare(a,b,orderBy,order); });
  }
  
  var total = filtered.length;
  var limit = Math.max(0, Math.min(+p.limit || 50, CONFIG.MAX_LIMIT));
  var offset = Math.max(0, +p.offset || 0);
  var page = filtered.slice(offset, offset + limit);
  
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var data = page.map(function(item){ return _pickFields(item, fields); });
  
  return {success:true, total:total, limit:limit, offset:offset, orderBy:orderBy || null, order:order, data:data};
}

// GET: 取得單一群組
function getGroup_(p){
  _ensureApiKey(p);
  
  var sheetName = _groupsSheetName(p);
  try {
    var sheet = _getSheet(sheetName);
  } catch(e) {
    return {success:false, message:'群組資料表尚未建立'};
  }
  
  var all = _readTable(sheet);
  var groupId = _normalize(p.groupId || p.gid || '');
  if (!groupId) return {success:false, message:'缺少必要參數：groupId'};
  
  var item = all.find(function(r){ return _normalize(String(r.groupId)) === groupId; });
  if (!item) return {success:false, message:'查無此 groupId', groupId:groupId};
  
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  return {success:true, data:_pickFields(item, fields)};
}

// GET: 取得所有群組（不分頁）
function listAllGroups_(p){
  _ensureApiKey(p);
  
  var sheetName = _groupsSheetName(p);
  try {
    var sheet = _getSheet(sheetName);
  } catch(e) {
    return {
      success: true,
      message: '群組資料表尚未建立',
      total: 0,
      data: []
    };
  }
  
  var all = _readTable(sheet);
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var data = all.map(function(it){ return _pickFields(it, fields); });
  return {success:true, total:data.length, data:data};
}

/** ==================== 4) Schedules（上課時間） ==================== */
function writeSchedule_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE);

  var row = [
    p.week   || '',
    p.period || '',
    p.time   || '',
    p.course || '',
    p.note1  || '',
    p.note2  || '',
    p.teacher|| ''
  ];
  sheet.appendRow(row);

  var data = {
    "週次": row[0],
    "時段": row[1],
    "時間": row[2],
    "課別": row[3],
    "備註1": row[4],
    "備註2": row[5],
    "授課的老師": row[6]
  };
  return { success:true, message:'Schedule added successfully', data:data };
}

function addOrUpdateSchedule_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE);

  var values = sheet.getDataRange().getValues();
  if (values.length === 0) throw new Error('上課時間 工作表尚無表頭');
  var header = values[0].map(String);

  function nz(s){ return _normalize(String(s == null ? '' : s)); }
  function idxOf(name, fb){ return _idxOfHeader(header, name, fb); }

  var COL = {
    week:    idxOf('週次', 0),
    period:  idxOf('時段', 1),
    time:    idxOf('時間', 2),
    course:  idxOf('課別', 3),
    note1:   idxOf('備註1', 4),
    note2:   idxOf('備註2', 5),
    teacher: idxOf('授課的老師', 6)
  };

  var V = {
    week:    nz(p.week),
    period:  nz(p.period),
    time:    nz(p.time),
    course:  nz(p.course),
    note1:   (p.note1  != null ? String(p.note1)  : ''),
    note2:   (p.note2  != null ? String(p.note2)  : ''),
    teacher: (p.teacher!= null ? String(p.teacher): '')
  };

  var foundRow = -1;
  for (var r = 1; r < values.length; r++){
    var row = values[r];
    var same =
      nz(row[COL.week])   === V.week   &&
      nz(row[COL.period]) === V.period &&
      nz(row[COL.time])   === V.time   &&
      nz(row[COL.course]) === V.course;
    if (same){ foundRow = r + 1; break; }
  }

  var rowToWrite = (foundRow > 0)
    ? header.map(function(_, i){ return values[foundRow-1][i]; })
    : new Array(header.length).fill('');

  rowToWrite[COL.week]   = V.week;
  rowToWrite[COL.period] = V.period;
  rowToWrite[COL.time]   = V.time;
  rowToWrite[COL.course] = V.course;
  rowToWrite[COL.note1]  = V.note1;
  rowToWrite[COL.note2]  = V.note2;
  rowToWrite[COL.teacher]= V.teacher;

  var message;
  if (foundRow > 0){
    sheet.getRange(foundRow, 1, 1, header.length).setValues([rowToWrite]);
    message = 'Schedule updated successfully';
  } else {
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, header.length).setValues([rowToWrite]);
    message = 'Schedule added successfully';
  }

  return {
    success: true,
    message: message,
    data: {
      "週次": V.week,
      "時段": V.period,
      "時間": V.time,
      "課別": V.course,
      "備註1": V.note1,
      "備註2": V.note2,
      "授課的老師": V.teacher
    }
  };
}

function listSchedules_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {success:true, total:0, limit:0, offset:0, data:[]};

  var header = values[0].map(String);
  var rows = values.slice(1).map(function(r){
    var o = {};
    header.forEach(function(h,i){ o[h] = r[i]; });
    return o;
  });

  var q = _normalize(p.q || '');
  var course = _normalize(p.course || '');
  var teacher = _normalize(p.teacher || '');

  var filtered = rows.filter(function(r){
    if (course && _normalize(String(r['課別'] || '')) !== course) return false;
    if (teacher && _normalize(String(r['授課的老師'] || '')).indexOf(teacher) === -1) return false;
    if (q){
      var hay = ['週次','時段','時間','課別','備註1','備註2','授課的老師']
        .map(function(k){ return _normalize(String(r[k] || '')); }).join(' ');
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  var orderBy = (p.orderBy || '').trim();
  var order = (p.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  if (orderBy && header.indexOf(orderBy) >= 0){
    filtered.sort(function(a,b){
      var va = (a[orderBy] ?? '').toString();
      var vb = (b[orderBy] ?? '').toString();
      if (va === vb) return 0;
      var res = va > vb ? 1 : -1;
      return order === 'desc' ? -res : res;
    });
  }

  var total = filtered.length;
  var limit = Math.max(0, Math.min(+p.limit || 50, CONFIG.MAX_LIMIT));
  var offset = Math.max(0, +p.offset || 0);
  var page = filtered.slice(offset, offset + limit);

  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var data = page.map(function(item){
    if (!fields.length) return item;
    var out = {}; fields.forEach(function(f){ out[f] = item[f]; }); return out;
  });

  return {success:true, total:total, limit:limit, offset:offset, orderBy:orderBy || null, order:order, data:data};
}

function getSchedule_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {success:false, message:'No data'};

  var header = values[0].map(String);
  function nz(s){ return _normalize(String(s == null ? '' : s)); }
  var idIdx = _idxOfHeader(header, 'id', null);

  var id = (p.id || '').toString().trim();

  if (id && idIdx != null){
    for (var r=1; r<values.length; r++){
      if (String(values[r][idIdx]) === id){
        var obj = {}; header.forEach(function(h,i){ obj[h] = values[r][i]; });
        return {success:true, data:obj};
      }
    }
  }

  var COL = {
    week:    _idxOfHeader(header,'週次',0),
    period:  _idxOfHeader(header,'時段',1),
    time:    _idxOfHeader(header,'時間',2),
    course:  _idxOfHeader(header,'課別',3)
  };
  var vw = nz(p.week), vp = nz(p.period), vt = nz(p.time), vc = nz(p.course);
  if (!vw || !vp || !vt || !vc) return {success:false, message:'請提供 id 或 (week, period, time, course)'};

  for (var r2=1; r2<values.length; r2++){
    var row = values[r2];
    var same =
      nz(row[COL.week])===vw && nz(row[COL.period])===vp && nz(row[COL.time])===vt && nz(row[COL.course])===vc;
    if (same){
      var obj2 = {}; header.forEach(function(h,i){ obj2[h] = row[i]; });
      return {success:true, data:obj2};
    }
  }
  return {success:false, message:'查無資料'};
}

function getScheduleByKey_(p){
  p = p || {};
  delete p.id;
  return getSchedule_(p);
}

function exportSchedulesCsv_(p){
  _ensureApiKey(p);
  var list = listSchedules_(Object.assign({}, p, {limit: CONFIG.MAX_LIMIT, offset: 0}));
  var rows = list.data || [];
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE);
  var headerValues = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var header = fields.length ? fields : headerValues;

  var csv = [header.join(',')];
  rows.forEach(function(r){
    var line = header.map(function(k){
      var v = r[k] != null ? String(r[k]) : '';
      return /[,\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',');
    csv.push(line);
  });
  return csv.join('\n');
}

function listAllSchedules_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {success:true, total:0, data:[]};

  var header = values[0].map(String);
  var data = values.slice(1).map(function(r){
    var o = {}; header.forEach(function(h,i){ o[h]=r[i]; }); return o;
  });

  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  if (fields.length){
    data = data.map(function(it){ var out={}; fields.forEach(function(f){ out[f]=it[f]; }); return out; });
  }
  return {success:true, total:data.length, data:data};
}

/** ==================== 4-b) Schedules Link ==================== */
function writeScheduleLink_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE_LINK);

  var row = [
    p.week   || '',
    p.period || '',
    p.time   || '',
    p.course || '',
    p.note1  || '',
    p.note2  || '',
    p.teacher|| ''
  ];
  sheet.appendRow(row);

  return {
    success: true,
    message: 'Schedule(link) added successfully',
    data: {
      "週次": row[0],
      "時段": row[1],
      "時間": row[2],
      "課別": row[3],
      "備註1": row[4],
      "備註2": row[5],
      "授課的老師": row[6]
    }
  };
}

function addSchedulesLinkBulk_(p){
  _ensureApiKey(p);
  var items = (p && (p.items || p.data)) || [];
  if (!Array.isArray(items) || items.length === 0) {
    return { success:false, message:'items[] 為空' };
  }

  var added = 0, failed = 0, results = [];
  items.forEach(function(it, idx){
    try {
      var r = writeScheduleLink_(it);
      results.push({ index: idx, ok: true, data: r.data });
      added++;
    } catch (e){
      results.push({ index: idx, ok: false, error: (e.message || String(e)) });
      failed++;
    }
  });

  return { success: failed === 0, added: added, failed: failed, results: results };
}

function addOrUpdateSchedulesLinkBulk_(p){
  _ensureApiKey(p);

  var items = (p && (p.items || p.data)) || [];
  if (!Array.isArray(items) || items.length === 0){
    return { success:false, message:'items[] 為空' };
  }

  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE_LINK);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1) throw new Error('上課時間(link calender） 工作表尚無表頭');

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  function idxOf(name, fb){ return _idxOfHeader(header, name, fb); }
  var COL = {
    week:    idxOf('週次', 0),
    period:  idxOf('時段', 1),
    time:    idxOf('時間', 2),
    course:  idxOf('課別', 3),
    note1:   idxOf('備註1', 4),
    note2:   idxOf('備註2', 5),
    teacher: idxOf('授課的老師', 6)
  };

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  var rows = items.map(function(it){
    var row = new Array(header.length).fill('');
    row[COL.week]    = it['週次'] || it.week   || '';
    row[COL.period]  = it['時段'] || it.period || '';
    row[COL.time]    = it['時間'] || it.time   || '';
    row[COL.course]  = it['課別'] || it.course || '';
    row[COL.note1]   = it['備註1'] || it.note1  || '';
    row[COL.note2]   = it['備註2'] || it.note2  || '';
    row[COL.teacher] = it['授課的老師'] || it.teacher || '';
    return row;
  });

  sheet.getRange(2, 1, rows.length, header.length).setValues(rows);

  return {
    success: true,
    mode: 'REPLACE_ALL_THEN_BULK_INSERT',
    totalWritten: rows.length,
    message: 'All existing rows cleared (header kept) and new items inserted.'
  };
}

function addOrUpdateScheduleLink_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE_LINK);

  var values = sheet.getDataRange().getValues();
  if (values.length === 0) throw new Error('上課時間(link calender） 工作表尚無表頭');

  var header = values[0].map(String);
  function nz(s){ return _normalize(String(s == null ? '' : s)); }

  var COL = {
    week:    _idxOfHeader(header, '週次', 0),
    period:  _idxOfHeader(header, '時段', 1),
    time:    _idxOfHeader(header, '時間', 2),
    course:  _idxOfHeader(header, '課別', 3),
    note1:   _idxOfHeader(header, '備註1', 4),
    note2:   _idxOfHeader(header, '備註2', 5),
    teacher: _idxOfHeader(header, '授課的老師', 6)
  };

  var V = {
    week:    nz(p.week),
    period:  nz(p.period),
    time:    nz(p.time),
    course:  nz(p.course),
    note1:   (p.note1  != null ? String(p.note1)  : ''),
    note2:   (p.note2  != null ? String(p.note2)  : ''),
    teacher: (p.teacher!= null ? String(p.teacher): '')
  };

  var foundRow = -1;
  for (var r = 1; r < values.length; r++){
    var row = values[r];
    var same =
      nz(row[COL.week])   === V.week   &&
      nz(row[COL.period]) === V.period &&
      nz(row[COL.time])   === V.time   &&
      nz(row[COL.course]) === V.course;
    if (same){ foundRow = r + 1; break; }
  }

  var rowToWrite = (foundRow > 0)
    ? header.map(function(_, i){ return values[foundRow-1][i]; })
    : new Array(header.length).fill('');

  rowToWrite[COL.week]   = V.week;
  rowToWrite[COL.period] = V.period;
  rowToWrite[COL.time]   = V.time;
  rowToWrite[COL.course] = V.course;
  rowToWrite[COL.note1]  = V.note1;
  rowToWrite[COL.note2]  = V.note2;
  rowToWrite[COL.teacher]= V.teacher;

  var msg;
  if (foundRow > 0){
    sheet.getRange(foundRow, 1, 1, header.length).setValues([rowToWrite]);
    msg = 'Schedule(link) updated successfully';
  } else {
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, header.length).setValues([rowToWrite]);
    msg = 'Schedule(link) added successfully';
  }

  return {
    success: true,
    message: msg,
    data: {
      "週次": V.week,
      "時段": V.period,
      "時間": V.time,
      "課別": V.course,
      "備註1": V.note1,
      "備註2": V.note2,
      "授課的老師": V.teacher
    }
  };
}

function listSchedulesLink_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE_LINK);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {success:true, total:0, limit:0, offset:0, data:[]};

  var header = values[0].map(String);
  var rows = values.slice(1).map(function(r){
    var o = {};
    header.forEach(function(h,i){ o[h] = r[i]; });
    return o;
  });

  var q = _normalize(p.q || '');
  var course = _normalize(p.course || '');
  var teacher = _normalize(p.teacher || '');

  var filtered = rows.filter(function(r){
    if (course && _normalize(String(r['課別'] || '')) !== course) return false;
    if (teacher && _normalize(String(r['授課的老師'] || '')).indexOf(teacher) === -1) return false;
    if (q){
      var hay = ['週次','時段','時間','課別','備註1','備註2','授課的老師']
        .map(function(k){ return _normalize(String(r[k] || '')); }).join(' ');
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  var orderBy = (p.orderBy || '').trim();
  var order = (p.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  if (orderBy && header.indexOf(orderBy) >= 0){
    filtered.sort(function(a,b){
      var va = (a[orderBy] ?? '').toString();
      var vb = (b[orderBy] ?? '').toString();
      if (va === vb) return 0;
      var res = va > vb ? 1 : -1;
      return order === 'desc' ? -res : res;
    });
  }

  var total = filtered.length;
  var limit = Math.max(0, Math.min(+p.limit || 50, CONFIG.MAX_LIMIT));
  var offset = Math.max(0, +p.offset || 0);
  var page = filtered.slice(offset, offset + limit);

  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var data = page.map(function(item){
    if (!fields.length) return item;
    var out = {}; fields.forEach(function(f){ out[f] = item[f]; }); return out;
  });

  return {success:true, total:total, limit:limit, offset:offset, orderBy:orderBy || null, order:order, data:data};
}

function getScheduleLinkByKey_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE_LINK);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {success:false, message:'No data'};

  var header = values[0].map(String);
  function nz(s){ return _normalize(String(s == null ? '' : s)); }
  var COL = {
    week:    _idxOfHeader(header,'週次',0),
    period:  _idxOfHeader(header,'時段',1),
    time:    _idxOfHeader(header,'時間',2),
    course:  _idxOfHeader(header,'課別',3)
  };

  var vw = nz(p.week), vp = nz(p.period), vt = nz(p.time), vc = nz(p.course);
  if (!vw || !vp || !vt || !vc) return {success:false, message:'缺少必要參數：week, period, time, course'};

  for (var r=1; r<values.length; r++){
    var row = values[r];
    var same =
      nz(row[COL.week])===vw && nz(row[COL.period])===vp && nz(row[COL.time])===vt && nz(row[COL.course])===vc;
    if (same){
      var obj = {};
      header.forEach(function(h,i){ obj[h] = row[i]; });
      return {success:true, data:obj};
    }
  }
  return {success:false, message:'查無資料'};
}

function exportSchedulesLinkCsv_(p){
  _ensureApiKey(p);
  var list = listSchedulesLink_(Object.assign({}, p, {limit: CONFIG.MAX_LIMIT, offset: 0}));
  var rows = list.data || [];
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE_LINK);
  var headerValues = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var header = fields.length ? fields : headerValues;

  var csv = [header.join(',')];
  rows.forEach(function(r){
    var line = header.map(function(k){
      var v = r[k] != null ? String(r[k]) : '';
      return /[,\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',');
    csv.push(line);
  });
  return csv.join('\n');
}

function listAllSchedulesLink_(p){
  _ensureApiKey(p);
  var sheet = _getSheet(CONFIG.SHEET_SCHEDULE_LINK);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {success:true, total:0, data:[]};

  var header = values[0].map(String);
  var data = values.slice(1).map(function(r){
    var o = {}; header.forEach(function(h,i){ o[h]=r[i]; }); return o;
  });

  var fields = (p.fields || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
  if (fields.length){
    data = data.map(function(it){ var out={}; fields.forEach(function(f){ out[f]=it[f]; }); return out; });
  }
  return {success:true, total:data.length, data:data};
}

/** ==================== 5) Router ==================== */
function doGet(e){
  var p = (e && e.parameter) ? e.parameter : {};
  try {
    // Users
    if (p.action === 'listUsers')      return ContentService.createTextOutput(JSON.stringify(listUsers_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'getUser')        return ContentService.createTextOutput(JSON.stringify(getUser_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'exportUsersCsv') return ContentService.createTextOutput(exportUsersCsv_(p)).setMimeType(ContentService.MimeType.CSV);
    if (p.action === 'listAllUsers')   return ContentService.createTextOutput(JSON.stringify(listAllUsers_(p))).setMimeType(ContentService.MimeType.JSON);

    // Bindings
    if (p.action === 'listBindings')      return ContentService.createTextOutput(JSON.stringify(listBindings_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'getBinding')        return ContentService.createTextOutput(JSON.stringify(getBinding_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'exportBindingsCsv') return ContentService.createTextOutput(exportBindingsCsv_(p)).setMimeType(ContentService.MimeType.CSV);
    if (p.action === 'listAllBindings')   return ContentService.createTextOutput(JSON.stringify(listAllBindings_(p))).setMimeType(ContentService.MimeType.JSON);

    // Groups ← 新增
    if (p.action === 'listGroups')     return ContentService.createTextOutput(JSON.stringify(listGroups_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'getGroup')       return ContentService.createTextOutput(JSON.stringify(getGroup_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'listAllGroups')  return ContentService.createTextOutput(JSON.stringify(listAllGroups_(p))).setMimeType(ContentService.MimeType.JSON);

    // Schedules
    if (p.action === 'listSchedules')       return ContentService.createTextOutput(JSON.stringify(listSchedules_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'getSchedule')         return ContentService.createTextOutput(JSON.stringify(getSchedule_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'getScheduleByKey')    return ContentService.createTextOutput(JSON.stringify(getScheduleByKey_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'exportSchedulesCsv')  return ContentService.createTextOutput(exportSchedulesCsv_(p)).setMimeType(ContentService.MimeType.CSV);
    if (p.action === 'listAllSchedules')    return ContentService.createTextOutput(JSON.stringify(listAllSchedules_(p))).setMimeType(ContentService.MimeType.JSON);

    // Schedules Link
    if (p.action === 'listSchedulesLink')      return ContentService.createTextOutput(JSON.stringify(listSchedulesLink_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'getScheduleLinkByKey')   return ContentService.createTextOutput(JSON.stringify(getScheduleLinkByKey_(p))).setMimeType(ContentService.MimeType.JSON);
    if (p.action === 'exportSchedulesLinkCsv') return ContentService.createTextOutput(exportSchedulesLinkCsv_(p)).setMimeType(ContentService.MimeType.CSV);
    if (p.action === 'listAllSchedulesLink')   return ContentService.createTextOutput(JSON.stringify(listAllSchedulesLink_(p))).setMimeType(ContentService.MimeType.JSON);

    // Teacher CourseTimes
    if (p.action === 'listTeacherCourseTimes')
      return ContentService.createTextOutput(JSON.stringify(listTeacherCourseTimes_(p))).setMimeType(ContentService.MimeType.JSON);

    return ContentService.createTextOutput(JSON.stringify({success:false, message:'Unknown action'})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success:false, message: err.message || String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 處理 POST 請求
 * 這個函數必須在這個文件中定義，因為 Google Apps Script 只會執行主文件中的 doPost
 */
function doPost(e){
  try {
    var p = {};
    if (e && e.postData && e.postData.contents) {
      try { 
        p = JSON.parse(e.postData.contents); 
      } catch (_) { 
        p = e.parameter || {}; 
      }
    } else {
      p = e ? (e.parameter || {}) : {};
    }
    
    var action = String(p.action || '');
    
    // Groups API (POST)
    if (action === 'upsertGroups'){
      return ContentService.createTextOutput(JSON.stringify(upsertGroups_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Teacher Bindings API (POST)
    if (action === 'upsertTeacherBindings'){
      return ContentService.createTextOutput(JSON.stringify(upsertTeacherBindings_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Users API (POST)
    if (action === 'upsertUsers'){
      return ContentService.createTextOutput(JSON.stringify(upsertUsers_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Schedules API (POST)
    if (action === 'addSchedule'){
      return ContentService.createTextOutput(JSON.stringify(writeSchedule_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'addOrUpdateSchedule'){
      return ContentService.createTextOutput(JSON.stringify(addOrUpdateSchedule_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Schedules Link API (POST)
    if (action === 'addScheduleLink'){
      return ContentService.createTextOutput(JSON.stringify(writeScheduleLink_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'addOrUpdateScheduleLink'){
      return ContentService.createTextOutput(JSON.stringify(addOrUpdateScheduleLink_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'addSchedulesLinkBulk'){
      return ContentService.createTextOutput(JSON.stringify(addSchedulesLinkBulk_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'addOrUpdateSchedulesLinkBulk'){
      return ContentService.createTextOutput(JSON.stringify(addOrUpdateSchedulesLinkBulk_(p)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Fallback: 嘗試調用簽到系統處理函數（user group ID 上傳.gs）
    // 處理 action: update, query, getRosterAttendance, getCoursesByTeacher, getStudentList 等
    if (typeof handleSignInActions === 'function'){
      return handleSignInActions(e);
    }
    
    // 未知的 action
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unknown POST action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'POST Error: ' + (err.message || String(err))
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


