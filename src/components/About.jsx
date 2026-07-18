import { useState } from 'react';
import { tr } from '../i18n';
import { useSwipeDownClose } from '../lib/gestures';

const CREDITS = [
  { name: 'Fountain', author: 'Poly by Google' },
  { name: 'Coast', author: 'Poly by Google' },
  { name: 'Tree', author: 'konta johanna' },
  { name: 'Sunflower', author: 'Poly by Google' },
  { name: 'Fall Tree V1', author: 'Danni Bittman' },
  { name: 'Crocodile', author: 'jeremy' },
  { name: 'Duck', author: 'Ashley Alicea' },
  { name: 'Flying gull', author: 'Poly by Google' },
];

export default function About({ onClose }) {
  const [view, setView] = useState('about');
  const { elRef, swipeHandlers } = useSwipeDownClose(onClose);
  const showingCredits = view === 'credits';

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && (showingCredits ? setView('about') : onClose())}>
      <div className="modal" ref={elRef} {...swipeHandlers}>
        {showingCredits ? (
          <>
            <h2>{tr('credits_title')}</h2>
            <p className="credits-note">{tr('set_credits_note')}</p>
            <ul className="credits-list">
              {CREDITS.map((c) => (
                <li key={c.name}><span className="credits-name">{c.name}</span> - {c.author} - CC-BY - Poly Pizza</li>
              ))}
            </ul>

            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setView('about')}>{tr('back')}</button>
            </div>
          </>
        ) : (
          <>
            <h2>{tr('set_about')}</h2>
            <p className="sub">{tr('about_desc')}</p>
            <p className="about-version">{tr('about_version')} 0.1.0</p>
            <p className="about-version">Made by Dasha Ananyeva</p>

            <button className="btn settings-row" onClick={() => setView('credits')}>{tr('credits_link')}</button>

            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn" style={{ flex: 1 }} onClick={onClose}>{tr('close')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
