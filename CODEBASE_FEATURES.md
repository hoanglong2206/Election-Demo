# BÁO CÁO PHÂN TÍCH TOÀN BỘ CODEBASE & LỘ TRÌNH TỐI ƯU / NÂNG CẤP

> **Dự án**: Electron AI Meeting & Interview Copilot  
> **Kiến trúc**: React 19 + TypeScript + Vite + Electron 44 + Whisper C++ Native + OS Credential Store  
> **Thời gian phân tích**: 16/10/2026  

---

## 🏗️ 1. TỔNG QUAN KIẾN TRÚC TOÀN HỆ THỐNG

Ứng dụng được thiết kế theo mô hình **Overlay HUD / Copilot đa tầng**, gồm 2 process riêng biệt:

1. **Electron Main Process (Native Infrastructure)**:
   - **Overlay Window Controller**: Quản lý cửa sổ vô viền (frameless), nền trong suốt, ghim trên cùng (always-on-top), auto-anchor góc phải màn hình.
   - **WhisperProcessManager**: Native worker quản lý tiến trình `whisper-cli.exe` C++, watchdog giám sát crash/freeze, timeout (8-15s), retry queue, quản lý download model GGML.
   - **OS Credential Store**: Sử dụng `safeStorage` (Windows DPAPI / macOS Keychain / Linux Secret Service) mã hóa AES cipher trên đĩa (`credentials.enc.json`), tuyệt đối không gửi plaintext key về React Renderer.
   - **Session Storage**: Lưu trữ session lịch sử dạng file JSON độc lập trong `userData/sessions/`.

2. **React Renderer Process (UI & Audio/AI Pipeline)**:
   - **Audio Pipeline**: Web Audio API bắt Microphone & Loopback System Audio (chia sẻ màn hình/hệ thống âm thanh), phân tách dải tần FFT 8-band, bộ lọc VAD (Voice Activity Detection), resampler 16kHz mono PCM.
   - **STT Job Queue**: Hàng đợi trung gian điều tiết tải, kiểm soát concurrency (Local: 1 worker, Cloud: 3 workers), gắn `jobId`, `sequenceId`, xử lý backpressure và drop silence chunk.
   - **Question Detector**: Phân tích intent câu hỏi siêu tốc (heuristic + debounce 300-700ms), lọc bỏ câu đệm giao tiếp ("okay", "thank you").
   - **Tiered Context Manager**: Quản lý token 4 tầng (Permanent Context $\to$ Session Memory Rolling Summary $\to$ Short-term Utterances $\to$ Current Question).
   - **Universal LLM & Response Engine**: Gọi AI Main Process IPC bảo mật hoặc Cloud provider, sinh câu trả lời STAR song ngữ (Anh - Việt), tóm tắt cuộc họp.

---

## 📄 2. PHÂN TÍCH CHI TIẾT TỪNG TRANG & MODULE

---

### TRANG 1: HOME (Chuẩn Bị & Phân Tích Trước Cuộc Họp)
*File chính: `src/app/features/home/Home.tsx` và `src/app/features/home/components/`*

#### 1. Chức năng hiện có:
- **Hero Launch Bar**:
  - Chọn chế độ ứng dụng: **Interview Mode** (Phỏng vấn ứng viên) hoặc **Discussion Mode** (Hội thảo / Họp bàn công việc).
  - Nút khởi động nhanh vào cuộc họp "Bắt đầu cuộc họp", kiểm tra điều kiện context trước khi vào.
- **Context Editor Card (Trọng tâm)**:
  - Cho phép nhập CV ứng viên, Job Description (JD) hoặc Chủ đề thảo luận.
  - Tích hợp **Document Parser** đọc trực tiếp file `.pdf` (qua unpdf/pdfjs), `.docx` (qua mammoth), `.txt` lên tới 15.000 ký tự.
  - Hiển thị ước tính lượng token ngữ cảnh theo thời gian thực (`estimateTokenCount`).
  - Hỗ trợ nạp nhanh dữ liệu mẫu: Sample CV Senior Developer, Sample JD Software Engineer, Sample Discussion.
- **Phân tích tương thích CV - JD (CV-JD Match Analysis)**:
  - Tích hợp cả thuật toán Heuristic (offline không tốn token) và AI Deep Matching.
  - Hộp thoại `CvJdMatchDialog` hiển thị điểm match (0-100%), kỹ năng trùng khớp, kỹ năng còn thiếu (gap), và gợi ý các câu hỏi phỏng vấn hóc búa có khả năng bị hỏi nhất.
