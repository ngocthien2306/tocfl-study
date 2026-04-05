/**
 * VocabAdminTool — In-app tool to fill missing Vietnamese translations
 * using the OpenAI API key already configured in the app.
 *
 * Flow:
 *  1. Shows stats: how many words are missing translations per level
 *  2. User picks which level(s) to translate
 *  3. Calls OpenAI in batches of 20 words (streaming progress)
 *  4. Saves results to localStorage key: tocfl_vocab_extra_meanings
 *  5. On next app load, useData merges these in automatically
 *  6. Provides "Export JSON" button to download updated vocabulary.json
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Word } from '../../types';
import { useLang } from '../../i18n/LangContext';
import { useApiKey } from '../../contexts/ApiKeyContext';

const EXTRA_KEY   = 'tocfl_vocab_extra_meanings';   // localStorage key
const BATCH_SIZE  = 100;

interface ExtraData { meaning: string; example?: string; }
type ExtraMap = Record<string, ExtraData>;

function loadExtra(): ExtraMap {
  try { return JSON.parse(localStorage.getItem(EXTRA_KEY) ?? '{}'); } catch { return {}; }
}
function saveExtra(m: ExtraMap) {
  try { localStorage.setItem(EXTRA_KEY, JSON.stringify(m)); } catch { /* quota */ }
}

interface Props {
  vocabulary: Word[];
  onVocabUpdated: () => void;   // triggers useData re-merge
}

const LEVEL_META: Record<string, { label: string; color: string }> = {
  A1: { label: '準備一', color: '#e05d3a' },
  A2: { label: '準備二', color: '#d4793a' },
  A3: { label: '入門',   color: '#c0861a' },
  A4: { label: '基礎',   color: '#a07c10' },
  B1: { label: '進階',   color: '#2e8b57' },
  B2: { label: '高階',   color: '#1d6b8a' },
  C1: { label: '流利',   color: '#5a3ea8' },
};

