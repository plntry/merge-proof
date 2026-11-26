import AnalysisPage from "@/components/analysis-page";

export const instant = false;

export default async function Page({ params }: PageProps<"/analyses/[analysisRunId]">) {
  const { analysisRunId } = await params;
  return <AnalysisPage analysisRunId={analysisRunId} />;
}
