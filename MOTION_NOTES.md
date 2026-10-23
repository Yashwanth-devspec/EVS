# Motion System & Interaction Engineering Notes

## Design Philosophy (Emil Kowalski Philosophy & Art Direction)
Motion in EcoRide Share is strictly functional and explanatory. It communicates state transitions, spatial origins, and operational changes. Generic SaaS bouncing, spring overshoots, and decorative UI animations are eliminated.

### Core Motion Rules Applied:
1. **Duration Window**: All utility transitions operate strictly within **120ms to 250ms**, never exceeding 300ms.
2. **Easing**: Smooth decelerated entry curves `[0.16, 1, 0.3, 1]` or `ease-out`. Zero physics bounce on utility cards or data tables.
3. **Property Whitelist**: Only hardware-accelerated properties (`transform` and `opacity`), plus `stroke-dashoffset` for vector graphics, are animated. Layout shifts are avoided by pre-allocating bounding boxes.
4. **Touch & Press Feedback**: Pressable elements have subtle active scale response (`:active scale(0.97)`).
5. **Number Changes**: Sub-200ms digit roll (`DigitRoll`) executes **only on value changes**, never on initial page load / first paint.
6. **Prefers-Reduced-Motion**: Fully respected via CSS media queries (`prefers-reduced-motion: reduce`) which disables transforms and renders transitions instantaneously.

---

## Detailed Motion Catalog

| Component / Interaction | Animation Type | Purpose & Mental Model | Duration | Easing | Reduced Motion Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ticket Entrance** (`Ticket.tsx`) | `y: 12px -> 0`, `opacity: 0 -> 1` | Physical paper boarding pass rising into view onto dark arrival hall surface. | 220ms | `[0.16, 1, 0.3, 1]` (ease-out) | Instant static render at `y: 0`, `opacity: 1`. |
| **Rubber Stamp** (`Stamp.tsx`) | `scale: 1.12 -> 1`, `rotate: 0 -> -6deg`, `opacity: 0 -> 1` | Expressive physical validation mark stamped onto paper ticket. | 180ms | `[0.16, 1, 0.3, 1]` (ease-out) | Instant render with -6deg rotation without scale-down. |
| **Digit Roll** (`DigitRoll.tsx`) | `y: 100% -> 0% -> -100%`, `opacity: 0 -> 1 -> 0` | FIDS mechanical split-flap / digital board change without layout reflow. First paint static. | 180ms | `[0.16, 1, 0.3, 1]` (ease-out) | Instant text value replacement with zero translation. |
| **Convergence Map** (`ConvergenceMap.tsx`) | `stroke-dashoffset` draw-in & opacity cross-fade | Demonstrates 12 solo airport cabs consolidating into 4 shared corridors. | 1200ms equivalent | Smooth linear/ease-out | Instant toggle between "Today" and "With EcoRide" without transition. |
| **Wait-vs-Save Handle** (`WaitSaveChart.tsx`) | SVG node cursor tracking & SVG drop-line snapping | Immediate tactile response scrubbing wait time to reveal rupee savings. | 120ms | Smooth snap | Instant highlight of active node. |
| **Simulation Drawer** (`DemoDrawer.tsx`) | `x: 100% -> 0%` slide from trigger | Natural drawer origin expanding from edge. | 220ms | `[0.16, 1, 0.3, 1]` | Instant render on screen. |
| **Buttons & Tap Targets** (`.btn-primary`, `.tap-target`) | `:active scale(0.97)` | Haptic tactile confirmation on press. | 120ms | Ease-out | Scale transform suppressed. |
| **Runway Dash Indicator** (`RunwayDash.tsx`) | Dashed amber stroke pulse | Wayfinding runway pulse indicating background queue activity. | 1500ms cycle | Linear pulse | Static amber dashed line. |

---

## Animation Review & Auditing

- **No scale(0) animations**: All modal and drawer entrances emerge from `scale(0.95)` or edge translation.
- **Zero layout shifts (CLS = 0)**: Monospace font `B612 Mono` with strict `tabular-nums` prevents width jitter during digit rolls.
- **No typing animation**: Form fields and stepper inputs update synchronously with zero simulated keypress delays.
- **Accessibility Verification**: Tested with `@media (prefers-reduced-motion: reduce)` in `src/index.css`. All animations collapse cleanly.
