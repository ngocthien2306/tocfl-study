import React, { useState, useCallback } from 'react';
import { HighlightableText } from '../HighlightableText';
import type { ExamKey, TranscriptBlock, OptionKey } from '../../types';
import { useQuestionTranscript } from '../../hooks/useTranscript';

const WARNED_KEY = 'tocfl_transcript_warned';

interface Props {
  band:       'A' | 'B' | 'C';
  examKey:    ExamKey;
  questionId: number;
}

export const OfficialTranscript: React.FC<Props> = ({ band, examKey, questionId }) => {
  const item = useQuestionTranscript(band, examKey, questionId);
  const [revealed, setRevealed] = useState(false);

  const onReveal = useCallback(() => {
    const warned = localStorage.getItem(WARNED_KEY) === '1';
    if (!warned) {
      const ok = window.confirm(
        '📜 Xem văn bản gốc có thể giảm hiệu quả luyện nghe vì bạn không còn phải đoán nội dung audio.\n\n' +
        'Bạn vẫn muốn xem?',
      );
      if (!ok) return;
      localStorage.setItem(WARNED_KEY, '1');
    }
    setRevealed(true);
  }, []);

  if (!item) {
    // Either still loading, or no official transcript exists for this question
    return null;
  }

  const pageKeyPrefix = `transcript_${band}_${examKey}_q${questionId}`;

  return (
    <div style={{
      marginBottom: 12, borderRadius: 8,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => (revealed ? setRevealed(false) : onReveal())}
        style={{
          width: '100%', padding: '8px 12px', textAlign: 'left',
          background: revealed ? 'var(--accent-light)' : 'var(--bg)',
          border: 'none', borderBottom: revealed ? '1px solid var(--border)' : 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '.78rem', fontWeight: 600, color: 'var(--text)',
        }}
      >
        <span>📜 Văn bản gốc {item.ids.length > 1 && `(câu ${item.ids.join('–')})`}</span>
        <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>{revealed ? 'Ẩn ▲' : 'Hiện ▼'}</span>
      </button>

      {revealed && (
        <div style={{ padding: '10px 12px', background: 'var(--surface)' }}>
          {item.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} pageKeyPrefix={`${pageKeyPrefix}_b${i}`} />
          ))}
        </div>
      )}
    </div>
  );
};

const BlockRenderer: React.FC<{ block: TranscriptBlock; pageKeyPrefix: string }> = ({ block, pageKeyPrefix }) => {
  if (block.kind === 'narration') {
    return (
      <div style={{
        marginBottom: 8, padding: '6px 10px', borderRadius: 6,
        background: 'var(--bg)', borderLeft: '3px solid var(--accent)',
        fontSize: '.83rem', color: 'var(--text-secondary)', fontStyle: 'italic',
      }}>
        <HighlightableText text={block.text} page_key={`${pageKeyPrefix}_n`} />
      </div>
    );
  }

  if (block.kind === 'dialogue') {
    return (
      <div style={{ marginBottom: 8 }}>
        {block.lines.map((line, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, marginBottom: 4, fontSize: '.85rem', lineHeight: 1.55,
          }}>
            <span style={{
              flexShrink: 0, width: 28, textAlign: 'center',
              fontWeight: 700, color: line.speaker.startsWith('男') ? '#0ea5e9' : '#ec4899',
            }}>{line.speaker}</span>
            <HighlightableText text={line.text} page_key={`${pageKeyPrefix}_d${i}`} />
          </div>
        ))}
      </div>
    );
  }

  // qa block
  return (
    <div style={{
      marginBottom: 8, padding: '6px 10px', borderRadius: 6,
      background: 'var(--accent-light)', fontSize: '.85rem', fontWeight: 600,
    }}>
      <span style={{ marginRight: 6, color: 'var(--accent)' }}>❓</span>
      <HighlightableText text={block.question} page_key={`${pageKeyPrefix}_q`} />
      {block.options && (
        <div style={{ marginTop: 6, paddingLeft: 18, fontWeight: 400, fontSize: '.82rem' }}>
          {(['A', 'B', 'C', 'D'] as OptionKey[]).map(k => block.options?.[k] && (
            <div key={k} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>({k})</span>
              <HighlightableText text={block.options[k]!} page_key={`${pageKeyPrefix}_o${k}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