- **Audio Device Selector Card**:
  - Quét và liệt kê danh sách thiết bị âm thanh hệ thống (Microphone & Loopback audio).
  - Nút quét lại thiết bị (Refresh devices).
- **AI Model Selector Card**:
  - Chọn model AI đồng hành (Groq, OpenAI, Google Gemini).
  - Nút **Test Ping**: Đo độ trễ HTTP thực tế (Round-trip ping ms) tới server AI.
- **Recent Sessions Card**:
  - Hiển thị 2 cuộc họp gần nhất, thống kê thời lượng, số câu hỏi, truy cập nhanh sang trang Lịch sử.

#### 2. Điểm cần tối ưu (Bottlenecks):
- **Phân tích CV/JD chưa được cache vào disk**: Khi người dùng tải lên file PDF 5 trang và phân tích AI, kết quả match dialog chỉ lưu trong React state; nếu tải lại app phải phân tích lại.
- **Chưa có OCR cho CV/JD dạng ảnh scan**: `unpdf` và `mammoth` chỉ trích xuất text thuần (vector PDF / text docx). Nếu người dùng tải CV dạng PDF scan (chỉ có ảnh raster) sẽ bị rỗng text.
- **Tràn text ở khung soạn thảo CV/JD**: Với tài liệu dài 10.000+ từ, việc render thẻ `<textarea>` lớn gây giảm FPS khi gõ phím.

#### 3. Đề xuất nâng cấp (Feature Upgrades):
- [ ] **Lưu Profile / Bộ Context Template**: Cho phép người dùng lưu nhiều bộ "Profile CV" và "Hồ sơ ứng tuyển" khác nhau (ví dụ: Profile Frontend, Profile DevOps, Profile Manager) để chuyển đổi bằng 1 click.
- [ ] **Tích hợp Tesseract.js / Native OCR**: Tự động nhận diện chữ từ CV dạng ảnh chụp hoặc scan.
- [ ] **Pre-meeting AI Prep (Flashcards)**: Sinh bộ 10 câu hỏi phỏng vấn chuẩn bị trước cùng câu trả lời gợi ý để người dùng luyện tập trước giờ G.

---

### TRANG 2: MEETING MODE (Trợ Lý Realtime Trong Cuộc Họp)
*File chính: `src/app/features/meeting-mode/MeetingMode.tsx` và `src/app/features/meeting-mode/components/`*

#### 1. Chức năng hiện có:
- **Audio Capture & VAD Realtime**:
  - Thu âm 2 chiều: Microphone người dùng + Loopback âm thanh từ ứng dụng gọi điện (Google Meet, Zoom, Teams qua màn hình chia sẻ).
  - VAD tự động cắt lát audio thành các chunk 1.5 - 4.5 giây dựa trên độ lớn âm lượng và khoảng lặng.
- **STT Job Queue & Transcript Assembler**:
  - Audio chunk gửi vào `sttJobQueue` với concurrency control (Local Whisper = 1 worker để tránh nghẽn CPU, Cloud = 3 workers).
  - Giữ đúng thứ tự transcript theo `sequenceId`, tự động drop chunk im lặng.
- **Audio Visualizer Loop độc lập**:
  - Chạy trên `requestAnimationFrame` độc lập ngoài React state $\to$ giữ vững **60 FPS**, không tốn CPU vẽ lại component.
- **Live Transcript Pane (Ảo hóa danh sách)**:
  - Hiển thị transcript thời gian thực song ngữ (gốc + dịch).
  - Ảo hóa danh sách hội thoại (Virtual scrolling) đảm bảo cuộc họp 90 phút (hàng nghìn dòng) không giật lag DOM và không rò rỉ RAM.
  - Thanh tìm kiếm từ khóa trong transcript, nút chuyển đổi auto-scroll, xuất file transcript ra `.txt`.
- **Question Detector & Intent Filter**:
  - Tự động nhận diện câu hỏi từ người phỏng vấn / đối tác bằng heuristic pattern (who, what, why, can you, dấu chấm hỏi) kết hợp merge câu bị Whisper chia nhỏ.
  - Lọc bỏ triệt để các câu đệm giao tiếp ("okay", "I see", "thank you").
