import React, { useState, useEffect, useCallback } from 'react';
import type { AIContentType, AIResult, Word, Progress } from '../../types';
import { generateSentences, generateReading } from './openai';
import type { VocabWord } from './openai';
import { ResultCard } from './ResultCard';
import { useLang } from '../../i18n/LangContext';
import { useAuth } from '../../hooks/useAuth';
import { aiContentApi, type AIContentItem } from '../../api/client';
import { useApiKey } from '../../contexts/ApiKeyContext';
import {
  IconDice, IconBook, IconSave, IconBookOpen, IconEdit, IconPin,
  IconTrash, IconFolder, IconSettings, IconRocket, IconRefresh,
  IconHourglass, IconUnlock, IconLock, IconWarning, IconBot,
  IconLoader,
} from '../UI/Icons';

const TOPICS: Record<string, string[]> = {
  A: ['Gia đình', 'Mua sắm', 'Thời tiết', 'Trường học', 'Du lịch', 'Ăn uống', 'Công việc', 'Giao thông'],
  B: ['Môi trường', 'Công nghệ', 'Giáo dục', 'Sức khỏe', 'Kinh tế', 'Văn hóa', 'Du lịch', 'Xã hội'],
};

// ── Vocab picker ───────────────────────────────────────────────────────────────
interface VocabPickerProps {
  vocabulary: Word[];
  band: string;
  selected: Word[];
  onChange: (words: Word[]) => void;
}
const VocabPicker: React.FC<VocabPickerProps> = ({ vocabulary, band, selected, onChange }) => {
  const [search, setSearch] = useState('');
  const filtered = vocabulary
    .filter(w => w.band === band)
    .filter(w =>
      !search ||
      w.hanzi.includes(search) ||
      w.pinyin.toLowerCase().includes(search.toLowerCase()) ||
      w.meaning.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 40);

  const toggle = (w: Word) => {
    const exists = selected.find(s => s.hanzi === w.hanzi);
    if (exists) onChange(selected.filter(s => s.hanzi !== w.hanzi));
    else if (selected.length < 8) onChange([...selected, w]);
  };

  const randomPick = () => {
    const pool = vocabulary.filter(w => w.band === band);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
    onChange(shuffled);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm từ (漢字, pinyin, nghĩa)…"
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', fontSize: '.85rem', outline: 'none',
          }}
        />
        <button className="btn btn-outline btn-sm" onClick={randomPick} title="Chọn ngẫu nhiên 5 từ" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconDice size={14} /> Ngẫu nhiên
        </button>
        {selected.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => onChange([])}>Bỏ chọn</button>
        )}
      </div>

      {/* Selected pills */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {selected.map(w => (
            <span key={w.hanzi} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', background: 'var(--accent)', color: '#fff',
              borderRadius: 99, fontSize: '.8rem', fontWeight: 600,
            }}>
              {w.hanzi}
              <span style={{ cursor: 'pointer', opacity: .8 }} onClick={() => toggle(w)}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* Word grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
        {filtered.map(w => {
          const isSelected = !!selected.find(s => s.hanzi === w.hanzi);
          return (
            <button
              key={w.hanzi}
              onClick={() => toggle(w)}
              disabled={!isSelected && selected.length >= 8}
              style={{
                padding: '4px 10px', borderRadius: 99, fontSize: '.8rem',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                background: isSelected ? 'var(--accent-light)' : 'var(--surface)',
                color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                cursor: 'pointer', fontWeight: isSelected ? 700 : 400,
                opacity: !isSelected && selected.length >= 8 ? 0.4 : 1,
              }}
              title={`${w.pinyin} — ${w.meaning}`}
            >
              {w.hanzi}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
        Chọn tối đa 8 từ · {selected.length}/8 đã chọn · {vocabulary.filter(w => w.band === band).length} từ Band {band}
      </p>
    </div>
  );
};

// ── Saved library panel ────────────────────────────────────────────────────────
interface LibraryProps {
  items: AIContentItem[];
  onLoad: (item: AIContentItem) => void;
  onEdit: (id: number, title: string, note: string) => void;
  onDelete: (id: number) => void;
}
const LibraryPanel: React.FC<LibraryProps> = ({ items, onLoad, onEdit, onDelete }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote,  setEditNote]  = useState('');

  if (items.length === 0) return (
    <div className="empty-state" style={{ padding: 32 }}>
      <IconBook size={36} style={{ opacity: .35, marginBottom: 8 }} />
      <p>Chưa có nội dung nào được lưu.<br/>Tạo và nhấn <strong>Lưu</strong> để lưu vào thư viện.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => (
        <div key={item.id} className="card card--compact" style={{ marginBottom: 0 }}>
          {editingId === item.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--accent)', fontSize: '.9rem', outline: 'none', fontWeight: 600,
                }}
              />
              <textarea
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)…"
                rows={2}
                style={{
                  padding: '6px 10px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', fontSize: '.85rem', resize: 'vertical', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  onEdit(item.id, editTitle, editNote);
                  setEditingId(null);
                }}>Lưu</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Huỷ</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {item.type === 'sentences' ? <IconEdit size={13} /> : <IconBookOpen size={13} />}
                    {item.title}
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
                    Band {item.band} · {item.topic || 'Không có chủ đề'} · {new Date(item.created_at).toLocaleDateString('vi-VN')}
                    {item.vocab_used && item.vocab_used.length > 0 && (
                      <> · <IconPin size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {item.vocab_used.join(', ')}</>
                    )}
                  </div>
                  {item.note && (
                    <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                      {item.note}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => onLoad(item)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconFolder size={13} /> Mở</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setEditingId(item.id);
                    setEditTitle(item.title);
                    setEditNote(item.note ?? '');
                  }}><IconEdit size={13} /></button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--error)' }}
                    onClick={() => onDelete(item.id)}
                  ><IconTrash size={13} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
interface Props { vocabulary: Word[]; progress?: Progress }

export const AIGeneratorModule: React.FC<Props> = ({ vocabulary, progress }) => {
  useLang();
  const { token, isLoggedIn } = useAuth();
  const { apiKey, hasKey } = useApiKey();

  // Generator controls
  const [contentType, setContentType] = useState<AIContentType>('sentences');
  const [band,        setBand       ] = useState('B');
  const [topic,       setTopic      ] = useState('');
  const [count,       setCount      ] = useState(5);
  const [useVocab,    setUseVocab   ] = useState(false);
  const [pickedWords, setPickedWords] = useState<Word[]>([]);

  // Auto-generate mode type
  const [autoType, setAutoType] = useState<AIContentType>('sentences');

  // Results (in-session)
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState<string | null>(null);
  const [results,   setResults  ] = useState<AIResult[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  // Save modal
  const [showSave,   setShowSave  ] = useState(false);
  const [saveTitle,  setSaveTitle ] = useState('');
  const [saveNote,   setSaveNote  ] = useState('');
  const [saving,     setSaving    ] = useState(false);

  // Library (server-saved)
  const [mainTab, setMainTab] = useState<'generate' | 'library'>('generate');
  const [library, setLibrary] = useState<AIContentItem[]>([]);
  const [libLoading, setLibLoading] = useState(false);

  // Load library from server
  const loadLibrary = useCallback(async () => {
    if (!token) return;
    setLibLoading(true);
    try {
      const items = await aiContentApi.list(token);
      setLibrary(items);
    } catch { /* ignore */ }
    finally { setLibLoading(false); }
  }, [token]);

  useEffect(() => {
    if (isLoggedIn && mainTab === 'library') loadLibrary();
  }, [isLoggedIn, mainTab, loadLibrary]);

  async function handleGenerate() {
    if (!apiKey) { setError('Vui lòng thiết lập API key ở góc trên phải màn hình (🔓).'); return; }
    setLoading(true); setError(null);
    try {
      const vocabArg: VocabWord[] = useVocab
        ? pickedWords.map(w => ({ hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning, pos: w.pos }))
        : [];
      let result: AIResult;
      if (contentType === 'sentences') result = await generateSentences(apiKey, band, topic, count, vocabArg);
      else result = await generateReading(apiKey, band, topic, vocabArg);
      setResults(prev => [result, ...prev]);
      setActiveTab(0);
      // Pre-fill save title
      setSaveTitle(`${result.type === 'sentences' ? 'Câu ví dụ' : 'Bài đọc'} — ${result.topic}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Auto-generate from known vocab ────────────────────────────────────────
  const knownWords = vocabulary.filter(w => progress?.known[w.hanzi]);
  const knownA = knownWords.filter(w => w.band === 'A').length;
  const knownB = knownWords.filter(w => w.band === 'B').length;

  async function handleAutoGenerate() {
    if (!apiKey) { setError('Vui lòng thiết lập API Key ở góc trên phải.'); return; }
    if (knownWords.length < 3) { setError('Cần ít nhất 3 từ đã học. Hãy học thêm từ vựng ở tab Từ vựng!'); return; }
    setLoading(true); setError(null);
    // Pick 5-8 random known words, prefer mixing bands
    const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
    const pool = shuffle(knownWords).slice(0, autoType === 'sentences' ? 6 : 8);
    const vocabArg: VocabWord[] = pool.map(w => ({ hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning, pos: w.pos }));
    const autoBand = pool.some(w => w.band === 'B') ? 'B' : 'A';
    try {
      let result: AIResult;
      if (autoType === 'sentences') result = await generateSentences(apiKey, autoBand, '', autoType === 'sentences' ? 5 : 1, vocabArg);
      else result = await generateReading(apiKey, autoBand, '', vocabArg);
      setResults(prev => [result, ...prev]);
      setActiveTab(0);
      setSaveTitle(`${result.type === 'sentences' ? 'Câu ví dụ' : 'Bài đọc'} tự động — ${result.topic}`);
      setMainTab('generate');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!token) { alert('Vui lòng đăng nhập để lưu nội dung.'); return; }
    const result = results[activeTab];
    if (!result || !saveTitle.trim()) return;
    setSaving(true);
    try {
      await aiContentApi.create(token, {
        type:         result.type,
        band:         result.band,
        topic:        result.topic,
        title:        saveTitle.trim(),
        note:         saveNote.trim() || undefined,
        content_json: JSON.stringify(result),
        vocab_used:   useVocab ? pickedWords.map(w => w.hanzi) : undefined,
      });
      setShowSave(false); setSaveNote('');
      // Refresh library
      loadLibrary();
    } catch (e) {
      alert('Lưu thất bại: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleLoadItem(item: AIContentItem) {
    try {
      const parsed = JSON.parse(item.content_json) as AIResult;
      setResults(prev => [parsed, ...prev.filter(r => r !== parsed)]);
      setActiveTab(0);
      setMainTab('generate');
    } catch { alert('Không thể đọc nội dung đã lưu.'); }
  }

  async function handleEditItem(id: number, title: string, note: string) {
    if (!token) return;
    try {
      const updated = await aiContentApi.update(token, id, { title, note });
      setLibrary(prev => prev.map(i => i.id === id ? updated : i));
    } catch { alert('Cập nhật thất bại.'); }
  }

  async function handleDeleteItem(id: number) {
    if (!token || !confirm('Xoá nội dung này?')) return;
    try {
      await aiContentApi.delete(token, id);
      setLibrary(prev => prev.filter(i => i.id !== id));
    } catch { alert('Xoá thất bại.'); }
  }

  const suggestTopics = TOPICS[band] ?? [];

  return (
    <div>
      {/* ── Main tab switcher ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          { id: 'generate', Icon: IconRocket, label: 'Tạo bài học' },
          { id: 'library',  Icon: IconBook,   label: `Thư viện${library.length > 0 ? ` (${library.length})` : ''}` },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id)}
            className={`btn ${mainTab === t.id ? 'btn-primary' : 'btn-outline'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <t.Icon size={15} />{t.label}
          </button>
        ))}
        {!isLoggedIn && (
          <span style={{ alignSelf: 'center', fontSize: '.8rem', color: 'var(--text-muted)', marginLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconLock size={12} /> Đăng nhập để lưu vào thư viện
          </span>
        )}
      </div>

      {/* ══════════ LIBRARY TAB ══════════ */}
      {mainTab === 'library' && (
        <div>
          <div className="flex-between mb-12">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconBook size={17} /> Thư viện bài học đã lưu</h3>
            <button className="btn btn-outline btn-sm" onClick={loadLibrary} disabled={libLoading} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {libLoading ? <IconHourglass size={13} /> : <IconRefresh size={13} />} Tải lại
            </button>
          </div>
          {!isLoggedIn
            ? <div className="card empty-state"><p>Đăng nhập để xem thư viện của bạn.</p></div>
            : libLoading
            ? <div className="card empty-state"><p>Đang tải…</p></div>
            : <LibraryPanel
                items={library}
                onLoad={handleLoadItem}
                onEdit={handleEditItem}
                onDelete={handleDeleteItem}
              />
          }
        </div>
      )}

      {/* ══════════ GENERATE TAB ══════════ */}
      {mainTab === 'generate' && (
        <div>
          {/* ══ AUTO GENERATE from known vocab ══ */}
          <div className="auto-gen-panel">
            <div className="auto-gen-title">
              <IconDice size={17} /> Tự động từ từ vựng đã học
            </div>
            <div className="auto-gen-sub">
              AI tự chọn ngẫu nhiên từ từ vựng bạn đã đánh dấu "Đã biết" — không cần chọn tay
            </div>

            {/* Stats */}
            <div className="auto-gen-stats">
              <div className="auto-gen-stat">
                <span className="auto-gen-stat-num">{knownWords.length}</span>
                <span className="auto-gen-stat-label">Đã học</span>
              </div>
              <div className="auto-gen-stat">
                <span className="auto-gen-stat-num">{knownA}</span>
                <span className="auto-gen-stat-label">Band A</span>
              </div>
              <div className="auto-gen-stat">
                <span className="auto-gen-stat-num">{knownB}</span>
                <span className="auto-gen-stat-label">Band B</span>
              </div>
            </div>

            {/* Mode + Go */}
            <div className="auto-gen-row">
              <button
                className={`auto-gen-type-btn${autoType === 'sentences' ? ' active' : ''}`}
                onClick={() => setAutoType('sentences')}
              >
                <IconEdit size={13} /> Câu ví dụ
              </button>
              <button
                className={`auto-gen-type-btn${autoType === 'reading' ? ' active' : ''}`}
                onClick={() => setAutoType('reading')}
              >
                <IconBookOpen size={13} /> Đoạn đọc
              </button>
              <button
                className="auto-gen-go"
                onClick={handleAutoGenerate}
                disabled={loading || !hasKey || knownWords.length < 3}
              >
                {loading
                  ? <><IconLoader size={14} /> Đang tạo…</>
                  : <><IconDice size={14} /> Tạo ngẫu nhiên</>
                }
              </button>
            </div>

            {knownWords.length < 3 && (
              <p style={{ marginTop: 10, fontSize: '.78rem', color: 'var(--text-muted)' }}>
                Học ít nhất 3 từ ở tab <strong>Từ vựng</strong> để dùng tính năng này.
              </p>
            )}
          </div>

          {/* ── No key warning ── */}
          {!hasKey && (
            <div className="card card--compact" style={{ marginBottom: 12, background: 'var(--warning-light, #fffbeb)', border: '1px solid #fde68a' }}>
              <p style={{ margin: 0, fontSize: '.88rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconUnlock size={14} /> Chưa có API key. Nhấn nút <strong>API Key</strong> ở góc trên phải để thiết lập.
              </p>
            </div>
          )}

          {/* ── Generator form ── */}
          <div className="card card--compact" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><IconSettings size={16} /> Cài đặt nội dung</h3>

            {/* Content type */}
            <div style={{ marginBottom: 14 }}>
              <div className="filter-label" style={{ marginBottom: 6 }}>Loại nội dung</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([
                  { v: 'sentences', Icon: IconEdit,     label: 'Câu ví dụ từ vựng', desc: 'Câu mẫu kèm từ khoá & ngữ pháp' },
                  { v: 'reading',   Icon: IconBookOpen, label: 'Đoạn đọc hiểu',    desc: 'Bài đọc + câu hỏi + giải thích' },
                ] as const).map(opt => (
                  <button key={opt.v} onClick={() => setContentType(opt.v)} style={{
                    padding: '12px 14px', borderRadius: 'var(--radius)', textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${contentType === opt.v ? 'var(--accent)' : 'var(--border)'}`,
                    background: contentType === opt.v ? 'var(--accent-light)' : 'var(--surface)', transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: '1rem', marginBottom: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><opt.Icon size={15} /> {opt.label}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Band */}
            <div className="flex gap-8" style={{ marginBottom: 14, alignItems: 'center' }}>
              <span className="filter-label">Band</span>
              {['A', 'B'].map(b => (
                <button key={b} className={`chip ${band === b ? 'active' : ''}`}
                  onClick={() => { setBand(b); setTopic(''); setPickedWords([]); }}>
                  Band {b}
                </button>
              ))}
            </div>

            {/* Topic */}
            <div style={{ marginBottom: 14 }}>
              <div className="filter-label" style={{ marginBottom: 6 }}>Chủ đề <span className="text-muted">(tuỳ chọn)</span></div>
              <input
                type="text" value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="Ví dụ: Du lịch, Môi trường…"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', fontSize: '.9rem', outline: 'none', marginBottom: 8,
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

            {/* Count */}
            {contentType === 'sentences' && (
              <div className="flex gap-8" style={{ alignItems: 'center', marginBottom: 14 }}>
                <span className="filter-label">Số câu</span>
                {[3, 5, 8, 10].map(n => (
                  <button key={n} className={`chip ${count === n ? 'active' : ''}`} onClick={() => setCount(n)}>{n} câu</button>
                ))}
              </div>
            )}

            {/* Vocab picker toggle */}
            <div style={{
              border: `1px solid ${useVocab ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 12,
            }}>
              <button
                onClick={() => setUseVocab(v => !v)}
                style={{
                  width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', background: useVocab ? 'var(--accent-light)' : 'var(--surface)',
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '.9rem',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconPin size={14} /> Dùng từ vựng TOCFL {useVocab ? '(đang bật)' : ''}</span>
                <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {useVocab ? `${pickedWords.length} từ đã chọn` : 'AI tự chọn từ'}
                </span>
              </button>

              {useVocab && (
                <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <VocabPicker
                    vocabulary={vocabulary}
                    band={band}
                    selected={pickedWords}
                    onChange={setPickedWords}
                  />
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Generate button */}
            <div className="flex-between">
              <div>
                {error && <div style={{ color: 'var(--error)', fontSize: '.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><IconWarning size={14} /> {error}</div>}
                {!apiKey && !error && <span className="text-sm text-muted">Nhập API key để bắt đầu</span>}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={loading || !apiKey}
                style={{ minWidth: 150 }}
              >
                {loading
                  ? <><IconLoader size={15} /> Đang tạo…</>
                  : <><IconRocket size={15} style={{ marginRight: 5 }} />Tạo {contentType === 'sentences' ? `${count} câu` : 'bài đọc'}</>
                }
              </button>
            </div>
          </div>

          {/* ── Results ── */}
          {results.length > 0 && (
            <div>
              {/* Result tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {results.map((r, i) => (
                  <button key={i} onClick={() => setActiveTab(i)} style={{
                    padding: '5px 12px', borderRadius: 99, fontSize: '.8rem', fontWeight: 600,
                    border: `1px solid ${activeTab === i ? 'var(--accent)' : 'var(--border)'}`,
                    background: activeTab === i ? 'var(--accent-light)' : 'var(--surface)',
                    color: activeTab === i ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}>
                    {r.type === 'sentences' ? <IconEdit size={11} /> : <IconBookOpen size={11} />} {r.topic.slice(0, 16)} — Band {r.band}
                  </button>
                ))}
              </div>

              {/* Active result card */}
              <div className="card">
                <div className="flex-between mb-12">
                  <h2>Kết quả</h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* Save button */}
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => {
                        setSaveTitle(`${results[activeTab].type === 'sentences' ? 'Câu ví dụ' : 'Bài đọc'} — ${results[activeTab].topic}`);
                        setShowSave(true);
                      }}
                      title={isLoggedIn ? 'Lưu vào thư viện' : 'Đăng nhập để lưu'}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <IconSave size={13} /> Lưu
                    </button>
                    <button
                      className="btn btn-ghost btn-sm" style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => setResults(prev => {
                        const next = prev.filter((_, i) => i !== activeTab);
                        setActiveTab(t => Math.max(0, t > activeTab ? t - 1 : t));
                        return next;
                      })}
                    >
                      <IconTrash size={13} /> Xoá
                    </button>
                  </div>
                </div>
                <ResultCard result={results[activeTab]} />
              </div>
            </div>
          )}

          {results.length === 0 && !loading && (
            <div className="empty-state">
              <IconBot size={40} style={{ opacity: .3, marginBottom: 8 }} />
              <p>Chưa có nội dung nào.<br/>Cài đặt và nhấn <strong>Tạo bài học</strong> để bắt đầu.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Save modal ── */}
      {showSave && (
        <>
          <div onClick={() => setShowSave(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 900, backdropFilter: 'blur(2px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 901, background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)', width: 'min(440px,92vw)', padding: '28px 24px',
          }}>
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}><IconSave size={16} /> Lưu vào thư viện</h3>
            {!isLoggedIn ? (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Bạn cần đăng nhập để lưu nội dung vào thư viện.
                </p>
                <button className="btn btn-outline btn-sm" onClick={() => setShowSave(false)}>Đóng</button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Tiêu đề</label>
                  <input
                    value={saveTitle} onChange={e => setSaveTitle(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
                    }}
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Ghi chú <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(tuỳ chọn)</span></label>
                  <textarea
                    value={saveNote} onChange={e => setSaveNote(e.target.value)}
                    placeholder="Ví dụ: Ôn lại từ chỉ phương tiện giao thông..."
                    rows={3}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)', fontSize: '.85rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving || !saveTitle.trim()} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {saving ? <><IconHourglass size={13} /> Đang lưu…</> : <><IconSave size={13} /> Lưu vào thư viện</>}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowSave(false)}>Huỷ</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

