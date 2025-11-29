// 诊断抽屉照片显示问题
(function() {
  console.log('='.repeat(60));
  console.log('📊 抽屉照片诊断工具');
  console.log('='.repeat(60));
  
  // 1. 检查 FLB.State
  var state = window.FLB && window.FLB.State && window.FLB.State.get();
  if (!state) {
    console.error('❌ FLB.State 不存在');
    return;
  }
  
  console.log('\n📦 uploadedRecordsCache:');
  var cache = state.uploadedRecordsCache;
  if (!cache || !cache.students || cache.students.length === 0) {
    console.warn('⚠️ uploadedRecordsCache 为空');
    return;
  }
  
  cache.students.forEach(function(student, idx) {
    console.log('\n👤 [' + idx + '] ' + student.studentName);
    console.log('  newMediaPhotos:', student.newMediaPhotos);
    console.log('  newMediaPhotos 数量:', student.newMediaPhotos ? student.newMediaPhotos.length : 'undefined');
    console.log('  newMediaVideos:', student.newMediaVideos);
    console.log('  newMediaVideos 数量:', student.newMediaVideos ? student.newMediaVideos.length : 'undefined');
    console.log('  files.photos:', student.files && student.files.photos);
    console.log('  files.videos:', student.files && student.files.videos);
    console.log('  photos 计数:', student.photos);
    console.log('  videos 计数:', student.videos);
  });
  
  // 2. 检查原始 API 响应
  console.log('\n📡 检查最后一次 API 响应:');
  console.log('  (打开网络选项卡，查找 /api/learning-records/by-course)');
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 建议:');
  console.log('1. 如果 newMediaPhotos 是 undefined 或空数组:');
  console.log('   → API 数据没有正确传递');
  console.log('2. 如果 newMediaPhotos 有数据但抽屉不显示:');
  console.log('   → 渲染逻辑有问题');
  console.log('='.repeat(60));
})();

