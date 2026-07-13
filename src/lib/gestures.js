import { useRef } from 'react';

// Swipe DOWN from the top of a modal card to dismiss it. Attach elRef to the
// card and spread swipeHandlers on it. Two guards keep it from fighting normal
// use: it only starts (1) when the scroll area is at the very top and (2) when
// the gesture begins in the top ~130px of the card (the title area, not the
// scrollable body). Pass scrollRef when the scrolling element is a child.
// It only observes the gesture (no transform, no preventDefault), so scrolling
// and inner button taps keep working.
export function useSwipeDownClose(onClose, scrollRef) {
  const elRef = useRef(null);
  const start = useRef(null);

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const scEl = (scrollRef && scrollRef.current) || elRef.current;
    if (scEl && scEl.scrollTop > 0) { start.current = null; return; }
    const el = elRef.current;
    if (el && e.clientY - el.getBoundingClientRect().top > 130) { start.current = null; return; }
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    if (dy > 70 && dy > Math.abs(dx) * 1.4) onClose();
  }
  function cancel() { start.current = null; }

  return { elRef, swipeHandlers: { onPointerDown, onPointerUp, onPointerCancel: cancel } };
}

// Horizontal swipe for paging (calendar months, flipping through memories).
// Fires onLeft for a left swipe, onRight for a right swipe. It fires DURING the
// move (as soon as the threshold is crossed) rather than on release, so the
// WebView can't cancel the gesture as "scroll" before we act on it. Pair with
// `touch-action: pan-y` on the element so horizontal moves reach us uncancelled.
export function useSwipeHorizontal(onLeft, onRight) {
  const start = useRef(null);
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, fired: false };
  }
  function onPointerMove(e) {
    const s = start.current;
    if (!s || s.fired) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      s.fired = true;
      if (dx < 0) onLeft && onLeft(); else onRight && onRight();
    }
  }
  function end() { start.current = null; }
  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}
