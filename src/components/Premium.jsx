import { useEffect, useMemo, useRef, useState } from 'react';
import { tr } from '../i18n';
import { PACKS, isPackOwned } from '../lib/economy';

// Paywall showing every premium pack as swipeable cards. Payment is a free stub for
// now ("Открыть бесплатно"); "Разблокировать всё" opens every pack at once, and
// "Посмотреть в превью" opens an isolated preview that never touches the real island.
export default function Premium({ initialPack, ownedPacks, onOpenFree, onOpenAll, onTry, onClose }) {
  const packs = useMemo(() => Object.keys(PACKS), []);
  const startIndex = Math.max(0, packs.indexOf(initialPack));
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(startIndex);
  const allOwned = packs.every((p) => isPackOwned(ownedPacks, p));

  // open on the pack that was requested
  useEffect(() => {
    const el = scrollerRef.current;
    const card = el?.children[startIndex];
    if (el && card) el.scrollLeft = card.offsetLeft - (el.clientWidth - card.clientWidth) / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = Array.from(el.children);
    const center = el.scrollLeft + el.clientWidth / 2;
    const i = cards.reduce((best, card, idx) => {
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const dist = Math.abs(cardCenter - center);
      return dist < best.dist ? { idx, dist } : best;
    }, { idx: 0, dist: Infinity }).idx;
    if (i !== index) setIndex(i);
  }

  function scrollToPack(nextIndex) {
    const el = scrollerRef.current;
    const clamped = Math.max(0, Math.min(packs.length - 1, nextIndex));
    const card = el?.children[clamped];
    if (!el || !card) return;
    el.scrollTo({
      left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2,
      behavior: 'smooth',
    });
    setIndex(clamped);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal premium-modal premium-multi">
        <div className="premium-badge">✨ {tr('premium_badge')}</div>

        {packs.length > 1 && (
          <div className="premium-carousel-head">
            <button className="premium-nav" onClick={() => scrollToPack(index - 1)} disabled={index === 0} aria-label={tr('fp_prev')}>‹</button>
            <div>
              <div className="premium-carousel-count">{index + 1} / {packs.length}</div>
              <div className="premium-carousel-hint">Листайте карточки вбок</div>
            </div>
            <button className="premium-nav" onClick={() => scrollToPack(index + 1)} disabled={index === packs.length - 1} aria-label={tr('fp_next')}>›</button>
          </div>
        )}

        <div className="premium-carousel" ref={scrollerRef} onScroll={handleScroll}>
          {packs.map((pack) => {
            const owned = isPackOwned(ownedPacks, pack);
            const items = tr('pack_' + pack + '_items').split('|');
            return (
              <div className="premium-card" key={pack}>
                <h2>{tr('pack_' + pack + '_title')}</h2>
                <p className="sub">{tr('pack_' + pack + '_desc')}</p>
                <ul className="premium-list">
                  {items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
                {owned ? (
                  <div className="premium-owned-tag">✓ {tr('premium_owned')}</div>
                ) : (
                  <>
                    <button className="btn btn-primary" onClick={() => onOpenFree(pack)}>{tr('premium_open_free')}</button>
                    <button className="btn" onClick={() => onTry(pack)}>{tr('premium_try')}</button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {packs.length > 1 && (
          <div className="premium-dots">
            {packs.map((p, i) => <span key={p} className={`premium-dot ${i === index ? 'active' : ''}`} />)}
          </div>
        )}

        {!allOwned && (
          <button className="btn btn-primary premium-unlock-all" onClick={onOpenAll}>
            {tr('premium_unlock_all')}
          </button>
        )}
        <button className="link-btn" style={{ marginTop: 12, display: 'block' }} onClick={onClose}>
          {tr('close')}
        </button>
      </div>
    </div>
  );
}
