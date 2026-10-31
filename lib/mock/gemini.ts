export interface GeminiAnomaly {
  id: string
  title: string
  category: "runner" | "database" | "storage" | "pipeline" | "security"
  severity: "critical" | "warning" | "info"
  confidence: number
  summary: string
  rootCause: string
  impact: string
  recommendedAction: string
  actionLabel: string
  timestamp: string
  resolved: boolean
  affectedNodes: string[]
}

export interface GeminiOptimization {
  id: string
  title: string
  target: string
  metricBefore: string
  metricAfter: string
  improvement: string
  status: "applied" | "in_progress" | "scheduled"
  timestamp: string
}

export interface TopologyNode {
  id: string
  name: string
  category: "edge" | "app" | "storage" | "database" | "runner" | "object"
  categoryLabel: string
  status: "healthy" | "warning" | "critical"
  metrics: {
    cpu?: number
    memory?: number
    qps?: string
    latency?: string
    storage?: string
    instances?: string
  }
  description: string
  zone: string
}

export interface TopologyLink {
  from: string
  to: string
  label: string
  status: "healthy" | "busy" | "degraded"
  latency: string
}

export interface DoraMetric {
  key: string
  title: string
  value: string
  unit: string
  tier: "Elite" | "High" | "Medium" | "Low"
  delta: string
  deltaType: "positive" | "neutral" | "negative"
  description: string
  benchmark: string
}

export interface FinOpsSummary {
  monthlyTotal: number
  monthlyDelta: number
  spotSavings: number
  spotRatio: number
  idleWaste: number
  reclaimableStorage: string
}

export const geminiAnomalies: GeminiAnomaly[] = [
  {
    id: "ano-01",
    title: "AWS EKS 스팟 러너 사전 중단 리스크 감지",
    category: "runner",
    severity: "warning",
    confidence: 96,
    summary: "ap-northeast-2a 가용영역 c6i.2xlarge 스팟 풀의 가격 급등(+18%) 및 회수율 급증 패턴이 감지되었습니다.",
    rootCause: "AWS 리전 내 스팟 용량 풀 수급 불안정으로 인해 향후 45분 내 러너 노드 12대 중단 가능성 88%",
    impact: "진행 중인 28개 CI/CD 파이프라인 잡의 강제 중단 및 빌드 재시도 지연 발생 가능",
    recommendedAction: "Karpenter 프로비저너를 ap-northeast-2c/2d 가용영역 분산 및 온디맨드 세이프티 폴백으로 즉시 전환",
    actionLabel: "스팟 풀 리밸런싱 실행",
    timestamp: "8분 전",
    resolved: false,
    affectedNodes: ["eks-runner-spot-01", "eks-runner-spot-03", "k8s-pod-pool-a"],
  },
  {
    id: "ano-02",
    title: "Gitaly Shard-02 리포지토리 I/O 병목 및 지연율 상승",
    category: "storage",
    severity: "critical",
    confidence: 94,
    summary: "Gitaly shard-02 노드의 NVMe 디스크 IOPS가 한계치(98%)에 도달하여 git pack-objects 대기 큐가 누적 중입니다.",
    rootCause: "대규모 모노레포 'infra/cloud-platform'의 동시 40개 빌드 잡에서 shallow clone 미적용 및 fetch 폭주",
    impact: "GitLab UI 커밋 뷰어 로딩 지연(최대 4.8s) 및 CI 코드 체크아웃 타임아웃 6건 발생",
    recommendedAction: "GitLab CI 캐시 레이어 활성화 및 Praefect 샤드 리포지토리 4개 shard-03으로 동적 리밸런싱",
    actionLabel: "샤드 I/O 부하 분산 적용",
    timestamp: "24분 전",
    resolved: false,
    affectedNodes: ["gitaly-shard-02", "praefect-cluster"],
  },
  {
    id: "ano-03",
    title: "PostgreSQL Patroni 읽기 복제본 복제 지연(Replication Lag)",
    category: "database",
    severity: "warning",
    confidence: 91,
    summary: "pg-replica-02의 WAL replay 지연이 1,280ms로 급증하여 최근 활동 쿼리에서 일시적 데이터 불일치 경고가 발생했습니다.",
    rootCause: "배치 감사 로그 적재 트랜잭션과 Grafana 대시보드 대량 메트릭 조회 쿼리 동시 실행",
    impact: "읽기 트래픽의 primary 노드 일시 집중으로 primary CPU 부하 72%로 상승",
    recommendedAction: "감사 로그 수집 쿼리 chunk size 축소 및 읽기 전용 풀 Connection Router 재조정",
    actionLabel: "WAL Replay 스케줄러 튜닝",
    timestamp: "45분 전",
    resolved: true,
    affectedNodes: ["pg-patroni-replica-2", "pg-patroni-primary"],
  },
  {
    id: "ano-04",
    title: "도커 빌드 캐시 미스로 인한 파이프라인 평균 소요 시간 28% 증가",
    category: "pipeline",
    severity: "info",
    confidence: 89,
    summary: "최근 24시간 동안 'backend-services' 그룹의 Docker 빌드 캐시 히트율이 84%에서 41%로 급감했습니다.",
    rootCause: "Base Image Dockerfile 내 ADD . /app 구문 위치가 의존성 설치(go mod download) 이전으로 변경되어 레이어 캐시 무효화",
    impact: "빌드 평균 시간 4분 12초 -> 9분 45초로 증가, 일간 러너 컴퓨트 비용 약 $180 증가",
    recommendedAction: "Dockerfile 캐시 레이어 최적화 권고안 생성 및 자동 MR 생성",
    actionLabel: "최적화 MR 자동 생성",
    timestamp: "2시간 전",
    resolved: true,
    affectedNodes: ["runner-eks-spot"],
  },
]

