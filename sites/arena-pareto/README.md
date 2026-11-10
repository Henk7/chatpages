# Agent Pareto Explorer

A lightweight, mobile-friendly chart built from Arena AI's public Agent Arena Pareto view.

## Snapshot

- Source: <https://arena.ai/leaderboard/agent/pareto>
- Arena board date: November 8, 2026
- Captured: November 10, 2026
- Cost selector: median / 50th percentile, last 14 days
- Board size: 57 models; 53 models with task costs are plotted
- Sessions displayed by Arena: 2,750,973

Arena still showed its November 8 Agent Arena board on November 10. The 53 plotted cost and improvement values were captured from the live 50th-percentile, last-14-days view. Four board models had no task-cost row and are not plotted.

Claude Fable 5.2 is featured in Arena's WebDev rankings, but it has no cost or net-improvement row in this Agent Arena snapshot; it is not plotted. The snapshot includes Claude Fable 5.1 (Max). WebDev and Agent Arena measure different model use cases, so their rankings and scores are not interchangeable. See the [Arena WebDev leaderboard](https://arena.ai/leaderboard/code/webdev).

## Chart controls

- Drag to move around the large SVG chart; every model name and provider mark stays in place as you zoom.
- Pinch or use the +/- buttons to zoom on touch screens.
- Use Ctrl+scroll on desktop or double-click / Fit to see the full chart.
- Highlight developers with the chips above the chart. Select multiple developers to highlight their labels while keeping every model visible; choose “All developers” to clear the highlights.
- Search and sort the model list; filter down to the frontier.
- Download the captured values as CSV.

Provider artwork is embedded inline: Simple Icons SVGs (CC0) where available, with colored initials for providers without an icon in that set.

The explorer is an independent reproduction of public Arena data and is not affiliated with Arena.
