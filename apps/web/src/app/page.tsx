"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReview } from "@/lib/api/client";

export default function Home() {
  const router = useRouter();
  const [repository, setRepository] = useState("merge-proof");
  const [pullRequestNumber, setPullRequestNumber] = useState("42");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const organizationId = process.env.NEXT_PUBLIC_DEMO_ORGANIZATION_ID;
    if (!organizationId) { setError("Set NEXT_PUBLIC_DEMO_ORGANIZATION_ID in apps/web/.env.local."); return; }
    const number = Number(pullRequestNumber);
    if (!repository.trim()) { setError("Enter a repository name."); return; }
    if (!Number.isInteger(number) || number <= 0) { setError("Pull request number must be a positive integer."); return; }
    setSubmitting(true);
    try {
      const created = await createReview({ organizationId, repository: repository.trim(), pullRequestNumber: number });
      router.push(`/analyses/${created.analysisRunId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the analysis.");
      setSubmitting(false);
    }
  }

  return <main className="shell">
    <header className="topbar"><Link className="brand" href="/">MergeProof <span>PR REVIEW</span></Link><div className="api-indicator"><i /> deterministic decision engine</div></header>
    <section className="hero"><p className="eyebrow">HUMAN-REVIEWED · EVIDENCE-BASED</p><h1>Know what stands<br />between a PR and <em>merge.</em></h1><p className="lede">Four focused agents inspect the change. You review the evidence. Deterministic rules explain the final decision.</p></section>
    <form className="new-analysis" onSubmit={submit}>
      <div className="section-label"><span>01</span><div><strong>Start an analysis</strong><small>Review a pull request</small></div></div>
      <label>Repository<input value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" autoComplete="off" /></label>
      <label>Pull request<input type="number" min="1" step="1" value={pullRequestNumber} onChange={(event) => setPullRequestNumber(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={submitting}>{submitting ? "Starting analysis…" : "Analyze pull request →"}</button>
      <p className="form-footnote">Your repository is accessed through scoped, audited tools.</p>
    </form>
    <section className="agent-strip" aria-label="Analysis agents"><p>FOUR INDEPENDENT REVIEWS</p><div><span>◈ Requirements</span><span>⌘ Security</span><span>⬡ Architecture</span><span>✓ Tests</span></div></section>
    <footer className="page-footer"><span>AI surfaces evidence. Deterministic code assesses merge readiness.</span><a href="https://github.com">Read the architecture ↗</a></footer>
  </main>;
}
