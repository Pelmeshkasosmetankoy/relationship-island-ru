import { tr } from '../i18n';
import { useSwipeDownClose } from '../lib/gestures';

const STEPS = [
  { emoji: '🏝️', key: 'help_s1' },
  { emoji: '➕', key: 'help_s2' },
  { emoji: '👆', key: 'help_s3' },
  { emoji: '🪙', key: 'help_s4' },
  { emoji: '💛', key: 'help_s5' },
  { emoji: '🔗', key: 'help_s6' },
];

export default function Help({ onClose }) {
  const { elRef, swipeHandlers } = useSwipeDownClose(onClose);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={elRef} {...swipeHandlers}>
        <h2>{tr('help_title')}</h2>
        <div className="help-steps">
          {STEPS.map((s) => (
            <div className="help-step" key={s.key}>
              <div className="help-step-icon">{s.emoji}</div>
              <div>
                <div className="help-step-title">{tr(s.key + '_t')}</div>
                <div className="help-step-text">{tr(s.key + '_d')}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>{tr('help_got_it')}</button>
        </div>
      </div>
    </div>
  );
}
