/**
 * 上傳狀態管理
 */
import { create } from 'zustand';
import type { MediaFile, UploadTask } from '../types';

interface UploadState {
  // 狀態
  tasks: UploadTask[];
  currentTask: UploadTask | null;
  globalProgress: number;
  isUploading: boolean;

  // Actions
  createTask: (courseId: string, studentId: string, files: File[]) => string;
  updateFileProgress: (taskId: string, fileId: string, progress: number) => void;
  updateFileStatus: (taskId: string, fileId: string, status: MediaFile['status'], error?: string) => void;
  completeFile: (taskId: string, fileId: string, uploadedUrl: string) => void;
  removeFile: (taskId: string, fileId: string) => void;
  clearTask: (taskId: string) => void;
  clearAllTasks: () => void;
  setCurrentTask: (task: UploadTask | null) => void;
  
  // 🔥 重試功能
  retryFile: (taskId: string, fileId: string) => void;
  getFileForRetry: (taskId: string, fileId: string) => MediaFile | undefined;
  
  // 輔助方法
  getTaskById: (id: string) => UploadTask | undefined;
  getTasksByStudent: (studentId: string) => UploadTask[];
  getGlobalProgress: () => number;
  
  // 🔥 「一進一出」機制：移除已完成的本地預覽
  removeCompletedFiles: (taskId: string, uploadedFiles: { name: string; size: number; type: string }[]) => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  // 初始狀態
  tasks: [],
  currentTask: null,
  globalProgress: 0,
  isUploading: false,

  // Actions
  createTask: (courseId, studentId, files) => {
    const state = get();
    
    // 🔥 [修復 2025-11-27] 檢查是否已有相同 course+student 的未完成 task
    const existingTask = state.tasks.find(
      (t) => t.courseId === courseId && t.studentId === studentId && t.status !== 'completed'
    );

    if (existingTask) {
      // 追加檔案到現有 task
      const timestamp = Date.now();
      const newMediaFiles: MediaFile[] = files.map((file, index) => ({
        id: `file-${existingTask.id}-${timestamp}-${index}`,
        file,
        type: file.type.startsWith('image/') ? 'photo' : 'video',
        status: 'pending',
        progress: 0,
        preview: URL.createObjectURL(file),
        metadata: {
          size: file.size,
        },
      }));

      set((state) => {
        const tasks = state.tasks.map((task) => {
          if (task.id === existingTask.id) {
            return {
              ...task,
              files: [...task.files, ...newMediaFiles],
            };
          }
          return task;
        });

        const updatedTask = tasks.find((t) => t.id === existingTask.id)!;

        return {
          tasks,
          currentTask: updatedTask,
          isUploading: false,
        };
      });

      return existingTask.id;
    }

    // 建立新 task
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const mediaFiles: MediaFile[] = files.map((file, index) => ({
      id: `file-${taskId}-${index}`,
      file,
      type: file.type.startsWith('image/') ? 'photo' : 'video',
      status: 'pending',
      progress: 0,
      preview: URL.createObjectURL(file),
      metadata: {
        size: file.size,
      },
    }));

    const task: UploadTask = {
      id: taskId,
      studentId,
      courseId,
      files: mediaFiles,
      totalProgress: 0,
      status: 'idle',
    };

    set((state) => ({
      tasks: [...state.tasks, task],
      currentTask: task,
      isUploading: false,
    }));

    return taskId;
  },

  updateFileProgress: (taskId, fileId, progress) => {
    set((state) => {
      const tasks = state.tasks.map((task) => {
        if (task.id !== taskId) return task;

        const files = task.files.map((file) =>
          file.id === fileId ? { ...file, progress, status: 'uploading' as const } : file
        );

        const totalProgress =
          files.reduce((sum, file) => sum + file.progress, 0) / files.length;

        return { ...task, files, totalProgress, status: 'uploading' as const };
      });

      const currentTask = state.currentTask
        ? tasks.find((t) => t.id === state.currentTask!.id) || state.currentTask
        : null;

      return { tasks, isUploading: true, currentTask };
    });
  },

  updateFileStatus: (taskId, fileId, status, error) => {
    set((state) => {
      const tasks = state.tasks.map((task) => {
        if (task.id !== taskId) return task;

        const files = task.files.map((file) =>
          file.id === fileId ? { ...file, status, error } : file
        );

        // 檢查所有文件是否完成
        const allCompleted = files.every((f) => f.status === 'completed');
        const anyError = files.some((f) => f.status === 'error');

        return {
          ...task,
          files,
          status: anyError ? ('error' as const) : allCompleted ? ('completed' as const) : task.status,
          endTime: allCompleted || anyError ? Date.now() : task.endTime,
        };
      });

      const isUploading = tasks.some((t) => t.status === 'uploading');
      const currentTask = state.currentTask
        ? tasks.find((t) => t.id === state.currentTask!.id) || state.currentTask
        : null;

      return { tasks, isUploading, currentTask };
    });
  },

