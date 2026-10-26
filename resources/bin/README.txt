HƯỚNG DẪN CÀI ĐẶT VÀ CẤU HÌNH WHISPER NATIVE ENGINE (C++ EXECUTABLE):

1. Tải bản build sẵn chính thức cho Windows x64:
   Link: https://github.com/ggerganov/whisper.cpp/releases
   File: whisper-bin-x64.zip

2. Giải nén và copy các file sau vào đúng thư mục này (election-demo/resources/bin):
   - whisper-server.exe (BẮT BUỘC để dùng Persistent In-Memory Server Engine)
     Lưu ý: whisper-server.exe PHẢI CÙNG PHIÊN BẢN (release tag) với whisper-cli.exe để tương thích model GGML và DLL.
   - whisper-cli.exe (hoặc main.exe - dùng làm Fallback Engine khi server không khởi động được)
   - whisper.dll, ggml.dll, ggml-base.dll, ggml-cpu.dll (các DLL phụ trợ đi kèm gói build)

3. Tải file trọng số mô hình GGML vào thư mục (election-demo/resources/models):
   - ggml-tiny.bin (75MB - Tốc độ nhanh nhất, ~100-250ms, khuyến nghị)
     Link: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
   - ggml-base.bin (142MB - Cân bằng độ chính xác cao)
     Link: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

4. Kiến trúc Persistent Server Engine:
   - Server tải model GGML 1 lần duy nhất vào RAM, lắng nghe trên 127.0.0.1 với cổng ngẫu nhiên bảo mật (không mở ra mạng ngoài).
   - Truyền tải âm thanh Float32/Int16 PCM qua bộ nhớ (WAV 44-byte in-memory multipart), hoàn toàn KHÔNG ghi file tạm vào ổ đĩa.
   - Có Watchdog tự phục hồi và tự động Fallback sang whisper-cli nếu whisper-server gặp sự cố.
