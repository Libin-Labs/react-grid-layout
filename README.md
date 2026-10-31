# @lp-labs/react-grid-layout

An original, small React grid for arranging keyed children. It provides controlled
and uncontrolled layouts, pointer and keyboard interaction, responsive
breakpoints, and standalone immutable layout utilities. It has no runtime
dependency other than React.

This package is an independent implementation informed by the general category
of draggable grid interfaces. It is not a port, fork, drop-in replacement, or
compatibility claim for another grid-layout package.

## Install

```sh
npm install @lp-labs/react-grid-layout react
```

React `^18.2.0` or `^19.0.0` is the sole peer dependency. Import the stylesheet
once in your application entry point:

```ts
import "@lp-labs/react-grid-layout/style.css";
```

## Quick start

```tsx
import { useState } from "react";
import {
  GridLayout,
  type Layout
} from "@lp-labs/react-grid-layout";
import "@lp-labs/react-grid-layout/style.css";

const initial: Layout = [
  { i: "summary", x: 0, y: 0, w: 2, h: 1 },
  { i: "activity", x: 2, y: 0, w: 2, h: 2 },
  { i: "notes", x: 0, y: 1, w: 2, h: 1 }
];

export function Dashboard() {
  const [layout, setLayout] = useState(initial);
  return (
    <GridLayout
      layout={layout}
      cols={4}
      rowHeight={120}
      gap={[12, 12]}
      onLayoutChange={(next) => setLayout(next)}
      aria-label="Dashboard widgets"
    >
      <section key="summary">Summary</section>
      <section key="activity">Activity</section>
      <section key="notes">Notes</section>
    </GridLayout>
  );
}
```

Each direct React element must have a stable `key` equal to a layout item's `i`,
or a matching `data-grid-id` string. Every direct element must match one layout
item; unmatched or unkeyed elements throw an explanatory error. A layout item
without a child is permitted as an empty reserved area. Style the child content
to fill the item as needed; the package positions the outer item wrapper.

## Layout model and collision policy

An item has integer grid coordinates and positive integer dimensions:

```ts
interface GridItem {
  i: string;                  // unique, non-empty id
  x: number; y: number;       // zero-based column and row
  w: number; h: number;       // positive column and row spans
  minW?: number; minH?: number;
  maxW?: number; maxH?: number;
  static?: boolean;           // cannot be moved or resized
}
type Layout = readonly GridItem[];
```

Items may not overlap. This version uses a **prevent-collision** policy: a
pointer, keyboard, or utility operation that would overlap another item is
rejected; items are never pushed. Static items are immovable obstacles. `cols`
and optional `maxRows` bound the grid. Invalid layouts throw
`LayoutValidationError`; attempted out-of-bounds, colliding, static, or
constraint-breaking moves return a cloned unchanged layout.

`compactType="vertical"` (the default) packs items upward after accepted changes,
without changing their horizontal position. Static items remain fixed
obstacles. Set `compactType={null}` to retain the row selected by the user. The
compactor is deterministic and only considers finite layout items; it does not
scan every row between zero and a distant item's `y`.

## Controlled and uncontrolled state

- `layout` controls a non-responsive grid. Provide `onLayoutChange` to receive
  proposed next layouts; update `layout` in response to make the change visible.
- `initialLayout` initializes an uncontrolled non-responsive grid. If `layout`
  is supplied, it is always treated as controlled.
- `layouts` controls breakpoint-specific state. `initialLayouts` initializes
  responsive internal state. The presence of either prop enables responsive
  mode.
- A missing responsive layout is derived from the most recently active layout,
  clipped to the new column count, and vertically compacted. The component
  reports the derived responsive map through `onLayoutsChange`.
- `onLayoutChange(layout, { breakpoint })` is called when a layout is proposed.
  Non-responsive callbacks receive `{}`. Responsive callbacks receive the
  active breakpoint string.
- `onLayoutsChange(layouts, { breakpoint })` is called for responsive layout
  creation and edits. It receives a new map with the active layout included.

Responsive props are keyed by breakpoint name:

```tsx
const breakpoints = { wide: 1100, medium: 700, narrow: 0 };
const responsiveCols = { wide: 12, medium: 8, narrow: 4 };

<GridLayout
  initialLayouts={{
    wide: [
      { i: "chart", x: 0, y: 0, w: 8, h: 2 },
      { i: "feed", x: 8, y: 0, w: 4, h: 2 }
    ]
  }}
  breakpoints={breakpoints}
  responsiveCols={responsiveCols}
  onLayoutsChange={(next, { breakpoint }) => {
    localStorage.setItem("dashboard-layouts", JSON.stringify(next));
    console.log("Updated", breakpoint);
  }}
>
  <Chart key="chart" />
  <Feed key="feed" />
</GridLayout>
```

The container width is measured with `ResizeObserver`; if it is unavailable,
the component measures its bounding box and listens for window resize. The
breakpoint is the highest configured threshold not greater than the measured
width (or the smallest configured breakpoint below all thresholds). Supply
`responsiveCols` for each custom breakpoint. Default breakpoints are `lg:1200`,
`md:996`, `sm:768`, `xs:480`, `xxs:0`; default columns are respectively
`12, 10, 6, 4, 2`.

## Props