- **Tiered Context Copilot & Suggestion Pane**:
  - Context đa tầng 4 lớp (Permanent Context $\to$ Session Rolling Summary $\to$ 10-20 utterances $\to$ Active Question).
  - Sinh câu trả lời phỏng vấn theo phương pháp **STAR (Situation, Task, Action, Result)**.
  - Tùy chọn ngôn ngữ phản hồi: Tiếng Anh, Tiếng Việt hoặc Song ngữ (Bilingual).
  - Nút **Rút ngắn câu trả lời (Shorten)**, **Tạo lại câu trả lời (Regenerate)**, Copy nhanh 1-click.
  - Gợi ý trước các câu hỏi tiếp theo có thể bị hỏi (Follow-up Questions).
- **Meeting Summary & Tự Động Lưu Session**:
  - Tự động sinh biên bản cuộc họp / tóm tắt kết luận khi kết thúc.
  - Tự động lưu toàn bộ transcript, thống kê thời lượng, số lượng câu hỏi vào SQLite/JSON Session Storage.

#### 2. Điểm cần tối ưu (Bottlenecks):
- **Phân tách người nói (Diarization)**: Hiện tại app nhận diện theo nguồn input (Mic = Bạn, Loopback = Đối tác). Nếu đối tác có 2 người nói cùng bật mic trên Google Meet, transcript chưa phân biệt được Speaker A vs Speaker B.
- **Xử lý ngắt lời / Overlapping Speech**: Khi cả người dùng và đối tác nói cùng lúc, audio loopback và mic có thể bị lồng tiếng nếu không bật echo cancellation.
- **Dung lượng RAM Audio Buffer [ĐÃ HOÀN TẤT & TỐI ƯU TRIỆT ĐỂ]**: Đã triển khai `AudioBufferManager` dạng Bounded Sliding Window (giới hạn 15.0s ~480KB) kết hợp state machine `recording` → `queued` → `processing` → `released`. Chuyển ngay các reference `Float32Array`/`Blob` về `null` sau khi STT trả kết quả hoặc thất bại quá retry limit. RAM duy trì ở mức O(1) ổn định ~0.45 MB thay vì tăng tuyến tính lên 230 MB sau 120 phút.

#### 3. Đề xuất nâng cấp (Feature Upgrades):
- [ ] **Speaker Diarization (AI Nhận dạng giọng nói)**: Gán nhãn "Interviewer 1", "Interviewer 2" dựa trên âm sắc giọng nói.
- [ ] **Stealth Teleprompter Mode (Chế độ nhắc chữ siêu gọn)**: Thu nhỏ cửa sổ HUD thành 1 thanh mỏng trong suốt phía trên camera để ánh mắt người dùng luôn nhìn thẳng vào webcam khi đọc gợi ý.
- [ ] **Hotkeys / Phím tắt toàn cục (Global Shortcuts)**: Bấm tổ hợp phím (ví dụ `Ctrl + Shift + Space`) để lập tức ép AI trả lời ngay câu vừa nghe mà không cần nhấp chuột.

---

### TRANG 3: AUDIO TEST & DIAGNOSTICS (Phòng Lab Đo Lường & Benchmark)
*File chính: `src/app/features/audio-test/AudioTest.tsx` và `src/app/features/audio-test/components/`*

#### 1. Chức năng hiện có:
- **Audio Controls & Source Selector**:
  - Chuyển đổi linh hoạt giữa Micro vật lý và System Audio Loopback.
  - Nút Bắt đầu / Dừng thu âm, ghi âm và nghe lại (Playback buffer), tải file `.wav` về máy để đối chiếu chất lượng âm thanh.
- **Audio Signal Monitor**:
  - Đồng hồ đo mức âm lượng VU meter theo Decibel (-60dB đến 0dB).
  - Phân tích phổ tần số âm thanh 8 băng tần (Frequency Bands Visualizer).
  - Đo thời lượng buffer (Buffer duration) và dung lượng RAM của buffer âm thanh.
- **Pipeline Stages Monitor**:
  - Trực quan hóa 5 chặng xử lý âm thanh theo thời gian thực: `Capture` $\to$ `VAD Gate` $\to$ `Resampler 16kHz Mono` $\to$ `STT Job Queue` $\to$ `AI Inference Engine`.
