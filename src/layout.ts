import type {
  Breakpoint,
  GridItem,
  Layout,
  LayoutValidationOptions,
  MoveOptions,
  ResponsiveLayouts,
  ResizeOptions,
  ValidationResult,
} from './types.js';

export const DEFAULT_BREAKPOINTS: Readonly<Record<string, number>> = Object.freeze({
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
});

export const DEFAULT_RESPONSIVE_COLS: Readonly<Record<string, number>> = Object.freeze({
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
});

const isPositiveInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

const hasOverlap = (a: GridItem, b: GridItem): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const checkGridOptions = (options: LayoutValidationOptions): string[] => {
  const errors: string[] = [];
  if (options.cols !== undefined && !isPositiveInteger(options.cols)) {
    errors.push('cols must be a positive safe integer.');
  }
  if (options.maxRows !== undefined && !isPositiveInteger(options.maxRows)) {
    errors.push('maxRows must be a positive safe integer.');
  }
  return errors;
};

export class LayoutValidationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Invalid grid layout: ${errors.join(' ')}`);
    this.name = 'LayoutValidationError';
    this.errors = [...errors];
  }
}

export function validateLayout(
  layout: unknown,
  options: LayoutValidationOptions = {},
): ValidationResult {
  const errors = checkGridOptions(options);
  if (!Array.isArray(layout)) {
    errors.push('layout must be an array.');
    return { valid: false, errors };
  }

  const seen = new Set<string>();
  const items: GridItem[] = [];
  layout.forEach((value: unknown, index: number) => {
    if (value === null || typeof value !== 'object') {
      errors.push(`layout[${index}] must be an object.`);
      return;
    }

    const item = value as Partial<GridItem>;
    if (typeof item.i !== 'string' || item.i.length === 0) {
      errors.push(`layout[${index}].i must be a non-empty string.`);
    } else if (seen.has(item.i)) {
      errors.push(`layout contains duplicate item id "${item.i}".`);
    } else {
      seen.add(item.i);
    }

    for (const key of ['x', 'y'] as const) {
      if (!Number.isSafeInteger(item[key]) || (item[key] as number) < 0) {
        errors.push(`layout[${index}].${key} must be a non-negative safe integer.`);
      }
    }
    for (const key of ['w', 'h'] as const) {
      if (!isPositiveInteger(item[key] as number)) {
        errors.push(`layout[${index}].${key} must be a positive safe integer.`);
      }
    }
    for (const key of ['minW', 'minH', 'maxW', 'maxH'] as const) {
      const value = item[key];
      if (value !== undefined && !isPositiveInteger(value)) {
        errors.push(`layout[${index}].${key} must be a positive safe integer when provided.`);
      }
    }
    if (item.minW !== undefined && item.maxW !== undefined && item.minW > item.maxW) {
      errors.push(`layout[${index}].minW cannot exceed maxW.`);
    }
    if (item.minH !== undefined && item.maxH !== undefined && item.minH > item.maxH) {
      errors.push(`layout[${index}].minH cannot exceed maxH.`);
    }
    if (
      Number.isSafeInteger(item.x) &&
      Number.isSafeInteger(item.w) &&
      !Number.isSafeInteger((item.x as number) + (item.w as number))
    ) {
      errors.push(`layout[${index}].x + w must be a safe integer.`);
    }
    if (
      Number.isSafeInteger(item.y) &&
      Number.isSafeInteger(item.h) &&
      !Number.isSafeInteger((item.y as number) + (item.h as number))
    ) {
      errors.push(`layout[${index}].y + h must be a safe integer.`);
    }
    if (
      Number.isSafeInteger(item.x) &&
      Number.isSafeInteger(item.w) &&
      options.cols !== undefined &&
      (item.x as number) + (item.w as number) > options.cols
    ) {
      errors.push(`layout[${index}] exceeds the ${options.cols}-column grid.`);
    }
    if (
      Number.isSafeInteger(item.y) &&
      Number.isSafeInteger(item.h) &&
      options.maxRows !== undefined &&
      (item.y as number) + (item.h as number) > options.maxRows
    ) {
      errors.push(`layout[${index}] exceeds the ${options.maxRows}-row limit.`);
    }
    if (item.minW !== undefined && Number.isSafeInteger(item.w) && (item.w as number) < item.minW) {
      errors.push(`layout[${index}].w is below minW.`);
    }
    if (item.minH !== undefined && Number.isSafeInteger(item.h) && (item.h as number) < item.minH) {
      errors.push(`layout[${index}].h is below minH.`);
    }
    if (item.maxW !== undefined && Number.isSafeInteger(item.w) && (item.w as number) > item.maxW) {
      errors.push(`layout[${index}].w exceeds maxW.`);
    }
    if (item.maxH !== undefined && Number.isSafeInteger(item.h) && (item.h as number) > item.maxH) {
      errors.push(`layout[${index}].h exceeds maxH.`);
    }
    if (item.static !== undefined && typeof item.static !== 'boolean') {
      errors.push(`layout[${index}].static must be a boolean when provided.`);
    }
    if (
      Number.isSafeInteger(item.x) &&
      Number.isSafeInteger(item.y) &&
      Number.isSafeInteger(item.w) &&
      Number.isSafeInteger(item.h)
    ) {
      items.push(item as GridItem);
    }
  });

  if (!options.allowOverlap) {
    for (let first = 0; first < items.length; first += 1) {
      for (let second = first + 1; second < items.length; second += 1) {
        if (hasOverlap(items[first], items[second])) {
          errors.push(`Items "${items[first].i}" and "${items[second].i}" overlap.`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidLayout(
  layout: unknown,
  options: LayoutValidationOptions = {},
): asserts layout is Layout {
  const result = validateLayout(layout, options);
  if (!result.valid) {
    throw new LayoutValidationError(result.errors);
  }
}

export function layoutsCollide(first: GridItem, second: GridItem): boolean {
  return hasOverlap(first, second);
}

export function compactLayout(layout: Layout, cols?: number): Layout {
  assertValidLayout(layout, { cols });
  const fixed = layout.filter((item) => item.static);
  const movable = layout
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.static)
    .sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x || a.index - b.index);
  const placed: GridItem[] = fixed.map((item) => ({ ...item }));
  const compacted = new Map<string, GridItem>();
  fixed.forEach((item) => compacted.set(item.i, { ...item }));

  for (const { item } of movable) {
    const original = { ...item };
    let candidate = original;
    let y = 0;
    while (y <= original.y) {
      const trial = { ...original, y };
      const collisions = placed.filter((other) => hasOverlap(trial, other));
      if (collisions.length === 0) {
        candidate = trial;
        break;
      }
      y = collisions.reduce((nextY, other) => Math.max(nextY, other.y + other.h), y);
    }
    placed.push(candidate);
    compacted.set(candidate.i, candidate);
  }

  return layout.map((item) => ({ ...(compacted.get(item.i) ?? item) }));
}

export function moveLayoutItem(
  layout: Layout,
  id: string,
  x: number,
  y: number,
  options: MoveOptions = {},
): Layout {
  assertValidLayout(layout, options);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0) {
    return layout.map((item) => ({ ...item }));
  }
  const index = layout.findIndex((item) => item.i === id);
  if (index < 0 || layout[index].static) {
    return layout.map((item) => ({ ...item }));
  }
  const item = layout[index];
  if (
    (options.cols !== undefined && x + item.w > options.cols) ||
    (options.maxRows !== undefined && y + item.h > options.maxRows)
  ) {
    return layout.map((entry) => ({ ...entry }));
  }

  const moved = { ...item, x, y };
  if (layout.some((other) => other.i !== id && hasOverlap(moved, other))) {
    return layout.map((entry) => ({ ...entry }));
  }
  const next = layout.map((entry) => (entry.i === id ? moved : { ...entry }));
  return options.compactType === null ? next : compactLayout(next, options.cols);
}

export function resizeLayoutItem(
  layout: Layout,
  id: string,
  w: number,
  h: number,
  options: ResizeOptions = {},
): Layout {
  assertValidLayout(layout, options);
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1) {
    return layout.map((item) => ({ ...item }));
  }
  const index = layout.findIndex((item) => item.i === id);
  if (index < 0 || layout[index].static) {
    return layout.map((item) => ({ ...item }));
  }
  const item = layout[index];
  const minW = item.minW ?? 1;
  const minH = item.minH ?? 1;
  const maxW = item.maxW ?? options.cols ?? Number.MAX_SAFE_INTEGER;
  const maxH = item.maxH ?? options.maxRows ?? Number.MAX_SAFE_INTEGER;
  if (
    w < minW ||
    h < minH ||
    w > maxW ||
    h > maxH ||
    (options.cols !== undefined && item.x + w > options.cols) ||
    (options.maxRows !== undefined && item.y + h > options.maxRows)
  ) {
    return layout.map((entry) => ({ ...entry }));
  }

  const resized = { ...item, w, h };
  if (layout.some((other) => other.i !== id && hasOverlap(resized, other))) {
    return layout.map((entry) => ({ ...entry }));
  }
  const next = layout.map((entry) => (entry.i === id ? resized : { ...entry }));
  return options.compactType === null ? next : compactLayout(next, options.cols);
}

export function getLayoutHeight(layout: Layout): number {
  assertValidLayout(layout);
  return layout.reduce((height, item) => Math.max(height, item.y + item.h), 0);
}

export function getBreakpoint(
  width: number,
  breakpoints: Readonly<Record<Breakpoint, number>> = DEFAULT_BREAKPOINTS,
): Breakpoint {
  if (!Number.isFinite(width) || width < 0) {
    throw new RangeError('width must be a finite non-negative number.');
  }
  const entries = Object.entries(breakpoints);
  if (entries.length === 0 || entries.some(([, value]) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('breakpoints must contain finite non-negative widths.');
  }
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.find(([, threshold]) => width >= threshold)?.[0] ?? entries[entries.length - 1][0];
}

export function getColsForBreakpoint(
  breakpoint: Breakpoint,
  responsiveCols: Readonly<Record<Breakpoint, number>> = DEFAULT_RESPONSIVE_COLS,
): number {
  const cols = responsiveCols[breakpoint];
  if (!isPositiveInteger(cols)) {
    throw new RangeError(`No positive column count is configured for "${breakpoint}".`);
  }
  return cols;
}

export function createResponsiveLayout(layout: Layout, cols: number, maxRows?: number): Layout {
  assertValidLayout(layout);
  if (!isPositiveInteger(cols) || (maxRows !== undefined && !isPositiveInteger(maxRows))) {
    throw new RangeError('cols and maxRows must be positive safe integers.');
  }
  const adapted = layout.map((item) => ({
    ...item,
    x: Math.min(item.x, Math.max(0, cols - item.w)),
    w: Math.min(item.w, cols, item.maxW ?? Number.MAX_SAFE_INTEGER),
    y: maxRows === undefined ? item.y : Math.min(item.y, Math.max(0, maxRows - item.h)),
    h: Math.min(item.h, maxRows ?? Number.MAX_SAFE_INTEGER, item.maxH ?? Number.MAX_SAFE_INTEGER),
  }));
  return compactLayout(adapted, cols);
}

export function serializeLayout(layout: Layout, options: LayoutValidationOptions = {}): string {
  assertValidLayout(layout, options);
  return JSON.stringify(layout.map((item) => ({ ...item })));
}

export function deserializeLayout(value: string, options: LayoutValidationOptions = {}): Layout {
  if (typeof value !== 'string') {
    throw new TypeError('Serialized layout must be a string.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new SyntaxError(
      `Serialized layout is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assertValidLayout(parsed, options);
  return parsed.map((item: GridItem) => ({ ...item }));
}

export function validateResponsiveLayouts(
  layouts: ResponsiveLayouts,
  responsiveCols: Readonly<Record<Breakpoint, number>> = DEFAULT_RESPONSIVE_COLS,
  maxRows?: number,
): void {
  if (layouts === null || typeof layouts !== 'object' || Array.isArray(layouts)) {
    throw new TypeError('layouts must be an object keyed by breakpoint.');
  }
  for (const [breakpoint, layout] of Object.entries(layouts)) {
    if (layout !== undefined) {
      assertValidLayout(layout, {
        cols: getColsForBreakpoint(breakpoint, responsiveCols),
        maxRows,
      });
    }
  }
}
