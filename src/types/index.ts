// ─── Vocabulary ───────────────────────────────────────────────────────────────
export interface Word {
  hanzi: string;
  pinyin: string;
  level: string;       // A1 | A2 | B1 | B2
  pos: string;         // (N) (V) (Adv) …
  meaning: string;
  band: 'A' | 'B';
}

// ─── Exam / Questions ─────────────────────────────────────────────────────────
export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type Options = Partial<Record<OptionKey, string>>;

/** Single-answer multiple-choice question */
export interface MCQuestion {
  id: number;
  question?: string;
  sentence?: string;    // gap-fill variant
  options: Options;
  answer: OptionKey;
  explanation?: string;
  context?: string;
}

/** Cloze passage (Part 4 Band A) */
export interface ClozePassage {
  id: number;
  passage: string;
  passage_vi?: string;
  options: Record<string, string>;   // A-F
  blanks: number[];
  answers: Record<string, string>;
}

/** Reading passage with one or more questions */
export interface ReadingPassage {
  id: string | number;
  text: string;
  questions: MCQuestion[];
}

/** Gap-fill passage (Band B Part 1) */
export interface GapPassage {
  id: string | number;
  passage_raw: string;
  passage_vi?: string;
  questions: MCQuestion[];
}

// ─── Exam data shape ──────────────────────────────────────────────────────────
export interface ExamPart3 {
  title: string;
  instruction: string;
  image_dir?: string;
  groups: Array<{ context: string; page_image?: string; questions: MCQuestion[] }>;
}
export interface ExamPart4 {
  title: string;
  instruction: string;
  passages: ClozePassage[];
}
export interface ExamPart5 {
  title: string;
  instruction: string;
  passages: ReadingPassage[];
}
export interface ExamPart1B {
  title: string;
  instruction: string;
  passages: GapPassage[];
}
export interface ExamPart2B {
  title: string;
  instruction: string;
  passages: ReadingPassage[];
}

export interface BandAReading {
  part1?: ExamPart1A;
  part2?: ExamPart2A;
  part3: ExamPart3;
  part4: ExamPart4;
  part5: ExamPart5;
}
export interface BandBReading {
  part1: ExamPart1B;
  part2: ExamPart2B & { image_dir?: string; image_passages?: ImagePassage[] };
}

export type ExamKey = 'exam1' | 'exam2' | 'exam3';

export interface ExamData {
  bandA: Record<ExamKey, { title: string; reading: BandAReading }>;
  bandB: { exam1: { title: string; reading: BandBReading } };
}


// ─── Progress / storage ───────────────────────────────────────────────────────
export interface ExamRecord {
  band: 'A' | 'B';
  score: number;
  total: number;
  date: string;
}

export interface Progress {
  known: Record<string, boolean>;        // hanzi → known?
  reading: Record<string, boolean>;     // questionKey → correct?
  exams: ExamRecord[];
}

// ─── Detailed attempt records (for history + review) ──────────────────────────

/**
 * Snapshot of a single question as answered during an attempt.
 * Stored so the user can review wrong answers later.
 */
export interface AttemptQuestion {
  id:        number;
  part:      string;                           // 'part1', 'part2', …
  type:      string;                           // QuestionType or 'listening'
  question?: string;
  sentence?: string;
  options:   Partial<Record<OptionKey, string>>;
  answer:    OptionKey;                        // correct answer
  chosen:    OptionKey | null;                 // user's answer (null = skipped)
  context?:  string;                           // gap-fill context text
  passage?:  string;                           // reading passage excerpt
  pageImage?: string;                          // relative image path (if any)
}

/**
 * Full record of one completed exam / listening test attempt.
 * Saved in localStorage for later review.
 */
export interface ExamAttempt {
  id:            string;         // Date.now() string — unique per attempt
  module:        'exam' | 'listening';
  band:          'A' | 'B';
  examKey:       ExamKey;
  score:         number;
  total:         number;
  date:          string;         // ISO timestamp
  timeTakenSecs: number;         // seconds elapsed (EXAM_DURATION - timeLeft)
  questions:     AttemptQuestion[];
}

// ─── Image-based question types ───────────────────────────────────────────────
export type ImageQuestionType = 'image_choice' | 'picture_description' | 'image_material';

export interface ImageQuestion {
  id: number;
  sentence?: string;          // Part 1: the sentence stimulus
  text?: string;              // Part 2 / Band B: question text
  options: Options;
  answer: OptionKey;
  page_image: string;         // e.g. "page-04.png"
}

