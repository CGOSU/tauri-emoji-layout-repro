# Tauri emoji layout stall reproduction

A standalone debugging fixture for macOS: decorative emoji text can cause layout stalls in a packaged Tauri/WKWebView app, while the reporter observes responsive behavior in Safari. Wrapping complete emoji display strings with U+2060 WORD JOINER avoids most of the delay in the original application.

This repository includes a reduced React component fixture, a simpler vanilla-JavaScript control, local fonts, and a small Tauri shell. All node data is synthetic. No subscription, proxy service, account, or external API is required.

## Run the browser fixture

Requires Node.js 22.12+ (or a newer supported release).

```sh
npm ci
npm run build:fixture
npm start
```

Open http://127.0.0.1:4178/original/?mode=raw in Safari. The server listens only on loopback. The simpler control is at http://127.0.0.1:4178/ .

If npm 12 reports `EALLOWREMOTE` for the registry-hosted Tailwind optional WASM package, use `npm ci --include=dev --allow-remote=all`. All resolved package URLs in this lockfile are on `registry.npmjs.org`.

## Build the macOS application

Requires Rust 1.90+, Xcode Command Line Tools, and the normal Tauri prerequisites.

```sh
npm ci
npm run build:app
```

Open the generated app in `src-tauri/target/release/bundle/macos/Emoji Layout Lab.app`. If `CARGO_TARGET_DIR` is set, look under that directory instead.

The default page is `/original/index.html?mode=raw`, in a 1280×900 window. Use **Debug / 调试 → Open developer tools / 打开开发者工具**, or Option+Command+I, to open Web Inspector. The shell enables the `devtools` feature in release builds. No custom Tauri commands or plugins are registered.

## Reproduce and compare

1. Launch the release application in **raw** mode. The initial region is Japan.
2. Skip Japan and visit the other six regions once each, in their displayed order.
3. Observe the UI stall, the latest sample in the footer, and `[region-switch-performance]` in Console. All samples are available through `window.originalLab.samples`.
4. Quit the app completely. Relaunch, follow the **hidden emoji** or **boundary guard** link, and repeat the same region order. Changing a mode navigates within the same app; changing mode alone does not guarantee cold caches.
5. For a stricter comparison, quit and relaunch again after entering a mode, then open the same mode before visiting the regions. The initial Japan group and navigation may already be warmed. OS-level font caches are not guaranteed to reset.
6. Compare the same page and viewport in Safari. Browser-versus-Tauri behavior has been reported by the author, but no instrumented Safari benchmark is included here.

Modes:

- `?mode=raw`: original emoji strings.
- `?mode=hidden`: hide the three decorative emoji spans with CSS.
- `?mode=guard`: wrap each complete emoji display string with U+2060 in one text node.
- `?mode=ascii`: replace decorative emoji with `[*]`.
- `?mode=raw&font=system`: use a system font stack as a separate control.

The standalone shell reproducing the stall has been confirmed by the reporter. The numerical evidence in `evidence/original-app-timing.json` belongs to the **original application**, not this standalone fixture. Please collect new measurements when running this repository.

## Timing interpretation

The component records click-handler start, a React layout-effect checkpoint (`commitMs`), a second rAF callback (`twoFramesMs`), row measurements, and selected synchronous spans.

- `commitMs` is not pure React render time.
- `twoFramesMs` measures callback arrival, not completed screen presentation.
- `nodeElementCreation` only measures JSX element creation.
- Native process sampling adds substantial overhead; use it for attribution, not latency comparison.
- Keep the viewport, region order, inspector state, font state, and first-versus-repeat visits consistent.

## Workaround

```ts
function guardedEmojiText(text: string): string {
  return text ? `\u2060${text}\u2060` : "";
}
```

```tsx
<span aria-hidden="true">{guardedEmojiText(icons.join(""))}</span>
```

Keep the full output in **one text node**. Do not insert characters inside flag pairs, modifiers, variation selectors, or ZWJ sequences. Apply guards only to decorative display text, not identifiers, stored values, titles, or accessibility labels.

`fixture/desktop/nodeDisplay.ts` adds a mode switch around this helper for the experiment. The raw mode returns the original string; guard mode applies the workaround.

## Possible mechanism and limits

The original application's native WebContent sample was dominated by layout → `glyphOverflowInInlineDirection` → glyph lookup → CoreText font fallback / font character-set parsing. Upstream WebKit source reads the first/last UTF-16 code unit in this boundary-query path. An isolated surrogate lookup is a plausible explanation, consistent with the sample and successful BMP guards, but the actual character argument and exact installed implementation have not been verified.

A successful Tauri/Safari comparison does not, by itself, prove that Tauri's Rust code is the root cause. Embedding preferences, the custom protocol, CSP, font loading, and caches remain possible differentiators.

The CSP intentionally follows the original app and does **not** permit `data:` font sources. Some fonts inlined by Vite may be rejected in Console. That behavior is retained for fidelity and is an explicit variable to investigate.

The extracted component fixture preserves the original node components, virtualizer, styles and font imports; it does not include the full original application, configuration prewarming, or backend. Region editing and latency testing callbacks are inert; node selection changes only local React state.

## Source map

- `fixture/main.tsx`: synthetic 55-node dataset and host layout.
- `fixture/desktop/components/app/NodeListView.tsx`: region selection, emoji output, diagnostic checkpoints.
- `fixture/desktop/components/app/VirtualNodeList.tsx`: TanStack virtualizer and measurement hooks.
- `fixture/desktop/nodeDisplay.ts`: emoji extraction and mode-dependent boundary workaround.
- `fixture/desktop/index.css`, `theme.css`: extracted styles.
- `src-tauri/`: minimal native shell and devtools menu.
- `web/lab.js`: simpler DOM-only control.
- `evidence/`: environment and explicitly labeled original-application evidence.

## Checks

```sh
npm run check
npm run build:fixture
npm run build:app
```

The Rust and npm lockfiles pin the reproduction. The original tested Rust graph includes Wry 0.57.0 and Tao 0.37.1; newer patch versions have not been runtime-tested by this report.

## Fonts and provenance

Inter, Noto Sans SC and Oswald are loaded through Fontsource. Their license files are included under `web/fonts/`. The reduced React components originate from the reporter's `CGOSU/clash_foward_rev` application; the surrounding fixture and Tauri shell are specific to this reproduction.

Chinese learning notes are in [README.zh-CN.md](README.zh-CN.md). The fuller experimental explanation is in [SOLUTION.md](SOLUTION.md).
