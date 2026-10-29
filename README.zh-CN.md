# Emoji Layout Lab

一个独立 Web 性能调试练习，包含无依赖的简化页面，以及复用原 React 组件的对照页面。全部使用合成节点，运行已构建页面只需要 Node.js，无需真实订阅或桌面应用。全部图标和字体资源位于本地。

## Tauri 桌面练习包

已在本机安装至 `/Applications/Emoji Layout Lab.app`；Release 构建与本地 ad-hoc 签名校验通过。尚未做安装后界面和卡顿复现验证，由使用者自行打开对照。

可选的 Tauri 2 封装，应用名 `Emoji Layout Lab`，应用标识 `local.learning.emoji-layout-lab.tauri`。默认打开原组件页面的 raw 模式，窗口 1280×900。菜单「调试 → 打开开发者工具」或 ⌥⌘I 打开 Inspector，之后可切换 Timelines / Console。

所有网页和字体打进本地应用，不需要后台 HTTP 服务。原始、隐藏、保护等对照链接继续可用。应用只提供实验页面与开发者工具，不包含代理核心或自定义系统命令。

构建需要 Rust 1.90+ 和 Xcode Command Line Tools：

```sh
npm run build:app
```

本机构建产物在 `.cargo-target/release/bundle/macos/Emoji Layout Lab.app`。构建时设置 `CARGO_TARGET_DIR="$PWD/.cargo-target"` 可使用该目录；未设置时默认位于 `src-tauri/target/`。`build:app` 使用 Cargo 锁文件构建；首次构建需要下载依赖。

## 启动网页

需要 Node.js（18 或更新版本）：

```sh
npm start
```

打开 http://127.0.0.1:4178/ 。服务器只监听本机。停止服务：终端按 Ctrl+C。

也可以直接双击 `web/index.html`。推荐本地服务器方式，便于浏览器一致地加载字体、定位源码和导出结果。

## 原组件对照入口

先尝试 http://127.0.0.1:4178/original/?mode=raw 。这是从原项目复制的 NodeListView、VirtualNodeList、NodeLatency 和依赖代码，保留原 CSS、完整字体导入与对应 CSP；使用 55 个合成节点、相同地区顺序和组大小。初始地区是日本，首访对照请跳过它。

- 原始：http://127.0.0.1:4178/original/?mode=raw
- 隐藏：http://127.0.0.1:4178/original/?mode=hidden
- 保护：http://127.0.0.1:4178/original/?mode=guard
- ASCII：http://127.0.0.1:4178/original/?mode=ascii
- 系统字体：http://127.0.0.1:4178/original/?mode=raw&font=system

Console 会输出原组件的 `[region-switch-performance]`；`window.originalLab.samples` 保存样本。页脚显示最新结果。页面切换查看的是地区，节点选择按钮只改变本页状态，编辑与测速入口为空操作。

这是更接近原组件的复现候选，尚未在 Safari 中验证卡顿；不能把复制了组件当成已经复现。外层应用布局、配置预热和 Tauri 的宿主配置仍有差异。

源码在 `fixture/`，已构建资源在 `web/original/`，运行服务器不需要安装依赖。修改 fixture 后可运行 `npm install`、`npm run build:fixture`。使用 `npm ci` 安装锁定依赖后再构建。

## 建议先自己完成的练习

1. 用 Safari 打开页面，选择 A「原始 emoji」、12 张卡片、本地字体；保持「更新后同步读取几何」关闭。
2. 打开开发者工具。Safari 找 Timelines，Chrome/Edge 找 Performance。开始录制后访问一个未点过的地区，然后停止。
3. 查看页面计时表和 Console 的 `[emoji-lab]`。比较 DOM 更新、首个 rAF 和第二个 rAF。
4. 在录制结果里找到该次操作：有 `emoji-lab:N:click`、`:dom`、`:raf1`、`:raf2` 以及 `:click-to-raf2` User Timing 标记，面板的呈现方式随浏览器不同。
5. 重访该地区，观察缓存影响。然后在新会话分别测试 B「隐藏 emoji」、C「边界保护」、D「ASCII 对照」。每轮保留相同卡片数量、字体、窗口尺寸与访问顺序。
6. 单独勾选「更新后同步读取几何」，观察耗时是否转移到几何读取。这个选项只调用一次 `getBoundingClientRect()`，没有忙循环或人为延迟。
7. 最后尝试系统字体和 emoji 专用字体；如果 12 张差异不明显，可以分别试 60、240 张。增大节点数量会增加普通 DOM/布局成本，不能把全部差值都归因于字符。
8. 导出 JSON，保留每轮结果和运行条件。不要拿原始模式的首访，与保护模式的热访问直接比较。

「依次首访全部地区」会按固定顺序逐一访问，组间等待 400ms，等待时间不计入样本。若本轮已经访问过某地区，表里会如实显示第几次访问，不会把热访问标成首访。

## 运行环境和测量边界

- 这个练习来自 macOS WebKit 字体布局问题。推荐先用 Safari；Chrome/Edge 是对照环境，不保证表现相同。
- 不保证所有 OS、字体和引擎版本都有明显卡顿。若原始模式和保护模式都很快，这也是有效结果；不要用假延迟制造结论。
- 页面刷新会清空本页记录，但不保证清空字体缓存或换一个 WebContent 进程。新标签页也不保证是新进程。严谨首访对照可退出浏览器后重新打开，并检查没有保留其他相关标签页。
- `DOM 更新` 测量同步 DOM 创建与替换。它不覆盖之后全部样式计算、布局和绘制。
- `首个/第二个 rAF` 是回调到达时间，不等于屏幕呈现完成时间。
- 不勾选几何读取时，计时路径不会主动同步读取布局。结果表与状态文字在第二个 rAF 计时完成后才更新。
- 使用自定义字体时，字体加载状态会记录在 JSON 中；比较时应保持一致。页面没有先 `await document.fonts.ready`，便于观察真实首访时序。

## 源码入口

- `web/lab.js`：`switchGroup()` 分段计时；`renderGroup()` 创建卡片；`guardedEmojiText()` 是保护模式实现。
- `web/style.css`：字体、Grid/Flex 布局、单行徽标与隐藏模式。
- `web/index.html`：所有实验控制项和计时表。
- `scripts/serve.mjs`：无依赖的本地静态文件服务器。
- `SOLUTION.md`：实验解释与检查点；建议做完一轮再看。

在 Console 可以直接检查：

```js
emojiLab.samples
emojiLab.switchGroup(2) // 手动测日本，索引见 emojiLab.groups
```

切换实验设置时当前卡片会重新渲染，会预热该条件；重新加载按钮会把设置写进 URL，再清空本页会话。请根据实验目标区分热切换与新会话。

## 字体许可

`web/fonts/` 包含 Inter 和 Oswald 的本地 Latin 字体子集，以及各自许可证。中文和 emoji 使用系统字体回退；字体名称和字符组合是本实验的一部分。

## 检查

```sh
npm run check
```

这只做 JavaScript 语法检查。性能结论必须来自浏览器中的实测。