export const geminiOptimizations: GeminiOptimization[] = [
  {
    id: "opt-01",
    title: "Gitaly Shard-01 리포지토리 자동 최적화 Repack",
    target: "gitaly-shard-01",
    metricBefore: "p99 레이턴시 380ms",
    metricAfter: "p99 레이턴시 62ms",
    improvement: "-83.6% 레이턴시 단축",
    status: "applied",
    timestamp: "오늘 14:20",
  },
  {
    id: "opt-02",
    title: "Kubernetes Runner warm pod pool 적응형 프리워밍",
    target: "runner-eks-spot",
    metricBefore: "콜드 스타트 대기 48초",
    metricAfter: "즉각 잡 시작 3.2초",
    improvement: "대기 시간 93% 단축",
    status: "applied",
    timestamp: "오늘 11:05",
  },
  {
    id: "opt-03",
    title: "고아 컨테이너 볼륨 및 dangling image 480개 가비지 컬렉션",
    target: "runner-nodes-all",
    metricBefore: "디스크 사용량 88%",
    metricAfter: "디스크 사용량 54%",
    improvement: "1.82 TB 스토리지 회수",
    status: "applied",
    timestamp: "어제 22:30",
  },
  {
    id: "opt-04",
    title: "Redis Sidekiq 큐 메모리 압축 & 커넥션 풀링 최적화",
    target: "redis-sentinel",
    metricBefore: "메모리 점유 7.8 GB",
    metricAfter: "메모리 점유 4.2 GB",
    improvement: "46% 메모리 절감",
    status: "applied",
    timestamp: "어제 16:15",
  },
]

