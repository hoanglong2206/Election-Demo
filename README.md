# Election Demo — AI Meeting & Interview Copilot

> Ứng dụng desktop Electron giúp theo dõi nội dung phỏng vấn/cuộc họp theo thời gian thực, chuyển giọng nói thành văn bản và đưa ra gợi ý bằng AI.

> **Trạng thái:** dự án đang phát triển. Một số khả năng phụ thuộc provider, API key, thiết bị âm thanh và cấu hình máy.

## Tổng quan

Ứng dụng chạy trên Windows desktop với giao diện React/TypeScript bên trong Electron. Người dùng có thể chọn **Interview** hoặc **Discussion**, nhập bối cảnh trước cuộc họp, thu âm từ micro hoặc âm thanh hệ thống, chạy Speech-to-Text (STT), xem transcript và nhận gợi ý từ mô hình ngôn ngữ (LLM). Lịch sử phiên được lưu cục bộ.

Các dịch vụ AI đám mây cần API key riêng và có thể tính phí theo chính sách của nhà cung cấp. Ứng dụng cũng có Local Whisper native để nhận dạng giọng nói ngoại tuyến khi đã cài binary và model phù hợp.

## Các luồng chức năng chính

### Phỏng vấn

1. Trên **Home**, chuyển chế độ sang **Interview**. Chọn hoặc tạo một profile để lưu tên/vị trí và bối cảnh cho một ứng viên.
2. Nhập CV và JD trực tiếp hoặc tải `.pdf`, `.docx`, `.txt`, `.md` để trích xuất văn bản. Trang hiển thị ước lượng độ dài ngữ cảnh; profile có thể được lưu, sửa, xóa, nhập/xuất JSON.
3. Ứng dụng trích xuất từ khóa kỹ thuật từ JD để giúp Whisper nhận dạng thuật ngữ. Có thể thêm/xóa từ khóa, hoặc bấm **Trích xuất lại từ JD** để thay danh sách bằng kết quả quét mới. Phần so khớp CV–JD hiển thị mức độ phù hợp, điểm mạnh và kỹ năng/yêu cầu còn thiếu; có thể yêu cầu phân tích sâu bằng LLM.
4. Chọn model LLM và thiết bị âm thanh. Trong **Settings**, cấu hình provider/key, đồng bộ danh sách model và chọn STT engine. Kiểm tra thiết bị hoặc pipeline trước khi bắt đầu nếu đây là lần dùng đầu tiên.
5. Vào **Meeting Copilot**, chọn nguồn thu (micro hoặc system audio), ngôn ngữ nhận dạng và bắt đầu thu. Audio được chuẩn hóa/chia đoạn rồi gửi tới engine STT; transcript xuất hiện trực tiếp. Copilot dùng CV, JD, profile và nội dung trao đổi để đề xuất câu trả lời phỏng vấn, có thể rút gọn, tạo lại, dịch hoặc sao chép.
6. Dừng/kết thúc phiên để lưu transcript, câu hỏi, gợi ý, thống kê và tóm tắt vào lịch sử cục bộ. Có thể mở phiên từ **Session History** để xem lại hoặc xuất báo cáo.

### Thảo luận/cuộc họp

1. Trên **Home**, chọn chế độ **Discussion**.
2. Nhập chủ đề, mục tiêu hoặc tài liệu liên quan (có thể tải `.pdf`, `.docx`, `.txt`, `.md`). Từ khóa kỹ thuật được trích xuất để cải thiện nhận dạng; người dùng có thể chỉnh tay hoặc trích xuất lại.
3. Chọn nguồn âm thanh là micro hoặc system audio. Mở **Audio Test** nếu cần kiểm tra tín hiệu/STT trước, sau đó bắt đầu phiên trong **Meeting Copilot**.
4. Theo dõi transcript theo thời gian thực. Chế độ Copilot có thể tự kích hoạt, báo nhận diện câu hỏi để người dùng bấm tạo gợi ý, hoặc chỉ chạy khi được yêu cầu thủ công. Nội dung gợi ý dựa trên chủ đề và hội thoại; có thể rút gọn, tạo lại, dịch và sao chép.
5. Tạo hoặc làm mới tóm tắt từ transcript trong phiên. Khi kết thúc, mở **Session History** để tìm, lọc, xem lại hoặc xuất dữ liệu phiên.

### Xử lý audio và STT

