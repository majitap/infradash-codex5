# InfraDash 05

[사이트 열기](https://majitap.github.io/infradash-codex5/)

4번의 부드러운 보라색과 둥근 카드를 이어받아, 데이터 탐색과 재질·타이포그래피·상호작용을 다듬은 GitLab 인프라 대시보드입니다.

## 이번 버전

- 빛과 깊이를 절제해 넣은 성공률 카드, 연속적인 숫자 전환, 공통 모션 토큰.
- 7/30일 집계, 곡선·막대 전환, 이전 기간 비교, 포인터·키보드 날짜 탐색, CSV 저장.
- 첫 화면의 서비스 맵과 러너 용량 전환, 58개 슬롯을 표현한 분할 게이지.
- 13개 노드를 탐색하는 전체 구성도와 노드 인스펙터, 분류별 목록 보기.
- 지출 항목별 도넛 차트와 절감안 시뮬레이션. 선택한 절감안을 CSV로 저장.
- 원래 제공하던 파이프라인·러너·프로젝트·DORA·AI 예시·보안·권한·스토리지 화면 유지.
- 자체 호스팅 Pretendard, 8px 간격, 키보드 포커스, 모바일 배치, 모션 감소, 다크 테마.

## 데이터와 범위

2026년 10월 31일 기준 모의 데이터입니다. 실제 GitLab, 클라우드, AI API를 연결하지 않습니다. 구성도의 연결은 미리 정의한 구성 관계 예시이며 실시간 네트워크 탐지 결과가 아닙니다. 등록 러너·클라우드 노드·시스템 구성 요소는 서로 다른 집계 범위입니다.

기간별 카드·차트·CSV는 같은 원본 집계에서 계산합니다. Gitaly 경고 수치는 인시던트의 91%와 일치하도록 정리했습니다. 비용 시뮬레이션은 제안 절감액을 단순 합산하며 실제 설정을 변경하지 않습니다. AI 대화는 예시 응답입니다.

## 개발과 검증

```sh
npm ci
npm run dev
# http://localhost:3000/infradash-codex5/
npm run check:spacing
npm test
npm run lint
npx tsc --noEmit
npm run build
```

GitHub Actions에서 간격·테스트·코드·타입 검사와 전체 정적 빌드 후 out/을 GitHub Pages에 배포합니다. Next.js의 basePath는 /infradash-codex5입니다.

설계 원칙은 [DESIGN.md](DESIGN.md)에 정리했습니다.

## 출처

[InfraDash 04](https://github.com/majitap/infradash-codex4)를 기반으로 제작했습니다. 최초 [Gemini Edition](https://github.com/majitap/infradash-gemni)의 데이터 모델과 분석 화면을 계승하고 Git 기록 및 [원본 설명](README.gemini.md)을 보존합니다. 폰트 라이선스는 public/licenses/에 있습니다.

## 실제 인프라 상태 연동 준비

개요 최상단에 실제 상태 패널을 추가했습니다. GitLab 웹·API·readiness, EKS 제어 영역, HA 워크로드의 목표/준비 복제본을 구분합니다. 아직 실제 환경 설정이 없어 공개 사이트에는 미연동으로 표시하며, 기존 분석 화면은 계속 모의 데이터입니다.

[내일 준비할 정보와 로컬 수집기 실행 방법](docs/LIVE-DATA-SETUP.md)을 확인하세요. 읽기 전용 수집기, 환경 변수 예시, IAM/RBAC 템플릿, 응답 스키마와 실패·만료 처리까지 포함했습니다. 수집기 운영 배포와 SSO 연결은 환경 정보 확인 후 진행합니다. 관리자 쓰기 권한은 사용하지 않습니다.
