import { useState } from 'react';
import { tr } from '../i18n';

export default function Onboarding({ onCreate, onJoin, onRecover }) {
  const [mode, setMode] = useState('start'); // start | join | recover
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function go(next) { setMode(next); setError(null); setCode(''); }

  async function handleCreate() {
    setBusy(true);
    try {
      await onCreate();
    } catch (e) {
      setError(tr('ob_err_create'));
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (code.trim().length < 4) {
      setError(tr('ob_err_code_short'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onJoin(code.trim().toUpperCase());
    } catch (e) {
      setError(tr('ob_err_not_found'));
      setBusy(false);
    }
  }

  async function handleRecover() {
    if (code.trim().length < 8) {
      setError(tr('ob_err_code_short'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRecover(code.trim());
    } catch (e) {
      setError(tr('ob_err_recover'));
      setBusy(false);
    }
  }

  if (mode === 'recover') {
    return (
      <div className="screen-center">
        <div className="card">
          <p className="eyebrow">{tr('ob_recover_eyebrow')}</p>
          <h1>{tr('ob_recover_title')}</h1>
          <p className="sub">{tr('ob_recover_sub')}</p>
          <input
            type="text"
            placeholder={tr('ob_recover_ph')}
            maxLength={24}
            value={code}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" disabled={busy} onClick={handleRecover}>
            {tr('ob_recover_btn')}
          </button>
          <button className="link-btn" style={{ marginTop: 14, display: 'block' }} onClick={() => go('start')}>
            {tr('back')}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="screen-center">
        <div className="card">
          <p className="eyebrow">{tr('ob_join_eyebrow')}</p>
          <h1>{tr('ob_join_title')}</h1>
          <p className="sub">{tr('ob_join_sub')}</p>
          <input
            type="text"
            placeholder={tr('ob_join_placeholder')}
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" disabled={busy} onClick={handleJoin}>
            {tr('ob_join_btn')}
          </button>
          <button className="link-btn" style={{ marginTop: 14, display: 'block' }} onClick={() => go('start')}>
            {tr('back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-center">
      <div className="card">
        <p className="eyebrow">{tr('ob_start_eyebrow')}</p>
        <h1>{tr('ob_start_title')}</h1>
        <p className="sub">{tr('ob_start_sub')}</p>
        <button className="btn btn-primary" disabled={busy} onClick={handleCreate}>
          {tr('ob_start_create')}
        </button>
        <div className="divider">{tr('or')}</div>
        <button className="btn" onClick={() => go('join')}>
          {tr('ob_have_code')}
        </button>
        {error && <p className="error-text">{error}</p>}
        <button className="link-btn" style={{ marginTop: 16, display: 'block' }} onClick={() => go('recover')}>
          {tr('ob_recover_link')}
        </button>
      </div>
    </div>
  );
}
