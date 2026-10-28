# Agent Pareto Explorer

A lightweight, mobile-friendly chart built from Arena AI's public Agent Arena Pareto view.

## Snapshot

- Source: <https://arena.ai/leaderboard/agent/pareto>
- Arena page date: October 23, 2026
- Captured: October 26, 2026
- Cost selector: median / 50th percentile, last 14 days
- Board size displayed by Arena: 55 models; the cost view listed 51 models with costs
- Sessions displayed by Arena: 2,557,423

Arena still showed its October 23 board snapshot on October 26; the task-cost values were re-captured from the live 50th-percentile, last-14-days view.

The CSV download contains the 51 rows from the October 23 snapshot plus GPT-6.1 Terra (Max), added from Arena's October 27 board (rank 7, $0.63/task, +11.14%). Four models on the October 23 board were not listed with task costs in that view, so they are not plotted. The chart therefore combines data from two board dates rather than one synchronized snapshot. Arena's measurements can change as the leaderboard updates.

## Chart controls

- Drag to move around the large SVG chart; every model name and provider mark stays in place as you zoom.
- Pinch or use the +/- buttons to zoom on touch screens.
- Use Ctrl+scroll on desktop or double-click / Fit to see the full chart.
- Highlight developers with the chips above the chart. Select multiple developers to highlight their labels while keeping every model visible; choose “All developers” to clear the highlights.
- Search and sort the model list; filter down to the frontier.
- Download the captured values as CSV.

Provider artwork is embedded inline: Simple Icons SVGs (CC0) where available, with colored initials for providers without an icon in that set.

The explorer is an independent reproduction of the public data and is not affiliated with Arena.