- **STT Preview & Queue Metrics**:
  - Xem trước bản dịch STT từ giọng nói thật hoặc từ các audio sample mẫu có sẵn (YouTube tech interview, business call).
  - Bảng chỉ số hàng đợi STT: `queueDepth`, `processingJobs`, `droppedJobs`, `averageWaitTime`.
- **AI Benchmark Card**:
  - Chạy benchmark đo tốc độ sinh token (tokens/second) và thời gian phản hồi đầu tiên (Time to First Token - TTFT) của các LLM.

#### 2. Điểm cần tối ưu:
- **Tần số lấy mẫu mặc định**: Đã đồng bộ Resampling về chuẩn 16,000Hz ở tầng Web Audio `AudioWorkletNode` độc lập, triệt tiêu drop frame khi CPU chính bận.

#### 3. Tính năng & Nâng cấp mới:
- [x] **Web Audio AudioWorklet**: Thay thế toàn bộ callback legacy bằng `AudioWorkletNode` chạy ở audio thread riêng biệt (`AudioWorkletCaptureEngine`), tự động fallback sang `ScriptProcessorCaptureEngine` nếu platform không hỗ trợ AudioWorklet.
- [x] **Tự Động Cân Chỉnh VAD Theo Môi Trường (Automatic VAD Calibration)**:
  - **Thuật toán & Phân vị IQR**: Thu mẫu 3.0s (60 khung 50ms) bằng chính audio pipeline thực tế; tính toán RMS và dBFS theo khung; dùng khoảng tứ phân vị $IQR = Q3 - Q1$ loại bỏ triệt để các spike đột ngột (tiếng click chuột, gõ phím, tiếng cọ micro).
  - **Noise Floor & Ngưỡng Kích Hoạt**: Tính toán noise floor ở phân vị 65th của các khung inlier; cộng thêm `safetyMargin` cấu hình được (+3dB, +6dB, +9dB) để suy ra `speechThreshold` và độ nhạy VAD (0.0 - 1.0).
  - **Chất Lượng Môi Trường & Guards**: Phân loại chất lượng môi trường phòng (`pristine`, `good`, `moderate`, `noisy`, `critical`). Trang bị guard bảo vệ: tự động hủy bỏ và cảnh báo nếu phòng quá ồn (> -20 dBFS) hoặc nếu người dùng nói chuyện liên tục trong quá trình đo (> 40% thời lượng).
  - **Device Isolation & Multi-Microphone**: Lưu trữ kết quả đo theo từng mã phần cứng microphone (`deviceId`). Khi chuyển đổi microphone, hệ thống cách ly tuyệt đối cấu hình và Meeting Mode tự động nạp ngưỡng VAD tương ứng của thiết bị đó làm mặc định.

---

### TRANG 4: SESSION HISTORY (Quản Lý & Hậu Kỳ Cuộc Họp)
*File chính: `src/app/features/session-history/SessionHistory.tsx` và `src/app/features/session-history/components/`*

#### 1. Chức năng hiện có:
- **Bố cục Master-Detail & Sidebar Đa Bộ Lọc**:
  - Cột trái: Danh sách các session với bộ lọc nâng cao: theo chế độ (Tất cả, Phỏng vấn, Thảo luận), theo Profile ứng viên/vị trí (`Frontend Dev`, `DevOps Lead`), theo khoảng thời gian (`Hôm nay`, `7 ngày qua`, `30 ngày qua`, `Tất cả`), tìm kiếm theo công ty / role.
  - **Full-Text Search Toàn Diện**: Tìm kiếm tức thì trong tiêu đề, tên model, nội dung transcript tiếng Anh và tiếng Việt dịch nghĩa, nội dung gợi ý AI, và chữ OCR trích xuất từ câu hỏi ảnh màn hình.
  - Hỗ trợ đổi tên session trực tiếp (inline rename), xóa từng session hoặc chọn nhiều để xóa hàng loạt (Bulk delete) với hộp thoại xác nhận `ConfirmDialog`.
