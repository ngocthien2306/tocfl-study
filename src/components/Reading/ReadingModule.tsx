import React, { useMemo, useState } from 'react';
import type { ExamData, FlatQuestion, Progress, OptionKey } from '../../types';
import { ClozeQuestion } from './ClozeQuestion';
import { useLang } from '../../i18n/LangContext';
import type { Lang } from '../../i18n/translations';
import { t } from '../../i18n/translations';

interface Props {
  examData: ExamData;
  progress?: Progress;
  markReading: (key: string, correct: boolean) => void;
}

type Band    = 'A' | 'B';
type PartKey = 'part3' | 'part4' | 'part5' | 'part1' | 'part2';

function getPartLabel(key: PartKey, lang: Lang): string {
  const map: Record<PartKey, string> = {
    part1: t('read_part1_label', lang),
    part2: t('read_part2_label', lang),
    part3: t('read_part3_label', lang),
    part4: t('read_part4_label', lang),
    part5: t('read_part5_label', lang),
  };
  return map[key];
}

const BAND_A_PARTS: PartKey[] = ['part3', 'part4', 'part5'];
const BAND_B_PARTS: PartKey[] = ['part1', 'part2'];

function buildQuestions(band: Band, part: PartKey, data: ExamData): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  if (band === 'A') {
    if (part === 'part3') {
      data.bandA.exam1.reading.part3.groups.forEach(g =>
        g.questions.forEach(q =>
          out.push({ ...q, type: 'gap', part, context: g.context })
        )
      );
    } else if (part === 'part5') {
      data.bandA.exam1.reading.part5.passages.forEach(p =>
        p.questions.forEach(q =>
          out.push({ ...q, type: 'mc', part, passage: p.text, passageId: p.id })
        )
      );
    }
  } else {
    if (part === 'part1') {
      data.bandB.exam1.reading.part1.passages.forEach(p =>
        p.questions.forEach(q =>
          out.push({ ...q, type: 'mc', part, passage: p.passage_raw, passageId: p.id })
        )
      );
    } else if (part === 'part2') {
      data.bandB.exam1.reading.part2.passages.forEach(p =>
        p.questions.forEach(q =>
          out.push({ ...q, type: 'mc', part, passage: p.text, passageId: p.id })
        )
      );
    }
  }
  return out;
}

interface SessionStat { correct: number; total: number }