export const topologyNodes: TopologyNode[] = [
  {
    id: "cf-edge",
    name: "Cloudflare 엣지 / 웹 방화벽",
    category: "edge",
    categoryLabel: "엣지 & 보안",
    status: "healthy",
    metrics: { qps: "54.2k req/s", latency: "14ms", instances: "글로벌 애니캐스트" },
    description: "글로벌 Anycast CDN, DDoS 방어, SSL/TLS 종단, GitLab 외부 인그레스 게이트웨이",
    zone: "글로벌 엣지",
  },
  {
    id: "haproxy-layer",
    name: "HAProxy L7 인그레스 부하 분산",
    category: "edge",
    categoryLabel: "로드 밸런서",
    status: "healthy",
    metrics: { cpu: 18, memory: 34, qps: "18.4k req/s", instances: "노드 2대 (활성 / 대기)" },
    description: "Puma Web, Gitaly SSH, Container Registry 경로 라우팅 및 헬스 체크",
    zone: "ap-northeast-2a/c",
  },
  {
    id: "gitlab-rails",
    name: "GitLab Rails Workhorse",
    category: "app",
    categoryLabel: "애플리케이션 코어",
    status: "healthy",
    metrics: { cpu: 46, memory: 68, qps: "4.8k req/s", latency: "42ms", instances: "파드 8개" },
    description: "GitLab Puma 웹 서버 및 API 엔드포인트 엔진, 프로젝트/MR/사용자 로직 처리",
    zone: "EKS 핵심 클러스터",
  },
  {
    id: "gitlab-sidekiq",
    name: "GitLab Sidekiq 워커",
    category: "app",
    categoryLabel: "비동기 큐 워커",
    status: "healthy",
    metrics: { cpu: 58, memory: 72, instances: "파드 12개 (큐 24개)" },
    description: "이메일 알림, 브랜치 동기화, 파이프라인 트리거 비동기 백그라운드 처리",
    zone: "EKS 핵심 클러스터",
  },
  {
    id: "praefect",
    name: "Praefect 고가용성 라우팅",
    category: "storage",
    categoryLabel: "스토리지 라우터",
    status: "healthy",
    metrics: { latency: "8ms", instances: "노드 3대 · 고가용성", qps: "9.2k rpc/s" },
    description: "Gitaly 클러스터 고가용성 프록시, 가상 스토리지 라우팅, 실시간 복제 조정",
    zone: "ap-northeast-2a/b/c",
  },
  {
    id: "gitaly-shard-01",
    name: "Gitaly 샤드 01 · 핵심 저장소",
    category: "storage",
    categoryLabel: "Git 저장소 샤드",
    status: "healthy",
    metrics: { cpu: 32, memory: 64, storage: "4.8 TB / 10 TB (48%)", latency: "18ms" },
    description: "핵심 프로덕션 리포지토리 및 공통 라이브러리 저장 샤드 (NVMe RAID-10)",
    zone: "스토리지 샤드 A",
  },
  {
    id: "gitaly-shard-02",
    name: "Gitaly 샤드 02 · 고부하",
    category: "storage",
    categoryLabel: "Git 저장소 샤드",
    status: "warning",
    metrics: { cpu: 78, memory: 86, storage: "9.1 TB / 10 TB (91%)", latency: "64ms" },
    description: "대형 모노레포 및 빌드 빈도가 높은 프로젝트 전용 샤드 (I/O 병목 경보)",
    zone: "스토리지 샤드 B",
  },
  {
    id: "gitaly-shard-03",
    name: "Gitaly 샤드 03 · 보관 및 백업",
    category: "storage",
    categoryLabel: "Git 저장소 샤드",
    status: "healthy",
    metrics: { cpu: 22, memory: 48, storage: "3.8 TB / 10 TB (38%)", latency: "24ms" },
    description: "아카이브 프로젝트 및 내부 툴링 저장소, Praefect 복제 예비 노드",
    zone: "스토리지 샤드 C",
  },
  {
    id: "pg-patroni",
    name: "PostgreSQL 16 고가용성 (Patroni)",
    category: "database",
    categoryLabel: "RDBMS 코어",
    status: "healthy",
    metrics: { cpu: 44, memory: 76, qps: "3,850 TPS", latency: "1.4ms", instances: "주 노드 1대 + 복제본 2대" },
    description: "메타데이터, 이슈, MR, 사용자 권한 및 감사 기록을 저장하는 Patroni 기반 고가용성 DB",
    zone: "RDS 다중 가용 영역 + 복제본",
  },
  {
    id: "redis-sentinel",
    name: "Redis Sentinel 클러스터",
    category: "database",
    categoryLabel: "인메모리 캐시",
    status: "healthy",
    metrics: { cpu: 28, memory: 52, instances: "노드 3대 (캐시 + 큐)", latency: "0.6ms" },
    description: "세션 캐시, 레이트 리밋 카운터, Sidekiq 잡 큐를 위한 분리형 Redis 클러스터",
    zone: "ElastiCache 고가용성",
  },
  {
    id: "s3-minio",
    name: "오브젝트 스토리지 (S3 / LFS)",
    category: "object",
    categoryLabel: "오브젝트 스토리지",
    status: "healthy",
    metrics: { storage: "48.2 TB", qps: "1.4k req/s", latency: "18ms" },
    description: "Git LFS 대용량 바이너리, CI/CD 아티팩트, 패키지 및 컨테이너 이미지 레이어",
    zone: "AWS S3 다중 스토리지 계층",
  },
  {
    id: "runner-eks-spot",
    name: "쿠버네티스 러너 (AWS EKS 스팟)",
    category: "runner",
    categoryLabel: "CI/CD 스팟 러너",
    status: "warning",
    metrics: { cpu: 82, memory: 88, instances: "노드 64대 (파드 280개)", qps: "실행 중인 작업 128개" },
    description: "Karpenter 기반 대규모 탄력적 오토스케일링 스팟 러너 풀 (비용 절감 68%)",
    zone: "ap-northeast-2a/c",
  },
  {
    id: "runner-gpu-baremetal",
    name: "베어메탈 GPU 러너 (NVIDIA L40S)",
    category: "runner",
    categoryLabel: "AI/ML 전용 러너",
    status: "healthy",
    metrics: { cpu: 48, memory: 62, instances: "노드 4대 (GPU 8개)" },
    description: "CUDA 가속 머신러닝 모델 빌드, 테스트, 인퍼런스 벤치마크 전용 러너",
    zone: "사내 데이터센터",
  },
]

