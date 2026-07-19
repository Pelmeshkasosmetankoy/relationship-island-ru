import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import AddEventModal from './components/AddEventModal';
import DetailPanel from './components/DetailPanel';
import Shop from './components/Shop';
import WishList from './components/WishList';
import FigurePicker from './components/FigurePicker';
import Premium from './components/Premium';
import PremiumPreview from './components/PremiumPreview';
import Menu from './components/Menu';
import Settings from './components/Settings';
import Help from './components/Help';
import About from './components/About';
import Tour from './components/Tour';
import Salute from './components/Salute';
import MemoryCalendar from './components/MemoryCalendar';
import BottleNote from './components/BottleNote';
import Jar from './components/Jar';
import DecorPanel from './components/DecorPanel';
import IslandScene from './scene/IslandScene';
import {
  createWorld, createWorldInvite, acceptWorldInvite, setRecoveryCode, redeemRecoveryCode, worldExists, joinWorld, fetchMyWorlds,
  fetchEvents, insertEvent, updateEvent, deleteEvent, subscribeToEvents,
  fetchPurchases, addPurchase, subscribeToPurchases,
  fetchSettings, setSetting, subscribeToSettings,
  fetchWishes, addWish, updateWish, deleteWish, subscribeToWishes,
} from './lib/worldStore';
import { getSession, onAuthChange, signOut, deleteMyAccount } from './lib/auth';
import {
  computeBalance, isOwned, itemPrice, EXCLUSIVE_CATEGORIES, settingKeyForCategory, DEFAULT_SETTINGS,
  computeActiveEffects, parseKeySet, stringifyKeySet, packForItem, isPackOwned, FIGURE_CHOICES, PACKS,
  parseJarNotes, stringifyJarNotes,
} from './lib/economy';
import { DECOR_ITEMS, parsePlots, stringifyPlots, parseDecor, stringifyDecor, genDecorId, parseInventory, stringifyInventory } from './lib/decor';
import { hexToPos, TILE_SIZE } from './scene/hexMath';
import { purchasePack, purchaseAllPacks } from './lib/billing';
import { setActiveSounds, stopAllSounds } from './lib/soundManager';
import { App as CapacitorApp } from '@capacitor/app';
import { tapFeedback, successFeedback } from './lib/haptics';
import { tr, getLanguage, setLanguage } from './i18n';
import './styles.css';

// Persisting the island code on the device is what makes progress "stick": on the
// next launch we reopen the same island instead of the onboarding screen.
const SAVED_CODE_KEY = 'islandCode';

function loadSavedCode() {
  try { return localStorage.getItem(SAVED_CODE_KEY); } catch { return null; }
}
function saveCode(code) {
  try { localStorage.setItem(SAVED_CODE_KEY, code); } catch { /* storage unavailable */ }
}
function clearSavedCode() {
  try { localStorage.removeItem(SAVED_CODE_KEY); } catch { /* storage unavailable */ }
}

// Local cache of shop state per island code — used as a fallback if Supabase
// isn't reachable / the shop tables aren't set up yet, so the shop still works
// on this device (it just won't sync to the partner until the tables exist).
function loadLocalPurchases(code) {
  try { return JSON.parse(localStorage.getItem(`island:${code}:purchases`) || '[]'); } catch { return []; }
}
function saveLocalPurchases(code, arr) {
  try { localStorage.setItem(`island:${code}:purchases`, JSON.stringify(arr)); } catch { /* ignore */ }
}
function loadLocalSettings(code) {
  try { return JSON.parse(localStorage.getItem(`island:${code}:settings`) || '{}'); } catch { return {}; }
}
// Which partner this device belongs to ('him' | 'her'), for the two-jar feature.
// Kept per-device (not synced) — it's "who am I", answered once on each phone.
function loadJarRole(code) {
  try { return localStorage.getItem(`island:${code}:jarRole`) || null; } catch { return null; }
}
function saveJarRole(code, role) {
  try {
    if (role) localStorage.setItem(`island:${code}:jarRole`, role);
    else localStorage.removeItem(`island:${code}:jarRole`);
  } catch { /* storage unavailable */ }
}
// Which reasons this person has already pulled out — kept per device + side so the
// "already revealed" list stays personal to each partner.
function loadJarSeen(code, side) {
  try { return JSON.parse(localStorage.getItem(`island:${code}:jarSeen_${side}`) || '[]'); } catch { return []; }
}
function saveJarSeen(code, side, ids) {
  try { localStorage.setItem(`island:${code}:jarSeen_${side}`, JSON.stringify(ids)); } catch { /* ignore */ }
}
function saveLocalSettings(code, obj) {
  try { localStorage.setItem(`island:${code}:settings`, JSON.stringify(obj)); } catch { /* ignore */ }
}
const DEFAULT_FIGURE_COLORS = {
  shirt: '#6b4fd8',
  pants: '#2f3148',
  face: '#ffb978',
  hair: '#3b2017',
};

function parseFigureColors(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_FIGURE_COLORS, ...parsed };
  } catch {
    return { ...DEFAULT_FIGURE_COLORS };
  }
}
function normalizeFigureChoice(side, key) {
  const noneKey = side === 'girl' ? 'girl_none' : 'boy_none';
  if (!key || key === noneKey) return noneKey;
  const choices = FIGURE_CHOICES[side] || [];
  return choices.includes(key) ? key : choices[0] || noneKey;
}

