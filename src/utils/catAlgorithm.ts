/**
 * TOCFL CAT (Computer Adaptive Testing) Algorithm
 *
 * Model: Rasch 1PL (Item Response Theory)
 *   P(correct | θ, b) = 1 / (1 + exp(-(θ - b)))
 *
 * Theta update: Newton-Raphson MLE step, modulated by response time
 *   - Fast correct  → larger positive update  (confident knowledge)
 *   - Slow correct  → smaller positive update (struggled but got it)
 *   - Fast wrong    → smaller penalty         (likely careless)
 *   - Slow wrong    → larger penalty          (genuinely doesn't know)
 *
 * Score: Linear transform θ → TOCFL 2025 scale (~200–800)
 *   scale_score = 430 + 90 × θ
 *   Calibrated so θ ≈ -0.83 → 355 (A1 min), θ ≈ 0.22 → 450 (A2 min)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CATItem {
  uid:        string;          // `${examKey}_p${part}_q${id}`
  id:         number;
  examKey:    string;
  part:       'part1' | 'part2' | 'part3' | 'part4' | 'part5';
  difficulty: number;          // IRT b parameter (1.0 – 5.5)
  type:       'image_choice' | 'picture_description' | 'gap' | 'cloze' | 'mc' | 'image_material';

  // Question content (varies by type)
  sentence?:    string;        // part1 gap sentence
  question?:    string;        // part4/5 question
  passage?:     string;        // part4/5 passage text
  passageLabel?: string | number;
  passageVi?:   string;        // Vietnamese context (Band B/C gap-fill, passage_vi)
  context?:     string;        // part3 image description
  options:      Record<string, string>;
  answer:       string;

  // Image (part1/2/3)
  pageImage?:   string;        // e.g. "exam-images/band-a/exam1/page-04.png"
  imageDir?:    string;

  // Listening-specific
  isListening?: boolean;
  audio?:       string[];      // MP3 paths relative to public/
}

export interface CATResponse {
  uid:              string;
  difficulty:       number;
  correct:          boolean;
  chosen:           string;    // The answer key the user selected
  responseTimeSecs: number;
  thetaBefore:      number;
  thetaAfter:       number;
}

// ─── IRT core ─────────────────────────────────────────────────────────────────

/** Rasch probability of correct response */
export function pCorrect(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)));
}

/**
 * Expected response time (seconds) for a question.
 * For listening, time is longer to account for audio playback.
 */
export function expectedTimeSecs(b: number, isListening?: boolean): number {
  if (isListening) {
    // Listening: includes audio duration estimate
    if (b < 2.0) return 35;   // Part 1 (~10s audio + decision)
    if (b < 3.0) return 45;   // Part 2 (~20s audio)
    if (b < 4.0) return 55;   // Part 3 (~30s audio)
    return 50;                 // Part 4 (text options, medium audio)
  }
  // Reading: Part 1 (b≈1): ~15s, Part 3 (b≈3): ~25s, Part 5 (b≈5): ~40s
  return Math.round(10 + 6 * b);
}

/**
 * Time-weighted theta update (Newton-Raphson MLE with time modulation)
 *
 * timeWeight:
 *   correct + fast  → 1.20  (confident, boost harder)
 *   correct + norm  → 1.00
 *   correct + slow  → 0.75  (uncertain, smaller boost)
 *   wrong  + fast   → 0.65  (careless, smaller penalty)
 *   wrong  + norm   → 1.00
 *   wrong  + slow   → 1.20  (genuinely stuck, larger penalty)
 */
