import type { InboundConfig, SubscriptionTraffic } from "@/types";

export function defaultTunInbound(): InboundConfig {
  return {
    tag: "tun-in",
    type: "tun",
    listen: "0.0.0.0",
    listen_port: 0,
    tun: {
      auto_route: true,
      strict_route: false,
      stack: "gvisor",
      exclude_private_route: true,
      ipv6: false,
      route_exclude_address: [],
      platform: { http_proxy: false },
    },
  };
}

export function fmtSpeed(bps: number): string {
  if (bps >= 1024 * 1024) return (bps / 1024 / 1024).toFixed(2) + " MB/s";
  if (bps >= 1024) return (bps / 1024).toFixed(1) + " KB/s";
  return Math.round(bps) + " B/s";
}

export function fmtDelay(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return `${ms} ms`;
}

export function delayColor(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "text-muted-foreground";
  if (ms <= 200) return "text-green-600 dark:text-green-400";
  if (ms <= 500) return "text-yellow-600 dark:text-yellow-400";
  return "text-orange-500 dark:text-orange-400";
}

export function fmtTime(timestamp: number): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmtBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let value = bytes;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function fmtTraffic(traffic?: SubscriptionTraffic): string | null {
  if (!traffic) return null;
  const used = (traffic.upload || 0) + (traffic.download || 0);
  const parts: string[] = [];
  if (traffic.total && traffic.total > 0) {
    const percent = used > 0 ? Math.min(100, (used / traffic.total) * 100) : 0;
    const remaining = Math.max(0, traffic.total - used);
    parts.push(`剩余 ${fmtBytes(remaining)} / 总计 ${fmtBytes(traffic.total)}`);
    parts.push(`已用 ${percent.toFixed(1)}%`);
  } else if (used > 0) {
    parts.push(`已用 ${fmtBytes(used)}`);
  }
  if (traffic.expire && traffic.expire > 0) {
    parts.push(`到期 ${fmtTime(traffic.expire).split(" ")[0]}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export interface LogRecord {
  time: string;
  host: string;
  port: string;
  via: "proxy" | "direct" | "block";
  tag: string;
}

const LOG_OUTBOUND_RE =
  /outbound\/(\w+)\[([^\]]+)\]: outbound connection to ([^:\s]+):(\d+)/;
const LOG_TIME_RE = /(\d{2}:\d{2}:\d{2})/;

export function parseLogRecords(lines: string[]): LogRecord[] {
  const records: LogRecord[] = [];
  for (const line of lines) {
    const match = LOG_OUTBOUND_RE.exec(line);
    if (!match) continue;
    const [, type, tag, host, port] = match;
    if (tag === "local" || tag === "remote" || tag === "dns") continue;
    if (host === "223.5.5.5" || host === "1.1.1.1") continue;
    const via: LogRecord["via"] =
      type === "direct" ? "direct" : type === "block" ? "block" : "proxy";
    const time = LOG_TIME_RE.exec(line);
    records.push({ time: time ? time[1] : "", host, port, via, tag });
  }
  return records.reverse();
}
