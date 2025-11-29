FROM node:20-alpine

WORKDIR /app

# 複製 package 檔案
COPY package*.json ./

# 安裝系統依賴：curl、sudo、FFmpeg（影片轉碼）、Sharp 依賴（圖片處理）、HEIC 支援
RUN apk add --no-cache \
    curl \
    sudo \
    ffmpeg \
    vips-dev \
    vips-tools \
    libheif \
    libheif-dev \
    libde265 \
    libde265-dev \
    python3 \
    make \
    g++ \
    && npm config set registry https://registry.npmmirror.com && \
    echo "📦 Installing production deps (ci with fallback)..." && \
    (npm ci --only=production || (echo "⚠️ npm ci failed, falling back to npm install --production" && npm install --production)) && \
    npm rebuild sharp --verbose

# 複製應用程式檔案
COPY . .

RUN cd frontend-v2 \
    && npm ci \
    && npm run build \
    && rm -rf node_modules

# 創建用戶和設定權限
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs && \
    mkdir -p /app/data /app/public /app/logs && \
    touch /app/data/reminders.json /app/data/holidays-cache.json /app/data/student-responses.json /app/data/daily-attendance-reports.json && \
    chown -R nextjs:nodejs /app && \
    chmod -R 777 /app/data && \
    chmod -R 755 /app/public /app/logs && \
    chmod 666 /app/*.json 2>/dev/null || true && \
    chmod 644 /app/service-account.json 2>/dev/null || true

# 創建 entrypoint 腳本
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'echo "🔧 修復檔案權限..."' >> /entrypoint.sh && \
    echo '# 確保目錄存在' >> /entrypoint.sh && \
    echo 'mkdir -p /app/data /app/public /app/logs 2>/dev/null || true' >> /entrypoint.sh && \
    echo '# 確保關鍵檔案存在' >> /entrypoint.sh && \
    echo 'touch /app/data/reminders.json /app/data/holidays-cache.json /app/data/student-responses.json /app/data/daily-attendance-reports.json 2>/dev/null || true' >> /entrypoint.sh && \
    echo '# 設定目錄權限（777 確保任何用戶都可寫入）' >> /entrypoint.sh && \
    echo 'chmod -R 777 /app/data 2>/dev/null || true' >> /entrypoint.sh && \
    echo 'chmod -R 755 /app/public 2>/dev/null || true' >> /entrypoint.sh && \
    echo 'chmod -R 755 /app/logs 2>/dev/null || true' >> /entrypoint.sh && \
    echo '# 設定檔案權限（所有 JSON 檔案）' >> /entrypoint.sh && \
    echo 'chmod 666 /app/data/*.json 2>/dev/null || true' >> /entrypoint.sh && \
    echo 'chmod 666 /app/*.json 2>/dev/null || true' >> /entrypoint.sh && \
    echo 'chmod 644 /app/service-account.json 2>/dev/null || true' >> /entrypoint.sh && \
    echo '# 變更擁有者' >> /entrypoint.sh && \
    echo 'chown -R nextjs:nodejs /app/data /app/public /app/logs 2>/dev/null || true' >> /entrypoint.sh && \
    echo 'echo "✅ 權限修復完成"' >> /entrypoint.sh && \
    echo 'echo "📂 檢查關鍵檔案..."' >> /entrypoint.sh && \
    echo 'ls -lah /app/data/*.json 2>/dev/null || echo "⚠️ 部分檔案不存在"' >> /entrypoint.sh && \
    echo 'echo "🚀 以 nextjs 用戶啟動應用..."' >> /entrypoint.sh && \
    echo 'exec su-exec nextjs node server.js' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# 安裝 su-exec（輕量級的 sudo 替代品）
RUN apk add --no-cache su-exec

EXPOSE 3000

# 以 root 身份啟動 entrypoint，內部會切換到 nextjs 用戶
CMD ["/entrypoint.sh"]
