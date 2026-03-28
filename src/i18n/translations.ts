export type Lang = 'vi' | 'zh' | 'en';

export const T = {
  // ── Nav tabs ──────────────────────────────────────────────────────────────
  nav_vocab:    { vi: '📚 Từ vựng',       zh: '📚 詞彙',       en: '📚 Vocab'     },
  nav_reading:  { vi: '📖 Luyện đọc',     zh: '📖 閱讀練習',   en: '📖 Reading'   },
  nav_exam:     { vi: '📝 Thi thử',       zh: '📝 模擬考試',   en: '📝 Mock Exam' },
  nav_listening:{ vi: '🎧 Nghe',          zh: '🎧 聽力',       en: '🎧 Listen'   },
  nav_ai:       { vi: '🤖 AI Tạo bài',    zh: '🤖 AI生成',     en: '🤖 AI Gen'   },
  nav_progress: { vi: '📊 Tiến độ',       zh: '📊 學習進度',   en: '📊 Progress'  },

  // ── Exam – Select phase ────────────────────────────────────────────────────
  exam_title:      { vi: 'Thi thử TOCFL',                          zh: 'TOCFL 模擬考試',                   en: 'TOCFL Mock Exam'             },
  exam_subtitle:   { vi: 'Làm bài đọc mô phỏng đề thi thật · Đếm giờ 60 phút', zh: '模擬真實閱讀測驗 · 計時60分鐘', en: 'Authentic reading simulation · 60-minute timer' },
  exam_start:      { vi: 'Bắt đầu thi →',                          zh: '開始考試 →',                      en: 'Start Exam →'                },
  exam_history:    { vi: 'Lịch sử thi',                            zh: '考試紀錄',                         en: 'Exam History'                },
  exam_date:       { vi: 'Ngày',                                   zh: '日期',                             en: 'Date'                        },
  exam_result:     { vi: 'Kết quả',                                zh: '成績',                             en: 'Score'                       },

  // ── Exam – Exam phase ──────────────────────────────────────────────────────
  answered:        { vi: 'đã trả lời',  zh: '已作答',  en: 'answered'  },
  btn_prev:        { vi: '← Trước',    zh: '← 上題',  en: '← Prev'    },
  btn_next:        { vi: 'Sau →',      zh: '下題 →',  en: 'Next →'    },
  btn_submit:      { vi: 'Nộp bài',    zh: '交卷',    en: 'Submit'    },
  passage_label:   { vi: 'Đoạn văn',   zh: '文章',    en: 'Passage'   },
  question_prefix: { vi: 'Câu',        zh: '第',      en: 'Q'         },
  pick_image:      { vi: 'Chọn hình',  zh: '選圖',    en: 'Choose'    },
  same_page_note:  { vi: 'Cùng hình phía trên', zh: '同上圖', en: 'Same image above' },

  // ── Part labels ────────────────────────────────────────────────────────────
  part1_label:  { vi: 'Phần 1 · Chọn hình',               zh: '第一部分 · 選圖',       en: 'Part 1 · Picture Choice'    },
  part2_label:  { vi: 'Phần 2 · Xem hình / Đọc hiểu',     zh: '第二部分 · 看圖說話',   en: 'Part 2 · Picture Reading'   },
  part3_label:  { vi: 'Phần 3 · Điền từ',                  zh: '第三部分 · 選詞填空',   en: 'Part 3 · Gap Fill'          },
  part4_label:  { vi: 'Phần 4 · Hoàn thành đoạn văn',     zh: '第四部分 · 完成段落',   en: 'Part 4 · Cloze'             },
  part5_label:  { vi: 'Phần 5 · Đọc hiểu',                zh: '第五部分 · 閱讀理解',   en: 'Part 5 · Reading'           },

  // ── Exam – Result phase ────────────────────────────────────────────────────
  result_excellent:  { vi: 'Xuất sắc!',         zh: '非常優秀！', en: 'Excellent!'       },
  result_good:       { vi: 'Khá tốt!',           zh: '很不錯！',  en: 'Good job!'        },
  result_keep_going: { vi: 'Cần ôn thêm!',       zh: '需要加油！', en: 'Keep studying!'  },
  btn_back:          { vi: '← Quay lại',          zh: '← 返回',   en: '← Back'           },
  result_detail:     { vi: 'Chi tiết kết quả',   zh: '詳細成績',  en: 'Result Details'   },
  correct_ans:       { vi: 'đáp án',             zh: '答案',      en: 'answer'           },
  you_chose:         { vi: 'bạn chọn',           zh: '你選了',    en: 'you chose'        },
  not_answered:      { vi: 'chưa trả lời',       zh: '未作答',    en: 'unanswered'       },

  // ── Flashcard ─────────────────────────────────────────────────────────────
  fc_known:       { vi: '✓ Đã biết',   zh: '✓ 已知道', en: '✓ Know'   },
  fc_unknown:     { vi: '✗ Chưa biết', zh: '✗ 不知道', en: '✗ Unknown' },
  fc_shuffle:     { vi: '🔀 Xáo bài',  zh: '🔀 隨機',  en: '🔀 Shuffle' },
  fc_hide_known:  { vi: 'Ẩn đã biết',  zh: '隱藏已知', en: 'Hide known' },
  fc_all_known:   { vi: '🎉 Bạn đã biết tất cả các từ trong bộ lọc này!', zh: '🎉 你已掌握所有篩選詞彙！', en: '🎉 You know all words in this filter!' },

  // ── Progress ───────────────────────────────────────────────────────────────
  prog_title:     { vi: 'Tiến độ học tập',    zh: '學習進度',    en: 'Learning Progress' },
  prog_reset:     { vi: 'Đặt lại tất cả',     zh: '重置全部',    en: 'Reset All'         },

  // ── Loading / Errors ───────────────────────────────────────────────────────
  loading:        { vi: 'Đang tải dữ liệu…',  zh: '載入資料中…',  en: 'Loading data…'    },
  error_load:     { vi: 'Lỗi tải dữ liệu',    zh: '載入資料錯誤', en: 'Failed to load data' },
} as const;

export type TKey = keyof typeof T;

export function t(key: TKey, lang: Lang): string {
  return T[key][lang];
}
