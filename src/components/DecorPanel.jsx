import { DECOR_BY_KEY } from '../lib/decor';

// Нижняя панель обустройства острова: вкладки «Площадки» и «Предметы».
// Остров над панелью остаётся видимым и кликабельным (расстановка идёт по нему).
const PLOT_COLORS = ['#74b85a', '#8fd6c0', '#7bb6d8', '#b894d8', '#f2b0cf', '#e8d79a', '#d0a878', '#c0c8d2', '#e0b060'];

export default function DecorPanel({
  items, inventory = {}, selectedPlot, selectedPlotColor = '', onPlotColor, onRemovePlot,
  tab, onTab, placeKey, onBuy, onPickItem, onStopPlacing,
  selectedId, onRotate, onDelete, onClose,
}) {
  const activeColor = selectedPlotColor || PLOT_COLORS[0];
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
        <>
          <p className="decor-hint">
            Нажмите на подсвеченную зелёную клетку рядом с островом, чтобы <b>добавить</b> площадку.
            Нажмите на существующую площадку, чтобы <b>покрасить</b> или <b>убрать</b> её.
          </p>
          {selectedPlot ? (
            <>
              <div className="decor-colors">
                <span className="decor-colors-label">Цвет площадки:</span>
                <div className="decor-swatches">
                  {PLOT_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`decor-swatch ${activeColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => onPlotColor(c)}
                      aria-label={`Цвет ${c}`}
                    />
                  ))}
                </div>
              </div>
              <button className="btn btn-danger" style={{ marginTop: 4 }} onClick={onRemovePlot}>🗑 Убрать эту площадку</button>
            </>
          ) : (
            <p className="decor-hint" style={{ opacity: 0.75 }}>Выберите площадку — нажмите на неё, — чтобы покрасить или убрать.</p>
          )}
        </>
      )}

      {tab === 'items' && (
        <>
          {placing && (
            <div className="decor-placing">
              <p className="decor-hint">Ставлю: <b>{DECOR_BY_KEY[placeKey]?.name || placeKey}</b>. Перетащите на травяную площадку — зелёным можно, красным нельзя. Можно ставить сколько угодно.</p>
              <button className="btn" onClick={onStopPlacing}>Хватит ставить</button>
            </div>
          )}
          {selectedId && (
            <div className="decor-edit">
              <p className="decor-hint">Выбран предмет — перетащите, чтобы передвинуть.</p>
              <div className="decor-edit-btns">
                <button className="btn" onClick={onRotate}>↻ Повернуть</button>
                <button className="btn btn-danger" onClick={onDelete}>🗑 Удалить</button>
              </div>
            </div>
          )}
          {!placing && !selectedId && (
            <p className="decor-hint">Купите предмет кнопкой <b>＋</b> — он попадёт на склад. Затем нажмите на него, чтобы ставить на площадки. Нажатие на стоящий предмет — передвинуть/повернуть/удалить.</p>
          )}
          <div className="decor-grid">
            {items.map((it) => {
              const owned = inventory[it.key] || 0;
              return (
                <div key={it.key} className={`decor-item ${placeKey === it.key ? 'active' : ''}`}>
                  <button
                    className="decor-item-main"
                    disabled={owned === 0}
                    onClick={() => onPickItem(it.key)}
                    title={owned === 0 ? 'Сначала купите' : 'Ставить'}
                  >
                    <span className="decor-item-icon">{it.icon}</span>
                    <span className="decor-item-name">{it.name}</span>
                    <span className="decor-item-count">склад: {owned}</span>
                  </button>
                  <button className="decor-item-buy" onClick={() => onBuy(it.key)}>
                    ＋ {it.price > 0 ? `${it.price} 🪙` : 'Купить'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