Luồng tổng quát: **Micro/System Audio → giải mã audio → chuẩn hóa mono 16 kHz → buffer/chunk và VAD → hàng đợi STT → transcript**. Trong **Audio Test**, người dùng có thể chọn nguồn thu, bắt đầu/dừng capture, theo dõi mức tín hiệu và buffer, xem các chunk gần nhất cùng RMS, thử nhận dạng và quan sát tình trạng hàng đợi. Auto Calibrate đo noise floor của micro đang chọn để đặt ngưỡng năng lượng VAD theo thiết bị. Cấu hình khoảng lặng (ví dụ 0.5/0.8/1.2 giây) quyết định độ dài im lặng cần có trước khi chốt một lượt nói; đây là thiết lập khác với ngưỡng năng lượng mà Auto Calibrate đo. STT dùng Local Whisper C++ hoặc provider đám mây tùy cấu hình.

## Các trang trong ứng dụng

| Trang | Chức năng |
|---|---|
| **Home** | Chuẩn bị bối cảnh và bắt đầu phiên. Chọn Interview/Discussion; tạo/chọn profile; nhập CV, JD, chủ đề hoặc tải tài liệu; xem token ước lượng; quản lý từ khóa; chạy so khớp CV–JD; chọn model/thiết bị nhanh; xem phiên gần đây và mở phiên mới. |
| **Meeting Copilot** | Không gian làm việc khi đang họp. Bật/tắt thu micro hoặc system audio, chọn ngôn ngữ STT, theo dõi transcript và hàng đợi; Copilot phân loại câu hỏi theo cấu hình Auto/Semi/Manual, tạo đề xuất theo ngữ cảnh Interview/Discussion, cho phép dịch/rút gọn/tạo lại/sao chép; tạo tóm tắt; chụp/cắt ảnh câu hỏi trên màn hình để phân tích Vision; lưu nội dung phiên. |
| **Audio Test** | Phòng kiểm tra âm thanh và STT. Chọn nguồn/thiết bị, bắt đầu/dừng thu, nghe lại hoặc tải audio kiểm tra; theo dõi meter, dải tần, thời lượng/dung lượng buffer, các giai đoạn pipeline, chunk và số đo RMS; chạy thử STT và theo dõi hàng đợi; hiệu chuẩn VAD theo micro. |
| **AI Diagnostic** | Có hai khu vực: benchmark LLM (chọn model, prompt mẫu hoặc prompt tự nhập, xem kết quả và chỉ số độ trễ/tốc độ) và kiểm tra Vision (chụp toàn màn hình, chụp rồi cắt vùng, tải ảnh hoặc dùng ảnh mẫu; thêm chỉ dẫn; xem phân tích, câu trả lời và mã trích xuất nếu có). |
| **Session History** | Tìm kiếm và lọc phiên theo chế độ/profile/thời gian; đổi tên, xóa một hoặc nhiều phiên; xem chi tiết dạng timeline, transcript, gợi ý AI, ảnh câu hỏi và bố cục chia đôi; nhảy đến nội dung liên quan qua timestamp; xuất Markdown, JSON hoặc PDF; cấu hình thời gian lưu giữ và xóa lịch sử. |
| **Settings** | Quản lý API key cho provider, kiểm tra và xóa key; đồng bộ danh sách model từ API và chọn model đã đồng bộ; xem trạng thái nguồn/cache đồng bộ; chọn STT Local Whisper hoặc cloud, kiểm tra native engine/model; chọn model Vision; cấu hình micro mặc định, độ dài khoảng lặng kết thúc câu, ngôn ngữ trả lời AI và các tùy chọn cá nhân hóa. |

### Chi tiết thao tác và dữ liệu theo trang

#### Home: chuẩn bị ngữ cảnh

- **Interview:** CV và JD được lưu làm ngữ cảnh của profile. Tệp được hỗ trợ hiện gồm PDF, DOCX, TXT và Markdown; nội dung được trích xuất thành văn bản để dùng trong phân tích và cuộc họp.
- **Discussion:** chủ đề/mục tiêu được lưu riêng với từ khóa thảo luận. Không bắt buộc có CV/JD.
- **Từ khóa:** bộ trích xuất cục bộ nhận diện thuật ngữ kỹ thuật, chuẩn hóa một số alias và lưu kết quả để dùng làm từ vựng gợi ý cho Whisper. Nếu danh sách đã có từ khóa (bao gồm từ khóa người dùng chỉnh), sửa văn bản không nhất thiết tự thay danh sách; dùng nút trích xuất lại để quét mới.
- **So khớp CV–JD:** có phân tích heuristic và lựa chọn phân tích sâu dùng LLM. Kết quả nhằm hỗ trợ chuẩn bị, không thay thế đánh giá tuyển dụng.
- **Profile:** lưu nhiều bộ thông tin ứng viên/vị trí để chuyển đổi; hỗ trợ nhập và xuất dữ liệu profile.