| Prop | Default | Description |
| --- | --- | --- |
| `layout`, `initialLayout` | `[]` | Controlled or initial non-responsive layout. |
| `layouts`, `initialLayouts` | — | Controlled or initial responsive maps. |
| `cols` | `12` | Non-responsive positive integer column count. |
| `rowHeight` | `100` | Positive row height in CSS pixels. |
| `gap` | `8` | Non-negative pixel gap, or `[columnGap, rowGap]`. |
| `maxRows` | unlimited | Optional positive integer row limit. |
| `compactType` | `"vertical"` | `"vertical"` or `null`. |
| `isDraggable` | `true` | Enables pointer and arrow-key movement. |
| `isResizable` | `true` | Enables pointer and Shift+arrow resizing. |
| `isReadOnly` | `false` | Disables both interactions. |
| `resizeHandle` | `true` | Displays the accessible resize button. |
| `breakpoints` | see above | Responsive width thresholds. |
| `responsiveCols` | see above | Column counts for each breakpoint. |
| `onLayoutChange` | — | Receives `(layout, { breakpoint? })`. |
| `onLayoutsChange` | — | Receives `(layouts, { breakpoint })`. |
| `itemClassName`, `itemStyle` | — | Adds class/style to each positioned item. |
| `className`, `style`, `aria-label` | — | Container attributes; other standard div attributes are forwarded. |

`isReadOnly` takes precedence over both interaction toggles. Items with
`static: true` cannot be moved or resized. The grid rejects non-finite or
non-positive `rowHeight`, invalid gaps, and invalid active layouts with
descriptive `RangeError` or `LayoutValidationError` exceptions.

## Accessibility and styling

The container has `role="grid"`; positioned cells have `role="gridcell"`,
accessible labels, and focus support when interactive. Use arrow keys to move
the focused cell and Shift+arrow keys to resize it. The resize button has a
per-item accessible name and is keyboard-operable. Pointer drag uses pointer
capture; pointer cancellation restores the interaction's starting layout.
Disable interaction with `isReadOnly` when the surrounding UI should be
read-only.

The stylesheet is optional but supplies focus rings, cursors, and the resize
handle. CSS custom properties:

| Variable | Default | Use |
| --- | --- | --- |
| `--lp-grid-focus-color` | `#2563eb` | Keyboard focus outline. |
| `--lp-grid-resize-handle-size` | `18px` | Resize button width and height. |
| `--lp-grid-resize-color` | `#64748b` | Resize grip color. |

The package does not set item backgrounds or borders. Define those on your
children or via `itemClassName`/`itemStyle`.

## Persistence and utilities

The utilities are pure with respect to their inputs: returned layouts and items
are new objects. They do not access the DOM or browser globals.

```ts
import {
  deserializeLayout,
  serializeLayout,
  validateLayout
} from "@lp-labs/react-grid-layout";

const saved = localStorage.getItem("layout");
const layout = saved
  ? deserializeLayout(saved, { cols: 12, maxRows: 20 })
  : [];
const result = validateLayout(layout, { cols: 12, maxRows: 20 });
if (result.valid) localStorage.setItem("layout", serializeLayout(layout));
```

The exported runtime utilities are:

- `assertValidLayout`, `validateLayout`, `LayoutValidationError`,
  `validateResponsiveLayouts`
- `compactLayout`, `moveLayoutItem`, `resizeLayoutItem`, `layoutsCollide`,
  `getLayoutHeight`, `createResponsiveLayout`
- `serializeLayout`, `deserializeLayout`
- `getBreakpoint`, `getColsForBreakpoint`, `DEFAULT_BREAKPOINTS`,
  `DEFAULT_RESPONSIVE_COLS`
- `GridLayout`, `getResponsiveLayoutsSnapshot`

`validateLayout` returns `{ valid, errors }`; the assert/serialization,
compaction, and responsive-layout functions throw for invalid input.
Validation and serialization accept `allowOverlap: true` when intentionally
checking or storing overlapping data; the interactive grid and move/resize
utilities still enforce the no-overlap policy.
`getResponsiveLayoutsSnapshot(layouts, breakpoint, responsiveCols?, maxRows?)`
returns a frozen map with a cloned active layout (or an empty one when that
breakpoint is absent). Utility operations accept optional `cols` and `maxRows`
constraints. `moveLayoutItem` and `resizeLayoutItem` also accept `compactType`.

## Next.js and server rendering

Import the component normally from a Client Component. It has no browser-global
reads at module import time; measurement and pointer logic start after mount.
For example:

```tsx
"use client";

import { GridLayout } from "@lp-labs/react-grid-layout";
import "@lp-labs/react-grid-layout/style.css";

export function ClientDashboard() {
  return (
    <GridLayout initialLayout={[{ i: "one", x: 0, y: 0, w: 2, h: 1 }]}>
      <article key="one">One</article>
    </GridLayout>
  );
}
```

The parent must give the grid a measurable width. The component itself does not
load images, schedule animation frames, persist data, or depend on a particular
framework.

## Performance and scope

Collision validation compares item pairs, so validation/compaction cost grows
quadratically with the number of items. Compaction checks only encountered
obstacles and does not iterate through every empty row; layouts with hundreds
of widgets are a more appropriate target than very large, virtualized canvases.
No push algorithm, collision override, transforms, drag handles on arbitrary
descendants, constraints beyond `minW`/`minH`/`maxW`/`maxH`, or drop-from-outside
behavior is provided in v0.1.0.

This is original package documentation and implementation. No upstream
compatibility, legal clearance, certification, or affiliation is represented.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