export const doraMetrics: DoraMetric[] = [
  {
    key: "df",
    title: "배포 빈도",
    value: "18.4",
    unit: "회 / 일",
    tier: "Elite",
    delta: "+22.6%",
    deltaType: "positive",
    description: "프로덕션 환경에 성공적으로 배포되는 일일 평균 횟수",
    benchmark: "최상위 기준: 하루 수 회 이상 배포",
  },
  {
    key: "lt",
    title: "변경 반영 시간",
    value: "42",
    unit: "분",
    tier: "Elite",
    delta: "-18.2%",
    deltaType: "positive",
    description: "코드 커밋부터 프로덕션 배포 완료까지 걸리는 시간",
    benchmark: "최상위 기준: 1시간 미만",
  },
  {
    key: "cfr",
    title: "변경 실패율",
    value: "1.8",
    unit: "%",
    tier: "Elite",
    delta: "-0.6%p",
    deltaType: "positive",
    description: "프로덕션 배포 후 롤백 또는 핫픽스가 필요한 비율",
    benchmark: "최상위 기준: 0% ~ 15%",
  },
  {
    key: "mttr",
    title: "서비스 복구 시간",
    value: "14",
    unit: "분",
    tier: "Elite",
    delta: "-28.4%",
    deltaType: "positive",
    description: "프로덕션 장애 발생 시 정상 상태로 복구하는 데 걸리는 평균 시간",
    benchmark: "최상위 기준: 1시간 미만",
  },
]

export const doraServiceRankings = [
  { name: "core-platform-api", team: "플랫폼팀", df: "8.2회/일", lt: "24분", cfr: "0.8%", mttr: "8분", tier: "Elite" },
  { name: "web-frontend-client", team: "프론트팀", df: "5.4회/일", lt: "18분", cfr: "1.2%", mttr: "11분", tier: "Elite" },
  { name: "auth-gateway-service", team: "보안팀", df: "2.1회/일", lt: "38분", cfr: "0.0%", mttr: "4분", tier: "Elite" },
  { name: "data-pipeline-batch", team: "데이터팀", df: "1.4회/일", lt: "56분", cfr: "3.4%", mttr: "26분", tier: "High" },
  { name: "ml-inference-serving", team: "AI랩", df: "1.2회/일", lt: "74분", cfr: "4.1%", mttr: "34분", tier: "High" },
]

export const finOpsData: FinOpsSummary = {
  monthlyTotal: 38420,
  monthlyDelta: -12.4,
  spotSavings: 14280,
  spotRatio: 68.4,
  idleWaste: 2840,
  reclaimableStorage: "12.4 TB",
}

export const finOpsCostBreakdown = [
  { category: "AWS EKS 스팟 러너", cost: 12450, percentage: 32.4, status: "최적화됨" },
  { category: "온디맨드 빌드 인스턴스", cost: 6820, percentage: 17.8, status: "전환 권장" },
  { category: "S3 & MinIO 아티팩트 스토리지", cost: 7120, percentage: 18.5, status: "정책 점검" },
  { category: "PostgreSQL & RDS HA", cost: 5840, percentage: 15.2, status: "정상" },
  { category: "Gitaly 블록 스토리지 (EBS io2)", cost: 4210, percentage: 11.0, status: "정상" },
  { category: "Cloudflare & 네트워킹", cost: 1980, percentage: 5.1, status: "최적화됨" },
]

export const finOpsSavingsRecommendations = [
  {
    id: "rec-01",
    title: "테스트 파이프라인 아티팩트 보관 주기 7일로 단축",
    impact: "$840 / 월 절감",
    effort: "낮음 (설정 즉시 반영)",
    description: "성공한 테스트 잡의 JUnit 및 임시 바이너리가 영구 저장되고 있습니다. 7일 자동 만료로 8.2 TB 절감 가능.",
  },
  {
    id: "rec-02",
    title: "개발 브랜치 러너 Karpenter Spot 인스턴스 100% 전환",
    impact: "$1,620 / 월 절감",
    effort: "중간 (태그 라우팅 적용)",
    description: "현재 dev/feature 브랜치 잡 중 34%가 온디맨드 노드에서 실행 중입니다. 스팟 전환 시 동일 성능 보장.",
  },
  {
    id: "rec-03",
    title: "미사용 도커 컨테이너 레지스트리 태그 자동 프룬",
    impact: "$490 / 월 절감",
    effort: "낮음 (GitLab Cleanup Policy)",
    description: "머지된 기능 브랜치의 임시 컨테이너 이미지 태그 1,240개가 잔존해 있습니다.",
  },
]
