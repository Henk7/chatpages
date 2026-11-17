# Agent Pareto Explorer

A lightweight, mobile-friendly chart built from Arena AI's public Agent Arena Pareto view.

## Snapshot

- Source: <https://arena.ai/leaderboard/agent/pareto>
- Arena board date displayed: November 13, 2026
- Captured: November 16, 2026
- Cost selector: median / 50th percentile, last 14 days
- Board size: 65 models; 61 models with task costs are plotted
- Sessions displayed by Arena: 2,979,271

The 61 plotted cost and improvement values were captured from Arena's 50th-percentile, last-14-days view. Four board models had no task-cost row and are not plotted. Arena's measurements can change as its leaderboard updates.

Qwen4-Max (xHigh) is included at rank 14: +7.46% net improvement and $1.47 median cost per task. Arena marks this result as preliminary.

## Chart controls

- Drag to move around the large SVG chart; every model name and provider mark stays in place as you zoom.
- Pinch or use the +/- buttons to zoom on touch screens.
- Use Ctrl+scroll on desktop or double-click / Fit to see the full chart.
- Highlight developers with the chips above the chart. Select multiple developers to highlight their labels while keeping every model visible; choose “All developers” to clear the highlights.
- Search and sort the model list; filter down to the frontier.
- Download the captured values as CSV.

Provider artwork is embedded inline: Simple Icons SVGs (CC0) where available, with colored initials for providers without an icon in that set.

The explorer is an independent reproduction of public Arena data and is not affiliated with Arena.

## AgentDuel comparison

The separate AgentDuel chart uses the public <https://agentduel.com/leaderboard>
snapshot generated November 17, 2026, 18:00 UTC. Its y-axis is AgentDuel's
head-to-head Elo, not Arena's net improvement. Cost and time are the source's
battle-adjusted medians. The point estimates and 95% Elo intervals are copied
as displayed by AgentDuel.

- `agentduel-data.json` contains the dated model snapshot, including ranked
  and provisional models. Qwen 4 Max is provisional in this snapshot.
- `agentduel.js` draws a second independent, pannable and zoomable SVG and
  builds its table. The frontier is calculated only from ranked models, just
  as on AgentDuel; provisional models are visible but do not set the line.
- To refresh it, capture a single current leaderboard generation; update its
  timestamp and all model values, retaining provisional status and missing
  values faithfully. Bump the `agentduel-data.json` cache version in
  `agentduel.js` and the `agentduel.js` cache version in `index.html`.
  Verify the frontier against the corresponding AgentDuel median-cost view.
- These are dated snapshots, not automatic live feeds. The two benchmarks use
  different tasks and scores and should not be interpreted as a shared scale.
