(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const svg = $("duel-plot");
  const tooltip = $("duel-tooltip");
  const wrap = document.querySelector(".duel-chart-wrap");
  const NS = "http://www.w3.org/2000/svg";
  const scene = { width: 2000, height: 1280, left: 220, right: 1770, top: 150, bottom: 1070 };
  const brands = {
    "Anthropic": {mark: "A", color: "#d87954"},
    "OpenAI": {mark: "O", color: "#12806a"},
    "Moonshot AI": {mark: "K", color: "#647499"},
    "DeepSeek": {mark: "D", color: "#5478ed"},
    "Google": {mark: "G", color: "#4285f4"},
    "Meta": {mark: "∞", color: "#1682f5"},
    "Xiaomi": {mark: "Mi", color: "#ff6900"},
    "xAI": {mark: "X", color: "#656b72"},
    "Qwen": {mark: "Q", color: "#f37b35"}
  };
  let records = [], frontier = [], view = null, dims = {width: 1, height: 1};
  let pointers = new Map(), dragOrigin = null, pinchDistance = 0, pointerMoved = false, tapItem = null;

  function node(tag, attrs = {}, text = "") {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    if (text) el.textContent = text;
    return el;
  }
  const costLabel = (n) => `$${n.toFixed(2)}`;
  const recordLabel = (item) => `${item.model} · ${item.provider} · ${item.provisional ? "provisional" : `rank ${item.rank}`} · Elo ${item.elo} (+${item.ciPlus}/−${item.ciMinus}, 95% CI) · ${costLabel(item.cost)} / task · ${item.minutes.toFixed(1)} min / task`;
  function showItem(item) { tooltip.textContent = recordLabel(item) + (frontier.includes(item) ? " · Pareto frontier" : ""); }

  // Match AgentDuel's ranked Pareto chart: provisional estimates do not set the frontier.
  function computeFrontier(items) {
    let best = -Infinity;
    return items.filter((item) => !item.provisional)
      .sort((a, b) => a.cost - b.cost || b.elo - a.elo)
      .filter((item) => { if (item.elo <= best) return false; best = item.elo; return true; });
  }
  function metrics() {
    const rect = svg.getBoundingClientRect();
    return {width: Math.max(1, rect.width), height: Math.max(1, rect.height)};
  }
  function clampView(next) {
    const aspect = dims.width / dims.height;
    const fitWidth = Math.max(scene.width, scene.height * aspect);
    const w = Math.max(180, Math.min(fitWidth, next.w));
    const h = w / aspect;
    let cx = next.x + next.w / 2, cy = next.y + next.h / 2;
    cx = w >= scene.width ? scene.width / 2 : Math.max(w / 2, Math.min(scene.width - w / 2, cx));
    cy = h >= scene.height ? scene.height / 2 : Math.max(h / 2, Math.min(scene.height - h / 2, cy));
    return {x: cx - w / 2, y: cy - h / 2, w, h};
  }
  function drawView() { svg.setAttribute("viewBox", [view.x, view.y, view.w, view.h].join(" ")); }
  function fit() {
    dims = metrics();
    const w = Math.max(scene.width, scene.height * dims.width / dims.height), h = w * dims.height / dims.width;
    view = clampView({x: (scene.width - w) / 2, y: (scene.height - h) / 2, w, h});
    drawView();
  }
  function zoom(factor, px = dims.width / 2, py = dims.height / 2) {
    if (!view) return;
    const ax = view.x + px / dims.width * view.w, ay = view.y + py / dims.height * view.h;
    view = clampView({x: ax + (view.x - ax) * factor, y: ay + (view.y - ay) * factor, w: view.w * factor, h: view.h * factor});
    drawView();
  }
  function pan(dx, dy, start) {
    view = clampView({...start, x: start.x - dx / dims.width * start.w, y: start.y - dy / dims.height * start.h});
    drawView();
  }
  function positionLabels(items, x, y) {
    const boxes = [], result = new Map(), gap = 8, height = 44;
    // Give frontier models first choice of label positions without hiding any other model.
    const order = [...items].sort((a, b) => Number(frontier.includes(b)) - Number(frontier.includes(a)) || b.elo - a.elo);
    for (const item of order) {
      const px = x(item.cost), py = y(item.elo), width = Math.max(235, 66 + item.model.length * 12);
      const options = [px + 18, px - width - 18];
      let selected = null;
      for (const desiredX of options) {
        for (let row = 0; row < 22 && !selected; row++) {
          for (const sign of row ? [-1, 1] : [1]) {
            const box = {
              x: Math.max(scene.left + 3, Math.min(scene.right - width - 3, desiredX)),
              y: Math.max(scene.top + 3, Math.min(scene.bottom - height - 3, py - height / 2 + sign * row * (height + gap))),
              width, height
            };
            const overlap = boxes.some((other) => box.x < other.x + other.width + gap && box.x + box.width + gap > other.x && box.y < other.y + other.height + gap && box.y + box.height + gap > other.y);
            if (!overlap) { selected = box; break; }
          }
        }
        if (selected) break;
      }
      selected ||= {x: Math.max(scene.left + 3, Math.min(scene.right - width - 3, px + 18)), y: Math.max(scene.top + 3, Math.min(scene.bottom - height - 3, py - height / 2)), width, height};
      boxes.push(selected);
      result.set(item.model, selected);
    }
    return result;
  }
  function drawChart() {
    svg.replaceChildren();
    const logMin = Math.log10(0.01), logMax = Math.log10(10);
    const lo = Math.floor((Math.min(...records.map((r) => r.elo)) - 35) / 50) * 50;
    const hi = Math.ceil((Math.max(...records.map((r) => r.elo)) + 35) / 50) * 50;
    const x = (n) => scene.left + (Math.log10(n) - logMin) / (logMax - logMin) * (scene.right - scene.left);
    const y = (n) => scene.bottom - (n - lo) / (hi - lo) * (scene.bottom - scene.top);
    svg.append(node("title", {}, "AgentDuel Elo versus median cost per task"));
    svg.append(node("rect", {x: 0, y: 0, width: scene.width, height: scene.height, fill: "#111a21"}));
    for (const tick of [0.01, 0.03, 0.1, 0.3, 1, 3, 10]) {
      const px = x(tick);
      svg.append(node("line", {x1: px, y1: scene.top, x2: px, y2: scene.bottom, stroke: "#36434b", "stroke-width": 2}));
      svg.append(node("text", {x: px, y: scene.bottom + 42, fill: "#becbcb", "font-size": 23, "text-anchor": "middle"}, tick < 1 ? `$${tick.toFixed(2)}` : `$${tick}`));
    }
    for (let tick = lo; tick <= hi; tick += 50) {
      const py = y(tick);
      svg.append(node("line", {x1: scene.left, y1: py, x2: scene.right, y2: py, stroke: "#36434b", "stroke-width": 2}));
      svg.append(node("text", {x: scene.left - 19, y: py + 8, fill: "#becbcb", "font-size": 23, "text-anchor": "end"}, String(tick)));
    }
    svg.append(node("text", {x: (scene.left + scene.right) / 2, y: 1198, fill: "#d0d8d7", "font-size": 27, "text-anchor": "middle"}, "Battle-adjusted median cost per task (USD · log scale)"));
    svg.append(node("text", {x: 65, y: (scene.top + scene.bottom) / 2, fill: "#d0d8d7", "font-size": 27, "text-anchor": "middle", transform: `rotate(-90 65 ${(scene.top + scene.bottom) / 2})`}, "AgentDuel Elo"));
    svg.append(node("polyline", {points: frontier.map((r) => `${x(r.cost)},${y(r.elo)}`).join(" "), fill: "none", stroke: "#a9e45b", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round"}));
    const positions = positionLabels(records, x, y);
    for (const [index, item] of records.entries()) {
      const px = x(item.cost), py = y(item.elo), box = positions.get(item.model), brand = brands[item.provider] || {mark: "?", color: "#718087"};
      const group = node("g", {class: "model-label", "data-index": index, tabindex: 0, role: "button", "aria-label": recordLabel(item)});
      group.append(node("line", {x1: px, y1: py, x2: Math.max(box.x, Math.min(box.x + box.width, px)), y2: box.y + box.height / 2, stroke: "#768990", "stroke-width": 2}));
      group.append(node("circle", {cx: px, cy: py, r: 10, fill: brand.color, stroke: item.provisional ? "#d8a5ff" : frontier.includes(item) ? "#b7e66b" : "#eaf1ef", "stroke-width": 4, ...(item.provisional ? {"stroke-dasharray": "5 3"} : {})}));
      group.append(node("rect", {class: "label-bg", x: box.x, y: box.y, width: box.width, height: box.height, rx: 9, fill: "#24333a", stroke: item.provisional ? "#c58cea" : "#4b5d63", "stroke-width": 2, ...(item.provisional ? {"stroke-dasharray": "7 4"} : {})}));
      group.append(node("circle", {cx: box.x + 22, cy: box.y + 22, r: 15, fill: brand.color}));
      group.append(node("text", {x: box.x + 22, y: box.y + 28, fill: "#fff", "font-size": brand.mark.length > 1 ? 14 : 18, "font-weight": 800, "text-anchor": "middle"}, brand.mark));
      group.append(node("text", {x: box.x + 44, y: box.y + 29, fill: "#f4f7f6", "font-size": 23, "font-weight": 700}, item.model));
      const show = () => showItem(item);
      group.addEventListener("focus", show);
      group.addEventListener("mouseenter", show);
      group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); show(); } });
      svg.append(group);
    }
  }
  function renderTable() {
    const body = $("duel-rows");
    body.replaceChildren();
    for (const item of records) {
      const tr = document.createElement("tr");
      const rank = document.createElement("td"); rank.className = "rank-cell"; rank.textContent = item.rank ?? "—";
      const name = document.createElement("td"); name.className = "model-cell";
      name.append(document.createTextNode(item.model + " "));
      if (item.provisional || frontier.includes(item)) {
        const badge = document.createElement("span"); badge.className = `frontier-pill${item.provisional ? " provisional" : ""}`;
        badge.textContent = item.provisional ? "PROVISIONAL" : "FRONTIER"; name.append(badge);
      }
      const provider = document.createElement("span"); provider.className = "model-small"; provider.textContent = item.provider; name.append(provider);
      function value(label, text) { const td = document.createElement("td"); td.className = "number-cell"; td.dataset.label = label; td.textContent = text; return td; }
      tr.append(rank, name, value("Elo · 95% CI", `${item.elo} +${item.ciPlus}/−${item.ciMinus}`), value("Median cost / task", costLabel(item.cost)), value("Median time / task", `${item.minutes.toFixed(1)} min`));
      body.append(tr);
    }
  }
  function itemAt(event) { const target = event.target.closest?.("[data-index]"); return target ? records[Number(target.getAttribute("data-index"))] : null; }
  svg.addEventListener("pointerdown", (event) => {
    if (!view) return;
    event.preventDefault(); tapItem = itemAt(event); svg.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY}); pointerMoved = false;
    if (pointers.size === 1) dragOrigin = {x: event.clientX, y: event.clientY, view: {...view}};
    if (pointers.size === 2) { const p = [...pointers.values()]; pinchDistance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); dragOrigin = null; }
  });
  svg.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (pointers.size >= 2) {
      const p = [...pointers.values()], distance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), rect = svg.getBoundingClientRect();
      if (pinchDistance && distance) { zoom(pinchDistance / distance, (p[0].x + p[1].x) / 2 - rect.left, (p[0].y + p[1].y) / 2 - rect.top); pointerMoved = true; }
      pinchDistance = distance;
    } else if (dragOrigin) {
      const dx = event.clientX - dragOrigin.x, dy = event.clientY - dragOrigin.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) pointerMoved = true;
      if (pointerMoved) pan(dx, dy, dragOrigin.view);
    }
  });
  function endPointer(event) {
    const wasPinching = pointers.size > 1; pointers.delete(event.pointerId);
    if (pointers.size === 1) { const p = [...pointers.values()][0]; dragOrigin = {x: p.x, y: p.y, view: {...view}}; pinchDistance = 0; }
    else if (!pointers.size) { if (!pointerMoved && !wasPinching && tapItem) showItem(tapItem); dragOrigin = null; pinchDistance = 0; tapItem = null; }
  }
  svg.addEventListener("pointerup", endPointer); svg.addEventListener("pointercancel", endPointer);
  svg.addEventListener("wheel", (event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); const r = svg.getBoundingClientRect(); zoom(event.deltaY < 0 ? .84 : 1.19, event.clientX - r.left, event.clientY - r.top); }, {passive: false});
  svg.addEventListener("dblclick", (event) => { event.preventDefault(); if (view) fit(); });
  $("duel-zoom-in").addEventListener("click", () => zoom(.72));
  $("duel-zoom-out").addEventListener("click", () => zoom(1.38));
  $("duel-zoom-reset").addEventListener("click", () => { if (view) fit(); });

  fetch("./agentduel-data.json?v=20261117")
    .then((response) => { if (!response.ok) throw new Error("AgentDuel snapshot could not load."); return response.json(); })
    .then((data) => {
      records = data.records.filter((r) => Number.isFinite(r.elo) && Number.isFinite(r.cost) && r.cost > 0);
      if (!records.length) throw new Error("AgentDuel snapshot contains no plottable records.");
      frontier = computeFrontier(records);
      $("duel-snapshot").textContent = `Source generated ${data.generatedLabel} · ${records.filter((r) => !r.provisional).length} ranked models · ${records.filter((r) => r.provisional).length} provisional`;
      drawChart(); renderTable(); fit();
      new ResizeObserver(() => { if (!view) return; const old = dims; dims = metrics(); if (old.width !== dims.width || old.height !== dims.height) { const cx = view.x + view.w / 2, cy = view.y + view.h / 2; const h = view.w * dims.height / dims.width; view = clampView({x: cx - view.w / 2, y: cy - h / 2, w: view.w, h}); drawView(); } }).observe(wrap);
    })
    .catch((error) => { $("duel-snapshot").textContent = error.message; tooltip.textContent = "Open the source leaderboard for the latest data."; });
})();
