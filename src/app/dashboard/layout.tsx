import { getDashboardSummary } from "@/lib/api";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export const metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const summary = await getDashboardSummary();

  return (
    <div className="flex min-h-screen bg-paper">
      <DashboardSidebar pending={summary.pending} />
      <div className="min-w-0 flex-1">
        <DashboardTopbar pending={summary.pending} />
        {children}
      </div>
    </div>
  );
}