- **Session Detail View & Dòng Thời Gian Tích Hợp (Interactive Timeline)**:
  - Header: Ngày giờ, thời lượng, profile snapshot, tên công ty, số lượng tương tác, thống kê token và ước tính chi phí API ($USD).
  - **Tab 1 - Dòng Thời Gian (Unified Timeline)**: Hiển thị dòng thời gian tích hợp theo thứ tự thời gian thực, phân biệt rõ ràng:
    - *Câu hỏi người phỏng vấn* (Theme màu hổ phách, gắn nhãn Question).
    - *Câu trả lời của bạn* (Theme màu tím, nhãn You).
    - *Gợi ý AI STAR Copilot* (Theme phát sáng emerald/violet, gắn nhãn độ tự tin và nút copy).
    - *Câu hỏi hình ảnh từ màn hình (Screenshot Question)* (Theme cyan/indigo, trích xuất OCR, tóm tắt và code giải pháp).
  - **Tương Quan Ngữ Cảnh (Click-to-Correlate)**: Bấm vào timestamp của bất kỳ sự kiện nào để tự động định vị và highlight câu hỏi / câu trả lời AI tương ứng.
  - **Tab 2 - Lời Thoại Song Ngữ**: Danh sách transcript gốc và dịch nghĩa, hỗ trợ phân trang progressive load (40-50 dòng mỗi đợt) chống giật lag DOM khi cuộc họp dài.
  - **Tab 3 - Gợi Ý AI Copilot**: Toàn bộ câu trả lời cấu trúc STAR kèm chỉ số token/chi phí.
  - **Tab 4 - Ảnh Màn Hình (Visual Coding)**: Xem lại toàn bộ câu hỏi coding/diagram chụp từ màn hình.
  - **Tab 5 - Chia Đôi (Split 50:50)**: Đối chiếu song song lời thoại và gợi ý AI.
- **Xuất Dữ Liệu Chuyên Nghiệp & Schema v2.0**:
  - Xuất báo cáo Markdown chi tiết (gồm Profile, Timeline, Lời thoại song ngữ, Gợi ý STAR, Câu hỏi hình ảnh OCR, Metrics).
  - Xuất file JSON chuẩn Schema v2.0 phục vụ sao lưu và phân tích.
  - Xuất PDF in ấn trực tiếp (`exportSessionToPDF`).
- **Chính Sách Lưu Trữ Cục Bộ (Local Retention Policy)**:
  - Tùy chọn tự động dọn dẹp phiên họp cũ: Vĩnh viễn (0), 7 ngày, 30 ngày, 90 ngày.
  - Tự động xóa sạch artifact hình ảnh/bộ nhớ đệm liên quan khi session bị xóa.

#### 2. Điểm cần tối ưu:
- **Dung lượng lưu trữ JSON**: Mỗi session hiện lưu transcript và gợi ý vào JSON trong `userData/sessions/`. Nếu có hàng trăm session dài 90 phút, việc đọc toàn bộ danh sách khi khởi động có thể làm chậm app. Cần phân trang (pagination) hoặc lazy-load phần transcript chi tiết.

#### 3. Đề xuất nâng cấp:
- [ ] **Export sang Markdown & PDF chuyên nghiệp**: Xuất báo cáo biên bản phỏng vấn / cuộc họp có format đẹp kèm logo, bảng điểm đánh giá ứng viên.
- [ ] **AI Session Post-Mortem (Đánh giá năng lực sau phỏng vấn)**: Thêm nút "Đánh giá ứng viên" để AI tổng hợp toàn bộ câu trả lời, chấm điểm ứng viên theo thang điểm 10 trên từng tiêu chí (Chuyên môn, Giao tiếp, Tư duy phản biện).

---

### TRANG 5: SETTINGS & SECURITY (Cấu Hình & An Toàn Dữ Liệu)
*File chính: `src/app/features/settings/Settings.tsx` và `src/app/features/settings/components/`*

#### 1. Chức năng hiện có:
- **Khóa API AI (Bảo Mật Bằng OS Credential Store)**:
  - Tích hợp **Windows Credential Manager / DPAPI, macOS Keychain**.
  - Không lưu bất kỳ API key dạng plaintext nào trong `localStorage`, `IndexedDB` hay `settings.json`.
  - Renderer chỉ nhận trạng thái `configured: true` và `maskedKey` (`gsk_••••••••1234`).
  - Hỗ trợ Groq, OpenAI, Google Gemini.
  - Có chức năng **Kiểm tra khóa (Verify)**, **Xóa/Thu hồi khóa (Revoke/Delete)**, **Tự động di chuyển (Migration)** từ key cũ và xóa sạch plaintext key.
  - Xuất cấu hình an toàn (`exportSanitizedSettings`) loại bỏ 100% secret.
