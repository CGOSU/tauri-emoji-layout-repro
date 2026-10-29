import type { Config } from "@/types";

export type Page = "status" | "config" | "settings";
export type AdvancedSection =
  | "proxy"
  | "tun"
  | "core"
  | "rules"
  | "custom-rules"
  | "log";
export type NodeView = "list" | "card";
export type NodeGrouping = "none" | "region";
export type LogMode = "all" | "proxy" | "direct";

// Resolves false on save/preview failure or a busy save; never rejects.
export type ApplyConfig = (config: Config) => Promise<boolean>;
export type ShowToast = (message: string) => void;
export type SetError = (message: string) => void;
