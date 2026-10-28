# Kiến Trúc Ứng Dụng Meeting Copilot (Electron + React + TypeScript)

Tài liệu này xác định chuẩn kiến trúc phân tầng tiến hóa (evolutionary layered architecture), các quy tắc phụ thuộc, quy ước tổ chức mã nguồn, giới hạn kích thước và quy trình mở rộng/kiểm thử cho toàn bộ dự án sau khi hoàn tất 5 lát cắt tái cấu trúc (S0 - S5).

---

## 1. Cây Thư Mục Thực Tế (Final Architecture Directory Tree)

```text
src/
├─ common/                          # Hợp đồng IPC dùng chung Main + Renderer (Zod schema, channels, types)
│                                   # TUYỆT ĐỐI KHÔNG import React hoặc Electron
├─ electron/
│  ├─ main.ts  preload.ts  window/
│  ├─ ipc/
│  │  ├─ index.ts                   # registerAllHandlers()
│  │  └─ handlers/                  # {window, whisper, sessions, capture, credentials, llm, usage}.ts
│  └─ services/
│     ├─ whisper/                   # {whisperProcessManager, nativeWhisper, hallucinationFilter, wavHeader}
│     ├─ credentials/               # {credentialStore, credentialSchema}
│     ├─ llm/                       # {llmService, sseParser, benchmark, modelDefaults}
│     ├─ sessions/                  # {sessionStorage, sessionRecovery, mediaProtocol}
│     └─ usage/                     # {usageStorage}
└─ app/
   ├─ core/                         # Miền lõi toán học / DSP / Audio thuật toán thuần túy
   │  ├─ audio/                     # Audio buffer (ring buffer), RMS/dBFS, VAD, SpeechSegmenter, AudioTelemetry
   │  └─ types/                     # Kiểu dữ liệu miền lõi
   ├─ infrastructure/               # Cổng giao tiếp ngoại vi (Web Audio & IPC)
   │  ├─ audio/                     # WebAudio context, AudioPipelineController, worklet processor loader
   │  │  └─ worklet/                # audioCaptureProcessor.ts (AudioWorklet engine)
   │  └─ ipc/                       # Typed IPC Ports (windowPort, capturePort, whisperPort, sessionsPort, usagePort, credentialsPort)
   ├─ services/                     # Tầng domain services (KHÔNG React, KHÔNG import components/features)
   │  ├─ ai-model/                  # model-registry, model-router, copilot, stt (sttJobQueue), translation, intent, strategy, grounding
   │  ├─ screen-capture/            # screenCaptureService, visualQuestionAnalyzer
   │  ├─ session-history/           # repository, indexedDbRepository
   │  ├─ settings/                  # settingsManager, schema
   │  ├─ usage-tracker/             # usageTrackerService, pricingRegistry
   │  └─ vad-calibration/           # vadCalibrationStorage
   ├─ hooks/                        # Hook dùng chung (>= 2 features): useLatest, useTimeout, useInterval, useAudioPipeline...
   ├─ components/
   │  ├─ ui/                        # Dumb UI components (Tailwind): button, card, modal, toast, scroll-area...
   │  ├─ layout/                    # Layout, Header, Sidebar
   │  └─ shared/                    # Component ghép dùng >= 2 features (ScreenCaptureSourcePicker, ScreenshotCropOverlay...)
   ├─ features/                     # Các vùng tính năng độc lập đóng gói hoàn chỉnh
   │  ├─ home/                      # Chuẩn bị ngữ cảnh, Profile preset, Context file RAG
   │  ├─ meeting-mode/              # HUD Overlay, Live transcript, Copilot suggestion, Visual QA, Session recovery
   │  ├─ settings/                  # Cấu hình AI models, Whisper STT, Audio devices, API keys, Hotkeys
   │  ├─ session-history/           # Xem lại lịch sử cuộc họp, xuất Markdown/JSON/TXT, tìm kiếm
   │  ├─ cost-tracker/              # Giám sát ngân sách, biểu đồ chi phí API, lịch sử giao dịch token
   │  ├─ audio-test/                # Phòng lab đo lường âm thanh, cân chỉnh VAD, kiểm tra mic & loopback
   │  └─ ai-diagnostic/             # Benchmark tốc độ model, kiểm tra OCR vision & phân loại câu hỏi
   ├─ lib/                          # Tiện ích chung, helper thuật toán (cn, utils...)
   ├─ types/                        # Global type declarations (electron.d.ts, streaming.ts...)
   ├─ App.tsx
   └─ main.tsx
```

---

## 2. Quy Tắc Phụ Thuộc (Strict Layered Inversion)

Kiến trúc tuân theo mô hình phân tầng nghiêm ngặt (Strict Layered Inversion), được tự động kiểm tra và cưỡng chế qua AST Rules trong ESLint:

