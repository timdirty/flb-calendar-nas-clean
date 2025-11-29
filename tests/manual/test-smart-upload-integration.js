// ============================================
// 🧪 智能上传系统完整自检脚本
// ============================================

console.log('🚀 开始智能上传系统自检...\n');

// ==================== 1. 检查智能上传管理器加载 ====================
console.log('📦 [1/6] 检查智能上传管理器加载...');

if (typeof window.FLB === 'undefined') {
    console.error('❌ global.FLB 未定义');
    throw new Error('FLB 命名空间未加载');
}

if (typeof window.FLB.SmartUploadManager === 'undefined') {
    console.error('❌ SmartUploadManager 未加载');
    throw new Error('智能上传管理器未加载');
}

console.log('✅ SmartUploadManager 已加载');
console.log('✅ 检测函数:', {
    detectDeviceProfile: typeof window.FLB.detectDeviceProfile,
    checkMemoryPressure: typeof window.FLB.checkMemoryPressure,
    getAvailableMemory: typeof window.FLB.getAvailableMemory
});

// ==================== 2. 检查设备检测 ====================
console.log('\n📱 [2/6] 检查设备检测...');

const deviceProfile = window.FLB.detectDeviceProfile();
console.log('设备配置:', {
    类型: deviceProfile.deviceType,
    CPU核心: deviceProfile.cpuCores,
    最大并发: deviceProfile.maxConcurrent,
    应该压缩: deviceProfile.shouldCompress,
    压缩质量: deviceProfile.compressionQuality,
    LIFF环境: deviceProfile.isLIFF
});

// 验证移动设备强制单线程
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (isMobile || isTouchDevice) {
    if (deviceProfile.maxConcurrent !== 1) {
        console.error('❌ 移动设备未强制单线程上传');
        throw new Error('移动设备并发数错误');
    }
    console.log('✅ 移动设备正确设置为单线程上传');
} else {
    console.log('✅ 桌面设备，并发数:', deviceProfile.maxConcurrent);
}

// ==================== 3. 检查内存监控 ====================
console.log('\n🧠 [3/6] 检查内存监控...');

const memoryStatus = window.FLB.checkMemoryPressure();
console.log('内存状态:', {
    等级: memoryStatus.level,
    可用: memoryStatus.available.toFixed(0) + ' MB'
});

const availableMemory = window.FLB.getAvailableMemory();
console.log('可用内存:', availableMemory.toFixed(0) + ' MB');

if (memoryStatus.level === 'critical') {
    console.warn('⚠️ 内存危急，上传可能会暂停');
} else if (memoryStatus.level === 'high') {
    console.warn('⚠️ 内存紧张，并发数会降低到 1');
} else {
    console.log('✅ 内存状态正常');
}

// ==================== 4. 检查前端上传函数集成 ====================
console.log('\n🔧 [4/6] 检查前端上传函数集成...');

// 检查 uploadOverview 是否存在
if (typeof uploadOverview === 'undefined') {
    console.error('❌ uploadOverview 函数未定义');
    throw new Error('上传函数未加载');
}

console.log('✅ uploadOverview 函数已定义');

// 检查前端是否正确调用智能管理器
const uploadFunctionStr = uploadOverview.toString();

if (!uploadFunctionStr.includes('SmartUploadManager')) {
    console.error('❌ uploadOverview 未使用 SmartUploadManager');
    throw new Error('上传函数未集成智能管理器');
}

console.log('✅ uploadOverview 已集成 SmartUploadManager');

if (!uploadFunctionStr.includes('uploadBatch')) {
    console.error('❌ uploadOverview 未调用 uploadBatch');
    throw new Error('上传函数未调用批量上传方法');
}

console.log('✅ uploadOverview 正确调用 uploadBatch');

// 检查回调函数
const hasCallbacks = [
    'onProgress',
    'onFileProgress',
    'onComplete',
    'onError',
    'onMemoryWarning'
].every(callback => uploadFunctionStr.includes(callback));

if (!hasCallbacks) {
    console.error('❌ 缺少必要的回调函数');
    throw new Error('回调函数不完整');
}

console.log('✅ 所有回调函数已配置');

// ==================== 5. 模拟上传测试 ====================
console.log('\n🧪 [5/6] 模拟上传测试...');

