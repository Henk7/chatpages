(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const svg = $("webdev-plot"), wrap = document.querySelector(".webdev-chart-wrap"), tooltip = $("webdev-tooltip");
  const ns = "http://www.w3.org/2000/svg";
  const scene = {width:6800,height:4800,left:350,right:6450,top:200,bottom:4450,minScore:1100,maxScore:1900,minLog:Math.log10(.008),maxLog:Math.log10(15)};
  const brands = [
    {pattern:/^Claude\b/i,name:"Anthropic",mark:"A",color:"#d87954"},
    {pattern:/^GPT\b/i,name:"OpenAI",mark:"O",color:"#12806a"},
    {pattern:/^(Gemini|Gemma)\b/i,name:"Google",mark:"G",color:"#4285f4"},
    {pattern:/^DeepSeek\b/i,name:"DeepSeek",mark:"D",color:"#5478ed"},
    {pattern:/^MiMo\b/i,name:"Xiaomi",mark:"Mi",color:"#ff6900"},
    {pattern:/^Muse\b/i,name:"Meta",mark:"∞",color:"#1682f5"},
    {pattern:/^Grok\b/i,name:"xAI",mark:"X",color:"#687079"},
    {pattern:/^Hy[34]\b/i,name:"Tencent",mark:"T",color:"#2698d7"},
    {pattern:/^GLM\b/i,name:"Z.ai",mark:"Z",color:"#6264d9"},
    {pattern:/^Kimi\b/i,name:"Moonshot AI",mark:"K",color:"#697896"},
    {pattern:/^Qwen/i,name:"Alibaba",mark:"Q",color:"#ff6a00"},
    {pattern:/^Step\b/i,name:"StepFun",mark:"S",color:"#8756d8"},
    {pattern:/^MiniMax\b/i,name:"MiniMax",mark:"MM",color:"#737a87"},
    {pattern:/^(Mistral|Devstral)\b/i,name:"Mistral AI",mark:"M",color:"#f47721"},
    {pattern:/^(NVIDIA|Nemotron)\b/i,name:"NVIDIA",mark:"N",color:"#76b900"},
    {pattern:/^Inkling/i,name:"Thinking Machines",mark:"TM",color:"#a85ed1"},
    {pattern:/^Solar\b/i,name:"Upstage",mark:"U",color:"#1c9291"},
    {pattern:/^Spark-X/i,name:"Synlan",mark:"SX",color:"#ab5cbc"},
    {pattern:/^U2\b/i,name:"Unisound",mark:"U2",color:"#7961d8"},
    {pattern:/^Seed/i,name:"ByteDance",mark:"B",color:"#4c708c"},
    {pattern:/^Laguna\b/i,name:"Poolside",mark:"P",color:"#468d8f"},
    {pattern:/^Trinity\b/i,name:"Arcee AI",mark:"Ar",color:"#a24d94"},
    {pattern:/^Granite\b/i,name:"IBM",mark:"IB",color:"#376bd6"},
    {pattern:/^Beam\b/i,name:"Reflection AI",mark:"R",color:"#718087"},
    {pattern:/^KAT-Coder/i,name:"Kwaipilot",mark:"K",color:"#9a6366"},
    {pattern:/^Mercury\b/i,name:"Inception",mark:"I",color:"#9070ad"},
  ];
  const getBrand = (model) => brands.find((b) => b.pattern.test(model)) || {name:"Other",mark:"?",color:"#718087"};
  const make = (tag,attrs={},text="") => {const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;return el;};
  const costText = (n) => Number.isFinite(n) ? `$${n.toFixed(2)}` : "N/A";
  let data=[], plotted=[], frontier=[], selected=new Set(), placements=new Map(), view=null, dims={width:1,height:1};
  let pointers=new Map(), dragOrigin=null, pinchDistance=0, pointerMoved=false, tapItem=null, tableFrontier=false;
  const xPos = (n) => scene.left+(Math.log10(n)-scene.minLog)/(scene.maxLog-scene.minLog)*(scene.right-scene.left);
  const yPos = (n) => scene.bottom-(n-scene.minScore)/(scene.maxScore-scene.minScore)*(scene.bottom-scene.top);
  const onFrontier = (r) => frontier.some((x) => x.rank===r.rank);
  function showItem(r) {tooltip.textContent=`${r.model} · ${getBrand(r.model).name} · WebDev rank ${r.rank} · ${r.score.toLocaleString("en-US")} rating · ${costText(r.cost)} per task${onFrontier(r)?" · Arena Pareto frontier":""}`;}
  function positionLabels(items) {
    const result=new Map(), occupied=[], height=60, gap=10;
    const ordered=[...items].sort((a,b)=>Number(onFrontier(b))-Number(onFrontier(a))||a.rank-b.rank);
    for(const item of ordered){
      const px=xPos(item.cost),py=yPos(item.score),width=Math.max(245,80+item.model.length*16.5);
      const xs=[px+25,px-width-25,px+260,px-width-260,px+570,px-width-570];let chosen=null;
      for(const rawX of xs){
        const xx=Math.max(scene.left+5,Math.min(scene.right-width-5,rawX));
        for(let row=0;row<65 && !chosen;row++)for(const sign of row?[-1,1]:[1]){
          const yy=Math.max(scene.top+5,Math.min(scene.bottom-height-5,py-height/2+sign*row*(height+gap)));
          const box={x:xx,y:yy,width,height};
          const overlap=occupied.some(o=>box.x<o.x+o.width+gap && box.x+box.width+gap>o.x && box.y<o.y+o.height+gap && box.y+box.height+gap>o.y);
          if(!overlap){chosen=box;break;}
        }
        if(chosen)break;
      }
      if(!chosen)chosen={x:Math.max(scene.left+5,Math.min(scene.right-width-5,px+25)),y:Math.max(scene.top+5,Math.min(scene.bottom-height-5,py-height/2)),width,height};
      occupied.push(chosen);result.set(item.rank,chosen);
    }
    return result;
  }
  function drawScene() {
    svg.replaceChildren();
    svg.append(make("title",{},"WebDev Arena rating versus median cost per task"));
    svg.append(make("rect",{x:0,y:0,width:scene.width,height:scene.height,fill:"#111a21"}));
    for(const tick of [.01,.03,.1,.3,1,3,10]){
      const x=xPos(tick);svg.append(make("line",{x1:x,y1:scene.top,x2:x,y2:scene.bottom,stroke:"#36434b","stroke-width":3}));
      svg.append(make("text",{x,y:scene.bottom+70,fill:"#becbcb","font-size":39,"text-anchor":"middle"},tick<1?`$${tick.toFixed(2)}`:`$${tick}`));
    }
    for(let tick=1100;tick<=1900;tick+=100){
      const y=yPos(tick);svg.append(make("line",{x1:scene.left,y1:y,x2:scene.right,y2:y,stroke:"#36434b","stroke-width":3}));
      svg.append(make("text",{x:scene.left-28,y:y+13,fill:"#becbcb","font-size":39,"text-anchor":"end"},String(tick)));
    }
    svg.append(make("text",{x:(scene.left+scene.right)/2,y:scene.height-85,fill:"#d0d8d7","font-size":46,"text-anchor":"middle"},"Median cost per task (USD · log scale)"));
    svg.append(make("text",{x:100,y:(scene.top+scene.bottom)/2,fill:"#d0d8d7","font-size":46,"text-anchor":"middle",transform:`rotate(-90 100 ${(scene.top+scene.bottom)/2})`},"WebDev Arena rating"));
    const path=[...frontier].reverse().map(r=>`${xPos(r.cost)},${yPos(r.score)}`).join(" ");
    svg.append(make("polyline",{points:path,fill:"none",stroke:"#a9e45b","stroke-width":8,"stroke-linecap":"round","stroke-linejoin":"round"}));
    for(const r of plotted){
      const b=getBrand(r.model),box=placements.get(r.rank),px=xPos(r.cost),py=yPos(r.score),active=selected.has(b.name),muted=selected.size>0&&!active;
      const group=make("g",{class:"model-label webdev-model","data-rank":r.rank,"data-developer":b.name,tabindex:0,role:"button",opacity:muted ? .35 : 1,"aria-label":`${r.model}, ${b.name}, rank ${r.rank}, rating ${r.score}, ${costText(r.cost)} per task`});
      group.append(make("line",{x1:px,y1:py,x2:Math.max(box.x,Math.min(box.x+box.width,px)),y2:box.y+box.height/2,stroke:"#768990","stroke-width":3}));
      group.append(make("circle",{cx:px,cy:py,r:13,fill:b.color,stroke:onFrontier(r)?"#b7e66b":"#edf3f0","stroke-width":5}));
      group.append(make("rect",{class:"label-bg",x:box.x,y:box.y,width:box.width,height:box.height,rx:11,fill:"#24333a",stroke:onFrontier(r)?"#a9e45b":"#4b5d63","stroke-width":onFrontier(r)?3:2}));
      group.append(make("circle",{cx:box.x+29,cy:box.y+30,r:20,fill:b.color}));
      group.append(make("text",{x:box.x+29,y:box.y+37,fill:"#fff","font-size":b.mark.length>1?18:25,"font-weight":800,"text-anchor":"middle"},b.mark));
      group.append(make("text",{x:box.x+56,y:box.y+40,fill:"#f4f7f6","font-size":30,"font-weight":700},r.model));
      group.addEventListener("focus",()=>showItem(r));group.addEventListener("mouseenter",()=>showItem(r));
      group.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();showItem(r);}});
      svg.append(group);
    }
  }
  function renderChips(){
    const counts=new Map();for(const r of plotted){const b=getBrand(r.model);counts.set(b.name,(counts.get(b.name)||0)+1);}
    const holder=$("webdev-developer-chips");holder.replaceChildren();
    const all=document.createElement("button");all.type="button";all.className="developer-chip";all.textContent="All developers";all.setAttribute("aria-pressed","true");all.addEventListener("click",()=>{selected.clear();applyHighlights();});holder.append(all);
    for(const [name,count] of [...counts].sort((a,b)=>a[0].localeCompare(b[0]))){
      const brand=brands.find(b=>b.name===name)||{mark:"?",color:"#718087"},button=document.createElement("button"),mark=document.createElement("span"),label=document.createElement("span"),badge=document.createElement("span");
      button.type="button";button.className="developer-chip";button.dataset.developer=name;button.setAttribute("aria-pressed","false");button.setAttribute("aria-label",`Highlight ${name}, ${count} models`);
      mark.className="developer-chip-mark";mark.style.setProperty("--chip-color",brand.color);mark.textContent=brand.mark;mark.setAttribute("aria-hidden","true");
      label.textContent=name;badge.className="developer-chip-count";badge.textContent=count;badge.setAttribute("aria-hidden","true");button.append(mark,label,badge);
      button.addEventListener("click",()=>{if(selected.has(name))selected.delete(name);else selected.add(name);applyHighlights();});holder.append(button);
    }
    applyHighlights();
  }
  function applyHighlights(){
    $("webdev-developer-chips").querySelectorAll("button").forEach((b)=>b.setAttribute("aria-pressed",String(b.dataset.developer?selected.has(b.dataset.developer):selected.size===0)));
    svg.querySelectorAll(".webdev-model").forEach((g)=>g.setAttribute("opacity",String(selected.size && !selected.has(g.dataset.developer) ? .35 : 1)));
    $("webdev-highlight-status").textContent=selected.size?`Highlighting ${[...selected].join(", ")} · ${plotted.filter(r=>selected.has(getBrand(r.model).name)).length} models`:`${plotted.length} models across ${new Set(plotted.map(r=>getBrand(r.model).name)).size} developers · choose a developer to highlight`;
  }
  function renderRows(){
    const query=$("webdev-search").value.trim().toLocaleLowerCase(),sort=$("webdev-sort").value;
    let rows=data.filter(r=>(!tableFrontier||onFrontier(r))&&(r.model.toLocaleLowerCase().includes(query)||getBrand(r.model).name.toLocaleLowerCase().includes(query)));
    if(sort==="score")rows.sort((a,b)=>b.score-a.score||a.rank-b.rank);
    else if(sort==="cost")rows.sort((a,b)=>(Number.isFinite(a.cost)?a.cost:Infinity)-(Number.isFinite(b.cost)?b.cost:Infinity)||a.rank-b.rank);
    else rows.sort((a,b)=>a.rank-b.rank);
    const body=$("webdev-rows");body.replaceChildren();
    for(const r of rows){
      const tr=document.createElement("tr"),rank=document.createElement("td"),name=document.createElement("td"),score=document.createElement("td"),cost=document.createElement("td");
      rank.className="rank-cell";rank.textContent=r.rank;name.className="model-cell";name.append(document.createTextNode(r.model+" "));
      if(onFrontier(r)){const badge=document.createElement("span");badge.className="frontier-pill";badge.textContent="FRONTIER";name.append(badge);}
      const brand=document.createElement("span");brand.className="model-small";brand.textContent=getBrand(r.model).name;name.append(brand);
      score.className="number-cell";score.dataset.label="WebDev rating";score.textContent=r.score.toLocaleString("en-US");
      cost.className="number-cell";cost.dataset.label="Median cost / task";cost.textContent=costText(r.cost);tr.append(rank,name,score,cost);body.append(tr);
    }
    $("webdev-row-count").textContent=`${rows.length} of ${data.length} ranked models`;$("webdev-empty").style.display=rows.length?"none":"block";
  }
  function metrics(){const r=svg.getBoundingClientRect();return {width:Math.max(1,r.width),height:Math.max(1,r.height)};}
  function clamp(v){
    const aspect=dims.width/dims.height,fitW=Math.max(scene.width,scene.height*aspect),w=Math.max(250,Math.min(fitW,v.w)),h=w/aspect;
    let cx=v.x+v.w/2,cy=v.y+v.h/2;cx=w>=scene.width?scene.width/2:Math.max(w/2,Math.min(scene.width-w/2,cx));cy=h>=scene.height?scene.height/2:Math.max(h/2,Math.min(scene.height-h/2,cy));
    return {x:cx-w/2,y:cy-h/2,w,h};
  }
  function display(){svg.setAttribute("viewBox",[view.x,view.y,view.w,view.h].join(" "));}
  function fit(){dims=metrics();const w=Math.max(scene.width,scene.height*dims.width/dims.height),h=w*dims.height/dims.width;view=clamp({x:(scene.width-w)/2,y:(scene.height-h)/2,w,h});display();}
  function initial(){dims=metrics();const w=dims.width<600?1900:3400,h=w*dims.height/dims.width;view=clamp({x:xPos(.45)-w/2,y:yPos(1640)-h/2,w,h});display();}
  function zoom(factor,px=dims.width/2,py=dims.height/2){if(!view)return;const ax=view.x+px/dims.width*view.w,ay=view.y+py/dims.height*view.h;view=clamp({x:ax+(view.x-ax)*factor,y:ay+(view.y-ay)*factor,w:view.w*factor,h:view.h*factor});display();}
  function pan(dx,dy,start){view=clamp({...start,x:start.x-dx/dims.width*start.w,y:start.y-dy/dims.height*start.h});display();}
  function itemAt(e){const n=e.target.closest?.("[data-rank]");return n?data.find(r=>r.rank===Number(n.getAttribute("data-rank"))):null;}
  svg.addEventListener("pointerdown",e=>{if(!view)return;e.preventDefault();tapItem=itemAt(e);svg.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pointerMoved=false;if(pointers.size===1)dragOrigin={x:e.clientX,y:e.clientY,view:{...view}};if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);dragOrigin=null;}});
  svg.addEventListener("pointermove",e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),rect=svg.getBoundingClientRect();if(pinchDistance&&d){zoom(pinchDistance/d,(p[0].x+p[1].x)/2-rect.left,(p[0].y+p[1].y)/2-rect.top);pointerMoved=true;}pinchDistance=d;}else if(dragOrigin){const dx=e.clientX-dragOrigin.x,dy=e.clientY-dragOrigin.y;if(Math.abs(dx)+Math.abs(dy)>3)pointerMoved=true;if(pointerMoved)pan(dx,dy,dragOrigin.view);}});
  function end(e){const pinching=pointers.size>1;pointers.delete(e.pointerId);if(pointers.size===1){const p=[...pointers.values()][0];dragOrigin={x:p.x,y:p.y,view:{...view}};pinchDistance=0;}else if(!pointers.size){if(!pointerMoved&&!pinching&&tapItem)showItem(tapItem);dragOrigin=null;pinchDistance=0;tapItem=null;}}
  svg.addEventListener("pointerup",end);svg.addEventListener("pointercancel",end);
  svg.addEventListener("wheel",e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const rect=svg.getBoundingClientRect();zoom(e.deltaY<0?.84:1.19,e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
  svg.addEventListener("dblclick",e=>{e.preventDefault();if(view)fit();});
  $("webdev-zoom-in").addEventListener("click",()=>zoom(.72));$("webdev-zoom-out").addEventListener("click",()=>zoom(1.38));$("webdev-zoom-reset").addEventListener("click",()=>{if(view)fit();});
  $("webdev-search").addEventListener("input",renderRows);$("webdev-sort").addEventListener("change",renderRows);
  $("webdev-frontier-toggle").addEventListener("click",e=>{tableFrontier=!tableFrontier;e.currentTarget.setAttribute("aria-pressed",String(tableFrontier));renderRows();});
  fetch("./webdev-data.json?v=20261118").then(r=>{if(!r.ok)throw new Error("WebDev snapshot could not load.");return r.json();}).then(snapshot=>{
    data=snapshot.records;plotted=data.filter(r=>Number.isFinite(r.cost)&&r.cost>0&&Number.isFinite(r.score));
    frontier=snapshot.sourceFrontier.map(name=>plotted.find(r=>r.model===name)).filter(Boolean);
    if(frontier.length!==snapshot.sourceFrontier.length)throw new Error("The source frontier could not be matched to the snapshot.");
    placements=positionLabels(plotted);drawScene();renderChips();renderRows();initial();
    $("webdev-snapshot").textContent=`Board: ${snapshot.boardDate} · captured ${snapshot.capturedAt} · ${plotted.length} plotted · ${snapshot.withoutCost} ranked models without cost`;
    new ResizeObserver(()=>{if(!view)return;const old=dims;dims=metrics();if(old.width!==dims.width||old.height!==dims.height){const cx=view.x+view.w/2,cy=view.y+view.h/2,h=view.w*dims.height/dims.width;view=clamp({x:cx-view.w/2,y:cy-h/2,w:view.w,h});display();}}).observe(wrap);
  }).catch(e=>{$("webdev-snapshot").textContent=e.message;tooltip.textContent="Open the Arena WebDev source for the current leaderboard.";});
})();
