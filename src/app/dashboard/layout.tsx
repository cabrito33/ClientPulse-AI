import { getClients, getDashboardSummary, getReports } from "@/lib/api";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export const metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [summary, clients, reports] = await Promise.all([
    getDashboardSummary(),
    getClients(),
    getReports(),
  ]);

  const firstClient = clients[0] ?? null;
  const firstPortalToken = firstClient?.portalToken ?? null;
  const firstClientId = firstClient?.id ?? null;
  const firstReport =
    reports.find((r) => r.status === "draft" || r.status === "pending_approval") ??
    reports[0] ??
    null;
  const firstReportId = firstReport?.id ?? null;

  return (
    <div className="flex min-h-screen bg-paper">
      <DashboardSidebar
        pending={summary.pending}
        firstPortalToken={firstPortalToken}
        firstClientId={firstClientId}
        firstReportId={firstReportId}
      />
      <div className="min-w-0 flex-1">
        <DashboardTopbar
          pending={summary.pending}
          firstPortalToken={firstPortalToken}
          firstClientId={firstClientId}
          firstReportId={firstReportId}
        />
        {children}
      </div>
    </div>
  );
}
