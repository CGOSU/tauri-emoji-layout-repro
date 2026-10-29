import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildNodeDisplayGroups, currentNodeGroupKey, guardedEmojiText, nodeTitleIcons } from "@/nodeDisplay";
import type { LatencyState } from "@/latencyState";
import { nodeLatencyState } from "@/latencyState";
import { NodeLatencyValue } from "./NodeLatency";
import type { NodeGrouping } from "@/app/types";
import type { Node, NodeRegion } from "@/types";
import { Icon } from "@/components/ui/icon";
import { VirtualNodeList } from "./VirtualNodeList";

export interface NodeListViewProps {
  nodes: Node[];
  currentNode: string;
  latencyState: LatencyState;
  testing: boolean;
  view: "list" | "card";
  grouping: NodeGrouping;
  nodeRegions: NodeRegion[];
  regionsLoading?: boolean;
  regionOverrides: Record<string, string>;
  editDisabled: boolean;
  onEditRegion: (tag: string) => void;
  onSelect: (tag: string) => void;
  onTest: (tag: string) => void;
}

export function NodeListView({
  nodes,
  currentNode,
  latencyState,
  testing,
  view,
  grouping,
  nodeRegions,
  regionsLoading = false,
  regionOverrides,
  editDisabled,
  onEditRegion,
  onSelect,
  onTest,
}: NodeListViewProps) {
  const regionControls = { regionOverrides, editDisabled, onEditRegion };
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const prepareGroupScroll = useRef<((key: string) => void) | null>(null);
  const diagnostic = useRef<{
    key: string; start: number; rowsMeasured: number; frame: number;
    spans: Record<string, { ms: number; count: number }>;
  } | null>(null);
  const recordSpan = useCallback((name: string, duration: number) => {
    const sample = diagnostic.current;
    if (!sample) return;
    const span = sample.spans[name] ?? { ms: 0, count: 0 };
    span.ms += duration;
    span.count += 1;
    sample.spans[name] = span;
  }, []);
  const isDiagnosticActive = useCallback(() => diagnostic.current !== null, []);
  const onRowMeasured = useCallback(() => {
    if (diagnostic.current) diagnostic.current.rowsMeasured += 1;
  }, []);
  const regionByTag = useMemo(
    () => Object.fromEntries(nodeRegions.map((region) => [region.tag, region])),
    [nodeRegions],
  );
  const groups = useMemo(
    () => regionsLoading && grouping === "region" ? [] : buildNodeDisplayGroups(nodes, regionByTag, grouping),
    [nodes, regionByTag, grouping, regionsLoading],
  );
  const currentGroupKey = useMemo(() => currentNodeGroupKey(groups, currentNode), [groups, currentNode]);
  const group = groups.find((item) => item.key === selectedGroup) ?? groups.find((item) => item.key === currentGroupKey) ?? groups[0];
  useLayoutEffect(() => {
    const sample = diagnostic.current;
    if (!sample || sample.frame || sample.key !== group?.key) return;
    const commitMs = performance.now() - sample.start;
    sample.frame = requestAnimationFrame(() => {
      sample.frame = requestAnimationFrame(() => {
        if (diagnostic.current !== sample) return;
        console.info("[region-switch-performance]", {
          view, nodeCount: group.nodes.length, commitMs,
          twoFramesMs: performance.now() - sample.start,
          rowsMeasured: sample.rowsMeasured, spans: sample.spans,
        });
        diagnostic.current = null;
      });
    });
  }, [group, view]);
  useEffect(() => () => {
    if (diagnostic.current) cancelAnimationFrame(diagnostic.current.frame);
    diagnostic.current = null;
  }, []);
  const selectGroup = (key: string) => {
    if (diagnostic.current) cancelAnimationFrame(diagnostic.current.frame);
    diagnostic.current = null;
    try {
      if (key !== group?.key && localStorage.getItem("region-switch-performance") === "1") {
        diagnostic.current = { key, start: performance.now(), rowsMeasured: 0, frame: 0, spans: {} };
      }
    } catch {
      // Storage can be unavailable; diagnostics must never block navigation.
    }
    if (key !== group?.key) {
      prepareGroupScroll.current?.(`${grouping}:${key}`);
    }
    setSelectedGroup(key);
  };
  if (regionsLoading && grouping === "region") {
    return <div role="status" className="px-4 py-8 text-sm text-muted-foreground">正在识别节点地区…</div>;
  }
  if (!group) return null;
  return (
    <div className={"node-workspace " + (grouping === "region" ? "node-workspace-grouped" : "")}>
      {grouping === "region" && <nav className="node-group-nav" aria-label="节点分组">
        <h3 className="px-3 pb-2 text-xs font-medium text-muted-foreground">节点分组</h3>
        <div className="node-group-options">{groups.map((item) => <button type="button" key={item.key} className="node-group-option" data-active={item.key === group.key} aria-current={item.key === group.key ? "true" : undefined} aria-controls="node-group-content" onClick={() => selectGroup(item.key)}>
          <span aria-hidden="true" className="shrink-0 text-base">{guardedEmojiText(regionFlag(item.label))}</span>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.key === currentGroupKey && (
            <span role="img" aria-label="当前节点所在地区" title={`当前节点：${currentNode}`} className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          )}
          <span className="node-group-count">{item.nodes.length}</span>
        </button>)}</div>
      </nav>}
      <section id="node-group-content" className="node-group-content" aria-label={group.label}>
        <div className="mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden="true">{guardedEmojiText(grouping === "region" ? regionFlag(group.label) : "🌐")}</span>{group.label} · {group.nodes.length} 个节点</h3>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">点击节点即可切换；内核运行时实时生效（无需重启）。</p>
        </div>
        <VirtualNodeList
          key={view}
          groupKey={`${grouping}:${group.key}`}
          nodes={group.nodes}
          view={view}
          prepareGroupScroll={prepareGroupScroll}
          onRowMeasured={onRowMeasured}
          isDiagnosticActive={isDiagnosticActive}
          recordSpan={recordSpan}
          renderNode={(node) => {
            const Item = view === "card" ? NodeCard : NodeRow;
            return <Item node={node} region={regionByTag[node.tag]} regionControls={regionControls} currentNode={currentNode} latencyState={latencyState} testing={testing} onSelect={onSelect} onTest={onTest} />;
          }}
        />
      </section>
    </div>
  );
}