  completeFile: (taskId, fileId, uploadedUrl) => {
    set((state) => {
      const tasks = state.tasks.map((task) => {
        if (task.id !== taskId) return task;

        const files = task.files.map((file) =>
          file.id === fileId
            ? { ...file, status: 'completed' as const, progress: 100, uploadedUrl }
            : file
        );

        const totalProgress =
          files.reduce((sum, file) => sum + file.progress, 0) / files.length;

        const allCompleted = files.every((f) => f.status === 'completed');

        return {
          ...task,
          files,
          totalProgress,
          status: allCompleted ? ('completed' as const) : task.status,
          endTime: allCompleted ? Date.now() : task.endTime,
        };
      });

      const isUploading = tasks.some((t) => t.status === 'uploading');
      const currentTask = state.currentTask
        ? tasks.find((t) => t.id === state.currentTask!.id) || state.currentTask
        : null;

      return { tasks, isUploading, currentTask };
    });
  },

  removeFile: (taskId, fileId) => {
    set((state) => {
      const tasks = state.tasks.map((task) => {
        if (task.id !== taskId) return task;

        // 釋放 Blob URL
        const fileToRemove = task.files.find((f) => f.id === fileId);
        if (fileToRemove?.preview) {
          URL.revokeObjectURL(fileToRemove.preview);
        }

        const files = task.files.filter((f) => f.id !== fileId);

        if (files.length === 0) {
          return null; // 標記為待刪除
        }

        const totalProgress =
          files.reduce((sum, file) => sum + file.progress, 0) / files.length;

        return { ...task, files, totalProgress };
      }).filter((task): task is UploadTask => task !== null);

      const currentTask = state.currentTask
        ? tasks.find((t) => t.id === state.currentTask!.id) || null
        : null;

      return { tasks, currentTask };
    });
  },

  clearTask: (taskId) => {
    set((state) => {
      // 釋放所有 Blob URLs
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        task.files.forEach((file) => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview);
          }
        });
      }

      const tasks = state.tasks.filter((t) => t.id !== taskId);
      return {
        tasks,
        currentTask: state.currentTask?.id === taskId ? null : state.currentTask,
      };
    });
  },

  clearAllTasks: () => {
    // 釋放所有 Blob URLs
    get().tasks.forEach((task) => {
      task.files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    });

    set({ tasks: [], currentTask: null, isUploading: false, globalProgress: 0 });
  },

  setCurrentTask: (task) => set({ currentTask: task }),

  // 🔥 重試功能
  retryFile: (taskId, fileId) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const fileToRetry = task.files.find((f) => f.id === fileId);
    if (!fileToRetry || fileToRetry.status !== 'error') return;

    // 重置檔案狀態
    const updatedFiles = task.files.map((file) =>
      file.id === fileId
        ? { ...file, status: 'pending' as const, progress: 0, error: undefined }
        : file
    );

    // 更新任務
    set({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, files: updatedFiles } : t
      ),
    });

    console.log(`🔄 [UploadStore] 準備重試檔案: ${fileToRetry.file.name}`);
  },

  getFileForRetry: (taskId, fileId) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return undefined;

    return task.files.find((f) => f.id === fileId);
  },

  // 輔助方法
  getTaskById: (id) => {
    return get().tasks.find((task) => task.id === id);
  },

  getTasksByStudent: (studentId) => {
    return get().tasks.filter((task) => task.studentId === studentId);
  },

  getGlobalProgress: () => {
    const { tasks } = get();
    if (tasks.length === 0) return 0;

    const totalProgress = tasks.reduce((sum, task) => sum + task.totalProgress, 0);
    return totalProgress / tasks.length;
  },

  // 🔥 「一進一出」機制：移除已完成的本地預覽（基於檔案大小匹配）
  removeCompletedFiles: (taskId, uploadedFiles) => {
    console.log('🔍 [removeCompletedFiles] 收到請求:', {
      taskId,
      uploadedFiles: uploadedFiles.map(f => ({ name: f.name, size: f.size })),
      allTasks: get().tasks.map(t => ({ id: t.id, fileCount: t.files.length }))
    });
    
    set((state) => {
      const tasks = state.tasks.map((task) => {
        if (task.id !== taskId) return task;
        
        console.log('🔍 [removeCompletedFiles] 找到匹配任務:', {
          taskFiles: task.files.map(f => ({ name: f.file.name, size: f.file.size }))
        });

        // 過濾掉已上傳完成的檔案（基於檔案大小匹配）
        const files = task.files.filter((file) => {
          const isUploaded = uploadedFiles.some(uploaded => 
            uploaded.size === file.file.size && 
            uploaded.type === file.type
          );
          
          console.log('🔍 [removeCompletedFiles] 檢查檔案:', {
            fileName: file.file.name,
            fileSize: file.file.size,
            fileType: file.type,
            isUploaded,
            uploadedList: uploadedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
          });
          
          if (isUploaded) {
            // 釋放 Blob URL
            if (file.preview) {
              URL.revokeObjectURL(file.preview);
              console.log('🗑️ [一進一出] 移除本地預覽:', file.file.name);
            }
            return false; // 移除這個檔案
          }
          return true; // 保留這個檔案
        });

        // 如果沒有檔案了，標記為待刪除
        if (files.length === 0) {
          return null;
        }

        const totalProgress = files.length > 0 
          ? files.reduce((sum, file) => sum + file.progress, 0) / files.length
          : 0;

        return { ...task, files, totalProgress };
      }).filter((task): task is UploadTask => task !== null);

      const currentTask = state.currentTask
        ? tasks.find((t) => t.id === state.currentTask!.id) || null
        : null;

      return { tasks, currentTask };
    });
  },
}));
