/**
 * 分片上傳工作管理
 * - 記錄每個 uploadId 的進度與暫存路徑
 * - 提供清除過期會話的能力
 */

const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { v4: uuidv4 } = require('uuid');

const DEFAULT_EXPIRE_MS = 60 * 60 * 1000; // 1 小時
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 分鐘

class MediaSessionRegistry {
    constructor(tempRoot) {
        this.sessions = new Map();
        this.tempRoot = tempRoot;
        this.cleanupTimer = null;
    }

    startCleanup() {
        if (this.cleanupTimer) return;
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpired();
        }, CLEANUP_INTERVAL_MS);
        this.cleanupTimer.unref?.();
    }

    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    async createSession(payload) {
        const uploadId = uuidv4();
        const chunkSize = Number(payload.chunkSize || 0);
        const fileSize = Number(payload.fileSize || 0);
        const totalChunks = chunkSize > 0 ? Math.ceil(fileSize / chunkSize) : 0;

        const session = {
            uploadId,
            filename: payload.filename || `upload-${uploadId}`,
            fileSize,
            fileType: payload.fileType || 'application/octet-stream',
            chunkSize,
            totalChunks,
            receivedChunks: new Set(),
            createdAt: Date.now(),
            expiresAt: Date.now() + (payload.expireMs || DEFAULT_EXPIRE_MS),
            metadata: payload.metadata || {},
            tempDir: path.join(this.tempRoot, uploadId)
        };

        await fsPromises.mkdir(session.tempDir, { recursive: true });
        this.sessions.set(uploadId, session);
        return session;
    }

    getSession(uploadId) {
        if (!uploadId) return null;
        return this.sessions.get(uploadId) || null;
    }

    async removeSession(uploadId, options = {}) {
        const session = this.sessions.get(uploadId);
        if (!session) return;
        this.sessions.delete(uploadId);
        if (!options.skipFilesystemCleanup) {
            try {
                await fsPromises.rm(session.tempDir, { recursive: true, force: true });
            } catch (err) {
                console.warn('⚠️ 清理分片暫存失敗:', err.message);
            }
        }
    }

    async cleanupExpired() {
        const now = Date.now();
        const expiredIds = [];
        for (const session of this.sessions.values()) {
            if (now > session.expiresAt) {
                expiredIds.push(session.uploadId);
            }
        }
        for (const uploadId of expiredIds) {
            await this.removeSession(uploadId);
        }
        if (expiredIds.length > 0) {
            console.log('🧹 已清理過期上傳會話:', expiredIds.length);
        }
    }
}

module.exports = MediaSessionRegistry;