export function updateTheta(
  theta:            number,
  b:                number,
  correct:          boolean,
  responseTimeSecs: number,
  questionCount:    number,   // 1-based index of question just answered
  isListening?:     boolean,
): number {
  const expTime = expectedTimeSecs(b, isListening);
  // ratio > 1 means slower than expected
  const ratio = responseTimeSecs / Math.max(1, expTime);

  let timeWeight: number;
  if (correct) {
    if      (ratio < 0.5)  timeWeight = 1.25;  // very fast correct
    else if (ratio < 1.0)  timeWeight = 1.05;  // normal-fast correct
    else if (ratio < 2.0)  timeWeight = 0.85;  // slow correct
    else                   timeWeight = 0.70;  // very slow correct
  } else {
    if      (ratio < 0.4)  timeWeight = 0.60;  // very fast wrong (guessing)
    else if (ratio < 0.9)  timeWeight = 0.85;  // fast wrong
    else if (ratio < 2.0)  timeWeight = 1.00;  // normal wrong
    else                   timeWeight = 1.25;  // very slow wrong
  }

  const p    = pCorrect(theta, b);
  // Step shrinks as test progresses but stays aggressive enough to cross difficulty bands
  const step = Math.max(0.30, 1.2 / Math.sqrt(questionCount));

  const delta = correct
    ? step * timeWeight * (1 - p)   // positive update: scale by (1-p) — bigger when θ < b
    : -step * timeWeight * p;       // negative update: scale by p   — bigger when θ > b

  return Math.max(-4.0, Math.min(4.0, theta + delta));
}

// ─── Score / Level conversion ──────────────────────────────────────────────────

/** θ → TOCFL 2025 scale score (200–800) */
export function thetaToScore(theta: number): number {
  return Math.round(Math.max(200, Math.min(800, 430 + 90 * theta)));
}

export interface TOCFLLevel {
  level:    number;   // 0 = below A1, 1-6 = TOCFL levels
  name:     string;   // 繁體中文
  viName:   string;   // Tiếng Việt
  enName:   string;   // English
  cefr:     string;   // A1, A2, B1, B2, C1, C2
  color:    string;
  minScore: number;   // reading cut-off
}

export const TOCFL_LEVELS: TOCFLLevel[] = [
  { level: 0, name: '未達標',  viName: 'Chưa đạt',   enName: 'Below A1',    cefr: '—',  color: '#6B7280', minScore: 0   },
  { level: 1, name: '入門級',  viName: 'Sơ cấp 1',   enName: 'Elementary',  cefr: 'A1', color: '#10B981', minScore: 355 },
  { level: 2, name: '基礎級',  viName: 'Sơ cấp 2',   enName: 'Basic',       cefr: 'A2', color: '#3B82F6', minScore: 450 },
  { level: 3, name: '進階級',  viName: 'Trung cấp 1', enName: 'Intermediate',cefr: 'B1', color: '#8B5CF6', minScore: 490 },
  { level: 4, name: '高階級',  viName: 'Trung cấp 2', enName: 'Upper-Inter', cefr: 'B2', color: '#F59E0B', minScore: 570 },
  { level: 5, name: '流利級',  viName: 'Cao cấp 1',  enName: 'Advanced',    cefr: 'C1', color: '#EF4444', minScore: 610 },
  { level: 6, name: '精通級',  viName: 'Cao cấp 2',  enName: 'Mastery',     cefr: 'C2', color: '#EC4899', minScore: 690 },
];

export function scoreToLevel(score: number): TOCFLLevel {
  for (let i = TOCFL_LEVELS.length - 1; i >= 1; i--) {
    if (score >= TOCFL_LEVELS[i].minScore) return TOCFL_LEVELS[i];
  }
  return TOCFL_LEVELS[0];
}

/** θ mapped directly to nearest level (for live display during test) */
export function thetaToLevel(theta: number): TOCFLLevel {
  return scoreToLevel(thetaToScore(theta));
}

// ─── Question selection ────────────────────────────────────────────────────────

/**
 * Select next question:
 * - Target difficulty = theta + bias based on last answer
 *   correct  → bias +0.5 (push harder immediately)
 *   wrong    → bias -0.5 (drop easier immediately)
 *   unknown  → no bias (first question)
 * - Tiny jitter (0.08) to avoid always picking same question
 * - Prefer variety across examKeys
 */
