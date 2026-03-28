import React, { useState } from 'react';
import type { AIResult, AISentenceResult, AIReadingResult, AIQuestion } from '../../types';

interface Props {
  result: AIResult;
}

export const ResultCard: React.FC<Props> = ({ result }) => {
  if (result.type === 'sentences') return <SentenceResult r={result} />;
  return <ReadingResult r={result} />;
};

// ─── Sentence result ──────────────────────────────────────────────────────────
const SentenceResult: React.FC<{ r: AISentenceResult }> = ({ r }) => (
  <div>
    <div className="flex-between mb-12">
      <div>
        <span className={`badge badge-${r.band}`}>Band {r.band}</span>
        <span className="text-sm text-muted" style={{ marginLeft: 8 }}>
          {r.topic} · {r.createdAt}
        </span>
      </div>
      <span className="text-sm text-muted">{r.sentences.length} câu</span>
    </div>

    {r.sentences.map((s, i) => (
      <div key={i} className="card" style={{ marginBottom: 12 }}>
        {/* Chinese sentence */}
        <div style={{ fontFamily: 'var(--font-zh)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>
          {s.chinese}
        </div>
        {/* Pinyin */}
        <div className="text-sm" style={{ color: 'var(--accent)', marginBottom: 8 }}>{s.pinyin}</div>
        {/* Vietnamese */}
        <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '.9rem', marginBottom: 10 }}>
          🇻🇳 {s.vietnamese}
        </div>

        <div className="divider" />

        {/* Key words */}
        {s.key_words?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="text-xs text-muted" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Từ chìa khoá
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {s.key_words.map((kw, j) => (
                <div key={j} style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '4px 10px',
                  fontSize: '.82rem',
                  background: 'var(--bg)',
                }}>
                  <span style={{ fontFamily: 'var(--font-zh)', fontWeight: 700 }}>{kw.word}</span>
                  <span style={{ color: 'var(--accent)', margin: '0 4px' }}>{kw.pinyin}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{kw.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grammar note */}
        {s.grammar_note && (
          <div style={{
            background: 'var(--warn-light)',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            fontSize: '.83rem',
            color: 'var(--warn)',
          }}>
            💡 {s.grammar_note}
          </div>
        )}
      </div>
    ))}
  </div>
);

// ─── Reading result ───────────────────────────────────────────────────────────
const ReadingResult: React.FC<{ r: AIReadingResult }> = ({ r }) => {
  const [showPinyin, setShowPinyin]   = useState(false);
  const [showVietnamese, setShowVi]   = useState(false);

  return (
    <div>
      <div className="flex-between mb-12">
        <div>
          <span className={`badge badge-${r.band}`}>Band {r.band}</span>
          <span className="text-sm text-muted" style={{ marginLeft: 8 }}>
            {r.topic} · {r.createdAt}
          </span>
        </div>
        <span className="text-sm text-muted">{r.questions.length} câu hỏi</span>
      </div>

      {/* Passage */}
      <div className="card">
        <div className="flex-between mb-12">
          <h3>📖 Đoạn văn</h3>
          <div className="flex gap-8">
            <button className={`chip ${showPinyin ? 'active' : ''}`} onClick={() => setShowPinyin(v => !v)}>Pinyin</button>
            <button className={`chip ${showVietnamese ? 'active' : ''}`} onClick={() => setShowVi(v => !v)}>Dịch nghĩa</button>
          </div>
        </div>

        <div className="passage-box">
          <div style={{ fontFamily: 'var(--font-zh)', fontSize: '1rem', lineHeight: 2 }}>
            {r.passage}
          </div>
          {showPinyin && r.passage_pinyin && (
            <div style={{ marginTop: 10, fontSize: '.85rem', color: 'var(--accent)', lineHeight: 1.8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              {r.passage_pinyin}
            </div>
          )}
          {showVietnamese && r.passage_vietnamese && (
            <div style={{ marginTop: 10, fontSize: '.88rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              🇻🇳 {r.passage_vietnamese}
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div>
        <h3 style={{ marginBottom: 10 }}>Câu hỏi</h3>
        {r.questions.map((q, i) => (
          <QuestionItem key={i} q={q} num={i + 1} />
        ))}
      </div>
    </div>
  );
};

// ─── Question item with reveal ────────────────────────────────────────────────
const QuestionItem: React.FC<{ q: AIQuestion; num: number }> = ({ q, num }) => {
  const [selected,  setSelected]  = useState<string | null>(null);
  const [revealed,  setRevealed]  = useState(false);

  function handleSelect(k: string) {
    if (revealed) return;
    setSelected(k);
  }

  function handleReveal() {
    setRevealed(true);
  }

  function handleReset() {
    setSelected(null);
    setRevealed(false);
  }

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="question-header">
        <span className="question-num">Câu {num}.</span>
        <span style={{ fontFamily: 'var(--font-zh)' }}>{q.question}</span>
      </div>

      <div className="option-list" style={{ marginBottom: 12 }}>
        {(Object.entries(q.options) as [string, string][]).map(([key, text]) => {
          let cls = 'option-btn';
          if (revealed) {
            if (key === q.answer) cls += ' correct';
            else if (key === selected) cls += ' wrong';
          } else if (key === selected) cls += ' selected';
          return (
            <button key={key} className={cls} onClick={() => handleSelect(key)} disabled={revealed}>
              <span className="option-key">{key}</span>
              <span style={{ fontFamily: 'var(--font-zh)' }}>{text}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {revealed && q.explanation && (
        <div className="result-notice correct">
          ✓ Đáp án: <strong>{q.answer}</strong>
          <div className="expl" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
            {q.explanation}
          </div>
        </div>
      )}

      <div className="flex gap-8 mt-12">
        {!revealed
          ? <button className="btn btn-primary btn-sm" onClick={handleReveal} disabled={!selected}>
              Xem đáp án &amp; giải thích
            </button>
          : <button className="btn btn-ghost btn-sm" onClick={handleReset}>↺ Làm lại</button>
        }
      </div>
    </div>
  );
};
