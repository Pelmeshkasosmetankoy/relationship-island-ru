import { useState } from 'react';
import { tr } from '../i18n';
import { useSwipeDownClose } from '../lib/gestures';
import { exportPdf, exportZip } from '../lib/exporter';

// pretty-print the raw 14-char recovery code as XXXX-XXXXX-XXXXX
function formatRecovery(rc) {
  const s = (rc || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return [s.slice(0, 4), s.slice(4, 9), s.slice(9, 14)].filter(Boolean).join('-');
}

export default function Settings({ lang, onSetLang, onAbout, onClose, events, code, islandName, onSetIslandName, onCreateRecovery, onDeleteAccount }) {
  const { elRef, swipeHandlers } = useSwipeDownClose(onClose);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [name, setName] = useState(islandName || '');
  const [recovery, setRecovery] = useState(null);
  const [recBusy, setRecBusy] = useState(false);
  const [recStatus, setRecStatus] = useState(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState(null);

  const confirmWord = tr('set_delete_word');

  async function doDelete() {
    if (delBusy || delText.trim().toUpperCase() !== confirmWord) return;
    setDelBusy(true);
    setDelError(null);
    try {
      await onDeleteAccount(); // signs out on success → returns to the auth screen
    } catch (e) {
      console.error('Delete account failed:', e);
      setDelError(tr('set_delete_fail'));
      setDelBusy(false);
    }
  }

  async function genRecovery() {
    if (recBusy) return;
    setRecBusy(true);
    setRecStatus(null);
    try {
      const rc = await onCreateRecovery();
      setRecovery(rc);
    } catch (e) {
      console.error('Recovery code failed:', e);
      setRecStatus(tr('set_recovery_fail'));
    } finally {
      setRecBusy(false);
    }
  }

  async function copyRecovery() {
    try {
      await navigator.clipboard.writeText(formatRecovery(recovery));
      setRecStatus(tr('set_recovery_copied'));
    } catch { /* clipboard unavailable */ }
  }

  async function runExport(kind) {
    if (busy) return;
    if (!events || events.length === 0) { setStatus(tr('export_empty')); return; }
    setBusy(true);
    setStatus(tr('export_working'));
    try {
      const onProgress = (i, n) => setStatus(tr('export_progress', { i, n }));
      if (kind === 'pdf') await exportPdf(events, code, onProgress);
      else await exportZip(events, code, onProgress);
      setStatus(tr('export_done'));
    } catch (e) {
      console.error('Export failed:', e);
      setStatus(tr('export_error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={elRef} {...swipeHandlers}>
        <h2>{tr('set_title')}</h2>

        <label className="field-label">{tr('set_language')}</label>
        <div className="lang-toggle">
          <button
            className={`lang-opt ${lang === 'ru' ? 'active' : ''}`}
            onClick={() => onSetLang('ru')}
          >
            Русский
          </button>
          <button
            className={`lang-opt ${lang === 'en' ? 'active' : ''}`}
            onClick={() => onSetLang('en')}
          >
            English
          </button>
        </div>

        <label className="field-label">{tr('set_island_name')}</label>
        <input
          type="text"
          className="auth-input"
          maxLength={40}
          placeholder={tr('set_island_name_ph')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if ((name || '').trim() !== (islandName || '')) onSetIslandName((name || '').trim()); }}
        />
        <p className="settings-hint" style={{ margin: '0 0 16px' }}>{tr('set_island_name_hint')}</p>

        <label className="field-label">{tr('export_heading')}</label>
        <p className="settings-hint" style={{ margin: '0 0 10px' }}>{tr('export_sub')}</p>
        <div className="export-row">
          <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => runExport('pdf')}>
            {tr('export_pdf')}
          </button>
          <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => runExport('zip')}>
            {tr('export_zip')}
          </button>
        </div>
        {status && <p className="export-status">{busy && <span className="spinner" />}{status}</p>}

        <label className="field-label">{tr('set_recovery_heading')}</label>
        <p className="settings-hint" style={{ margin: '0 0 10px' }}>{tr('set_recovery_hint')}</p>
        {recovery && (
          <div className="recovery-box">
            <div className="recovery-code mono">{formatRecovery(recovery)}</div>
            <p className="recovery-warn">{tr('set_recovery_warn')}</p>
            <button className="btn" onClick={copyRecovery}>{tr('set_recovery_copy')}</button>
          </div>
        )}
        <button className="btn settings-row" disabled={recBusy} onClick={genRecovery}>
          {recBusy ? tr('set_recovery_working') : (recovery ? tr('set_recovery_regen') : tr('set_recovery_btn'))}
        </button>
        {recStatus && <p className="export-status">{recStatus}</p>}

        <button className="btn settings-row" onClick={onAbout}>{tr('set_about')}</button>

        <div className="danger-zone">
          {!delOpen ? (
            <button className="link-btn danger-link" onClick={() => setDelOpen(true)}>{tr('set_delete_link')}</button>
          ) : (
            <div className="danger-box">
              <p className="danger-title">{tr('set_delete_title')}</p>
              <p className="danger-text">{tr('set_delete_warn')}</p>
              <input
                type="text"
                className="auth-input"
                autoCapitalize="characters"
                autoCorrect="off"
                placeholder={tr('set_delete_ph', { word: confirmWord })}
                value={delText}
                onChange={(e) => setDelText(e.target.value)}
              />
              {delError && <p className="error-text">{delError}</p>}
              <button
                className="btn btn-danger"
                disabled={delBusy || delText.trim().toUpperCase() !== confirmWord}
                onClick={doDelete}
              >
                {delBusy ? tr('set_delete_working') : tr('set_delete_btn')}
              </button>
              <button className="link-btn" style={{ marginTop: 8, display: 'block' }} onClick={() => { setDelOpen(false); setDelText(''); setDelError(null); }}>
                {tr('cancel')}
              </button>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{tr('close')}</button>
        </div>
      </div>
    </div>
  );
}