export function selectNextQuestion(
  pool:         CATItem[],
  theta:        number,
  usedUids:     Set<string>,
  lastExamKey?: string,
  lastCorrect?: boolean,
): CATItem | null {
  const available = pool.filter(q => !usedUids.has(q.uid));
  if (available.length === 0) return null;

  // Bias target difficulty based on last response
  const bias   = lastCorrect === true ? 0.5 : lastCorrect === false ? -0.5 : 0;
  const target = theta + bias;

  const scored = available.map(q => {
    let dist = Math.abs(q.difficulty - target);
    if (q.examKey === lastExamKey) dist += 0.08; // small variety nudge
    dist += Math.random() * 0.08;               // tiny jitter
    return { q, dist };
  });

  scored.sort((a, b) => a.dist - b.dist);
  return scored[0].q;
}

// ─── Pool builders ────────────────────────────────────────────────────────────

import type { ExamData, ListeningData } from '../types';

/**
 * Build the full CAT item pool from exam_data.json (Band A + B + C).
 *
 * Difficulty assignment (b parameter, same scale as θ):
 *   Band A Part 1  : 1.0 – 1.8  (image choice, A1)
 *   Band A Part 2  : 2.0 – 2.8  (picture description, A1-A2)
 *   Band A Part 3  : 3.0 – 3.8  (gap fill with context, A2)
 *   Band A Part 4  : 4.0 – 4.6  (cloze passage, A2-B1)
 *   Band A Part 5  : 4.8 – 5.4  (reading comprehension, B1)
 *   Band B Part 1  : 4.5 – 5.3  (gap-fill passages, B1-B2)
 *   Band B Part 2  : 5.0 – 5.8  (reading + image material, B2)
 *   Band C Part 1  : 5.5 – 6.3  (gap-fill passages, C1)
 *   Band C Part 2  : 6.0 – 7.0  (complex reading, C1-C2)
 */
