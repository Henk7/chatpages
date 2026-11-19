# AI Pareto Explorer

A mobile-friendly explorer of dated snapshots from Arena Agent, AgentDuel and Arena WebDev. Each benchmark uses its own score scale.

## Agent Arena snapshot

- Source: <https://arena.ai/leaderboard/agent/pareto>
- Arena board date: November 18, 2026; captured November 19, 2026, 07:08 CET
- Metric: Agent Arena Index, plotted against median task cost (50th percentile, last 14 days)
- 68 ranked models; 64 with task costs are plotted; four without a cost remain in the table as N/A
- Sessions displayed by Arena: 3,093,488

Arena has replaced the earlier net-improvement percentage with the Agent Arena Index; the two metrics are not interchangeable. `data.json` stores the complete ranked table, preliminary status and the source-published cost frontier. Frontier membership is preserved from Arena instead of inferred from values rounded on screen. GPT-6.2 Astra and Sol are included, and Sol is on the source frontier.

To refresh, capture all rows and the frontier from a single consistent 50th-percentile view. Preserve missing and preliminary values, update dates and sessions, then bump the data cache version in `index.html` and validate the chart and CSV. These are snapshots, not a live feed.

## Chart controls

- Drag to move around the large SVG chart; every plotted model name and provider mark stays in the scene as you zoom.
- Pinch or use the +/- buttons to zoom on touch screens.
- Use Ctrl+scroll on desktop or double-click / Fit to see the full chart.
- Use Full screen to expand each chart to the whole display.
- Highlight developers with the chips above the chart. Select multiple developers to highlight their labels while keeping every model visible; choose “All developers” to clear the highlights.
- Search and sort the model list; filter down to the frontier.
- Download the Agent ranking, including missing costs, as CSV.

Provider artwork is embedded inline: Simple Icons SVGs (CC0) where available, with colored initials for providers without an icon in that set.

The explorer is an independent reproduction of public Arena and AgentDuel data and is not affiliated with either source.

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
- These are dated snapshots, not automatic live feeds. The benchmarks use
  different tasks and scores and should not be interpreted as a shared scale.

## WebDev comparison

The third chart is a separate Arena WebDev overall leaderboard snapshot from
November 18, 2026, captured at 21:04 Central European Time. It compares Arena's
WebDev ratings with the published median task costs; it does not put WebDev
ratings on the Agent Arena or AgentDuel score scales.

- `webdev-data.json` contains all 160 ranked models: 111 have published costs
  and are plotted, while the other 49 remain in the searchable table as N/A.
  Arena also lists one unranked AutoEval entry, which is not included.
- The frontier membership is copied from Arena's own WebDev Pareto view and
  stored in `sourceFrontier`. Do not recompute it from the displayed prices:
  Arena rounds those prices to cents and its unrounded values can distinguish
  entries that look equal.
- `webdev.js` draws the labels and source frontier, builds the table, and
  supports highlighting, pan, pinch, zoom, Fit and full-screen mode.
- To update the snapshot, capture the full overall leaderboard and Pareto view
  together. Update the board date, capture time, all values, missing costs and
  source frontier, then bump the data and script cache versions. Check that
  all plotted labels remain visible and the published frontier agrees.

The three charts are dated snapshots; they do not refresh automatically.

