export interface LatencyError {
  code: string;
  message: string;
}

export type NodeLatency =
  | { tag: string; status: "ok"; delay: number }
  | { tag: string; status: "error"; error: LatencyError };

export type NodeProbeState = NodeLatency | { tag: string; status: "queued" | "running" | "cancelled" };

export interface LatencySessionReport {
  session_id: string;
  status: "completed" | "cancelled" | "failed";
  results: NodeProbeState[];
  errors: LatencyError[];
}

export type LatencyProgress = { session_id: string } & (
  | { type: "preparing"; tags: string[] }
  | { type: "running"; tag: string }
  | { type: "result"; result: NodeLatency }
  | { type: "finished"; report: LatencySessionReport }
);

export interface LatencyRequest {
  profileId: string;
  tags: string[];
  livePort?: number;
}

export interface LatencyTransport {
  run(id: string, request: LatencyRequest, receive: (event: LatencyProgress) => void): Promise<LatencySessionReport>;
  cancel(id: string): Promise<void>;
  keepAlive(id: string): Promise<void>;
}

export interface NodeLatencySession {
  id: string;
  done: Promise<LatencySessionReport>;
  cancel(): Promise<void>;
}

function controlError(error: unknown): LatencyError {
  if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
    return { code: String(error.code), message: String(error.message) };
  }
  return { code: "session_control_failed", message: error instanceof Error ? error.message : String(error) };
}

/** Incremental IPC adapter. It never changes the selected node or proxy state. */
export function beginNodeLatencySession(
  request: LatencyRequest,
  transport: LatencyTransport,
  onProgress: (event: LatencyProgress) => void = () => {},
): NodeLatencySession {
  const id = crypto.randomUUID();
  const input = { ...request, tags: [...request.tags] };
  const confirmed = new Map<string, NodeProbeState>(input.tags.map(tag => [tag, { tag, status: "queued" }]));
  let stopped = false;
  let finished = false;
  let registered = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let renewal: Promise<void> | undefined;
  let cancellation: Promise<void> | undefined;
  const errors: LatencyError[] = [];
  let resolvePreparation!: (registered: boolean) => void;
  const preparation = new Promise<boolean>(resolve => { resolvePreparation = resolve; });

  const cancel = (): Promise<void> => {
    stopped = true;
    if (timer !== undefined) clearInterval(timer);
    cancellation ??= preparation.then(async active => {
      if (!active || finished) return;
      try {
        await transport.cancel(id);
      } catch (error) {
        // A terminal response may race with a user's stop click.
        const failure = controlError(error);
        if (failure.code !== "session_not_active") {
          errors.push(failure);
          throw error;
        }
      }
    });
    return cancellation;
  };

  const failControl = (error: unknown) => {
    if (finished) return;
    errors.push(controlError(error));
    // cancel records its own transport error; avoid an unhandled rejection here.
    void cancel().catch(() => {});
  };

  const emit = (event: LatencyProgress) => {
    try { onProgress(event); }
    catch (error) { failControl(error); }
  };

  const renew = () => {
    if (stopped || finished || renewal) return;
    renewal = Promise.resolve().then(() => transport.keepAlive(id)).catch(error => {
      if (controlError(error).code !== "session_not_active") failControl(error);
    }).finally(() => { renewal = undefined; });
  };

  const receive = (event: LatencyProgress) => {
    if (finished || event.session_id !== id || event.type === "finished") return;
    if (event.type === "preparing") {
      if (registered) return;
      registered = true;
      resolvePreparation(true);
      emit(event);
      if (!stopped) {
        renew();
        timer = setInterval(renew, 2000);
      }
      return;
    }
    // Stop suppresses late successes and errors; it is not a node failure.
    if (stopped) return;
    if (event.type === "running") confirmed.set(event.tag, { tag: event.tag, status: "running" });
    if (event.type === "result") confirmed.set(event.result.tag, event.result);
    emit(event);
  };

  const done = Promise.resolve().then(() => transport.run(id, input, receive)).then(report => {
    if (report.session_id !== id) throw { code: "session_mismatch", message: "测速返回了其他会话的结果" };
    finished = true;
    const result: LatencySessionReport = {
      ...report,
      status: errors.length ? "failed" : stopped && report.status === "completed" ? "cancelled" : report.status,
      errors: [...report.errors, ...errors],
      results: stopped ? input.tags.map(tag => {
        const node = confirmed.get(tag)!;
        return node.status === "ok" || node.status === "error" ? node : { tag, status: "cancelled" };
      }) : report.results,
    };
    onProgress({ session_id: id, type: "finished", report: result });
    return result;
  }).finally(() => {
    finished = true;
    resolvePreparation(false);
    if (timer !== undefined) clearInterval(timer);
  });

  return { id, done, cancel };
}
