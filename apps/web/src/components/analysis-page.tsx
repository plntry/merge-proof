"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getAssessment, getFindings, getTrace, resetFindingReview, reviewFinding, subscribeToAnalysis } from "@/lib/api/client";
import type { AgentType, Assessment, Finding, LiveSnapshot, Severity, Trace } from "@/lib/api/types";

const AGENTS: Array<{ type: AgentType; label: string; glyph: string }> = [
  { type: "requirements", label: "Requirements", glyph: "◈" },
  { type: "security", label: "Security", glyph: "⌘" },
  { type: "architecture", label: "Architecture", glyph: "⬡" },
  { type: "tests", label: "Tests", glyph: "✓" },
];

export default function AnalysisPage({ analysisRunId }: { analysisRunId: string }) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [connection, setConnection] = useState(false);
  const [pageError, setPageError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const lastSnapshotAt = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextFindings, nextAssessment, nextTrace] = await Promise.all([
        getFindings(analysisRunId),
        getAssessment(analysisRunId).catch(() => null),
        getTrace(analysisRunId).catch(() => null),
      ]);
      setFindings(nextFindings); setAssessment(nextAssessment); setTrace(nextTrace); setPageError("");
    } catch (cause) { setPageError(cause instanceof Error ? cause.message : "Could not load this analysis."); }
  }, [analysisRunId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh, refreshKey]);
  useEffect(() => subscribeToAnalysis(analysisRunId, (next) => {
    setSnapshot(next);
    if (lastSnapshotAt.current !== next.updatedAt) {
      lastSnapshotAt.current = next.updatedAt;
      setRefreshKey((value) => value + 1);
    }
  }, setConnection), [analysisRunId]);

  const grouped = useMemo(() => Object.fromEntries(AGENTS.map(({ type }) => [type, findings.filter((finding) => finding.agentType === type)])) as Record<AgentType, Finding[]>, [findings]);
  const reviewAction = async (findingId: string, body: unknown) => {
    try { await reviewFinding(findingId, body); await refresh(); }
    catch (cause) { setPageError(cause instanceof Error ? cause.message : "Review update failed."); }
  };
  const resetReview = async (findingId: string) => {
    try { await resetFindingReview(findingId); await refresh(); }
    catch (cause) { setPageError(cause instanceof Error ? cause.message : "Review reset failed."); }
  };

  return <main className="shell analysis-shell">
    <header className="topbar"><Link className="brand" href="/">MergeProof <span>PR REVIEW</span></Link><Link className="back-link" href="/">← New analysis</Link></header>
    {pageError && <div className="page-alert" role="alert">{pageError}<button onClick={() => void refresh()}>Retry</button></div>}
    <div className="analysis-heading"><div><p className="eyebrow">ANALYSIS / {analysisRunId.slice(0, 8)}</p><h1>Pull request review</h1><p className="muted">Live progress from persisted analysis state</p></div><div className={`connection ${connection ? "connected" : "disconnected"}`}><i />{connection ? "Live updates connected" : "Reconnecting to live updates"}</div></div>
    {snapshot ? <div className="context-line"><span>Analysis status</span><StatusBadge status={snapshot.analysisRun.status} /><span className="context-divider" /><span>Attempt {snapshot.analysisRun.attemptCount}</span></div> : <div className="loading-line">Loading analysis status…</div>}

    <section className="panel agent-panel"><div className="panel-heading"><div><p className="eyebrow">EXECUTION</p><h2>Agent progress</h2></div><span className="subtle">Four specialist reviews</span></div><div className="agent-grid">{AGENTS.map((agent) => {
      const status = snapshot?.agents.find((item) => item.type === agent.type)?.status ?? "waiting";
      return <div className="agent-item" key={agent.type}><span className="agent-glyph">{agent.glyph}</span><span className="agent-name">{agent.label}</span><StatusBadge status={status} /></div>;
    })}</div></section>

    <section className="assessment-card"><div className="assessment-main"><p className="eyebrow">MERGE ASSESSMENT</p><div className="decision-line"><DecisionBadge decision={assessment?.decision ?? snapshot?.assessment?.decision ?? null} /><p className="risk-score"><strong>{assessment?.riskScore ?? snapshot?.assessment?.riskScore ?? "—"}</strong><span>/ 100 <small>risk score</small></span></p></div><p className="assessment-caption">Deterministic policy result · analysis status is shown separately above</p></div><div className="assessment-reasons"><p className="eyebrow">REASONS</p>{assessment?.reasons.length ? <ul>{assessment.reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.message}</li>)}</ul> : <p className="muted">{assessment ? "No blocking or review reasons." : "Assessment will appear when analysis has enough persisted results."}</p>}</div></section>

    <section className="findings-section"><div className="panel-heading"><div><p className="eyebrow">EVIDENCE</p><h2>Findings <span className="count-pill">{findings.length}</span></h2></div><span className="subtle">Original AI evidence stays available after review</span></div>
      {AGENTS.map((agent) => <section className="finding-group" key={agent.type}><h3><span>{agent.glyph}</span>{agent.label}<small>{grouped[agent.type].length}</small></h3>{grouped[agent.type].length ? grouped[agent.type].map((finding) => <FindingCard key={`${finding.id}:${finding.review?.status ?? "original"}:${finding.effective.title}:${finding.effective.description}`} finding={finding} onReview={reviewAction} onReset={resetReview} />) : <p className="empty-findings">{snapshot?.agents.find((item) => item.type === agent.type)?.status === "completed" ? "No findings reported." : "Findings will appear after this agent completes."}</p>}</section>)}
    </section>

    <details className="panel trace-panel"><summary><div><p className="eyebrow">DEBUG DETAILS</p><h2>Execution trace</h2></div><span className="subtle">Diagnostics for this analysis</span></summary>{trace ? <><div className="trace-stats"><Metric label="Duration" value={trace.summary.totalDurationMs == null ? "—" : `${trace.summary.totalDurationMs} ms`} /><Metric label="Attempts / retries" value={`${trace.summary.attempts} / ${trace.summary.retries}`} /><Metric label="Agents run / reused" value={`${trace.summary.totals.executedAgents} / ${trace.summary.totals.reusedAgents}`} /><Metric label="Model calls" value={String(trace.summary.totals.modelCalls)} /><Metric label="Tool calls" value={String(trace.summary.totals.toolCalls)} /><Metric label="Findings" value={String(trace.summary.totals.findings)} /></div><p className="token-note">{trace.summary.totals.usageComplete ? `Token usage: ${trace.summary.totals.inputTokens} input · ${trace.summary.totals.outputTokens} output · ${trace.summary.totals.totalTokens} total` : "Token usage unavailable or incomplete."}</p><div className="prompt-list">{trace.summary.agents.map((agent) => <span key={agent.agentType}>{agent.agentType}: {agent.promptVersion ?? "prompt version unavailable"}{agent.reused ? " · reused" : ""}</span>)}</div><ol className="trace-events">{trace.events.map((event) => <li key={`${event.eventType}-${event.createdAt}`}><time>{new Date(event.createdAt).toLocaleTimeString()}</time><code>{event.eventType}</code></li>)}</ol></> : <p className="muted">Trace is not available yet.</p>}</details>
    <footer className="page-footer"><span>Review state is persisted; refreshing always reloads authoritative data.</span><Link href="/">← Start another analysis</Link></footer>
  </main>;
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "waiting" ? "Waiting" : status === "pending" ? "Pending" : status.replaceAll("_", " ");
  return <span className={`status-badge status-${status}`}>{status === "completed" ? "✓" : status === "running" ? "●" : status === "failed" ? "!" : "○"} {label}</span>;
}
function DecisionBadge({ decision }: { decision: string | null }) {
  return <span className={`decision-badge decision-${decision ?? "pending"}`}>{decision?.replaceAll("_", " ") ?? "Pending"}</span>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function FindingCard({ finding, onReview, onReset }: { finding: Finding; onReview: (id: string, body: unknown) => Promise<void>; onReset: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(finding.effective.title);
  const [description, setDescription] = useState(finding.effective.description);
  const [severity, setSeverity] = useState<Severity>(finding.effective.severity);
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Review update failed."); } finally { setBusy(false); } }
  async function saveEdit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!title.trim() || !description.trim()) { setError("Title and description cannot be empty."); return; } await run(() => onReview(finding.id, { status: "edited", editedFinding: { title, description, severity }, note })); }

  return <article className={`finding-card ${finding.effective.excluded ? "finding-excluded" : ""}`}><div className="finding-top"><div><SeverityBadge severity={finding.original.severity} /><span className="confidence">Original confidence {(finding.original.confidence * 100).toFixed(0)}%</span></div>{finding.review && <span className={`review-badge review-${finding.review.status}`}>{finding.review.status}</span>}</div>
    {editing ? <form className="edit-finding" onSubmit={saveEdit}><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={3} required /></label><label>Effective severity<select value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}>{["low", "medium", "high", "critical"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Review note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} /></label><div className="button-row"><button className="small-button" disabled={busy}>Save edit</button><button className="text-button" type="button" onClick={() => setEditing(false)}>Cancel</button></div></form> : <><h4>{finding.original.title}</h4><p className="finding-description">{finding.original.description}</p>{finding.review?.status === "edited" && <div className="effective-content"><span>HUMAN-REVIEWED VERSION</span><strong>{finding.effective.title}</strong><p>{finding.effective.description}</p><div><span>Effective severity</span><SeverityBadge severity={finding.effective.severity} /></div></div>}{finding.review?.note && <p className="review-note">Reviewer note: {finding.review.note}</p>}{finding.review?.status === "rejected" && <p className="review-note">This finding remains visible and is excluded from the risk assessment.</p>}{finding.review ? <p className="reviewed-summary">Original AI severity: {finding.original.severity.toUpperCase()} · Effective: {finding.effective.excluded ? "excluded" : finding.effective.severity.toUpperCase()}</p> : <label className="note-input">Review note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} /></label>}</>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!editing && <div className="button-row review-controls">{!finding.review ? <><button className="small-button" disabled={busy} onClick={() => void run(() => onReview(finding.id, { status: "accepted", note }))}>Accept</button><button className="small-button secondary" disabled={busy} onClick={() => void run(() => onReview(finding.id, { status: "rejected", note }))}>Reject</button><button className="text-button" disabled={busy} onClick={() => { setTitle(finding.original.title); setDescription(finding.original.description); setSeverity(finding.original.severity); setEditing(true); }}>Edit</button></> : <button className="text-button" disabled={busy} onClick={() => void run(() => onReset(finding.id))}>Reset review</button>}{busy && <span className="subtle">Saving…</span>}</div>}
  </article>;
}
function SeverityBadge({ severity }: { severity: Severity }) { return <span className={`severity severity-${severity}`}>{severity}</span>; }
