import { useMemo, useState } from 'react';
import { getLanguage, tr } from '../i18n';
import { useSwipeHorizontal } from '../lib/gestures';

const WEEKDAYS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function MemoryCalendar({ events, onSelect, onClose }) {
  const todayKey = dateKey(new Date());
  const initial = events.length ? new Date(events[events.length - 1].dateISO) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const lang = getLanguage();

  const eventsByDate = useMemo(() => {
    const grouped = new Map();
    events.forEach((event) => {
      const key = dateKey(new Date(event.dateISO));
      grouped.set(key, [...(grouped.get(key) || []), event]);
    });
    return grouped;
  }, [events]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const monthTitle = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
    month: 'long', year: 'numeric',
  }).format(visibleMonth);

  function moveMonth(delta) {
    setVisibleMonth(new Date(year, month + delta, 1));
  }

  // swipe left → next month, swipe right → previous month
  const swipe = useSwipeHorizontal(() => moveMonth(1), () => moveMonth(-1));

  return (
    <div className="calendar-overlay">
      <div className="calendar-card">
        <div className="calendar-head">
          <div>
            <p className="eyebrow">{tr('calendar_eyebrow')}</p>
            <h2>{tr('calendar_title')}</h2>
          </div>
          <button className="calendar-close" onClick={onClose} aria-label={tr('close')}>×</button>
        </div>
        <div className="calendar-month-nav">
          <button onClick={() => moveMonth(-1)} aria-label={tr('calendar_prev')}>‹</button>
          <strong>{monthTitle}</strong>
          <button onClick={() => moveMonth(1)} aria-label={tr('calendar_next')}>›</button>
        </div>
        <div className="calendar-grid calendar-weekdays">
          {WEEKDAYS[lang].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid calendar-days" {...swipe}>
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-empty" key={`empty-${index}`} />;
            const key = dateKey(new Date(year, month, day));
            const dayEvents = eventsByDate.get(key) || [];
            const classNames = [dayEvents.length ? 'has-memory' : '', key === todayKey ? 'is-today' : ''].filter(Boolean).join(' ');
            return (
              <button
                key={key}
                className={classNames}
                disabled={!dayEvents.length}
                onClick={() => onSelect(dayEvents[0])}
                aria-label={dayEvents.length ? tr('calendar_memories', { count: dayEvents.length }) : undefined}
              >
                <span>{day}</span>
                {dayEvents.length > 1 && <small>{dayEvents.length}</small>}
              </button>
            );
          })}
        </div>
        <p className="calendar-hint">{tr('calendar_hint')}</p>
      </div>
    </div>
  );
}
