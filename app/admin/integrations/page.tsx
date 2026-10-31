import type { Metadata } from "next";
import { IntegrationsView } from "@/components/admin/integrations-view";
export const metadata: Metadata = { title: "연동 설정" };
export default function Page() {
  return <IntegrationsView />;
}
