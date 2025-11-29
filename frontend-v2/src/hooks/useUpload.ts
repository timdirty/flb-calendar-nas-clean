/**
 * 上傳相關 React Query Hooks
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadApi, type UploadResponse } from '../services/api/uploadApi';
import { useUploadStore } from '../store/uploadStore';
import type { Course, Student } from '../types';

/**
 * 上傳學生學習記錄
 */
export function useUploadStudentRecord() {
  const queryClient = useQueryClient();
  const { removeCompletedFiles, currentTask } = useUploadStore();

  return useMutation({
    mutationFn: ({
      course,
      student,
      comment,
      files,
      onUploadProgress,
    }: {
      course: Course;
      student: Student;
      comment?: string;
      files: File[];
      onUploadProgress?: (event: { loaded?: number; total?: number }) => void;
    }) => uploadApi.uploadStudentRecord({ course, student, comment, files, onUploadProgress }),
    onSuccess: (result, variables) => {
      console.log('📤 [Upload] 學習記錄上傳成功，更新本地快取');
      
      // 🔥 「一進一出」機制：移除已完成的本地預覽（改用檔案大小匹配）
      if (result?.data?.files && currentTask) {
        const uploadedFiles = [
          ...(result.data.files.photos || []).map((p: any) => ({ 
            name: p.name, 
            size: p.size || 0,
            type: 'photo'
          })),
          ...(result.data.files.videos || []).map((v: any) => ({ 
            name: v.name, 
            size: v.size || 0,
            type: 'video'
          })),
        ];
        
        console.log('🔍 [一進一出] 使用檔案大小匹配:', {
          currentTaskId: currentTask.id,
          uploadedFiles: uploadedFiles.map(f => ({ name: f.name, size: f.size })),
          hasCurrentTask: !!currentTask
        });
        
        if (uploadedFiles.length > 0) {
          removeCompletedFiles(currentTask.id, uploadedFiles);
          console.log('🔄 [一進一出] 移除本地預覽（基於檔案大小）:', uploadedFiles.length);
        }
      }
      
      // 🔥 優化：只保留必要的伺服器失效，其他改為本地更新
      const courseKey = variables.course.id || variables.course.name;
      
      // 1. 更新學習記錄快取（去重合併，避免雙倍顯示）
      const learningRecordsKey = ['student-learning-records', variables.student.id, courseKey];
      const existingRecords = queryClient.getQueryData(learningRecordsKey) as any;
      
      if (existingRecords && result?.data?.files) {
        const newPhotos = result.data.files.photos || [];
        const newVideos = result.data.files.videos || [];
        
        // 🔥 關鍵修復：使用檔案名稱去重，避免本地預覽與快取重複
        const existingPhotoNames = new Set((existingRecords.photos || []).map((p: any) => p.name));
        const existingVideoNames = new Set((existingRecords.videos || []).map((v: any) => v.name));
        
        const uniqueNewPhotos = newPhotos.filter((p: any) => !existingPhotoNames.has(p.name));
        const uniqueNewVideos = newVideos.filter((v: any) => !existingVideoNames.has(v.name));
        
        queryClient.setQueryData(learningRecordsKey, {
          ...existingRecords,
          photos: [...(existingRecords.photos || []), ...uniqueNewPhotos],
          videos: [...(existingRecords.videos || []), ...uniqueNewVideos],
          lastUploadAt: new Date().toISOString()
        });
        console.log(`✅ [Upload] 本地更新學習記錄（去重後）：+${uniqueNewPhotos.length}照片 +${uniqueNewVideos.length}影片`);
      }
      
      // 2. 更新上傳狀態快取（客戶端計算統計）
      const uploadStatusKey = ['upload-status', variables.student.id];
      const existingStatus = queryClient.getQueryData(uploadStatusKey) as any;
      
      if (existingStatus && result?.data?.files) {
        const newPhotoCount = result.data.files.photos?.length || 0;
        const newVideoCount = result.data.files.videos?.length || 0;
        
        queryClient.setQueryData(uploadStatusKey, {
          photos: (existingStatus.photos || 0) + newPhotoCount,
          videos: (existingStatus.videos || 0) + newVideoCount,
          completed: true,
          lastUploadAt: new Date().toISOString()
        });
        console.log(`✅ [Upload] 本地更新上傳狀態：${newPhotoCount}照片 ${newVideoCount}影片`);
      }
      
      // 3. 更新單個學生快取（僅更新最後上傳時間）
      const studentKey = ['student', variables.student.id];
      const existingStudent = queryClient.getQueryData(studentKey) as any;
      
      if (existingStudent) {
        queryClient.setQueryData(studentKey, {
          ...existingStudent,
          uploadStatus: {
            ...existingStudent.uploadStatus,
            completed: true,
            lastUploadAt: new Date().toISOString()
          }
        });
      }
      
      // 4. 🔥 保留：學生列表和課程統計需要後端重新計算
      queryClient.invalidateQueries({ queryKey: ['students'] });
      
      console.log('🎉 [Upload] 快取更新完成，避免不必要的伺服器請求');
    },
    onError: (error) => {
      console.error('❌ [Upload] 學習記錄上傳失敗:', error);
    },
  });
}

