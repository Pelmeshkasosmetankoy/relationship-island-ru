import { useRef, useState } from 'react';
import { TYPES, TYPE_CATEGORIES } from '../scene/tileBuilders';
import { tr } from '../i18n';
import { useSwipeDownClose } from '../lib/gestures';

const TYPE_BY_KEY = Object.fromEntries(TYPES.map((t) => [t.key, t]));

function toDateInput(value) {
  const d = value ? new Date(value) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CROP_ASPECT = 16 / 9;
const CROP_OUTPUT_W = 1400;
const CROP_OUTPUT_H = Math.round(CROP_OUTPUT_W / CROP_ASPECT);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropImageFile(file, crop) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = CROP_OUTPUT_W;
    canvas.height = CROP_OUTPUT_H;
    const ctx = canvas.getContext('2d');
    const baseScale = Math.max(CROP_OUTPUT_W / img.naturalWidth, CROP_OUTPUT_H / img.naturalHeight);
    const scale = baseScale * crop.zoom;
    const visibleW = CROP_OUTPUT_W / scale;
    const visibleH = CROP_OUTPUT_H / scale;
    const centerX = (crop.x / 100) * img.naturalWidth;
    const centerY = (crop.y / 100) * img.naturalHeight;
    const sx = clamp(centerX - visibleW / 2, 0, Math.max(0, img.naturalWidth - visibleW));
    const sy = clamp(centerY - visibleH / 2, 0, Math.max(0, img.naturalHeight - visibleH));
    ctx.drawImage(img, sx, sy, visibleW, visibleH, 0, 0, CROP_OUTPUT_W, CROP_OUTPUT_H);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('Crop failed');
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Used both to add a new event and to edit an existing one (pass `event`).
export default function AddEventModal({ onClose, onSave, event }) {
  const editing = !!event;
  const noteRef = useRef(null);
  const [type, setType] = useState(event ? event.type : null);
  // сворачиваемые разделы: по умолчанию открыты все
  const [openCats, setOpenCats] = useState(() => new Set(TYPE_CATEGORIES.map((c) => c.id)));
  const toggleCat = (id) => setOpenCats((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const [note, setNote] = useState(event ? event.note || '' : '');
  const [date, setDate] = useState(toDateInput(event ? event.dateISO : null));
  const [photoFile, setPhotoFile] = useState(null);
  const [cropSourceFile, setCropSourceFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(event ? event.photo : null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [crop, setCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const dragRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const { elRef, swipeHandlers } = useSwipeDownClose(() => { if (!saving) onClose(); }, scrollRef);

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    setPhotoLoading(true);
    try { if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview); } catch { /* ignore */ }
    setCropSourceFile(file);
    setPhotoFile(null);
    setCrop({ x: 50, y: 50, zoom: 1 });
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhotoFile(null);
    setCropSourceFile(null);
    try { if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview); } catch { /* ignore */ }
    setPhotoPreview(null);
    setPhotoLoading(false);
  }

  async function handleSave() {
    if (!type || saving) return;
    setSaving(true);
    setError(null);
    try {
      const croppedPhoto = cropSourceFile ? await cropImageFile(cropSourceFile, crop) : photoFile;
      await onSave({ type, note, photoFile: croppedPhoto, date });
      // on success the parent closes this modal
    } catch (err) {
      console.error('Failed to save event:', err);
      setError(tr('ev_err_save'));
      setSaving(false);
    }
  }

  function scrollToNotes() {
    noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    noteRef.current?.focus({ preventScroll: true });
  }

  function startCropDrag(e) {
    if (!cropSourceFile) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, crop };
  }

  function moveCropDrag(e) {
    if (!dragRef.current) return;
    const start = dragRef.current;
    const factor = 0.78 / crop.zoom;
    setCrop({
      ...start.crop,
      x: clamp(start.crop.x - (e.clientX - start.x) * factor, 0, 100),
      y: clamp(start.crop.y - (e.clientY - start.y) * factor, 0, 100),
    });
  }

  function endCropDrag() {
    dragRef.current = null;
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal modal-form" ref={elRef} {...swipeHandlers}>
        <div className="modal-scroll" ref={scrollRef}>
        <h2>{editing ? tr('ev_edit_title') : tr('ev_add_title')}</h2>
        <p className="sub">{tr('ev_sub')}</p>
        <div className="type-cats">
          {TYPE_CATEGORIES.map((cat) => {
            const open = openCats.has(cat.id);
            const hasSelected = cat.keys.includes(type);
            return (
              <div className={`type-cat ${open ? 'open' : ''}`} key={cat.id} style={{ '--cat-accent': cat.accent }}>
                <button type="button" className="type-cat-header" onClick={() => toggleCat(cat.id)}>
                  <span className="type-cat-emoji">{cat.icon}</span>
                  <span className="type-cat-text">
                    <span className="type-cat-title">
                      {tr('evcat_' + cat.id + '_title')}
                      {hasSelected && !open && <span className="type-cat-dot" />}
                    </span>
                    <span className="type-cat-sub">{tr('evcat_' + cat.id + '_sub')}</span>
                  </span>
                  <svg className="type-cat-chevron" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {open && (
                  <div className="type-grid">
                    {cat.keys.map((key) => {
                      const t = TYPE_BY_KEY[key];
                      if (!t) return null;
                      return (
                        <div
                          key={key}
                          className={`type-opt ${type === key ? 'selected' : ''}`}
                          onClick={() => setType(key)}
                        >
                          <div className="type-icon">
                            {t.iconPath ? <img src={t.iconPath} alt="" className="event-type-icon" /> : t.icon}
                          </div>
                          {tr('type_' + key)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <label className="field-label">{tr('ev_when')}</label>
        <input type="date" className="date-input" value={date} onChange={(e) => setDate(e.target.value)} />

        <textarea
          ref={noteRef}
          placeholder={tr('ev_note_ph')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <label className="photo-label">
          {photoPreview ? (
            <div
              className={`photo-cropper ${cropSourceFile ? 'editable' : ''}`}
              onPointerDown={startCropDrag}
              onPointerMove={moveCropDrag}
              onPointerUp={endCropDrag}
              onPointerCancel={endCropDrag}
              onClick={(e) => { if (cropSourceFile) e.preventDefault(); }}
            >
              {photoLoading && <div className="photo-loading"><span className="spinner" />{tr('ev_photo_loading')}</div>}
              <img
                src={photoPreview}
                className="photo-preview"
                alt=""
                onLoad={() => setPhotoLoading(false)}
                onError={() => {
                  setPhotoLoading(false);
                  setError(tr('ev_err_photo'));
                }}
                style={{
                  objectPosition: `${crop.x}% ${crop.y}%`,
                  transform: `scale(${crop.zoom})`,
                }}
              />
              {cropSourceFile && <div className="photo-crop-hint">{tr('ev_crop_hint')}</div>}
            </div>
          ) : (
            <div className="photo-placeholder">{tr('ev_add_photo')}</div>
          )}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </label>
        {cropSourceFile && (
          <label className="photo-zoom">
            <span>{tr('ev_crop_zoom')}</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={crop.zoom}
              onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))}
            />
          </label>
        )}
        {photoPreview && (
          <button type="button" className="link-btn photo-remove" onClick={removePhoto}>
            {tr('ev_remove_photo')}
          </button>
        )}

        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-floating-controls">
          <button type="button" className="modal-jump" onClick={scrollToNotes} aria-label="To notes">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="modal-actions event-actions">
            <button className="btn event-action-btn" style={{ flex: 1 }} onClick={onClose} disabled={saving}>{tr('cancel')}</button>
            <button className="btn btn-primary event-action-btn" style={{ flex: 1 }} disabled={!type || saving} onClick={handleSave}>
              {saving ? (<><span className="spinner" />{tr('ev_saving')}</>) : (editing ? tr('ev_save') : tr('ev_add'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
