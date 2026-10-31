import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactLayout,
  createResponsiveLayout,
  DEFAULT_BREAKPOINTS,
  DEFAULT_RESPONSIVE_COLS,
  deserializeLayout,
  getBreakpoint,
  getColsForBreakpoint,
  getLayoutHeight,
  LayoutValidationError,
  layoutsCollide,
  moveLayoutItem,
  resizeLayoutItem,
  serializeLayout,
  validateLayout,
} from '../src/index.js';
import type { Layout } from '../src/index.js';

test('validates layout fields, boundaries, duplicates, and collisions', () => {
  const invalid = validateLayout(
    [
      { i: 'a', x: 0, y: 0, w: 2, h: 1 },
      { i: 'a', x: 2, y: 0, w: 1, h: 1 },
    ],
    { cols: 2 },
  );
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /duplicate item id/);
  assert.match(invalid.errors.join(' '), /exceeds the 2-column grid/);
  assert.throws(
    () => compactLayout([{ i: 'bad', x: 0, y: -1, w: 1, h: 1 }]),
    LayoutValidationError,
  );
  assert.equal(
    validateLayout(
      [
        { i: 'a', x: 0, y: 0, w: 1, h: 1 },
        { i: 'b', x: 0, y: 0, w: 1, h: 1 },
      ],
      { allowOverlap: true },
    ).valid,
    true,
  );
});

test('moves and resizes immutably, prevents overlaps, and respects static items', () => {
  const layout: Layout = [
    { i: 'a', x: 0, y: 0, w: 1, h: 1, minW: 1, maxW: 2 },
    { i: 'fixed', x: 2, y: 0, w: 1, h: 1, static: true },
  ];
  const moved = moveLayoutItem(layout, 'a', 1, 0, { cols: 3, compactType: null });
  assert.deepEqual(
    moved.map(({ x }) => x),
    [1, 2],
  );
  assert.notEqual(moved, layout);
  assert.deepEqual(
    layout.map(({ x }) => x),
    [0, 2],
  );
  assert.deepEqual(moveLayoutItem(layout, 'a', 2, 0, { cols: 3 }), layout);
  assert.deepEqual(moveLayoutItem(layout, 'fixed', 0, 0, { cols: 3 }), layout);
  assert.deepEqual(
    resizeLayoutItem(layout, 'a', 2, 1, { cols: 3, compactType: null }).map(({ w }) => w),
    [2, 1],
  );
  assert.deepEqual(resizeLayoutItem(layout, 'a', 3, 1, { cols: 3 }), layout);
  assert.equal(layoutsCollide(layout[0], layout[1]), false);
});

test('compaction is deterministic, respects fixed obstacles, and is bounded', () => {
  const layout: Layout = [
    { i: 'above', x: 0, y: 6, w: 1, h: 1 },
    { i: 'fixed', x: 0, y: 0, w: 1, h: 2, static: true },
    { i: 'far', x: 1, y: Number.MAX_SAFE_INTEGER - 1, w: 1, h: 1 },
  ];
  const compacted = compactLayout(layout, 2);
  assert.deepEqual(
    compacted.map(({ y }) => y),
    [2, 0, 0],
  );
  assert.deepEqual(compactLayout(compacted, 2), compacted);
});

test('adapts responsive layouts and selects configured breakpoints', () => {
  assert.equal(getBreakpoint(1200), 'lg');
  assert.equal(getBreakpoint(900), 'sm');
  assert.equal(getBreakpoint(0), 'xxs');
  assert.deepEqual(getColsForBreakpoint('md'), 10);
  const adapted = createResponsiveLayout(
    [
      { i: 'wide', x: 8, y: 0, w: 4, h: 1 },
      { i: 'lower', x: 0, y: 4, w: 2, h: 1 },
    ],
    4,
  );
  assert.deepEqual(adapted, [
    { i: 'wide', x: 0, y: 0, w: 4, h: 1 },
    { i: 'lower', x: 0, y: 1, w: 2, h: 1 },
  ]);
  assert.equal(getLayoutHeight(adapted), 2);
  assert.ok(DEFAULT_BREAKPOINTS.lg > DEFAULT_BREAKPOINTS.md);
  assert.equal(DEFAULT_RESPONSIVE_COLS.xxs, 2);
});

test('serializes validated copies and rejects malformed persisted data', () => {
  const source: Layout = [{ i: 'saved', x: 1, y: 2, w: 2, h: 1 }];
  const result = deserializeLayout(serializeLayout(source), { cols: 4 });
  assert.deepEqual(result, source);
  assert.notEqual(result, source);
  assert.throws(() => deserializeLayout('{'), SyntaxError);
  assert.throws(() => deserializeLayout('{"i":"not-an-array"}'), LayoutValidationError);
  assert.throws(
    () => deserializeLayout('[{"i":"a","x":0,"y":0,"w":2,"h":1}]', { cols: 1 }),
    LayoutValidationError,
  );
});
