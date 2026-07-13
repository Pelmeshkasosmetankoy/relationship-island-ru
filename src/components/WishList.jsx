import { useState } from 'react';
import { tr } from '../i18n';
import { useSwipeDownClose } from '../lib/gestures';

export default function WishList({ wishes, onAdd, onToggle, onDelete, onClose }) {
  const [text, setText] = useState('');
  const { elRef, swipeHandlers } = useSwipeDownClose(onClose);

  function handleAdd() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  }

  const active = wishes.filter((w) => !w.done);
  const done = wishes.filter((w) => w.done);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={elRef} {...swipeHandlers}>
        <h2>{tr('wl_title')}</h2>
        <p className="sub">{tr('wl_sub')}</p>

        <div className="wish-add">
          <input
            type="text"
            className="wish-input"
            placeholder={tr('wl_placeholder')}
            value={text}
            maxLength={120}
            autoCapitalize="none"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className="btn btn-primary wish-add-btn" onClick={handleAdd} disabled={!text.trim()}>+</button>
        </div>

        <div className="wish-list">
          {wishes.length === 0 && <p className="wish-empty">{tr('wl_empty')}</p>}

          {active.map((w) => (
            <div className="wish-item" key={w.id}>
              <button className="wish-check" onClick={() => onToggle(w)} aria-label="Отметить выполненным" />
              <span className="wish-text">{w.text}</span>
              <button className="wish-del" onClick={() => onDelete(w)} aria-label="Удалить">✕</button>
            </div>
          ))}

          {done.length > 0 && <div className="wish-done-head">{tr('wl_done')}</div>}
          {done.map((w) => (
            <div className="wish-item done" key={w.id}>
              <button className="wish-check on" onClick={() => onToggle(w)} aria-label="Вернуть в список">✓</button>
              <span className="wish-text">{w.text}</span>
              <button className="wish-del" onClick={() => onDelete(w)} aria-label="Удалить">✕</button>
            </div>
          ))}
        </div>

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{tr('close')}</button>
        </div>
      </div>
    </div>
  );
}
