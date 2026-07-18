import { DECOR_BY_KEY } from '../lib/decor';

// Нижняя панель обустройства острова: вкладки «Площадки» и «Предметы».
// Остров над панелью остаётся видимым и кликабельным (расстановка идёт по нему).
export default function DecorPanel({
  items, tab, onTab, placeKey, onPickItem, onStopPlacing,
  selectedId, onRotate, onDelete, onClose,
}) {
  const placing = !!placeKey;
  return (
    <div className="decor-panel">
      <div className="decor-head">
        <span className="decor-title">🪴 Обустройство острова</span>
        <button className="decor-close" onClick={onClose} aria-label="Закрыть">✕</button>
      </div>

      <div className="decor-tabs">
        <button className={`decor-tab ${tab === 'plots' ? 'active' : ''}`} onClick={() => onTab('plots')}>Площадки</button>
        <button className={`decor-tab ${tab === 'items' ? 'active' : ''}`} onClick={() => onTab('items')}>Предметы</button>
      </div>

      {tab === 'plots' && (
        <p className="decor-hint">
          Нажмите на подсвеченную зелёную клетку рядом с островом, чтобы <b>добавить</b> площадку.
          Нажмите на площадку — чтобы <b>убрать</b> её.
        </p>
      )}

      {tab === 'items' && placing && (
        <div className="decor-placing">
          <p className="decor-hint">Ставлю: <b>{DECOR_BY_KEY[placeKey]?.name || placeKey}</b>. Перетащите на травяную площадку. Зелёным — можно, красным — нельзя.</p>
          <button className="btn btn-primary" onClick={onStopPlacing}>Готово</button>
        </div>
      )}

      {tab === 'items' && !placing && (
        <>
          {selectedId ? (
            <div className="decor-edit">
              <p className="decor-hint">Выбран предмет. Перетащите, чтобы передвинуть.</p>
              <div className="decor-edit-btns">
                <button className="btn" onClick={onRotate}>↻ Повернуть</button>
                <button className="btn btn-danger" onClick={onDelete}>🗑 Удалить</button>
              </div>
            </div>
          ) : (
            <p className="decor-hint">Выберите предмет, чтобы поставить. Нажмите на уже стоящий предмет на острове, чтобы его передвинуть, повернуть или удалить.</p>
          )}
          <div className="decor-grid">
            {items.map((it) => (
              <button key={it.key} className="decor-item" onClick={() => onPickItem(it.key)}>
                <span className="decor-item-icon">{it.icon}</span>
                <span className="decor-item-name">{it.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
