import React from 'react';
import type { Progress, Word } from '../../types';
import { IconBook, IconBookOpen, IconSave } from '../UI/Icons';

interface Props {
  progress: Progress;
  vocabulary: Word[];
  onReset: () => void;
}

export const ProgressModule: React.FC<Props> = ({ progress, vocabulary, onReset }) => {
  const totalVocab = vocabulary.length;
  const totalA     = vocabulary.filter(w => w.band === 'A').length;
  const totalB     = vocabulary.filter(w => w.band === 'B').length;
  const knownAll   = Object.values(progress.known).filter(Boolean).length;
  const knownA     = vocabulary.filter(w => w.band === 'A' && progress.known[w.hanzi]).length;
  const knownB     = vocabulary.filter(w => w.band === 'B' && progress.known[w.hanzi]).length;

  const readVals   = Object.values(progress.reading);
  const readTotal  = readVals.length;
  const readCorrect= readVals.filter(Boolean).length;
  const readPct    = readTotal > 0 ? Math.round(readCorrect / readTotal * 100) : 0;

  const examCt     = progress.exams.length;
  const bestExam   = progress.exams.reduce<number>((b, e) => Math.max(b, e.score / e.total * 100), 0);

  function confirmReset() {
    if (window.confirm('Xoá toàn bộ tiến độ? Hành động này không thể hoàn tác.')) onReset();
  }

  return (
    <div>
      {/* Summary */}
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-num">{knownAll}</div>
          <div className="stat-label">Từ đã thuộc<br /><span className="text-xs">{Math.round(knownAll / totalVocab * 100)}% tổng</span></div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{readPct}%</div>
          <div className="stat-label">Đọc hiểu<br /><span className="text-xs">{readCorrect}/{readTotal} câu đúng</span></div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{examCt}</div>
          <div className="stat-label">Bài thi<br /><span className="text-xs">{examCt > 0 ? `Cao nhất ${Math.round(bestExam)}%` : '—'}</span></div>
        </div>
      </div>

      {/* Vocabulary breakdown */}
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Tiến độ từ vựng</h2>

        <ProgressRow label={`Band A (${totalA} từ)`} done={knownA} total={totalA} />
        <div style={{ marginBottom: 14 }} />
        <ProgressRow label={`Band B (${totalB} từ)`} done={knownB} total={totalB} />

        {/* Level breakdown */}
        <div className="divider" />
        <h3 style={{ marginBottom: 10 }}>Theo cấp độ</h3>
        {(['A1','A2','B1','B2'] as const).map(lv => {
          const lvWords = vocabulary.filter(w => w.level === lv);
          const lvKnown = lvWords.filter(w => progress.known[w.hanzi]).length;
          return <ProgressRow key={lv} label={`${lv} (${lvWords.length} từ)`} done={lvKnown} total={lvWords.length} />;
        })}
      </div>

      {/* Exam history */}
      {progress.exams.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Lịch sử thi thử</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '5px 0' }}>Ngày</th>
                <th>Band</th>
                <th>Điểm</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {[...progress.exams].reverse().map((e, i) => {
                const pct = Math.round(e.score / e.total * 100);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '7px 0', color: 'var(--text-secondary)' }}>{e.date}</td>
                    <td><span className={`badge badge-${e.band}`}>Band {e.band}</span></td>
                    <td style={{ fontWeight: 600 }}>{e.score}/{e.total}</td>
                    <td style={{ fontWeight: 700, color: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div className="card">
        <h2 style={{ marginBottom: 10 }}>Thông tin hệ thống</h2>
        <p className="text-sm" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><IconBook size={13} /> Tổng từ vựng: <strong>{totalVocab.toLocaleString()}</strong> từ — Band A: {totalA}, Band B: {totalB}</p>
        <p className="text-sm" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><IconBookOpen size={13} /> Đề thi: Đề 1 Band A (phần 3–5) + Đề 1 Band B (phần 1–2)</p>
        <p className="text-sm" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}><IconSave size={13} /> Tiến độ lưu tự động trong trình duyệt (localStorage)</p>
        <div className="divider" />
        <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={confirmReset}>
          Xoá toàn bộ tiến độ
        </button>
      </div>
    </div>
  );
};

const ProgressRow: React.FC<{ label: string; done: number; total: number }> = ({ label, done, total }) => {
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="progress-row">
        <span className="text-sm">{label}</span>
        <span className="text-sm">{done} / {total} ({pct}%)</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
