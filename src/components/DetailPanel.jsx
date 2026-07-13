import { TYPES } from '../scene/tileBuilders';
import { tr } from '../i18n';
import { useSwipeHorizontal } from '../lib/gestures';

export default function DetailPanel({ event, onClose, onEdit, onDelete, onNavigate }) {
  const ty = TYPES.find((x) => x.key === event.type);
  // swipe left → next memory, swipe right → previous
  const swipe = useSwipeHorizontal(() => onNavigate && onNavigate(1), () => onNavigate && onNavigate(-1));

  function handleDelete() {
    if (window.confirm(tr('dp_delete_confirm'))) {
      onDelete(event);
    }
  }

  return (
    <div className="detail-panel">
      <div className="inner" {...swipe}>
        <button className="close" onClick={onClose}>×</button>
        {ty && (
          <p className="kind detail-kind">
            {ty.iconPath ? <img src={ty.iconPath} alt="" className="detail-kind-icon" /> : ty.icon}
            <span>{tr('type_' + event.type)}</span>
          </p>
        )}
        <h3>{event.date}</h3>
        {event.photo && <img src={event.photo} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 6, marginBottom: 10 }} />}
        {event.note
          ? <p className="note">{event.note}</p>
          : <p className="note" style={{ color: 'var(--parchment-dim)' }}>{tr('dp_no_note')}</p>}
        <div className="detail-actions">
          <button className="link-btn" onClick={() => onEdit(event)}>{tr('dp_edit')}</button>
          <button className="link-btn danger" onClick={handleDelete}>{tr('dp_delete')}</button>
        </div>
      </div>
    </div>
  );
}