#### Meeting Copilot: xử lý trong cuộc họp

- **Thu nhận và transcript:** chọn nguồn micro hoặc system audio; audio đi qua pipeline chuẩn hóa/chunk/VAD rồi STT. Transcript có thể hiển thị nguyên bản và bản dịch nếu bật tính năng tương ứng.
- **Gợi ý Copilot:** dùng ngữ cảnh đã chuẩn bị cùng các lượt hội thoại gần nhất. Interview tập trung vào gợi ý trả lời phỏng vấn; Discussion tập trung vào phương án/điểm cần phản hồi. Có thể điều khiển cách kích hoạt, rút gọn, tạo lại, dịch và sao chép gợi ý.
- **Tóm tắt:** có thể yêu cầu tổng hợp lại từ transcript hiện có, mở rộng/thu gọn, dịch hoặc sao chép.
- **Câu hỏi từ màn hình:** chụp màn hình hoặc chọn vùng cần thiết để gửi cho mô hình Vision đã cấu hình; kết quả có thể gồm phân tích câu hỏi, nội dung OCR/code và hướng giải quyết, được lưu cùng session.
- **Lưu phiên:** transcript, phản hồi Copilot, metadata và nội dung ảnh/câu hỏi liên quan được lưu cục bộ để xem lại.

#### Audio Test: kiểm tra trước khi họp

- Chọn micro hoặc system audio, bắt đầu capture và quan sát tín hiệu đầu vào, các chặng xử lý, thời lượng/dung lượng buffer và các chunk mới nhất.
- Thử STT trên audio thực tế để phát hiện trường hợp không có tín hiệu, chưa tạo chunk hoặc STT không trả văn bản.
- Chạy **Auto Calibrate** khi dùng micro để đo noise floor và đề xuất ngưỡng VAD riêng cho thiết bị. Thời gian im lặng kết thúc câu được cấu hình riêng trong Settings.
- Các chỉ số là công cụ chẩn đoán: số chunk thể hiện số đoạn được tạo, không tự nó khẳng định rằng STT đã xử lý thành công tất cả các đoạn.

#### AI Diagnostic: kiểm tra model và Vision

- **LLM benchmark:** chọn model đang khả dụng, chọn prompt dựng sẵn hoặc nhập prompt riêng, chạy yêu cầu và xem phản hồi cùng thời gian/tốc độ đo được.
- **Vision:** chụp toàn màn hình, mở lớp cắt vùng, tải ảnh có sẵn hoặc dùng ảnh mẫu. Có thể thêm chỉ dẫn như ngôn ngữ cần giải; kết quả hiển thị phần giải thích, câu trả lời và code nhận diện được. Cần cấu hình model Vision/API phù hợp.

#### Session History: xem lại và xuất

- Danh sách phiên hỗ trợ tìm kiếm và bộ lọc. Có thể đổi tên, xóa riêng lẻ hoặc chọn nhiều phiên để xóa hàng loạt.
- Màn chi tiết tổng hợp thông tin phiên và cung cấp các tab **Timeline**, **Transcript**, **AI Suggestions**, **Screenshots** và **Split view**. Timestamp hỗ trợ định vị sự kiện tương ứng; transcript/gợi ý có thao tác sao chép.
- Hỗ trợ xuất phiên hiện chọn thành Markdown, JSON hoặc PDF. Có thể đặt retention để tự dọn phiên cũ hoặc xóa toàn bộ lịch sử.

#### Settings: credentials, model và audio

- **API key:** nhập/kiểm tra/lưu hoặc thu hồi key của provider. Ứng dụng dùng OS Credential Store qua Electron; UI chỉ cần trạng thái đã cấu hình/giá trị đã che, không cần lưu key plaintext trong mã nguồn.
- **Model registry:** đồng bộ model từ API của provider, sau đó chọn trong danh sách model hợp lệ. Giao diện cho biết trạng thái/nguồn dữ liệu đồng bộ, bao gồm trường hợp dùng cache; nếu API không trả model, trạng thái cần phản ánh lỗi hoặc danh sách rỗng thay vì báo thành công.
- **STT:** chọn engine Local Whisper hoặc cloud; với native engine xem trạng thái binary/model và chạy kiểm tra. Local Whisper cần binary cùng model GGML trên máy.
- **Audio và phản hồi:** chọn thiết bị mặc định, đặt thời gian im lặng trước khi chốt lượt nói và ngôn ngữ phản hồi AI (Việt/Anh/song ngữ). Thời gian im lặng điều khiển lúc kết thúc câu, khác với ngưỡng RMS mà Auto Calibrate ước lượng.