type RegionControls = Pick<NodeListViewProps, "regionOverrides" | "editDisabled" | "onEditRegion">;

interface NodeItemProps {
  regionControls: RegionControls;
  node: Node;
  region?: NodeRegion;
  currentNode: string;
  latencyState: LatencyState;
  testing: boolean;
  onSelect: (tag: string) => void;
  onTest: (tag: string) => void;
}

function NodeCard({
  node,
  region,
  regionControls,
  currentNode,
  latencyState,
  testing,
  onSelect,
  onTest,
}: NodeItemProps) {
  const active = node.tag === currentNode;
  const probe = nodeLatencyState(latencyState, node.tag);
  const latencyError = !probe.historical && probe.result?.status === "error" ? probe.result.error.message : undefined;
  return (
    <div
      className={
        "node-card relative flex min-w-0 flex-col justify-between gap-1 rounded-lg border bg-card p-2 transition-colors " +
        (active
          ? "border-primary"
          : "border-border hover:border-primary/40")
      }
    >
      <NodeSelectButton
        node={node}
        active={active}
        latencyError={latencyError}
        onSelect={onSelect}
      />
      <div className="pointer-events-none flex min-w-0 items-center justify-between gap-1">
        <ProtocolBadge protocol={node.settings.protocol} />
        <div className="flex shrink-0 items-center gap-1.5">
          <RegionBadge tag={node.tag} region={region} {...regionControls} />
        </div>
      </div>
      <div className="pointer-events-none flex items-center justify-between gap-1">
        <NodeLatencyValue state={latencyState} tag={node.tag} />
        <NodeTestButton node={node} testing={testing} onTest={onTest} />
      </div>
    </div>
  );
}

function NodeRow({
  node,
  region,
  regionControls,
  currentNode,
  latencyState,
  testing,
  onSelect,
  onTest,
}: NodeItemProps) {
  const active = node.tag === currentNode;
  const probe = nodeLatencyState(latencyState, node.tag);
  const latencyError = !probe.historical && probe.result?.status === "error" ? probe.result.error.message : undefined;
  return (
    <div
      className={
        "node-list-row relative flex w-full items-center justify-between rounded-md border px-3 py-2 transition hover:bg-accent " +
        (active ? "border-primary bg-accent" : "")
      }
    >
      <NodeSelectButton
        node={node}
        active={active}
        latencyError={latencyError}
        onSelect={onSelect}
      />
      <span className="pointer-events-none flex min-w-0 items-center gap-2 truncate pr-2 text-left">
        <span
          className={
            "inline-block h-2 w-2 shrink-0 rounded-full " +
            (active ? "bg-primary" : "bg-transparent")
          }
        />
        <ProtocolBadge protocol={node.settings.protocol} />
        <RegionBadge tag={node.tag} region={region} {...regionControls} />
      </span>
      <span className="pointer-events-none flex shrink-0 items-center gap-2">
        <NodeLatencyValue state={latencyState} tag={node.tag} />
        <NodeTestButton node={node} testing={testing} onTest={onTest} />
      </span>
    </div>
  );
}

function NodeSelectButton({
  node,
  active,
  latencyError,
  onSelect,
}: {
  node: Node;
  active: boolean;
  latencyError?: string;
  onSelect: (tag: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node.tag)}
      className="absolute inset-0 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      title={
        latencyError ? `测速失败：${latencyError}` : `选择节点：${node.tag}`
      }
      aria-label={
        latencyError
          ? `选择节点：${node.tag}。测速失败：${latencyError}`
          : `选择节点：${node.tag}`
      }
      aria-pressed={active}
    />
  );
}

