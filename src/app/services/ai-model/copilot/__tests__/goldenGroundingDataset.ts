/**
 * Golden Grounding Dataset (>= 60 pairs) for AI Copilot Answer Evaluation
 * Covers:
 * 1. Supported claims (EN & VI)
 * 2. Inferred claims with plausible extensions (EN & VI)
 * 3. Metric mismatches (team size, %, scale, years)
 * 4. Inverted relations / causality (Kafka -> RabbitMQ vs RabbitMQ -> Kafka)
 * 5. Invented experience / architectural fabrications
 * 6. General technical knowledge (CAP, ACID, B-Tree, microservices)
 * 7. Opinion & architectural approach
 * 8. Cross-lingual pairs (VI answer vs EN CV)
 * 9. Negation boundary safety ("notification" vs "not", explicit match priority)
 * 10. Source isolation (JD/interviewer vs candidate proof)
 * 11. Long context (> 4000 chars)
 */

import { type ClaimClassification, type ClaimType } from '../answerGrounding'

export interface GoldenTestCase {
  id: string
  category:
    | 'supported_en'
    | 'supported_vi'
    | 'inferred_en'
    | 'inferred_vi'
    | 'metric_mismatch'
    | 'inverted_relation'
    | 'invented_architecture'
    | 'general_technical'
    | 'opinion_approach'
    | 'cross_lingual'
    | 'negation_boundary'
    | 'source_isolation'
    | 'long_context'
  description: string
  answer: string
  cv: string
  jobDescription?: string
  transcript?: string
  expectedVerdict: ClaimClassification
  expectedClaimType: ClaimType
}

