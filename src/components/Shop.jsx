import { useState } from 'react';
import {
  SHOP_ITEMS,
  CATEGORIES,
  isExclusiveCategory,
  settingKeyForCategory,
  isOwned,
  itemPrice,
  parseKeySet,
} from '../lib/economy';
import { tr } from '../i18n';
import { useSwipeDownClose } from '../lib/gestures';

export default function Shop({ balance, purchases, settings, hasLake, onBuy, onActivate, onToggle, onClose, isLocked }) {
  const [section, setSection] = useState(CATEGORIES[0].key);
  const off = parseKeySet(settings.effects_off);
  const cat = CATEGORIES.find((c) => c.key === section) || CATEGORIES[0];
  const exclusive = isExclusiveCategory(cat.key);
  const activeKey = exclusive ? settings[settingKeyForCategory(cat.key)] : null;
  const items = SHOP_ITEMS.filter((i) => i.category === cat.key);
  const { elRef, swipeHandlers } = useSwipeDownClose(onClose);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal shop" ref={elRef} {...swipeHandlers}>
        <div className="shop-head">
          <h2>{tr('shop_title')}</h2>
          <div className="coin-balance mono">🪙 {balance}</div>
        </div>
        <p className="sub">{tr('shop_sub')}</p>

        <div className="shop-tabs-wrap">
          <div className="shop-tabs">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                className={`shop-tab ${c.key === section ? 'active' : ''}`}
                onClick={() => setSection(c.key)}
              >
                {tr('cat_' + c.key)}
              </button>
            ))}
          </div>
          <div className="shop-tabs-more" aria-hidden="true">›</div>
        </div>

        <div className="shop-items">
          {items.map((item) => {
            const owned = isOwned(item.key, purchases);
            const price = itemPrice(item.key);
            const affordable = balance >= price;
            const needsLake = item.requires === 'lake';
            const buyLabel = price > 0 ? `🪙 ${price}` : tr('shop_take');

            let action;
            if (exclusive) {
              if (activeKey === item.key) {
                action = <span className="shop-tag active">{tr('shop_active')}</span>;
              } else if (owned) {
                action = <button className="btn shop-btn" onClick={() => onActivate(cat.key, item.key)}>{tr('shop_choose')}</button>;
              } else {
                action = (
                  <button className="btn btn-primary shop-btn" disabled={!affordable} onClick={() => onBuy(item)}>
                    {buyLabel}
                  </button>
                );
              }
            } else if (owned) {
              // additive: on/off toggle
              const on = !off.has(item.key);
              action = (
                <button className={`btn shop-btn toggle ${on ? 'on' : ''}`} onClick={() => onToggle(item)}>
                  {on ? tr('shop_on') : tr('shop_off')}
                </button>
              );
            } else {
              action = (
                <button className="btn btn-primary shop-btn" disabled={!affordable} onClick={() => onBuy(item)}>
                  {buyLabel}
                </button>
              );
            }

            return (
              <div className={`shop-item ${owned ? 'owned' : ''}`} key={item.key}>
                <div className="shop-emoji">
                  {item.iconPath ? <img src={item.iconPath} alt="" className="shop-icon" /> : item.emoji}
                </div>
                <div className="shop-info">
                  <div className="shop-name">
                    {tr('item_' + item.key + '_name')}
                    {isLocked && isLocked(item.key) && <span className="shop-lock">✨</span>}
                  </div>
                  <div className="shop-desc">
                    {tr('item_' + item.key + '_desc')}
                    {needsLake && !hasLake && <span className="shop-need"> · {tr('shop_need_lake')}</span>}
                  </div>
                </div>
                <div className="shop-action">{action}</div>
              </div>
            );
          })}
        </div>

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{tr('close')}</button>
        </div>
      </div>
    </div>
  );
}
