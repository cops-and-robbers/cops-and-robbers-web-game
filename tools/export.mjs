// 피그마와 개발에 넘길 재료를 뽑는다: 화면 캡처, 요소 SVG, 모션 프레임. node src/export.mjs
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = decodeURI(ROOT) + "assets";
const ld = p => fs.mkdirSync(p, { recursive: true });
for (const d of ["screens", "elements", "motions"]) ld(`${OUT}/${d}`);
const CHROME = process.env.USERPROFILE + "/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe";
const URLF = "file:///" + encodeURI(decodeURI(ROOT).replace(/\\/g, "/") + "dist/game.html");
const PORT = 9336;
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}/game-export-profile`, "--no-first-run", "--disable-gpu", "--window-size=1280,720", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets = null;
for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const wait = new Map(); const errors = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id) { wait.get(d.id)?.(d); wait.delete(d.id); } if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) { errors.push(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return null; } return r.result.result?.value; };
const shot = async name => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${OUT}/screens/${name}.png`, Buffer.from(r.result.data, "base64")); };
const size = async (w, h, mobile = false) => { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile }); await send("Emulation.setTouchEmulationEnabled", { enabled: mobile }); };
const run = sec => ev(`(()=>{const n=Math.round(${sec}*30);for(let i=0;i<n;i++)__game.frame(1/30)})()`);
const open = async () => { await send("Page.navigate", { url: URLF }); await sleep(900); };
await send("Runtime.enable"); await send("Page.enable");

// ── 화면 ──
await size(1280, 720); await open();
await shot("01-시작");
const scene = async (name, role, theme, seed, sec, extra = "") => { await ev(`__game.setPick('normal','${theme}'); __game.start('${role}',${seed})`); await run(sec); if (extra) { await ev(extra); await run(0.25); } await sleep(60); await shot(name); };
const nearBush = `const G=__game.G,L=__game.L,p=G.player,bs=L.BUSHES;let best=bs[0],bn=-1;for(const b of bs){const n=bs.filter(o=>Math.hypot(o.x-b.x,o.y-b.y)<560).length;if(n>bn){bn=n;best=b;}}p.x=best.x+10;p.y=best.y+150;p.faceA=-1.5;for(let i=0;i<70;i++)__game.frame(1/30);`;
for (const [theme, label, seed] of [["town", "동네", 4], ["night", "밤골목", 8], ["park", "공원", 6], ["city", "도심", 10], ["snow", "눈마을", 14]]) await scene(`02-테마-${label}`, "robber", theme, seed, 4, `(()=>{${nearBush}})()`);
await scene("03-경찰-출동대기", "police", "town", 7, 5);
await scene("04-위치공개-경찰", "police", "town", 7, 40.3);
await ev(`__game.setPick('normal','town'); __game.start('police',5)`); await run(18);
await ev(`(()=>{const G=__game.G,r=G.robbers.find(x=>x.state==="free"),p=G.player;const J=__game.L.CFG.JAIL;r.isPlayer=true;r.ix=r.iy=0;r.vx=r.vy=0;r.x=J.x+58;r.y=J.y+205;p.x=J.x;p.y=J.y+205;p.ix=p.iy=0;p.faceA=0;for(const q of G.police)if(q!==p){q.isPlayer=true;q.x=J.x+1300;q.y=J.y-800;}window.dispatchEvent(new KeyboardEvent("keydown",{key:" "}));})()`);
await run(0.3); await shot("05-체포순간");
await ev(`__game.setPick('normal','town'); __game.start('robber',9)`); await run(16);
await ev(`(()=>{const G=__game.G,L=__game.L,J=L.CFG.JAIL,me=G.player;for(const p of G.police){p.isPlayer=true;p.ix=p.iy=0;p.x=J.x+1200;p.y=J.y-700;}[1,2].forEach(i=>{const r=G.robbers[i];r.state='caught';r.caughtT=0.01;r.caughtN=1;r.action=null;r.path=[];r.goal=null;startAction(__game.chars()[r.id],'jail');});me.x=J.x;me.y=J.y+L.CFG.GATE_R-30;me.ix=me.iy=0;me.faceA=-1.57;})()`);
await run(1.4); await ev(`__game.chars().filter(c=>c.a.state==='jailed').length`); await shot("06-감옥-구조");
await scene("07-건물-뒤-가림", "police", "town", 8, 18, `(()=>{const G=__game.G,L=__game.L,p=G.player,r=G.robbers[0],b=L.BUILDINGS.filter(o=>!o.kind).sort((m,n)=>n.w-m.w)[0];r.isPlayer=true;p.x=b.x+b.w*0.3;p.y=b.y-34;r.ix=r.iy=0;r.x=b.x+b.w*0.68;r.y=b.y-34;p.faceA=0;for(let i=0;i<40;i++)__game.frame(1/30);p.x=b.x+b.w*0.3;p.y=b.y-34;r.x=b.x+b.w*0.68;r.y=b.y-34;p.faceA=0})()`);
await ev(`__game.setPick('normal','town'); __game.start('robber',12)`); await ev(`(()=>{const G=__game.G;G.player.s.hideT=47;G.player.s.rescued=1;G.player.s.caught=1;})()`); await ev(`__game.G.t=178`); await run(16); await ev(`(()=>{const G=__game.G;if(!G.over){G.t=179.9}})()`); await run(1); await sleep(900); await shot("08-결과");
await size(844, 390, true); await open();
await ev(`__game.setPick('normal','town'); __game.start('robber',3)`); await run(20); await shot("09-휴대폰-가로");
await size(390, 844, true); await open(); await ev(`__game.setPick('normal','town'); __game.begin('police')`); await sleep(400); await shot("10-휴대폰-세로-안내");
await size(1280, 720); await open();