export const GOLDEN_GROUNDING_DATASET: GoldenTestCase[] = [
  // ─── 1. SUPPORTED EN (1-5) ────────────────────────────────────────────────
  {
    id: 'case_01',
    category: 'supported_en',
    description: 'Exact match of role and team lead experience at Acme',
    answer: 'At Acme, I led a team of 8 engineers.',
    cv: 'Senior Tech Lead at Acme. Led a team of 8 engineers building microservices.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_02',
    category: 'supported_en',
    description: 'Core backend development with Go and PostgreSQL',
    answer: 'I built the core payment service using Go and PostgreSQL.',
    cv: 'Software Engineer at FinTech: Built the core payment service using Go and PostgreSQL.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_03',
    category: 'supported_en',
    description: 'High throughput API scaling to 50k RPS',
    answer: 'I scaled our public API gateway to handle 50k RPS.',
    cv: 'Scaled public API gateway to handle 50k RPS with 99.99% uptime.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_04',
    category: 'supported_en',
    description: 'Docker containerization and Kubernetes orchestration',
    answer: 'I managed Kubernetes cluster deployments for our services.',
    cv: 'DevOps Engineer: Managed Kubernetes cluster deployments for our services.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_05',
    category: 'supported_en',
    description: 'Redis caching layer implementation',
    answer: 'I implemented a Redis caching layer to reduce database load.',
    cv: 'Implemented a Redis caching layer to reduce database load across microservices.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },

  // ─── 2. SUPPORTED VI (6-10) ────────────────────────────────────────────────
  {
    id: 'case_06',
    category: 'supported_vi',
    description: 'Quản lý đội ngũ với ký tự tiếng Việt có dấu',
    answer: 'Tại công ty VNG, tôi đã dẫn dắt đội ngũ 6 kỹ sư.',
    cv: 'Tại công ty VNG, tôi đã dẫn dắt đội ngũ 6 kỹ sư phát triển ứng dụng di động.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_07',
    category: 'supported_vi',
    description: 'Em đã xây dựng hệ thống xác thực',
    answer: 'Em đã xây dựng hệ thống xác thực bằng OAuth2 và JWT.',
    cv: 'Em đã xây dựng hệ thống xác thực bằng OAuth2 và JWT cho hơn 1 triệu người dùng.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_08',
    category: 'supported_vi',
    description: 'Chị đã tối ưu hóa hiệu năng cơ sở dữ liệu',
    answer: 'Chị đã tối ưu hóa hiệu năng truy vấn cơ sở dữ liệu PostgreSQL.',
    cv: 'Tech Lead: Chị đã tối ưu hóa hiệu năng truy vấn cơ sở dữ liệu PostgreSQL.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_09',
    category: 'supported_vi',
    description: 'Tôi đã có 4 năm kinh nghiệm làm việc với React',
    answer: 'Tôi đã có 4 năm kinh nghiệm làm việc với React.',
    cv: 'Frontend Developer: 4 năm kinh nghiệm làm việc với React và TypeScript.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_10',
    category: 'supported_vi',
    description: 'Chúng tôi triển khai CI/CD với GitHub Actions',
    answer: 'Chúng tôi thiết lập quy trình CI/CD tự động bằng GitHub Actions.',
    cv: 'Thiết lập quy trình CI/CD tự động bằng GitHub Actions giúp giảm thời gian release.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },

  // ─── 3. INFERRED EN (11-15) ───────────────────────────────────────────────
  {
    id: 'case_11',
    category: 'inferred_en',
    description: 'Plausible API maintenance qualification',
    answer: 'I maintained payment APIs for reliability.',
    cv: 'I built and maintained payment APIs.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_12',
    category: 'inferred_en',
    description: 'Unit testing on microservices backend',
    answer: 'I wrote automated unit tests for our Node.js microservices.',
    cv: 'Backend Developer: Developed microservices with Node.js and Jest testing framework.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_13',
    category: 'inferred_en',
    description: 'Cross-functional collaboration with designers',
    answer: 'I collaborated closely with UI designers to deliver React components.',
    cv: 'Frontend Developer: Built reusable React component library based on Figma designs.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_14',
    category: 'inferred_en',
    description: 'Troubleshooting memory leaks in production',
    answer: 'I diagnosed memory leaks in our Java backend services.',
    cv: 'Java Backend Engineer: Handled production incident triage, profiling, and debugging.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_15',
    category: 'inferred_en',
    description: 'Refactoring legacy code for maintainability',
    answer: 'I refactored legacy Python services into cleaner modules.',
    cv: 'Maintained and modernised legacy Python Django applications.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },

  // ─── 4. INFERRED VI (16-20) ───────────────────────────────────────────────
  {
    id: 'case_16',
    category: 'inferred_vi',
    description: 'Bảo trì API thanh toán nhằm tăng tính ổn định',
    answer: 'Tôi đã bảo trì các API thanh toán để đảm bảo tính sẵn sàng cao.',
    cv: 'Xây dựng và bảo trì các dịch vụ thanh toán trực tuyến.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_17',
    category: 'inferred_vi',
    description: 'Hỗ trợ đồng nghiệp trong code review',
    answer: 'Tôi thường xuyên review code cho các thành viên trong nhóm.',
    cv: 'Senior Developer: Chịu trách nhiệm chất lượng mã nguồn và tiêu chuẩn kỹ thuật nhóm.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_18',
    category: 'inferred_vi',
    description: 'Viết tài liệu kỹ thuật Swagger cho API',
    answer: 'Tôi đã viết tài liệu kỹ thuật Swagger chi tiết cho đối tác.',
    cv: 'Thiết kế RESTful APIs tích hợp với đối tác bên thứ ba sử dụng OpenAPI/Swagger.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_19',
    category: 'inferred_vi',
    description: 'Giám sát hệ thống với Prometheus',
    answer: 'Tôi cấu hình cảnh báo và theo dõi số liệu với Prometheus.',
    cv: 'Thiết lập hệ thống monitoring và alerting với Prometheus và Grafana.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_20',
    category: 'inferred_vi',
    description: 'Tối ưu trải nghiệm tải trang web',
    answer: 'Tôi đã tối ưu chỉ số Core Web Vitals cho ứng dụng web.',
    cv: 'Frontend Engineer: Tối ưu hiệu năng giao diện người dùng và tốc độ render trang.',
    expectedVerdict: 'INFERRED',
    expectedClaimType: 'personal_experience',
  },

  // ─── 5. METRIC MISMATCH (21-28) ───────────────────────────────────────────
  {
    id: 'case_21',
    category: 'metric_mismatch',
    description: 'Team size mismatch: 12 engineers vs CV 5 engineers',
    answer: 'At Acme, I led a team of 12 engineers.',
    cv: 'At Acme, I led a team of 5 engineers.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_22',
    category: 'metric_mismatch',
    description: 'Cost reduction exaggeration: 40% vs CV 15%',
    answer: 'I reduced AWS infrastructure costs by 40%.',
    cv: 'Optimized cloud resources and reduced infrastructure costs by 15%.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_23',
    category: 'metric_mismatch',
    description: 'Years of experience inflation: 7 years vs CV 3 years',
    answer: 'I have 7 years of professional experience in software engineering.',
    cv: 'Software engineer with 3 years of professional experience.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_24',
    category: 'metric_mismatch',
    description: 'Vietnamese team size mismatch: 15 kỹ sư vs CV 4 kỹ sư',
    answer: 'Tôi đã quản lý đội ngũ 15 kỹ sư tại Shopee.',
    cv: 'Shopee: Trưởng nhóm kỹ thuật quản lý 4 kỹ sư.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_25',
    category: 'metric_mismatch',
    description: 'Vietnamese percentage mismatch: giảm 50% độ trễ vs CV 20%',
    answer: 'Tôi đã tối ưu hóa và giảm 50% độ trễ hệ thống.',
    cv: 'Tối ưu hóa các câu lệnh SQL giúp giảm 20% độ trễ phản hồi.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_26',
    category: 'metric_mismatch',
    description: 'Scale inflation: 10 million users vs CV 500 thousand',
    answer: 'I built an authentication service serving 10 million users.',
    cv: 'Built an authentication service serving 500 thousand active users.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_27',
    category: 'metric_mismatch',
    description: 'Vietnamese year inflation: 6 năm kinh nghiệm Golang vs CV 2 năm',
    answer: 'Tôi đã có 6 năm kinh nghiệm lập trình Golang.',
    cv: 'Backend Developer: 2 năm kinh nghiệm lập trình Golang và 4 năm PHP.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_28',
    category: 'metric_mismatch',
    description: 'Team size inflated to 25 people vs CV 8 members',
    answer: 'I directed a department of 25 engineers at FinTech Corp.',
    cv: 'Led a squad of 8 engineers at FinTech Corp.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },

  // ─── 6. INVERTED RELATIONS / CAUSALITY (29-34) ───────────────────────────
  {
    id: 'case_29',
    category: 'inverted_relation',
    description: 'Inverted Kafka and RabbitMQ migration direction',
    answer: 'I migrated our message broker from Kafka to RabbitMQ.',
    cv: 'Migrated our messaging infrastructure from RabbitMQ to Kafka for higher partition scale.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_30',
    category: 'inverted_relation',
    description: 'Inverted database migration: MySQL to Postgres vs Postgres to MySQL',
    answer: 'I executed the migration from MySQL to PostgreSQL.',
    cv: 'Led the database transition from PostgreSQL to MySQL due to hosting constraints.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_31',
    category: 'inverted_relation',
    description: 'Vietnamese inverted migration: chuyển từ Redis sang Memcached',
    answer: 'Tôi đã chuyển đổi hệ thống cache từ Redis sang Memcached.',
    cv: 'Chuyển đổi hạ tầng caching từ Memcached sang Redis để hỗ trợ data structures phức tạp.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_32',
    category: 'inverted_relation',
    description: 'Arrow notation inversion: Vue -> React vs React -> Vue',
    answer: 'I migrated our frontend framework from Vue -> React.',
    cv: 'Led project migration: React -> Vue.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_33',
    category: 'inverted_relation',
    description: 'Vietnamese arrow inversion: RabbitMQ → Kafka',
    answer: 'Tôi đã dẫn dắt dự án chuyển đổi RabbitMQ → Kafka.',
    cv: 'Dự án kỹ thuật: Kafka → RabbitMQ.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_34',
    category: 'inverted_relation',
    description: 'Inverted architecture migration: microservices to monolith vs monolith to microservices',
    answer: 'I migrated our architecture from microservices into a monolith.',
    cv: 'Decomposed the legacy monolith and migrated from monolith to microservices.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'personal_experience',
  },

  // ─── 7. INVENTED ARCHITECTURE / PERSONAL FABRICATION (35-42) ───────────────
  {
    id: 'case_35',
    category: 'invented_architecture',
    description: 'Claiming Rust and Solana blockchain experience absent from CV',
    answer: 'I designed smart contracts using Rust on the Solana blockchain.',
    cv: 'Frontend Developer experienced in HTML, CSS, JavaScript, and React.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_36',
    category: 'invented_architecture',
    description: 'Claiming fictitious company experience at Google',
    answer: 'I worked as a Principal Architect at Google for 4 years.',
    cv: 'Software Engineer at StartupX and LocalSoft.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_37',
    category: 'invented_architecture',
    description: 'Fabricated machine learning model deployment with PyTorch',
    answer: 'I trained and deployed large language models using PyTorch on AWS SageMaker.',
    cv: 'PHP Web Developer building WordPress websites and Laravel CRUD applications.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_38',
    category: 'invented_architecture',
    description: 'Vietnamese invented Kubernetes cluster administration',
    answer: 'Tôi đã quản trị cụm Kubernetes đa vùng với hơn 50 worker nodes.',
    cv: 'Lập trình viên ReactJS và NodeJS xây dựng web bán hàng.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_39',
    category: 'invented_architecture',
    description: 'Invented high-frequency trading platform architecture',
    answer: 'I designed a zero-copy trading engine in C++ achieving sub-millisecond execution.',
    cv: 'Quality Assurance manual tester specializing in test case creation.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_40',
    category: 'invented_architecture',
    description: 'Vietnamese invented leadership at Grab',
    answer: 'Tôi đã từng giữ vị trí Head of Engineering tại Grab Vietnam.',
    cv: 'Lập trình viên backend tại Công ty ABC và Công ty XYZ.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_41',
    category: 'invented_architecture',
    description: 'Invented Apache Flink stream processing pipeline',
    answer: 'I built an Apache Flink real-time stream processing pipeline for clickstream data.',
    cv: 'Mobile iOS developer with Swift and SwiftUI experience.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_42',
    category: 'invented_architecture',
    description: 'Vietnamese invented Elasticsearch cluster scaling',
    answer: 'Tôi đã trực tiếp vận hành cụm Elasticsearch 30 nodes cho hệ thống tìm kiếm.',
    cv: 'Thiết kế đồ họa UI/UX và phát triển HTML/CSS cơ bản.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'metric',
  },

  // ─── 8. GENERAL TECHNICAL KNOWLEDGE (43-50) ──────────────────────────────
  {
    id: 'case_43',
    category: 'general_technical',
    description: 'CAP Theorem explanation must never be flagged as unsupported',
    answer: 'The CAP theorem states that a distributed system can only provide two of Consistency, Availability, and Partition tolerance.',
    cv: 'Java Backend Developer with Spring Boot experience.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'general_technical',
  },
  {
    id: 'case_44',
    category: 'general_technical',
    description: 'ACID database properties definition',
    answer: 'ACID properties ensure reliable processing of database transactions through atomicity, consistency, isolation, and durability.',
    cv: 'Frontend Engineer: React, TypeScript, TailwindCSS.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'general_technical',
  },
  {
    id: 'case_45',
    category: 'general_technical',
    description: 'Microservices vs Monolith trade-offs explanation',
    answer: 'Microservices introduce network latency and distributed state complexity compared to a monolith.',
    cv: 'Fullstack developer with Vue and Express.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'general_technical',
  },
  {
    id: 'case_46',
    category: 'general_technical',
    description: 'B-Tree indexing concept in relational databases',
    answer: 'B-Tree indexes allow logarithmic search time for range queries in relational databases.',
    cv: 'Junior mobile developer.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'general_technical',
  },
  {
    id: 'case_47',
    category: 'general_technical',
    description: 'Vietnamese CAP theorem description',
    answer: 'Định lý CAP chỉ ra rằng trong một hệ thống phân tán không thể đồng thời đạt cả ba tính nhất quán, tính sẵn sàng và khả năng chịu phân vùng.',
    cv: 'Lập trình viên backend Node.js.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'general_technical',
  },
  {
    id: 'case_48',
    category: 'general_technical',
    description: 'REST vs gRPC protocol comparison',
    answer: 'gRPC utilizes HTTP/2 and Protocol Buffers for binary serialization, offering lower serialization overhead than JSON REST APIs.',
    cv: 'Python developer specializing in data analysis.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'general_technical',
  },
  {
    id: 'case_49',
    category: 'general_technical',
    description: 'Vietnamese cache aside pattern explanation',
    answer: 'Mô hình Cache-Aside hoạt động bằng cách kiểm tra cache trước, nếu cache miss thì đọc từ database và ghi lại vào cache.',
    cv: 'Lập trình viên frontend Vue.js.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'general_technical',
  },
  {
    id: 'case_50',
    category: 'general_technical',
    description: 'Event-driven architecture decoupling benefit',
    answer: 'An event-driven architecture decouples producers and consumers using asynchronous message brokers.',
    cv: 'React developer with 2 years experience.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'general_technical',
  },

  // ─── 9. OPINION & APPROACH (51-54) ────────────────────────────────────────
  {
    id: 'case_51',
    category: 'opinion_approach',
    description: 'Engineering preference for automated integration tests',
    answer: 'I typically prioritize automated integration tests over brittle end-to-end tests for backend services.',
    cv: 'Software Engineer with test automation background.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'opinion_approach',
  },
  {
    id: 'case_52',
    category: 'opinion_approach',
    description: 'Vietnamese approach to database indexing',
    answer: 'Theo tôi, khi tối ưu cơ sở dữ liệu cần phân tích câu lệnh truy vấn thực tế trước khi thêm index.',
    cv: 'Lập trình viên backend.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'opinion_approach',
  },
  {
    id: 'case_53',
    category: 'opinion_approach',
    description: 'Architectural strategy preference for modular monolith',
    answer: 'In my opinion, early-stage startups should start with a clean modular monolith before splitting into microservices.',
    cv: 'Tech Lead with startup experience.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'opinion_approach',
  },
  {
    id: 'case_54',
    category: 'opinion_approach',
    description: 'Vietnamese opinion on code readability vs cleverness',
    answer: 'Quan điểm của tôi là mã nguồn dễ đọc và dễ bảo trì luôn quan trọng hơn các thủ thuật tối ưu quá sớm.',
    cv: 'Senior Engineer.',
    expectedVerdict: 'GENERAL_KNOWLEDGE',
    expectedClaimType: 'opinion_approach',
  },

  // ─── 10. CROSS-LINGUAL (VIETNAMESE ANSWER VS ENGLISH CV) (55-58) ───────────
  {
    id: 'case_55',
    category: 'cross_lingual',
    description: 'Vietnamese answer matching English CV metrics and roles',
    answer: 'Tôi đã quản lý đội ngũ 8 kỹ sư tại Acme.',
    cv: 'At Acme, I led a team of 8 engineers.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_56',
    category: 'cross_lingual',
    description: 'Vietnamese answer matching English database optimization',
    answer: 'Tôi đã tối ưu hóa hiệu năng cơ sở dữ liệu PostgreSQL để giảm độ trễ.',
    cv: 'Optimized PostgreSQL database performance and reduced latency.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_57',
    category: 'cross_lingual',
    description: 'English answer matching Vietnamese CV experience',
    answer: 'I deployed microservices with Docker and Kubernetes.',
    cv: 'Triển khai vi dịch vụ với Docker và Kubernetes trên môi trường production.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_58',
    category: 'cross_lingual',
    description: 'Vietnamese answer matching English cloud infrastructure',
    answer: 'Em đã xây dựng hệ thống hàng đợi bằng RabbitMQ.',
    cv: 'Built distributed message queue system with RabbitMQ.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },

  // ─── 11. NEGATION BOUNDARY SAFETY (59-62) ─────────────────────────────────
  {
    id: 'case_59',
    category: 'negation_boundary',
    description: 'Word "notification" must not trigger false "not" negation contradiction',
    answer: 'I built the notification service using Redis and WebSockets.',
    cv: 'Built the notification service using Redis and WebSockets for real-time alerts.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_60',
    category: 'negation_boundary',
    description: 'CV contains unrelated negation elsewhere, but claim is explicitly matched',
    answer: 'I led a team of 8 engineers at Acme.',
    cv: 'I do not write PHP code anymore. At Acme, I led a team of 8 engineers.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_61',
    category: 'negation_boundary',
    description: 'CV explicitly negates leadership experience -> must be CONTRADICTED',
    answer: 'I led a team of 8 engineers.',
    cv: 'I did not lead a team and worked independently as an individual contributor.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_62',
    category: 'negation_boundary',
    description: 'Vietnamese CV explicitly negates experience -> CONTRADICTED',
    answer: 'Tôi đã từng quản lý đội ngũ lập trình viên.',
    cv: 'Tôi chưa từng quản lý đội ngũ nào, chỉ tập trung viết mã kỹ thuật độc lập.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'personal_experience',
  },

  // ─── 12. SOURCE ISOLATION (JD/INTERVIEWER VS CANDIDATE) (63-65) ───────────
  {
    id: 'case_63',
    category: 'source_isolation',
    description: 'JD requires 5 years React, candidate CV has 1 year -> Candidate claims 5 years -> CONTRADICTED',
    answer: 'I have 5 years of React experience.',
    cv: 'Frontend Developer: 1 year of React experience.',
    jobDescription: 'Requirements: Must have 5 years of React experience and TypeScript mastery.',
    expectedVerdict: 'CONTRADICTED',
    expectedClaimType: 'metric',
  },
  {
    id: 'case_64',
    category: 'source_isolation',
    description: 'Interviewer says "We use Kafka", candidate claims "I built Kafka clusters" absent from CV -> UNSUPPORTED',
    answer: 'I built and scaled large Kafka clusters.',
    cv: 'Fullstack developer: React, Node.js, Express, MongoDB.',
    transcript: 'Interviewer: We use Kafka for high-throughput streaming in our platform.\nCandidate: That sounds interesting.',
    expectedVerdict: 'UNSUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_65',
    category: 'source_isolation',
    description: 'Candidate utterance in transcript correctly counts as candidate proof',
    answer: 'I managed our cloud infrastructure on Google Cloud Platform.',
    cv: 'Software Engineer.',
    transcript: 'Interviewer: What cloud provider did you use?\nCandidate: I managed our cloud infrastructure on Google Cloud Platform for two years.',
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },

  // ─── 13. LONG CONTEXT > 4000 CHARS (66-67) ────────────────────────────────
  {
    id: 'case_66',
    category: 'long_context',
    description: 'Key candidate fact located beyond 4500 characters in long CV context',
    answer: 'I designed the payment gateway at EnterpriseCorp.',
    cv: 'PROJECT DETAILS SUMMARY:\n' +
      'Detailed background description. '.repeat(160) + // ~4800 characters of filler
      '\nAt EnterpriseCorp, I designed the payment gateway and handled bank integrations.\n' +
      'Additional appendix notes. '.repeat(50),
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
  {
    id: 'case_67',
    category: 'long_context',
    description: 'Vietnamese candidate experience located deep in 5000+ char document',
    answer: 'Tôi đã xây dựng hệ thống xử lý thanh toán đa cổng tại tập đoàn Viettel.',
    cv: 'TỔNG QUAN QUÁ TRÌNH CÔNG TÁC VÀ HỒ SƠ ỨNG VIÊN CHI TIẾT.\n' +
      'Mô tả các dự án và công nghệ trước đây. '.repeat(150) +
      '\nTại tập đoàn Viettel, tôi đã xây dựng hệ thống xử lý thanh toán đa cổng kết nối với 12 ngân hàng.\n' +
      'Các chứng chỉ và bằng cấp khác. '.repeat(40),
    expectedVerdict: 'SUPPORTED',
    expectedClaimType: 'personal_experience',
  },
]
