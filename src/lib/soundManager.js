// Plays looping ambient sounds for active "sound_*" shop items.
//
// Audio files are expected at  public/sounds/<name>.mp3  (e.g. sounds/rain.mp3
// for the item "sound_rain"). If a file is missing, play() rejects and is
// swallowed — the item is silent until an audio file is added, nothing breaks.

const audios = new Map();

export function setActiveSounds(keys) {
  // stop sounds that are no longer active
  for (const [k, a] of audios) {
    if (!keys.includes(k)) {
      try { a.pause(); } catch { /* ignore */ }
      audios.delete(k);
    }
  }
  // start newly active sounds
  for (const k of keys) {
    if (audios.has(k)) continue;
    const name = k.replace(/^sound_/, '');
    const a = new Audio(`/sounds/${name}.mp3`);
    a.loop = true;
    a.volume = 0.5;
    a.play().catch(() => { /* missing file or autoplay blocked — stays silent */ });
    audios.set(k, a);
  }
}

export function stopAllSounds() {
  for (const [, a] of audios) {
    try { a.pause(); } catch { /* ignore */ }
  }
  audios.clear();
}
