"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useCommandMenu } from "@/components/layout/command-menu";
import { useOperations } from "@/components/admin/operations-provider";
import { findNavItem } from "@/lib/nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { setOpen } = useCommandMenu();
  const { adminMode, configured } = useOperations();
  const title = findNavItem(usePathname())?.title ?? "개요";
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    if (navigator.platform.toUpperCase().includes("MAC"))
      requestAnimationFrame(() => setShortcut("⌘ K"));
  }, []);
  return (
    <header className="site-header">
      <div className="header-location">
        <SidebarTrigger className="md:hidden size-10" />
        <span className="hidden lg:inline">워크스페이스</span>
        <ChevronRight className="hidden lg:block" size={16} />
        <span>{title}</span>
      </div>
      <div className="header-actions">
        <button
          className="header-search"
          onClick={() => setOpen(true)}
          aria-label="페이지와 프로젝트 검색"
        >
          <Search size={18} />
          <span>무엇을 찾으세요?</span>
          <kbd>{shortcut}</kbd>
        </button>
        <div className="header-separator" />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="header-icon notification-trigger"
            aria-label="운영 알림 2건"
          >
            <Bell size={20} />
            <span />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="notification-menu">
            <DropdownMenuGroup>
              <DropdownMenuLabel>확인이 필요한 알림 · 2건</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/incidents" />}>
                <span className="notification-item">
                  <strong>결제 API 장애 대응 중</strong>
                  <span>payment-service · 인시던트 보기</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/storage" />}>
                <span className="notification-item">
                  <strong>Gitaly 볼륨 사용률 91%</strong>
                  <span>스토리지 용량을 확인하세요</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Link
          className={adminMode ? "ops-admin-link active" : "ops-admin-link"}
          href="/admin"
        >
          {adminMode ? (configured ? "관리자 모드" : "데모 관리자") : "관리자"}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
