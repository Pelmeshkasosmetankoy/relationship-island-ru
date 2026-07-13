import { useState, useLayoutEffect } from 'react';
import { tr } from '../i18n';

// Each step points at a UI element (by CSS selector). A null selector shows a
// centered card (used for the "spin the island" step).
const STEPS = [
  { sel: '.fab-add', t: 'tour_s1_t', d: 'tour_s1_d' },
  { sel: null, t: 'tour_s2_t', d: 'tour_s2_d' },
  { sel: '.coin-btn', t: 'tour_s3_t', d: 'tour_s3_d' },
  { sel: '.coin-btn', t: 'tour_shop_t', d: 'tour_shop_d' },
  { sel: '.menu-btn', t: 'tour_s4_t', d: 'tour_s4_d' },
];

export default function Tour({ onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useLayoutEffect(() => {
    function measure() {
      if (!step.sel) { setRect(null); return; }
      const el = document.querySelector(step.sel);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [i, step.sel]);

  const next = () => (last ? onClose() : setI(i + 1));

  // tooltip position: below a top target, above a bottom target, else centered
  let tipStyle;
  if (rect) {
    const belowTarget = rect.top < window.innerHeight / 2;
    tipStyle = belowTarget
      ? { top: rect.bottom + 14 }
      : { bottom: window.innerHeight - rect.top + 14 };
  } else {
    tipStyle = { top: '38%' };
  }

  return (
    <div className="tour">
      <div className="tour-catch" />
      {rect ? (
        <div
          className="tour-spot"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}

      <div className="tour-tip" style={tipStyle}>
        <div className="tour-tip-step">{i + 1} / {STEPS.length}</div>
        <div className="tour-tip-title">{tr(step.t)}</div>
        <div className="tour-tip-text">{tr(step.d)}</div>
        <div className="tour-tip-actions">
          <button className="link-btn" onClick={onClose}>{tr('tour_skip')}</button>
          <button className="btn btn-primary tour-next" onClick={next}>
            {last ? tr('tour_done') : tr('tour_next')}
          </button>
        </div>
      </div>
    </div>
  );
}
