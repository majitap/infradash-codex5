import type { Metadata } from "next";
import Link from "next/link";
import { LicenseStrip } from "@/components/admin/license-strip";
export const metadata: Metadata = { title: "라이선스" };
export default function Page() {
  return (
    <div className="ops-stack">
      <LicenseStrip detail />
      <section className="ops-panel">
        <h2>좌석 현황을 정확하게</h2>
        <p className="ops-description">
          보유 라이선스는 GitLab 라이선스의 사용자 한도, 사용 중 수량은 현재
          활성 사용자 수를 기준으로 표시합니다. 조회할 수 없는 값은 대시로
          표시합니다.
        </p>
        <p className="ops-description">
          GitLab Self-Managed 관리자 권한의 라이선스 조회 API가 필요합니다.
          토큰과 라이선스 원문은 브라우저에 저장하지 않습니다.
        </p>
        <Link className="ops-button" href="/admin/integrations">
          연동 설정 보기
        </Link>
      </section>
    </div>
  );
}