- **STT Engine Card (Động Cơ Bóc Băng)**:
  - Tách biệt hoàn toàn Local Whisper C++ và Cloud STT.
  - Hỗ trợ Local Whisper chạy native worker độc lập: theo dõi trạng thái process (`READY`, `BUSY`, `STOPPED`, `FAILED`), quản lý tải model offline (tiny, base, small, medium).
  - Nút kiểm tra sức khỏe Native Engine (`healthCheck`) và đo độ trễ thực tế.
- **LLM Engine Card (Mô Hình AI Copilot)**:
  - Lựa chọn linh hoạt AI Model từ Groq, OpenAI, Google.
  - Nút đồng bộ danh sách model từ API (`syncModels`).
- **Meeting & Audio Config Card**:
  - Chọn thiết bị micro mặc định.
  - Điều chỉnh ngưỡng nhạy VAD (0.1 - 1.0) để lọc tiếng ồn quạt/bàn phím.
  - Chọn ngôn ngữ phản hồi AI: Tiếng Việt, Tiếng Anh, Song ngữ.
  - Bật/tắt chế độ cá nhân hóa câu trả lời theo kinh nghiệm trong CV.

#### 2. Điểm cần tối ưu:
- **Auto-restart Notification**: Khi người dùng thay đổi các cấu hình native của Whisper, cần có tín hiệu thông báo rõ ràng nếu tiến trình cần khởi động lại.

#### 3. Đề xuất nâng cấp:
- [ ] **Local LLM Offline (Ollama / Llama.cpp)**: Bổ sung tùy chọn kết nối Ollama local (`http://localhost:11434`) để app có thể chạy **100% Offline** (cả Local Whisper STT + Local Llama 3 LLM), bảo mật dữ liệu tuyệt đối cho các cuộc họp bí mật của doanh nghiệp.
- [ ] **Giới hạn chi phí API (Cost & Token Tracker)**: Thống kê số lượng token và ước tính chi phí API đã sử dụng trong tháng cho từng provider.

---

## 🧭 3. MA TRẬN ƯU TIÊN NÂNG CẤP (PRIORITY MATRIX)

| Hạng mục | Độ ưu tiên | Lợi ích mang lại | Độ phức tạp |
| :--- | :---: | :--- | :---: |
| **1. AudioWorklet Node Migration** | **P0 (Cao nhất)** | Triệt tiêu hoàn toàn hiện tượng méo tiếng/giật âm thanh khi CPU cao | Trung bình |
| **2. Global Shortcuts / Stealth Teleprompter** | **P0 (Cao nhất)** | Trải nghiệm phỏng vấn/họp tự nhiên, nhìn thẳng camera, thao tác không cần chuột | Dễ |
| **3. Post-Meeting AI Evaluation (Báo cáo sau họp)** | **P1 (Cao)** | Tạo giá trị gia tăng lớn: tự động chấm điểm ứng viên, lập biên bản họp gửi email | Dễ |
| **4. Local LLM (Ollama) Integration** | **P1 (Cao)** | Hỗ trợ môi trường làm việc 100% offline, bảo mật tuyệt đối cho doanh nghiệp | Trung bình |
| **5. Speaker Diarization (Phân biệt người nói)** | **P2 (Trung bình)** | Tách bạch rõ ràng từng người trong cuộc họp đông người | Khá |
| **6. Lazy-load & Pagination cho Session History** | **P2 (Trung bình)** | Tối ưu thời gian khởi động app khi có hàng trăm cuộc họp đã lưu | Dễ |

---

## 🎯 4. KẾ HOẠCH HÀNH ĐỘNG TIẾP THEO

1. **Bước 1**: Nâng cấp trải nghiệm giao diện phỏng vấn với **Chế độ Teleprompter / HUD Thu gọn** và **Phím tắt toàn cục (Global Hotkeys)**.
2. **Bước 2**: Chuyển đổi audio pipeline sang **AudioWorklet** để tối ưu hóa triệt để độ mượt mà của âm thanh.
3. **Bước 3**: Bổ sung tính năng **Tự động xuất báo cáo đánh giá ứng viên (Candidate Evaluation Report)** sau khi kết thúc phỏng vấn.
