"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { navGroups, normalizePath, type NavItem } from "@/lib/nav";
import { useOperations } from "@/components/admin/operations-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
function NavigationItem({ item, close }: { item: NavItem; close: () => void }) {
  const path = normalizePath(usePathname());
  const active =
    item.children?.some((child) => child.url === path) ?? item.url === path;
  const [expanded, setExpanded] = React.useState<{
    path: string;
    open: boolean;
  } | null>(null);
  const open = expanded?.path === path ? expanded.open : active;
  return (
    <div className="nav-family" data-top-level-menu>
      <div className="nav-parent">
        <Link
          href={item.url}
          onClick={close}
          className="nav-link"
          aria-current={path === item.url ? "page" : undefined}
          data-active={active}
        >
          <item.icon size={20} strokeWidth={1.7} />
          <span>{item.title}</span>
        </Link>
        {item.children && (
          <button
            className="nav-disclosure"
            aria-label={item.title + " 하위 메뉴"}
            aria-expanded={open}
            aria-controls={"nav-" + item.url.slice(1)}
            onClick={() => setExpanded({ path, open: !open })}
          >
            <ChevronDown size={16} className={open ? "is-open" : ""} />
          </button>
        )}
      </div>
      {item.children && open && (
        <div id={"nav-" + item.url.slice(1)} className="nav-children">
          {item.children.map((child) => (
            <Link
              key={child.url}
              href={child.url}
              onClick={close}
              aria-current={path === child.url ? "page" : undefined}
            >
              {child.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile } = useSidebar();
  const { configured, session, adminMode } = useOperations();
  const close = () => setOpenMobile(false);
  return (
    <Sidebar collapsible="offcanvas" className="app-sidebar" {...props}>
      <SidebarHeader className="brand-header">
        <Link
          href="/"
          onClick={close}
          className="brand-link"
          aria-label="InfraDash 홈"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="16"
              width="7"
              height="14"
              rx="3.5"
              fill="currentColor"
            />
            <rect
              x="12"
              y="2"
              width="7"
              height="28"
              rx="3.5"
              fill="currentColor"
            />
            <rect
              x="22"
              y="9"
              width="7"
              height="21"
              rx="3.5"
              fill="currentColor"
            />
          </svg>
          <span>
            infradash<span className="brand-period">.</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="nav-content">
        <div className="workspace-label">
          <span className="workspace-symbol">M</span>
          <div>
            <strong>Majitap</strong>
            <span>GitLab 워크스페이스</span>
          </div>
        </div>
        <nav aria-label="주 메뉴" className="nav-sections">
          {navGroups.map((group) => (
            <div className="nav-section" key={group.label}>
              <p className="nav-label">{group.label}</p>
              <div className="nav-items">
                {group.items.map((item) => (
                  <NavigationItem key={item.url} item={item} close={close} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="nav-footer">
        <div className="sidebar-person">
          <span className="person-avatar">M</span>
          <div>
            <strong>{session?.actor.name ?? "Majitap"}</strong>
            <span>
              {adminMode
                ? configured
                  ? "관리자 모드"
                  : "데모 관리자 모드"
                : configured
                  ? "운영 워크스페이스"
                  : "데모 워크스페이스"}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
