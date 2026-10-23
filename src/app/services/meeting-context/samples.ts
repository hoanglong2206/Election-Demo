export const SAMPLE_JD = `Vị trí: Senior Software Engineer (Distributed Systems & Fullstack)
Yêu cầu:
- 4+ năm kinh nghiệm phát triển hệ thống web quy mô lớn và microservices.
- Thành thạo TypeScript, React, Node.js hoặc Go.
- Kinh nghiệm thực chiến với Service Discovery (Consul/Envoy), Caching (Redis), Message Queue (Kafka/RabbitMQ).
- Nắm vững kiến trúc CAP Theorem, Database Sharding, Eventual Consistency vs Strong Consistency.
- Khả năng giao tiếp tiếng Anh tốt trong môi trường quốc tế.`

export const SAMPLE_CV = `Họ tên: Nguyễn Văn An - Senior Fullstack / Systems Engineer (5 năm kinh nghiệm)
Kinh nghiệm & Kỹ năng nổi bật:
- 5 năm thiết kế và triển khai kiến trúc microservices chịu tải cao (50k+ QPS).
- Đã trực tiếp xây dựng hệ thống Service Mesh với Consul và Envoy proxy tại công ty FinTech trước đây.
- Nắm vững tối ưu database distributed (CockroachDB, DynamoDB, PostgreSQL sharding).
- Điểm mạnh: Tư duy giải quyết vấn đề nhanh, phân tích trade-off kiến trúc (ACID vs BASE, latency vs consistency).
- Đã lead team 6 kỹ sư, tối ưu 40% chi phí hạ tầng AWS.`

export const SAMPLE_DISCUSSION_CONTEXT = `Chủ đề: Tối ưu kiến trúc Caching và giảm tải Database cho sự kiện Mega Sale
Ngữ cảnh & Vấn đề hiện tại:
- Cụm Redis Cluster hiện tại chạm ngưỡng 85% CPU vào giờ cao điểm, cache hit ratio giảm còn 72%.
- Xảy ra hiện tượng Cache Stampede khi 50k+ CCU cùng query các hot-key sản phẩm flash sale.
- Mục tiêu thảo luận: Triển khai Two-Tier Cache (L1 In-Memory + L2 Redis), áp dụng thuật toán XFetch / Mutex Locks, và phương án Rate Limiting bảo vệ Database khi có sự cố.`
