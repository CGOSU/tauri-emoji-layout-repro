import { defaultRangeExtractor } from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";

export const NODE_CARD_WIDTH = 128;
export const NODE_CARD_GAP = 16;

export function nodeColumnCount(width: number, view: "card" | "list"): number {
  return view === "list" ? 1 : Math.max(1, Math.floor((width + NODE_CARD_GAP) / (NODE_CARD_WIDTH + NODE_CARD_GAP)));
}

/** Keep keyboard focus mounted even when the user scrolls it out of view. */
export function nodeRowRange(range: Range, pinnedRows: readonly number[]): number[] {
  const indexes = new Set(defaultRangeExtractor(range));
  for (const row of pinnedRows) {
    if (row >= 0 && row < range.count) indexes.add(row);
  }
  return [...indexes].sort((left, right) => left - right);
}

/** Reset only if the previously observed offset was below the list start. */
export function resetNodeScroll(scroll: Pick<HTMLElement, "scrollTop">, offset: number, top: number): void {
  if (offset > top) scroll.scrollTop = top;
}
