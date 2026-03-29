import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  InterviewDocument, InterviewProfile, InterviewAnalysis,
  InterviewSession, SessionMessage, MessageFeedback,
} from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { interviewApi } from '../../api/client';
import { extractProfile, sendChatMessage } from './interviewAI';
import { useApiKey } from '../../contexts/ApiKeyContext';
import { useLang } from '../../i18n/LangContext';
import { T } from '../../i18n/translations';
import { TTSPlayer, SentenceBuffer } from '../../utils/tts';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import {
  IconFileText, IconSparkles, IconTrash, IconMic,
  IconStar, IconClipboard, IconMuscle, IconTool, IconGraduationCap,
  IconTrophy, IconLightbulb, IconUser, IconBuilding, IconLock,
  IconUnlock, IconUpload,
} from '../UI/Icons';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseProfile(doc: InterviewDocument): InterviewProfile | null {
  try { return doc.profile_json ? JSON.parse(doc.profile_json) : null; } catch { return null; }
}
function parseAnalysis(doc: InterviewDocument): InterviewAnalysis | null {
  try { return doc.analysis_json ? JSON.parse(doc.analysis_json) : null; } catch { return null; }
}
function parseFeedback(json: string | null): MessageFeedback | null {
  try { return json ? JSON.parse(json) : null; } catch { return null; }
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DocumentsPanel
// ═══════════════════════════════════════════════════════════════════════════════
interface DocsPanelProps {
  token: string;
  docs: InterviewDocument[];
  onDocsChange: (docs: InterviewDocument[]) => void;
  onViewProfile: (doc: InterviewDocument) => void;
}

const DocumentsPanel: React.FC<DocsPanelProps> = ({ token, docs, onDocsChange, onViewProfile }) => {
  const [uploading,   setUploading  ] = useState(false);
  const [analyzing,   setAnalyzing  ] = useState<number | null>(null);
  const [dragOver,    setDragOver   ] = useState(false);
  const { apiKey, hasKey } = useApiKey();
  const { lang } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: InterviewDocument[] = [];
      for (const file of Array.from(files)) {
        const doc = await interviewApi.uploadDocument(token, file);
        uploaded.push(doc);
      }
      onDocsChange([...uploaded, ...docs]);
    } catch (e) {
      alert(`${T.iv_err_upload[lang]}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async (doc: InterviewDocument) => {
    if (!hasKey) { alert(T.iv_err_no_key[lang]); return; }
    if (!doc.raw_text) { alert(T.iv_err_no_text[lang]); return; }
    setAnalyzing(doc.id);
    try {
      const { profile_json, analysis_json } = await extractProfile(apiKey, doc.raw_text);
      const updated = await interviewApi.saveAnalysis(token, doc.id, profile_json, analysis_json);
      onDocsChange(docs.map(d => d.id === doc.id ? updated : d));
    } catch (e) {
      alert(`${T.iv_err_analyze[lang]}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm('Xóa tài liệu này?')) return;
    await interviewApi.deleteDocument(token, docId);
    onDocsChange(docs.filter(d => d.id !== docId));
  };

  return (
    <div className="iv-docs-panel">
      {/* No key warning */}
      {!hasKey && (
        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 12, fontSize: '.88rem', color: '#92400e' }}>
          <IconUnlock size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} /> Chưa có API key. Nhấn nút <strong>API Key</strong> ở góc trên phải để thiết lập rồi phân tích tài liệu.
        </div>
      )}

      {/* Upload zone */}
      <div
        className={`iv-dropzone${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef} type="file" multiple hidden
          accept=".pdf,.docx,.doc,.txt"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading
          ? <><div className="iv-spinner" /><p>{T.iv_uploading[lang]}</p></>
          : <>
              <div className="iv-upload-icon"><IconUpload size={32} /></div>
              <p className="iv-upload-title">{T.iv_upload_title[lang]}</p>
              <p className="iv-upload-sub">{T.iv_upload_sub[lang]}</p>
            </>
        }
      </div>

      {/* Doc list */}
      {docs.length === 0 ? (
        <p className="iv-empty">{T.iv_no_docs[lang]}</p>
      ) : (
        <div className="iv-doc-list">
          {docs.map(doc => {
            const isAnalyzing = analyzing === doc.id;
            return (
              <div key={doc.id} className="iv-doc-card">
                <div className="iv-doc-icon"><IconFileText size={16} /></div>
                <div className="iv-doc-info">
                  <span className="iv-doc-name">{doc.filename}</span>
                  <span className="iv-doc-meta">{doc.file_type.toUpperCase()} · {fmtDate(doc.created_at)}</span>
                </div>
                <div className="iv-doc-actions">
                  {doc.analyzed ? (
                    <button className="iv-btn iv-btn--green" onClick={() => onViewProfile(doc)}>
                      ✓ {T.iv_highlights[lang]}
                    </button>
                  ) : (
                    <button
                      className="iv-btn iv-btn--primary"
                      onClick={() => handleAnalyze(doc)}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? <><span className="iv-spinner iv-spinner--sm" /> {T.iv_analyzing[lang]}</> : <><IconSparkles size={13} /> {T.iv_analyze[lang]}</>}
                    </button>
                  )}
                  <button className="iv-btn iv-btn--ghost" onClick={() => handleDelete(doc.id)}><IconTrash size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ProfileCard
// ═══════════════════════════════════════════════════════════════════════════════
interface ProfileCardProps {
  doc: InterviewDocument;
  onBack: () => void;
  onStartSession: (doc: InterviewDocument) => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ doc, onBack, onStartSession }) => {
  const profile  = parseProfile(doc);
  const analysis = parseAnalysis(doc);
  const [tab, setTab] = useState<'overview' | 'strengths' | 'gaps' | 'keywords'>('overview');
  const { lang } = useLang();

  if (!profile || !analysis) return (
    <div className="iv-profile-empty">
      <p>{T.iv_err_analyze[lang]}</p>
      <button className="iv-btn iv-btn--ghost" onClick={onBack}>{T.iv_back[lang]}</button>
    </div>
  );

  return (
    <div className="iv-profile-card">
      <div className="iv-profile-topbar">
        <button className="iv-btn iv-btn--ghost" onClick={onBack}>{T.iv_back_docs[lang]}</button>
        <button className="iv-btn iv-btn--primary" onClick={() => onStartSession(doc)}>
          <IconMic size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />{T.iv_start_session[lang]}
        </button>
      </div>

      {/* Hero */}
      <div className="iv-profile-hero">
        <div className="iv-profile-avatar">{(profile.name ?? 'U')[0].toUpperCase()}</div>
        <div>
          <h2 className="iv-profile-name">{profile.name ?? 'Ứng viên'}</h2>
          <p className="iv-profile-role">{profile.current_role ?? '—'}</p>
          <p className="iv-profile-meta">
            {profile.years_experience ? `${profile.years_experience} năm KN · ` : ''}
            {profile.languages?.join(' · ')}
          </p>
        </div>
      </div>

      {/* Highlight box */}
      {analysis.highlight && (
        <div className="iv-highlight-box">
          <span className="iv-highlight-label"><IconStar size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />{T.iv_highlights[lang]}</span>
          <p>{analysis.highlight}</p>
        </div>
      )}

      {/* Tab pills */}
      <div className="iv-profile-tabs">
        {(['overview', 'strengths', 'gaps', 'keywords'] as const).map(t => (
          <button
            key={t}
            className={`iv-tab-pill${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'overview' ? <><IconClipboard size={13} /> {T.iv_ai_review[lang]}</>
              : t === 'strengths' ? <><IconMuscle size={13} /> {T.iv_strengths[lang]}</>
              : t === 'gaps' ? <><IconTool size={13} /> {T.iv_improve[lang]}</>
              : <><IconStar size={13} /> ATS</>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="iv-profile-content">
        {tab === 'overview' && (
          <div className="iv-overview">
            {profile.skills?.length > 0 && (
              <div className="iv-section">
                <h4>{T.iv_skills[lang]}</h4>
                <div className="iv-tags">{profile.skills.map((s, i) => <span key={i} className="iv-tag">{s}</span>)}</div>
              </div>
            )}
            {profile.education?.length > 0 && (
              <div className="iv-section">
                <h4>{T.iv_education[lang]}</h4>
                {profile.education.map((e, i) => <p key={i} className="iv-list-item"><IconGraduationCap size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />{e}</p>)}
              </div>
            )}
            {profile.achievements?.length > 0 && (
              <div className="iv-section">
                <h4>{T.iv_experience[lang]}</h4>
                {profile.achievements.map((a, i) => <p key={i} className="iv-list-item"><IconTrophy size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />{a}</p>)}
              </div>
            )}
          </div>
        )}
        {tab === 'strengths' && (
          <div className="iv-section">
            {analysis.strengths?.map((s, i) => (
              <div key={i} className="iv-strength-item">
                <span className="iv-dot iv-dot--green" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'gaps' && (
          <div className="iv-section">
            {analysis.gaps?.map((g, i) => (
              <div key={i} className="iv-strength-item">
                <span className="iv-dot iv-dot--orange" />
                <span>{g}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'keywords' && (
          <div className="iv-section">
            <div className="iv-tags">
              {analysis.ats_keywords?.map((k, i) => <span key={i} className="iv-tag iv-tag--primary">{k}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// NewSessionModal
// ═══════════════════════════════════════════════════════════════════════════════
interface NewSessionModalProps {
  docs: InterviewDocument[];
  preselectedDoc?: InterviewDocument | null;
  onConfirm: (data: { title: string; job_title: string; company: string; mode: 'mock' | 'coach'; doc_ids: number[] }) => void;
  onCancel: () => void;
}

const NewSessionModal: React.FC<NewSessionModalProps> = ({ docs, preselectedDoc, onConfirm, onCancel }) => {
  const [title,     setTitle    ] = useState('Phiên phỏng vấn mới');
  const [jobTitle,  setJobTitle ] = useState('');
  const [company,   setCompany  ] = useState('');
  const [mode,      setMode     ] = useState<'mock' | 'coach'>('mock');
  const [selectedDocs, setSelectedDocs] = useState<number[]>(
    preselectedDoc ? [preselectedDoc.id] : []
  );
  const { lang } = useLang();

  const toggleDoc = (id: number) => setSelectedDocs(prev =>
    prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
  );

  return (
    <div className="iv-modal-overlay" onClick={onCancel}>
      <div className="iv-modal" onClick={e => e.stopPropagation()}>
        <h3 className="iv-modal-title"><IconMic size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />{T.iv_create_title[lang]}</h3>

        <div className="iv-form-field">
          <label>{T.iv_session_name[lang]}</label>
          <input className="iv-input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="iv-form-row">
          <div className="iv-form-field">
            <label>{T.iv_job_title[lang]}</label>
            <input className="iv-input" placeholder="Frontend Developer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
          </div>
          <div className="iv-form-field">
            <label>{T.iv_company[lang]}</label>
            <input className="iv-input" placeholder="Google, VNG, …" value={company} onChange={e => setCompany(e.target.value)} />
          </div>
        </div>

        <div className="iv-form-field">
          <label>{T.iv_mode[lang]}</label>
          <div className="iv-mode-pills">
            <button
              className={`iv-mode-pill${mode === 'mock' ? ' active' : ''}`}
              onClick={() => setMode('mock')}
            >
              <IconMic size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />{T.iv_mode_mock[lang]}
              <span className="iv-mode-desc">{T.iv_mode_mock_desc[lang]}</span>
            </button>
            <button
              className={`iv-mode-pill${mode === 'coach' ? ' active' : ''}`}
              onClick={() => setMode('coach')}
            >
              <IconLightbulb size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />{T.iv_mode_coach[lang]}
              <span className="iv-mode-desc">{T.iv_mode_coach_desc[lang]}</span>
            </button>
          </div>
        </div>

        {docs.length > 0 && (
          <div className="iv-form-field">
            <label>{T.iv_docs_attach[lang]}</label>
            <div className="iv-doc-checkboxes">
              {docs.map(doc => (
                <label key={doc.id} className="iv-doc-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                  />
                  <span>{doc.filename}</span>
                  {doc.analyzed && <span className="iv-analyzed-badge">✓</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="iv-modal-actions">
          <button className="iv-btn iv-btn--ghost" onClick={onCancel}>{T.iv_cancel[lang]}</button>
          <button
            className="iv-btn iv-btn--primary"
            onClick={() => onConfirm({ title, job_title: jobTitle, company, mode, doc_ids: selectedDocs })}
          >
            {T.iv_create_btn[lang]} →
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SessionChat
// ═══════════════════════════════════════════════════════════════════════════════
interface SessionChatProps {
  session: InterviewSession;
  docs: InterviewDocument[];
  token: string;
  onBack: () => void;
  onSessionUpdate: (s: InterviewSession) => void;
}

const SessionChat: React.FC<SessionChatProps> = ({ session, docs, token, onBack }) => {
  const [messages,         setMessages        ] = useState<SessionMessage[]>(session.messages ?? []);
  const [input,            setInput           ] = useState('');
  const [loading,          setLoading         ] = useState(false);
  const [started,          setStarted         ] = useState((session.messages ?? []).length > 0);
  // Streaming: text that is being received token-by-token (null = not streaming)
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  // Voice mode toggle
  const [voiceMode,        setVoiceMode       ] = useState(false);

  const { apiKey } = useApiKey();
  const { lang }   = useLang();
  const bottomRef  = useRef<HTMLDivElement>(null);

  // TTS: one TTSPlayer per AI response (stopped when next response starts)
  const ttsPlayerRef     = useRef<TTSPlayer | null>(null);
  const sentenceBufRef   = useRef<SentenceBuffer | null>(null);

  // Scroll to bottom whenever messages or streaming text changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Stop TTS when voice mode is turned off
  useEffect(() => {
    if (!voiceMode) ttsPlayerRef.current?.stop();
  }, [voiceMode]);

  // ── Sentence → TTS bridge ────────────────────────────────────────────────
  const handleSentence = useCallback((sentence: string) => {
    ttsPlayerRef.current?.speak(sentence);
  }, []);

  // ── Token callback for streaming + sentence buffering ────────────────────
  const onToken = useCallback((token: string) => {
    setStreamingContent(prev => (prev ?? '') + token);
    sentenceBufRef.current?.push(token);
  }, []);

  // ── Build profile context from attached docs ─────────────────────────────
  const buildProfile = useCallback(() => {
    const attachedDocs = docs.filter(d => session.doc_ids.includes(d.id) && d.analyzed);
    if (attachedDocs.length === 0) return '';
    return attachedDocs.map(d => {
      const p = parseProfile(d);
      const a = parseAnalysis(d);
      if (!p) return '';
      return `Hồ sơ từ ${d.filename}:
- Tên: ${p.name ?? 'N/A'} | Vị trí: ${p.current_role ?? 'N/A'} | ${p.years_experience} năm KN
- Skills: ${p.skills?.join(', ')}
- Thành tích: ${p.achievements?.slice(0, 3).join('; ')}
${a ? `- Điểm mạnh: ${a.strengths?.slice(0, 3).join(', ')}` : ''}`.trim();
    }).join('\n\n');
  }, [docs, session.doc_ids]);

  // ── Persist message to backend ───────────────────────────────────────────
  const saveMsg = useCallback(async (msg: {
    role: string; content: string; score?: number | null; feedback_json?: string | null;
  }) => {
    try { await interviewApi.addMessage(token, session.id, msg); } catch {/* silent */}
  }, [token, session.id]);

  // ── Core: call AI and stream response ───────────────────────────────────
  const streamReply = useCallback(async (
    history: { role: 'user' | 'assistant'; content: string }[],
    userContent: string,
    isStart = false,
  ) => {
    setLoading(true);
    setStreamingContent('');

    // Prepare TTS pipeline for this response
    ttsPlayerRef.current?.stop();
    if (voiceMode && apiKey) {
      ttsPlayerRef.current  = new TTSPlayer(apiKey, 'nova');
      sentenceBufRef.current = new SentenceBuffer(handleSentence);
    } else {
      ttsPlayerRef.current   = null;
      sentenceBufRef.current = null;
    }

    try {
      const resp = await sendChatMessage({
        apiKey,
        mode:     session.mode,
        jobTitle: session.job_title ?? '',
        company:  session.company  ?? '',
        profile:  buildProfile(),
        history,
        userMsg:  userContent,
        onToken,
      });

      // Flush any remaining buffered text to TTS
      sentenceBufRef.current?.flush();

      const aiMsg: SessionMessage = {
        id: Date.now() + (isStart ? 0 : 1),
        role: 'assistant',
        content: resp.content,
        score: resp.score ?? null,
        feedback_json: resp.feedback_json ?? null,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => isStart ? [aiMsg] : [...prev, aiMsg]);
      setStreamingContent(null);
      saveMsg({ role: 'assistant', content: resp.content, score: resp.score, feedback_json: resp.feedback_json });
    } catch (e) {
      alert(`Lỗi: ${e instanceof Error ? e.message : e}`);
      if (isStart) setStarted(false);
      setStreamingContent(null);
    } finally {
      setLoading(false);
    }
  }, [apiKey, session, buildProfile, onToken, handleSentence, voiceMode, saveMsg]);

  // ── Start the session (first AI message) ────────────────────────────────
  const start = useCallback(async () => {
    if (!apiKey) { alert(T.iv_err_no_key[lang]); return; }
    setStarted(true);
    await streamReply([], 'Bắt đầu phiên phỏng vấn.', true);
  }, [apiKey, lang, streamReply]);

  // ── Send user message (text or voice) ───────────────────────────────────
  const sendText = useCallback(async (userContent: string) => {
    if (!userContent.trim() || loading) return;
    setInput('');

    const userMsg: SessionMessage = {
      id: Date.now(), role: 'user', content: userContent,
      score: null, feedback_json: null, created_at: new Date().toISOString(),
    };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    saveMsg({ role: 'user', content: userContent });

    const history = newMsgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    await streamReply(history.slice(0, -1), userContent, false);
  }, [loading, messages, saveMsg, streamReply]);

  const send = useCallback(() => sendText(input), [input, sendText]);

  // ── Speech recognition ───────────────────────────────────────────────────
  const sttLang = lang === 'zh' ? 'zh-TW' : lang === 'en' ? 'en-US' : 'vi-VN';
  const { isListening, interimText, start: startRecording, stop: stopRecording, supported: sttSupported } =
    useSpeechRecognition({
      lang: sttLang,
      onResult: (text) => {
        // Auto-send the voice transcript
        sendText(text);
      },
    });

  const handleMicClick = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const AssistantAvatar = () => (
    session.mode === 'mock' ? <IconBuilding size={16} /> : <IconLightbulb size={16} />
  );

  return (
    <div className="iv-chat">
      {/* ── Header ── */}
      <div className="iv-chat-header">
        <button className="iv-btn iv-btn--ghost" onClick={onBack}>{T.iv_chat_back[lang]}</button>
        <div className="iv-chat-title">
          <span>{session.title}</span>
          <div className="iv-chat-meta">
            <span className={`iv-mode-badge iv-mode-badge--${session.mode}`}>
              {session.mode === 'mock' ? <><IconMic size={12} /> Mock</> : <><IconLightbulb size={12} /> Coach</>}
            </span>
            {session.job_title && <span className="iv-chat-job">{session.job_title}</span>}
            {session.company   && <span className="iv-chat-company">@ {session.company}</span>}
          </div>
        </div>
        {/* Voice mode toggle */}
        {started && (
          <button
            className={`iv-voice-toggle${voiceMode ? ' active' : ''}`}
            onClick={() => setVoiceMode(v => !v)}
            title={voiceMode ? 'Tắt chế độ giọng nói' : 'Bật chế độ giọng nói (Mic + TTS)'}
          >
            {voiceMode ? '🔊 Voice ON' : '🔇 Voice OFF'}
          </button>
        )}
        {session.doc_ids.length > 0 && (
          <div className="iv-chat-docs">
            {session.doc_ids.map(id => {
              const d = docs.find(x => x.id === id);
              return d ? <span key={id} className="iv-chat-doc-chip">{d.filename}</span> : null;
            })}
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="iv-chat-messages">
        {!started ? (
          /* Start screen */
          <div className="iv-chat-start">
            <div className="iv-chat-start-icon">
              {session.mode === 'mock' ? <IconMic size={32} /> : <IconLightbulb size={32} />}
            </div>
            <h3>{session.mode === 'mock' ? T.iv_ready_mock[lang] : T.iv_ready_coach[lang]}</h3>
            <p style={{ marginBottom: 8 }}>
              {session.mode === 'mock'
                ? 'AI sẽ đóng vai nhà tuyển dụng và hỏi các câu hỏi phỏng vấn thực tế.'
                : 'Nhập câu hỏi phỏng vấn bạn muốn luyện, AI sẽ giúp bạn trả lời tốt hơn.'}
            </p>
            {/* Voice mode option on start screen */}
            <label className="iv-voice-option">
              <input
                type="checkbox"
                checked={voiceMode}
                onChange={e => setVoiceMode(e.target.checked)}
              />
              <span>🎤 Bật Voice Mode (mic nói + AI đọc to)</span>
            </label>
            <button className="iv-btn iv-btn--primary iv-btn--lg" onClick={start} disabled={loading} style={{ marginTop: 16 }}>
              {loading ? '…' : T.iv_start_btn[lang]}
            </button>
          </div>
        ) : (
          /* Message list */
          messages.map((msg, i) => (
            <div key={i} className={`iv-msg iv-msg--${msg.role}`}>
              <div className="iv-msg-avatar">
                {msg.role === 'user' ? <IconUser size={16} /> : <AssistantAvatar />}
              </div>
              <div className="iv-msg-body">
                <p className="iv-msg-content">{msg.content}</p>
                {/* STAR score + feedback */}
                {msg.role === 'assistant' && msg.score != null && (
                  <div className="iv-star-score">
                    <span className="iv-score-badge">
                      <IconStar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {msg.score.toFixed(1)} / 10
                    </span>
                    {parseFeedback(msg.feedback_json) && (
                      <details className="iv-feedback-details">
                        <summary>{T.iv_star_detail[lang]}</summary>
                        {(() => {
                          const fb = parseFeedback(msg.feedback_json)!;
                          return (
                            <div className="iv-feedback-body">
                              <div className="iv-star-bars">
                                {(['situation', 'task', 'action', 'result'] as const).map(k => (
                                  <div key={k} className="iv-star-bar">
                                    <span className="iv-star-label">{k.toUpperCase()}</span>
                                    <div className="iv-bar-track">
                                      <div className="iv-bar-fill" style={{ width: `${fb[k] * 10}%` }} />
                                    </div>
                                    <span className="iv-star-val">{fb[k]}</span>
                                  </div>
                                ))}
                              </div>
                              {fb.tips?.length > 0 && (
                                <ul className="iv-tips">
                                  {fb.tips.map((tip, j) => (
                                    <li key={j}>
                                      <IconLightbulb size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })()}
                      </details>
                    )}
                  </div>
                )}
                <span className="iv-msg-time">{fmtTime(msg.created_at)}</span>
              </div>
            </div>
          ))
        )}

        {/* ── Streaming bubble (replaces typing indicator) ── */}
        {streamingContent !== null && (
          <div className="iv-msg iv-msg--assistant iv-msg--streaming">
            <div className="iv-msg-avatar"><AssistantAvatar /></div>
            <div className="iv-msg-body">
              <p className="iv-msg-content">
                {streamingContent || <span className="iv-typing-dots"><span/><span/><span/></span>}
              </p>
              {voiceMode && (
                <span className="iv-voice-speaking">
                  🔊 <span className="iv-voice-bars"><span/><span/><span/><span/></span>
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      {started && (
        <div className="iv-chat-input-bar">
          {/* Voice interim transcript indicator */}
          {isListening && (
            <div className="iv-voice-listening">
              <span className="iv-mic-pulse" />
              <span className="iv-voice-interim-text">
                {interimText || 'Đang nghe…'}
              </span>
            </div>
          )}

          <div className="iv-input-row">
            <textarea
              className="iv-chat-input"
              placeholder={isListening ? 'Đang ghi âm…' : T.iv_chat_ph[lang]}
              value={isListening ? interimText : input}
              rows={2}
              disabled={isListening}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />

            {/* Mic button (only if STT is supported) */}
            {sttSupported && (
              <button
                className={`iv-mic-btn${isListening ? ' iv-mic-btn--recording' : ''}${!voiceMode ? ' iv-mic-btn--off' : ''}`}
                onClick={() => { setVoiceMode(true); handleMicClick(); }}
                disabled={loading}
                title={isListening ? 'Dừng ghi âm' : 'Nhấn để nói (Voice Input)'}
              >
                {isListening ? '⏹' : '🎤'}
              </button>
            )}

            {/* Send button */}
            <button
              className="iv-send-btn"
              onClick={send}
              disabled={loading || isListening || !input.trim()}
            >
              {loading ? '…' : '➤'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SessionsPanel
// ═══════════════════════════════════════════════════════════════════════════════
interface SessionsPanelProps {
  token: string;
  docs:  InterviewDocument[];
  preselectedDoc?: InterviewDocument | null;
  onClearPreselected: () => void;
}

const SessionsPanel: React.FC<SessionsPanelProps> = ({ token, docs, preselectedDoc, onClearPreselected }) => {
  const [sessions,  setSessions ] = useState<InterviewSession[]>([]);
  const [loading,   setLoading  ] = useState(true);
  const [showModal, setShowModal] = useState(!!preselectedDoc);
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    interviewApi.listSessions(token)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (preselectedDoc) setShowModal(true);
  }, [preselectedDoc]);

  const { lang } = useLang();

  const createSession = async (data: { title: string; job_title: string; company: string; mode: 'mock' | 'coach'; doc_ids: number[] }) => {
    setShowModal(false);
    onClearPreselected();
    try {
      const s = await interviewApi.createSession(token, data);
      setSessions(prev => [s, ...prev]);
      setActiveSession(s);
    } catch (e) {
      alert(`${T.iv_err_create[lang]}: ${e instanceof Error ? e.message : e}`);
    }
  };

  const openSession = async (id: number) => {
    try {
      const s = await interviewApi.getSession(token, id);
      setActiveSession(s);
    } catch (e) {
      alert(`${T.iv_err_send[lang]}: ${e instanceof Error ? e.message : e}`);
    }
  };

  const deleteSession = async (id: number) => {
    if (!confirm('Xóa phiên này?')) return;
    await interviewApi.deleteSession(token, id);
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  if (activeSession) {
    return (
      <SessionChat
        session={activeSession}
        docs={docs}
        token={token}
        onBack={() => setActiveSession(null)}
        onSessionUpdate={s => { setSessions(prev => prev.map(x => x.id === s.id ? s : x)); setActiveSession(s); }}
      />
    );
  }

  return (
    <div className="iv-sessions-panel">
      <div className="iv-sessions-header">
        <h3 className="iv-sessions-title">{T.iv_history[lang]}</h3>
        <button className="iv-btn iv-btn--primary" onClick={() => setShowModal(true)}>
          {T.iv_new_session[lang]}
        </button>
      </div>

      {loading ? (
        <div className="iv-loading"><div className="iv-spinner" /><p>{T.iv_loading[lang]}</p></div>
      ) : sessions.length === 0 ? (
        <div className="iv-empty-sessions">
          <div className="iv-empty-icon"><IconMic size={48} style={{ opacity: .3 }} /></div>
          <p>{T.iv_no_sessions[lang]}</p>
          <button className="iv-btn iv-btn--primary" onClick={() => setShowModal(true)}>
            {T.iv_first_session[lang]}
          </button>
        </div>
      ) : (
        <div className="iv-session-list">
          {sessions.map(s => (
            <div key={s.id} className="iv-session-card" onClick={() => openSession(s.id)}>
              <div className={`iv-session-mode-bar iv-session-mode-bar--${s.mode}`} />
              <div className="iv-session-info">
                <span className="iv-session-title">{s.title}</span>
                <div className="iv-session-meta">
                  <span className={`iv-mode-badge iv-mode-badge--${s.mode}`}>
                    {s.mode === 'mock' ? <><IconMic size={12} /> Mock</> : <><IconLightbulb size={12} /> Coach</>}
                  </span>
                  {s.job_title && <span>{s.job_title}</span>}
                  {s.company   && <span>@ {s.company}</span>}
                </div>
                <span className="iv-session-date">{fmtDate(s.updated_at)} · {s.msg_count} {T.iv_messages[lang]}</span>
              </div>
              <button
                className="iv-btn iv-btn--ghost iv-session-del"
                onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
              ><IconTrash size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NewSessionModal
          docs={docs}
          preselectedDoc={preselectedDoc}
          onConfirm={createSession}
          onCancel={() => { setShowModal(false); onClearPreselected(); }}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// InterviewModule — main container
// ═══════════════════════════════════════════════════════════════════════════════
export const InterviewModule: React.FC = () => {
  const { token, isLoggedIn } = useAuth();
  const { lang } = useLang();
  const [tab,            setTab           ] = useState<'docs' | 'sessions'>('docs');
  const [docs,           setDocs          ] = useState<InterviewDocument[]>([]);
  const [profileDoc,     setProfileDoc    ] = useState<InterviewDocument | null>(null);
  const [sessionFromDoc, setSessionFromDoc] = useState<InterviewDocument | null>(null);
  const [loadingDocs,    setLoadingDocs   ] = useState(true);

  useEffect(() => {
    if (!token) return;
    interviewApi.listDocuments(token)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoadingDocs(false));
  }, [token]);

  if (!isLoggedIn) {
    return (
      <div className="iv-auth-wall">
        <div className="iv-auth-icon"><IconLock size={40} /></div>
        <h3>{T.iv_auth_title[lang]}</h3>
        <p>{T.iv_auth_desc[lang]}</p>
      </div>
    );
  }

  // Viewing a specific profile card
  if (profileDoc) {
    return (
      <ProfileCard
        doc={profileDoc}
        onBack={() => setProfileDoc(null)}
        onStartSession={doc => {
          setProfileDoc(null);
          setSessionFromDoc(doc);
          setTab('sessions');
        }}
      />
    );
  }

  return (
    <div className="iv-module">
      {/* Tab switcher */}
      <div className="iv-tab-bar">
        <button
          className={`iv-tab${tab === 'docs' ? ' active' : ''}`}
          onClick={() => setTab('docs')}
        >
          <IconFileText size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />{T.iv_docs_tab[lang]}
          {docs.length > 0 && <span className="iv-tab-badge">{docs.length}</span>}
        </button>
        <button
          className={`iv-tab${tab === 'sessions' ? ' active' : ''}`}
          onClick={() => setTab('sessions')}
        >
          <IconMic size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />{T.iv_sessions_tab[lang]}
        </button>
      </div>

      {tab === 'docs' ? (
        loadingDocs ? (
          <div className="iv-loading"><div className="iv-spinner" /><p>{T.iv_loading[lang]}</p></div>
        ) : (
          <DocumentsPanel
            token={token!}
            docs={docs}
            onDocsChange={setDocs}
            onViewProfile={setProfileDoc}
          />
        )
      ) : (
        <SessionsPanel
          token={token!}
          docs={docs}
          preselectedDoc={sessionFromDoc}
          onClearPreselected={() => setSessionFromDoc(null)}
        />
      )}
    </div>
  );
};
