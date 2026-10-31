# 운영 API 연결

GitHub Pages는 정적 화면입니다. 현재 공개 사이트에서는 라이선스 수량을 임의로 생성하지 않으며, 관리자 모드와 메인터넌스 변경은 명시적인 데모로 제공됩니다. 실제 변경은 발생하지 않습니다. 로그 화면의 예시 버튼도 모의 데이터만 표시합니다.

기존 `services/collector/`의 GitLab/EKS 상태 수집기는 계속 읽기 전용입니다. 이 문서의 `services/operations/`는 별도 서버에 연결하는 선택적 운영 어댑터이며, 기존 로컬 수집기의 네트워크·권한 범위를 넓히지 않습니다.

## 1. 인증 게이트웨이에 어댑터 연결

`createOperationsHandler`는 표준 Web Request → Response 함수입니다. HTTPS 운영 서버의 `/api/operations/*`에 마운트하세요. GitHub Pages에는 이 서버가 포함되지 않습니다. 기본 동작은 인증 거부이며 브라우저가 보낸 역할·사용자 헤더를 신뢰하지 않습니다.

```ts
import { createOperationsHandler } from "./services/operations/handler";
import { readOperationsConfig } from "./services/operations/config";

const handler = createOperationsHandler(readOperationsConfig(), {
  // 조직 SSO SDK의 서버 세션 검증을 구현하세요. 임의 헤더 파싱으로 대체하지 마세요.
  authorize: async (request) => {
    const session = await yourSso.verifyServerSession(request);
    if (!session) return null;
    return {
      id: session.subject,
      name: session.displayName,
      role: session.isOperationsAdmin ? "admin" : "viewer",
      permissions: session.operationsPermissions,
      csrfToken: session.serverGeneratedCsrfToken,
      expiresAt: session.expiresAt,
    };
  },
  // 변경 전에 requested 이벤트 기록이 완료돼야 GitLab에 PUT을 전송합니다.
  audit: async (event) => { await yourDurableAuditStore.append(event); },
});
```

`yourSso`와 `yourDurableAuditStore`는 조직 환경에서 구현할 어댑터이며 저장소에 기본 인증 우회 구현은 없습니다. SSO 쿠키는 Secure/HttpOnly로 설정하고 공개 Pages와 다른 사이트라면 조직의 cross-site 쿠키 정책도 확인하세요. 게이트웨이에 요청 속도 제한·세션 관리·영구 감사 저장을 적용합니다. 배포본 전체의 서버 코드를 실행해야 하므로 TypeScript/Node 런타임과 프로젝트 의존성이 필요합니다.

권한은 `license:read`, `maintenance:read`, `maintenance:write`, `logs:read`로 구분합니다. 쓰기는 관리자 역할과 읽기·쓰기 권한을 모두 요구합니다. 클라이언트의 관리자 모드 토글은 인증을 부여하지 않습니다. UI 모드는 최대 15분이며 실제 SSO 세션 만료 시 더 일찍 종료됩니다.

서버 환경 변수는 `.env.example`을 참고하세요. `OPERATIONS_ALLOWED_ORIGINS=https://majitap.github.io`처럼 정확한 Origin만 허용하며 경로나 와일드카드를 넣지 않습니다. 쓰기에는 Origin, 세션에 연결된 CSRF 토큰, JSON Content-Type, 4KB 이하의 엄격한 요청 스키마가 필요합니다. 변경 전 revision 비교와 변경 후 재조회를 수행합니다. 여러 서버 인스턴스에서는 동일한 GitLab 설정에 대한 쓰기를 게이트웨이/분산 잠금으로 직렬화하세요. 외부 관리자의 GitLab 직접 변경과의 원자적 비교·갱신은 GitLab API가 제공하지 않으므로 조직 변경 절차로 조율해야 합니다. 서버 재조회와 저장된 감사 로그가 최종 확인 수단입니다.

## 2. GitLab 라이선스와 메인터넌스

