import { notFound } from "next/navigation";
import { getClient, getReport, getSprintMetrics } from "@/lib/api";
import { ReportReview } from "@/components/dashboard/report-review";

interface ReportPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ReportPageProps) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return { title: "Relatório não encontrado" };
  return {
    title: `Revisão — ${report.weekLabel}`,
  };
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const client = await getClient(report.clientId);
  if (!client) notFound();

  const sprintMetrics = await getSprintMetrics(client.id);

  return (
    <ReportReview
      report={report}
      client={client}
      sprintMetrics={sprintMetrics}
    />
  );
}
