import type { Node, NodeRegion } from "./types.ts";
import type { LatencyProgress, LatencySessionReport, NodeLatency } from "./latencySession.ts";

export type LatencyPhase = "idle" | "preparing" | "measuring" | "stopping" | "completed" | "cancelled" | "failed";
export type ProbePhase = "queued" | "running" | "ok" | "error" | "cancelled" | "unfinished";
export interface LatencyState {
  phase: LatencyPhase;
  probes: Record<string, ProbePhase>;
  results: Record<string, NodeLatency>;
  errors: string[];
  completedAt?: number;
}

export function emptyLatencyState(): LatencyState {
  return { phase: "idle", probes: {}, results: {}, errors: [] };
}

/** Priority changes probe order only, never selection or routing. */
export function orderLatencyTags(
  nodes: readonly Node[], current: string, defaultNode: string, regions: readonly NodeRegion[],
): string[] {
  const tags = [...new Set(nodes.map(node => node.tag))];
  const valid = new Set(tags);
  const anchor = [current, defaultNode].find(tag => valid.has(tag));
  const regionByTag = new Map(regions
    .filter(region => region.key && region.key !== "unknown" && region.label !== "未识别")
    .map(region => [region.tag, region.key]));
  const anchorRegion = anchor ? regionByTag.get(anchor) : undefined;
  const first = anchor ? [anchor] : [];
  const buckets = new Map<string, string[]>();
  for (const tag of tags) {
    if (tag === anchor) continue;
    const region = regionByTag.get(tag);
    if (anchorRegion !== undefined && region === anchorRegion) first.push(tag);
    else {
      // Unknown nodes share an ordinary remaining bucket, not the anchor's region.
      const key = region ?? "\0unknown";
      const bucket = buckets.get(key) ?? [];
      bucket.push(tag);
      buckets.set(key, bucket);
    }
  }
  const remaining = [...buckets.values()];
  for (let index = 0; remaining.some(bucket => index < bucket.length); index++) {
    for (const bucket of remaining) if (index < bucket.length) first.push(bucket[index]);
  }
  return first;
}

export function beginLatencyRound(state: LatencyState, tags: string[]): LatencyState {
  return { phase: "preparing", results: state.results,
    probes: Object.fromEntries(tags.map(tag => [tag, "queued"])), errors: [] };
}

export function latencyBusy(state: LatencyState): boolean {
  return state.phase === "preparing" || state.phase === "measuring" || state.phase === "stopping";
}

export function latencyCounts(state: LatencyState) {
  const probes = Object.values(state.probes);
  return {
    total: probes.length,
    completed: probes.filter(status => status === "ok" || status === "error").length,
    failed: probes.filter(status => status === "error").length,
    running: probes.filter(status => status === "running").length,
    queued: probes.filter(status => status === "queued").length,
  };
}

/** A retained value is current only after this round has produced its own result. */
export function nodeLatencyState(state: LatencyState, tag: string) {
  const status = Object.prototype.hasOwnProperty.call(state.probes, tag) ? state.probes[tag] : undefined;
  const result = Object.prototype.hasOwnProperty.call(state.results, tag) ? state.results[tag] : undefined;
  return { status, result, historical: !!result && status !== "ok" && status !== "error" };
}

export function mergeLatencyProgress(state: LatencyState, event: LatencyProgress): LatencyState {
  if (!latencyBusy(state) || state.phase === "stopping") return state;
  if (event.type === "running") {
    if (state.probes[event.tag] !== "queued") return state;
    return { ...state, phase: "measuring", probes: { ...state.probes, [event.tag]: "running" } };
  }
  if (event.type === "result") {
    const { result } = event;
    if (!Object.prototype.hasOwnProperty.call(state.probes, result.tag)) return state;
    return { ...state, probes: { ...state.probes, [result.tag]: result.status },
      results: { ...state.results, [result.tag]: result } };
  }
  return state;
}

export function finishLatencyRound(state: LatencyState, report: LatencySessionReport): LatencyState {
  const probes = { ...state.probes };
  const results = { ...state.results };
  for (const result of report.results) {
    if (!Object.prototype.hasOwnProperty.call(probes, result.tag)) continue;
    if (result.status === "ok" || result.status === "error") {
      probes[result.tag] = result.status;
      results[result.tag] = result;
    }
  }
  for (const [tag, status] of Object.entries(probes)) {
    if (status === "queued" || status === "running") {
      probes[tag] = report.status === "cancelled" ? "cancelled" : "unfinished";
    }
  }
  const errors = report.errors.map(error => error.message);
  if (report.status === "completed" && Object.values(probes).includes("unfinished")) errors.push("测速结束但仍有节点未完成");
  const phase = errors.length ? "failed" : report.status;
  return { phase, probes, results, errors,
    ...(phase === "completed" ? { completedAt: Date.now() } : {}) };
}

export function failLatencyRound(state: LatencyState, message: string): LatencyState {
  return finishLatencyRound(state, {
    session_id: "", status: "failed", results: [], errors: [{ code: "session_failed", message }],
  });
}
