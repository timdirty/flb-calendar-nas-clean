/**
 * API 客戶端配置
 */
import axios from 'axios';

// 創建 axios 實例
const LOCAL_FALLBACK_BASE_URL = 'http://localhost:3000/api';

let resolvedBaseURL = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!resolvedBaseURL) {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      resolvedBaseURL = LOCAL_FALLBACK_BASE_URL;
    } else {
      resolvedBaseURL = `${origin}/api`;
    }
  } else {
    resolvedBaseURL = LOCAL_FALLBACK_BASE_URL;
  }
}

export const apiClient = axios.create({
  baseURL: resolvedBaseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🔍 Debug: 確認 baseURL
console.log('🔧 [API Client] baseURL:', resolvedBaseURL);

// 請求攔截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在這裡添加認證 token
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    
    console.log(`📤 [API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ [API] Request error:', error);
    return Promise.reject(error);
  }
);

// 響應攔截器
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ [API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`❌ [API] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.response?.data || error.message);

    // Request 超時（包含上傳逾時）
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('__REQUEST_TIMEOUT__'));
    }

    // 統一錯誤處理
    if (error.response) {
      // 伺服器回應錯誤
      const message = error.response.data?.message || error.response.statusText;
      return Promise.reject(new Error(message));
    } else if (error.request) {
      // 請求發送但沒有收到回應
      return Promise.reject(new Error('網路錯誤，請檢查您的連線'));
    } else {
      // 其他錯誤
      return Promise.reject(error);
    }
  }
);
