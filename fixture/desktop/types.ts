// TypeScript mirror of the Rust internal data model (crate `clash-forward-rev-core-model`).
// The frontend only ever reads/writes these structures through Tauri commands —
// it never touches raw YAML or JSON subscription text directly.

export type ProxyType =
  | "shadowsocks"
  | "vmess"
  | "vless"
  | "trojan"
  | "hysteria2"
  | "tuic"
  | "wireguard"
  | "socks5"
  | "http"
  | "direct"
  | "reject"
  | "unknown";

export interface Node {
  tag: string;
  settings: { protocol: ProxyType; [k: string]: unknown };
}

export interface NodeRegion {
  tag: string;
  key: string;
  label: string;
}

export type GroupKind = "selector" | "urltest" | "fallback" | "loadbalance";
export type FailoverMode = "same_region" | "same_region_then_any";

export interface ProxyGroup {
  tag: string;
  kind: GroupKind;
  members: string[];
  default?: string;
  config: {
    url?: string;
    interval?: number;
    tolerance?: number;
    disable_udp?: boolean;
  };
}

export interface Rule {
  type: string;
  payload: string;
  target: string;
}

export interface RuleSet {
  tag: string;
  type: "remote" | "local" | "inline";
  format: "binary" | "source";
  url?: string;
  path?: string;
  rules?: Rule[];
}

export interface DnsConfig {
  enabled: boolean;
  servers?: unknown[];
  rules?: unknown[];
  fakeip?: { enabled: boolean; inet4_range: string; inet6_range?: string };
}

export interface RouteConfig {
  custom_rules?: Rule[];
  rules: Rule[];
  rule_sets: RuleSet[];
  final_outbound: string;
  auto_detect_interface?: boolean;
}

export interface TunOptions {
  auto_route: boolean;
  strict_route: boolean;
  stack: string;
  interface_name?: string;
  exclude_private_route: boolean;
  ipv6: boolean;
  route_exclude_address: string[];
  platform?: { http_proxy: boolean };
}

export interface InboundConfig {
  tag: string;
  type: "mixed" | "socks" | "http" | "tun";
  listen: string;
  listen_port: number;
  tun?: TunOptions;
}

export interface LogConfig {
  enabled: boolean;
  level: string;
  max_lines: number;
}

/** A local region setting that could not safely follow a subscription refresh. */
export interface UnmatchedNodeRegion {
  tag: string;
  region: string;
}

export interface Config {
  name: string;
  nodes: Node[];
  groups: ProxyGroup[];
  dns: DnsConfig;
  route: RouteConfig;
  inbounds: InboundConfig[];
  log: LogConfig;
  /** Local mixed-inbound (SOCKS+HTTP) listen port; default 7890. */
  proxy_port?: number;
  /** Local Clash API controller port; default 9090. */
  clash_api_port?: number;
  /** Expose the HTTP/SOCKS gateway to all IPv4 interfaces; disabled by default. */
  allow_lan?: boolean;
  /** Allow live node switching from the LAN control page; disabled by default. */
  allow_web_node_switch?: boolean;
  /** Absolute path to the sing-box executable; empty/"none" => resolve from PATH. */
  singbox_path?: string;
  /** Outbound routing mode: "rule" (规则分流, domestic direct) or "global" (全局代理). */
  outbound_mode?: string;
  /** Run automatic node failover while the core is running. */
  auto_failover?: boolean;
  /** Strict same-region failover or same-region-first fallback. */
  failover_mode?: FailoverMode;
  /** Profile-local region overrides. Missing entries use automatic detection. */
  node_region_overrides?: Record<string, string>;
  /** Retained across refreshes until explicitly acknowledged via save_config. */
  unmatched_node_regions?: UnmatchedNodeRegion[];
}

export interface SubscriptionTraffic {
  upload: number;
  download: number;
  total: number;
  expire: number;
}

export interface ProfileMeta {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  node_count: number;
  source?: string;
  traffic?: SubscriptionTraffic;
}

/** Startup proxy-lease reconcile code; mirrors Rust `ProxyLeaseReconcileCode`.
 * The backend decides ownership — the frontend only branches on these codes. */
export type ProxyLeaseReconcileCode =
  | "no-stale-lease"
  | "restored"
  | "mismatch"
  | "corrupt-lease"
  | "unsupported-version"
  | "restore-failed";

/** Result of the startup rebuild that settles a proxy lease left by a previous run. */
export interface ProxyLeaseReconcileReport {
  code: ProxyLeaseReconcileCode;
  /** Network services covered by the conclusion (deduplicated). */
  services: string[];
  /** Underlying reason: mismatched field, restore error, or unusable lease. */
  detail?: string | null;
}

/** Payload of the `shutdown-finished` event; only emitted when cleanup fails. */
export interface ShutdownFinishedEvent {
  ok: boolean;
  timedOut: boolean;
  leaseReleased: boolean;
  errors: string[];
}

export interface Profile {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  config: Config;
  /** Original subscription URL, if imported from a link. */
  source?: string;
  traffic?: SubscriptionTraffic;
}
