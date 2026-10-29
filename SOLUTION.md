# 实验解释

这个项目让你检查的核心问题：同步 DOM 更新已结束时，为什么下一帧仍可能迟到？

## 从观测到假设

1. `domMs` 小、`firstRAF` 大：进一步检查 DOM 更新之后的样式、布局、字体和其他主线程工作。不能直接把差值称为纯布局耗时。
2. 开启同步几何读取后 `geometryMs` 变大：`getBoundingClientRect()` 可能迫使待处理的样式/布局立即完成。昂贵工作被这个调用触发，不说明读取 API 的实现本身就是根因。
3. B 隐藏三处 emoji 后明显变快：支持装饰性字符渲染是触发条件。不过隐藏同时改变了布局，所以还需要其他对照。
4. C 保留外观只改变字符串边界也变快：进一步支持文本边界处理的解释。
5. D ASCII 对照和字体切换：帮助区分一般 DOM 数量、可见图标、字体选择和特定字符边界。

## 保护函数

```js
function guardedEmojiText(text) {
  return text ? `\u2060${text}\u2060` : '';
}
```

U+2060 WORD JOINER 没有可见宽度，并禁止相邻位置换行。整个字符串通过一次 `textContent` 赋值形成一个文本节点，完整 emoji 串位于内部。不要把边界字符拆进不同 span，不要插进旗帜对、肤色或 ZWJ 序列中。

上游 WebKit 的 `glyphOverflowInInlineDirection` 曾直接用 `textContent[0]` 和 `textContent[length - 1]` 取得 UTF-16 单元，再查询字形。非 BMP 字符的首尾单元可能是孤立代理项，与真实案例中的系统字体回退热点吻合。该机制是源码支持的解释；不能仅凭本项目的一组数字证明运行中的浏览器一定执行了该实现。

## 下一步的原生采样

若 Timelines 指向长布局，而 JavaScript 调用栈解释不了内部成本，可以在 macOS 活动监视器中找到正确的 Safari Web Content 进程并使用「取样进程」。采样期间切换未访问地区，查找 `glyphOverflowInInlineDirection`、`glyphDataForCharacter`、CoreText 字形回退与字体字符集解析。

采样有开销，单独用于找函数；性能前后数字应来自未运行原生采样的对照。

## 参考

- WebKit Timelines：https://webkit.org/web-inspector/timelines-tab/
- 边界查询源码：https://github.com/WebKit/WebKit/blob/main/Source/WebCore/layout/integration/inline/LayoutIntegrationInlineContentBuilder.cpp
- UTF-16 单元与码点访问：https://github.com/WebKit/WebKit/blob/main/Source/WTF/wtf/text/StringView.h
- Unicode WORD JOINER：https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-23/
