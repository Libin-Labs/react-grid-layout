import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import test from 'node:test';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  Element: { configurable: true, value: dom.window.Element },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});

interface ObserverRecord {
  callback: ResizeObserverCallback;
  disconnected: boolean;
}

const observers: ObserverRecord[] = [];

class TestResizeObserver {
  private readonly record: ObserverRecord;

  constructor(callback: ResizeObserverCallback) {
    this.record = { callback, disconnected: false };
    observers.push(this.record);
  }

  observe(target: Element): void {
    this.record.callback(
      [
        {
          target,
          contentRect: { width: 400 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }

  disconnect(): void {
    this.record.disconnected = true;
  }

  unobserve(): void {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: TestResizeObserver,
});

const pointerEvent = (
  targetWindow: typeof window,
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
): MouseEvent => {
  const event = new targetWindow.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
    clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
};

test('pointer interactions capture, apply final release coordinates, cancel, and dispose observers', async () => {
  const React = await import('react');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { GridLayout } = await import('../src/index.js');
  const host = document.createElement('main');
  document.body.append(host);
  const root = createRoot(host);
  const changes: number[] = [];

  await act(async () => {
    root.render(
      React.createElement(
        GridLayout,
        {
          initialLayout: [
            { i: 'a', x: 0, y: 0, w: 1, h: 1 },
            { i: 'b', x: 3, y: 0, w: 1, h: 1, static: true },
          ],
          cols: 4,
          rowHeight: 50,
          gap: 0,
          compactType: null,
          onLayoutChange: (layout) => changes.push(layout[0].x),
        },
        React.createElement('div', { key: 'a' }, 'Movable'),
        React.createElement('div', { key: 'b' }, 'Fixed'),
      ),
    );
  });

  const grid = host.querySelector('[role="grid"]') as HTMLElement;
  const movable = host.querySelector('[data-grid-id="a"]') as HTMLElement;
  Object.defineProperty(grid, 'getBoundingClientRect', {
    value: () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 100,
        right: 400,
        bottom: 100,
      }) as DOMRect,
  });
  let captured: number | undefined;
  let released: number | undefined;
  Object.assign(movable, {
    setPointerCapture: (id: number) => {
      captured = id;
    },
    hasPointerCapture: (id: number) => captured === id,
    releasePointerCapture: (id: number) => {
      released = id;
      captured = undefined;
    },
  });

  await act(async () => {
    movable.dispatchEvent(pointerEvent(window, 'pointerdown', 7, 0, 0));
    movable.dispatchEvent(pointerEvent(window, 'pointermove', 7, 110, 0));
  });
  assert.equal(movable.dataset.gridX, '1');
  await act(async () => {
    (host.querySelector('[data-grid-id="a"]') as HTMLElement).dispatchEvent(
      pointerEvent(window, 'pointerup', 7, 210, 0),
    );
  });
  assert.equal((host.querySelector('[data-grid-id="a"]') as HTMLElement).dataset.gridX, '2');
  assert.equal(captured, undefined);
  assert.equal(released, 7);
  assert.deepEqual(changes, [1, 2]);

  const currentMovable = host.querySelector('[data-grid-id="a"]') as HTMLElement;
  Object.assign(currentMovable, {
    setPointerCapture: (id: number) => {
      captured = id;
    },
    hasPointerCapture: (id: number) => captured === id,
    releasePointerCapture: (id: number) => {
      released = id;
      captured = undefined;
    },
  });
  await act(async () => {
    currentMovable.dispatchEvent(pointerEvent(window, 'pointerdown', 8, 200, 0));
    currentMovable.dispatchEvent(pointerEvent(window, 'pointermove', 8, 100, 0));
  });
  assert.equal((host.querySelector('[data-grid-id="a"]') as HTMLElement).dataset.gridX, '1');
  await act(async () => {
    (host.querySelector('[data-grid-id="a"]') as HTMLElement).dispatchEvent(
      pointerEvent(window, 'pointercancel', 8, 100, 0),
    );
  });
  assert.equal((host.querySelector('[data-grid-id="a"]') as HTMLElement).dataset.gridX, '2');
  assert.equal(released, 8);

  const finalMovable = host.querySelector('[data-grid-id="a"]') as HTMLElement;
  Object.assign(finalMovable, {
    setPointerCapture: (id: number) => {
      captured = id;
    },
    hasPointerCapture: (id: number) => captured === id,
    releasePointerCapture: (id: number) => {
      released = id;
      captured = undefined;
    },
  });
  await act(async () => {
    finalMovable.dispatchEvent(pointerEvent(window, 'pointerdown', 9, 200, 0));
  });
  await act(async () => root.unmount());
  assert.equal(released, 9);
  assert.equal(observers.at(-1)?.disconnected, true);
  host.remove();
});

test('resize handle and keyboard controls update the same controlled callback shape', async () => {
  const React = await import('react');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { GridLayout } = await import('../src/index.js');
  const host = document.createElement('main');
  document.body.append(host);
  const root = createRoot(host);
  const seen: Array<readonly [number, number]> = [];
  await act(async () => {
    root.render(
      React.createElement(
        GridLayout,
        {
          layout: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }],
          cols: 4,
          rowHeight: 50,
          gap: 0,
          compactType: null,
          onLayoutChange: (layout, meta) => {
            assert.deepEqual(meta, {});
            seen.push([layout[0].x, layout[0].w]);
          },
        },
        React.createElement('div', { key: 'a' }, 'Controlled'),
      ),
    );
  });
  const grid = host.querySelector('[role="grid"]') as HTMLElement;
  Object.defineProperty(grid, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 400, height: 100 }) as DOMRect,
  });
  const handle = host.querySelector('.lp-grid-layout__resize-handle') as HTMLButtonElement;
  let captured: number | undefined;
  Object.assign(handle, {
    setPointerCapture: (id: number) => {
      captured = id;
    },
    hasPointerCapture: (id: number) => captured === id,
    releasePointerCapture: (id: number) => {
      captured = undefined;
    },
  });
  await act(async () => {
    handle.dispatchEvent(pointerEvent(window, 'pointerdown', 3, 100, 50));
    handle.dispatchEvent(pointerEvent(window, 'pointermove', 3, 200, 50));
    handle.dispatchEvent(pointerEvent(window, 'pointerup', 3, 200, 50));
  });
  assert.deepEqual(seen, [[0, 2]]);
  assert.equal(captured, undefined);
  const cell = host.querySelector('[data-grid-id="a"]') as HTMLElement;
  await act(async () => {
    cell.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  });
  assert.deepEqual(seen.at(-1), [1, 1]);
  await act(async () => {
    handle.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        shiftKey: true,
        bubbles: true,
      }),
    );
  });
  assert.deepEqual(seen.at(-1), [0, 2]);

  await act(async () => {
    root.render(
      React.createElement(
        GridLayout,
        {
          layout: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }],
          cols: 4,
          isReadOnly: true,
          onLayoutChange: (layout) => seen.push([layout[0].x, layout[0].w]),
        },
        React.createElement('div', { key: 'a' }, 'Read only'),
      ),
    );
  });
  assert.equal(host.querySelector('.lp-grid-layout__resize-handle'), null);
  const readonlyCell = host.querySelector('[data-grid-id="a"]') as HTMLElement;
  assert.equal(readonlyCell.tabIndex, -1);
  await act(async () => {
    readonlyCell.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
  });
  assert.deepEqual(seen.at(-1), [0, 2]);
  await act(async () => root.unmount());
  host.remove();
});

test('responsive layouts change from ResizeObserver measurements and report breakpoint callbacks', async () => {
  const React = await import('react');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { GridLayout } = await import('../src/index.js');
  const host = document.createElement('main');
  document.body.append(host);
  const root = createRoot(host);
  const callbacks: string[] = [];
  await act(async () => {
    root.render(
      React.createElement(
        GridLayout,
        {
          initialLayouts: { xxs: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }] },
          breakpoints: { wide: 300, narrow: 0 },
          responsiveCols: { wide: 4, narrow: 2 },
          rowHeight: 40,
          onLayoutsChange: (layouts, meta) => {
            callbacks.push(`${meta.breakpoint}:${layouts[meta.breakpoint!].length}`);
          },
        },
        React.createElement('div', { key: 'a' }, 'Responsive'),
      ),
    );
  });
  assert.equal(host.querySelector('[role="grid"]')?.getAttribute('data-breakpoint'), 'wide');
  assert.ok(callbacks.includes('wide:1'));
  await act(async () => root.unmount());
  assert.equal(observers.at(-1)?.disconnected, true);
  host.remove();
});
