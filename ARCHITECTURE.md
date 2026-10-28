# Kiến Trúc Ứng Dụng Meeting Copilot (Electron + React + TypeScript)

Tài liệu này xác định chuẩn kiến trúc phân tầng tiến hóa (evolutionary layered architecture), các quy tắc phụ thuộc, quy ước tổ chức mã nguồn, giới hạn kích thước và quy trình chia lát cắt cho toàn bộ dự án.

---

## 1. Cây Thư Mục Đích (Target Directory Tree)

```text
src/
├─ common/                          # Hợp đồng IPC dùng chung Main + Renderer (Zod schema, channels, types)
│                                   # KHÔNG import React hoặc Electron
├─ electron/
│  ├─ main.ts  preload.ts  window/
│  ├─ ipc/
│  │  ├─ index.ts                   # registerAllHandlers()
│  │  └─ handlers/                  # {window, whisper, sessions, capture, credentials, llm, usage}.ts
│  └─ services/
│     ├─ whisper/                   # {whisperProcessManager, nativeWhisper, hallucinationFilter, wavHeader}
│     ├─ credentials/               # {credentialStore, credentialSchema}
│     ├─ llm/                       # {llmService, sseParser, benchmark}
│     ├─ sessions/                  # {sessionStorage, sessionRecovery, mediaProtocol}
│     └─ usage/                     # {usageStorage}
└─ app/
   ├─ core/                         # Miền lõi toán học / DSP / Audio thuật toán thuần túy (AudioBufferManager, VAD...)
   │  ├─ audio/                     # Audio buffer, RMS/dBFS, VAD, SpeechSegmenter
   │  └─ types/                     # Kiểu dữ liệu miền lõi
   ├─ infrastructure/               # Cổng giao tiếp ngoại vi
   │  ├─ audio/                     # WebAudio, AudioWorklet capture engines
   │  └─ ipc/                       # Typed IPC Ports (window, capture, whisper, sessions, usage, credentials)
   ├─ services/                     # Tầng domain services (KHÔNG React, KHÔNG import components/features)
   │  ├─ ai-model/                  # model-registry, model-router, copilot, stt, translation, aiModels
   │  ├─ screen-capture/            # screenCaptureService, visualQuestionAnalyzer
   │  ├─ session-history/           # repository, indexedDbRepository
   │  ├─ settings/                  # settingsManager, schema
   │  ├─ usage-tracker/             # usageTrackerService, pricingRegistry
   │  └─ vad-calibration/           # vadCalibrationStorage
   ├─ hooks/                        # Hook dùng chung (>= 2 features): useLatest, useTimeout, useCopyFeedback...
   ├─ components/
   │  ├─ ui/                        # Nguyên tử UI dùng chung (Radix / Tailwind): button, toast, modal...
   │  ├─ layout/                    # Layout, Header, Sidebar
   │  └─ shared/                    # Component ghép dùng >= 2 features (ScreenCaptureSourcePicker, CropOverlay...)
   ├─ features/<feature>/           # Từng tính năng độc lập (home, meeting-mode, settings, history, audio-test...)
   │  ├─ <Feature>.tsx              # Container component (<= 600 dòng)
   │  ├─ index.ts                   # Public API của feature (chỉ export những gì bên ngoài cần)
   │  ├─ types.ts                   # Domain types của feature
   │  ├─ hooks/                     # Custom hooks nội bộ của feature
   │  ├─ controllers/               # Pure TS logic (debounce, queue, state machines)
   │  ├─ state/                     # Reducer, Context hoặc State Store nội bộ
   │  └─ components/<group>/        # Sub-components trực thuộc feature (<= 400 dòng)
   ├─ lib/                          # Tiện ích chung, helper thuật toán (cn, utils...)
   ├─ types/                        # Global type declarations (electron.d.ts, streaming.ts...)
   ├─ App.tsx
   └─ main.tsx
```

---

## 2. Quy Tắc Phụ Thuộc (Dependency Rules)

Kiến trúc tuân theo mô hình phân tầng nghiêm ngặt (Strict Layered Inversion), được kiểm tra tự động bằng ESLint AST rules:

| Tầng | Được phép Import | Bị CẤM Import | Ghi chú |
| :--- | :--- | :--- | :--- |
| **`core/`** | `core/types`, standard libs | Mọi tầng khác (`services`, `features`, `infrastructure`, `hooks`, `components`, `React`) | Thuần toán học & DSP |
| **`infrastructure/`**| `core/`, `lib/`, `@common/` | `services/`, `features/`, `components/`, `hooks/` | Giao tiếp phần cứng & OS |
| **`services/`** | `core/`, `infrastructure/ipc/`, `lib/`, `@common/` | `react`, `react-dom`, `components/`, `features/`, direct `window.api` | Nghiệp vụ domain; không UI |
| **`components/ui/`** | `lib/`, `@radix-ui/*`, `lucide-react` | `services/`, `features/`, `hooks/`, `infrastructure/` | Dumb UI primitives |
| **`components/shared/`**| `services/`, `core/`, `lib/`, `components/ui/`, `hooks/` | `features/` | Ghép dùng $\ge 2$ features |
| **`features/<A>/`** | `services/`, `core/`, `infrastructure/ipc/`, `hooks/`, `components/`, `features/<B>` (chỉ qua `index.ts`) | **Ruột `features/<B>/*`** (cấm import sâu nội bộ feature khác) | Đóng gói tính năng |

### Nguyên tắc gọi IPC:
* **CẤM** gọi trực tiếp `window.api.*` trong các service và component.
* **BẮT BUỘC** gọi qua các Port có kiểu nằm trong `@/infrastructure/ipc/` (`windowPort`, `capturePort`, `whisperPort`, `sessionsPort`, `usagePort`, `credentialsPort`).
* Điều này cho phép hoán đổi Adapter (`ElectronIpcAdapter` $\leftrightarrow$ `MockIpcAdapter`) và inject mock trong test mà không cần can thiệp global `window`.

---

## 3. Giới Hạn Kích Thước & Thiết Kế (Design Limits)

| Loại tập tin | Giới hạn tối đa | Quy tắc thiết kế bắt buộc |
| :--- | :--- | :--- |
| **Container** (`<Feature>.tsx`) | $\le 600$ dòng | Chỉ nối state/controller; không nhúng logic tính toán nặng. |
| **Custom Hook** | $\le 300$ dòng | $\le \sim 8$ `useState`. Quá 8 state phải chuyển sang `useReducer` hoặc state machine. |
| **Component** | $\le 400$ dòng | Tách sub-components theo nhóm ngữ nghĩa (`components/<nhóm>/`). |
| **Service File** | $\le 500$ dòng | Logic thuần TypeScript, không state React, có public `index.ts`. |

### Quy tắc bất biến (Invariants):
1. **Cấm cặp state+ref phản chiếu**: Không dùng `const r = useRef(s); r.current = s;` trong render; dùng hook `useLatest(s)`.
2. **Timer**: Đi qua hook dùng chung `useTimeout` / `useInterval`.
3. **Pure Logic**: Debounce, throttle, queue, dedupe, state machine viết bằng TS thuần tại `controllers/` hoặc `core/`; hook chỉ đóng vai trò kết nối.
4. **Không đổi UI/UX**: Chuỗi hiển thị, phím tắt, giao diện, hợp đồng IPC phải giữ nguyên 100%.

---

## 4. Quy Trình Chia Lát Cắt (Evolutionary Refactoring Slices)

* **S0 (Chuẩn bị & Baseline)**:
  - Khảo sát mã nguồn, ghi nhận kết quả mốc (baseline), khóa luật phụ thuộc bằng ESLint & Madge.
  - Xây dựng khung `infrastructure/ipc/` và adapter mock.
  - Lập Bảng nợ kiến trúc (Architecture Debt Ledger).
* **S1 (Shared Infrastructure & Extraction)**:
  - Tách các components dùng chung $\ge 2$ feature vào `components/shared/`.
  - Tách các hooks dùng chung vào `src/app/hooks/`.
* **S2 (Phân rã MeetingMode)**:
  - Phân rã `MeetingMode.tsx` (2.185 dòng, 41 useState) thành Container $\le 600$ dòng.
  - Rút trích state machine (`meetingSessionReducer`), session controller, recovery controller.
* **S3 (Phân rã Home & Settings)**:
  - Phân rã `Home.tsx` (1.190 dòng) và `Settings.tsx` (809 dòng) + `APIKeysCard.tsx` (1.599 dòng).
  - Tạo feature hooks và sub-components chuyên biệt.
* **S4 (Hoàn tất Decoupling IPC & Refactor Services)**:
  - Chuyển toàn bộ các vị trí gọi `window.api` còn lại trong `features/` sang `@/infrastructure/ipc`.
  - Đưa toàn bộ các file service quá khổ ($\gt 500$ dòng) về chuẩn $\le 500$ dòng.
* **S5 (Verification & Final Gate)**:
  - Xóa danh sách baseline overrides trong ESLint; chuyển toàn bộ rule sang mức `error`.
  - Chạy full verification: `bun run check` (tsc + lint + test + build).