export interface ExamPart1A {
  title: string;
  instruction: string;
  type: 'image_choice';
  image_dir: string;
  questions: ImageQuestion[];
}

export interface ExamPart2A {
  title: string;
  instruction: string;
  type: 'picture_description';
  image_dir: string;
  questions: ImageQuestion[];
}

export interface ImagePassage {
  id: string;
  page_image: string;
  type: 'image_material';
  questions: ImageQuestion[];
}

// ─── Flat question for exam/practice ─────────────────────────────────────────
export type QuestionType = 'mc' | 'gap' | 'cloze' | 'image_choice' | 'picture_description' | 'image_material';

export interface FlatQuestion extends MCQuestion {
  type: QuestionType;
  part: string;
  passage?: string;
  passageId?: string | number;
  // Image-based fields
  pageImage?: string;   // full relative path e.g. "exam-images/band-a/exam1/page-04.png"
  sentence?: string;    // for Part 1 image_choice
  imageQuestionText?: string; // for Part 2 / image_material
}

// ─── Listening exam types ─────────────────────────────────────────────────────
export type ListeningPartType = 'image_choice' | 'text_choice';

export interface ListeningQuestion {
  id: number;
  audio: string[];          // 1+ MP3 paths (relative to public/)
  page_image?: string;      // for image_choice parts
  question?: string;        // optional spoken question text
  options: Partial<Record<OptionKey, string>>;
  answer: OptionKey;
}

export interface ListeningPart {
  id: string;
  type: ListeningPartType;
  title: string;
  instruction?: string;
  questions: ListeningQuestion[];
}

export interface ListeningExam {
  title: string;
  duration: number;         // seconds (3600 = 60 min)
  parts: ListeningPart[];
}

export interface ListeningData {
  bandA: Record<ExamKey, ListeningExam>;
  bandB: { exam1: ListeningExam };
}

// ─── AI Generator types ───────────────────────────────────────────────────────
export type AIContentType = 'sentences' | 'reading';

export interface AIKeyWord {
  word: string;
  pinyin: string;
  meaning: string;
}

export interface AISentence {
  chinese: string;
  pinyin: string;
  vietnamese: string;
  grammar_note: string;
  key_words: AIKeyWord[];
}

export interface AIQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface AIReading {
  passage: string;
  passage_pinyin: string;
  passage_vietnamese: string;
  questions: AIQuestion[];
}

export interface AISentenceResult {
  type: 'sentences';
  topic: string;
  band: string;
  sentences: AISentence[];
  createdAt: string;
}

export interface AIVocabItem {
  word: string;
  pinyin: string;
  meaning: string;
  example?: string;
}

export interface AIReadingResult {
  type: 'reading';
  topic: string;
  band: string;
  passage: string;
  passage_pinyin: string;
  passage_vietnamese: string;
  questions: AIQuestion[];
  vocabulary?: AIVocabItem[];
  createdAt: string;
}

export type AIResult = AISentenceResult | AIReadingResult;

// ─── Interview types ──────────────────────────────────────────────────────────

export interface InterviewDocument {
  id:            number;
  filename:      string;
  file_type:     'pdf' | 'docx' | 'txt';
  raw_text:      string | null;
  profile_json:  string | null;   // JSON string → InterviewProfile
  analysis_json: string | null;   // JSON string → InterviewAnalysis
  analyzed:      boolean;
  created_at:    string;
}

export interface InterviewProfile {
  name?:             string;
  current_role?:     string;
  years_experience?: number;
  skills:            string[];
  education:         string[];
  achievements:      string[];
  languages:         string[];
  doc_type:          'cv' | 'cover_letter' | 'portfolio' | 'other';
}

export interface InterviewAnalysis {
  strengths:     string[];
  gaps:          string[];
  ats_keywords:  string[];
  highlight:     string;   // câu chuyện/achievement nổi bật nhất
}

export type InterviewMode = 'mock' | 'coach';

export interface InterviewSession {
  id:         number;
  title:      string;
  job_title:  string | null;
  company:    string | null;
  mode:       InterviewMode;
  doc_ids:    number[];
  msg_count:  number;
  created_at: string;
  updated_at: string;
  messages?:  SessionMessage[];
}

export interface SessionMessage {
  id:            number;
  role:          'user' | 'assistant';
  content:       string;
  score:         number | null;
  feedback_json: string | null;   // JSON → MessageFeedback
  created_at:    string;
}

export interface MessageFeedback {
  situation: number;  // STAR scores 1-10
  task:      number;
  action:    number;
  result:    number;
  overall:   number;
  tips:      string[];
}
