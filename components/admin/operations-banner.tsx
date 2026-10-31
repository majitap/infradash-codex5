"use client";
import Link from "next/link";
import { useOperations } from "./operations-provider";
export function OperationsBanner() {
  const { maintenance, adminMode, configured, exitAdmin } = useOperations();
  if (!adminMode && !maintenance?.enabled) return null;
  return (
    <div className="ops-banner" role="status">
      <div>
        <strong>
          {maintenance?.enabled
            ? maintenance.source === "demo"
              ? "메인터넌스 미리보기"
              : "GitLab 메인터넌스 중"
            : configured
              ? "관리자 모드"
              : "데모 관리자 모드"}
        </strong>
        <span>
          {maintenance?.enabled
            ? maintenance.message
            : configured
              ? "설정 변경은 관리자 권한으로 확인 후 적용됩니다."
              : "이 브라우저에서만 체험하며 실제 GitLab은 변경하지 않습니다."}
        </span>
      </div>
      <div className="ops-inline">
        <Link href="/admin">설정 보기</Link>
        {adminMode && <button onClick={exitAdmin}>모드 종료</button>}
      </div>
    </div>
  );
}