- 라이선스: 관리자 권한으로 `GET /api/v4/license`를 호출합니다. `user_limit`, `active_users`, `expires_at`, `plan`, `expired`만 브라우저에 반환하며 licensee와 라이선스 원문은 제외합니다. 모르는 수량을 0으로 가정하지 않습니다. 현재 활성 사용자 기준이며 결제용 과거 최대 좌석 수와 다를 수 있습니다. [GitLab License API](https://docs.gitlab.com/api/license/)
- 메인터넌스: GitLab Premium/Ultimate Self-Managed의 `GET/PUT /api/v4/application/settings`를 사용합니다. 쓰기 토큰은 읽기 토큰과 다른 서버 변수로 보관하세요. UI 변경 대상은 `maintenance_mode`와 `maintenance_mode_message` 두 필드뿐입니다. 대부분의 쓰기를 제한하지만 실행 중 작업의 완전한 중단을 뜻하지 않습니다. [GitLab maintenance mode](https://docs.gitlab.com/administration/maintenance_mode/), [Application settings API](https://docs.gitlab.com/api/settings/)

UI는 사용자가 변경 사유와 영향을 검토한 후에만 적용합니다. 읽기 재조회나 감사 기록이 실패하면 성공으로 표시하지 않습니다. 쓰기 이후 응답 실패는 실제 적용 여부를 보장하지 못하므로 **상태 재조회**로 확인하세요. 브라우저 세션 기록은 영구 감사 로그를 대체하지 않습니다.

## 3. LGTM / Loki

Loki의 `GET /loki/api/v1/query_range`를 읽기 전용으로 호출합니다. 조회는 스트림 선택자로 시작하는 LogQL, 최대 6시간/500건, 역순 결과로 제한합니다. 검색 결과 내 서비스·심각도·텍스트 필터와 시간 분포를 제공합니다. 집계 쿼리의 메트릭 결과는 이 화면의 지원 대상이 아닙니다. [Loki HTTP API](https://grafana.com/docs/loki/latest/reference/loki-http-api/)

Loki는 자체 인증 계층을 제공하지 않으므로 보호된 게이트웨이 안에서 사용합니다. `LOKI_BEARER_TOKEN` 또는 `LOKI_USERNAME`/`LOKI_PASSWORD` 중 하나를 설정하며, 다중 테넌트 환경에서는 단일 `LOKI_TENANT_ID`를 서버에서 고정합니다. 사용자가 임의 테넌트를 요청할 수 없습니다. 서버는 일반적인 토큰·비밀번호 패턴을 가리지만 모든 민감 정보를 식별할 수 없으므로 수집 단계에서도 비밀값을 제거하세요. [Loki authentication](https://grafana.com/docs/loki/latest/operations/authentication/)

Grafana 주소는 설정 시 이동 링크로 사용합니다. Tempo·Mimir는 서버 연결 주소 등록 여부까지만 표시하며 이번 버전에 트레이스/메트릭 조회 API 구현은 포함되지 않습니다. ‘설정됨’ 표시는 통신 성공을 보장하지 않습니다.

## 4. 프런트엔드 연결과 검증

운영 서버가 준비되면 프런트엔드 빌드 환경의 **공개 주소만** 설정합니다.

```env
NEXT_PUBLIC_OPERATIONS_API_URL=https://operations.example.com/api/operations
```

GitHub Actions의 빌드 환경에도 같은 공개 주소를 설정하고 다시 빌드하세요. 토큰은 `NEXT_PUBLIC_*`나 Pages 아티팩트에 넣지 않습니다. 실제 API가 설정된 경우 연결 실패를 데모로 대체하지 않습니다.

1. 일반 계정의 조회 범위와 관리자 모드 진입 거부를 확인합니다.
2. 관리자 계정으로 라이선스 수량과 GitLab Admin 화면을 대조합니다.
3. Loki 읽기 쿼리로 시간대(KST), 테넌트, 필터 결과를 확인합니다.
4. 비운영 GitLab에서만 메인터넌스 켜기/끄기, CSRF 차단, revision 충돌, 감사 저장·재조회 실패 동작을 검증한 뒤 운영에 연결합니다.

로컬 자동 테스트는 upstream 요청을 스텁으로 대체하며 실제 GitLab 쓰기를 수행하지 않습니다.