Tên và khả năng cụ thể có thể thay đổi khi dự án tiếp tục phát triển.

## Yêu cầu

- Windows 10/11 64-bit được khuyến nghị (native Whisper binary hiện đóng gói theo Windows).
- [Bun](https://bun.sh/) phiên bản tương thích với lockfile của dự án.
- Git nếu muốn clone/cập nhật mã nguồn.
- API key cho provider đám mây muốn sử dụng. Có thể cấu hình trong **Settings**; không cần đưa key vào mã nguồn.
- Microphone hoặc nguồn âm thanh hệ thống. Windows có thể yêu cầu cấp quyền truy cập micro/desktop audio.

## Cài đặt để phát triển

Mở PowerShell trong thư mục dự án:

```powershell
git clone <URL_REPOSITORY>
cd election-demo
bun install
bun run dev
```

Nếu đang ở thư mục mã nguồn đã tải về, bỏ qua `git clone` và `cd`. Lệnh `bun run dev` biên dịch Electron, chạy Vite và mở ứng dụng desktop.

### Build kiểm tra

```powershell
bun run build
```

Lệnh này biên dịch Electron và build giao diện Vite vào `dist/`. Đây **chưa phải** lệnh tạo bộ cài phát hành cho người dùng cuối.

### Local Whisper (tùy chọn)

Native Whisper cần binary `whisper-cli.exe` (hoặc binary tương thích được ứng dụng nhận diện) trong `resources/bin/` và model GGML trong `resources/models/`. Hãy xem hướng dẫn tại [`resources/bin/README.txt`](resources/bin/README.txt) và [`resources/models/README.txt`](resources/models/README.txt). Model có dung lượng lớn nên không được đưa vào Git; tải/cài riêng trên máy chạy ứng dụng.

Nếu chưa cài Local Whisper, hãy chọn một STT engine đám mây đã cấu hình trong Settings.

## Đưa dự án hiện có lên GitHub

Thư mục làm việc hiện tại chưa có Git repository. Sau khi rà soát các file sẽ đưa lên (đặc biệt `.env`, file cấu hình cá nhân và dữ liệu người dùng), làm theo các bước sau.

1. Tạo repository trống trên GitHub. Nếu repository đã có mã nguồn tại máy, không chọn khởi tạo kèm README, license hay `.gitignore`.
2. Trong PowerShell, chuyển tới thư mục dự án và khởi tạo Git:

   ```powershell
   cd D:\IT\DEMO\election-demo
   git init -b main
   git status --short
   git add .
   git status
   git commit -m "chore: initial project upload"
   git remote add origin https://github.com/<GITHUB_USERNAME>/<REPOSITORY>.git
   git push -u origin main
   ```

3. Thay `<GITHUB_USERNAME>` và `<REPOSITORY>` bằng thông tin repository vừa tạo. GitHub sẽ yêu cầu xác thực qua trình duyệt hoặc credential manager.
4. Mở trang repository trên GitHub và kiểm tra README cùng danh sách file đã được đẩy lên.

Nếu Git báo thiếu danh tính, cấu hình tên/email commit của bạn rồi chạy lại lệnh commit:

```powershell
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"
```

Để cập nhật repository sau này:

```powershell
git add .
git commit -m "mô tả thay đổi"
git push
```

### Trước khi push

- Không commit API key, mật khẩu, token, file `.env` hoặc dữ liệu cuộc họp cá nhân.
- `resources/models/*.bin` bị bỏ qua vì các model Whisper lớn hơn giới hạn file thường của GitHub. Tải chúng riêng theo hướng dẫn trong thư mục `resources/models`.
- Không có license trong repository hiện tại. Nếu muốn người khác sử dụng/phân phối mã nguồn, hãy chọn và thêm license trước khi công khai repository.

## Bảo mật và dữ liệu

- API key nên được nhập trong Settings. Ứng dụng dùng OS Credential Store qua Electron để lưu credential; không chia sẻ profile/repository chứa secrets.
- Transcript, profile và lịch sử phiên có thể chứa thông tin cá nhân. Hãy xem lại dữ liệu trước khi gửi issue, log hoặc file đính kèm lên GitHub.
- Khi dùng provider đám mây, nội dung gửi đi chịu chính sách xử lý dữ liệu của provider đó.

## Công nghệ

Electron · React 19 · TypeScript · Vite · Web Audio API/AudioWorklet · Bun · Whisper.cpp · các provider LLM/STT được cấu hình trong ứng dụng.

## License

Chưa được chỉ định.
