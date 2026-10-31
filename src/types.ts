import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface GridItem {
  readonly i: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly minW?: number;
  readonly minH?: number;
  readonly maxW?: number;
  readonly maxH?: number;
  readonly static?: boolean;
}

export type Layout = readonly GridItem[];

export type Breakpoint = string;
export type ResponsiveLayouts = Readonly<Record<string, Layout | undefined>>;
export type CompactType = 'vertical' | null;

export interface LayoutConstraints {
  readonly cols?: number;
  readonly maxRows?: number;
}

export interface GridLayoutChangeMeta {
  readonly breakpoint?: Breakpoint;
}

export interface GridLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onLayoutChange'> {
  readonly children?: ReactNode;
  readonly layout?: Layout;
  readonly initialLayout?: Layout;
  readonly layouts?: ResponsiveLayouts;
  readonly initialLayouts?: ResponsiveLayouts;
  readonly cols?: number;
  readonly rowHeight?: number;
  readonly gap?: number | readonly [number, number];
  readonly maxRows?: number;
  readonly compactType?: CompactType;
  readonly isDraggable?: boolean;
  readonly isResizable?: boolean;
  readonly isReadOnly?: boolean;
  readonly resizeHandle?: boolean;
  readonly breakpoints?: Readonly<Record<Breakpoint, number>>;
  readonly responsiveCols?: Readonly<Record<Breakpoint, number>>;
  readonly onLayoutChange?: (layout: Layout, meta: GridLayoutChangeMeta) => void;
  readonly onLayoutsChange?: (
    layouts: Readonly<Record<Breakpoint, Layout>>,
    meta: GridLayoutChangeMeta,
  ) => void;
  readonly itemClassName?: string;
  readonly itemStyle?: CSSProperties;
  readonly 'aria-label'?: string;
}

export interface LayoutValidationOptions extends LayoutConstraints {
  readonly allowOverlap?: boolean;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface MoveOptions extends LayoutConstraints {
  readonly compactType?: CompactType;
}

export interface ResizeOptions extends MoveOptions {}
