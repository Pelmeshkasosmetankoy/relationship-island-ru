import { useState, useRef } from 'react';
import { tr } from '../i18n';
import { signInWithLogin, signUpWithLogin } from '../lib/auth';

const LOGIN_RE = /^[a-zA-Z0-9._-]{3,}$/;
const MIN_PW = 6;

const EyeIcon = ({ off }) => (
  off ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4.1M6.6 6.6A17.3 17.3 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
);

function AuthLanguageToggle({ lang, onSetLang }) {
  if (!onSetLang) return null;
  return (
    <div className="auth-lang-toggle" aria-label={tr('set_language')}>
      <button
        className={`auth-lang-opt ${lang === 'ru' ? 'active' : ''}`}
        onClick={() => onSetLang('ru')}
        type="button"
      >
        RU
      </button>
      <button
        className={`auth-lang-opt ${lang === 'en' ? 'active' : ''}`}
        onClick={() => onSetLang('en')}
        type="button"
      >
        EN
      </button>
    </div>
  );
}

export default function Auth({ lang = 'ru', onSetLang }) {
  const [view, setView] = useState('landing'); // 'landing' | 'signin' | 'signup'
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pwRef = useRef(null);

  const isSignup = view === 'signup';

  function go(next) {
    setView(next);
    setError(null);
  }

  async function handleSubmit() {
    const l = login.trim();
    if (!LOGIN_RE.test(l)) {
      setError(tr('auth_err_login'));
      return;
    }
    if (password.length < MIN_PW) {
      setError(tr('auth_err_pw_short'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isSignup) {
        const data = await signUpWithLogin(l, password);
        // no session back = the project still requires email confirmation, which
        // never arrives for internal accounts. Don't hang on a spinner — tell them.
        if (!data?.session) {
          setError(tr('auth_err_confirm'));
          setBusy(false);
          return;
        }
      } else {
        await signInWithLogin(l, password);
      }
      // success: the auth listener in App flips the session and routes onward —
      // a new account to Onboarding, a returning one straight to its island
    } catch (e) {
      const msg = (e?.message || '').toLowerCase();
      if (isSignup && msg.includes('already registered')) setError(tr('auth_err_taken'));
      else if (!isSignup) setError(tr('auth_err_bad'));
      else setError(tr('auth_err_generic'));
      setBusy(false);
    }
  }

  if (view === 'landing') {
    return (
      <div className="screen-center">
        <div className="card">
          <AuthLanguageToggle lang={lang} onSetLang={onSetLang} />
          <p className="eyebrow">{tr('auth_eyebrow')}</p>
          <h1>{tr('auth_choose_title')}</h1>
          <p className="sub">{tr('auth_choose_sub')}</p>
          <button className="btn btn-primary" onClick={() => go('signin')}>{tr('auth_btn_signin')}</button>
          <button className="btn btn-primary" onClick={() => go('signup')}>{tr('auth_btn_signup')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-center">
      <div className="card">
        <AuthLanguageToggle lang={lang} onSetLang={onSetLang} />
        <p className="eyebrow">{tr('auth_eyebrow')}</p>
        <h1>{isSignup ? tr('auth_title_signup') : tr('auth_title_signin')}</h1>
        <p className="sub">{tr('auth_sub_login')}</p>
        <input
          type="text"
          className="auth-input"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={tr('auth_login_ph')}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') pwRef.current?.focus(); }}
        />
        <div className="pw-wrap">
          <input
            ref={pwRef}
            type={showPw ? 'text' : 'password'}
            className="auth-input"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder={tr('auth_pw_ph')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            type="button"
            className="pw-toggle"
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? tr('auth_hide_pw') : tr('auth_show_pw')}
            title={showPw ? tr('auth_hide_pw') : tr('auth_show_pw')}
          >
            <EyeIcon off={showPw} />
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={busy} onClick={handleSubmit}>
          {busy ? tr('auth_wait') : (isSignup ? tr('auth_do_signup') : tr('auth_do_signin'))}
        </button>
        <button
          className="link-btn"
          style={{ marginTop: 14, display: 'block' }}
          disabled={busy}
          onClick={() => go('landing')}
        >
          {tr('back')}
        </button>
      </div>
    </div>
  );
}
