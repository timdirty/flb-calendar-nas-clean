/**
 * 學生評語編輯元件
 */
import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import type { CommentHistoryEntry } from '../../types';

interface CommentEditorProps {
  studentId: string;
  studentName: string;
  initialComment?: string;
  onSave: (comment: string) => void;
  onCancel?: () => void;
  loading?: boolean;
  success?: boolean;
  error?: boolean;
  commentHistory?: CommentHistoryEntry[];
}

const COMMENT_DRAFT_PREFIX = 'flb_comment_draft:';

function loadCommentDraft(studentId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = COMMENT_DRAFT_PREFIX + studentId;
    const value = window.localStorage.getItem(key);
    return value ?? null;
  } catch {
    return null;
  }
}

function saveCommentDraft(studentId: string, value: string, baseComment: string) {
  if (typeof window === 'undefined') return;
  const key = COMMENT_DRAFT_PREFIX + studentId;
  try {
    if (!value || value === baseComment) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {}
}

function clearCommentDraft(studentId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(COMMENT_DRAFT_PREFIX + studentId);
  } catch {}
}

export function CommentEditor({
  studentId,
  studentName,
  initialComment = '',
  onSave,
  onCancel,
  loading = false,
  success = false,
  error = false,
  commentHistory = [],
}: CommentEditorProps) {
  const [comment, setComment] = useState(initialComment);
  const [isDirty, setIsDirty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevStudentRef = useRef<string | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const historyInitializedRef = useRef(false);

  // 🧽 根據選取的學生重置輸入框，優先載入草稿
  useEffect(() => {
    if (prevStudentRef.current !== studentId) {
      prevStudentRef.current = studentId;
      const draft = loadCommentDraft(studentId);
      if (draft !== null && draft !== initialComment) {
        setComment(draft);
        setIsDirty(true);
      } else {
        setComment(initialComment);
        setIsDirty(false);
      }
    }
  }, [studentId, initialComment]);

  // 🔄 當外部評語更新時（例如重新載入資料），若使用者尚未修改且沒有草稿則同步
  useEffect(() => {
    if (!isDirty) {
      const draft = loadCommentDraft(studentId);
      if (draft === null) {
        setComment(initialComment);
      }
    }
  }, [initialComment, isDirty, studentId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setComment(next);
    setIsDirty(next !== initialComment);
    if (showSuccessMessage) {
      setShowSuccessMessage(false);
    }
  };

  const charCount = comment.length;
  const minRecommendedChars = 5;
  const maxChars = 80;
  const isTooShort = charCount > 0 && charCount < minRecommendedChars;
  const isTooLong = charCount > maxChars;
  const isValid = !isTooLong;
  const showSuccessHighlight = !isDirty && showSuccessMessage && !loading && isValid;

  const handleSave = () => {
    if (isDirty && isValid && comment.trim().length > 0) {
      onSave(comment);
      setIsDirty(false);
      setShowSuccessMessage(true);
      const timer = window.setTimeout(() => {
        setShowSuccessMessage(false);
      }, 2000);
      successTimerRef.current = timer;
      clearCommentDraft(studentId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!loading && !isTooLong && comment.trim().length > 0) {
        handleSave();
      }
    }
  };

  const handleCancel = () => {
    setComment(initialComment);
    setIsDirty(false);
    onCancel?.();
  };

  useEffect(() => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }
  }, [success]);

  useEffect(() => {
    if (!historyInitializedRef.current && commentHistory.length === 1) {
      setShowHistory(true);
      historyInitializedRef.current = true;
    }
  }, [commentHistory]);

  useEffect(() => {
    saveCommentDraft(studentId, comment, initialComment);
  }, [comment, studentId, initialComment]);

  // 手機裝置自動聚焦並捲動到可見區，避免鍵盤遮住輸入框
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const timer = window.setTimeout(() => {
      try {
        textarea.focus({ preventScroll: true } as any);
      } catch {
        textarea.focus();
      }

      try {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }, 300);

    return () => window.clearTimeout(timer);
  }, [studentId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`comment-${studentId}`}
          className="text-sm font-medium text-gray-700"
        >
          💬 {studentName} 的學習評語
        </label>
        <span
          className={`text-xs ${
            isTooLong
              ? 'text-red-500'
              : isTooShort
              ? 'text-yellow-600'
              : 'text-gray-500'
          }`}
        >
          {charCount} / {maxChars} 字
          {isTooShort && (
            <span className="ml-1">(建議至少 {minRecommendedChars} 字)</span>
          )}
          {isTooLong && (
            <span className="ml-1">(已超過上限 {maxChars} 字)</span>
          )}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse skeleton-animate">
          <div className="h-3 bg-blue-100 rounded w-24" />
          <div className="h-4 bg-blue-50 rounded w-full" />
          <div className="h-4 bg-blue-50 rounded w-5/6" />
        </div>
      ) : (
        <textarea
          id={`comment-${studentId}`}
          ref={textareaRef}
          value={comment}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="請輸入學習評語（至少5字）&#10;例如：今天表現很棒！積極參與課堂活動..."
          className={`w-full min-h-[72px] max-h-40 px-3 py-2 text-base md:text-base border rounded-lg resize-none focus:outline-none focus:ring-2 fade-in-soft ${
            !isValid && charCount > 0
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
              : showSuccessHighlight
              ? 'border-green-400 focus:ring-green-500 focus:border-green-500 animate-pulse'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
          }`}
        />
      )}

      {isDirty && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={loading || isTooLong || comment.trim().length === 0}
            loading={loading}
          >
            儲存評語
          </Button>
        </div>
      )}

      {!isDirty && showSuccessMessage && (
        <p className="text-xs text-green-600 text-right">
          評語已儲存
        </p>
      )}

      {!isDirty && error && (
        <p className="text-xs text-red-500 text-right">
          評語儲存失敗，請稍後再試
        </p>
      )}

      {isTooLong && (
        <p className="text-xs text-red-500">
          超過建議長度 {charCount - maxChars} 字，請試著精簡一點。
        </p>
      )}

      {Array.isArray(commentHistory) && commentHistory.length > 0 && (
        <div className="pt-2 border-t border-gray-100 mt-1">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-800"
          >
            <span>查看歷史評語（{commentHistory.length} 筆）</span>
            <span className="ml-2 text-gray-400">{showHistory ? '收合 ▲' : '展開 ▼'}</span>
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {commentHistory
                .slice()
                .reverse()
                .map((entry, index) => {
                  const timeLabel = entry.updatedAt
                    ? new Date(entry.updatedAt).toLocaleTimeString('zh-TW', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                  return (
                    <div
                      key={`${entry.updatedAt || 'no-time'}-${index}`}
                      className="px-2 py-1.5 rounded bg-gray-50 text-[11px] text-gray-700 border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-gray-400">過去評語</span>
                        {timeLabel && (
                          <span className="text-[10px] text-gray-400">{timeLabel}</span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-snug">{entry.text}</p>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
