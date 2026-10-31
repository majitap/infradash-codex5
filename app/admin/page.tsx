import type { Metadata } from "next";
import { AdminView } from "@/components/admin/admin-view";
export const metadata: Metadata = { title: "운영 설정" };
export default function Page() {
  return <AdminView />;
}
