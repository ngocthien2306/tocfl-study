import React, { useState, useCallback } from 'react';
import type { ExamData, AIReadingResult, AIVocabItem } from '../../types';
import { generateReadingFromExample } from '../AIGenerator/openai';
import { useLang } from '../../i18n/LangContext';
import { t } from '../../i18n/translations';
import { SpeakButton } from '../UI/SpeakButton';
import { useAuth } from '../../hooks/useAuth';
import { aiContentApi } from '../../api/client';
import { useApiKey } from '../../contexts/ApiKeyContext';
import { IconUnlock } from '../UI/Icons';

type Band = 'A' | 'B';
type PassageView = 'zh' | 'py' | 'vi';

/** Extract up to 2 example passages + questions from examData for the selected band */
function pickExamples(band: Band, examData: ExamData): { passage: string; questions: string } {
  try {
    if (band === 'B') {
      const p = examData.bandB.exam1.reading.part2.passages[0];
      const passText = p?.text ?? '';
      const qText = (p?.questions ?? []).slice(0, 3)
        .map(q => `Q: ${q.question ?? q.sentence ?? ''}\nA: ${q.options[q.answer] ?? ''} (${q.answer})`)
        .join('\n');
      return { passage: passText, questions: qText };
    } else {
      // Band A part5
      const p = examData.bandA.exam1.reading.part5.passages[0];
      const passText = p?.text ?? '';
      const qText = (p?.questions ?? []).slice(0, 3)
        .map(q => `Q: ${q.question ?? ''}\nA: ${q.options[q.answer] ?? ''} (${q.answer})`)
        .join('\n');
      return { passage: passText, questions: qText };
    }
  } catch {
    return { passage: '', questions: '' };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PassageDisplayProps {
  result: AIReadingResult;
  view: PassageView;
  setView: (v: PassageView) => void;
}

const PassageDisplay: React.FC<PassageDisplayProps> = ({ result, view, setView }) => {
  const { lang } = useLang();
  const text =
    view === 'zh' ? result.passage :
    view === 'py' ? result.passage_pinyin :
    result.passage_vietnamese;

  return (
    <div className="ai-passage-box">
      <div className="ai-passage-header">
        <span className="ai-passage-label">{t('ai_read_passage', lang)}</span>
        <div className="ai-view-pills" style={{ alignItems: 'center' }}>
          {view === 'zh' && <SpeakButton text={result.passage} size="sm" />}
          {(['zh', 'py', 'vi'] as PassageView[]).map(v => (
            <button
              key={v}
              className={`ai-view-pill${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'zh' ? t('ai_read_view_zh', lang)
               : v === 'py' ? t('ai_read_view_py', lang)
               : t('ai_read_view_vi', lang)}
            </button>
          ))}
        </div>
      </div>
      <p className={`ai-passage-text${view === 'py' ? ' pinyin' : ''}`}>{text}</p>
    </div>
  );
};

interface QuizPanelProps {
  result: AIReadingResult;
}

const QuizPanel: React.FC<QuizPanelProps> = ({ result }) => {
  const { lang } = useLang();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const check = (idx: number, key: string) => {
    setAnswers(a => ({ ...a, [idx]: key }));
    setChecked(c => ({ ...c, [idx]: true }));
  };

  return (
    <div className="ai-quiz-panel">
      <h4 className="ai-section-label">{t('ai_read_questions', lang)}</h4>
      {result.questions.map((q, i) => {
        const sel   = answers[i];
        const done  = checked[i];
        const right = sel === q.answer;
        return (
          <div key={i} className={`ai-q-card${done ? (right ? ' correct' : ' wrong') : ''}`}>
            <p className="ai-q-text"><span className="ai-q-num">{i + 1}.</span> {q.question}</p>
            <div className="ai-q-options">
              {(['A', 'B', 'C', 'D'] as const).map(k => {
                const opt = q.options[k];
                if (!opt) return null;
                let cls = 'ai-option-btn';
                if (done) {
                  if (k === q.answer) cls += ' option-correct';
                  else if (k === sel) cls += ' option-wrong';
                }
                return (
                  <button
                    key={k}
                    className={cls}
                    disabled={done}
                    onClick={() => check(i, k)}
                  >
                    <span className="option-key">{k}</span> {opt}
                  </button>
                );
              })}
            </div>
            {done && (
              <div className={`ai-feedback${right ? ' fb-correct' : ' fb-wrong'}`}>
                <span>{right ? t('ai_read_correct', lang) : `${t('ai_read_wrong', lang)} ${q.answer}`}</span>
                <details className="ai-explain">
                  <summary>{t('ai_read_explain', lang)}</summary>
                  <p>{q.explanation}</p>
                </details>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface VocabTableProps {
  vocab: AIVocabItem[];
}

const VocabTable: React.FC<VocabTableProps> = ({ vocab }) => {
  const { lang } = useLang();
  if (!vocab.length) return null;
  return (
    <div className="ai-vocab-panel">
      <h4 className="ai-section-label">{t('ai_read_vocab', lang)}</h4>
      <table className="ai-vocab-table">
        <thead>
          <tr>
            <th>詞</th>
            <th>Pinyin</th>
            <th>{lang === 'zh' ? '釋義' : lang === 'en' ? 'Meaning' : 'Nghĩa'}</th>
            <th>{lang === 'zh' ? '例句' : lang === 'en' ? 'Example' : 'Ví dụ'}</th>
          </tr>
        </thead>
        <tbody>
          {vocab.map((v, i) => (
            <tr key={i}>
              <td className="vocab-hanzi">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {v.word}
                  <SpeakButton text={v.word} size="sm" />
                </span>
              </td>
              <td className="vocab-pinyin">{v.pinyin}</td>
              <td>{v.meaning}</td>
              <td className="vocab-example">{v.example ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  examData: ExamData;
}

export const AIReadingGenerator: React.FC<Props> = ({ examData }) => {
  const { lang } = useLang();
  const { token, isLoggedIn } = useAuth();
  const { apiKey, hasKey } = useApiKey();

  const [band,      setBand     ] = useState<Band>('B');
  const [topic,     setTopic    ] = useState('');
  const [useExample,setUseExample] = useState(true);
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState('');
  const [result,    setResult   ] = useState<AIReadingResult | null>(null);
  const [view,      setView     ] = useState<PassageView>('zh');
  const [saving,    setSaving   ] = useState(false);
  const [saved,     setSaved    ] = useState(false);

  const generate = useCallback(async () => {
    if (!apiKey) { setError(t('ai_read_no_key', lang)); return; }
    setLoading(true);
    setError('');
    setResult(null);
    setSaved(false);

    const { passage: exPassage, questions: exQuestions } = useExample
      ? pickExamples(band, examData)
      : { passage: '', questions: '' };

    try {
      const res = await generateReadingFromExample({
        apiKey,
        band,
        topic,
        examplePassage: exPassage,
        exampleQuestions: exQuestions,
      });
      setResult(res);
      setView('zh');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiKey, band, topic, useExample, examData]);

  const saveToLibrary = async () => {
    if (!result || !token) return;
    setSaving(true);
    try {
      await aiContentApi.create(token, {
        type: 'reading',
        band,
        topic: result.topic,
        title: result.topic,
        note: `AI tạo từ bài thi Band ${band}`,
        content_json: JSON.stringify(result),
        vocab_used: (result.vocabulary ?? []).map(v => v.word),
      });
      setSaved(true);
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ai-reading-gen">
      {/* Header */}
      <div className="ai-rg-header">
        <h3 className="ai-rg-title">{t('ai_read_title', lang)}</h3>
        <p className="ai-rg-desc">{t('ai_read_desc', lang)}</p>
      </div>

      {/* Controls */}
      <div className="ai-rg-controls">
        {/* No key warning */}
        {!hasKey && (
          <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 12, fontSize: '.88rem', color: '#92400e' }}>
            <IconUnlock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
            Chưa có API key. Nhấn nút <strong>API Key</strong> ở góc trên phải để thiết lập.
          </div>
        )}

        {/* Band + Topic */}
        <div className="ai-rg-row">
          <div className="ai-field">
            <label className="ai-label">{t('ai_read_band', lang)}</label>
            <div className="band-pills">
              {(['A', 'B'] as Band[]).map(b => (
                <button
                  key={b}
                  className={`band-pill${band === b ? ' active' : ''}`}
                  onClick={() => setBand(b)}
                >
                  Band {b}
                </button>
              ))}
            </div>
          </div>
          <div className="ai-field ai-field--grow">
            <label className="ai-label">{t('ai_read_topic', lang)}</label>
            <input
              className="ai-input"
              placeholder={t('ai_read_topic_ph', lang)}
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
          </div>
        </div>

        {/* Use example toggle */}
        <label className="ai-toggle-row">
          <input
            type="checkbox"
            checked={useExample}
            onChange={e => setUseExample(e.target.checked)}
          />
          <span>{t('ai_read_use_example', lang)}</span>
          <span className="ai-toggle-tip">{t('ai_read_example_tip', lang)}</span>
        </label>

        {/* Generate button */}
        <button
          className="btn-primary ai-gen-btn"
          onClick={generate}
          disabled={loading || !hasKey}
        >
          {loading ? t('ai_read_generating', lang) : t('ai_read_generate', lang)}
        </button>

        {error && <p className="ai-error">{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="ai-rg-result">
          <div className="ai-result-topbar">
            <span className="ai-result-topic">{result.topic}</span>
            <div className="ai-result-actions">
              {isLoggedIn && (
                <button
                  className={`btn-outline btn-sm${saved ? ' btn-success' : ''}`}
                  onClick={saveToLibrary}
                  disabled={saving || saved}
                >
                  {saved ? t('ai_read_saved', lang) : saving ? '…' : t('ai_read_save', lang)}
                </button>
              )}
              <button className="btn-ghost btn-sm" onClick={() => setResult(null)}>
                {t('ai_read_new', lang)}
              </button>
            </div>
          </div>

          <PassageDisplay result={result} view={view} setView={setView} />
          <QuizPanel result={result} />
          {result.vocabulary && result.vocabulary.length > 0 && (
            <VocabTable vocab={result.vocabulary} />
          )}
        </div>
      )}
    </div>
  );
};