function NodeTestButton({
  node,
  testing,
  onTest,
}: {
  node: Node;
  testing: boolean;
  onTest: (tag: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onTest(node.tag)}
      disabled={testing}
      className="node-test-button"
      title={`测速节点：${node.tag}`}
      aria-label={`测速节点：${node.tag}`}
    >
      <Icon name="gauge" className="h-3 w-3" />
      <span className="node-test-label">测速</span>
    </button>
  );
}

function RegionBadge({ tag, region, regionOverrides, editDisabled, onEditRegion }: RegionControls & { tag: string; region?: NodeRegion }) {
  const icons = nodeTitleIcons(tag);
  const manual = Object.prototype.hasOwnProperty.call(regionOverrides, tag);
  const label = region?.label ?? (manual ? regionOverrides[tag] : "未识别");
  return (
    <button
      type="button"
      disabled={editDisabled}
      onClick={() => onEditRegion(tag)}
      className="node-region-badge pointer-events-auto relative z-10 max-w-40 shrink-0 truncate rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      title={`设置地区：${tag}（${manual ? "手动" : "自动"}：${label}）`}
      aria-label={`设置节点地区：${tag}，${label}，${manual ? "手动" : "自动"}`}
    >
      {icons.length > 0 ? (
        <span aria-hidden="true" className="text-sm leading-none">{guardedEmojiText(icons.join(""))}</span>
      ) : <>{label}{manual ? " · 手动" : ""}</>}
    </button>
  );
}

// Protocols have no shared official icon set; these line symbols describe their roles.
const PROTOCOL_APPEARANCE: Record<string, { label: string; color: string; path: string }> = {
  shadowsocks: { label: "SS", color: "bg-sky-50 text-sky-800", path: "m3 11 18-8-7 18-3-7-8-3Zm8 3L21 3" },
  vmess: { label: "VMess", color: "bg-violet-50 text-violet-800", path: "m12 3 9 9-9 9-9-9 9-9Zm0 0v18M3 12h18" },
  vless: { label: "VLESS", color: "bg-emerald-50 text-emerald-800", path: "m4 5 8 15 8-15M8 5l4 8 4-8" },
  trojan: { label: "Trojan", color: "bg-rose-50 text-rose-800", path: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-3 9 2 2 4-4" },
  hysteria2: { label: "HY2", color: "bg-amber-50 text-amber-800", path: "m14 2-9 12h6l-1 8 9-12h-6l1-8Z" },
  tuic: { label: "TUIC", color: "bg-cyan-50 text-cyan-800", path: "M3 7h14m-4-4 4 4-4 4M21 17H7m4-4-4 4 4 4" },
  anytls: { label: "AnyTLS", color: "bg-indigo-50 text-indigo-800", path: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3" },
  wireguard: { label: "WG", color: "bg-fuchsia-50 text-fuchsia-800", path: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3ZM8 9l2 7 2-4 2 4 2-7" },
  socks5: { label: "SOCKS", color: "bg-teal-50 text-teal-800", path: "M8 3v5m8-5v5M5 8h14v3a7 7 0 0 1-14 0V8Zm7 10v3" },
  http: { label: "HTTP", color: "bg-blue-50 text-blue-800", path: "M3 4h18v16H3V4Zm0 5h18M7 6.5h.01M10 6.5h.01M7 13l-2 2 2 2m10-4 2 2-2 2" },
  direct: { label: "Direct", color: "bg-lime-50 text-lime-800", path: "M3 12h18m-7-7 7 7-7 7" },
  reject: { label: "Reject", color: "bg-red-50 text-red-800", path: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM6 6l12 12" },
};

function ProtocolBadge({ protocol }: { protocol: string }) {
  const display = PROTOCOL_APPEARANCE[protocol] ?? {
    label: protocol === "unknown" ? "?" : protocol.toUpperCase(),
    color: "bg-muted text-muted-foreground",
    path: "M10 8a3 3 0 1 1 5 2c-2 1-3 2-3 4m0 3h.01",
  };
  return (
    <span
      className={`node-protocol-badge inline-flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${display.color}`}
      title={protocol}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
        <path d={display.path} />
      </svg>
      <span className="truncate">{display.label}</span>
    </span>
  );
}
function regionFlag(label: string): string { const flags: Record<string, string> = { "英国": "🇬🇧", "美国": "🇺🇸", "日本": "🇯🇵", "新加坡": "🇸🇬", "香港": "🇭🇰", "台湾": "🇹🇼", "韩国": "🇰🇷", "德国": "🇩🇪", "澳大利亚": "🇦🇺", "加拿大": "🇨🇦", "法国": "🇫🇷", "荷兰": "🇳🇱", "俄罗斯": "🇷🇺", "印度": "🇮🇳" }; return flags[label] ?? "🌐"; }
