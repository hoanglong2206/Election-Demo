HƯỚNG DẪN CÀI ĐẶT WHISPER NATIVE BINARY (C++ EXECUTABLE):

1. Tải bản build sẵn chính thức cho Windows x64:
   Link: https://github.com/ggerganov/whisper.cpp/releases
   File: whisper-bin-x64.zip

2. Giải nén và copy các file sau vào đúng thư mục này (election-demo/resources/bin):
   - whisper-cli.exe (hoặc main.exe)
   - whisper.dll (nếu có trong gói)

3. Tải file trọng số mô hình GGML vào thư mục (election-demo/resources/models):
   - ggml-tiny.bin (75MB - Tốc độ nhanh nhất, khuyến nghị)
     Link: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
   - ggml-base.bin (142MB - Cân bằng chính xác)
     Link: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

Sau khi đặt file, hệ thống sẽ tự động phát hiện và chuyển sang chế độ Native C++ Siêu Tốc (~100ms - 200ms) trên CPU/GPU mà không cần Internet hay API Key!
