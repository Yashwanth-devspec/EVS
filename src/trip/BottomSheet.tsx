import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type Snap = 'peek' | 'half' | 'full';

const MIN_PEEK_PX = 176;
const HALF_RATIO = 0.6;
const FULL_RATIO = 0.94;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function snapHeight(snap: Snap, containerH: number, peekPx: number): number {
  const full = Math.round(containerH * FULL_RATIO);
  if (snap === 'peek') return Math.min(full, Math.max(MIN_PEEK_PX, peekPx));
  if (snap === 'half') return Math.max(Math.min(full, peekPx + 120), Math.round(containerH * HALF_RATIO));
  return full;
}

interface BottomSheetProps {
  snap: Snap;
  onSnapChange: (s: Snap) => void;
  /** Reports the visible sheet height so the map can keep its subject above it. */
  onHeightChange?: (px: number) => void;
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  isDesktop: boolean;
  /** Changes when the sheet shows a different state; the content scrolls back to the top. */
  contentKey?: string;
}

/**
 * A draggable sheet over the map. On phones it snaps between peek, half and full;
 * on wide screens it becomes a floating panel beside the map.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  snap,
  onSnapChange,
  onHeightChange,
  header,
  footer,
  children,
  isDesktop,
  contentKey,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(0);
  const [peekPx, setPeekPx] = useState(MIN_PEEK_PX);
  const [dragY, setDragY] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startH: number; lastY: number; lastT: number; v: number } | null>(null);

  useLayoutEffect(() => {
    const el = hostRef.current?.parentElement;
    if (!el) return;
    const measure = () => setContainerH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Peek always shows the status lines and the primary button in full
  useLayoutEffect(() => {
    const measure = () => setPeekPx((headRef.current?.offsetHeight ?? 0) + (footRef.current?.offsetHeight ?? 0) + 8);
    measure();
    const ro = new ResizeObserver(measure);
    if (headRef.current) ro.observe(headRef.current);
    if (footRef.current) ro.observe(footRef.current);
    return () => ro.disconnect();
  }, [isDesktop, footer === null]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  const height = dragY !== null ? dragY : snapHeight(snap, containerH, peekPx);

  useEffect(() => {
    if (!onHeightChange || !containerH) return;
    onHeightChange(isDesktop ? 0 : snapHeight(snap, containerH, peekPx));
  }, [snap, containerH, peekPx, isDesktop, onHeightChange]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isDesktop) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { startY: e.clientY, startH: height, lastY: e.clientY, lastT: performance.now(), v: 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = performance.now();
    d.v = (e.clientY - d.lastY) / Math.max(1, t - d.lastT);
    d.lastY = e.clientY;
    d.lastT = t;
    const next = Math.min(containerH * FULL_RATIO, Math.max(peekPx * 0.8, d.startH - (e.clientY - d.startY)));
    setDragY(next);
  };

  const finishDrag = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (!d || dragY === null) {
      setDragY(null);
      return;
    }
    const order: Snap[] = ['peek', 'half', 'full'];
    let target: Snap;
    if (Math.abs(d.v) > 0.6) {
      const idx = order.indexOf(snap);
      target = d.v > 0 ? order[Math.max(0, idx - 1)] : order[Math.min(2, idx + 1)];
    } else {
      target = order.reduce((best, s) =>
        Math.abs(snapHeight(s, containerH, peekPx) - dragY) < Math.abs(snapHeight(best, containerH, peekPx) - dragY) ? s : best
      );
    }
    setDragY(null);
    onSnapChange(target);
  }, [dragY, snap, containerH, peekPx, onSnapChange]);

  const cycle = () => onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');

  if (isDesktop) {
    return (
      <div
        ref={hostRef}
        className="absolute z-[500] top-4 left-4 bottom-4 w-[420px] flex flex-col rounded-3xl bg-ink-950/95 backdrop-blur border border-ink-800 shadow-2xl overflow-hidden"
        data-sheet="desktop"
      >
        <div ref={headRef} className="px-6 pt-6 pb-4 border-b border-ink-800/70">{header}</div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        {footer && <div ref={footRef} className="px-6 pb-6 pt-3 border-t border-ink-800/70 bg-ink-950">{footer}</div>}
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="absolute z-[500] left-0 right-0 bottom-0 flex flex-col rounded-t-[28px] bg-ink-950 border-t border-x border-ink-800 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]"
      style={{
        height,
        transition: dragY !== null ? 'none' : `height 220ms ${EASE}`,
      }}
      data-sheet={snap}
    >
      <div
        ref={headRef}
        className="pt-2.5 pb-3 px-5 touch-none select-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <button
          type="button"
          onClick={cycle}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') onSnapChange(snap === 'peek' ? 'half' : 'full');
            if (e.key === 'ArrowDown') onSnapChange(snap === 'full' ? 'half' : 'peek');
          }}
          className="mx-auto mb-3 block h-5 w-16 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
          aria-label={`Sheet is ${snap === 'peek' ? 'collapsed' : snap === 'half' ? 'half open' : 'fully open'}. Tap to resize.`}
        >
          <span className="block mx-auto h-1.5 w-11 rounded-full bg-ink-700" />
        </button>
        {header}
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
      {footer && (
        <div ref={footRef} className="px-5 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] border-t border-ink-800/70 bg-ink-950">
          {footer}
        </div>
      )}
    </div>
  );
};
