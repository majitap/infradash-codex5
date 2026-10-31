import type { Metadata } from "next";
import { LogsView } from "@/components/views/logs-view";
export const metadata: Metadata = { title: "로그 분석" };
export default function Page() {
  return <LogsView />;
}
