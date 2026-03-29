export type Lang = 'vi' | 'zh' | 'en';

export const T = {
  // ── Nav tabs ──────────────────────────────────────────────────────────────
  nav_vocab:    { vi: '📚 Từ vựng',       zh: '📚 詞彙',       en: '📚 Vocab'     },
  nav_reading:  { vi: '📖 Luyện đọc',     zh: '📖 閱讀練習',   en: '📖 Reading'   },
  nav_exam:     { vi: '📝 Thi thử',       zh: '📝 模擬考試',   en: '📝 Mock Exam' },
  nav_listening:{ vi: '🎧 Nghe',          zh: '🎧 聽力',       en: '🎧 Listen'   },
  nav_ai:       { vi: '🤖 AI Tạo bài',    zh: '🤖 AI生成',     en: '🤖 AI Gen'   },
  nav_progress: { vi: '📊 Tiến độ',       zh: '📊 學習進度',   en: '📊 Progress'  },
  nav_interview:{ vi: '🎤 Interview',     zh: '🎤 面試練習',   en: '🎤 Interview' },

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
  fc_shuffle:     { vi: 'Xáo bài',  zh: '隨機',  en: 'Shuffle' },
  fc_hide_known:  { vi: 'Ẩn đã biết',  zh: '隱藏已知', en: 'Hide known' },
  fc_all_known:   { vi: '🎉 Bạn đã biết tất cả các từ trong bộ lọc này!', zh: '🎉 你已掌握所有篩選詞彙！', en: '🎉 You know all words in this filter!' },

  // ── Progress ───────────────────────────────────────────────────────────────
  prog_title:     { vi: 'Tiến độ học tập',    zh: '學習進度',    en: 'Learning Progress' },
  prog_reset:     { vi: 'Đặt lại tất cả',     zh: '重置全部',    en: 'Reset All'         },

  // ── Loading / Errors ───────────────────────────────────────────────────────
  loading:        { vi: 'Đang tải dữ liệu…',  zh: '載入資料中…',  en: 'Loading data…'    },
  error_load:     { vi: 'Lỗi tải dữ liệu',    zh: '載入資料錯誤', en: 'Failed to load data' },

  // ── Reading module ─────────────────────────────────────────────────────────
  read_band_label:    { vi: 'Band',             zh: '級別',          en: 'Band'              },
  read_part_label:    { vi: 'Phần',             zh: '部分',          en: 'Part'              },
  read_session_stat:  { vi: 'Phiên này',        zh: '本次練習',      en: 'Session'           },
  read_correct_of:    { vi: 'đúng',             zh: '正確',          en: 'correct'           },
  read_q_of:          { vi: 'Câu',              zh: '題',            en: 'Q'                 },
  read_check:         { vi: 'Kiểm tra',         zh: '確認',          en: 'Check'             },
  read_next_q:        { vi: 'Câu tiếp →',       zh: '下一題 →',      en: 'Next →'            },
  read_correct_msg:   { vi: '✓ Chính xác!',     zh: '✓ 正確！',      en: '✓ Correct!'        },
  read_wrong_msg:     { vi: '✗ Sai. Đáp án đúng:', zh: '✗ 錯誤。正確答案：', en: '✗ Wrong. Correct answer:' },
  read_no_q:          { vi: 'Không có câu hỏi.', zh: '沒有題目。',   en: 'No questions.'     },

  // Reading: Part labels (short, for filter chips in ReadingModule)
  read_part3_label:   { vi: 'Phần 3 — Điền từ',       zh: '第三部分 — 選詞填空',  en: 'Part 3 — Gap Fill'    },
  read_part4_label:   { vi: 'Phần 4 — Cloze',         zh: '第四部分 — 完形填空',  en: 'Part 4 — Cloze'       },
  read_part5_label:   { vi: 'Phần 5 — Đọc hiểu',      zh: '第五部分 — 閱讀理解',  en: 'Part 5 — Reading'     },
  read_part1_label:   { vi: 'Phần 1 — Điền từ',       zh: '第一部分 — 選詞填空',  en: 'Part 1 — Gap Fill'    },
  read_part2_label:   { vi: 'Phần 2 — Đọc hiểu',      zh: '第二部分 — 閱讀理解',  en: 'Part 2 — Reading'     },

  // Reading: Cloze
  cloze_title:        { vi: 'Hoàn thiện đoạn văn',    zh: '完形填空',             en: 'Complete the Passage' },
  cloze_check:        { vi: 'Kiểm tra',               zh: '提交',                 en: 'Check'                },
  cloze_redo:         { vi: 'Làm lại',                zh: '重做',                 en: 'Redo'                 },
  cloze_hint:         { vi: '💡 Nhấn vào ô trống để xoay vòng đáp án', zh: '💡 點擊空格循環切換答案', en: '💡 Tap blank to cycle answers' },
  cloze_perfect:      { vi: '✓ Hoàn hảo!',            zh: '✓ 滿分！',             en: '✓ Perfect!'           },
  cloze_score:        { vi: 'Đúng',                   zh: '答對',                 en: 'Correct'              },
  cloze_blanks:       { vi: 'ô.',                     zh: '格。',                 en: 'blanks.'              },
  cloze_answers:      { vi: 'Đáp án:',                zh: '答案：',               en: 'Answers:'             },
  cloze_section_label:{ vi: 'Band A · Phần 4 — Cloze', zh: 'A級 · 第四部分 — 完形填空', en: 'Band A · Part 4 — Cloze' },
  cloze_passage_n:    { vi: 'Bài',                    zh: '段落',                 en: 'Passage'              },

  // ── AI Reading Generator (in Reading tab) ─────────────────────────────────
  ai_read_tab:         { vi: '✨ AI Tạo Bài Đọc',    zh: '✨ AI 生成閱讀',       en: '✨ AI Generate'        },
  ai_read_title:       { vi: 'AI Tạo Bài Đọc Mới',  zh: 'AI 生成新閱讀練習',    en: 'AI Reading Generator' },
  ai_read_desc:        { vi: 'Tạo bài đọc mới dựa theo phong cách đề thi TOCFL thực tế, kèm giải thích chi tiết và từ vựng cần nắm.', zh: '根據真實TOCFL考題風格生成新閱讀練習，含詳細解析和重點詞彙。', en: 'Generate new reading exercises based on real TOCFL exam style, with detailed explanations and vocabulary.' },
  ai_read_band:        { vi: 'Band',                 zh: '級別',                 en: 'Band'                 },
  ai_read_topic:       { vi: 'Chủ đề (tùy chọn)',   zh: '主題（可選）',          en: 'Topic (optional)'     },
  ai_read_topic_ph:    { vi: 'Ví dụ: Du lịch, Ẩm thực, Công nghệ…', zh: '例：旅遊、飲食、科技…', en: 'E.g. Travel, Food, Technology…' },
  ai_read_use_example: { vi: 'Dựa theo bài thi có sẵn', zh: '參考現有題目風格',  en: 'Based on existing exam style' },
  ai_read_api_key:     { vi: 'OpenAI API Key',       zh: 'OpenAI API 金鑰',      en: 'OpenAI API Key'       },
  ai_read_generate:    { vi: '✨ Tạo bài đọc',       zh: '✨ 生成閱讀',           en: '✨ Generate'           },
  ai_read_generating:  { vi: 'Đang tạo…',            zh: '生成中…',              en: 'Generating…'          },
  ai_read_passage:     { vi: 'Đoạn văn',             zh: '閱讀文章',             en: 'Passage'              },
  ai_read_questions:   { vi: 'Câu hỏi',              zh: '閱讀測驗',             en: 'Questions'            },
  ai_read_vocab:       { vi: 'Từ vựng cần nắm',      zh: '重點詞彙',             en: 'Key Vocabulary'       },
  ai_read_view_zh:     { vi: '中文',                  zh: '中文',                 en: '中文'                  },
  ai_read_view_py:     { vi: 'Pinyin',               zh: '拼音',                 en: 'Pinyin'               },
  ai_read_view_vi:     { vi: 'Dịch',                 zh: '譯文',                 en: 'Translation'          },
  ai_read_correct:     { vi: '✓ Chính xác!',         zh: '✓ 正確！',             en: '✓ Correct!'           },
  ai_read_wrong:       { vi: '✗ Sai. Đáp án:',       zh: '✗ 錯誤。答案：',       en: '✗ Wrong. Answer:'     },
  ai_read_explain:     { vi: 'Giải thích',            zh: '詳細解析',             en: 'Explanation'          },
  ai_read_save:        { vi: 'Lưu vào thư viện',     zh: '儲存到資料庫',          en: 'Save to Library'      },
  ai_read_saved:       { vi: '✓ Đã lưu',             zh: '✓ 已儲存',             en: '✓ Saved'              },
  ai_read_no_key:      { vi: 'Vui lòng nhập OpenAI API Key để dùng tính năng này.', zh: '請輸入 OpenAI API Key 以使用此功能。', en: 'Please enter your OpenAI API Key to use this feature.' },
  ai_read_new:         { vi: 'Tạo bài mới',          zh: '重新生成',             en: 'New Exercise'         },
  ai_read_example_tip: { vi: 'AI sẽ học theo phong cách, độ dài và độ khó của bài thi thực tế', zh: 'AI 將參考真實考題的風格、長度和難度', en: 'AI will mimic the style, length and difficulty of real exam questions' },

  // ── Interview Coach ────────────────────────────────────────────────────────
  iv_docs_tab:        { vi: 'Tài liệu',               zh: '文件',              en: 'Documents'            },
  iv_sessions_tab:    { vi: 'Luyện tập',              zh: '練習',              en: 'Practice'             },
  iv_upload_title:    { vi: 'Kéo thả hoặc nhấn để chọn tài liệu', zh: '拖曳或點擊選取文件', en: 'Drag & drop or click to select' },
  iv_upload_sub:      { vi: 'Hỗ trợ PDF, DOCX, TXT — tối đa 10 MB', zh: '支援 PDF, DOCX, TXT — 最大 10 MB', en: 'PDF, DOCX, TXT — max 10 MB' },
  iv_uploading:       { vi: 'Đang upload…',           zh: '上傳中…',           en: 'Uploading…'           },
  iv_no_docs:         { vi: 'Chưa có tài liệu. Upload CV để bắt đầu.', zh: '尚無文件，請上傳您的履歷。', en: 'No documents. Upload your CV to start.' },
  iv_analyze:         { vi: 'Phân tích AI',           zh: 'AI 分析',           en: 'AI Analyse'           },
  iv_analyzing:       { vi: 'Phân tích…',             zh: '分析中…',           en: 'Analysing…'           },
  iv_back:            { vi: '← Quay lại',             zh: '← 返回',            en: '← Back'               },
  iv_back_docs:       { vi: '← Tài liệu',             zh: '← 文件',            en: '← Documents'          },
  iv_start_session:   { vi: 'Bắt đầu phiên mới',      zh: '開始新對話',        en: 'Start New Session'    },
  iv_highlights:      { vi: 'Điểm nổi bật',           zh: '亮點',              en: 'Highlights'           },
  iv_skills:          { vi: 'Kỹ năng',                zh: '技能',              en: 'Skills'               },
  iv_experience:      { vi: 'Kinh nghiệm',            zh: '工作經歷',          en: 'Experience'           },
  iv_education:       { vi: 'Học vấn',                zh: '學歷',              en: 'Education'            },
  iv_ai_review:       { vi: 'Đánh giá AI',            zh: 'AI 評估',           en: 'AI Review'            },
  iv_strengths:       { vi: 'Điểm mạnh',              zh: '優點',              en: 'Strengths'            },
  iv_improve:         { vi: 'Lĩnh vực cần cải thiện', zh: '待改進之處',        en: 'Areas to Improve'     },
  iv_fits_for:        { vi: 'Phù hợp với',            zh: '適合職位',          en: 'Suitable for'         },
  iv_history:         { vi: 'Lịch sử luyện tập',      zh: '練習紀錄',          en: 'Practice History'     },
  iv_new_session:     { vi: '+ Phiên mới',            zh: '+ 新對話',          en: '+ New Session'        },
  iv_loading:         { vi: 'Đang tải…',              zh: '載入中…',           en: 'Loading…'             },
  iv_no_sessions:     { vi: 'Chưa có phiên luyện tập nào.', zh: '尚無練習紀錄。', en: 'No practice sessions yet.' },
  iv_first_session:   { vi: 'Bắt đầu phiên đầu tiên', zh: '開始第一場練習',   en: 'Start First Session'  },
  iv_messages:        { vi: 'tin nhắn',               zh: '則訊息',            en: 'messages'             },
  iv_create_title:    { vi: 'Tạo phiên luyện tập mới', zh: '建立新練習對話',   en: 'Create New Session'   },
  iv_session_name:    { vi: 'TÊN PHIÊN',              zh: '對話名稱',          en: 'SESSION NAME'         },
  iv_job_title:       { vi: 'VỊ TRÍ ỨNG TUYỂN',       zh: '應徵職位',          en: 'JOB TITLE'            },
  iv_company:         { vi: 'CÔNG TY',                zh: '公司',              en: 'COMPANY'              },
  iv_mode:            { vi: 'CHẾ ĐỘ',                 zh: '模式',              en: 'MODE'                 },
  iv_mode_mock:       { vi: 'Mock Interview',         zh: '模擬面試',          en: 'Mock Interview'       },
  iv_mode_mock_desc:  { vi: 'AI đóng vai nhà tuyển dụng, hỏi & chấm điểm STAR', zh: 'AI 扮演面試官，提問並以 STAR 評分', en: 'AI acts as interviewer, asks & scores STAR' },
  iv_mode_coach:      { vi: 'Answer Coach',           zh: '回答教練',          en: 'Answer Coach'         },
  iv_mode_coach_desc: { vi: 'AI giúp cải thiện câu trả lời của bạn', zh: 'AI 協助優化您的回答', en: 'AI helps improve your answers' },
  iv_docs_attach:     { vi: 'TÀI LIỆU ĐÍNH KÈM (AI SẼ DÙNG LÀM CONTEXT)', zh: '附件文件（AI 將作為背景資料）', en: 'ATTACHED DOCS (AI context)' },
  iv_cancel:          { vi: 'Hủy',                   zh: '取消',              en: 'Cancel'               },
  iv_create_btn:      { vi: 'Bắt đầu',               zh: '開始',              en: 'Start'                },
  iv_chat_ph:         { vi: 'Nhập câu trả lời của bạn…', zh: '輸入您的回答…', en: 'Type your answer…'    },
  iv_send:            { vi: 'Gửi',                   zh: '傳送',              en: 'Send'                 },
  iv_auth_title:      { vi: 'Đăng nhập để sử dụng Interview Coach', zh: '請登入以使用面試教練', en: 'Sign in to use Interview Coach' },
  iv_auth_desc:       { vi: 'Tính năng này yêu cầu tài khoản để lưu tài liệu và lịch sử luyện tập.', zh: '此功能需要帳號以儲存文件和練習紀錄。', en: 'This feature requires an account to save documents and practice history.' },
  iv_err_no_key:      { vi: 'Vui lòng thiết lập API Key ở góc trên phải (API Key button).', zh: '請在右上角設定 API Key。', en: 'Please set your API Key (top-right button).' },
  iv_err_no_text:     { vi: 'Tài liệu chưa được parse',    zh: '文件尚未解析',      en: 'Document not parsed yet' },
  iv_err_analyze:     { vi: 'Lỗi phân tích',              zh: '分析錯誤',          en: 'Analysis error'       },
  iv_err_upload:      { vi: 'Lỗi upload',                 zh: '上傳錯誤',          en: 'Upload error'         },
  iv_err_create:      { vi: 'Lỗi tạo phiên',              zh: '建立對話錯誤',      en: 'Session create error' },
  iv_err_send:        { vi: 'Lỗi',                        zh: '錯誤',              en: 'Error'                },
  iv_chat_back:       { vi: '← Phiên',                    zh: '← 對話',            en: '← Session'            },
  iv_ready_mock:      { vi: 'Sẵn sàng phỏng vấn?',        zh: '準備好面試了嗎？',   en: 'Ready to interview?'  },
  iv_ready_coach:     { vi: 'Sẵn sàng luyện tập?',        zh: '準備好練習了嗎？',   en: 'Ready to practice?'   },
  iv_start_btn:       { vi: '▶ Bắt đầu',                  zh: '▶ 開始',            en: '▶ Start'               },
  iv_star_detail:     { vi: 'Xem chi tiết STAR',           zh: '查看 STAR 詳情',    en: 'View STAR breakdown'   },
} as const;

export type TKey = keyof typeof T;

export function t(key: TKey, lang: Lang): string {
  return T[key][lang];
}
