import type { Assessment, Finding, Trace } from "./types";

function apiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is required");
  return apiUrl;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers }, cache: "no-store" });
  } catch {
    throw new Error("MergeProof API is unavailable. Check that the API is running.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const createReview = (input: { organizationId: string; repository: string; pullRequestNumber: number }) => request<{ id: string; analysisRunId: string }>("/reviews", { method: "POST", body: JSON.stringify(input) });
export const getFindings = (id: string) => request<Finding[]>(`/analysis-runs/${id}/findings`);
export const getAssessment = (id: string) => request<Assessment>(`/analysis-runs/${id}/assessment`);
export const getTrace = (id: string) => request<Trace>(`/analysis-runs/${id}/trace`);
export function subscribeToAnalysis(
  id: string,
  onSnapshot: (snapshot: import("./types").LiveSnapshot) => void,
  onConnectionChange: (connected: boolean) => void,
) {
  const stream = new EventSource(`${apiBaseUrl()}/analysis-runs/${id}/events`);
  stream.onopen = () => onConnectionChange(true);
  stream.onerror = () => onConnectionChange(false);
  stream.addEventListener("snapshot", (event) => {
    try {
      const snapshot = JSON.parse((event as MessageEvent<string>).data) as import("./types").LiveSnapshot;
      onSnapshot(snapshot);
      if (["completed", "failed", "needs_review"].includes(snapshot.analysisRun.status)) {
        stream.close();
      }
    } catch {
      // Ignore malformed events; a reconnect delivers a fresh persisted snapshot.
    }
  });
  return () => stream.close();
}
export const reviewFinding = (id: string, body: unknown) => request(`/findings/${id}/review`, { method: "PATCH", body: JSON.stringify(body) });
export const resetFindingReview = (id: string) => request<void>(`/findings/${id}/review`, { method: "DELETE" });
