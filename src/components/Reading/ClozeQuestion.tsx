import React, { useState } from 'react';
import type { ClozePassage } from '../../types';
import { useLang } from '../../i18n/LangContext';
import { t } from '../../i18n/translations';

interface Props {
  passage: ClozePassage;
  onDone: (score: number, total: number) => void;
}

export const ClozeQuestion: React.FC<Props> = ({ passage, onDone }) => {
  const { lang } = useLang();
  const [answers,   setAnswers]   = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const segments  = passage.passage.split(/（(\d+)）/);
  const allFilled = passage.blanks.every(b => answers[b]);
  const score     = passage.blanks.filter(b => answers[b] === passage.answers[String(b)]).length;

  function cycleBlank(blankId: number) {
    if (submitted) return;
    const opts = Object.keys(passage.options);
    const cur  = answers[blankId];
    const idx  = opts.indexOf(cur);
    const next = opts[(idx + 1) % (opts.length + 1)];
    setAnswers(a => {
      const updated = { ...a };
      if (idx === opts.length - 1) { delete updated[blankId]; } else { updated[blankId] = next; }
      return updated;
    });
  }

  function handleSubmit() {
    if (!allFilled || submitted) return;
    setSubmitted(true);
    onDone(score, passage.blanks.length);
  }

  function handleReset() {
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>{t('cloze_title', lang)}</h3>

      {/* Option bank */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {Object.entries(passage.options).map(([k, v]) => (
          <span key={k} style={{ padding: '3px 10px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '.85rem', background: 'var(--bg)' }}>
            <strong>({k})</strong> {v}
          </span>
        ))}
      </div>

      <div className="divider" />

      {/* Passage */}
      <div className="passage-box" style={{ lineHeight: 2.4 }}>
        {segments.map((seg, i) => {
          if (i % 2 === 0) return <span key={i}>{seg}</span>;
          const bId       = parseInt(seg);
          const val       = answers[bId];
          const label     = val ? `(${val}) ${passage.options[val]}` : `(${bId}) ___`;
          const isCorrect = submitted && val === passage.answers[String(bId)];
          const isWrong   = submitted && val !== passage.answers[String(bId)];
          return (
            <span
              key={i}
              className={`blank${isCorrect ? ' filled-correct' : isWrong ? ' filled-wrong' : ''}`}
              onClick={() => cycleBlank(bId)}
            >
              {label}
            </span>
          );
        })}
      </div>

      {passage.passage_vi && (
        <div className="passage-vi">{passage.passage_vi}</div>
      )}

      {/* Result */}
      {submitted && (
        <div className={`result-notice ${score === passage.blanks.length ? 'correct' : 'wrong'}`} style={{ marginTop: 12 }}>
          {score === passage.blanks.length
            ? t('cloze_perfect', lang)
            : `${t('cloze_score', lang)} ${score}/${passage.blanks.length} ${t('cloze_blanks', lang)}`
          }
          <div className="expl">
            {t('cloze_answers', lang)} {passage.blanks.map(b => `(${b}) = ${passage.answers[String(b)]}`).join(' · ')}
          </div>
        </div>
      )}

      <div className="flex gap-8 mt-16">
        {!submitted
          ? <button className="btn btn-primary" onClick={handleSubmit} disabled={!allFilled}>
              {t('cloze_check', lang)}
            </button>
          : <button className="btn btn-outline" onClick={handleReset}>
              {t('cloze_redo', lang)}
            </button>
        }
        <span className="text-sm text-muted" style={{ alignSelf: 'center' }}>
          {t('cloze_hint', lang)}
        </span>
      </div>
    </div>
  );
};