export function buildCATPool(examData: ExamData): CATItem[] {
  const pool: CATItem[] = [];

  // ── Band A ────────────────────────────────────────────────────────────────
  const examKeysA = Object.keys(examData.bandA) as Array<keyof typeof examData.bandA>;
  for (const examKey of examKeysA) {
    const exam = examData.bandA[examKey];
    if (!exam) continue;
    const r = exam.reading;

    // Part 1: image choice
    if (r.part1) {
      const total = r.part1.questions.length;
      r.part1.questions.forEach((q, idx) => {
        const b = 1.0 + (idx / Math.max(1, total - 1)) * 0.8;
        pool.push({
          uid:       `A_${examKey}_p1_q${q.id}`,
          id:        q.id,
          examKey:   `A_${examKey}`,
          part:      'part1',
          difficulty: +b.toFixed(2),
          type:      'image_choice',
          sentence:  q.sentence,
          options:   { A: '(A)', B: '(B)', C: '(C)' },
          answer:    q.answer,
          pageImage: `${r.part1!.image_dir}/${q.page_image}`,
        });
      });
    }

    // Part 2: picture description
    if (r.part2) {
      const total = r.part2.questions.length;
      r.part2.questions.forEach((q, idx) => {
        const b = 2.0 + (idx / Math.max(1, total - 1)) * 0.8;
        pool.push({
          uid:       `A_${examKey}_p2_q${q.id}`,
          id:        q.id,
          examKey:   `A_${examKey}`,
          part:      'part2',
          difficulty: +b.toFixed(2),
          type:      'picture_description',
          options:   q.options as Record<string, string>,
          answer:    q.answer,
          pageImage: `${r.part2!.image_dir}/${q.page_image}`,
        });
      });
    }

    // Part 3: gap fill
    let p3idx = 0;
    const p3total = r.part3.groups.reduce((s, g) => s + g.questions.length, 0);
    r.part3.groups.forEach(g => {
      g.questions.forEach(q => {
        const b = 3.0 + (p3idx / Math.max(1, p3total - 1)) * 0.8;
        pool.push({
          uid:       `A_${examKey}_p3_q${q.id}`,
          id:        q.id,
          examKey:   `A_${examKey}`,
          part:      'part3',
          difficulty: +b.toFixed(2),
          type:      'gap',
          sentence:  q.sentence,
          context:   g.context,
          options:   q.options as Record<string, string>,
          answer:    q.answer,
          pageImage: g.page_image && r.part3.image_dir
            ? `${r.part3.image_dir}/${g.page_image}`
            : undefined,
        });
        p3idx++;
      });
    });

    // Part 4: cloze
    let p4idx = 0;
    const p4total = r.part4.passages.reduce((s, p) => s + p.blanks.length, 0);
    r.part4.passages.forEach(passage => {
      passage.blanks.forEach(blankId => {
        const b = 4.0 + (p4idx / Math.max(1, p4total - 1)) * 0.6;
        pool.push({
          uid:       `A_${examKey}_p4_q${blankId}`,
          id:        blankId,
          examKey:   `A_${examKey}`,
          part:      'part4',
          difficulty: +b.toFixed(2),
          type:      'cloze',
          passage:   passage.passage,
          question:  `填入空格 (${blankId})`,
          options:   passage.options as Record<string, string>,
          answer:    passage.answers[String(blankId)],
        });
        p4idx++;
      });
    });

    // Part 5: reading comprehension
    let p5idx = 0;
    const p5total = r.part5.passages.reduce((s, p) => s + p.questions.length, 0);
    r.part5.passages.forEach(passage => {
      passage.questions.forEach(q => {
        const b = 4.8 + (p5idx / Math.max(1, p5total - 1)) * 0.6;
        pool.push({
          uid:          `A_${examKey}_p5_q${q.id}`,
          id:           q.id,
          examKey:      `A_${examKey}`,
          part:         'part5',
          difficulty:   +b.toFixed(2),
          type:         'mc',
          passage:      passage.text,
          passageLabel: passage.id,
          question:     q.question,
          options:      q.options as Record<string, string>,
          answer:       q.answer,
        });
        p5idx++;
      });
    });
  }

  // ── Band B ────────────────────────────────────────────────────────────────
  const examKeysB = Object.keys(examData.bandB) as Array<keyof typeof examData.bandB>;
  for (const examKey of examKeysB) {
    const exam = examData.bandB[examKey];
    if (!exam) continue;
    const r = exam.reading;
    const ek = `B_${examKey}`;

    // Part 1: gap-fill passages (B1-B2)
    let bp1idx = 0;
    const bp1total = r.part1.passages.reduce((s, p) => s + p.questions.length, 0);
    r.part1.passages.forEach(passage => {
      passage.questions.forEach(q => {
        const b = 4.5 + (bp1idx / Math.max(1, bp1total - 1)) * 0.8;
        pool.push({
          uid:       `${ek}_p1_q${q.id}`,
          id:        q.id,
          examKey:   ek,
          part:      'part1',
          difficulty: +b.toFixed(2),
          type:      'gap',
          sentence:  q.sentence,
          passage:   passage.passage_raw,
          options:   q.options as Record<string, string>,
          answer:    q.answer,
        });
        bp1idx++;
      });
    });

    // Part 2: regular reading passages (B2)
    let bp2idx = 0;
    const bp2total = r.part2.passages.reduce((s, p) => s + p.questions.length, 0)
      + (r.part2.image_passages?.reduce((s, p) => s + p.questions.length, 0) ?? 0);
    r.part2.passages.forEach(passage => {
      passage.questions.forEach(q => {
        const b = 5.0 + (bp2idx / Math.max(1, bp2total - 1)) * 0.8;
        pool.push({
          uid:          `${ek}_p2_q${q.id}`,
          id:           q.id,
          examKey:      ek,
          part:         'part2',
          difficulty:   +b.toFixed(2),
          type:         'mc',
          passage:      passage.text,
          passageLabel: passage.id,
          question:     q.question,
          options:      q.options as Record<string, string>,
          answer:       q.answer,
        });
        bp2idx++;
      });
    });

    // Part 2: image material passages
    if (r.part2.image_passages) {
      r.part2.image_passages.forEach(ip => {
        ip.questions.forEach(q => {
          const b = 5.0 + (bp2idx / Math.max(1, bp2total - 1)) * 0.8;
          pool.push({
            uid:       `${ek}_p2img_q${q.id}`,
            id:        q.id,
            examKey:   ek,
            part:      'part2',
            difficulty: +b.toFixed(2),
            type:      'image_material',
            question:  q.text,
            options:   q.options as Record<string, string>,
            answer:    q.answer,
            pageImage: r.part2.image_dir
              ? `${r.part2.image_dir}/${ip.page_image}`
              : ip.page_image,
          });
          bp2idx++;
        });
      });
    }
  }

  // ── Band C ────────────────────────────────────────────────────────────────
  const examKeysC = Object.keys(examData.bandC) as Array<keyof typeof examData.bandC>;
  for (const examKey of examKeysC) {
    const exam = examData.bandC[examKey];
    if (!exam) continue;
    const r = exam.reading;
    const ek = `C_${examKey}`;

    // Part 1: gap-fill passages (C1)
    let cp1idx = 0;
    const cp1total = r.part1.passages.reduce((s, p) => s + p.questions.length, 0);
    r.part1.passages.forEach(passage => {
      passage.questions.forEach(q => {
        const b = 5.5 + (cp1idx / Math.max(1, cp1total - 1)) * 0.8;
        pool.push({
          uid:       `${ek}_p1_q${q.id}`,
          id:        q.id,
          examKey:   ek,
          part:      'part1',
          difficulty: +b.toFixed(2),
          type:      'gap',
          sentence:  q.sentence,
          passage:   passage.passage_raw,
          options:   q.options as Record<string, string>,
          answer:    q.answer,
        });
        cp1idx++;
      });
    });

    // Part 2: complex reading (C1-C2), may have image instead of text
    let cp2idx = 0;
    const cp2total = r.part2.passages.reduce((s, p) => s + p.questions.length, 0);
    r.part2.passages.forEach(passage => {
      passage.questions.forEach(q => {
        const b = 6.0 + (cp2idx / Math.max(1, cp2total - 1)) * 1.0;
        pool.push({
          uid:          `${ek}_p2_q${q.id}`,
          id:           q.id,
          examKey:      ek,
          part:         'part2',
          difficulty:   +b.toFixed(2),
          type:         'mc',
          passage:      passage.text,
          passageLabel: passage.id,
          question:     q.question,
          options:      q.options as Record<string, string>,
          answer:       q.answer,
          pageImage:    passage.image
            ? `exam-images/${passage.image}`
            : undefined,
        });
        cp2idx++;
      });
    });
  }

  return pool;
}

