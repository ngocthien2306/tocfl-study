import React, { useState } from 'react';
import type { AIContentType, AIResult } from '../../types';
import { generateSentences, generateReading } from './openai';
import { ResultCard } from './ResultCard';

const STORAGE_KEY = 'tocfl_openai_key';

function loadKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}
function saveKey(k: string) {
  if (k) localStorage.setItem(STORAGE_KEY, k);
  else   localStorage.removeItem(STORAGE_KEY);
}

const TOPICS: Record<string, string[]> = {
  A: ['Gia đình', 'Mua sắm', 'Thời tiết', 'Trường học', 'Du lịch', 'Ăn uống', 'Công việc', 'Giao thông'],
  B: ['Môi trường', 'Công nghệ', 'Giáo dục', 'Sức khỏe', 'Kinh tế', 'Văn hóa', 'Du lịch', 'Xã hội'],
};

export const AIGeneratorModule: React.FC = () => {
  // ── API Key state ───────────────────────────────────────────────────────────
  const [apiKey,    setApiKey]    = useState(loadKey);
  const [keyInput,  setKeyInput]  = useState(loadKey);
  const [keySaved,  setKeySaved]  = useState(!!loadKey());
  const [showKey,   setShowKey]   = useState(false);

  // ── Generator state ─────────────────────────────────────────────────────────
  const [contentType, setContentType] = useState<AIContentType>('sentences');
  const [band,        setBand]        = useState('B');
  const [topic,       setTopic]       = useState('');
  const [count,       setCount]       = useState(5);

  // ── Results ─────────────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [results,  setResults]  = useState<AIResult[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);

  function handleSaveKey() {
    saveKey(keyInput);
    setApiKey(keyInput);
    setKeySaved(!!keyInput);
  }

  async function handleGenerate() {
    if (!apiKey) { setError('Vui lòng nhập API key trước.'); return; }
    setLoading(true);
    setError(null);
    try {
      let result: AIResult;
      if (contentType === 'sentences') {
        result = await generateSentences(apiKey, band, topic, count);
      } else {
        result = await generateReading(apiKey, band, topic);
      }
      setResults(prev => [result, ...prev]);
      setActiveTab(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(idx: number) {
    setResults(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    setActiveTab(t => Math.max(0, t > idx ? t - 1 : t));
  }

  const suggestTopics = TOPICS[band] ?? [];

  return (
    <div>
      {/* ── API Key Section ── */}
      <div className="card card--compact" style={{ marginBottom: 12 }}>
        <div className="flex-between" style={{ marginBottom: keySaved ? 0 : 10 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            🔑 OpenAI API Key
            {keySaved && (
              <span style={{ background: 'var(--success-light)', color: 'var(--success)', fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid #a7f3d0' }}>
                ● Đã lưu
              </span>
            )}
          </h3>
          <button className="btn-ghost" style={{ fontSize: '.8rem', color: 'var(--text-secondary)', border: 'none', background: 'none', cursor: 'pointer' }}
            onClick={() => setKeySaved(v => !v)}>
            {keySaved ? 'Thay đổi' : 'Huỷ'}
          </button>
        </div>

        {!keySaved && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="sk-proj-..."
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', fontSize: '.9rem',
                  fontFamily: 'monospace', outline: 'none',
                }}
                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              />
              <button className="btn btn-outline btn-sm" onClick={() => setShowKey(v => !v)}>
                {showKey ? 'Ẩn' : 'Hiện'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveKey} disabled={!keyInput}>
                Lưu
              </button>
            </div>
            <p className="text-xs text-muted">
              🔒 API key chỉ lưu trong trình duyệt của bạn, không gửi đi đâu ngoài OpenAI.
              Lấy key tại{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                platform.openai.com
              </a>
            </p>
          </>
        )}
      </div>

      {/* ── Generator Form ── */}
      <div className="card card--compact" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: 14 }}>⚙️ Cài đặt nội dung</h3>

        {/* Content type */}
        <div style={{ marginBottom: 14 }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Loại nội dung</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { v: 'sentences', icon: '✏️', label: 'Câu ví dụ từ vựng', desc: 'Tạo câu mẫu kèm từ chìa khoá và ngữ pháp' },
              { v: 'reading',   icon: '📖', label: 'Đoạn đọc hiểu',    desc: 'Tạo bài đọc + câu hỏi + giải thích đáp án' },
            ] as const).map(opt => (
              <button
                key={opt.v}
                onClick={() => setContentType(opt.v)}
                style={{
                  padding: '12px 14px', borderRadius: 'var(--radius)',
                  border: `2px solid ${contentType === opt.v ? 'var(--accent)' : 'var(--border)'}`,
                  background: contentType === opt.v ? 'var(--accent-light)' : 'var(--surface)',
                  textAlign: 'left', cursor: 'pointer', transition: 'all .15s',
                }}
              >
                <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>{opt.icon} {opt.label}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Band */}
        <div className="flex gap-8" style={{ marginBottom: 14, alignItems: 'center' }}>
          <span className="filter-label">Band</span>
          {['A', 'B'].map(b => (
            <button key={b} className={`chip ${band === b ? 'active' : ''}`} onClick={() => { setBand(b); setTopic(''); }}>
              Band {b}
            </button>
          ))}
        </div>

        {/* Topic */}
        <div style={{ marginBottom: contentType === 'sentences' ? 14 : 0 }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Chủ đề <span className="text-muted">(tuỳ chọn)</span></div>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Ví dụ: Du lịch, Môi trường…"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', fontSize: '.9rem', outline: 'none',
              marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {suggestTopics.map(t => (
              <button key={t} className={`chip ${topic === t ? 'active' : ''}`}
                style={{ fontSize: '.75rem', padding: '3px 10px' }}
                onClick={() => setTopic(prev => prev === t ? '' : t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Count (sentences only) */}
        {contentType === 'sentences' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <span className="filter-label">Số câu</span>
            {[3, 5, 8, 10].map(n => (
              <button key={n} className={`chip ${count === n ? 'active' : ''}`} onClick={() => setCount(n)}>
                {n} câu
              </button>
            ))}
          </div>
        )}

        <div className="divider" />

        {/* Generate button */}
        <div className="flex-between">
          <div>
            {error && (
              <div style={{ color: 'var(--error)', fontSize: '.85rem', fontWeight: 600 }}>
                ⚠ {error}
              </div>
            )}
            {!apiKey && !error && (
              <span className="text-sm text-muted">Nhập API key để bắt đầu</span>
            )}
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading || !apiKey}
            style={{ minWidth: 140 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SpinIcon /> Đang tạo…
              </span>
            ) : (
              `🚀 Tạo ${contentType === 'sentences' ? `${count} câu` : 'bài đọc'}`
            )}
          </button>
        </div>
      </div>

      {/* ── Results ── */}
      {results.length > 0 && (
        <div>
          {/* Tab bar for results */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                style={{
                  padding: '5px 12px', borderRadius: 99, fontSize: '.8rem', fontWeight: 600,
                  border: `1px solid ${activeTab === i ? 'var(--accent)' : 'var(--border)'}`,
                  background: activeTab === i ? 'var(--accent-light)' : 'var(--surface)',
                  color: activeTab === i ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {r.type === 'sentences' ? '✏️' : '📖'} {r.topic.slice(0, 16)} — Band {r.band}
              </button>
            ))}
          </div>

          {/* Active result */}
          <div className="card">
            <div className="flex-between mb-12">
              <h2>Kết quả</h2>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--error)' }}
                onClick={() => handleDelete(activeTab)}
              >
                🗑 Xoá
              </button>
            </div>
            <ResultCard result={results[activeTab]} />
          </div>
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="empty-state">
          <p style={{ fontSize: '1.5rem' }}>🤖</p>
          <p>Chưa có nội dung nào.<br />Cài đặt và nhấn <strong>Tạo bài học</strong> để bắt đầu.</p>
        </div>
      )}
    </div>
  );
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
const SpinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="40 20" />
  </svg>
);