/**
 * 上傳課程總覽
 */
export function useUploadOverviewRecord() {
  const queryClient = useQueryClient();

  return useMutation<
    UploadResponse,
    Error,
    { course: Course; summary?: string; files: File[]; onUploadProgress?: (event: any) => void }
  >({
    mutationFn: ({ course, summary, files, onUploadProgress }) =>
      uploadApi.uploadOverviewRecord({ course, summary, files, onUploadProgress }),
    onSuccess: (result, variables) => {
      // 🔥 修復：課程總覽上傳成功後觸發索引重新抓取
      // 因為索引查詢是手動 API 調用，不是 React Query，需要使用重新抓取觸發器
      const event = new CustomEvent('overview-upload-success', { 
        detail: { course: variables.course } 
      });
      window.dispatchEvent(event);
      
      // 智能合併快取
      if (result?.data?.files) {
        const courseKey = `${variables.course.semester}::${variables.course.name}::${variables.course.date}::${variables.course.topic || ''}`;
        const existingData = queryClient.getQueryData(['course-overview', courseKey]) as any;

        if (existingData?.data) {
          // 合併新檔案到現有資料
          const mergedData = {
            ...existingData.data,
            files: {
              photos: [...(existingData.data.files?.photos || []), ...(result.data.files.photos || [])],
              videos: [...(existingData.data.files?.videos || []), ...(result.data.files.videos || [])],
            },
            summary: result.data.summary || existingData.data.summary,
          };

          // 去重處理
          mergedData.files.photos = mergedData.files.photos.filter((photo: any, index: number, self: any[]) =>
            self.findIndex((p: any) => p.name === photo.name) === index
          );
          mergedData.files.videos = mergedData.files.videos.filter((video: any, index: number, self: any[]) =>
            self.findIndex((v: any) => v.name === video.name) === index
          );

          queryClient.setQueryData(['course-overview', courseKey], { data: mergedData });
          
          const uniqueNewPhotos = (result.data.files.photos || []).filter((photo: any) =>
            !(existingData.data.files?.photos || []).some((p: any) => p.name === photo.name)
          );
          const uniqueNewVideos = (result.data.files.videos || []).filter((video: any) =>
            !(existingData.data.files?.videos || []).some((v: any) => v.name === video.name)
          );
          
          console.log(`✅ [Upload] 課程總覽智能合併（去重後）：+${uniqueNewPhotos.length}照片 +${uniqueNewVideos.length}影片`);
        } else {
          // 如果沒有現有資料，觸發重新抓取
          queryClient.invalidateQueries({ queryKey: ['course-overview', courseKey] });
        }
      }
      
      // 只更新課程列表統計，不重新抓取總覽資料
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses', 'today'] });
    },
    onError: (error) => {
      console.error('❌ [Upload] 課程總覽上傳失敗:', error);
    },
  });
}
