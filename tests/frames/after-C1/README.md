# C1 — footer / clip repair (v1.10) frame evidence

The v1.9 A1 audit found footer text clipped at the 800px canvas bottom on the
title + options screens (the "G/N/B to set difficulty…" help line was fully
off-canvas; the stats line's lower ~3px clipped) and the end-recap "return to
the pond (Esc)" button label. This directory holds the before/after frames for
the three affected scenes.

- `before/` — captured from the build BEFORE the C1 geometry fix (HEAD
  `556b493`, pre-fix). The title/options footer help line sits below the 800px
  floor and the stats line is cut off.
- `after/` — captured from the build AFTER the fix. Every footer line is fully
  on-canvas with a small bottom margin.

## What changed (geometry only — no sim/tuning number moves)

**Title + options footer** (`_titleLayout` in `src/game.js`): the controls panel
was pinned at `py=300`, leaving no room for the footer once a returning player's
extra rows (NG+ / Curator Challenge / Beneath-the-Reeds entry + best-run line)
stack in. The panel was pulled up to `py=236` and every inter-row gap tightened
(start-button gap 18→12, guided/NG slot 14→10, difficulty row push 12→8,
atelier row 12→8, Reeds entry 16→10, footer fpush 16→10), and the footer lines
were re-spaced (stats +18→+10, best-run +38→+30, help +58/+38→+48/+30). Result:
fresh title bottom-most text 816→726, worst-case returning title 888→790
(both clear the 800px floor with margin).

**End-screen buttons** (`_endButtons` in `src/game.js`): the primary button was
at `py+H+16`; it is now at `py+H-24` (the whole primary → Next Expedition →
return stack shifts up 40px into the card's empty top band). Result: the harness
end-recap frame's return label clears the floor (bot 790→737), and even the
worst-case full NG+ victory (primary + Next Expedition + return, 3 buttons)
clears it (bot 846→794). The smoke assertion pinning the primary rect was
updated to the new offset.

Verified by `tests/_measureC1.mjs` (a fillText hook measuring every center-aligned
draw's bbox across title/options/end-recap): before, the G/N/B help line was at
y=816 (fully off-canvas) and the stats line at y=796 (bot 803); after, every
line is ≤ 783. Smoke green; all 9 pacing probes still in band (presentation-only
change touches no sim).
