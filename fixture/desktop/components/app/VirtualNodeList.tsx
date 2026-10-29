import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";
import type { Node } from "@/types";
import { NODE_CARD_GAP, nodeColumnCount, nodeRowRange, resetNodeScroll } from "@/nodeVirtualization";

interface VirtualNodeListProps {
  groupKey: string;
  nodes: Node[];
  view: "card" | "list";
  prepareGroupScroll: RefObject<((key: string) => void) | null>;
  onRowMeasured?: () => void;
  isDiagnosticActive?: () => boolean;
  recordSpan?: (name: string, duration: number) => void;
  renderNode: (node: Node) => ReactNode;
}

interface FocusedControl {
  index: number;
  button: number;
}

function nodeButtons(root: HTMLElement, index: number) {
  return root.querySelectorAll<HTMLButtonElement>(`[data-node-index="${index}"] button:not(:disabled)`);
}

export function VirtualNodeList({ groupKey, nodes, view, renderNode, prepareGroupScroll, onRowMeasured, isDiagnosticActive, recordSpan }: VirtualNodeListProps) {
  const root = useRef<HTMLDivElement>(null);
  const previousGroup = useRef(groupKey);
  const preparedGroup = useRef<string | null>(null);
  const [geometry, setGeometry] = useState({ columns: 1, top: 0 });
  const [focused, setFocused] = useState<FocusedControl | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{ index: number; last: boolean } | null>(null);
  const { columns, top } = geometry;
  const rowCount = Math.ceil(nodes.length / columns);
  const getScrollElement = useCallback(() => root.current?.closest<HTMLElement>("[data-node-scroll-container], main") ?? null, []);
  const getItemKey = useCallback((row: number) => nodes[row * columns].tag, [nodes, columns]);
  const rangeExtractor = useCallback((range: Range) => nodeRowRange(range, [
    focused ? Math.floor(focused.index / columns) : -1,
    pendingFocus ? Math.floor(pendingFocus.index / columns) : -1,
  ]), [focused, pendingFocus, columns]);
  const virtualizer = useVirtualizer<HTMLElement, HTMLDivElement>({
    count: rowCount,
    getScrollElement,
    getItemKey,
    estimateSize: () => view === "card" ? 82 : 54,
    gap: view === "card" ? NODE_CARD_GAP : 6,
    overscan: 2,
    scrollMargin: top,
    rangeExtractor,
    // ResizeObserver supplies real row heights without forcing font/layout work
    // synchronously for each newly attached row during the React commit.
    measureElement: (element, entry, instance) => {
      if (entry) {
        onRowMeasured?.();
        return entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      }
      const key = instance.options.getItemKey(Number(element.dataset.index));
      return instance.itemSizeCache.get(key) ?? (view === "card" ? 82 : 54);
    },
  });

  useLayoutEffect(() => {
    const element = root.current;
    const scroll = getScrollElement();
    if (!element || !scroll) return;
    let frame = 0;
    const measure = () => {
      const active = isDiagnosticActive?.() === true;
      const start = active ? performance.now() : 0;
      const next = {
        columns: nodeColumnCount(element.clientWidth, view),
        top: element.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop,
      };
      const afterRead = active ? performance.now() : 0;
      setGeometry((previous) => previous.columns === next.columns && previous.top === next.top ? previous : next);
      if (active) {
        const end = performance.now();
        recordSpan?.("geometryReads", afterRead - start);
        recordSpan?.("geometrySetState", end - afterRead);
      }
      return next;
    };
    const initial = measure();
    // A new region/view starts at its first row, without moving a page already above it.
    if (scroll.scrollTop > initial.top) scroll.scrollTop = initial.top;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(element);
    observer.observe(scroll);
    // Subscription editors and notices above the list can change its document offset.
    if (scroll.firstElementChild) observer.observe(scroll.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [getScrollElement, view, isDiagnosticActive, recordSpan]);

  useLayoutEffect(() => {
    const prepare = (key: string) => {
      const scroll = getScrollElement();
      if (!scroll) { preparedGroup.current = null; return; }
      const active = isDiagnosticActive?.() === true;
      const start = active ? performance.now() : 0;
      resetNodeScroll(scroll, scroll.scrollTop, top);
      if (active) recordSpan?.("preSwitchScrollReset", performance.now() - start);
      preparedGroup.current = key;
    };
    prepareGroupScroll.current = prepare;
    return () => { if (prepareGroupScroll.current === prepare) prepareGroupScroll.current = null; };
  }, [getScrollElement, top, prepareGroupScroll, isDiagnosticActive, recordSpan]);

  useLayoutEffect(() => {
    if (previousGroup.current === groupKey) return;
    previousGroup.current = groupKey;
    const diagnosticActive = isDiagnosticActive?.() === true;
    const start = diagnosticActive ? performance.now() : 0;
    setFocused(null);
    setPendingFocus(null);
    const scroll = getScrollElement();
    const beforeScroll = diagnosticActive ? performance.now() : 0;
    // Non-click changes cannot be prepared before rendering; retain the existing fallback.
    if (preparedGroup.current !== groupKey && scroll && virtualizer.scrollOffset !== null) {
      resetNodeScroll(scroll, virtualizer.scrollOffset, top);
    }
    preparedGroup.current = null;
    if (diagnosticActive) {
      const end = performance.now();
      recordSpan?.("groupEffectBeforeScroll", beforeScroll - start);
      recordSpan?.("groupEffectScrollReset", end - beforeScroll);
    }
  }, [groupKey, top, getScrollElement, isDiagnosticActive, recordSpan, prepareGroupScroll, virtualizer]);

  useLayoutEffect(() => {
    // Width changes alter wrapping and row membership; do not reuse old row heights.
    const active = isDiagnosticActive?.() === true;
    const start = active ? performance.now() : 0;
    virtualizer.measure();
    if (active) recordSpan?.("virtualizerMeasureCall", performance.now() - start);
  }, [columns, virtualizer, isDiagnosticActive, recordSpan]);

  useLayoutEffect(() => {
    if (!root.current) return;
    if (pendingFocus) {
      const buttons = nodeButtons(root.current, pendingFocus.index);
      const target = pendingFocus.last ? buttons[buttons.length - 1] : buttons[0];
      if (target) {
        target.focus({ preventScroll: true });
        setPendingFocus(null);
      }
    } else if (focused && document.activeElement === document.body) {
      // Responsive reflow may move a focused node into a different row wrapper.
      nodeButtons(root.current, focused.index)[focused.button]?.focus({ preventScroll: true });
    }
  }, [columns, focused, pendingFocus]);

  return (
    <div
      ref={root}
      role="list"
      aria-label="节点"
      className="relative w-full min-w-0"
      style={{ height: virtualizer.getTotalSize(), overflowAnchor: "none" }}
      onFocusCapture={(event) => {
        const target: HTMLElement = event.target;
        if (!(target instanceof HTMLButtonElement)) return;
        const item = target.closest<HTMLElement>("[data-node-index]");
        if (!item || !root.current) return;
        const index = Number(item.dataset.nodeIndex);
        const button = [...nodeButtons(root.current, index)].indexOf(target);
        if (button >= 0) setFocused({ index, button });
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setFocused(null);
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey || !root.current) return;
        const target = event.target as HTMLElement;
        const item = target.closest<HTMLElement>("[data-node-index]");
        if (!item) return;
        const index = Number(item.dataset.nodeIndex);
        const buttons = nodeButtons(root.current, index);
        const atBoundary = event.shiftKey ? target === buttons[0] : target === buttons[buttons.length - 1];
        const nextIndex = index + (event.shiftKey ? -1 : 1);
        if (!atBoundary || nextIndex < 0 || nextIndex >= nodes.length || nodeButtons(root.current, nextIndex).length) return;
        event.preventDefault();
        setPendingFocus({ index: nextIndex, last: event.shiftKey });
        virtualizer.scrollToIndex(Math.floor(nextIndex / columns), { align: "auto" });
      }}
    >
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          ref={virtualizer.measureElement}
          data-index={row.index}
          role="presentation"
          className={view === "card" ? "node-card-grid absolute left-0 top-0 w-full" : "node-row-list absolute left-0 top-0 w-full"}
          style={{
            transform: `translateY(${row.start - top}px)`,
            gridTemplateColumns: view === "card" ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
          }}
        >
          {nodes.slice(row.index * columns, (row.index + 1) * columns).map((node, offset) => (
            <div
              key={node.tag}
              role="listitem"
              aria-posinset={row.index * columns + offset + 1}
              aria-setsize={nodes.length}
              data-node-index={row.index * columns + offset}
              className="min-w-0"
            >
              {(() => {
                if (!isDiagnosticActive?.()) return renderNode(node);
                // Measures JSX element creation only, not React reconciliation or DOM commit.
                const start = performance.now();
                const result = renderNode(node);
                recordSpan?.("nodeElementCreation", performance.now() - start);
                return result;
              })()}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
