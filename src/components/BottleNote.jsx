import { useState } from 'react';
import { tr } from '../i18n';

// The couple's message in a bottle: view, write and edit a shared note. The note
// lives in world settings (`bottle_note`), so both partners see the same text.
export default function BottleNote({ note = '', onSave, onClose }) {
  const [text, setText] = useState(note);
  const dirty = text !== note;

  function handleSave() {
    onSave(text.trim());
    onClose();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="bottle-emoji">🍾</div>
        <h2>{tr('bottle_title')}</h2>
        <p className="sub">{tr('bottle_sub')}</p>
        <textarea
          className="auth-input bottle-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tr('bottle_ph')}
          maxLength={500}
          autoFocus
        />
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{tr('close')}</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!dirty} onClick={handleSave}>
            {tr('bottle_save')}
          </button>
        </div>
      </div>
    </div>
  );
}