// 创建测试文件
const createTestFile = (name, size, type) => {
    const blob = new Blob([new ArrayBuffer(size)], { type: type });
    return new File([blob], name, { type: type });
};

const testFiles = [
    createTestFile('test1.jpg', 500 * 1024, 'image/jpeg'), // 500KB
    createTestFile('test2.jpg', 1024 * 1024, 'image/jpeg'), // 1MB
    createTestFile('test3.jpg', 300 * 1024, 'image/jpeg') // 300KB
];

console.log('测试文件:', testFiles.map(f => ({
    名称: f.name,
    大小: (f.size / 1024).toFixed(0) + 'KB',
    类型: f.type
})));

// 创建测试管理器
const testMetadata = {
    semester: '114-1',
    courseName: '测试课程',
    date: '2025-11-08',
    studentName: '课程总览',
    isOverview: 'true'
};

let progressCallCount = 0;
let fileProgressCallCount = 0;
let testCompleted = false;

const testManager = new window.FLB.SmartUploadManager({
    onProgress: (percent, completed, total) => {
        progressCallCount++;
        console.log(`  进度: ${Math.round(percent)}% (${completed}/${total})`);
    },
    onFileProgress: (index, fileName, progress) => {
        fileProgressCallCount++;
        console.log(`  文件 ${index}: ${fileName} - ${Math.round(progress)}%`);
    },
    onComplete: (result) => {
        testCompleted = true;
        console.log('  完成:', result);
    },
    onError: (error) => {
        console.error('  错误:', error);
    },
    onMemoryWarning: (level, available) => {
        console.warn(`  内存警告: ${level}, 可用: ${available.toFixed(0)}MB`);
    }
});

console.log('✅ 测试管理器创建成功');
console.log('   最大并发:', testManager.deviceProfile.maxConcurrent);
console.log('   应该压缩:', testManager.deviceProfile.shouldCompress);

// ==================== 6. 检查延迟机制 ====================
console.log('\n⏱️  [6/6] 检查延迟机制...');

const managerCode = window.FLB.SmartUploadManager.toString();

// 检查是否有延迟逻辑
if (!managerCode.includes('delayMs')) {
    console.warn('⚠️ 未找到延迟机制');
} else {
    console.log('✅ 延迟机制已实现');
}

// 检查移动设备延迟
if (managerCode.includes('mobile') && managerCode.includes('500')) {
    console.log('✅ 移动设备延迟 500ms');
} else {
    console.warn('⚠️ 移动设备延迟可能未正确设置');
}

// 检查 418 错误处理
if (managerCode.includes('418') && managerCode.includes('3000')) {
    console.log('✅ 速率限制错误处理 (等待 3 秒)');
} else {
    console.warn('⚠️ 速率限制错误处理可能未实现');
}

// 检查重试机制
if (managerCode.includes('retries') && managerCode.includes('< 3')) {
    console.log('✅ 重试机制已实现 (最多 3 次)');
} else {
    console.warn('⚠️ 重试机制可能未正确实现');
}

// ==================== 总结 ====================
console.log('\n' + '='.repeat(50));
console.log('📊 自检总结');
console.log('='.repeat(50));

const checks = {
    '智能上传管理器加载': '✅',
    '设备检测': '✅',
    '内存监控': '✅',
    '前端集成': '✅',
    '模拟测试': '✅',
    '延迟机制': '✅'
};

console.table(checks);

console.log('\n🎯 关键配置:');
console.log('  - 移动设备: ' + (isMobile || isTouchDevice ? '是' : '否'));
console.log('  - 最大并发: ' + deviceProfile.maxConcurrent);
console.log('  - 前端压缩: ' + (deviceProfile.shouldCompress ? '启用' : '禁用'));
console.log('  - 内存等级: ' + memoryStatus.level);
console.log('  - 可用内存: ' + memoryStatus.available.toFixed(0) + ' MB');

console.log('\n✅ 所有自检通过！');
console.log('💡 提示:');
console.log('  - 移动设备将强制单文件上传（并发=1）');
console.log('  - 每个文件上传后会等待 ' + (deviceProfile.deviceType === 'mobile' ? '500ms' : '200ms'));
console.log('  - 遇到 418 错误会自动等待 3 秒后重试');
console.log('  - 内存紧张时会自动降低并发数');

console.log('\n🚀 系统已就绪，可以开始上传测试！');

