import { useState } from 'react';
import { tr } from '../i18n';
import { useSwipeDownClose } from '../lib/gestures';

// Two "reasons to love you" jars, labelled by the partners' names. Each partner
// writes reasons ABOUT the other and pulls out reasons about THEMSELF; the ones
// they've already pulled stay visible. Which side this device is ('a'/'b') is
// remembered on the device.
export default function Jar({
  role, nameA, nameB, myName, partnerName,
  onClaim, onChooseRole, onSetNames,
  reasonsAboutMe, reasonsAboutPartner, seenIds, onReveal,
  onAdd, onDelete, onClose,
}) {
  const [tab, setTab] = useState('me'); // 'me' (pull) | 'partner' (write)
  const [text, setText] = useState('');
  const [drawn, setDrawn] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [editA, setEditA] = useState(nameA || '');
  const [editB, setEditB] = useState(nameB || '');
  const { elRef, swipeHandlers } = useSwipeDownClose(onClose);

  const shell = (inner) => (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal jar-modal" ref={elRef} {...swipeHandlers}>
        <img className="jar-emoji jar-cat-icon" src="/another/cat.png" alt="" aria-hidden="true" />
        <h2>{tr('jar_title')}</h2>
        {inner}
      </div>
    </div>
  );

  // ---- setup: name entry / who-are-you picker ----
  if (role !== 'a' && role !== 'b') {
    if (editing) {
      return shell(
        <>
          <p className="sub">{tr('jar_edit_sub')}</p>
          <input className="wish-input jar-name-input" placeholder={tr('jar_names_a_ph')} value={editA} maxLength={24} onChange={(e) => setEditA(e.target.value)} />
          <input className="wish-input jar-name-input" placeholder={tr('jar_names_b_ph')} value={editB} maxLength={24} onChange={(e) => setEditB(e.target.value)} />
          <button className="btn btn-primary" disabled={!editA.trim() || !editB.trim()} onClick={() => { onSetNames(editA.trim(), editB.trim()); setEditing(false); }}>{tr('jar_save')}</button>
          <button className="btn" onClick={() => setEditing(false)}>{tr('back')}</button>
          <button className="link-btn jar-switch" onClick={() => { onSetNames('', ''); onChooseRole(null); setEditing(false); }}>{tr('jar_reset')}</button>
        </>
      );
    }
    if (nameA && nameB) {
      return shell(
        <>
          <h3 className="jar-who">{tr('jar_who')}</h3>
          <button className="btn btn-primary" onClick={() => onChooseRole('a')}>{nameA}</button>
          <button className="btn btn-primary" onClick={() => onChooseRole('b')}>{nameB}</button>
          <button className="link-btn jar-switch" onClick={() => { setEditA(nameA); setEditB(nameB); setEditing(true); }}>{tr('jar_edit_names')}</button>
          <button className="btn" style={{ marginTop: 6 }} onClick={onClose}>{tr('close')}</button>
        </>
      );
    }
    // first person on this island (0 or 1 name known): enter your own name
    const claimSide = nameA ? 'b' : 'a';
    const knownPartner = nameA || nameB;
    return shell(
      <>
        <p className="sub">{knownPartner ? tr('jar_setup_join', { name: knownPartner }) : tr('jar_setup_first')}</p>
        <input
          className="wish-input jar-name-input"
          placeholder={tr('jar_setup_ph')}
          value={nameInput}
          maxLength={24}
          autoFocus
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && nameInput.trim()) onClaim(claimSide, nameInput.trim()); }}
        />
        <button className="btn btn-primary" disabled={!nameInput.trim()} onClick={() => onClaim(claimSide, nameInput.trim())}>{tr('jar_setup_done')}</button>
        <button className="btn" onClick={onClose}>{tr('close')}</button>
      </>
    );
  }

  // ---- main jar ----
  const pName = partnerName || tr('jar_partner_word');

  function handleAdd() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  }

  function draw() {
    if (!reasonsAboutMe.length) return;
    let pick = reasonsAboutMe[Math.floor(Math.random() * reasonsAboutMe.length)];
    if (reasonsAboutMe.length > 1 && drawn) {
      let guard = 0;
      while (pick.id === drawn.id && guard++ < 8) pick = reasonsAboutMe[Math.floor(Math.random() * reasonsAboutMe.length)];
    }
    setDrawn(pick);
    onReveal(pick.id);
  }

  const drawnStillThere = drawn && reasonsAboutMe.some((n) => n.id === drawn.id);
  const seenReasons = reasonsAboutMe.filter((n) => seenIds.includes(n.id));

  return shell(
    <>
      <div className="jar-tabs">
        <button className={`jar-tab ${tab === 'me' ? 'active' : ''}`} onClick={() => setTab('me')}>
          <img className="jar-tab-icon" src="/another/love1.svg" alt="" aria-hidden="true" />
          <span>{tr('jar_tab_me')}</span>
        </button>
        <button className={`jar-tab ${tab === 'partner' ? 'active' : ''}`} onClick={() => setTab('partner')}>
          <img className="jar-tab-icon" src="/another/love2.svg" alt="" aria-hidden="true" />
          <span>{tr('jar_tab_partner', { name: pName })}</span>
        </button>
      </div>

      {tab === 'me' ? (
        <>
          <p className="sub">{tr('jar_me_sub', { name: pName })}</p>
          <div className={`jar-drawn ${drawnStillThere ? 'has-note' : ''}`}>
            {drawnStillThere
              ? <span className="jar-drawn-quote">{drawn.text}</span>
              : <span className="jar-drawn-hint">{reasonsAboutMe.length ? tr('jar_tap_draw') : tr('jar_me_empty', { name: pName })}</span>}
          </div>
          <button className="btn btn-primary" disabled={!reasonsAboutMe.length} onClick={draw}>
            {drawnStillThere ? tr('jar_draw_again') : tr('jar_draw')}
          </button>
          <div className="jar-count">{tr('jar_me_count', { name: pName, n: reasonsAboutMe.length })}</div>
          {seenReasons.length > 0 && (
            <>
              <div className="jar-seen-head">{tr('jar_seen_head', { m: seenReasons.length, n: reasonsAboutMe.length })}</div>
              <div className="jar-list">
                {seenReasons.map((n) => (
                  <div className="jar-item" key={n.id}><span className="jar-item-text">{n.text}</span></div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="sub">{tr('jar_partner_sub', { name: pName })}</p>
          <div className="jar-add">
            <input
              type="text"
              className="wish-input"
              placeholder={tr('jar_partner_placeholder', { name: pName })}
              value={text}
              maxLength={150}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
            <button className="btn btn-primary wish-add-btn" onClick={handleAdd} disabled={!text.trim()}>+</button>
          </div>
          <div className="jar-count">{tr('jar_partner_count', { n: reasonsAboutPartner.length })}</div>
          <div className="jar-list">
            {reasonsAboutPartner.map((n) => (
              <div className="jar-item" key={n.id}>
                <span className="jar-item-text">{n.text}</span>
                <button className="wish-del" onClick={() => onDelete(n)} aria-label={tr('close')}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="link-btn jar-switch" onClick={() => onChooseRole(null)}>{tr('jar_switch_role')}</button>
      <div className="modal-actions" style={{ marginTop: 6 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>{tr('close')}</button>
      </div>
    </>
  );
}