export default function App() {
  const [code, setCode] = useState(null);
  const [events, setEvents] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showAdd, setShowAdd] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showWishes, setShowWishes] = useState(false);
  const [showFigures, setShowFigures] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [premiumPack, setPremiumPack] = useState(null);
  const [showPremiumPreview, setShowPremiumPreview] = useState(false);
  const [premiumPreviewPack, setPremiumPreviewPack] = useState(null);
  const [showDecor, setShowDecor] = useState(false);
  const [decorTab, setDecorTab] = useState('plots');
  const [decorPlaceKey, setDecorPlaceKey] = useState(null);
  const [selectedDecorId, setSelectedDecorId] = useState(null);
  const [selectedPlot, setSelectedPlot] = useState(null); // {q,r} — выбранная площадка
  const [pendingPlotRemove, setPendingPlotRemove] = useState(null); // {q,r,count} — подтверждение
  const [showHub, setShowHub] = useState(false); // единое меню магазина/обустройства
  const [showMenu, setShowMenu] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showBottle, setShowBottle] = useState(false);
  const [showJar, setShowJar] = useState(false);
  const [jarRole, setJarRole] = useState(null); // 'a' | 'b' | null — which partner this device is
  const [jarSeen, setJarSeen] = useState([]);   // ids of my reasons I've already pulled out
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showTourOffer, setShowTourOffer] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [wishes, setWishes] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [lang, setLang] = useState(getLanguage());
  const [salute, setSalute] = useState(0); // bump to fire a celebratory burst
  const [inviteCode, setInviteCode] = useState(null);
  // undefined = still checking; null = logged out; object = logged in
  const [session, setSession] = useState(undefined);

  const changeLang = useCallback((l) => { setLanguage(l); setLang(l); }, []);

  // load shop state (purchases + settings) for a world, with local fallback
  const loadEconomy = useCallback(async (c) => {
    try {
      const p = await fetchPurchases(c);
      setPurchases(p);
      saveLocalPurchases(c, p);
    } catch (e) {
      console.warn('Покупки: сервер недоступен, используется локальная копия.', e);
      setPurchases(loadLocalPurchases(c));
    }
    try {
      const s = await fetchSettings(c);
      const merged = { ...DEFAULT_SETTINGS, ...s };
      setSettings(merged);
      saveLocalSettings(c, merged);
    } catch (e) {
      console.warn('Настройки: сервер недоступен, используется локальная копия.', e);
      setSettings({ ...DEFAULT_SETTINGS, ...loadLocalSettings(c) });
    }
  }, []);

  const loadWishes = useCallback(async (c) => {
    try { setWishes(await fetchWishes(c)); }
    catch (e) { console.warn('Список желаний не загружен:', e); setWishes([]); }
  }, []);

  // track the login session: check once on load, then follow sign-in / sign-out
  // (opening a magic link fires this too, which is what lets the app proceed)
  useEffect(() => {
    let active = true;
    getSession().then((s) => { if (active) setSession(s); });
    const unsub = onAuthChange((s) => setSession(s));
    return () => { active = false; unsub(); };
  }, []);

  // once logged in, reopen the island the account already belongs to (preferring
  // the one saved on this device). A brand-new account has no worlds yet, so it
  // falls through to the Onboarding screen to create or join one.
  // Keyed on the user id (not the whole session) so a routine token refresh —
  // same user, new token — doesn't re-trigger a full reload / loading flash.
  const authUserId = session === undefined ? undefined : (session?.user?.id ?? null);
  useEffect(() => {
    if (authUserId === undefined) return; // still checking
    if (!authUserId) {
      // logged out: drop the island from view (data is protected server-side too)
      stopAllSounds();
      setCode(null);
      setEvents([]);
      setPurchases([]);
      setSettings(DEFAULT_SETTINGS);
      setWishes([]);
      setSelectedEvent(null);
      setEditingEvent(null);
      setRestoring(false);
      return;
    }
    let active = true;
    setRestoring(true);
    (async () => {
      try {
        const myWorlds = await fetchMyWorlds();
        const saved = loadSavedCode();
        let target = null;
        if (saved && myWorlds.includes(saved)) target = saved;
        else if (myWorlds.length) target = myWorlds[0];
        else if (saved) {
          const exists = await worldExists(saved);
          if (exists) {
            await joinWorld(saved);
            target = saved;
          }
        }
        if (target && active) {
          saveCode(target);
          setCode(target);
          const [ev] = await Promise.all([
            fetchEvents(target),
            loadEconomy(target),
            loadWishes(target),
          ]);
          if (active) setEvents(ev);
        }
      } catch (e) {
        console.warn('Не удалось восстановить остров:', e);
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => { active = false; };
  }, [authUserId, loadEconomy, loadWishes]);

  // subscribe to realtime inserts once we have a world code
  useEffect(() => {
    if (!code) return;
    const unsubscribe = subscribeToEvents(code, (newEvent) => {
      setEvents((prev) => (prev.some((e) => e.id === newEvent.id) ? prev : [...prev, newEvent]));
    });
    return unsubscribe;
  }, [code]);

  // subscribe to shop changes so a partner's purchase / theme choice appears live
  useEffect(() => {
    if (!code) return;
    const unsubP = subscribeToPurchases(code, (key) => {
      setPurchases((prev) => (prev.includes(key) ? prev : [...prev, key]));
    });
    const unsubS = subscribeToSettings(code, (key, value) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    });
    const unsubW = subscribeToWishes(code, () => { loadWishes(code); });
    return () => { unsubP(); unsubS(); unsubW(); };
  }, [code, loadWishes]);

  // play/stop ambient sounds for active "sound_*" items
  useEffect(() => {
    if (!code) { stopAllSounds(); return; }
    const active = computeActiveEffects(purchases, settings.effects_off);
    setActiveSounds(active.filter((k) => k.startsWith('sound_')));
  }, [code, purchases, settings.effects_off]);


  const handleCreate = useCallback(async () => {
    const newCode = await createWorld();
    saveCode(newCode);
    setCode(newCode);
    setEvents([]);
    setPurchases([]);
    setSettings(DEFAULT_SETTINGS);
    setWishes([]);
    setShowTourOffer(true); // offer the guided tour on a brand-new island
  }, []);

  const handleJoin = useCallback(async (inviteCode) => {
    const worldCode = await acceptWorldInvite(inviteCode);
    if (!worldCode) throw new Error('not found');
    const existingEvents = await fetchEvents(worldCode);
    saveCode(worldCode);
    setCode(worldCode);
    setEvents(existingEvents);
    setPendingInvite(null);
    await loadEconomy(worldCode);
    await loadWishes(worldCode);
  }, [loadEconomy, loadWishes]);

  // Emergency: rejoin an island with its saved recovery code (works even if both
  // partners lost their accounts — from any new account).
  const handleRecover = useCallback(async (recoveryCode) => {
    const worldCode = await redeemRecoveryCode(recoveryCode);
    if (!worldCode) throw new Error('not found');
    const existingEvents = await fetchEvents(worldCode);
    saveCode(worldCode);
    setCode(worldCode);
    setEvents(existingEvents);
    setPendingInvite(null);
    await loadEconomy(worldCode);
    await loadWishes(worldCode);
  }, [loadEconomy, loadWishes]);

  // create/replace this island's recovery code; returns it to show once
  const handleCreateRecovery = useCallback(() => setRecoveryCode(code), [code]);

  const handleCreateEvent = useCallback(async ({ type, note, photoFile, date }) => {
    const newEvent = await insertEvent(code, { type, note, photoFile, date });
    successFeedback(); // a little buzz to celebrate a new memory
    setSalute((n) => n + 1); // …and a little confetti burst
    // realtime will also deliver this insert; the dedupe check prevents a double-add
    setEvents((prev) => (prev.some((e) => e.id === newEvent.id) ? prev : [...prev, newEvent]));
    setShowAdd(false);
  }, [code]);

  const handleUpdateEvent = useCallback(async ({ type, note, photoFile, date }) => {
    const updated = await updateEvent(code, editingEvent.id, { type, note, photoFile, date });
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEvent(null);
  }, [code, editingEvent]);

  const handleDeleteEvent = useCallback(async (event) => {
    try {
      await deleteEvent(event.id);
    } catch (e) {
      console.error('Не удалось удалить событие:', e);
      window.alert(tr('alert_delete_fail'));
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    setSelectedEvent(null);
  }, []);

  // ---- wish list "Хотим вместе" ----
  const handleAddWish = useCallback(async (text) => {
    try {
      const w = await addWish(code, text);
      setWishes((prev) => [...prev, w]);
    } catch (e) { console.warn('Желание не добавлено:', e); }
  }, [code]);

  const handleToggleWish = useCallback(async (wish) => {
    setWishes((prev) => prev.map((w) => (w.id === wish.id ? { ...w, done: !w.done } : w)));
    updateWish(wish.id, { done: !wish.done }).catch((e) => console.warn('Желание не синхронизировано:', e));
  }, []);

  const handleDeleteWish = useCallback(async (wish) => {
    setWishes((prev) => prev.filter((w) => w.id !== wish.id));
    deleteWish(wish.id).catch((e) => console.warn('Желание не удалено на сервере:', e));
  }, []);

  const handleTileClick = useCallback((tileId) => {
    setEvents((prev) => {
      const found = prev.find((e) => e.id === tileId);
      if (found) { tapFeedback(8); setSelectedEvent(found); }
      return prev;
    });
  }, []);

  // flip to the previous/next memory (by date) from the detail panel
  const handleNavigateEvent = useCallback((dir) => {
    if (!selectedEvent) return;
    const sorted = [...events].sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));
    const i = sorted.findIndex((e) => e.id === selectedEvent.id);
    const next = sorted[i + dir];
    if (next) { tapFeedback(8); setSelectedEvent(next); }
  }, [events, selectedEvent]);

  // Premium gate for an item key. Returns { persist:true } when the item may be
  // used on the real island, or null when it is locked (opens the paywall).
  // Preview is intentionally separate so it never changes the real island.
  const premiumGate = useCallback((key) => {
    const pack = packForItem(key);
    if (!pack || isPackOwned(settings.owned_packs, pack)) return { persist: true };
    setPremiumPack(pack);
    setShowPremium(true);
    return null;
  }, [settings.owned_packs]);

  // choose which sky / palette / figure is active (exclusive categories)
  const handleActivate = useCallback((category, key) => {
    const settingKey = settingKeyForCategory(category);
    if (!settingKey) return;
    const gate = premiumGate(key);
    if (!gate) return;
    setSettings((prev) => {
      const next = { ...prev, [settingKey]: key };
      if (gate.persist) saveLocalSettings(code, next);
      return next;
    });
    if (gate.persist) setSetting(code, settingKey, key).catch((e) => console.warn('Настройка не синхронизирована:', e));
  }, [code, premiumGate]);

  // turn an owned additive effect on/off (stored as the "off" set in settings)
  const handleToggle = useCallback((item) => {
    const gate = premiumGate(item.key);
    if (!gate) return;
    setSettings((prev) => {
      const off = parseKeySet(prev.effects_off);
      if (off.has(item.key)) off.delete(item.key); else off.add(item.key);
      const value = stringifyKeySet(off);
      const next = { ...prev, effects_off: value };
      if (gate.persist) {
        saveLocalSettings(code, next);
        setSetting(code, 'effects_off', value).catch((e) => console.warn('Настройка не синхронизирована:', e));
      }
      return next;
    });
  }, [code, premiumGate]);

  // island name (shown on the plaque) — a shared world setting, synced to both
  const handleSetIslandName = useCallback((name) => {
    const value = (name || '').slice(0, 40);
    setSettings((prev) => {
      const next = { ...prev, island_name: value };
      saveLocalSettings(code, next);
      return next;
    });
    setSetting(code, 'island_name', value).catch((e) => console.warn('Название острова не синхронизировано:', e));
  }, [code]);

  const figureColors = useMemo(() => ({
    boy: parseFigureColors(settings.boy_colors),
    girl: parseFigureColors(settings.girl_colors),
  }), [settings.boy_colors, settings.girl_colors]);

  const handleSetFigureColors = useCallback((side, colors) => {
    const settingKey = side === 'girl' ? 'girl_colors' : 'boy_colors';
    const value = JSON.stringify({
      shirt: colors.shirt,
      pants: colors.pants,
      face: colors.face,
      hair: colors.hair,
    });
    setSettings((prev) => {
      const next = { ...prev, [settingKey]: value };
      saveLocalSettings(code, next);
      return next;
    });
    setSetting(code, settingKey, value).catch((e) => console.warn('Цвета фигурки не синхронизированы:', e));
  }, [code]);

  const handleBuy = useCallback((item) => {
    if (isOwned(item.key, purchases)) return;
    const gate = premiumGate(item.key);
    if (!gate) return; // locked premium → the paywall was opened
    // some items need a specific tile (ducks/swans need a lake) — block with a
    // message and DON'T charge if the requirement isn't met
    if (item.requires === 'lake' && !events.some((e) => e.type === 'lake')) {
      window.alert(tr('alert_need_lake'));
      return;
    }
    if (computeBalance(events.length, purchases) < itemPrice(item.key)) return;

    const nextPurchases = [...purchases, item.key];
    setPurchases(nextPurchases);
    tapFeedback(15);
    if (gate.persist) {
      saveLocalPurchases(code, nextPurchases);
      addPurchase(code, item.key).catch((e) => console.warn('Покупка не синхронизирована:', e));
    }

    // exclusive items (sky / palette) become active as soon as they're bought
    if (EXCLUSIVE_CATEGORIES.includes(item.category)) {
      handleActivate(item.category, item.key);
    }
  }, [purchases, events, code, handleActivate, premiumGate]);

  // unlock a pack (free stub instead of real payment) — persisted and shared
  // Unlock a pack for the whole ISLAND (shared) — so one partner buying it opens it
  // for both. Called after a successful purchase (or the free stub).
  const unlockPack = useCallback((pack) => {
    setSettings((prev) => {
      const owned = parseKeySet(prev.owned_packs);
      owned.add(pack);
      const value = stringifyKeySet(owned);
      const next = { ...prev, owned_packs: value };
      saveLocalSettings(code, next);
      setSetting(code, 'owned_packs', value).catch((e) => console.warn('Пак не синхронизирован:', e));
      return next;
    });
  }, [code]);

  // Buy a pack. Payment goes through the billing module (a free stub for now; the
  // RuStore Pay SDK later). On success the pack is unlocked for the island.
  const handleOpenPack = useCallback(async (pack) => {
    const res = await purchasePack(pack);
    if (res.ok) unlockPack(pack);          // paywall stays open so they can browse more
    else if (!res.cancelled) window.alert(tr('purchase_failed'));
  }, [unlockPack]);

  // "Разблокировать всё" — buys the bundle (free stub for now) and opens every pack.
  const handleOpenAllPacks = useCallback(async () => {
    const res = await purchaseAllPacks();
    if (!res.ok) { if (!res.cancelled) window.alert(tr('purchase_failed')); return; }
    setSettings((prev) => {
      const owned = parseKeySet(prev.owned_packs);
      Object.keys(PACKS).forEach((p) => owned.add(p));
      const value = stringifyKeySet(owned);
      const next = { ...prev, owned_packs: value };
      saveLocalSettings(code, next);
      setSetting(code, 'owned_packs', value).catch((e) => console.warn('Паки не синхронизированы:', e));
      return next;
    });
    setShowPremium(false);
  }, [code]);

  // ---- message in a bottle (free) ----
  const handleBottleClick = useCallback(() => {
    tapFeedback(8);
    setShowBottle(true);
  }, []);

  const handleSetBottleNote = useCallback((text) => {
    const value = (text || '').slice(0, 500);
    setSettings((prev) => {
      const next = { ...prev, bottle_note: value };
      saveLocalSettings(code, next);
      return next;
    });
    setSetting(code, 'bottle_note', value).catch((e) => console.warn('Записка не синхронизирована:', e));
  }, [code]);

  // ---- two "reasons to love you" jars (free); stored in shared settings ----
  // Each partner writes into the OTHER's jar and pulls from their OWN. Side 'a' pulls
  // from jar_notes_a (what B wrote about A); side 'b' pulls from jar_notes_b.
  const jarA = useMemo(() => parseJarNotes(settings.jar_notes_a), [settings.jar_notes_a]);
  const jarB = useMemo(() => parseJarNotes(settings.jar_notes_b), [settings.jar_notes_b]);
  const reasonsAboutMe = jarRole === 'a' ? jarA : jarB;
  const reasonsAboutPartner = jarRole === 'a' ? jarB : jarA;
  const partnerJarKey = jarRole === 'a' ? 'jar_notes_b' : 'jar_notes_a';
  const myName = jarRole === 'a' ? settings.name_a : settings.name_b;
  const partnerName = jarRole === 'a' ? settings.name_b : settings.name_a;

  const chooseJarRole = useCallback((role) => {
    saveJarRole(code, role);
    setJarRole(role);
  }, [code]);

  const persistName = useCallback((key, value) => {
    const v = (value || '').trim().slice(0, 24);
    setSettings((prev) => {
      const next = { ...prev, [key]: v };
      saveLocalSettings(code, next);
      return next;
    });
    setSetting(code, key, v).catch((e) => console.warn('Имя не синхронизировано:', e));
  }, [code]);

  // claim a side with my name (first setup on this device)
  const handleJarClaim = useCallback((side, name) => {
    persistName(side === 'a' ? 'name_a' : 'name_b', name);
    chooseJarRole(side);
  }, [persistName, chooseJarRole]);

  const handleSetJarNames = useCallback((a, b) => {
    persistName('name_a', a);
    persistName('name_b', b);
  }, [persistName]);

  // update one jar, working from `prev` so a partner's concurrent change survives
  const persistJarKey = useCallback((key, updater) => {
    setSettings((prev) => {
      const value = stringifyJarNotes(updater(parseJarNotes(prev[key])));
      const next = { ...prev, [key]: value };
      saveLocalSettings(code, next);
      setSetting(code, key, value).catch((e) => console.warn('Банка не синхронизирована:', e));
      return next;
    });
  }, [code]);

  // I always write reasons ABOUT my partner → into the partner's jar
  const handleAddReason = useCallback((text) => {
    const t = (text || '').trim().slice(0, 150);
    if (!t) return;
    const id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    persistJarKey(partnerJarKey, (arr) => [...arr, { id, text: t }]);
  }, [persistJarKey, partnerJarKey]);

  const handleDeleteReason = useCallback((note) => {
    persistJarKey(partnerJarKey, (arr) => arr.filter((n) => n.id !== note.id));
  }, [persistJarKey, partnerJarKey]);

  // remember, per device, that I've pulled this reason (so it stays revealed)
  const handleRevealReason = useCallback((id) => {
    setJarSeen((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveJarSeen(code, jarRole, next);
      return next;
    });
  }, [code, jarRole]);

  // remember which partner this device is + which reasons it has already seen
  useEffect(() => { setJarRole(code ? loadJarRole(code) : null); }, [code]);
  useEffect(() => { setJarSeen(code && jarRole ? loadJarSeen(code, jarRole) : []); }, [code, jarRole]);

  // ---- декор: площадки, склад и предметы (в настройках, синхронизируются) ----
  const plots = useMemo(() => parsePlots(settings.plots), [settings.plots]);
  const decor = useMemo(() => parseDecor(settings.decor_layout), [settings.decor_layout]);
  const inventory = useMemo(() => parseInventory(settings.decor_inventory), [settings.decor_inventory]);
  const decorMode = !showDecor ? null : (decorTab === 'plots' ? 'plots' : 'items');

  const handlePlotAdd = useCallback((q, r) => {
    setSettings((prev) => {
      const cur = parsePlots(prev.plots);
      if (cur.some((p) => p.q === q && p.r === r)) return prev;
      const v = stringifyPlots([...cur, { q, r }]);
      setSetting(code, 'plots', v).catch((e) => console.warn('Площадки не синхронизированы:', e));
      return { ...prev, plots: v };
    });
  }, [code]);

  // убрать площадку и ВЕРНУТЬ стоящий на ней декор на склад
  const doPlotRemove = useCallback((q, r) => {
    setSettings((prev) => {
      const v = stringifyPlots(parsePlots(prev.plots).filter((p) => !(p.q === q && p.r === r)));
      setSetting(code, 'plots', v).catch((e) => console.warn('Площадки не синхронизированы:', e));
      const next = { ...prev, plots: v };
      const c = hexToPos(q, r);
      const d0 = parseDecor(prev.decor_layout);
      const onPlot = d0.filter((d) => Math.hypot(d.x - c.x, d.z - c.z) <= TILE_SIZE * 0.95);
      if (onPlot.length) {
        const dv = stringifyDecor(d0.filter((d) => !onPlot.includes(d)));
        setSetting(code, 'decor_layout', dv).catch((e) => console.warn('Декор не синхронизирован:', e));
        next.decor_layout = dv;
        const inv = parseInventory(prev.decor_inventory);
        onPlot.forEach((d) => { inv[d.key] = (inv[d.key] || 0) + 1; });
        const iv = stringifyInventory(inv);
        setSetting(code, 'decor_inventory', iv).catch((e) => console.warn('Склад не синхронизирован:', e));
        next.decor_inventory = iv;
      }
      return next;
    });
    setPendingPlotRemove(null);
    setSelectedPlot(null);
  }, [code]);

  const handlePlotRemove = useCallback((q, r) => {
    const c = hexToPos(q, r);
    const count = parseDecor(settings.decor_layout).filter((d) => Math.hypot(d.x - c.x, d.z - c.z) <= TILE_SIZE * 0.95).length;
    if (count > 0) setPendingPlotRemove({ q, r, count }); // спросить подтверждение
    else doPlotRemove(q, r);
  }, [settings.decor_layout, doPlotRemove]);

  // купить предмет -> на склад (бесплатно пока; цену подключим позже)
  const handleBuyDecor = useCallback((key) => {
    setSettings((prev) => {
      const inv = parseInventory(prev.decor_inventory);
      inv[key] = (inv[key] || 0) + 1;
      const iv = stringifyInventory(inv);
      setSetting(code, 'decor_inventory', iv).catch((e) => console.warn('Склад не синхронизирован:', e));
      return { ...prev, decor_inventory: iv };
    });
  }, [code]);

  const handleDecorPlace = useCallback(({ key, x, z, rot }) => {
    setSettings((prev) => {
      const inv = parseInventory(prev.decor_inventory);
      if (!(inv[key] > 0)) return prev; // нет на складе — не ставим
      inv[key] -= 1;
      const iv = stringifyInventory(inv);
      const v = stringifyDecor([...parseDecor(prev.decor_layout), { id: genDecorId(), key, x, z, rot }]);
      setSetting(code, 'decor_inventory', iv).catch((e) => console.warn('Склад не синхронизирован:', e));
      setSetting(code, 'decor_layout', v).catch((e) => console.warn('Декор не синхронизирован:', e));
      if (!(inv[key] > 0)) setDecorPlaceKey((armed) => (armed === key ? null : armed)); // склад кончился
      return { ...prev, decor_inventory: iv, decor_layout: v };
    });
  }, [code]);

  const handleDecorUpdate = useCallback(({ id, x, z, rot }) => {
    setSettings((prev) => {
      const v = stringifyDecor(parseDecor(prev.decor_layout).map((d) => (d.id === id ? { ...d, x, z, rot } : d)));
      setSetting(code, 'decor_layout', v).catch((e) => console.warn('Декор не синхронизирован:', e));
      return { ...prev, decor_layout: v };
    });
  }, [code]);

  // убрать поставленный предмет -> ВЕРНУТЬ на склад
  const handleDecorRemove = useCallback((id) => {
    setSettings((prev) => {
      const arr = parseDecor(prev.decor_layout);
      const removed = arr.find((d) => d.id === id);
      const v = stringifyDecor(arr.filter((d) => d.id !== id));
      setSetting(code, 'decor_layout', v).catch((e) => console.warn('Декор не синхронизирован:', e));
      const next = { ...prev, decor_layout: v };
      if (removed) {
        const inv = parseInventory(prev.decor_inventory);
        inv[removed.key] = (inv[removed.key] || 0) + 1;
        const iv = stringifyInventory(inv);
        setSetting(code, 'decor_inventory', iv).catch((e) => console.warn('Склад не синхронизирован:', e));
        next.decor_inventory = iv;
      }
      return next;
    });
    setSelectedDecorId((sid) => (sid === id ? null : sid));
  }, [code]);

  const handleRotateSelected = useCallback(() => {
    if (!selectedDecorId) return;
    const d = parseDecor(settings.decor_layout).find((x) => x.id === selectedDecorId);
    if (d) handleDecorUpdate({ id: d.id, x: d.x, z: d.z, rot: (d.rot || 0) + Math.PI / 6 });
  }, [selectedDecorId, settings.decor_layout, handleDecorUpdate]);

  // покрасить ВЫБРАННУЮ площадку
  const handlePlotColor = useCallback((hex) => {
    if (!selectedPlot) return;
    setSettings((prev) => {
      const v = stringifyPlots(parsePlots(prev.plots).map((p) => (p.q === selectedPlot.q && p.r === selectedPlot.r ? { ...p, color: hex } : p)));
      setSetting(code, 'plots', v).catch((e) => console.warn('Площадки не синхронизированы:', e));
      return { ...prev, plots: v };
    });
  }, [code, selectedPlot]);

  const closeDecor = useCallback(() => { setShowDecor(false); setDecorPlaceKey(null); setSelectedDecorId(null); setSelectedPlot(null); setPendingPlotRemove(null); }, []);

  // open an isolated preview: the real island, purchases and settings are untouched
  const handleTryPack = useCallback((pack) => {
    setPremiumPreviewPack(pack);
    setShowPremiumPreview(true);
    setShowPremium(false);
  }, []);

  // is a premium item currently locked?
  const isLockedItem = useCallback((key) => {
    const pack = packForItem(key);
    return !!pack && !isPackOwned(settings.owned_packs, pack);
  }, [settings.owned_packs]);

  const handleShareCode = useCallback(async () => {
    let createdCode;
    try {
      createdCode = await createWorldInvite(code);
      setInviteCode(createdCode);
    } catch (e) {
      console.error('Не удалось создать приглашение:', e);
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('two members')) window.alert(tr('alert_invite_full'));
      else if (msg.includes('not authenticated')) window.alert(tr('alert_invite_auth'));
      else if (msg.includes('not a member')) window.alert(tr('alert_invite_notmember'));
      else window.alert(tr('alert_invite_fail'));
      return;
    }
  }, [code]);

  const inviteText = useMemo(() => (
    inviteCode ? tr('share_text', { code: inviteCode }) : ''
  ), [inviteCode]);

  const handleShareInvite = useCallback(async () => {
    if (!inviteCode) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Наш остров', text: inviteText });
        return;
      }
    } catch { /* user cancelled */ }
    try {
      await navigator.clipboard.writeText(inviteText);
    } catch { /* clipboard may be unavailable */ }
  }, [inviteCode, inviteText]);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
    } catch { /* clipboard may be unavailable */ }
  }, [inviteCode]);

  const handleSignOut = useCallback(async () => {
    const ok = window.confirm(tr('signout_confirm'));
    if (!ok) return;
    // clear the device's saved code so the next person to sign in here doesn't
    // auto-open this island; their own worlds load from their account instead.
    clearSavedCode();
    stopAllSounds();
    await signOut(); // the auth listener flips session → null and resets the UI
  }, []);

  // permanently delete this account (islands/memories stay for the partner)
  const handleDeleteAccount = useCallback(async () => {
    await deleteMyAccount();   // server removes the account + this user's membership
    clearSavedCode();
    stopAllSounds();
    try { await signOut(); } catch { /* account already gone; clear session anyway */ }
  }, []);

  const handleLeave = useCallback(() => {
    const ok = window.confirm(tr('leave_confirm', { code }));
    if (!ok) return;
    clearSavedCode();
    stopAllSounds();
    setCode(null);
    setEvents([]);
    setPurchases([]);
    setSettings(DEFAULT_SETTINGS);
    setSelectedEvent(null);
    setEditingEvent(null);
    setShowAdd(false);
    setShowShop(false);
    setShowWishes(false);
    setShowFigures(false);
    setShowPremium(false);
    setShowPremiumPreview(false);
    setPremiumPreviewPack(null);
    setShowMenu(false);
    setShowCalendar(false);
    setShowBottle(false);
    setShowJar(false);
    setShowSettings(false);
    setShowAbout(false);
    setShowHelp(false);
    setShowTourOffer(false);
    setTourActive(false);
    setWishes([]);
  }, [code]);

  // Android hardware "back": close the topmost open panel instead of quitting.
  // The ref is refreshed every render so the listener always sees current state.
  const closeTopRef = useRef(() => false);
  closeTopRef.current = () => {
    if (showPremiumPreview) { setShowPremiumPreview(false); return true; }
    if (showPremium) { setShowPremium(false); return true; }
    if (showBottle) { setShowBottle(false); return true; }
    if (showJar) { setShowJar(false); return true; }
    if (editingEvent) { setEditingEvent(null); return true; }
    if (showAdd) { setShowAdd(false); return true; }
    if (selectedEvent) { setSelectedEvent(null); return true; }
    if (showHub) { setShowHub(false); return true; }
    if (showDecor) { closeDecor(); return true; }
    if (showShop) { setShowShop(false); return true; }
    if (showWishes) { setShowWishes(false); return true; }
    if (showFigures) { setShowFigures(false); return true; }
    if (showHelp) { setShowHelp(false); return true; }
    if (showAbout) { setShowAbout(false); return true; }
    if (showSettings) { setShowSettings(false); return true; }
    if (showCalendar) { setShowCalendar(false); return true; }
    if (showTourOffer) { setShowTourOffer(false); return true; }
    if (tourActive) { setTourActive(false); return true; }
    if (showMenu) { setShowMenu(false); return true; }
    return false;
  };
  useEffect(() => {
    let handle;
    CapacitorApp.addListener('backButton', () => {
      if (!closeTopRef.current()) CapacitorApp.minimizeApp();
    }).then((h) => { handle = h; }).catch(() => { /* not on a native device */ });
    return () => { handle && handle.remove(); };
  }, []);

  // Derived once per relevant change (not on every render) so the 3D scene's
  // applyUpgrades effect doesn't re-run — and rebuild pond animals — every time
  // an unrelated bit of UI (a menu, a panel, the confetti) mounts.
  const activeEffects = useMemo(
    () => computeActiveEffects(purchases, settings.effects_off),
    [purchases, settings.effects_off],
  );

  if (session === undefined || restoring) {
    return (
      <div className="screen-center">
        <div className="loading">
          <span className="spinner spinner-lg" />
          <p>{tr('loading')}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth lang={lang} onSetLang={changeLang} />;
  }

  if (!code) {
    return <Onboarding onCreate={handleCreate} onJoin={handleJoin} onRecover={handleRecover} />;
  }

  const balance = computeBalance(events.length, purchases);
  const hasLake = events.some((e) => e.type === 'lake');
  const visibleActiveBoy = normalizeFigureChoice('boy', settings.active_boy);
  const visibleActiveGirl = normalizeFigureChoice('girl', settings.active_girl);

  return (
    <>
      <IslandScene
        events={events}
        onTileClick={handleTileClick}
        onBottleClick={handleBottleClick}
        highlightedEventId={selectedEvent?.id}
        activeEffects={activeEffects}
        activeSky={settings.active_sky}
        activePalette={settings.active_palette}
        activeSea={settings.active_sea}
        activeIslandName={settings.island_name}
        activeBoy={visibleActiveBoy}
        activeGirl={visibleActiveGirl}
        activeBoat={settings.active_boat}
        figureColors={figureColors}
        plots={plots}
        decor={decor}
        decorMode={decorMode}
        decorPlaceKey={decorPlaceKey}
        selectedPlot={selectedPlot}
        onPlotAdd={handlePlotAdd}
        onPlotSelect={(q, r) => setSelectedPlot(q == null ? null : { q, r })}
        onDecorPlace={handleDecorPlace}
        onDecorUpdate={handleDecorUpdate}
        onDecorRemove={handleDecorRemove}
        onDecorSelect={setSelectedDecorId}
      />

      {!showDecor && (
        <>
          <div className="topbar">
            <div className="topbar-right">
              <button className="coin-btn mono" onClick={() => setShowHub(true)} title="Магазин и обустройство">
                🪙 {balance}
              </button>
            </div>
          </div>
          <button className="menu-btn" onClick={() => setShowMenu(true)} aria-label="Меню">☰</button>
          <button className="fab-add" onClick={() => setShowAdd(true)}>{tr('add_event')}</button>
          <div className="rotate-hint">{tr('rotate_hint')}</div>
        </>
      )}

      {showDecor && (
        <DecorPanel
          items={DECOR_ITEMS}
          inventory={inventory}
          selectedPlot={selectedPlot}
          selectedPlotColor={selectedPlot ? (plots.find((p) => p.q === selectedPlot.q && p.r === selectedPlot.r)?.color || '') : ''}
          onPlotColor={handlePlotColor}
          onRemovePlot={() => selectedPlot && handlePlotRemove(selectedPlot.q, selectedPlot.r)}
          tab={decorTab}
          onTab={(t) => { setDecorTab(t); setDecorPlaceKey(null); setSelectedDecorId(null); setSelectedPlot(null); }}
          placeKey={decorPlaceKey}
          onBuy={handleBuyDecor}
          onPickItem={(k) => { if (!(inventory[k] > 0)) return; setDecorPlaceKey((cur) => (cur === k ? null : k)); setSelectedDecorId(null); }}
          onStopPlacing={() => setDecorPlaceKey(null)}
          selectedId={selectedDecorId}
          onRotate={handleRotateSelected}
          onDelete={() => selectedDecorId && handleDecorRemove(selectedDecorId)}
          onClose={closeDecor}
        />
      )}

      {pendingPlotRemove && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setPendingPlotRemove(null)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <h2>Убрать площадку?</h2>
            <p className="sub">На ней стоит предметов: {pendingPlotRemove.count}. Они вернутся на склад — ничего не потеряется.</p>
            <div className="modal-actions">
              <button className="btn" style={{ flex: 1 }} onClick={() => setPendingPlotRemove(null)}>Отмена</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => doPlotRemove(pendingPlotRemove.q, pendingPlotRemove.r)}>Убрать</button>
            </div>
          </div>
        </div>
      )}

      {showHub && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowHub(false)}>
          <div className="modal hub">
            <button className="hub-x" onClick={() => setShowHub(false)} aria-label="Закрыть">✕</button>
            <h2>Обустроить остров</h2>
            <p className="sub mono">🪙 {balance} монет</p>
            <div className="hub-options">
              <button className="hub-opt" onClick={() => { setShowHub(false); setSelectedPlot(null); setSelectedDecorId(null); setDecorPlaceKey(null); setDecorTab('plots'); setShowDecor(true); }}>
                <span className="hub-emoji">🟩</span>
                <span className="hub-text"><b>Площадки</b><small>Добавить и покрасить шестиугольники</small></span>
                <span className="hub-arrow">›</span>
              </button>
              <button className="hub-opt" onClick={() => { setShowHub(false); setSelectedPlot(null); setSelectedDecorId(null); setDecorPlaceKey(null); setDecorTab('items'); setShowDecor(true); }}>
                <span className="hub-emoji">🪑</span>
                <span className="hub-text"><b>Предметы</b><small>Купить и расставить декор</small></span>
                <span className="hub-arrow">›</span>
              </button>
              <button className="hub-opt" onClick={() => { setShowHub(false); setShowShop(true); }}>
                <span className="hub-emoji">✨</span>
                <span className="hub-text"><b>Улучшения</b><small>Небо, палитра, эффекты, звуки, море</small></span>
                <span className="hub-arrow">›</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <DetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={(ev) => { setSelectedEvent(null); setEditingEvent(ev); }}
          onDelete={handleDeleteEvent}
          onNavigate={handleNavigateEvent}
        />
      )}

      {showAdd && (
        <AddEventModal onClose={() => setShowAdd(false)} onSave={handleCreateEvent} />
      )}

      {editingEvent && (
        <AddEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleUpdateEvent}
        />
      )}

      {showShop && (
        <Shop
          balance={balance}
          purchases={purchases}
          settings={settings}
          hasLake={hasLake}
          onBuy={handleBuy}
          onActivate={handleActivate}
          onToggle={handleToggle}
          isLocked={isLockedItem}
          onClose={() => setShowShop(false)}
        />
      )}

      {showWishes && (
        <WishList
          wishes={wishes}
          onAdd={handleAddWish}
          onToggle={handleToggleWish}
          onDelete={handleDeleteWish}
          onClose={() => setShowWishes(false)}
        />
      )}

      {showFigures && (
        <FigurePicker
          activeBoy={visibleActiveBoy}
          activeGirl={visibleActiveGirl}
          figureColors={figureColors}
          onSelect={handleActivate}
          onColorsChange={handleSetFigureColors}
          locked={isLockedItem('boy_1')}
          onClose={() => setShowFigures(false)}
        />
      )}

      {showPremium && (
        <Premium
          initialPack={premiumPack}
          ownedPacks={settings.owned_packs}
          onOpenFree={(pack) => handleOpenPack(pack)}
          onOpenAll={handleOpenAllPacks}
          onTry={(pack) => handleTryPack(pack)}
          onClose={() => setShowPremium(false)}
        />
      )}

      {showPremiumPreview && premiumPreviewPack && (
        <PremiumPreview
          pack={premiumPreviewPack}
          onOpenFree={() => { handleOpenPack(premiumPreviewPack); setShowPremiumPreview(false); }}
          onClose={() => setShowPremiumPreview(false)}
        />
      )}

      {showMenu && (
        <Menu
          code={code}
          balance={balance}
          onCalendar={() => { setShowMenu(false); setShowCalendar(true); }}
          onShop={() => { setShowMenu(false); setShowHub(true); }}
          onWishes={() => { setShowMenu(false); setShowWishes(true); }}
          onJar={() => { setShowMenu(false); setShowJar(true); }}
          onFigures={() => { setShowMenu(false); setShowFigures(true); }}
          onHelp={() => { setShowMenu(false); setShowHelp(true); }}
          onSettings={() => { setShowMenu(false); setShowSettings(true); }}
          onShare={() => { setShowMenu(false); handleShareCode(); }}
          onLeave={() => { setShowMenu(false); handleLeave(); }}
          onSignOut={() => { setShowMenu(false); handleSignOut(); }}
          onClose={() => setShowMenu(false)}
        />
      )}

      {showCalendar && (
        <MemoryCalendar
          events={events}
          onSelect={(event) => { setShowCalendar(false); setSelectedEvent(event); }}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {showSettings && (
        <Settings
          lang={lang}
          onSetLang={changeLang}
          onAbout={() => { setShowSettings(false); setShowAbout(true); }}
          onClose={() => setShowSettings(false)}
          events={events}
          code={code}
          islandName={settings.island_name}
          onSetIslandName={handleSetIslandName}
          onCreateRecovery={handleCreateRecovery}
          onDeleteAccount={handleDeleteAccount}
        />
      )}

      {showBottle && (
        <BottleNote
          note={settings.bottle_note}
          onSave={handleSetBottleNote}
          onClose={() => setShowBottle(false)}
        />
      )}

      {showJar && (
        <Jar
          role={jarRole}
          nameA={settings.name_a}
          nameB={settings.name_b}
          myName={myName}
          partnerName={partnerName}
          onClaim={handleJarClaim}
          onChooseRole={chooseJarRole}
          onSetNames={handleSetJarNames}
          reasonsAboutMe={reasonsAboutMe}
          reasonsAboutPartner={reasonsAboutPartner}
          seenIds={jarSeen}
          onReveal={handleRevealReason}
          onAdd={handleAddReason}
          onDelete={handleDeleteReason}
          onClose={() => setShowJar(false)}
        />
      )}

      {inviteCode && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setInviteCode(null)}>
          <div className="modal invite-modal">
            <div className="invite-emoji">💌</div>
            <p className="eyebrow">{tr('menu_share')}</p>
            <h2>{tr('invite_modal_title')}</h2>
            <p className="sub">{tr('invite_modal_sub')}</p>
            <div className="invite-code-card">
              <span>{tr('invite_code_label')}</span>
              <strong>{inviteCode}</strong>
            </div>
            <p className="invite-hint">{tr('invite_modal_hint')}</p>
            <div className="modal-actions invite-actions">
              <button className="btn btn-primary" onClick={handleShareInvite}>{tr('invite_share')}</button>
              <button className="btn" onClick={handleCopyInvite}>{tr('invite_copy')}</button>
            </div>
            <button className="link-btn invite-close" onClick={() => setInviteCode(null)}>{tr('close')}</button>
          </div>
        </div>
      )}

      {showAbout && <About onClose={() => setShowAbout(false)} />}

      {showHelp && <Help onClose={() => setShowHelp(false)} />}

      {showTourOffer && (
        <div className="overlay">
          <div className="card tour-offer">
            <div className="tour-offer-emoji">🏝️</div>
            <h1>{tr('tour_offer_title')}</h1>
            <p className="sub">{tr('tour_offer_text')}</p>
            <button className="btn btn-primary" onClick={() => { setShowTourOffer(false); setTourActive(true); }}>{tr('tour_yes')}</button>
            <button className="btn" onClick={() => setShowTourOffer(false)}>{tr('tour_no')}</button>
          </div>
        </div>
      )}

      {tourActive && <Tour onClose={() => setTourActive(false)} />}

      {salute > 0 && <Salute key={salute} onDone={() => setSalute(0)} />}
    </>
  );
}
