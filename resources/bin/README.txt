HƯỚNG DẪN CÀI ĐẶT VÀ CẤU HÌNH WHISPER NATIVE ENGINE (C++ EXECUTABLE):

1. Tải bản build sẵn chính thức cho Windows x64:
   Link: https://github.com/ggerganov/whisper.cpp/releases
   - Bản CPU cơ bản: whisper-bin-x64.zip
   - Bản Tăng Tốc GPU Vulkan (Khuyến nghị cho tất cả card Intel / AMD / NVIDIA): whisper-bin-vulkan-x64.zip
   - Bản Tăng Tốc GPU NVIDIA CUDA: whisper-bin-cublas-12.x-x64.zip

2. Giải nén và copy các file sau vào đúng thư mục này (election-demo/resources/bin):
   - whisper-server.exe (BẮT BUỘC để dùng Persistent In-Memory Server Engine)
     Lưu ý: whisper-server.exe PHẢI CÙNG PHIÊN BẢN (release tag) với whisper-cli.exe để tương thích model GGML và DLL.
   - whisper-cli.exe (hoặc main.exe - dùng làm Fallback Engine khi server không khởi động được)
   - whisper.dll, ggml.dll, ggml-base.dll, ggml-cpu.dll
   - Để kích hoạt GPU Acceleration:
     * Vulkan: copy ggml-vulkan.dll và vulkan-1.dll vào thư mục này.
     * CUDA: copy ggml-cuda.dll (hoặc ggml-cublas.dll) và các DLL CUDA runtime vào thư mục này.

3. Tải file trọng số mô hình GGML vào thư mục (election-demo/resources/models):
   - ggml-tiny.bin (75MB - Tốc độ nhanh nhất, ~40-70ms trên GPU, khuyến nghị)
     Link: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
   - ggml-base.bin (142MB - Cân bằng độ chính xác cao)
     Link: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

4. Kiến trúc Persistent Server Engine:
   - Server tải model GGML 1 lần duy nhất vào RAM/VRAM, lắng nghe trên 127.0.0.1 với cổng ngẫu nhiên bảo mật.
   - Truyền tải âm thanh Float32/Int16 PCM qua bộ nhớ (WAV 44-byte in-memory multipart), hoàn toàn KHÔNG ghi file tạm vào ổ đĩa.
   - Có Watchdog tự phục hồi và tự động Fallback sang whisper-cli nếu whisper-server gặp sự cố.

5. Tự động Nhận Diện & Tăng Tốc GPU (GPU Acceleration & Fallback):
   - Ứng dụng tự động phát hiện GPU và backend DLLs (CUDA / Vulkan / OpenVINO / DirectML) khi khởi động.
   - Khi có GPU: Server tự động kích hoạt Flash Attention (-fa) và offload tính toán sang GPU, giải phóng 100% CPU.
   - Nếu GPU gặp lỗi driver hoặc thiếu DLL: Tự động fallback về CPU mode thích ứng (tối đa 50% cores) để đảm bảo không làm gián đoạn cuộc họp.
