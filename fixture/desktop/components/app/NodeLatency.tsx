import { useState } from "react";
import { delayColor, fmtDelay } from "@/app/helpers";
import { latencyCounts, nodeLatencyState } from "@/latencyState";
import type { LatencyState } from "@/latencyState";
import { Button } from "@/components/ui/button";

/** Shared presentation for the overview, list and card. Historical values never impersonate a new result. */
export function latencyPresentation(state: LatencyState, tag: string) {
  const { status, result, historical } = nodeLatencyState(state, tag);
  const value = result?.status === "error" ? "失败" : fmtDelay(result?.delay);
  const pending = status === "queued" || status === "running";
  const label = pending
    ? state.phase === "preparing" ? "准备中…"
      : state.phase === "stopping" ? "停止中…"
        : status === "queued" ? "排队中" : "测速中…"
    : status === "cancelled" ? "已停止"
      : status === "unfinished" ? "未完成" : value;
  const detail = historical ? `上次 ${value}` : result ? "本轮结果" : "尚无结果";
  const error = result?.status === "error" ? result.error.message : undefined;
  return {
    label, detail,
    title: `${label}；${detail}${error ? `：${error}` : ""}`,
    color: !pending && !historical && error ? "text-destructive"
      : pending || historical || !result ? "text-muted-foreground"
        : delayColor(result.status === "ok" ? result.delay : undefined),
  };
}

export function NodeLatencyValue({ state, tag, strong = false }: {
  state: LatencyState;
  tag: string;
  strong?: boolean;
}) {
  const display = latencyPresentation(state, tag);
  return (
    <span
      className={"node-latency-value inline-flex h-9 w-20 shrink-0 flex-col justify-center text-right font-mono text-xs tabular-nums " + display.color}
      title={display.title}
      aria-label={display.title}
    >
      <span className={strong ? "font-semibold" : undefined}>{display.label}</span>
      <span className="text-[10px] leading-3 text-muted-foreground">{display.detail}</span>
    </span>
  );
}

const PROGRESS_LINGER_MS = 2000;

const PHASE_LABEL: Record<LatencyState["phase"], string> = {
  idle: "尚未测速", preparing: "准备测速", measuring: "正在测速", stopping: "正在停止",
  completed: "测速完成", cancelled: "测速已停止", failed: "测速未完成",
};

export function LatencySessionControls({ state, onStop }: {
  state: LatencyState;
  onStop: () => void;
}) {
  const [mountedAt] = useState(Date.now);
  const counts = latencyCounts(state);
  const percent = counts.total > 0 ? Math.round(counts.completed / counts.total * 100) : 0;
  const active = state.phase === "preparing" || state.phase === "measuring" || state.phase === "stopping";
  return (
    <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 text-xs">
      <div role="status" aria-live="polite" className="min-w-0 text-muted-foreground" title={state.errors.join("；") || undefined}>
        {PHASE_LABEL[state.phase]}
        {counts.total > 0 && (
          <span className="ml-2 font-mono tabular-nums">已完成 {counts.completed}/{counts.total}</span>
        )}
        {active && (
          <span className="ml-2">进行中 {counts.running} · 排队 {counts.queued}</span>
        )}
        {!active && counts.total > 0 && (
          <span className={"ml-2 font-mono tabular-nums" + (counts.failed > 0 ? " text-destructive" : "")}>失败 {counts.failed} 个节点</span>
        )}
      </div>
      {active && (
        <Button size="sm" variant="outline" onClick={onStop} disabled={state.phase === "stopping"}>
          {state.phase === "stopping" ? "正在停止…" : "停止本轮"}
        </Button>
      )}
      {counts.total > 0 && (
        <div
          aria-hidden="true"
          className={"relative h-6 w-full overflow-hidden rounded-full bg-primary/10" + (state.phase === "completed" ? " latency-progress-completed" : "")}
          // Keep this delay stable during live updates; a remount resumes the original timeline.
          style={state.completedAt === undefined ? undefined : {
            animationDelay: `${Math.min(PROGRESS_LINGER_MS, state.completedAt + PROGRESS_LINGER_MS - mountedAt)}ms`,
          }}
        >
          <div className="h-full rounded-full bg-primary/40 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold tabular-nums text-foreground">{counts.completed}/{counts.total}</span>
        </div>
      )}
    </div>
  );
}
