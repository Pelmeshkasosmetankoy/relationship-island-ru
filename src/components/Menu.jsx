import { useState, useRef } from 'react';
import { tr } from '../i18n';

const svgProps = {
  width: 23, height: 23, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
};

const ICONS = {
  calendar: (
    <svg {...svgProps}><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" /></svg>
  ),
  shop: (
    <svg {...svgProps}><path d="M6 8h12l-1 11H7L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
  ),
  heart: (
    <svg {...svgProps}><path d="M12 20s-6.6-4.2-9.1-8.3C1 8.6 2.5 5.4 6 5.4c2 0 3.2 1.3 4 2.6.8-1.3 2-2.6 4-2.6 3.5 0 5 3.2 3.1 6.3C18.6 15.8 12 20 12 20z" /></svg>
  ),
  gear: (
    <svg {...svgProps}><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" /></svg>
  ),
  share: (
    <svg {...svgProps}><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8.1 10.9 15.9 7.1M8.1 13.1 15.9 16.9" /></svg>
  ),
  logout: (
    <svg {...svgProps}><path d="M14 8V6.5A2.5 2.5 0 0 0 11.5 4h-5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h5a2.5 2.5 0 0 0 2.5-2.5V16" /><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" /></svg>
  ),
  help: (
    <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M9.4 9.3a2.6 2.6 0 0 1 5 1c0 1.7-2.4 1.9-2.4 3.4" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></svg>
  ),
  exit: (
    <svg {...svgProps}><path d="M12 3.5v8" /><path d="M7.4 6.6a7 7 0 1 0 9.2 0" /></svg>
  ),
  couple: (
    <svg {...svgProps}><circle cx="8" cy="8" r="2.6" /><circle cx="16" cy="8" r="2.6" /><path d="M3.5 19v-1a4 4 0 0 1 4-4h1a4 4 0 0 1 4 4v1M11.5 19v-1a4 4 0 0 1 4-4h1a4 4 0 0 1 4 4v1" /></svg>
  ),
  jar: (
    <svg {...svgProps}><path d="M8.5 3.5h7M8 6.3h8" /><path d="M8 6.3c-1 1.9-1.5 3.4-1.5 6.2v3.5A2.5 2.5 0 0 0 9 18.5h6a2.5 2.5 0 0 0 2.5-2.5V12.5c0-2.8-.5-4.3-1.5-6.2" /><path d="M12 10.5v4M10 12.5h4" /></svg>
  ),
};

const CoinIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.6 10.4c0-1 1-1.4 2.4-1.4s2.4.5 2.4 1.5-1 1.5-2.4 1.5-2.4.5-2.4 1.5 1 1.5 2.4 1.5 2.4-.4 2.4-1.4" />
  </svg>
);

export default function Menu({ code, balance, onCalendar, onShop, onWishes, onFigures, onJar, onHelp, onSettings, onShare, onLeave, onSignOut, onClose }) {
  // drag the sheet down to dismiss it
  const [dragY, setDragY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const startY = useRef(null);
  const previousY = useRef(0);
  const previousTime = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const dragYRef = useRef(0);
  const dragging = useRef(false);

  function updateDragY(value) {
    dragYRef.current = value;
    setDragY(value);
  }

  function closeSheet() {
    if (isClosing) return;
    // the .sheet.is-closing class slides it to translateY(100%) with a CSS
    // transition; unmount only after that slide has finished so it isn't abrupt
    setIsClosing(true);
    window.setTimeout(onClose, 280);
  }

  function handleDragStart(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const y = e.clientY;
    dragging.current = true;
    startY.current = y;
    previousY.current = y;
    previousTime.current = performance.now();
    lastY.current = y;
    lastTime.current = previousTime.current;
    updateDragY(0);
  }
  function handleDragMove(e) {
    if (!dragging.current || startY.current == null) return;
    const y = e.clientY;
    const now = performance.now();
    const dy = y - startY.current;
    if (dy > 0) e.preventDefault();
    previousY.current = lastY.current;
    previousTime.current = lastTime.current;
    lastY.current = y;
    lastTime.current = now;
    updateDragY(dy > 0 ? dy : 0);
  }
  function handleDragEnd(e) {
    if (!dragging.current) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const elapsed = Math.max(1, lastTime.current - previousTime.current);
    const velocity = Math.max(0, (lastY.current - previousY.current) / elapsed);
    const currentDragY = dragYRef.current;
    if (currentDragY > 90 || (currentDragY > 36 && velocity > 0.45)) closeSheet();
    else updateDragY(0);
    startY.current = null;
    dragging.current = false;
  }

  const groups = [
    // what to look at — the heart of the app
    [
      { icon: 'calendar', label: tr('menu_calendar'), action: onCalendar },
      { icon: 'heart', label: tr('menu_wishes'), action: onWishes },
      { icon: 'jar', label: tr('menu_jar'), action: onJar },
      { icon: 'shop', label: tr('menu_improvements'), action: onShop },
      { icon: 'couple', label: tr('menu_figures'), action: onFigures },
    ],
    // everything else
    [
      { icon: 'help', label: tr('menu_help'), action: onHelp },
      { icon: 'gear', label: tr('menu_settings'), action: onSettings },
      { icon: 'share', label: tr('menu_share'), action: onShare },
    ],
    // leaving — kept apart and muted so they aren't tapped by accident
    [
      { icon: 'logout', label: tr('menu_leave'), action: onLeave, muted: true },
      { icon: 'exit', label: tr('menu_signout'), action: onSignOut, muted: true },
    ],
  ];

  return (
    <div className={`sheet-overlay ${isClosing ? 'is-closing' : ''}`} onClick={closeSheet}>
      <div
        className={`sheet ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={dragY && !isClosing ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="sheet-drag-zone"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="sheet-handle" />
          <div className="sheet-head">
            <span className="mono">{tr('menu_code')} <b>{tr('menu_code_private')}</b></span>
            <span className="sheet-coins"><CoinIcon /> {balance}</span>
          </div>
        </div>
        <div className="sheet-items">
          {groups.map((group, gi) => (
            <div className={`sheet-group ${gi > 0 ? 'sheet-group-sep' : ''}`} key={gi}>
              {group.map((it) => (
                <button
                  key={it.label}
                  className={`sheet-item ${it.muted ? 'sheet-item-muted' : ''}`}
                  onClick={it.action}
                >
                  <span className="sheet-item-icon">{ICONS[it.icon]}</span>
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
