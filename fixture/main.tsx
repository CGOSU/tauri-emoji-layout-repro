import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-sc/wght.css';
import '@fontsource-variable/oswald/wght.css';
import './desktop/index.css';
import './layout.css';
import {NodeListView} from './desktop/components/app/NodeListView';
import {emptyLatencyState} from './desktop/latencyState';
import type {Node,NodeRegion} from './desktop/types';

// Synthetic data: same region order and group sizes as the observed case.
const definitions=[['英国','🇬🇧',5],['其他','🌐',1],['日本','🇯🇵',15],['香港','🇭🇰',9],['新加坡','🇸🇬',12],['美国','🇺🇸',12],['台湾','🇨🇳',1]] as const;
const nodes:Node[]=[];
const regions:NodeRegion[]=[];
for(const [groupIndex,[label,flag,count]] of definitions.entries()) {
 for(let i=0;i<count;i++) {
  const tag=`${flag}${label}合成节点${String(i+1).padStart(2,'0')}|BGP|LAB`;
  nodes.push({tag,settings:{protocol:i%3===0?'hysteria2':'vless',server:'example.invalid',port:443}});
  regions.push({tag,key:groupIndex===1?`node:${tag}`:`region:${groupIndex}`,label});
 }
}
const latency=emptyLatencyState();
const mode=new URLSearchParams(location.search).get('mode')??'raw';
const font=new URLSearchParams(location.search).get('font')??'original';
document.body.dataset.mode=mode;
document.body.dataset.font=font;
localStorage.setItem('region-switch-performance','1');
const samples:unknown[]=[];
const originalInfo=console.info.bind(console);
console.info=(...args:unknown[])=>{
 originalInfo(...args);
 if(args[0]==='[region-switch-performance]') {
  const row={sample:args[1],mode,font,viewport:[innerWidth,innerHeight],fontsStatus:document.fonts.status,time:new Date().toISOString()};
  samples.push(row);
  // Update the small textual result after the measured callbacks have completed.
  const output=document.getElementById('last-sample');
  if(output)output.textContent=JSON.stringify(row.sample);
 }
};
Object.assign(window,{originalLab:{samples,nodes,regions,mode,font}});
function Fixture() {
 const [view,setView]=useState<'card'|'list'>('card');
 const [current,setCurrent]=useState(nodes.find(n=>n.tag.includes('日本合成节点10'))!.tag);
 return <div className="fixture-app">
  <header className="fixture-header"><div><strong>原组件 · 字符布局实验</strong><p>55 个合成节点 · 当前 {mode} / {font} · 先跳过默认日本，首访其他地区</p></div><div className="fixture-links"><a href="?mode=raw">原始</a><a href="?mode=hidden">隐藏 emoji</a><a href="?mode=guard">边界保护</a><a href="?mode=ascii">ASCII</a><a href={`?mode=${mode}&font=system`}>系统字体</a><a href="/">简化实验</a><button onClick={()=>setView(view==='card'?'list':'card')}>{view==='card'?'列表':'卡片'}</button></div></header>
  <main className="fixture-main"><aside className="fixture-sidebar"><p>状态</p><strong>配置</strong><p>设置</p><small>纯网页，无代理内核</small></aside><div className="fixture-pane"><div data-node-scroll-container="" className="absolute inset-0 overflow-y-auto p-4 sm:p-5 lg:p-6"><section className="rounded-xl border bg-card"><div className="border-b p-4"><h2>节点选择</h2><p className="text-xs text-muted-foreground">保留原组件、虚拟列表、样式和字体加载；操作只影响本页。</p></div><div className="p-4"><NodeListView nodes={nodes} nodeRegions={regions} grouping="region" view={view} currentNode={current} latencyState={latency} testing={false} regionOverrides={{}} editDisabled={false} onEditRegion={()=>{}} onSelect={setCurrent} onTest={()=>{}} /></div></section></div></div></main>
  <footer id="last-sample">Console 输出 [region-switch-performance]；window.originalLab.samples 可检查全部记录。rAF 耗时不等于呈现完成。</footer>
 </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture/></React.StrictMode>);
