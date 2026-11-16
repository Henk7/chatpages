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
