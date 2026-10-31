import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import {
  assertValidLayout,
  compactLayout,
  createResponsiveLayout,
  DEFAULT_BREAKPOINTS,
  DEFAULT_RESPONSIVE_COLS,
  getBreakpoint,
  getColsForBreakpoint,
  getLayoutHeight,
  moveLayoutItem,
  resizeLayoutItem,
  validateResponsiveLayouts,
} from './layout.js';
import type { Breakpoint, GridItem, GridLayoutProps, Layout, ResponsiveLayouts } from './types.js';

interface Interaction {
  id: string;
  mode: 'move' | 'resize';
  pointerId: number;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  lastX: number;
  lastY: number;
  lastW: number;
  lastH: number;
  readonly startLayout: Layout;
}

const initialItems = (layout: Layout | undefined): Layout =>
  (layout ?? []).map((item) => ({ ...item }));

const normalizedGap = (gap: GridLayoutProps['gap']): readonly [number, number] => {
  const result = typeof gap === 'number' ? [gap, gap] : (gap ?? [8, 8]);
  if (result.length !== 2 || result.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('gap must be a non-negative number or [columnGap, rowGap].');
  }
  return [result[0], result[1]];
};

const getChildId = (child: unknown): string | undefined => {
  if (!isValidElement(child)) return undefined;
  const element = child as ReactElement<{ 'data-grid-id'?: string }>;
  const explicit = element.props['data-grid-id'];
  return typeof explicit === 'string' && explicit.length > 0
    ? explicit
    : typeof element.key === 'string'
      ? element.key
      : undefined;
};

const makeLayouts = (layouts: ResponsiveLayouts | undefined): Record<string, Layout> => {
  const result: Record<string, Layout> = {};
  for (const [key, layout] of Object.entries(layouts ?? {})) {
    if (layout !== undefined) result[key] = initialItems(layout);
  }
  return result;
};