if (process.env.ONLY !== "screens") {
// ── 요소 SVG: 게임이 쓰는 그리기 함수를 그대로 돌려 SVG 로 받는다 ──
var elements = await ev(`(()=>{
  function Mock(w,h){ this.w=w;this.h=h;this.o=[];this.stack=[];this.d='';this.fillStyle='#000';this.strokeStyle='#000';this.lineWidth=1;this.lineCap='butt';this.globalAlpha=1;this.tx=0;this.ty=0;this.clipN=0;this.open=0;}
  const col=c=>{const m=String(c).match(/rgba?\\(([^)]+)\\)/);if(!m)return [c,1];const p=m[1].split(',').map(Number);const h=x=>Math.round(x).toString(16).padStart(2,'0');return ['#'+h(p[0])+h(p[1])+h(p[2]),p[3]===undefined?1:p[3]];};
  const n=v=>Math.round(v*100)/100;
  Mock.prototype={
    save(){this.stack.push({a:this.globalAlpha,tx:this.tx,ty:this.ty,open:this.open,f:this.fillStyle,s:this.strokeStyle,l:this.lineWidth});this.open=0;},
    restore(){for(let i=0;i<this.open;i++)this.o.push('</g>');const s=this.stack.pop();this.globalAlpha=s.a;this.tx=s.tx;this.ty=s.ty;this.open=s.open;this.fillStyle=s.f;this.strokeStyle=s.s;this.lineWidth=s.l;},
    translate(x,y){this.tx+=x;this.ty+=y;},
    beginPath(){this.d='';},moveTo(x,y){this.d+='M'+n(x+this.tx)+' '+n(y+this.ty);},lineTo(x,y){this.d+='L'+n(x+this.tx)+' '+n(y+this.ty);},
    quadraticCurveTo(a,b,x,y){this.d+='Q'+n(a+this.tx)+' '+n(b+this.ty)+' '+n(x+this.tx)+' '+n(y+this.ty);},closePath(){this.d+='Z';},
    arc(x,y,r){this.ellipse(x,y,r,r,0);},
    ellipse(x,y,rx,ry,rot){x+=this.tx;y+=this.ty;const c=Math.cos(rot||0),s=Math.sin(rot||0),a=[x+rx*c,y+rx*s],b=[x-rx*c,y-rx*s];const deg=n((rot||0)*180/Math.PI);this.d+='M'+n(a[0])+' '+n(a[1])+'A'+n(rx)+' '+n(ry)+' '+deg+' 1 0 '+n(b[0])+' '+n(b[1])+'A'+n(rx)+' '+n(ry)+' '+deg+' 1 0 '+n(a[0])+' '+n(a[1])+'Z';},
    roundRect(x,y,w,h,r){x+=this.tx;y+=this.ty;r=Math.min(r,w/2,h/2);this.d+='M'+n(x+r)+' '+n(y)+'H'+n(x+w-r)+'Q'+n(x+w)+' '+n(y)+' '+n(x+w)+' '+n(y+r)+'V'+n(y+h-r)+'Q'+n(x+w)+' '+n(y+h)+' '+n(x+w-r)+' '+n(y+h)+'H'+n(x+r)+'Q'+n(x)+' '+n(y+h)+' '+n(x)+' '+n(y+h-r)+'V'+n(y+r)+'Q'+n(x)+' '+n(y)+' '+n(x+r)+' '+n(y)+'Z';},
    fill(){const [c,a]=col(this.fillStyle);this.o.push('<path d="'+this.d+'" fill="'+c+'"'+(a*this.globalAlpha<1?' fill-opacity="'+n(a*this.globalAlpha)+'"':'')+'/>');},
    stroke(){const [c,a]=col(this.strokeStyle);this.o.push('<path d="'+this.d+'" fill="none" stroke="'+c+'" stroke-width="'+this.lineWidth+'" stroke-linecap="'+this.lineCap+'"'+(a<1?' stroke-opacity="'+a+'"':'')+'/>');},
    fillRect(x,y,w,h){const d=this.d;this.d='';this.d='M'+n(x+this.tx)+' '+n(y+this.ty)+'h'+n(w)+'v'+n(h)+'h'+n(-w)+'Z';this.fill();this.d=d;},
    clip(){const id='c'+(++Mock.id);this.o.push('<clipPath id="'+id+'"><path d="'+this.d+'"/></clipPath><g clip-path="url(#'+id+')">');this.open++;},
    setLineDash(){},
    svg(){return '<svg xmlns="http://www.w3.org/2000/svg" width="'+this.w+'" height="'+this.h+'" viewBox="0 0 '+this.w+' '+this.h+'">'+this.o.join('')+'</svg>';}
  };
  Mock.id=0;
  const out={};
  for(const theme of Object.keys(THEMES)){
    __game.setPick('normal',theme); __game.start('robber',3);
    const T=THEMES[theme], pal=T.bushes, snow=theme==='snow';
    const add=(name,w,h,fn)=>{const m=new Mock(w,h);fn(m);out[T.name+'/'+name]=m.svg();};
    const mkTree=(species,cr,seed)=>({crown:cr,species,pit:theme==='city',x:0,y:0,w:28,h:20,seed});
    const tw=c=>Math.round(c*2.3+60), th=c=>Math.round(c*2.6+50);
    add('나무',tw(84),th(84),m=>drawTree(m,mkTree(T.species,84),tw(84),th(84),th(84)-20,pal,3.3,T));
    add('나무-큰',tw(100),th(100),m=>drawTree(m,mkTree(T.species,100),tw(100),th(100),th(100)-20,pal,7.1,T));
    const bushR={r:60,rx:59,ry:47,hedge:false}, hedH={r:58,rx:92,ry:29,hedge:true}, hedV={r:58,rx:29,ry:60,hedge:true};
    for(const [nm,b] of [['덤불-둥근',bushR],['울타리-가로',hedH],['울타리-세로',hedV]]){const w=Math.round(b.rx*2+40),h=Math.round(b.ry*2+b.r*.9+30);add(nm,w,h,m=>drawBush(m,b,w,h,h-12,pal,4.2,snow));}
    add('쓰레기통',110,100,m=>{m.translate(12,12);drawBins(m,{x:0,y:0,w:86,h:78},T,0);});
    if(T.bin[1]) add('쓰레기통-2',110,100,m=>{m.translate(12,12);drawBins(m,{x:0,y:0,w:86,h:78},T,1);});
    add('건물-큰',420,330,m=>{m.translate(20,20);drawBuilding(m,{x:0,y:0,w:360,h:270},T,0,0);});
    add('건물-작은',260,290,m=>{m.translate(20,20);drawBuilding(m,{x:0,y:0,w:200,h:230},T,3,0);});
  }
  return out;
})()`);
if (elements) for (const [k, v] of Object.entries(elements)) { const f = `${OUT}/elements/${k}.svg`; ld(path.dirname(f)); fs.writeFileSync(f, v); }
const chars = await ev(`(()=>{const o={};const host=document.createElement('div');document.body.append(host);for(const k of Object.keys(SVGS)){const rig=mount(SVGS[k],k),d=rig.def;addTail(rig);host.append(rig.svg);if(rig.parts.shadow)rig.parts.shadow.forEach(g=>g.style.display='none');rig.updateLimbs();rig.svg.setAttribute('viewBox','0 0 '+d.w+' '+d.h);rig.svg.setAttribute('width',d.w);rig.svg.setAttribute('height',d.h);rig.svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const c=rig.svg.cloneNode(true);c.querySelectorAll('*').forEach(n=>{if(n.style&&n.style.display==='none')n.remove();});c.removeAttribute('class');o[k]=new XMLSerializer().serializeToString(c);}host.remove();return o;})()`);
ld(`${OUT}/elements/캐릭터`);
const CH = { "police-front": "냥파-앞", "police-side": "냥파-옆", "police-back": "냥파-뒤", "robber-front": "도둥이-앞", "robber-side": "도둥이-옆", "robber-back": "도둥이-뒤", "robber-jailed": "도둥이-수감" };
if (chars) for (const [k, v] of Object.entries(chars)) if (CH[k]) fs.writeFileSync(`${OUT}/elements/캐릭터/${CH[k]}.svg`, v);

// ── 모션: 뷰 하나에 모션 하나. 프레임 PNG 로 GIF 와 띠 이미지를 만들고, 대표 8장은 SVG 로 남긴다 ──
const LIST = [
  ["냥파-대기", "police-front", "idleFront", 1.8, {}, true], ["냥파-옆달리기", "police-side", "runSide", 0.44, {}, true], ["냥파-앞달리기", "police-front", "runFront", 0.44, {}, true], ["냥파-뒤달리기", "police-back", "runFront", 0.44, {}, true], ["냥파-살금걷기", "police-side", "runSide", 0.8, { crouch: 1, period: 0.8, bob: 3 }, true], ["냥파-잡기", "police-side", "catchSide", 0.6, {}, false],
  ["도둥이-대기", "robber-front", "idleFront", 1.8, {}, true], ["도둥이-옆달리기", "robber-side", "runSide", 0.44, {}, true], ["도둥이-앞달리기", "robber-front", "runFront", 0.44, {}, true], ["도둥이-뒤달리기", "robber-back", "runFront", 0.44, {}, true], ["도둥이-살금걷기", "robber-side", "runSide", 0.8, { crouch: 1, period: 0.8, bob: 3 }, true], ["도둥이-수감", "robber-jailed", "jailed", 1.6, {}, true], ["도둥이-탈옥", "robber-jailed", "breakout", 0.5, {}, false],
];
const FF = process.env.USERPROFILE + "/AppData/Local/Microsoft/WinGet/Links/ffmpeg";
var results = [];
for (const [name, view, mot, T, opts, loop] of LIST) {
  const fps = 20, n = Math.max(8, Math.round(T * fps));
  const r = await ev(`(async()=>{
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(host);
    const rig=mount(SVGS['${view}'],'${view}'),d=rig.def;addTail(rig);
    host.append(rig.svg); if(rig.parts.shadow)rig.parts.shadow.forEach(g=>g.style.display='none');
    const P=46; rig.svg.setAttribute('viewBox',(-P)+' '+(-P)+' '+(d.w+P*2)+' '+(d.h+P*1.4)); rig.svg.setAttribute('width',d.w+P*2); rig.svg.setAttribute('height',d.h+P*1.4);rig.svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const clean=el=>{const c=el.cloneNode(true);c.querySelectorAll('*').forEach(n=>{if(n.style&&n.style.display==='none'){n.remove();return;}if(n.style&&n.style.opacity!==''){n.setAttribute('opacity',n.style.opacity);n.style.opacity='';}if(n.getAttribute('style')==='')n.removeAttribute('style');});c.style.cssText='';c.removeAttribute('class');return new XMLSerializer().serializeToString(c);};
    const m=MOTIONS['${mot}'](rig,${JSON.stringify(opts)}); const dt=${T}/${n}; const ctx={speed:1};
    if(${loop}){let t=0;while(t<${T}*2){m.update(1/60,ctx);t+=1/60;}}
    const svgs=[],pngs=[]; const S=2;
    const toPng=async s=>{const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);await img.decode();const c=document.createElement('canvas');c.width=(d.w+P*2)*S;c.height=(d.h+P*1.4)*S;c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c;};
    const canv=[];
    for(let i=0;i<${n};i++){const k=4;for(let j=0;j<k;j++)m.update(dt/k,ctx);rig.updateLimbs();const s=clean(rig.svg);svgs.push(s);const c=await toPng(s);canv.push(c);pngs.push(c.toDataURL('image/png'));}
    const pick=8,keys=[];for(let i=0;i<pick;i++)keys.push(Math.floor(i*${n}/pick));
    const st=document.createElement('canvas');st.width=canv[0].width*pick;st.height=canv[0].height;const sc=st.getContext('2d');keys.forEach((f,i)=>sc.drawImage(canv[f],i*canv[0].width,0));
    host.remove();
    const fp=Math.min(${n},16),fkeys=[];for(let i=0;i<fp;i++)fkeys.push(Math.floor(i*${n}/fp));return {pngs,strip:st.toDataURL('image/png'),svgs:fkeys.map(i=>svgs[i]),w:canv[0].width,h:canv[0].height};
  })()`);
  if (!r) { errors.push("모션 실패 " + name); continue; }
  const dir = `${OUT}/motions/${name}`; ld(dir); ld(`${dir}/png`); ld(`${dir}/svg`);
  r.pngs.forEach((p, i) => fs.writeFileSync(`${dir}/png/f${String(i).padStart(3, "0")}.png`, Buffer.from(p.split(",")[1], "base64")));
  r.svgs.forEach((p, i) => fs.writeFileSync(`${dir}/svg/${String(i + 1).padStart(2, "0")}.svg`, p));
  fs.writeFileSync(`${OUT}/motions/${name}-띠.png`, Buffer.from(r.strip.split(",")[1], "base64"));
  execFileSync(FF, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${dir}/png/f%03d.png`, "-vf", "scale=iw/2:-1:flags=lanczos,split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128", "-loop", loop ? "0" : "0", `${OUT}/motions/${name}.gif`]);
  fs.rmSync(`${dir}/png`, { recursive: true, force: true });
  results.push(`${name}:${r.pngs.length}프레임`);
}
}
console.log(JSON.stringify({ screens: fs.readdirSync(`${OUT}/screens`).length, errorsN: errors.length, errors: errors.slice(0, 8) }, null, 0));
ws.close(); proc.kill(); process.exit(0);
