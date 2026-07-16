// Registry of 3D models per tile type.
//
// The loader now AUTO-FITS each model: it scales the model to fill one hex tile,
// centres it, sits it on the ground (y = 0), and clips it to the tile's hexagon
// so neighbouring tiles tessellate. So normally you only need url + hideBase.
//
// Optional fine-tuning fields (per entry), if a specific model needs a nudge:
//   scaleMul  — multiply the auto scale (e.g. 1.1 = 10% bigger)
//   yOffset   — raise (+) / lower (−) the model after it's seated on the ground
//   rotationY — rotate around the vertical axis, in radians
//
// These Tripo models include their own tile base, so hideBase:true. `milestone`
// has no model and keeps the built-in geometry.

export const TILE_MODELS = {
  // yOffset < 0 sinks a model so its own extra platform goes under our hex base
  // (the base-top clip then removes it), leaving just the building on the base.
  // These are first-pass values — fine-tune from a screenshot.
  // home / lake / sakura / sunflower: disabled by request — these tiles use the
  // original built-in (procedural) look from before the 3D models.
  // home:   { url: '/models/home.glb',      hideBase: true },
  // forest.glb is currently a byte-for-byte duplicate of mountains.glb, so the
  // "прогулка/время вместе" tile was showing mountains. Disabled → it falls back
  // to the built-in forest (pine trees). Re-enable once a real forest model is
  // placed at public/models/forest.glb.
  // forest: { url: '/models/forest.glb',    hideBase: true },
  mountains: { url: '/models/mountains.glb', hideBase: true, yOffset: -1.2 },
  lake:      { url: '/models/lake2.glb',     hideBase: true, yOffset: 0.6 },
  city:      { url: '/models/city.glb',      hideBase: true, yOffset: -0.5 },
  starfield: { url: '/models/starfield.glb', hideBase: true, yOffset: -1.02 },
  coffee:    { url: '/models/coffee.glb',    hideBase: true, yOffset: 0.15 },
  // scaleMul<1 pulls the walls inside the hex clip so they aren't sliced open;
  // doubleSide makes any remaining cut render solid instead of a see-through hole.
  theater:   { url: '/models/theater.glb',   hideBase: true, scaleMul: 0.9, doubleSide: true },
  waterfall: { url: '/models/fountain.glb',  hideBase: true, yOffset: 0.1 },
  cinema:    { url: '/models/cinema.glb',    hideBase: true, yOffset: -0.2 },
  // Новые локации: yOffset 0.6 сажает самую нижнюю точку модели ровно на верх
  // базы-шестиугольника (BASE_TOP), так что по высоте все стоят одинаково.
  // scaleMul 0.72 уменьшает модель, чтобы её края не выходили за грани
  // шестиугольника и ничего не срезалось клиппингом.
  play:      { url: '/models/play0.glb',       hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  kitchen:   { url: '/models/kitchen0.glb',    hideBase: true, yOffset: 0.6, scaleMul: 0.72 },
  skating:   { url: '/models/konki2.glb',      hideBase: true, yOffset: 0.6, scaleMul: 0.95 },
  proposal:  { url: '/models/Predlozhenie.glb', hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  fooling:   { url: '/models/durachilis.glb',  hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  quest:     { url: '/models/kvest.glb',       hideBase: true, yOffset: 0.6, scaleMul: 0.72 },
  rain:      { url: '/models/rain.glb',        hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  beach:     { url: '/models/beach.glb',       hideBase: true, yOffset: 0.6, scaleMul: 0.72 },
  hike:      { url: '/models/pohod.glb',       hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  movein:    { url: '/models/house.glb',       hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  pet:       { url: '/models/cat.glb',         hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  bike:      { url: '/models/bike.glb',        hideBase: true, yOffset: 0.6, scaleMul: 0.95 },
  music:     { url: '/models/music.glb',       hideBase: true, yOffset: 0.6, scaleMul: 0.95 },
  gift:      { url: '/models/gift.glb',        hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  dinner:    { url: '/models/yzhin.glb',       hideBase: true, yOffset: 0.6, scaleMul: 0.85 },
  spontan:   { url: '/models/spontanno0.glb',  hideBase: true, yOffset: 0.6, scaleMul: 0.72 },
  nature:    { url: '/models/priroda.glb',     hideBase: true, yOffset: 0.6, scaleMul: 0.95 },
  newthing:  { url: '/models/new.glb',         hideBase: true, yOffset: 0.6, scaleMul: 0.72 },
  buy:       { url: '/models/buy.glb',         hideBase: true, yOffset: 0.6, scaleMul: 0.72 },
  castle:    { url: '/models/castle.glb',    hideBase: true, roundClip: true },
  viewpoint: { url: '/models/viewpoint.glb', hideBase: true },
  sakura:    { url: '/models/sakura2.glb',   hideBase: true },
  sunflower: { url: '/models/sunflower1.glb', hideBase: true, scaleMul: 0.2, yOffset: 0.6, count: 6 },
  snowman:   { url: '/models/snowman.glb',   hideBase: true, yOffset: 0.18, roundClip: true },
  autumn:    { url: '/models/autumntree.glb', hideBase: true, scaleMul: 0.2, yOffset: 0.6, count: 6 },
};