export function GridLayout({
  children,
  layout,
  initialLayout,
  layouts,
  initialLayouts,
  cols = 12,
  rowHeight = 100,
  gap = 8,
  maxRows,
  compactType = 'vertical',
  isDraggable = true,
  isResizable = true,
  isReadOnly = false,
  resizeHandle = true,
  breakpoints = DEFAULT_BREAKPOINTS,
  responsiveCols = DEFAULT_RESPONSIVE_COLS,
  onLayoutChange,
  onLayoutsChange,
  itemClassName,
  itemStyle,
  className,
  style,
  ...containerProps
}: GridLayoutProps) {
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) {
    throw new RangeError('rowHeight must be a finite positive number.');
  }
  const [columnGap, rowGap] = normalizedGap(gap);
  const responsive = layouts !== undefined || initialLayouts !== undefined;
  const [width, setWidth] = useState(0);
  const [internalLayout, setInternalLayout] = useState<Layout>(() =>
    initialItems(
      initialLayout ??
        layout ??
        Object.values(initialLayouts ?? layouts ?? {}).find(
          (candidate): candidate is Layout => candidate !== undefined,
        ),
    ),
  );
  const [internalLayouts, setInternalLayouts] = useState<Record<string, Layout>>(() =>
    makeLayouts(initialLayouts ?? layouts),
  );
  const previousBreakpointRef = useRef<Breakpoint | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const pointerElementRef = useRef<HTMLElement | null>(null);
  const breakpointFromWidth = responsive ? getBreakpoint(width, breakpoints) : undefined;
  const breakpoint = breakpointFromWidth;
  const breakCols = breakpoint ? getColsForBreakpoint(breakpoint, responsiveCols) : cols;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const updateWidth = (nextWidth: number): void => {
      if (Number.isFinite(nextWidth) && nextWidth >= 0) setWidth(nextWidth);
    };
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries.find((candidate) => candidate.target === element);
        if (entry) updateWidth(entry.contentRect.width);
      });
      observer.observe(element);
      return () => observer.disconnect();
    }
    const updateFromRect = (): void => updateWidth(element.getBoundingClientRect().width);
    updateFromRect();
    window.addEventListener('resize', updateFromRect);
    return () => window.removeEventListener('resize', updateFromRect);
  }, []);

  useEffect(() => {
    if (!responsive || !breakpoint) return;
    const source = layouts?.[breakpoint] ?? internalLayouts[breakpoint];
    if (source !== undefined) {
      assertValidLayout(source, { cols: breakCols, maxRows });
      previousBreakpointRef.current = breakpoint;
      return;
    }
    const previousBreakpoint = previousBreakpointRef.current;
    const previous =
      (previousBreakpoint
        ? (layouts?.[previousBreakpoint] ?? internalLayouts[previousBreakpoint])
        : undefined) ??
      layout ??
      internalLayout;
    const adapted = createResponsiveLayout(previous, breakCols, maxRows);
    const next = { ...internalLayouts, [breakpoint]: adapted };
    setInternalLayouts(next);
    onLayoutsChange?.(
      { ...makeLayouts(layouts ?? internalLayouts), [breakpoint]: adapted },
      { breakpoint },
    );
    previousBreakpointRef.current = breakpoint;
  }, [
    breakCols,
    breakpoint,
    internalLayout,
    internalLayouts,
    layout,
    layouts,
    maxRows,
    onLayoutsChange,
    responsive,
  ]);

  const activeLayout = useMemo((): Layout => {
    const responsiveLayout = breakpoint
      ? (layouts?.[breakpoint] ?? internalLayouts[breakpoint])
      : undefined;
    return responsiveLayout ?? layout ?? internalLayout;
  }, [breakpoint, internalLayout, internalLayouts, layout, layouts]);

  useEffect(() => {
    assertValidLayout(activeLayout, { cols: breakCols, maxRows });
  }, [activeLayout, breakCols, maxRows]);

  const commitLayout = useCallback(
    (next: Layout, compact = true): void => {
      const validated =
        compact && compactType === 'vertical' ? compactLayout(next, breakCols) : next;
      assertValidLayout(validated, { cols: breakCols, maxRows });
      if (responsive && breakpoint) {
        const source = makeLayouts(layouts ?? internalLayouts);
        const nextLayouts = { ...source, [breakpoint]: validated };
        if (layouts === undefined) {
          setInternalLayouts(nextLayouts);
        }
        onLayoutChange?.(validated, { breakpoint });
        onLayoutsChange?.(nextLayouts, { breakpoint });
      } else {
        if (layout === undefined) setInternalLayout(validated);
        onLayoutChange?.(validated, {});
      }
    },
    [
      breakCols,
      breakpoint,
      compactType,
      internalLayouts,
      layout,
      layouts,
      maxRows,
      onLayoutChange,
      onLayoutsChange,
      responsive,
    ],
  );

  useEffect(
    () => () => {
      const active = interactionRef.current;
      interactionRef.current = null;
      const pointerElement = pointerElementRef.current;
      pointerElementRef.current = null;
      if (active && pointerElement?.hasPointerCapture?.(active.pointerId)) {
        pointerElement.releasePointerCapture(active.pointerId);
      }
    },
    [],
  );

  const applyMove = useCallback(
    (id: string, x: number, y: number): void => {
      const next = moveLayoutItem(activeLayout, id, x, y, {
        cols: breakCols,
        maxRows,
        compactType,
      });
      if (
        next.some(
          (item, index) =>
            item.x !== activeLayout[index]?.x ||
            item.y !== activeLayout[index]?.y ||
            item.w !== activeLayout[index]?.w ||
            item.h !== activeLayout[index]?.h,
        )
      ) {
        commitLayout(next);
      }
    },
    [activeLayout, breakCols, commitLayout, compactType, maxRows],
  );

  const applyResize = useCallback(
    (id: string, w: number, h: number): void => {
      const next = resizeLayoutItem(activeLayout, id, w, h, {
        cols: breakCols,
        maxRows,
        compactType,
      });
      if (
        next.some(
          (item, index) => item.w !== activeLayout[index]?.w || item.h !== activeLayout[index]?.h,
        )
      ) {
        commitLayout(next);
      }
    },
    [activeLayout, breakCols, commitLayout, compactType, maxRows],
  );

  const startInteraction = useCallback(
    (event: ReactPointerEvent<HTMLElement>, item: GridItem, mode: Interaction['mode']): void => {
      if (
        isReadOnly ||
        (mode === 'move' && !isDraggable) ||
        (mode === 'resize' && !isResizable) ||
        item.static
      ) {
        return;
      }
      if (
        event.button !== 0 ||
        (event.target instanceof Element &&
          event.target.closest('button, input, textarea, select, a, [contenteditable=true]') &&
          mode !== 'resize')
      ) {
        return;
      }
      event.preventDefault();
      const currentTarget = event.currentTarget;
      currentTarget.setPointerCapture?.(event.pointerId);
      pointerElementRef.current = currentTarget;
      interactionRef.current = {
        id: item.i,
        mode,
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startX: item.x,
        startY: item.y,
        startW: item.w,
        startH: item.h,
        lastX: item.x,
        lastY: item.y,
        lastW: item.w,
        lastH: item.h,
        startLayout: activeLayout.map((entry) => ({ ...entry })),
      };
    },
    [activeLayout, isDraggable, isReadOnly, isResizable],
  );

  const updateInteraction = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const active = interactionRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const rect = containerRef.current?.getBoundingClientRect();
      const unitWidth =
        rect && rect.width > 0 ? (rect.width - columnGap * (breakCols - 1)) / breakCols : 1;
      const dx = Math.round((event.clientX - active.originX) / (unitWidth + columnGap));
      const dy = Math.round((event.clientY - active.originY) / (rowHeight + rowGap));
      if (active.mode === 'move') {
        const x = active.startX + dx;
        const y = active.startY + dy;
        if (x !== active.lastX || y !== active.lastY) {
          active.lastX = x;
          active.lastY = y;
          applyMove(active.id, x, y);
        }
      } else {
        const w = active.startW + dx;
        const h = active.startH + dy;
        if (w !== active.lastW || h !== active.lastH) {
          active.lastW = w;
          active.lastH = h;
          applyResize(active.id, w, h);
        }
      }
    },
    [applyMove, applyResize, breakCols, columnGap, rowGap, rowHeight],
  );

  const endInteraction = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const active = interactionRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      if (event.type === 'pointerup') updateInteraction(event);
      if (event.type === 'pointercancel') commitLayout(active.startLayout, false);
      interactionRef.current = null;
      const pointerElement = pointerElementRef.current;
      pointerElementRef.current = null;
      if (pointerElement?.hasPointerCapture?.(event.pointerId)) {
        pointerElement.releasePointerCapture(event.pointerId);
      }
    },
    [commitLayout, updateInteraction],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, item: GridItem): void => {
      if (isReadOnly || item.static) return;
      const delta = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key];
      if (!delta) return;
      if (event.shiftKey ? !isResizable : !isDraggable) return;
      event.preventDefault();
      if (event.shiftKey) {
        applyResize(item.i, item.w + delta[0], item.h + delta[1]);
      } else {
        applyMove(item.i, item.x + delta[0], item.y + delta[1]);
      }
    },
    [applyMove, applyResize, isDraggable, isReadOnly, isResizable],
  );

  const unitWidthPercent = 100 / breakCols;
  const gridHeight =
    getLayoutHeight(activeLayout) * rowHeight +
    Math.max(0, getLayoutHeight(activeLayout) - 1) * rowGap;
  const readOnly = isReadOnly;
  const renderedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const id = getChildId(child);
    if (!id) {
      throw new Error(
        'Each direct grid child needs a stable key matching a layout item, or a data-grid-id.',
      );
    }
    const item = activeLayout.find((candidate) => candidate.i === id);
    if (!item) {
      throw new Error(`Grid child "${id}" has no matching layout item.`);
    }
    const canMove = !readOnly && isDraggable && !item.static;
    const canKeyboardResize = !readOnly && isResizable && !item.static;
    const canResize = canKeyboardResize && resizeHandle;
    const leftPercent = item.x * unitWidthPercent;
    const widthPercent = item.w * unitWidthPercent;
    const leftGap = (item.x * columnGap) / breakCols;
    const widthGap = (item.w / breakCols - 1) * columnGap;
    const itemPosition: CSSProperties = {
      position: 'absolute',
      left: `calc(${leftPercent}% + ${leftGap}px)`,
      top: item.y * (rowHeight + rowGap),
      width: `calc(${widthPercent}% + ${widthGap}px)`,
      height: item.h * rowHeight + (item.h - 1) * rowGap,
      boxSizing: 'border-box',
      touchAction: 'none',
      cursor: canMove ? 'grab' : 'default',
      ...itemStyle,
    };
    const originalTabIndex = (child.props as { tabIndex?: number }).tabIndex;
    return (
      <div
        key={id}
        className={['lp-grid-layout__item', itemClassName].filter(Boolean).join(' ')}
        data-grid-id={id}
        data-grid-x={item.x}
        data-grid-y={item.y}
        data-grid-w={item.w}
        data-grid-h={item.h}
        role="gridcell"
        aria-label={`Grid item ${id}`}
        aria-roledescription="grid item"
        aria-keyshortcuts={
          [
            ...(canMove ? ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] : []),
            ...(canKeyboardResize
              ? ['Shift+ArrowLeft', 'Shift+ArrowRight', 'Shift+ArrowUp', 'Shift+ArrowDown']
              : []),
          ].join(' ') || undefined
        }
        tabIndex={canMove || canKeyboardResize ? (originalTabIndex ?? 0) : undefined}
        style={itemPosition}
        onPointerDown={(event) => startInteraction(event, item, 'move')}
        onKeyDown={(event) => onKeyDown(event, item)}
      >
        {cloneElement(child as ReactElement, { key: id })}
        {canResize && (
          <button
            type="button"
            className="lp-grid-layout__resize-handle"
            aria-label={`Resize ${id}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              startInteraction(event, item, 'resize');
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              onKeyDown(event, item);
            }}
          />
        )}
      </div>
    );
  });

  return (
    <div
      {...containerProps}
      ref={containerRef}
      className={['lp-grid-layout', className].filter(Boolean).join(' ')}
      role="grid"
      aria-label={containerProps['aria-label'] ?? 'Grid layout'}
      data-breakpoint={breakpoint}
      style={{
        position: 'relative',
        width: '100%',
        height: gridHeight,
        ...style,
      }}
    >
      <div
        className="lp-grid-layout__interaction-surface"
        onPointerMove={updateInteraction}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        style={{ display: 'contents' }}
      >
        {renderedChildren}
      </div>
    </div>
  );
}

export function getResponsiveLayoutsSnapshot(
  layouts: ResponsiveLayouts,
  breakpoint: Breakpoint,
  responsiveCols: Readonly<Record<Breakpoint, number>> = DEFAULT_RESPONSIVE_COLS,
  maxRows?: number,
): Readonly<Record<Breakpoint, Layout>> {
  validateResponsiveLayouts(layouts, responsiveCols, maxRows);
  return Object.freeze({
    ...makeLayouts(layouts),
    [breakpoint]: layouts[breakpoint]?.map((item) => ({ ...item })) ?? [],
  });
}
