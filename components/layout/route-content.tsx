"use client";

import { OperationsBanner } from "@/components/admin/operations-banner";
import { usePathname } from "next/navigation";
import { findNavItem, normalizePath } from "@/lib/nav";

const ownHeadings = ["/", "/ai-ops", "/topology", "/dora", "/finops"];
export function RouteContent({ children }: { children: React.ReactNode }) {
  const path = normalizePath(usePathname());
  const page = findNavItem(path);
  return (
    <div className="route-content @container/main">
      <OperationsBanner />
      {!ownHeadings.includes(path) && (
        <div className="route-heading">
          <p className="eyebrow">GITLAB / MAJITAP</p>
          <h1>{page?.title}</h1>
          <p>{page?.description}</p>
        </div>
      )}
      {children}
      <footer className="site-footer">
        <span>
          <span className="footer-dot" /> 데모 워크스페이스
        </span>
        <span>
          예시 데이터가 포함된 대시보드 · 운영 정보는 연결 상태를 확인하세요.
        </span>
      </footer>
    </div>
  );
}
