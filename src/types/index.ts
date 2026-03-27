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
  groups: Array<{ context: string; questions: MCQuestion[] }>;
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
  part3: ExamPart3;
  part4: ExamPart4;
  part5: ExamPart5;
}
export interface BandBReading {
  part1: ExamPart1B;
  part2: ExamPart2B;
}

export interface ExamData {
  bandA: { exam1: { title: string; reading: BandAReading } };
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

// ─── Flat question for exam/practice ─────────────────────────────────────────
export type QuestionType = 'mc' | 'gap' | 'cloze';

export interface FlatQuestion extends MCQuestion {
  type: QuestionType;
  part: string;
  passage?: string;
  passageId?: string | number;
}