| Tầng | Được phép Import | Bị CẤM Import | Ghi chú |
| :--- | :--- | :--- | :--- |
| **`core/`** | `core/types`, standard libs | Mọi tầng khác (`services`, `features`, `infrastructure`, `hooks`, `components`, `React`) | Thuần toán học & DSP |
| **`infrastructure/`**| `core/`, `lib/`, `@common/` | `services/`, `features/`, `components/`, `hooks/` | Giao tiếp phần cứng & OS |
| **`services/`** | `core/`, `infrastructure/ipc/`, `lib/`, `@common/` | `react`, `react-dom`, `components/`, `features/`, direct `window.api` | Nghiệp vụ domain; không UI |
| **`components/ui/`** | `lib/`, `lucide-react` | `services/`, `features/`, `hooks/`, `infrastructure/` | Dumb UI primitives |
| **`components/shared/`**| `services/`, `core/`, `lib/`, `components/ui/`, `hooks/` | `features/` | Ghép dùng $\ge 2$ features |
| **`features/<A>/`** | `services/`, `core/`, `infrastructure/ipc/`, `hooks/`, `components/`, `features/<B>` (chỉ qua `index.ts`) | **Ruột `features/<B>/*`** (cấm import sâu nội bộ feature khác) | Đóng gói tính năng |

### Nguyên tắc gọi IPC (Cưỡng Chế Ở Mức ERROR):
* **CẤM TUYỆT ĐỐI** gọi trực tiếp `window.api.*` trong các service, hook và component.
* **BẮT BUỘC** gọi qua các Typed Ports nằm trong `@/infrastructure/ipc/` (`windowPort`, `capturePort`, `whisperPort`, `sessionsPort`, `usagePort`, `credentialsPort`).
* Nhờ vậy, tầng Renderer hoàn toàn độc lập với Electron runtime, dễ dàng viết unit tests giả lập (MockIpcAdapter) mà không cần fake global `window`.

---

## 3. Ranh Giới Module Âm Thanh (Audio Architecture Boundaries)

Logic âm thanh được phân tách thành 4 tầng rõ rệt:

1. **`core/audio/`** (Thuần TS / DSP):
   - `AudioBufferManager`: Ring buffer quản lý mẫu âm thanh float32, trích xuất đoạn âm thanh (slicing), chuyển đổi PCM 16-bit WAV.
   - `SpeechSegmenter`: Nhận diện khoảng lặng (silence hangover) và cắt phân đoạn giọng nói.
   - `AudioTelemetry`: Đo lường RMS, peak dBFS và năng lượng giọng nói.
2. **`infrastructure/audio/`** (Trình điều khiển phần cứng / Web Audio):
   - `AudioPipelineController`: Vòng đời khởi tạo Web Audio Context, nạp `AudioWorkletNode`, kết nối luồng microphone và luồng hệ thống loopback.
3. **`services/ai-model/stt/`** (Hàng đợi & Nghiệp vụ STT):
   - `sttJobQueue`: Điều phối tuần tự/đồng thời các yêu cầu bóc băng, chuyển đổi qua lại giữa Local Whisper native và Cloud STT.
4. **`hooks/useAudioPipeline.ts`** (React Adapter):
   - Hook mỏng kết nối `AudioPipelineController` với React tree, cung cấp reactive state cho UI.

---

## 4. Hướng Dẫn Phát Triển

### A. Cách Thêm Một Feature Mới:
Mỗi feature mới bắt buộc phải tuân theo cấu trúc mô-đun hóa:
```text
src/app/features/<feature-name>/
├── <FeatureName>.tsx       # Container Component (<= 600 dòng, chỉ nối hooks & layout)
├── index.ts                # Public API (export FeatureName và các type công khai)
├── types.ts                # Kiểu dữ liệu nội bộ của feature
├── hooks/                  # Custom hooks nghiệp vụ của feature (<= 300 dòng/hook)
├── controllers/            # Pure TS logic (state machine, debounce, transforms)
└── components/             # Sub-components được nhóm theo chức năng
    ├── <group-a>/          # Mỗi file component <= 400 dòng
    └── <group-b>/
```

### B. Cách Thêm Một Service Mới:
1. Tạo thư mục trong `src/app/services/<service-name>/`.
2. **Không import React**: Tách biệt logic nghiệp vụ khỏi chu kỳ render UI.
3. Nếu cần giao tiếp IPC: Chỉ import typed port tương ứng từ `@/infrastructure/ipc`.
4. Xuất khẩu các phương thức qua `index.ts`.
5. Viết unit test đi kèm trong `__tests__/<serviceName>.test.ts`.

### C. Quy Trình Kiểm Thử (Testing Guidelines):
* **Pure Logic Tests**: Kiểm thử các controller, reducer, DSP algorithms bằng `bun test` kết hợp fake timers (ví dụ: `jest.useFakeTimers()` hoặc mô phỏng `performance.now()`).
* **Hook Tests**: Kiểm thử bằng `renderHook` từ `@testing-library/react`.
* **IPC Schema Tests**: Mọi schema trong `src/common/ipc/schemas.ts` phải có test xác thực dữ liệu đầu vào và đầu ra.

---

## 5. Quy Trình Kiểm Tra Chất Lượng Mã Nguồn (CI / Pre-commit Gate)

Chạy pipeline kiểm thử toàn diện trước khi commit:
```powershell
# 1. Kiểm tra vòng lặp phụ thuộc (0 cycles) và kiến trúc phân tầng (ESLint AST)
bun run arch:check

# 2. Kiểm tra type TypeScript
bun x tsc -p tsconfig.app.json --noEmit
bun x tsc -p tsconfig.node.json --noEmit

# 3. Chạy toàn bộ test suites
bun test

# 4. Kiểm tra giới hạn dòng mã nguồn (max-lines)
bun run size:report

# 5. Build kiểm tra sản phẩm hoàn chỉnh
bun run build
```
