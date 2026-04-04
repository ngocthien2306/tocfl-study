import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { ExamData, FlatQuestion, Progress, OptionKey } from '../../types';
import type { AIExplanationData } from '../../utils/aiExplanation';
import { ClozeQuestion } from './ClozeQuestion';
import { AIReadingGenerator } from './AIReadingGenerator';
import { useLang } from '../../i18n/LangContext';
import type { Lang } from '../../i18n/translations';
import { t } from '../../i18n/translations';
import { IconBookOpen } from '../UI/Icons';
import { HighlightableText } from '../HighlightableText';
import { useApiKey } from '../../contexts/ApiKeyContext';
import { useAIModel } from '../../hooks/useAIModel';
import {
  loadExplanation, saveExplanation,
  generateReadingExplanation, stripJsonSuffix,
} from '../../utils/aiExplanation';

interface Props {
  examData:    ExamData;
  progress?:   Progress;
  markReading: (key: string, correct: boolean) => void;
  token?:      string | null;
}

type ReadingMode = 'practice' | 'ai';
type Band        = 'A' | 'B';
type PartKey     = 'part3' | 'part4' | 'part5' | 'part1' | 'part2';

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
const ALL_BAND_A_EXAMS = ['exam1', 'exam2', 'exam3', 'exam4', 'exam5'] as const;

function buildQuestions(band: Band, part: PartKey, data: ExamData): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  let uid = 1;

  if (band === 'A') {
    if (part === 'part3') {
      ALL_BAND_A_EXAMS.forEach(examKey => {
        const exam = data.bandA[examKey];
        if (!exam) return;
        const p3 = exam.reading.part3;
        p3.groups.forEach(g => {
          const pageImage = g.page_image && p3.image_dir
            ? `${p3.image_dir}/${g.page_image}` : undefined;
          g.questions.forEach(q => {
            out.push({ ...q, id: uid++, type: 'gap', part, context: g.context, pageImage });
          });
        });
      });
    } else if (part === 'part5') {
      ALL_BAND_A_EXAMS.forEach(examKey => {
        const exam = data.bandA[examKey];
        if (!exam) return;
        exam.reading.part5.passages.forEach(p =>
          p.questions.forEach(q =>
            out.push({ ...q, id: uid++, type: 'mc', part, passage: p.text, passageId: p.id })
          )
        );
      });
    }
  } else {
    if (part === 'part1') {
      data.bandB.exam1.reading.part1.passages.forEach(p =>
        p.questions.forEach(q =>
          out.push({ ...q, id: uid++, type: 'mc', part, passage: p.passage_raw, passageId: p.id })
        )
      );
    } else if (part === 'part2') {
      data.bandB.exam1.reading.part2.passages.forEach(p =>
        p.questions.forEach(q =>
          out.push({ ...q, id: uid++, type: 'mc', part, passage: p.text, passageId: p.id })
        )
      );
    }
  }
  return out;
}

interface SessionStat { correct: number; total: number }

// ─── AI Drawer ────────────────────────────────────────────────────────────────
interface AIDrawerProps {
  apiKey:    string;
  hasKey:    boolean;
  model:     string;
  cacheKey:  string;
  question?: string;
  sentence?: string;
  options:   Partial<Record<OptionKey, string>>;
  answer:    OptionKey;
  context?:  string;
  passage?:  string;
  token?:    string | null;
}

