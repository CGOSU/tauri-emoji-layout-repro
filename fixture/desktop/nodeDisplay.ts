import type { NodeGrouping } from "./app/types.ts";
import type { Node, NodeRegion } from "./types.ts";

// Match flag pairs, keycaps, then pictographs with modifiers/joins and subdivision tags.
const titleIconSequence = /\p{Regional_Indicator}{2}|[#*0-9]\ufe0f?\u20e3|\p{Extended_Pictographic}[\ufe0e\ufe0f]?\p{Emoji_Modifier}?(?:\u200d\p{Extended_Pictographic}[\ufe0e\ufe0f]?\p{Emoji_Modifier}?)*(?:[\u{e0020}-\u{e007e}]+\u{e007f})?/gu;

export function nodeTitleIcons(tag: string): string[] {
  return tag.match(titleIconSequence) ?? [];
}

// Keep BMP characters at decorative emoji boundaries to avoid WebKit's expensive
// glyph-overflow font fallback on surrogate halves. Display only: render the
// complete string as one text node; never add these guards to source tags/labels.
export function guardedEmojiText(text: string): string {
  const mode = new URLSearchParams(location.search).get("mode") ?? "raw";
  if (mode === "guard") return text ? `\u2060${text}\u2060` : "";
  if (mode === "ascii") return text ? "[*]" : "";
  return text;
}

export interface NodeDisplayGroup {
  key: string;
  label: string;
  nodes: Node[];
}

function compareProtocol(left: Node, right: Node): number {
  const a = left.settings.protocol.toLowerCase();
  const b = right.settings.protocol.toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Sort display copies only; region order and configuration order are unchanged. */
export function buildNodeDisplayGroups(
  nodes: readonly Node[],
  regionByTag: Readonly<Record<string, NodeRegion>>,
  grouping: NodeGrouping,
): NodeDisplayGroup[] {
  if (grouping === "none") {
    return [{ key: "all", label: "全部节点", nodes: [...nodes].sort(compareProtocol) }];
  }

  const groups = new Map<string, NodeDisplayGroup>();
  for (const node of nodes) {
    const region = Object.prototype.hasOwnProperty.call(regionByTag, node.tag) ? regionByTag[node.tag] : undefined;
    const unknown = !region || region.key.startsWith("node:");
    const key = unknown ? "unknown" : region.key;
    const label = unknown ? "其他" : region.label;
    const group = groups.get(key);
    if (group) group.nodes.push(node);
    else groups.set(key, { key, label, nodes: [node] });
  }
  return [...groups.values()].map((group) => ({
    ...group,
    nodes: group.nodes.sort(compareProtocol),
  }));
}

export function currentNodeGroupKey(groups: readonly NodeDisplayGroup[], currentNode: string): string | undefined {
  return groups.find((group) => group.nodes.some((node) => node.tag === currentNode))?.key;
}
