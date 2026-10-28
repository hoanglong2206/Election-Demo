# Hướng Dẫn Refactor Cho AI (CLAUDE.md)

Tài liệu này trích xuất từ Prompt Chủ để định hướng mọi lượt can thiệp mã nguồn của trợ lý AI.

## 1. Ranh Giới Phụ Thuộc (Dependency Rules)
- **core/**: Chỉ import `core/types` và thư viện toán học/standard libs. KHÔNG import React, UI, DOM, services, features, infrastructure.
- **infrastructure/**: Chỉ import `core/`, `lib/`, `@common/`.
- **services/**: Chỉ import `core/` và `infrastructure/ipc/`. **TUYỆT ĐỐI KHÔNG import React hoặc ReactDOM**. Mỗi thư mục service phải có `index.ts` công khai.
- **hooks/**, **components/**, **features/**: Import từ `services/`, `core/`, `lib/`, `components/ui/`, `infrastructure/ipc/`.
- **components/ui/** và **lib/**: Chỉ import từ `lib/`.
- **features/**: Không import ruột `features/<other-feature>/*`, chỉ import qua `index.ts` công khai của feature đó.
- **IPC Access**: Mọi lời gọi `window.api.*` phải đi qua các port có kiểu trong `@/infrastructure/ipc/`. Không gọi trực tiếp `window.api`.

## 2. Quy Tắc Nội Dung & State Management
- Hook hoặc Component dùng từ $\ge 2$ feature: bắt buộc nằm trong `hooks/` hoặc `components/shared/`.
- Logic phức tạp (debounce, dedupe, hàng đợi, vòng lặp, tính toán nặng): viết bằng TypeScript thuần ở controller/core; hook chỉ đóng vai trò kết nối (wiring).
- Thay cờ boolean rời rạc bằng reducer hoặc máy trạng thái (state machine).
- **CẤM cặp state+ref phản chiếu** (như `const r = useRef(s); r.current = s;`). Dùng hook `useLatest(s)`.
- Quản lý timer qua hook dùng chung `useTimeout` / `useInterval`.

## 3. Giới Hạn Kích Thước (Strict File Size Limits)
- Container: $\le 600$ dòng.
- Custom Hook: $\le 300$ dòng và $\le \sim 8$ `useState`.
- Component: $\le 400$ dòng.
- File Service: $\le \sim 500$ dòng.

## 4. Các Bất Biến Bắt Buộc (Strict Invariants)
- **Không đổi UI/UX**: Chuỗi hiển thị, phím tắt, giao diện, layout, hợp đồng IPC phải giữ nguyên 100%.
- **Không thêm dependency runtime**: Chỉ thêm devDependency nếu cần cho lint/test.
- **Không viết lại từ đầu**: Tái cấu trúc tiến hóa từng lát cắt (evolutionary refactoring); giữ nguyên các tầng và thuật toán cốt lõi.

## 5. Quy Trình Trước & Sau Mỗi Lát Cắt
Trước khi kết thúc lát cắt, bắt buộc chạy và xác nhận 0 lỗi:
1. `bun run arch:check` (Kiểm tra vòng phụ thuộc `madge` + `eslint` kiến trúc)
2. `bun run size:report` (Báo cáo kích thước và kiểm tra giới hạn dòng)
3. `bun run build:electron`
4. `bun x tsc -p tsconfig.app.json --noEmit`
5. `bun x tsc -p tsconfig.node.json --noEmit`
6. `bun test src/`
7. `bun run build:vite`