const AIDrawer: React.FC<AIDrawerProps> = ({
  apiKey, hasKey, model, cacheKey,
  question, sentence, options, answer, context, passage, token,
}) => {
  const [status,     setStatus    ] = useState<'idle' | 'loading' | 'done'>('idle');
  const [expanded,   setExpanded  ] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [data,       setData      ] = useState<AIExplanationData | null>(() => loadExplanation(cacheKey));
  const prevKey = useRef(cacheKey);

  useEffect(() => {
    if (prevKey.current !== cacheKey) {
      prevKey.current = cacheKey;
      const cached = loadExplanation(cacheKey);
      setData(cached);
      setStatus(cached ? 'done' : 'idle');
      setExpanded(false);
      setStreamText('');
    }
  }, [cacheKey]);

  const handleAsk = useCallback(async () => {
    if (!hasKey || status === 'loading') return;
    setStatus('loading');
    setStreamText('');
    setExpanded(true);
    try {
      const result = await generateReadingExplanation({
        apiKey, model, questionId: 0,
        question, sentence, options, answer, context, passage,
        onToken: tok => setStreamText(prev => prev + tok),
      });
      saveExplanation(cacheKey, result, token);
      setData(result);
      setStatus('done');
      setStreamText('');
    } catch {
      setStatus('idle');
      setExpanded(false);
    }
  }, [apiKey, hasKey, model, status, cacheKey, question, sentence, options, answer, context, passage, token]);

  if (!hasKey) {
    return (
      <div style={{
        marginTop: 12, padding: '8px 12px', borderRadius: 8,
        background: 'var(--bg)', border: '1px dashed var(--border)',
        fontSize: '.78rem', color: 'var(--text-muted)', textAlign: 'center',
      }}>
        🤖 Nhập OpenAI API key để dùng AI giải thích câu này
      </div>
    );
  }

  const hasCached = !!data;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {status === 'idle' && !hasCached && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '.78rem', padding: '4px 12px', borderRadius: 20 }}
            onClick={handleAsk}
          >
            🤖 Hỏi AI giải thích
          </button>
        )}
        {status === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: 'var(--accent)' }}>
            <span className="iv-typing-dots"><span/><span/><span/></span>
            Đang phân tích...
          </div>
        )}
        {(status === 'done' || (hasCached && status === 'idle')) && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ border: '1px solid var(--success)', color: 'var(--success)', fontSize: '.78rem', padding: '4px 12px', borderRadius: 20 }}
            onClick={() => setExpanded(e => !e)}
          >
            ✓ AI đã giải {expanded ? '▲' : '▼'}
          </button>
        )}
        {hasCached && status !== 'loading' && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '.72rem', color: 'var(--text-muted)', padding: '3px 8px' }}
            onClick={handleAsk}
            title="Tạo lại giải thích"
          >
            ↻ Tạo lại
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            padding: '12px 14px', background: 'var(--bg)', borderRadius: 8,
            border: '1px solid var(--border)', fontSize: '.83rem', lineHeight: 1.75,
          }}>
            {status === 'loading' && (
              <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {stripJsonSuffix(streamText)}
                <span className="iv-typing-cursor">▍</span>
              </div>
            )}
            {status !== 'loading' && data && (
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{data.explanation}</div>
            )}
          </div>

          {status !== 'loading' && data && data.vocabulary.length > 0 && (
            <div style={{ borderRadius: 8, border: '1.5px solid var(--accent)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--accent)', color: '#fff', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '.78rem', letterSpacing: '.05em' }}>📚 TỪ VỰNG CẦN HỌC</span>
                <span style={{ fontSize: '.7rem', opacity: 0.85 }}>{data.vocabulary.length} từ</span>
              </div>
              <div style={{ background: 'var(--accent-light)', padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {data.vocabulary.map((v, i) => (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{v.word}</span>
                      <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{v.pinyin}</span>
                    </div>
                    <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: v.example ? 6 : 0 }}>{v.meaning}</div>
                    {v.example && (
                      <div style={{ fontSize: '.73rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border)', paddingTop: 5, lineHeight: 1.5 }}>
                        {v.example}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const ReadingModule: React.FC<Props> = ({ examData, markReading, token }) => {
  const { lang } = useLang();
  const { apiKey, hasKey } = useApiKey();
  const { model } = useAIModel();

  const [mode,     setMode]     = useState<ReadingMode>('practice');
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

  // ── Mode switcher ─────────────────────────────────────────────────────────
  const modeSwitcher = (
    <div className="reading-mode-bar">
      <button
        className={`reading-mode-btn${mode === 'practice' ? ' active' : ''}`}
        onClick={() => setMode('practice')}
      >
        <IconBookOpen size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
        {lang === 'zh' ? '練習題目' : lang === 'en' ? 'Practice' : 'Luyện tập'}
      </button>
      <button
        className={`reading-mode-btn${mode === 'ai' ? ' active' : ''}`}
        onClick={() => setMode('ai')}
      >
        {t('ai_read_tab', lang)}
      </button>
    </div>
  );

  if (mode === 'ai') {
    return (
      <div>
        {modeSwitcher}
        <AIReadingGenerator examData={examData} />
      </div>
    );
  }

  const isCloze = band === 'A' && part === 'part4';
  if (isCloze) {
    return (
      <div>
        {modeSwitcher}
        <ClozeSection examData={examData} markReading={markReading} />
      </div>
    );
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

  const cacheKey = `reading_${band}_${part}_q${q.id}`;

  return (
    <div>
      {modeSwitcher}
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

        {q.pageImage && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#f8f9fa', marginBottom: 14, textAlign: 'center' }}>
            <img
              src={`${import.meta.env.BASE_URL}${q.pageImage}`}
              alt={q.context ?? `Hình câu ${q.id}`}
              style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain', display: 'block', margin: '0 auto' }}
            />
          </div>
        )}

        {showPassage && q.passage && (
          <div className="passage-box">
            <div className="passage-label">{t('passage_label', lang)}</div>
            <HighlightableText
              text={q.passage}
              page_key={`reading_${band}_${part}_p${q.passageId ?? q.id}`}
            />
          </div>
        )}

        <div className="question-header">
          <span className="question-num">{qNumLabel}</span>
          {(q.question ?? q.sentence) && (
            <HighlightableText
              text={q.question ?? q.sentence ?? ''}
              page_key={`reading_${band}_${part}_q${q.id}`}
            />
          )}
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
                <HighlightableText
                  text={text}
                  page_key={`reading_${band}_${part}_q${q.id}_opt${key}`}
                />
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

        {/* AI Drawer */}
        <AIDrawer
          apiKey={apiKey}
          hasKey={hasKey}
          model={model}
          cacheKey={cacheKey}
          question={q.question}
          sentence={q.sentence}
          options={q.options}
          answer={q.answer}
          context={q.context}
          passage={q.passage}
          token={token}
        />

        {/* Navigation */}
        <div className="flex gap-8 mt-16">
          <button className="btn btn-outline" onClick={handlePrev} disabled={qIdx === 0}>
            {t('btn_prev', lang)}
          </button>
          {selected && !answered && (
            <button className="btn btn-outline" onClick={handleCheck}>
              {t('read_check', lang)}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleNext}
            disabled={qIdx === questions.length - 1}
          >
            {t('read_next_q', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Cloze section (Band A Part 4) ────────────────────────────────────────────
interface ClozeProps {
  examData:    ExamData;
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
