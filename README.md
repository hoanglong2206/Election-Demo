# Electron AI Meeting & Interview Copilot (Election Demo)

> **Ứng dụng desktop Overlay HUD / Copilot thông minh hỗ trợ phỏng vấn tuyển dụng & hội thảo kỹ thuật theo thời gian thực.**  
> Tích hợp công nghệ thu âm 2 chiều đa luồng, bóc băng giọng nói siêu tốc (Local Whisper C++ Native & Cloud STT), phân loại ý định 2 tầng (Hierarchical Intent Classification), định tuyến chiến lược trả lời đa dạng (9 Answer Strategies), kiểm định chống ảo giác (Answer Grounding Guard), Local RAG lập chỉ mục tài liệu kèm trích dẫn (Citations), định tuyến mô hình thông minh & tự động chuyển đổi dự phòng (Smart Model Router & Failover), cơ chế tự khôi phục phiên họp khi gặp sự cố (Session Recovery) và bảo mật cấp hệ điều hành với OS Credential Store.

---

## 📑 Bảng Mục Lục

1. [Tổng Quan Dự Án & Điểm Nổi Bật](#-tổng-quan-dự-án--điểm-nổi-bật)
2. [Kiến Trúc Toàn Hệ Thống (System Architecture)](#-kiến-trúc-toàn-hệ-thống-system-architecture)
3. [Chi Tiết 7 Màn Hình Chức Năng](#-chi-tiết-7-màn-hình-chức-năng)
   - [Trang 1: Home (Chuẩn Bị Ngữ Cảnh, Quản Lý Profile & Lập Chỉ Mục RAG)](#trang-1-home-chuẩn-bị-ngữ-cảnh-quản-lý-profile--lập-chỉ-mục-rag)
   - [Trang 2: Meeting Mode (Trợ Lý Realtime, Strategy Router, Grounding & Khôi Phục Phiên)](#trang-2-meeting-mode-trợ-lý-realtime-strategy-router-grounding--khôi-phục-phiên)
   - [Trang 3: Audio Test & Lab (Phòng Lab Đo Lường & Cân Chỉnh VAD)](#trang-3-audio-test--lab-phòng-lab-đo-lường--cân-chỉnh-vad)
   - [Trang 4: AI Diagnostic & Benchmark (Đo Tốc Độ AI & OCR Vision)](#trang-4-ai-diagnostic--benchmark-đo-tốc-độ-ai--ocr-vision)
   - [Trang 5: Session History (Quản Lý, Xem Lại & Hậu Kỳ Cuộc Họp)](#trang-5-session-history-quản-lý-xem-lại--hậu-kỳ-cuộc-họp)
   - [Trang 6: Cost Tracker (Quản Lý Ngân Sách, Chi Phí API & Model Routing)](#trang-6-cost-tracker-quản-lý-ngân-sách-chi-phí-api--model-routing)
   - [Trang 7: Settings & Security (Cấu Hình, Smart Routing, Failover & Bảo Mật)](#trang-7-settings--security-cấu-hình-smart-routing-failover--bảo-mật)
4. [Các Luồng Dữ Liệu Cốt Lõi (Core Workflows)](#-các-luồng-dữ-liệu-cốt-lõi-core-workflows)
5. [Ngăn Xếp Công Nghệ (Tech Stack)](#-ngăn-xếp-công-nghệ-tech-stack)
6. [Yêu Cầu Hệ Thống & Cài Đặt Phát Triển](#-yêu-cầu-hệ-thống--cài-đặt-phát-triển)
7. [Cấu Hình Local Whisper C++ Native](#-cấu-hình-local-whisper-c-native)
8. [Chính Sách Bảo Mật & Dữ Liệu Riêng Tư](#-chính-sách-bảo-mật--dữ-liệu-riêng-tư)

---

## 🌟 Tổng Quan Dự Án & Điểm Nổi Bật

Dự án được xây dựng dưới dạng ứng dụng **Desktop Overlay HUD** chạy trên nền tảng Electron 44, React 19 và TypeScript. Ứng dụng giải quyết bài toán đồng hành theo thời gian thực (realtime copilot) trong các buổi phỏng vấn kỹ thuật hóc búa hoặc các cuộc thảo luận kiến trúc hệ thống phức tạp với các cải tiến công nghệ vượt bậc:

- 🎙️ **Thu âm 2 chiều độc lập (Microphone + System Audio Loopback)**: Thu trọn vẹn cả giọng của bạn lẫn âm thanh đối tác phát ra từ Google Meet, Zoom, Microsoft Teams mà không làm nghẽn luồng xử lý giao diện (chạy trên Web Audio `AudioWorkletNode` 16kHz mono, Visualizer 60 FPS).
- ⚡ **Động cơ STT kép linh hoạt**:
  - **Local Whisper C++ Native**: Bóc băng giọng nói 100% offline trên máy, không gửi audio ra ngoài, tích hợp watchdog giám sát crash/freeze và quản lý tải model GGML.
  - **Cloud STT (Groq Whisper)**: Độ trễ siêu tốc ~120ms cho các trường hợp cần phản hồi tức thì.
- 🎯 **Tự động cân chỉnh VAD theo môi trường phòng (IQR Calibration)**: Thuật toán phân vị tứ phân vị loại bỏ tiếng gõ bàn phím cơ, click chuột, cách ly cấu hình ngưỡng giọng nói riêng biệt theo từng thiết bị phần cứng (`deviceId`).
- 🧠 **Phân loại ý định 2 tầng (Hierarchical Intent Classifier) & Adaptive Debounce**:
  - Phân loại cấp cao (`CopilotIntent`): `QUESTION`, `DISCUSSION_POINT`, `COMMAND`, `SMALL_TALK`, `UNKNOWN`.
  - Phân loại chuyên sâu (`NormalizedIntent`): `direct_question`, `implicit_question`, `coding_problem`, `system_design_problem`, `behavioral_question`, `clarification_request`, `follow_up_question`, `challenge_or_objection`, `normal_conversation`.
  - Bộ đệm thích ứng động (**Adaptive Debounce 300–700ms**) và bảng ghi nhật ký quyết định kích hoạt (**Decision Logs**) xem trực tiếp trên HUD.
- 🚦 **Bộ định tuyến chiến lược trả lời chuyên sâu (9 Answer Strategies)**:
  - Tự động phát hiện domain hoặc cho phép chọn thủ công các framework trả lời chuyên biệt:
    1. **Behavioral**: Phương pháp STAR chuẩn mực (Situation, Task, Action, Result).
    2. **Leadership**: Phương pháp CARL (Context, Action, Result, Learning).
    3. **Coding Problem**: Framework giải thuật toán (Clarification $\to$ Approach $\to$ Optimal Solution $\to$ Time/Space Complexity $\to$ Edge Cases).
    4. **System Design**: Phân tích yêu cầu $\to$ Kiến trúc tổng quan $\to$ Mô hình dữ liệu $\to$ Mở rộng & Nút thắt cổ chai $\to$ Trade-offs.
    5. **Database**: Truy vấn SQL/NoSQL, chỉ mục, giao dịch ACID, tính nhất quán.
    6. **Debugging**: Điều tra nguyên nhân gốc (RCA), tái hiện lỗi, giám sát telemetry, giải pháp khắc phục.
    7. **Architecture**: Design patterns, Architecture Decision Records (ADR), tính module hóa.
    8. **Conceptual**: Định nghĩa cốt lõi, nguyên lý hoạt động, so sánh và đánh đổi.
    9. **General**: Trả lời súc tích, đi thẳng vào bản chất câu hỏi.
- 🛡️ **Kiểm định thực tế & Chống ảo giác (Answer Grounding Guard)**:
  - Tự động rà soát từng mệnh đề trong câu trả lời của AI và phân loại theo mức độ bằng chứng từ CV, JD, Profile, Transcript: `SUPPORTED`, `INFERRED`, `UNSUPPORTED`, `CONTRADICTED`.
  - Cảnh báo rủi ro (`low`, `medium`, `high`) và tự động sinh bản hiệu chỉnh (`correctedAnswer`) bảo đảm tính trung thực tối đa.
- 📚 **Local RAG & Phân mảnh tài liệu (Document Chunking & Citations)**:
  - Phân mảnh ngữ cảnh thông minh cho CV, JD, projects, portfolio notes, company research và interview notes kèm trọng số nguồn ưu tiên.
  - Tìm kiếm kết hợp (BM25 keyword overlap + Vector similarity ranking) kèm trích dẫn nguồn cụ thể (`citations`) và chẩn đoán độ liên quan (`diagnostics`) tối ưu trong ngân sách token.
- 🔀 **Định tuyến mô hình thông minh & Chuyển đổi dự phòng (Smart Model Router & Provider Failover)**:
  - Đánh giá đa mục tiêu theo chính sách: `fastest`, `cheapest`, `balanced`, `highest-quality`, `local-only`.
  - Mô hình **Circuit Breaker** 3 trạng thái (`CLOSED`, `OPEN`, `HALF_OPEN`) phân loại lỗi mạng/API (timeout, 429 rate limit, 5xx server error, 401 auth).
  - Tự động chuyển đổi sang mô hình dự phòng trong **Fallback Chain** khi nhà cung cấp chính gặp sự cố hoặc quá tải.
- 💾 **Cơ chế khôi phục phiên họp khi gặp sự cố (Session Recovery & Checkpointing)**:
  - Ghi nhật ký sự kiện dạng stream nguyên tử vào `*.journal.ndjson` và snapshot định kỳ an toàn (`atomicWrite`).
  - Tự động phát hiện phiên họp bị gián đoạn do sập nguồn/crash ứng dụng và cung cấp hộp thoại khôi phục trọn vẹn transcript, câu hỏi, đề xuất AI.
- 👁️ **Giải đề bài thị giác từ màn hình (Screen Vision QA)**: Chụp màn hình qua native `desktopCapturer`, khoanh vùng câu hỏi/sơ đồ bằng `ScreenshotCropOverlay`, tự động OCR và sử dụng Multimodal Vision AI (Gemini 1.5 Flash, GPT-4o) đưa ra lời giải thuật toán kèm phân tích độ phức tạp thời gian/không gian ($O(N)$, $O(1)$).
- 💰 **Quản lý chi phí & Hạn mức ngân sách (Cost Tracker & Budget Guard)**: Giám sát token và chi phí USD theo thời gian thực, thiết lập cảnh báo 80% và ngắt gọi API tự động (Hard Stop) khi chạm 100% ngân sách tháng, hỗ trợ xuất báo cáo CSV.
- 🔒 **Bảo mật chuẩn cấp hệ điều hành (OS Credential Store)**: Mã hóa API Key bằng Windows DPAPI / macOS Keychain (`safeStorage`), tuyệt đối không lưu plaintext key trên đĩa hay gửi về React Renderer.

---

## 🏗️ Kiến Trúc Toàn Hệ Thống (System Architecture)

Ứng dụng tuân thủ mô hình **Overlay HUD / Copilot đa tầng**, phân tách nghiêm ngặt giữa tiến trình hệ thống và giao diện người dùng:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ELECTRON MAIN PROCESS (Native C++)                   │
│  - Overlay Window Manager (Frameless, Transparent, Always-on-Top)      │
│  - WhisperProcessManager (Quản lý whisper-cli.exe, Watchdog, Download) │
│  - OS Credential Store (Windows DPAPI / macOS Keychain AES Encryption) │
│  - SessionRecoveryService (Journaling *.ndjson, Atomic Snapshots)      │
│  - Electron Desktop Capturer (Chụp màn hình mức hệ thống)              │
│  - Session Storage (Lưu trữ file JSON cục bộ trong userData/sessions/) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Bảo mật IPC Channels)
┌───────────────────────────────────▼────────────────────────────────────┐
│                  REACT RENDERER PROCESS (Giao Diện HUD)                │
│  - Audio Pipeline: AudioWorklet 16kHz Mono + Bounded Buffer + VAD Gate │
│  - STT Job Queue: Concurrency Worker (Local 1, Cloud 3) + Sequencer   │
│  - Intent Classifier: Hierarchical Intent (Macro/Micro) + Adaptive VAD│
│  - Answer Strategy Router: 9 Domain Frameworks (STAR, CARL, Code...)  │
│  - Local RAG Engine: Document Chunking, Vector Store & Citations      │
│  - Answer Grounding Guard: Claim Extraction & Hallucination Filter    │
│  - Smart Model Router: Multi-objective Policy + Failover CircuitBreaker│
│  - Screen Vision: Screenshot Crop Overlay + OCR + Multimodal Vision AI │
│  - Cost Engine: Usage Tracker + Pricing Registry + Budget Guard        │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Electron Main Process (Native Infrastructure)
- **Overlay Window Controller**: Cửa sổ trong suốt (transparent), không viền (frameless), luôn nổi trên cùng (always-on-top) và tự động neo (auto-anchor) sát cạnh màn hình.
- **WhisperProcessManager**: Điều phối tiến trình `whisper-cli.exe` C++, cơ chế watchdog theo dõi tiến trình, tự phục hồi khi crash/freeze, timeout (8–15s), quản lý tải model GGML offline (tiny, base...).
- **OS Credential Store**: Tích hợp `safeStorage` (DPAPI/Keychain) mã hóa tệp `credentials.enc.json`, giải mã trực tiếp trong Main Process khi gửi request tới nhà cung cấp AI. Renderer chỉ nhận trạng thái `configured: true` và chuỗi masked (`gsk_••••••••1234`).
- **SessionRecoveryService**: Cơ chế bảo vệ dữ liệu chống mất mát khi crash; lưu stream sự kiện vào `.journal.ndjson` và ghi snapshot nguyên tử qua tệp `.tmp` sang `.snapshot.json`.
- **Desktop Capturer IPC**: Bắt khung hình màn hình ở cấp độ hệ điều hành phục vụ tính năng giải bài tập lập trình/sơ đồ thị giác.
- **Session Storage**: Quản lý đọc/ghi các phiên làm việc dưới dạng JSON độc lập trong `userData/sessions/`.

### 2. React Renderer Process (UI & Audio/AI Pipeline)
- **Web Audio Pipeline**: Thu âm song song Micro và System Loopback, xử lý trên luồng âm thanh độc lập qua `AudioWorkletNode` 16kHz mono PCM, bộ đệm trượt giới hạn `AudioBufferManager` (tối đa 15s), bộ lọc VAD tự động cân chỉnh theo môi trường.
- **STT Job Queue**: Hàng đợi trung gian điều tiết tải, kiểm soát concurrency (Local: 1 worker chống quá tải CPU, Cloud: 3 workers), gắn `sequenceId`, xử lý backpressure và tự động drop silence chunk.
- **Hierarchical Intent Classifier**: Phân loại ý định người nói 2 tầng, tính toán Adaptive Debounce (300ms–700ms) và ghi nhận nhật ký kích hoạt (`Trigger Decision Logs`).
- **Answer Strategy Router**: Điều hướng câu hỏi vào 9 chiến lược trả lời chuyên sâu (STAR, CARL Leadership, Coding, System Design, Database, Debugging, Architecture, Conceptual, General).
- **Local RAG & Citations Engine**: Trích xuất phân mảnh thông minh các tài liệu đầu vào (CV/JD/Projects) và đính kèm dẫn chứng minh bạch vào câu trả lời.
- **Answer Grounding Engine**: Kiểm tra tính xác thực của câu trả lời, gắn cờ các tuyên bố chưa có cơ sở (`UNSUPPORTED`) và đề xuất bản sửa lỗi chống bịa đặt.
- **Smart Model Router & Failover**: Lựa chọn model tối ưu theo 5 chiến lược định tuyến và chuyển đổi dự phòng bằng Circuit Breaker khi API lỗi mạng hoặc chạm giới hạn Rate Limit.
- **Usage Tracker & Cost Engine**: Tự động tính toán lượng token tiêu thụ và chi phí USD chi tiết cho từng model/feature.

---

## 📄 Chi Tiết 7 Màn Hình Chức Năng

Ứng dụng cung cấp thanh điều hướng chuyên biệt gồm 7 trang chính:

| Trang | Mục Đích Chính | Điểm Nhấn Công Nghệ Mới |
|---|---|---|
| **1. Home** | Chuẩn bị ngữ cảnh, nạp profile, lập chỉ mục RAG | Parser PDF/DOCX/TXT/MD, Local RAG Chunking, CV-JD Match Analysis, Test Ping |
| **2. Meeting Mode** | Trợ lý HUD realtime, Strategy Router, Grounding | AudioWorklet 60 FPS, 9 Answer Strategies, Grounding Guard, RAG Citations, Crash Recovery |
| **3. Audio Test & Lab** | Đo kiểm tín hiệu âm thanh & cân chỉnh VAD | Meter dBFS, Phổ tần số 8 băng tần, 5-stage pipeline, VAD Auto-Calibration theo Device ID |
| **4. AI Diagnostic** | Đo tốc độ LLM & thử nghiệm nhận diện Vision | Benchmark TTFT (ms), Tokens/sec, Playground chụp & cắt màn hình, Dropdown click-outside/ESC |
| **5. Session History** | Quản lý, xem lại và xuất báo cáo cuộc họp | Master-Detail, Full-Text Search, Unified Timeline tương tác, Xuất Markdown/JSON/PDF |
| **6. Cost Tracker** | Quản lý ngân sách, chi phí API & Model Routing | Biểu đồ xu hướng, phân bổ chi phí, 200 logs gần nhất, Budget Guard 80%/100%, Routing stats |
| **7. Settings & Security** | Cấu hình bảo mật, Smart Routing & Failover | Mã hóa OS Credential Store, Model Router Policies, Circuit Breaker failover, Local Whisper |

---

### TRANG 1: HOME (Chuẩn Bị Ngữ Cảnh, Quản Lý Profile & Lập Chỉ Mục RAG)
*File chính: `src/app/features/home/Home.tsx`*

1. **Hero Launch Bar**:
   - Chuyển đổi linh hoạt giữa 2 chế độ cốt lõi:
     - **Interview Mode**: Tối ưu cho phỏng vấn xin việc (sinh câu trả lời STAR/CARL bám sát CV & JD).
     - **Discussion Mode**: Tối ưu cho hội thảo công việc/kỹ thuật (sinh giải pháp, phản biện, kiến trúc hệ thống).
   - Nút **"Bắt đầu cuộc họp"**: Tự động kiểm tra thiết bị âm thanh, context và trạng thái phiên phục hồi trước khi mở HUD.
2. **Profile Preset Bar (Quản lý Đa Hồ Sơ)**:
   - Lưu trữ và chuyển đổi tức thì nhiều bộ hồ sơ ứng viên khác nhau (VD: *Senior Frontend Engineer*, *DevOps Specialist*, *System Architect*).
   - Hỗ trợ thêm mới, sửa, xóa an toàn (`ProfilePresetDialog`, `ProfileDeleteDialog`) và nhập/xuất dữ liệu hồ sơ qua file JSON chuẩn hóa (`ProfileImportExportDialog`).
3. **Context Editor Card & Local RAG Pre-indexing**:
   - Nhập trực tiếp hoặc tải tệp tài liệu: tự động trích xuất nội dung từ `.pdf` (`unpdf`/`pdfjs`), `.docx` (`mammoth`), `.txt`, `.md` với dung lượng lên đến 15.000 ký tự.
   - **Local RAG Pre-indexing**: Tự động chia tách tài liệu thành các phân mảnh ngữ cảnh (Semantic Chunks) gắn kèm mã định danh và hàm băm nội dung để phục vụ truy xuất RAG trong cuộc họp.
   - Đo lường dung lượng token ngữ cảnh tức thì theo thời gian thực (`estimateTokenCount`).
   - Nút nạp nhanh dữ liệu mẫu (Sample CV Senior Developer, Sample JD Software Engineer, Sample Discussion Topic).
4. **Phân Tích Tương Thích CV - JD (CV-JD Match Analysis)**:
   - Tích hợp 2 cơ chế so khớp:
     - *Heuristic Keyword Matching*: Quét từ khóa kỹ thuật chạy offline ngay lập tức, không tiêu tốn token API.
     - *AI Deep Semantic Matching*: Dùng LLM phân tích chuyên sâu mức độ tương thích năng lực.
   - Hiển thị điểm số tương thích tổng quan (0–100%), danh sách kỹ năng trùng khớp (Matched Skills), kỹ năng còn thiếu (Skill Gaps) và dự đoán các câu hỏi phỏng vấn hóc búa nhất.
5. **Audio Device & AI Model Selector**:
   - Quét và liệt kê danh sách toàn bộ Microphone vật lý và System Audio Loopback trên máy tính.
   - Lựa chọn model AI (Groq, OpenAI, Google Gemini) kèm nút **Test Ping** đo độ trễ HTTP thực tế (Round-trip ping ms).
6. **Recent Sessions & System Quick Status**:
   - Hiển thị danh sách các cuộc họp vừa diễn ra (thời lượng, số câu hỏi).
   - Giám sát tình trạng sẵn sàng của hệ thống: Micro, Whisper Native C++, Trạng thái API Keys, Ngân sách token còn lại.

---

### TRANG 2: MEETING MODE (Trợ Lý Realtime, Strategy Router, Grounding & Khôi Phục Phiên)
*File chính: `src/app/features/meeting-mode/MeetingMode.tsx`*

1. **Khôi Phục Phiên Họp Sự Cố (Session Disaster Recovery)**:
   - Ngay khi vào màn hình, hệ thống kiểm tra các phiên họp bị gián đoạn do mất điện hoặc ứng dụng đóng đột ngột.
   - Hộp thoại khôi phục hiển thị số câu thoại, thời điểm gián đoạn và cho phép phục hồi 1-click toàn bộ dữ liệu hoặc hủy bỏ an toàn.
2. **Audio Capture 2 Chiều & Visualizer 60 FPS**:
   - Thu âm đồng thời Micro cá nhân + System Loopback Audio (tiếng đối tác phát ra từ Google Meet, Zoom, Teams, Skype...).
   - Xử lý trên `AudioWorkletNode` ở luồng riêng; sóng âm thanh động học (Visualizer) chạy trên vòng lặp `requestAnimationFrame` độc lập ngoài React state $\to$ giữ vững **60 FPS** liên tục.
3. **STT Job Queue & Bóc Băng Tự Động**:
   - Cắt lát audio bằng VAD thành các chunk 1.5s – 4.5s.
   - Điều tiết hàng đợi `sttJobQueue` với concurrency control: Local Whisper = 1 worker (chống nghẽn CPU), Cloud = 3 workers.
   - Gắn `sequenceId` bảo đảm lời thoại hiển thị đúng tuần tự thời gian và tự động drop các đoạn im lặng.
4. **Live Transcript Pane (Lời Thoại Song Ngữ Ảo Hóa)**:
   - Hiển thị lời thoại thời gian thực song ngữ (tiếng Anh bản gốc và bản dịch tiếng Việt mượt mà).
   - Áp dụng kỹ thuật **Ảo hóa danh sách (Virtual Scrolling)**: Đảm bảo cuộc họp kéo dài 90–120 phút với hàng nghìn câu thoại vẫn mượt mà, không giật lag DOM và không tăng đột biến bộ nhớ RAM.
   - Thanh tìm kiếm từ khóa trong transcript, nút bật/tắt tự động cuộn (Auto-scroll), nút xuất nhanh lời thoại ra file `.txt`.
5. **Hierarchical Intent Detector & Trigger Decision Logs**:
   - Phân tích cú pháp câu hỏi 2 tầng (Macro Intent & Micro Normalized Intent).
   - Bộ đệm **Adaptive Debounce** tự co giãn từ 300ms đến 700ms tùy theo độ dài câu nói và tính hoàn chỉnh của ngữ pháp.
   - Hỗ trợ 3 chế độ kích hoạt: `Auto`, `Semi-Auto` (chờ người dùng duyệt), `Manual`.
   - Nút **Logs** trên thanh công cụ mở nhật ký chi tiết các quyết định phân loại ý định và lý do kích hoạt Copilot.
6. **Answer Strategy Router (9 Chiến Lược Phản Hồi)**:
   - Nhận diện câu hỏi thuộc dạng nào và tự động áp dụng cấu trúc phù hợp (Behavioral STAR, Leadership CARL, Coding Algorithm, System Design, Database Optimization, Debugging RCA, Software Architecture, Conceptual, General).
   - Cho phép người dùng chuyển đổi thủ công chiến lược câu trả lời ngay trên giao diện Copilot.
7. **Answer Grounding Guard (Chống Bịa Đặt / Hallucination)**:
   - Quét câu trả lời do AI tạo ra và đối chiếu với CV/Profile; phân loại từng luận điểm thành `SUPPORTED`, `INFERRED`, `UNSUPPORTED`, `CONTRADICTED`.
   - Hiển thị chỉ số tin cậy (Confidence %) và cảnh báo các số liệu hoặc tuyên bố chưa được kiểm chứng trong hồ sơ cá nhân.
8. **Local RAG Context Citations**:
   - Tự động đính kèm các trích dẫn tài liệu cụ thể (`citations`) bên dưới câu trả lời, giúp người dùng nắm rõ kinh nghiệm hoặc dự án nào trong CV đang được sử dụng làm bằng chứng.
9. **Screen Capture & Visual Coding QA (Giải Đề Bài Thị Giác)**:
   - Chụp màn hình chia sẻ trực tiếp khi gặp bài thi lập trình (LeetCode, HackerRank) hoặc sơ đồ hệ thống.
   - `ScreenshotCropOverlay`: Cho phép dùng chuột kéo chọn đúng vùng câu hỏi trên màn hình.
   - Tự động trích xuất OCR văn bản hoặc truyền ảnh vào Multimodal Vision AI (Gemini 1.5 Flash, GPT-4o).
   - `VisualQuestionCard`: Hiển thị đề bài đã trích xuất, code giải pháp tối ưu kèm phân tích độ phức tạp thời gian/không gian ($O(N)$, $O(1)$).
10. **Tự Động Sinh Biên Bản Cuộc Họp & Lưu Session**:
    - Khi kết thúc cuộc họp, hệ thống tự động sinh biên bản tóm tắt cuộc họp (Executive Summary, Key Takeaways, Next Steps).
    - Toàn bộ dữ liệu được lưu an toàn vào `userData/sessions/` trên đĩa cứng và đánh dấu hoàn tất trong cơ chế recovery.

---

### TRANG 3: AUDIO TEST & LAB (Phòng Lab Đo Lường & Cân Chỉnh VAD)
*File chính: `src/app/features/audio-test/AudioTest.tsx`*

1. **Audio Controls Toolbar**:
   - Chuyển đổi linh hoạt giữa Micro vật lý và System Audio Loopback.
   - Nút Bắt đầu / Dừng thu âm thử nghiệm; tính năng **Ghi âm & Nghe lại (Playback buffer)** để kiểm tra chất lượng giọng nói trước khi vào phỏng vấn; nút tải file âm thanh thử nghiệm `.wav`.
2. **Audio Signal Monitor & Phổ Tần Số**:
   - Đồng hồ đo mức âm lượng VU meter chính xác theo Decibel (-60 dBFS đến 0 dBFS).
   - Phân tích phổ tần số âm thanh 8 băng tần (Frequency Bands Visualizer).
   - Đo thời lượng buffer (Buffer duration) và dung lượng RAM của buffer âm thanh.
3. **Pipeline Stages Card (Giám Sát 5 Chặng Xử Lý)**:
   - Trực quan hóa tiến trình âm thanh theo thời gian thực qua 5 chặng:  
     `Audio Capture` $\to$ `VAD Energy Gate` $\to$ `Resampler 16kHz Mono` $\to$ `STT Job Queue` $\to$ `AI Inference Engine`.
4. **STT Preview Panel & Queue Metrics**:
   - Xem trước kết quả bóc băng giọng nói trực tiếp theo thời gian thực.
   - Hỗ trợ chạy các file audio mẫu có sẵn (YouTube tech interview, business call) để kiểm tra độ nhạy mô hình mà không cần nói.
   - Bảng chỉ số hàng đợi STT: `queueDepth`, `processingJobs`, `droppedJobs`, `averageWaitTime`.
5. **Tự Động Cân Chỉnh VAD Theo Môi Trường (Automatic VAD Calibration Modal)**:
   - Thu mẫu môi trường phòng trong 3.0 giây (60 khung 50ms) bằng chính pipeline âm thanh thực tế.
   - Thuật toán phân vị tứ phân vị ($IQR = Q3 - Q1$) loại trừ hoàn toàn các tiếng ồn đột ngột (click chuột, gõ bàn phím cơ, tiếng thở).
   - Tính toán noise floor ở phân vị 65th và cộng thêm `safetyMargin` (+3dB, +6dB, +9dB) để suy ra ngưỡng kích hoạt giọng nói (`speechThreshold`).
   - Phân loại chất lượng môi trường phòng: `pristine` (cực yên tĩnh), `good`, `moderate`, `noisy`, `critical`.
   - **Device Isolation**: Lưu trữ ngưỡng VAD độc lập cho từng mã phần cứng Micro (`deviceId`). Khi chuyển Micro, Meeting Mode tự động nạp cấu hình VAD tương ứng.

---

### TRANG 4: AI DIAGNOSTIC & BENCHMARK (Đo Tốc Độ AI & OCR Vision)
*File chính: `src/app/features/ai-diagnostic/AIDiagnostic.tsx`*

1. **Tab 1: LLM Latency & Speed Benchmark**:
   - Cho phép chọn bất kỳ model LLM nào từ Groq, OpenAI hoặc Google Gemini.
   - Hỗ trợ đóng mở dropdown mượt mà với tính năng tự động đóng khi nhấp ra ngoài (click-outside) hoặc nhấn phím `Escape`.
   - Cung cấp các mẫu prompt thử nghiệm thực tế: *Giải thuật toán LeetCode*, *Câu hỏi phỏng vấn System Design*, *Dịch thuật kỹ thuật*.
   - Đo lường và hiển thị các chỉ số hiệu năng AI chuẩn xác:
     - **TTFT (Time to First Token)**: Thời gian từ lúc gửi yêu cầu đến khi nhận được ký tự đầu tiên (ms).
     - **Tốc độ sinh token (Tokens/sec)**: Tốc độ tạo chữ thực tế của model.
     - **Tổng thời gian xử lý (Total Latency ms)**.
     - **Số lượng token tiêu thụ**: Input tokens, Output tokens và chi phí ước tính.
2. **Tab 2: Screen Capture Vision & OCR Playground**:
   - Thử nghiệm chụp ảnh màn hình bằng native Electron `desktopCapturer`.
   - Cung cấp công cụ cắt ảnh tương tác (Crop Tool) để khoanh vùng bài toán hoặc biểu đồ.
   - Lựa chọn Multimodal Vision Model (Google Gemini 1.5 Flash, OpenAI GPT-4o-mini...).
   - Chạy thử nghiệm phân tích đề bài thị giác và xem trước kết quả OCR trích xuất trước khi bước vào cuộc họp chính thức.

---

### TRANG 5: SESSION HISTORY (Quản Lý, Xem Lại & Hậu Kỳ Cuộc Họp)
*File chính: `src/app/features/session-history/SessionHistory.tsx`*

1. **Bố Cục Master-Detail & Sidebar Đa Bộ Lọc**:
   - Lọc theo chế độ: Tất cả, Phỏng vấn (Interview), Thảo luận (Discussion).
   - Lọc theo Profile ứng viên: *Frontend Dev*, *DevOps Lead*...
   - Lọc theo mốc thời gian: *Hôm nay*, *7 ngày qua*, *30 ngày qua*, *Tất cả*.
   - **Full-Text Search Toàn Diện**: Tìm kiếm tức thì trong toàn bộ tiêu đề, transcript tiếng Anh, transcript dịch tiếng Việt, gợi ý của AI và nội dung OCR từ ảnh chụp màn hình.
   - Thao tác quản lý session: Đổi tên cuộc họp trực tiếp (inline rename), xóa từng session hoặc chọn nhiều để xóa hàng loạt (Bulk Delete) kèm hộp thoại xác nhận an toàn.
2. **Interactive Timeline & Chi Tiết Cuộc Họp**:
   - Header hiển thị tổng quan: Ngày giờ, thời lượng, profile áp dụng, tổng token sử dụng và ước tính chi phí API ($USD).
   - **Tab 1 - Dòng thời gian tích hợp (Unified Timeline)**: Liệt kê sự kiện theo thời gian thực với phân loại màu sắc trực quan:
     - *Câu hỏi người phỏng vấn* (Theme màu hổ phách, nhãn Question).
     - *Câu trả lời của bạn* (Theme màu tím, nhãn You).
     - *Gợi ý AI Copilot* (Theme phát sáng emerald/violet, nhãn AI Suggestion kèm chiến lược trả lời, grounding claims và nút copy).
     - *Câu hỏi hình ảnh màn hình* (Theme cyan/indigo, trích xuất OCR, tóm tắt và code thuật toán).
   - **Tính năng Click-to-Correlate**: Bấm vào mốc thời gian của bất kỳ sự kiện nào để tự động cuộn và highlight câu hỏi hoặc gợi ý AI tương ứng.
   - **Tab 2 - Lời thoại song ngữ (Transcript)**: Xem toàn bộ hội thoại gốc và dịch với chế độ progressive load chống giật lag.
   - **Tab 3 - Gợi ý AI Copilot**: Toàn bộ câu trả lời, framework chiến lược và đánh giá grounding.
   - **Tab 4 - Visual Coding**: Toàn bộ ảnh chụp màn hình bài tập kèm code lời giải.
   - **Tab 5 - Split View (50:50)**: Đối chiếu song song lời thoại và gợi ý của AI.
3. **Xuất Báo Cáo Đa Định Dạng**:
   - **Xuất Markdown**: Báo cáo đầy đủ định dạng đẹp (kèm Profile, Timeline, Lời thoại song ngữ, Gợi ý, Câu hỏi hình ảnh OCR, Metrics).
   - **Xuất JSON Schema v2.0**: Dữ liệu cấu trúc chuẩn phục vụ sao lưu hoặc phân tích dữ liệu.
   - **Xuất PDF in ấn**: Xuất file tài liệu PDF trực tiếp bằng hàm in hệ thống.
4. **Chính Sách Lưu Trữ Tự Động (Retention Policy)**:
   - Tùy chọn tự động dọn dẹp các phiên họp cũ: Vĩnh viễn (mặc định), 7 ngày, 30 ngày, 90 ngày.
   - Tự động dọn dẹp sạch sẽ artifact ảnh chụp màn hình liên quan khi phiên họp bị xóa.

---

### TRANG 6: COST TRACKER (Quản Lý Ngân Sách, Chi Phí API & Model Routing)
*File chính: `src/app/features/cost-tracker/CostTracker.tsx`*

1. **Top Metric Cards (Chỉ Số Tổng Quan Hàng Tháng)**:
   - Hiển thị tức thì: Tổng chi phí tháng hiện tại ($USD), Tổng số lượt gọi API (Requests), Tổng số token tiêu thụ (Input / Output / Cache), Tỷ lệ ngân sách đã dùng (%).
2. **Tab 1: Overview Dashboard (Bàn Điều Khiển Tổng Thể)**:
   - Kết hợp 2 cột: Biểu đồ xu hướng chi phí theo ngày và Biểu đồ tròn phân bổ chi phí.
   - Thẻ quản lý ngân sách và thẻ cấu hình bảng giá model.
3. **Tab 2: Daily Usage Trend Chart (Biểu Đồ Xu Hướng Sử Dụng)**:
   - Trực quan hóa chi phí theo từng ngày với các mốc lựa chọn: 7 ngày, 14 ngày, 30 ngày.
   - Phân tích ngày có lượng gọi API cao nhất (Spike detection) và mức chi tiêu trung bình/ngày.
4. **Tab 3: Distribution Charts (Biểu Đồ Phân Bổ Chi Phí)**:
   - Phân bổ theo **Nhà cung cấp (Provider)**: Tỷ lệ % chi phí giữa Groq, OpenAI, Google Gemini.
   - Phân bổ theo **Tính năng (Feature)**: Tỷ lệ giữa `copilot_interview`, `copilot_discussion`, `speech_to_text`, `summary`, `vision_analysis`.
5. **Tab 4: Recent Usage Logs Table (Nhật Ký Gọi API Chi Tiết)**:
   - Bảng liệt kê chi tiết 200 lượt gọi API gần nhất: Mã request, Thời gian, Provider, Model, Tính năng, Input Tokens, Output Tokens, Cached Tokens, Chi phí USD, Trạng thái.
   - Nút **Xuất file CSV (Export CSV)**: Tải toàn bộ nhật ký gọi API ra file Excel/CSV để lập báo cáo tài chính.
6. **Tab 5: Budget Management (Quản Lý Hạn Mức Chi Tiêu)**:
   - Thiết lập hạn mức ngân sách tối đa hàng tháng ($USD).
   - Thiết lập ngưỡng cảnh báo (Warning threshold, mặc định 80%).
   - Cơ chế bảo vệ: Cảnh báo trực quan khi chạm ngưỡng và chặn gọi API không cần thiết (Hard Stop) khi vượt hạn mức 100%.
7. **Tab 6: Model Pricing Configuration (Cấu Hình Đơn Giá Token)**:
   - Cho phép người dùng tùy chỉnh hoặc cập nhật giá tiền cho từng model (Input price / 1M tokens, Output price / 1M tokens, Cached price / 1M tokens, Audio price / minute).
   - Hỗ trợ nạp dữ liệu mẫu (Seed Demo Data) và Reset toàn bộ thống kê cục bộ.

---

### TRANG 7: SETTINGS & SECURITY (Cấu Hình, Smart Routing, Failover & Bảo Mật)
*File chính: `src/app/features/settings/Settings.tsx`*

1. **Khóa API AI (Bảo Mật Bằng OS Credential Store)**:
   - Tích hợp chuẩn mã hóa cấp OS: **Windows Credential Manager / DPAPI, macOS Keychain**.
   - Tuyệt đối không lưu plaintext key trong `localStorage`, `IndexedDB` hay file JSON cấu hình.
   - Renderer chỉ nhận trạng thái `configured: true` và `maskedKey` (`gsk_••••••••1234`).
   - Quản lý độc lập 3 Provider: Groq, OpenAI, Google Gemini.
   - Nút **Kiểm tra khóa (Verify API Key)**: Ping xác thực key sống/chết và cập nhật danh sách model hỗ trợ.
   - Nút **Thu hồi/Xóa khóa (Revoke Key)** và **Tự động di chuyển (Auto Migration)** từ key cũ sang vùng lưu trữ an toàn.
   - Nút **Xuất cấu hình an toàn (Export Sanitized Settings)**: Xuất file cấu hình đã loại bỏ 100% secret.
2. **Smart Model Routing & Provider Failover Configuration**:
   - Bật/tắt chế độ **Smart Model Router**.
   - Lựa chọn chính sách định tuyến ưu tiên (**Routing Policy**):
     - `fastest`: Tối ưu hóa tốc độ và độ trễ thấp nhất.
     - `cheapest`: Tối ưu hóa chi phí token tiết kiệm nhất.
     - `balanced` (Khuyến nghị): Cân bằng hài hòa giữa chất lượng, tốc độ và chi phí.
     - `highest-quality`: Ưu tiên mô hình mạnh nhất cho các câu hỏi phức tạp.
     - `local-only`: Chỉ định tuyến tới mô hình offline nội bộ.
   - Bật/tắt cơ chế **Circuit Breaker & Automatic Failover**: Tự động chuyển nhà cung cấp dự phòng khi xảy ra lỗi mạng hoặc quá hạn mức rate limit (429).
3. **STT Engine Card (Động Cơ Bóc Băng Giọng Nói)**:
   - Lựa chọn giữa **Local Whisper C++** (chạy offline trên máy) và **Cloud STT** (Groq Whisper siêu tốc 120ms).
   - Quản lý Native Worker Whisper C++: Theo dõi trạng thái tiến trình (`READY`, `BUSY`, `STOPPED`, `FAILED`), đo nhiệt độ/CPU và quản lý tải model GGML offline (tiny 75MB, base 142MB).
   - Nút **Kiểm tra sức khỏe Native Engine (Health Check)**: Thử nghiệm bóc băng đoạn audio mẫu nội bộ để xác nhận binary và model hoạt động trơn tru.
4. **LLM Engine Card (Mô Hình AI Copilot)**:
   - Lựa chọn model LLM mặc định cho cuộc họp (Llama 3.3 70B, GPT-4o, Gemini 2.5 Flash...).
   - Nút **Đồng bộ danh sách model (Sync Models)** trực tiếp từ API của từng provider.
5. **Multimodal Vision Model Card**:
   - Cấu hình model chuyên trách xử lý hình ảnh chụp màn hình (Gemini 1.5 Flash, GPT-4o-mini...).
6. **Meeting Audio & VAD Config Card**:
   - Chọn Microphone mặc định.
   - Thanh trượt điều chỉnh độ nhạy VAD (0.1 – 1.0) và độ dài khoảng lặng kết thúc câu.
   - Lựa chọn ngôn ngữ phản hồi mặc định của AI: Tiếng Việt, Tiếng Anh, Song ngữ.
   - Bật/tắt chế độ cá nhân hóa câu trả lời dựa trên kinh nghiệm trong CV.

---

## 🔄 Các Luồng Dữ Liệu Cốt Lõi (Core Workflows)

Dưới đây là các luồng dữ liệu chính vận hành toàn bộ hệ thống:

### Luồng 1: Thu Âm 2 Chiều & Lọc Khoảng Lặng VAD
```mermaid
sequenceDiagram
    autonumber
    actor User as Bạn (Microphone)
    actor Partner as Đối tác (Loopback Audio)
    participant Engine as WebAudioCaptureService
    participant Worklet as AudioWorklet (16kHz Mono)
    participant Buffer as AudioBufferManager (Max 15s)
    participant VAD as VAD Gate (IQR Calibration)
    participant Queue as STT Job Queue

    User->>Engine: Giọng nói qua Micro
    Partner->>Engine: Âm thanh qua System Loopback
    Engine->>Worklet: Trộn kênh & Chuyển giao PCM
    Worklet->>Worklet: Resample chuẩn 16,000Hz Mono
    Worklet->>Buffer: Bơm mảng Float32Array
    loop Mỗi 100ms
        Buffer->>VAD: Tính mức năng lượng RMS (dBFS)
        alt RMS >= Ngưỡng speechThreshold (Có tiếng nói)
            VAD->>Buffer: Kéo dài Audio Chunk (tối đa 4.5s)
        else RMS < Ngưỡng (Khoảng lặng > 500ms)
            VAD->>Buffer: Đóng gói Audio Chunk
            Buffer->>Queue: Đẩy Chunk vào STT Queue (kèm sequenceId)
            Buffer->>Buffer: Giải phóng bộ nhớ RAM (Sliding Window O(1))
        end
    end
```

---

### Luồng 2: Bóc Băng STT & Nhận Diện Ý Định 2 Tầng (Hierarchical Intent)
```mermaid
sequenceDiagram
    autonumber
    participant Queue as STT Job Queue
    participant Worker as Native Whisper C++ / Cloud STT
    participant Assembler as TranscriptAssembler
    participant Detector as QuestionDetector (Intent Classifier)
    participant UI as Live Transcript Pane & Decision Logs
    participant Router as Answer Strategy Router

    Queue->>Worker: Gửi Audio Chunk (Kiểm soát Concurrency: Local 1, Cloud 3)
    Worker-->>Queue: Trả về văn bản thô (Raw text)
    Queue->>Assembler: Chuyển text kèm sequenceId
    Assembler->>Assembler: Khử lặp từ ở ranh giới (Deduplication)
    Assembler->>UI: Cập nhật Lời thoại Song ngữ (Virtual Scroll 60 FPS)
    Assembler->>Detector: Kiểm tra câu thoại mới nhất
    Detector->>Detector: Lọc bỏ từ đệm ("okay", "I see", "thank you", "dạ vâng")
    alt Phát hiện ý định câu hỏi (direct_question, coding_problem, system_design...)
        Detector->>Detector: Áp dụng Adaptive Debounce (300ms - 700ms)
        Detector->>UI: Ghi nhận Trigger Decision Log (confidence, intent, reasoning)
        Detector->>Router: Bắn tín hiệu kèm câu hỏi hợp lệ và normalizedIntent
    else Câu thoại thông thường / Small Talk
        Detector-->>UI: Ghi nhận Small Talk Log (Bỏ qua kích hoạt)
    end
```

---

### Luồng 3: Local RAG, Strategy Router & Kiểm Định Grounding
```mermaid
sequenceDiagram
    autonumber
    participant Router as Answer Strategy Router
    participant RAG as Local RAG & Vector Store
    participant Prompt as PromptBuilder
    participant LLM as Smart Model Router / Universal LLM
    participant Grounding as Answer Grounding Guard
    participant UI as Copilot Suggestion Pane

    Router->>Router: Lựa chọn 1 trong 9 Strategy (STAR, CARL, Coding, System Design...)
    Router->>RAG: Truy vấn phân mảnh tài liệu liên quan (CV/JD/Projects)
    RAG-->>Prompt: Trả về ngữ cảnh RAG kèm Citations minh chứng
    Router->>Prompt: Đóng gói Prompt chuyên sâu theo Strategy đã chọn
    Prompt->>LLM: Gửi yêu cầu qua Smart Model Router
    LLM-->>Grounding: Trả về câu trả lời sơ bộ từ AI
    Grounding->>Grounding: Quét các luận điểm (Claims) & phân loại (SUPPORTED, INFERRED, UNSUPPORTED)
    Grounding->>Grounding: Đánh giá Risk Rating & sinh correctedAnswer nếu có nguy cơ ảo giác
    Grounding->>UI: Hiển thị câu trả lời hoàn chỉnh kèm Citations và Grounding Badges
```

---

### Luồng 4: Định Tuyến Mô Hình Thông Minh & Circuit Breaker Failover
```mermaid
sequenceDiagram
    autonumber
    participant App as Copilot Request
    participant Router as Smart Model Router
    participant Breaker as Provider Circuit Breaker
    participant Primary as Primary Provider (vd: Groq LPU)
    participant Fallback as Fallback Provider (vd: OpenAI / Gemini)

    App->>Router: Gửi yêu cầu (feature, modality, latencyTarget, policy)
    Router->>Router: Tính điểm ứng viên (Quality, Latency, Cost, Reliability)
    Router->>Breaker: Kiểm tra trạng thái Circuit của Provider ưu tiên
    alt Circuit Breaker trạng thái CLOSED (Hoạt động bình thường)
        Router->>Primary: Thực hiện gọi API
        alt Thành công
            Primary-->>App: Trả về kết quả AI
            Primary->>Breaker: Ghi nhận thành công & độ trễ
        else Lỗi (Timeout / 429 Rate Limit / 5xx)
            Primary-->>Breaker: Báo cáo lỗi & tăng consecutiveFailures
            Breaker->>Breaker: Chuyển trạng thái sang OPEN nếu vượt ngưỡng
            Breaker-->>Router: Kích hoạt Failover sang Fallback Chain
            Router->>Fallback: Tự động chuyển hướng gọi Provider thay thế
            Fallback-->>App: Trả về kết quả an toàn, không gián đoạn người dùng
        end
    else Circuit Breaker trạng thái OPEN (Đang bị cô lập do sự cố)
        Router->>Fallback: Bỏ qua Primary, gọi thẳng Fallback Provider
        Fallback-->>App: Trả về kết quả
    end
```

---

### Luồng 5: Checkpointing & Khôi Phục Phiên Họp Sau Sự Cố (Session Recovery)
```mermaid
sequenceDiagram
    autonumber
    participant UI as Meeting Mode (React)
    participant IPC as Electron IPC Channel
    participant Recovery as SessionRecoveryService (Main Process)
    participant Disk as Journal (.ndjson) & Snapshot (.json)

    loop Khi có sự kiện mới (transcript, câu hỏi, AI suggestion)
        UI->>IPC: Bắn sự kiện qua channel `session:recovery:append`
        IPC->>Recovery: Lưu sự kiện
        Recovery->>Disk: Append trực tiếp vào `.journal.ndjson`
    end

    loop Định kỳ mỗi 30s hoặc sau mốc quan trọng
        UI->>IPC: Bắn dữ liệu tổng thể qua channel `session:recovery:checkpoint`
        IPC->>Recovery: Ghi snapshot
        Recovery->>Disk: Ghi an toàn atomicWrite vào `.snapshot.json`
    end

    opt Khi ứng dụng bị Crash / Đột ngột tắt nguồn và mở lại
        UI->>IPC: Kiểm tra phiên dang dở qua `session:recovery:get-active`
        IPC->>Recovery: Quét thư mục recovery
        Recovery-->>UI: Trả về danh sách phiên bị ngắt quãng
        UI->>UI: Hiển thị Hộp thoại Khôi phục Phiên Họp
        alt Người dùng chọn "Khôi phục"
            UI->>UI: Phục hồi toàn bộ Transcript, Câu hỏi và Lịch sử Copilot
        else Người dùng chọn "Hủy bỏ"
            UI->>IPC: Gọi `session:recovery:discard` để dọn dẹp file tạm
        end
    end
```

---

### Luồng 6: Chụp Màn Hình & Giải Đề Bài Thị Giác
```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Main as Electron desktopCapturer
    participant Crop as ScreenshotCropOverlay
    participant OCR as OCR / Vision Service
    participant VisionAI as Multimodal LLM (Gemini Flash / GPT-4o)
    participant UI as Visual Question Card

    User->>Main: Bấm nút Chụp Màn Hình (hoặc Hotkey)
    Main-->>Crop: Chụp ảnh toàn màn hình và mở Overlay cắt ảnh
    User->>Crop: Dùng chuột kéo chọn vùng chứa đề bài / biểu đồ
    Crop->>Crop: Canvas cắt và nén ảnh (JPEG 85% tối ưu)
    Crop->>OCR: Trích xuất chữ (OCR) hoặc gửi Base64 Image
    OCR->>VisionAI: Gửi ảnh kèm Prompt giải đề lập trình chuyên sâu
    VisionAI-->>UI: Trả về đề bài đã trích xuất, code giải pháp và độ phức tạp
    UI-->>User: Hiển thị thẻ Visual Question Card kèm code copy 1-click
```

---

### Luồng 7: Giám Sát Chi Phí & Hạn Mức Ngân Sách
```mermaid
sequenceDiagram
    autonumber
    participant Request as Bất kỳ lượt gọi AI (LLM / Vision / STT)
    participant Tracker as UsageTrackerService
    participant Registry as PricingRegistry
    participant Storage as LocalStorage / State
    participant Budget as Budget Guard

    Request->>Tracker: Báo cáo hoàn tất (Provider, Model, Feature, Tokens, Seconds)
    Tracker->>Registry: Tra cứu đơn giá model ($/1M tokens, $/phút audio)
    Registry-->>Tracker: Đơn giá tương ứng
    Tracker->>Tracker: Tính toán chi phí thực tế ($USD)
    Tracker->>Storage: Ghi nhận UsageRecord và cộng dồn MonthlyUsageSummary
    Tracker->>Budget: Kiểm tra tổng chi phí so với Hạn mức tháng
    alt Chi phí >= 80% Ngân sách
        Budget-->>Storage: Bật cờ cảnh báo Budget Warning
    else Chi phí >= 100% Ngân sách
        Budget-->>Storage: Kích hoạt Hard Stop (Chặn gọi API tự động)
    end
    Tracker-->>Request: Đồng bộ số liệu sang giao diện Cost Tracker
```

---

### Luồng 8: Bảo Mật Khóa API & Mã Hóa Native
```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng (Settings)
    participant Renderer as React Renderer
    participant IPC as Electron IPC Channel
    participant SafeStore as OS safeStorage (DPAPI / Keychain)
    participant Disk as File credentials.enc.json
    participant Cloud as AI Cloud Server (Groq / OpenAI / Google)

    User->>Renderer: Nhập API Key (vd: gsk_123456789)
    Renderer->>IPC: Gửi payload qua channel credentials:save
    IPC->>SafeStore: Gọi safeStorage.encryptString(apiKey)
    SafeStore-->>IPC: Trả về Buffer mã hóa AES bằng khóa cấp OS
    IPC->>Disk: Ghi Buffer mã hóa xuống đĩa
    IPC-->>Renderer: Chỉ trả về { configured: true, maskedKey: 'gsk_••••••••6789' }
    Note over Renderer: Tuyệt đối KHÔNG lưu plaintext key trong bộ nhớ trình duyệt!
    
    rect rgb(30, 41, 59)
    Note over Renderer,Cloud: Khi cần gọi AI Inference:
    Renderer->>IPC: Gửi prompt và modelId (không gửi API Key)
    IPC->>Disk: Đọc Buffer mã hóa
    IPC->>SafeStore: Giải mã safeStorage.decryptString() trong Main Process
    IPC->>Cloud: Thực hiện HTTPS Request trực tiếp kèm Authorization Header
    Cloud-->>IPC: Trả về kết quả AI
    IPC-->>Renderer: Trả về nội dung phản hồi
    end
```

---

## 💻 Ngăn Xếp Công Nghệ (Tech Stack)

| Thành Phần | Công Nghệ Sử Dụng | Vai Trò & Chức Năng |
|---|---|---|
| **Core Framework** | **Electron 44** + **Node.js** | Nền tảng desktop, quản lý tiến trình Main, cửa sổ Overlay, Native IPC |
| **Frontend UI** | **React 19** + **TypeScript** + **Vite 8** | Giao diện HUD hiện đại, tương tác tốc độ cao, type-safety |
| **Styling** | **TailwindCSS** + **Lucide Icons** | Thiết kế giao diện Glassmorphism tối ưu, biểu tượng trực quan |
| **Audio Processing** | **Web Audio API** + **AudioWorkletNode** | Xử lý audio 16kHz mono trên luồng riêng biệt, phân tích phổ tần số |
| **Native STT** | **Whisper.cpp** (`whisper-cli.exe`) | Nhận dạng giọng nói ngoại tuyến, mô hình GGML (tiny, base) |
| **Cloud STT & LLM**| **Groq LPU** (Whisper, Llama 3.3 70B) | STT siêu tốc 120ms và suy luận ngôn ngữ độ trễ thấp |
| **AI Providers** | **OpenAI** (GPT-4o), **Google** (Gemini 1.5/2.5) | Mô hình ngôn ngữ lớn và mô hình thị giác đa phương thức (Vision) |
| **Smart Routing** | **Circuit Breaker** + Multi-objective Router | Định tuyến mô hình tối ưu theo 5 chính sách & tự động Failover |
| **RAG & Grounding**| In-memory Vector Store + Claim Classifier | Phân mảnh tài liệu, trích dẫn dẫn chứng và chống hallucination |
| **Session Recovery**| **NDJSON Journal** + Atomic Snapshot | Cơ chế khôi phục phiên họp tự động chống crash/mất điện |
| **Document Parser** | **unpdf** / **pdfjs** + **mammoth** | Trích xuất văn bản từ tài liệu PDF và DOCX ngay tại máy |
| **Bảo Mật** | **Electron safeStorage** (DPAPI/Keychain) | Mã hóa AES các API credentials cấp hệ điều hành |
| **Package Manager** | **Bun** | Quản lý gói thư viện và thực thi scripts siêu tốc |

---

## 🚀 Yêu Cầu Hệ Thống & Cài Đặt Phát Triển

### Yêu Cầu Hệ Thống:
- **Hệ điều hành**: Windows 10/11 64-bit (khuyến nghị cho bản build Local Whisper native) hoặc macOS/Linux.
- **Runtime**: [Bun](https://bun.sh/) (hoặc Node.js >= 20.x).
- **Phần cứng**: Microphone hoặc Card âm thanh hỗ trợ System Loopback Audio (Stereo Mix).
- **API Keys**: Khóa API từ ít nhất một trong các nhà cung cấp: Groq, OpenAI, Google Gemini (được cấu hình trực tiếp trong Settings).

### Cài Đặt Và Chạy Ứng Dụng:

1. Clone mã nguồn dự án:
   ```powershell
   git clone <URL_REPOSITORY>
   cd election-demo
   ```

2. Cài đặt các gói phụ thuộc bằng Bun:
   ```powershell
   bun install
   ```

3. Khởi chạy ứng dụng trong môi trường phát triển (Dev Mode):
   ```powershell
   bun run dev
   ```
   *Lệnh này sẽ tự động biên dịch mã nguồn Electron, khởi chạy Vite Dev Server và mở cửa sổ ứng dụng desktop.*

4. Đóng gói kiểm tra (Build):
   ```powershell
   bun run build
   ```

5. Kiểm tra chất lượng mã nguồn & kiến trúc:
   ```powershell
   # Kiểm tra vòng lặp phụ thuộc và các ràng buộc phân tầng kiến trúc
   bun run arch:check

   # Chạy toàn bộ 451 unit & integration tests
   bun test

   # Kiểm tra kích thước và số dòng các tệp mã nguồn
   bun run size:report

   # Pipeline kiểm tra toàn diện trước khi commit (Typecheck + Lint + Test + Build)
   bun run check
   ```

---

## 🎙️ Cấu Hình Local Whisper C++ Native

Để sử dụng chế độ bóc băng giọng nói **100% Offline** không cần kết nối internet:

1. Đặt tệp thực thi `whisper-cli.exe` vào thư mục:
   ```
   resources/bin/whisper-cli.exe
   ```
   *(Xem hướng dẫn chi tiết tại `resources/bin/README.txt`)*

2. Tải mô hình GGML (định dạng `.bin`, ví dụ `ggml-tiny.bin` hoặc `ggml-base.bin`) và đặt vào:
   ```
   resources/models/ggml-base.bin
   ```
   *(Xem hướng dẫn chi tiết tại `resources/models/README.txt`)*

3. Mở ứng dụng, vào **Settings** $\to$ **STT Engine**, chọn **Local Whisper C++** và bấm **Health Check** để xác nhận engine đã sẵn sàng hoạt động.

> [!NOTE]
> Do kích thước lớn, các file nhị phân `.exe` và model `.bin` được đưa vào `.gitignore` và không commit lên kho mã nguồn Git.

---

## 🔒 Chính Sách Bảo Mật & Dữ Liệu Riêng Tư

1. **Bảo Mật API Key Tuyệt Đối**:
   - Tất cả API Key đều được mã hóa bằng **Windows DPAPI** (trên Windows) hoặc **Apple Keychain** (trên macOS) thông qua API native `safeStorage` của Electron.
   - Không lưu secret dưới dạng plaintext trong `localStorage`, `IndexedDB` hay git repository.
   - Renderer chỉ nhận diện khóa dưới dạng đã che: `gsk_••••••••1234`.

2. **Dữ Liệu Cuộc Họp Lưu Cục Bộ**:
   - Toàn bộ hồ sơ ứng viên (Profiles), nội dung CV, JD, bản ghi âm, transcript, nhật ký recovery và kết quả phân tích AI đều được lưu trữ trực tiếp trên máy người dùng trong thư mục `userData/sessions/`.
   - Người dùng có toàn quyền xem, tìm kiếm, chỉnh sửa, xóa từng phần hoặc xóa sạch toàn bộ lịch sử.

3. **Chính Sách Chuyển Giao Dữ Liệu Đám Mây**:
   - Khi sử dụng Local Whisper C++ và Local-only routing policy, dữ liệu âm thanh và văn bản hoàn toàn không rời khỏi máy tính của bạn.
   - Khi sử dụng Cloud STT hoặc Cloud LLM, chỉ các đoạn audio/text liên quan đến câu hỏi mới được gửi qua kết nối HTTPS bảo mật tới nhà cung cấp tương ứng theo chính sách quyền riêng tư của họ.

---

## 📄 Bản Quyền & Giấy Phép (License)

Dự án phát triển nội bộ cho mục đích nghiên cứu, demo và hỗ trợ phỏng vấn/cuộc họp. Mọi quyền được bảo lưu.