/**
 * Build CAT item pool from listening_data.json (Band A + B + C).
 *
 * Difficulty assignment (b parameter):
 *   Band A Part 1 (image_choice, short Q&A)     : 1.0 – 1.8
 *   Band A Part 2 (image_choice, longer dialog) : 2.0 – 2.8
 *   Band A Part 3 (image_choice, complex)       : 3.0 – 3.8
 *   Band A Part 4 (text_choice, hard)           : 4.0 – 4.6
 *   Band B Part 1 (text_choice, B1-B2)          : 4.5 – 5.2
 *   Band B Part 2 (text_choice, B2)             : 5.0 – 5.8
 *   Band C Part 1 (text_choice, C1)             : 5.5 – 6.3
 *   Band C Part 2 (text_choice, C1-C2)          : 6.0 – 7.0
 */
export function buildListeningCATPool(listeningData: ListeningData): CATItem[] {
  const pool: CATItem[] = [];

  // ── Band A (4 parts) ──────────────────────────────────────────────────────
  const PART_B_A: [number, number][] = [
    [1.0, 1.8],
    [2.0, 2.8],
    [3.0, 3.8],
    [4.0, 4.6],
  ];
  for (const examKey of Object.keys(listeningData.bandA) as Array<keyof typeof listeningData.bandA>) {
    const exam = listeningData.bandA[examKey];
    if (!exam) continue;
    exam.parts.forEach((part, partIdx) => {
      const [bMin, bMax] = PART_B_A[partIdx] ?? [3.0, 3.8];
      const total = part.questions.length;
      const partKey = `part${partIdx + 1}` as CATItem['part'];
      part.questions.forEach((q, qIdx) => {
        const b = bMin + (qIdx / Math.max(1, total - 1)) * (bMax - bMin);
        pool.push({
          uid:         `LA_${examKey}_p${partIdx + 1}_q${q.id}`,
          id:          q.id,
          examKey:     `LA_${examKey}`,
          part:        partKey,
          difficulty:  +b.toFixed(2),
          type:        part.type === 'image_choice' ? 'image_choice' : 'mc',
          options:     q.options as Record<string, string>,
          answer:      String(q.answer),
          pageImage:   q.page_image,
          isListening: true,
          audio:       q.audio,
        });
      });
    });
  }

  // ── Band B (2 parts) ──────────────────────────────────────────────────────
  const PART_B_B: [number, number][] = [
    [4.5, 5.2],
    [5.0, 5.8],
  ];
  for (const examKey of Object.keys(listeningData.bandB) as Array<keyof typeof listeningData.bandB>) {
    const exam = listeningData.bandB[examKey];
    if (!exam) continue;
    exam.parts.forEach((part, partIdx) => {
      const [bMin, bMax] = PART_B_B[partIdx] ?? [5.0, 5.8];
      const total = part.questions.length;
      const partKey = `part${partIdx + 1}` as CATItem['part'];
      part.questions.forEach((q, qIdx) => {
        const b = bMin + (qIdx / Math.max(1, total - 1)) * (bMax - bMin);
        pool.push({
          uid:         `LB_${examKey}_p${partIdx + 1}_q${q.id}`,
          id:          q.id,
          examKey:     `LB_${examKey}`,
          part:        partKey,
          difficulty:  +b.toFixed(2),
          type:        part.type === 'image_choice' ? 'image_choice' : 'mc',
          options:     q.options as Record<string, string>,
          answer:      String(q.answer),
          pageImage:   q.page_image,
          isListening: true,
          audio:       q.audio,
        });
      });
    });
  }

  // ── Band C (2 parts) ──────────────────────────────────────────────────────
  const PART_B_C: [number, number][] = [
    [5.5, 6.3],
    [6.0, 7.0],
  ];
  for (const examKey of Object.keys(listeningData.bandC) as Array<keyof typeof listeningData.bandC>) {
    const exam = listeningData.bandC[examKey];
    if (!exam) continue;
    exam.parts.forEach((part, partIdx) => {
      const [bMin, bMax] = PART_B_C[partIdx] ?? [6.0, 7.0];
      const total = part.questions.length;
      const partKey = `part${partIdx + 1}` as CATItem['part'];
      part.questions.forEach((q, qIdx) => {
        const b = bMin + (qIdx / Math.max(1, total - 1)) * (bMax - bMin);
        pool.push({
          uid:         `LC_${examKey}_p${partIdx + 1}_q${q.id}`,
          id:          q.id,
          examKey:     `LC_${examKey}`,
          part:        partKey,
          difficulty:  +b.toFixed(2),
          type:        part.type === 'image_choice' ? 'image_choice' : 'mc',
          options:     q.options as Record<string, string>,
          answer:      String(q.answer),
          pageImage:   q.page_image,
          isListening: true,
          audio:       q.audio,
        });
      });
    });
  }

  return pool;
}