async function callOpenAI(
  apiKey: string,
  words: Word[],
  withExample: boolean,
): Promise<Record<string, ExtraData>> {
  const wordList = words
    .map((w, i) => `${i + 1}. ${w.hanzi} (${w.pinyin}) [${w.pos}] lv${w.level}`)
    .join('\n');

  const exampleLine = withExample
    ? '- example: một câu ví dụ ngắn bằng 繁體字 kèm bản dịch tiếng Việt trong ngoặc đơn. Format: 「câu ví dụ」（bản dịch）'
    : '- example: ""';

  const prompt = `Bạn là từ điển Hoa-Việt. Với mỗi từ bên dưới, hãy cung cấp:
- meaning: nghĩa tiếng Việt ngắn gọn (1–6 từ, đủ để học viên hiểu)
${exampleLine}

Trả về JSON object (không dùng markdown/code block):
{
  "漢字": { "meaning": "nghĩa", "example": "「例句」（dịch）" },
  ...
}

Danh sách từ:
${wordList}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.15,
      max_tokens: 3500,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as {error?: {message?: string}}).error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  let raw = data.choices[0].message.content.trim();
  raw = raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return JSON.parse(raw) as Record<string, ExtraData>;
}

export const VocabAdminTool: React.FC<Props> = ({ vocabulary, onVocabUpdated }) => {
  const { lang } = useLang();
  const { apiKey, hasKey } = useApiKey();

  const [extra,       setExtra]       = useState<ExtraMap>(() => loadExtra());
  const [selected,    setSelected]    = useState<Set<string>>(new Set(['A1','A2','A3','A4']));
  const [withExample, setWithExample] = useState(false);
  const [running,     setRunning]     = useState(false);
  const [log,         setLog]         = useState<string[]>([]);
  const [done,        setDone]        = useState(0);
  const [total,       setTotal]       = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const abortRef = useRef(false);
  const logRef   = useRef<HTMLDivElement>(null);

  // Scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Stats per level
  const stats = Object.keys(LEVEL_META).map(lvl => {
    const all     = vocabulary.filter(w => w.level === lvl);
    const missing = all.filter(w => !w.meaning && !extra[w.hanzi]);
    return { lvl, total: all.length, missing: missing.length, done: all.length - missing.length };
  });

  const totalMissing = stats.filter(s => selected.has(s.lvl)).reduce((s, x) => s + x.missing, 0);

  function addLog(msg: string) { setLog(l => [...l, msg]); }

  const startTranslation = useCallback(async () => {
    if (!hasKey || !apiKey) { setError('No API key configured. Please set your OpenAI key in Settings.'); return; }
    abortRef.current = false;
    setRunning(true);
    setError(null);
    setLog([]);

    // Collect all missing words for selected levels
    const toTranslate = vocabulary.filter(w =>
      selected.has(w.level) && !w.meaning && !extra[w.hanzi]
    );
    setTotal(toTranslate.length);
    setDone(0);

    if (toTranslate.length === 0) {
      addLog('✓ Không có từ nào cần dịch trong cấp đã chọn!');
      setRunning(false);
      return;
    }

    addLog(`▶ Bắt đầu dịch ${toTranslate.length} từ (${Math.ceil(toTranslate.length / BATCH_SIZE)} batch)...`);

    const currentExtra = { ...extra };
    let doneCount = 0;

    for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
      if (abortRef.current) { addLog('⏹ Đã dừng.'); break; }

      const batch     = toTranslate.slice(i, i + BATCH_SIZE);
      const batchNum  = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(toTranslate.length / BATCH_SIZE);
      addLog(`⏳ Batch ${batchNum}/${totalBatches}: ${batch.map(w => w.hanzi).join('、')}`);

      try {
        const results = await callOpenAI(apiKey, batch, withExample);

        let batchOk = 0;
        for (const word of batch) {
          const r = results[word.hanzi];
          if (r?.meaning) {
            currentExtra[word.hanzi] = r;
            batchOk++;
          }
        }
        doneCount += batchOk;
        setDone(doneCount);

        // Save incrementally
        saveExtra(currentExtra);
        setExtra({ ...currentExtra });
        addLog(`  ✓ ${batchOk}/${batch.length} từ đã dịch`);

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        addLog(`  ✗ Lỗi: ${msg}`);
        setError(msg);
        break;
      }

      // Small delay to avoid rate limit
      if (i + BATCH_SIZE < toTranslate.length) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    addLog(`\n✅ Hoàn thành! ${doneCount} từ đã được dịch.`);
    addLog('Các bản dịch đã được lưu vào localStorage. Nhấn "Export JSON" để tải file cập nhật.');
    setRunning(false);
    onVocabUpdated();
  }, [apiKey, hasKey, vocabulary, selected, withExample, extra, onVocabUpdated]);

  function stopTranslation() { abortRef.current = true; }

  function exportJSON() {
    const updated = vocabulary.map(w => {
      if (!w.meaning && extra[w.hanzi]) {
        return { ...w, meaning: extra[w.hanzi].meaning, example: extra[w.hanzi].example ?? '' };
      }
      return w;
    });
    const blob = new Blob([JSON.stringify(updated, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'vocabulary.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearExtra() {
    if (!confirm('Xoá tất cả bản dịch đã lưu trong localStorage?')) return;
    localStorage.removeItem(EXTRA_KEY);
    setExtra({});
    setLog([]);
  }

  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  const lbl = {
    vi: {
      title: 'Công cụ dịch từ vựng', subtitle: 'Tự động dịch các từ chưa có nghĩa tiếng Việt',
      level_select: 'Chọn cấp cần dịch', missing: 'cần dịch', done_label: 'đã có',
      with_example: 'Kèm câu ví dụ (chậm hơn, tốn token hơn)',
      start: 'Bắt đầu dịch', stop: 'Dừng', export: '⬇ Export vocabulary.json',
      clear: 'Xoá cache', total_missing: 'từ cần dịch',
      no_key: 'Chưa cấu hình OpenAI API key. Vào Settings để thêm key.',
      log_title: 'Log',
    },
    zh: {
      title: '詞彙翻譯工具', subtitle: '自動補充缺少的越南語翻譯',
      level_select: '選擇等級', missing: '待翻譯', done_label: '已完成',
      with_example: '附例句（較慢，消耗更多token）',
      start: '開始翻譯', stop: '停止', export: '⬇ 匯出 vocabulary.json',
      clear: '清除快取', total_missing: '個詞待翻譯',
      no_key: '尚未設定 OpenAI API key，請先至設定頁新增。',
      log_title: '記錄',
    },
    en: {
      title: 'Vocab Translation Tool', subtitle: 'Auto-translate missing Vietnamese meanings',
      level_select: 'Select levels', missing: 'missing', done_label: 'done',
      with_example: 'Include example sentences (slower, uses more tokens)',
      start: 'Start Translation', stop: 'Stop', export: '⬇ Export vocabulary.json',
      clear: 'Clear cache', total_missing: 'words to translate',
      no_key: 'No OpenAI API key configured. Go to Settings to add one.',
      log_title: 'Log',
    },
  }[lang as 'vi'|'zh'|'en'];

  const extraCount = Object.keys(extra).length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>{lbl.title}</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '.82rem' }}>{lbl.subtitle}</p>
      </div>

      {!hasKey && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: '#fef9e7', border: '1px solid #f0c040',
          color: '#92400e', fontSize: '.85rem', fontWeight: 600,
        }}>
          ⚠ {lbl.no_key}
        </div>
      )}

      {/* Level selector */}
      <div className="card card--compact" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {lbl.level_select}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.map(({ lvl, total: t, missing: m, done: d }) => {
            const meta    = LEVEL_META[lvl];
            const isSelected = selected.has(lvl);
            const pctDone = t > 0 ? Math.round(d / t * 100) : 0;
            return (
              <button key={lvl}
                onClick={() => setSelected(prev => {
                  const next = new Set(prev);
                  next.has(lvl) ? next.delete(lvl) : next.add(lvl);
                  return next;
                })}
                disabled={running}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderRadius: 10, padding: '10px 12px',
                  border: `2px solid ${isSelected ? meta.color : 'var(--border)'}`,
                  background: isSelected ? `${meta.color}12` : 'var(--surface)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: meta.color, color: '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.62rem', fontWeight: 800, lineHeight: 1.2,
                }}>
                  <div>{lvl}</div>
                  <div style={{ fontSize: '.55rem', opacity: .85 }}>{meta.label}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '.82rem', color: meta.color }}>{t} {lang === 'vi' ? 'từ' : lang === 'zh' ? '詞' : 'words'}</span>
                    <span style={{ fontSize: '.72rem', color: m > 0 ? '#dc2626' : '#16a34a' }}>
                      {m > 0 ? `${m} ${lbl.missing}` : `✓ ${lbl.done_label}`}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctDone}%`, background: meta.color, borderRadius: 4 }} />
                  </div>
                </div>
                {isSelected && (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: meta.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 800, flexShrink: 0 }}>✓</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setWithExample(v => !v)}
          disabled={running}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${withExample ? 'var(--accent)' : 'var(--border)'}`,
            background: withExample ? 'var(--accent-light)' : 'transparent',
            color: withExample ? 'var(--accent)' : 'var(--text-muted)',
          }}>
          {withExample ? '● ' : '○ '}{lbl.with_example}
        </button>

        <div style={{ marginLeft: 'auto', fontSize: '.78rem', color: 'var(--text-muted)' }}>
          {extraCount > 0 && `${extraCount} ${lang === 'vi' ? 'từ trong cache' : lang === 'zh' ? '個詞已快取' : 'words cached'} · `}
          {totalMissing} {lbl.total_missing}
        </div>
      </div>

      {/* Running progress */}
      {running && (
        <div style={{
          padding: '12px 14px', borderRadius: 10, marginBottom: 14,
          background: 'var(--accent-light)', border: '1px solid var(--accent)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--accent)' }}>
              {done}/{total} ({pct}%)
            </span>
            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
              {Math.ceil((total - done) / BATCH_SIZE)} {lang === 'vi' ? 'batch còn lại' : 'batches left'}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--accent), #7c3aed)',
              borderRadius: 4, transition: 'width .3s',
            }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 14,
          background: '#fef2f2', border: '1px solid #dc2626',
          color: '#dc2626', fontSize: '.82rem',
        }}>
          ✗ {error}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {!running ? (
          <button
            disabled={!hasKey || totalMissing === 0}
            onClick={startTranslation}
            style={{
              flex: 2, minHeight: 48, borderRadius: 12, border: 'none',
              background: hasKey && totalMissing > 0 ? 'var(--accent)' : 'var(--border)',
              color: hasKey && totalMissing > 0 ? '#fff' : 'var(--text-muted)',
              cursor: hasKey && totalMissing > 0 ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: '.95rem', fontWeight: 700,
            }}>
            {lbl.start} ({totalMissing} {lang === 'vi' ? 'từ' : lang === 'zh' ? '詞' : 'words'}) →
          </button>
        ) : (
          <button
            onClick={stopTranslation}
            style={{
              flex: 2, minHeight: 48, borderRadius: 12, border: 'none',
              background: '#dc2626', color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '.95rem', fontWeight: 700,
            }}>
            ⏹ {lbl.stop}
          </button>
        )}

        {extraCount > 0 && (
          <>
            <button
              onClick={exportJSON}
              disabled={running}
              style={{
                flex: 2, minHeight: 48, borderRadius: 12,
                border: '2px solid #16a34a', background: '#f0fdf4',
                color: '#16a34a', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '.88rem', fontWeight: 700,
              }}>
              {lbl.export}
            </button>
            <button
              onClick={clearExtra}
              disabled={running}
              style={{
                flex: 1, minHeight: 48, borderRadius: 12,
                border: '1.5px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-muted)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '.82rem', fontWeight: 600,
              }}>
              {lbl.clear}
            </button>
          </>
        )}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div>
          <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {lbl.log_title}
          </div>
          <div
            ref={logRef}
            style={{
              background: '#0f172a', color: '#94a3b8',
              borderRadius: 12, padding: '12px 14px',
              fontFamily: 'monospace', fontSize: '.75rem',
              maxHeight: 200, overflowY: 'auto',
              scrollbarWidth: 'thin',
            }}
          >
            {log.map((line, i) => (
              <div key={i} style={{
                color: line.startsWith('✓') || line.startsWith('✅') ? '#4ade80'
                     : line.startsWith('✗') || line.startsWith('⚠') ? '#f87171'
                     : line.startsWith('▶') ? '#60a5fa'
                     : '#94a3b8',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}>
                {line}
              </div>
            ))}
            {running && (
              <div style={{ color: '#fbbf24', marginTop: 4 }}>
                ●●● {lang === 'vi' ? 'Đang xử lý...' : lang === 'zh' ? '處理中...' : 'Processing...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export instructions */}
      {extraCount > 0 && !running && (
        <div style={{
          marginTop: 16, padding: '12px 14px', borderRadius: 10,
          background: '#f0fdf4', border: '1px solid #16a34a',
          fontSize: '.8rem', color: '#15803d',
        }}>
          <strong>Hướng dẫn cập nhật:</strong> Sau khi Export, thay file{' '}
          <code style={{ background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>
            FE/public/data/vocabulary.json
          </code>{' '}
          bằng file vừa tải, rồi chạy <code style={{ background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>npm run build</code>.
        </div>
      )}
    </div>
  );
};
