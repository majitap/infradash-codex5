import {
  CircleArrowUpIcon,
  CoinsIcon,
  FolderGit2Icon,
  GaugeIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  ScrollTextIcon,
  ServerIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SirenIcon,
  SparklesIcon,
  UserCogIcon,
  UsersIcon,
  WorkflowIcon,
  FileSearchIcon,
  KeyRoundIcon,
  PlugIcon,
  type LucideIcon,
} from "lucide-react";

export type Tone =
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "sky"
  | "violet"
  | "teal"
  | "orange";
export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
  tone: Tone;
  keywords?: string[];
  children?: NavItem[];
};
export type NavGroup = { label: string; items: NavItem[] };
const item = (
  title: string,
  url: string,
  icon: LucideIcon,
  description: string,
  tone: Tone = "indigo",
  children?: NavItem[],
): NavItem => ({ title, url, icon, description, tone, children });
export const navGroups: NavGroup[] = [
  {
    label: "워크스페이스",
    items: [
      item("개요", "/", LayoutDashboardIcon, "조직 전체 상태와 라이선스 현황"),
      item(
        "프로젝트",
        "/projects",
        FolderGit2Icon,
        "저장소와 개발 활동",
        "emerald",
        [
          item(
            "프로젝트 현황",
            "/projects",
            FolderGit2Icon,
            "프로젝트 활동과 건강도",
            "emerald",
          ),
          item(
            "커밋",
            "/commits",
            GitCommitHorizontalIcon,
            "기여와 커밋 활동",
            "violet",
          ),
          item(
            "머지 리퀘스트",
            "/merge-requests",
            GitPullRequestIcon,
            "리뷰와 머지 흐름",
            "orange",
          ),
        ],
      ),
      item(
        "CI/CD",
        "/pipelines",
        WorkflowIcon,
        "파이프라인·러너·배포 성과",
        "sky",
        [
          item(
            "파이프라인",
            "/pipelines",
            WorkflowIcon,
            "CI/CD 실행, 성공률과 실패 원인",
            "sky",
          ),
          item("러너", "/runners", ServerIcon, "등록 러너와 처리 용량", "teal"),
          item(
            "배포 성과",
            "/dora",
            GaugeIcon,
            "DORA 배포 속도와 안정성",
            "emerald",
          ),
        ],
      ),
      item(
        "인프라",
        "/topology",
        NetworkIcon,
        "서비스 연결과 스토리지",
        "sky",
        [
          item(
            "인프라 구성도",
            "/topology",
            NetworkIcon,
            "서비스 연결과 노드 상태",
            "sky",
          ),
          item(
            "스토리지",
            "/storage",
            HardDriveIcon,
            "저장소·아티팩트·레지스트리",
            "amber",
          ),
        ],
      ),
      item(
        "인시던트",
        "/incidents",
        SirenIcon,
        "장애 현황과 복구 기록",
        "rose",
      ),
    ],
  },
  {
    label: "관측과 인사이트",
    items: [
      item(
        "로그 분석",
        "/logs",
        FileSearchIcon,
        "LGTM · Loki 로그 검색과 분석",
        "teal",
      ),
      item(
        "클라우드 비용",
        "/finops",
        CoinsIcon,
        "지출과 절감안 시뮬레이션",
        "amber",
      ),
      item(
        "AI 운영 센터",
        "/ai-ops",
        SparklesIcon,
        "인프라 진단과 조치 예시",
        "violet",
      ),
    ],
  },
  {
    label: "관리",
    items: [
      item(
        "보안·접근",
        "/security",
        ShieldCheckIcon,
        "보안·사용자·권한·감사",
        "rose",
        [
          item(
            "보안 현황",
            "/security",
            ShieldCheckIcon,
            "취약점과 보안 검사",
            "rose",
          ),
          item("사용자", "/users", UsersIcon, "사용자 계정과 활동", "indigo"),
          item(
            "권한 관리",
            "/access",
            UserCogIcon,
            "접근 요청과 관리자 권한",
            "orange",
          ),
          item(
            "감사 로그",
            "/audit",
            ScrollTextIcon,
            "사용자와 설정 변경 이력",
            "sky",
          ),
        ],
      ),
      item(
        "관리자",
        "/admin",
        Settings2Icon,
        "운영 설정과 연동 관리",
        "indigo",
        [
          item(
            "운영 설정",
            "/admin",
            Settings2Icon,
            "관리자 모드와 GitLab 메인터넌스",
          ),
          item(
            "라이선스",
            "/admin/license",
            KeyRoundIcon,
            "좌석 수량과 라이선스 만료",
            "amber",
          ),
          item(
            "연동 설정",
            "/admin/integrations",
            PlugIcon,
            "GitLab·LGTM 연결 준비",
            "teal",
          ),
          item(
            "버전 업그레이드",
            "/upgrade",
            CircleArrowUpIcon,
            "업그레이드 경로와 점검",
            "violet",
          ),
        ],
      ),
    ],
  },
];
export const topLevelMenuCount = navGroups.reduce(
  (n, g) => n + g.items.length,
  0,
);
const flatten = (items: NavItem[]): NavItem[] =>
  items.flatMap((n) => n.children ?? [n]);
export const searchNavGroups = navGroups.map((g) => ({
  ...g,
  items: flatten(g.items),
}));
export const navItems = searchNavGroups.flatMap((g) => g.items);
export function normalizePath(pathname: string | null) {
  return pathname?.replace(/\/+$/, "") || "/";
}
export function findNavItem(pathname: string | null) {
  return navItems.find((n) => n.url === normalizePath(pathname));
}