export const ReadingModule: React.FC<Props> = ({ examData, markReading }) => {
  const { lang } = useLang();
  const [band,     setBand]     = useState<Band>('B');
  const [part,     setPart]     = useState<PartKey>('part2');
  const [qIdx,     setQIdx]     = useState(0);
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [answered, setAnswered] = useState(false);
  const [stat,     setStat]     = useState<SessionStat>({ correct: 0, total: 0 });

  const questions = useMemo(
    () => buildQuestions(band, part, examData),
    [band, part, examData]
  );

  const isCloze = band === 'A' && part === 'part4';
  if (isCloze) {
    return <ClozeSection examData={examData} markReading={markReading} />;
  }

  const q = questions[qIdx];
  if (!q) return <div className="card empty-state"><p>{t('read_no_q', lang)}</p></div>;

  function handleSelect(key: OptionKey) {
    if (answered) return;
    setSelected(key);
  }

  function handleCheck() {
    if (!selected || answered) return;
    const correct = selected === q.answer;
    setAnswered(true);
    setStat(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    markReading(`${band}_${part}_${q.id}`, correct);
  }

  function handleNext() {
    setSelected(null);
    setAnswered(false);
    setQIdx(i => Math.min(i + 1, questions.length - 1));
  }

  function handlePrev() {
    setSelected(null);
    setAnswered(false);
    setQIdx(i => Math.max(i - 1, 0));
  }

  function changeBand(b: Band) {
    setBand(b);
    setPart(b === 'A' ? 'part3' : 'part1');
    resetSession();
  }

  function changePart(p: PartKey) {
    setPart(p);
    resetSession();
  }

  function resetSession() {
    setQIdx(0);
    setSelected(null);
    setAnswered(false);
    setStat({ correct: 0, total: 0 });
  }

  const prevPassage = qIdx > 0 ? questions[qIdx - 1].passage : null;
  const showPassage = !!q.passage && q.passage !== prevPassage;

  const qLabel = lang === 'zh'
    ? `第 ${qIdx + 1} / ${questions.length} 題`
    : `${t('read_q_of', lang)} ${qIdx + 1} / ${questions.length}`;

  const qNumLabel = lang === 'zh'
    ? `第 ${q.id} 題`
    : `${t('read_q_of', lang)} ${q.id}.`;

  return (
    <div>
      {/* Filters */}
      <div className="card card--compact mb-12">
        <div className="filter-group mb-8">
          <span className="filter-label">{t('read_band_label', lang)}</span>
          {(['A', 'B'] as Band[]).map(b => (
            <button key={b} className={`chip ${band === b ? 'active' : ''}`} onClick={() => changeBand(b)}>
              Band {b}
            </button>
          ))}
        </div>
        <div className="filter-group mb-8">
          <span className="filter-label">{t('read_part_label', lang)}</span>
          {(band === 'A' ? BAND_A_PARTS : BAND_B_PARTS).map(p => (
            <button key={p} className={`chip ${part === p ? 'active' : ''}`} onClick={() => changePart(p)}>
              {getPartLabel(p, lang)}
            </button>
          ))}
        </div>
        {stat.total > 0 && (
          <div>
            <div className="progress-row">
              <span>
                {t('read_session_stat', lang)}: {stat.correct}/{stat.total} {t('read_correct_of', lang)}
              </span>
              <span>{Math.round(stat.correct / stat.total * 100)}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${stat.correct / stat.total * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Q progress */}
      <div style={{ marginBottom: 10 }}>
        <div className="progress-row">
          <span>{qLabel}</span>
          <span>{Math.round((qIdx + 1) / questions.length * 100)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(qIdx + 1) / questions.length * 100}%` }} />
        </div>
      </div>

      {/* Question card */}
      <div className="card">
        {q.context && (
          <div style={{ background: 'var(--warn-light)', border: '1px solid #fde68a', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 12, fontSize: '.83rem', color: 'var(--warn)' }}>
            {q.context}
          </div>
        )}

        {showPassage && q.passage && (
          <div className="passage-box">
            <div className="passage-label">{t('passage_label', lang)}</div>
            {q.passage}
          </div>
        )}

        <div className="question-header">
          <span className="question-num">{qNumLabel}</span>
          {q.question ?? q.sentence}
        </div>

        <div className="option-list">
          {(Object.entries(q.options) as [OptionKey, string][]).map(([key, text]) => {
            let cls = 'option-btn';
            if (answered) {
              if (key === q.answer)      cls += ' correct';
              else if (key === selected) cls += ' wrong';
            } else if (key === selected) cls += ' selected';
            return (
              <button key={key} className={cls} onClick={() => handleSelect(key)} disabled={answered}>
                <span className="option-key">{key}</span>
                <span>{text}</span>
              </button>
            );
          })}
        </div>

        {answered && (
          <div className={`result-notice ${selected === q.answer ? 'correct' : 'wrong'}`}>
            {selected === q.answer
              ? t('read_correct_msg', lang)
              : `${t('read_wrong_msg', lang)} (${q.answer}) ${q.options[q.answer]}`
            }
            {q.explanation && <div className="expl">💡 {q.explanation}</div>}
          </div>
        )}

        <div className="flex gap-8 mt-16">
          <button className="btn btn-outline" onClick={handlePrev} disabled={qIdx === 0}>
            {t('btn_prev', lang)}
          </button>
          {!answered
            ? <button className="btn btn-primary" onClick={handleCheck} disabled={!selected}>
                {t('read_check', lang)}
              </button>
            : <button className="btn btn-primary" onClick={handleNext} disabled={qIdx === questions.length - 1}>
                {t('read_next_q', lang)}
              </button>
          }
        </div>
      </div>
    </div>
  );
};

// ─── Cloze section (Band A Part 4) ────────────────────────────────────────────
interface ClozeProps {
  examData: ExamData;
  markReading: (key: string, correct: boolean) => void;
}
const ClozeSection: React.FC<ClozeProps> = ({ examData, markReading }) => {
  const { lang } = useLang();
  const passages = examData.bandA.exam1.reading.part4.passages;
  const [pIdx, setPIdx] = useState(0);
  const passage = passages[pIdx];

  return (
    <div>
      <div className="card card--compact mb-12">
        <div className="filter-group">
          <span className="filter-label">{t('cloze_section_label', lang)}</span>
          {passages.map((_, i) => (
            <button key={i} className={`chip ${pIdx === i ? 'active' : ''}`} onClick={() => setPIdx(i)}>
              {t('cloze_passage_n', lang)} {i + 1}
            </button>
          ))}
        </div>
      </div>
      {passage && (
        <ClozeQuestion
          key={pIdx}
          passage={passage}
          onDone={(score, total) => markReading(`A_part4_${pIdx}`, score === total)}
        />
      )}
    </div>
  );
};
