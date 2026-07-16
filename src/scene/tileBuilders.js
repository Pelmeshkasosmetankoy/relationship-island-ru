import * as THREE from 'three';
import { hexToPos, TILE_SIZE } from './hexMath';
import { getTileModel } from './modelLoader';

export const TYPES = [
  { key:'forest',    label:'Прогулка / время вместе',     color:'#4f8f4a', icon:'🌲', iconPath:'/event-icons/tree.svg' },
  { key:'mountains', label:'Пережили трудность',           color:'#8a8f9e', icon:'⛰️', iconPath:'/event-icons/mountain.svg' },
  { key:'lake',      label:'Спокойный счастливый период',  color:'#3f7ea8', icon:'🏞️', iconPath:'/event-icons/lake.svg' },
  { key:'city',      label:'Путешествие вместе',           color:'#d99a5c', icon:'🏙️', iconPath:'/event-icons/city.svg' },
  { key:'milestone', label:'Важная веха / достижение',     color:'#a084c9', icon:'🏆', iconPath:'/event-icons/reward.svg' },
  { key:'starfield', label:'Ночь, проведённая вместе',     color:'#4a3f75', icon:'🔭', iconPath:'/event-icons/telescope.svg' },
  { key:'coffee',    label:'Кофейня / посидели в кафе',    color:'#caa06b', icon:'☕', iconPath:'/event-icons/caffe.svg' },
  { key:'theater',   label:'Совместный культурный отдых',  color:'#dfd0a0', icon:'🎭', iconPath:'/event-icons/theatre.svg' },
  { key:'waterfall', label:'После крупной общей цели',     color:'#8a95a0', icon:'⛲', iconPath:'/event-icons/fountain.svg' },
  { key:'cinema',    label:'Просмотренный фильм / сериал', color:'#3a3450', icon:'🎬', iconPath:'/event-icons/cinema.svg' },
  { key:'play',      label:'Играли в игры',                color:'#a87ad0', icon:'🎮' },
  { key:'kitchen',   label:'Вместе готовили',              color:'#e08a4a', icon:'🍳' },
  { key:'skating',   label:'Катались на коньках',          color:'#8fd6e8', icon:'⛸️' },
  { key:'proposal',  label:'Сделал предложение',           color:'#e89ab8', icon:'💍' },
  { key:'fooling',   label:'Дурачились вместе',             color:'#e6c84a', icon:'🤪' },
  { key:'quest',     label:'Были на квесте',               color:'#5a9ea0', icon:'🗝️' },
  { key:'rain',      label:'Попали под дождь',             color:'#8ea0bd', icon:'🌧️' },
  { key:'beach',     label:'Были на пляже',                color:'#e8d79a', icon:'🏖️' },
  { key:'hike',      label:'Сходили в поход',              color:'#5f9a4a', icon:'⛺' },
  { key:'movein',    label:'Съехались',                    color:'#d0a878', icon:'🏡' },
  { key:'pet',       label:'Завели питомца',               color:'#c98f5c', icon:'🐾' },
  { key:'bike',      label:'Катались на велосипеде',       color:'#6fa85a', icon:'🚴' },
  { key:'gift',      label:'Подарили подарки',             color:'#d05a6a', icon:'🎁' },
  { key:'dinner',    label:'Вкусно поели',                 color:'#d07a96', icon:'🍽️' },
  { key:'spontan',   label:'Что-то спонтанное',            color:'#e0b84a', icon:'⚡' },
  { key:'nature',    label:'Провели время на природе',     color:'#6fae55', icon:'🌿' },
  { key:'newthing',  label:'Попробовали что-то новое',     color:'#9a7ad0', icon:'✨' },
  { key:'buy',       label:'Купили что-то вместе',         color:'#d88a5a', icon:'🛍️' },
  { key:'picnic',    label:'Пикник вместе',                color:'#8fc24a', icon:'🧺' },
  { key:'prazdnik',  label:'Отметили праздник',            color:'#d86a9a', icon:'🎊' },
  { key:'osobenno',  label:'Сделали этот день особенным',  color:'#e0b060', icon:'🌟' },
  { key:'svidanie',  label:'Были на свидании',             color:'#e07a9a', icon:'💕' },
  { key:'newstep',   label:'Новый этап в отношениях',      color:'#b488d0', icon:'🌱' },
  { key:'castle',    label:'Годовщина отношений',          color:'#c7ccd6', icon:'🏰', iconPath:'/event-icons/castle.svg' },
  { key:'viewpoint', label:'Рассвет или закат вместе',     color:'#7bb35a', icon:'🌅', iconPath:'/event-icons/dawn.svg' },
  { key:'sakura',    label:'Весна вместе',                  color:'#8fce78', icon:'🌸', iconPath:'/event-icons/sakura.svg' },
  { key:'sunflower', label:'Лето вместе',                   color:'#a8cf5a', icon:'🌻', iconPath:'/event-icons/sunflower.svg' },
  { key:'autumn',    label:'Осень вместе',                  color:'#cf8a3a', icon:'🍁', iconPath:'/event-icons/autumn.svg' },
  { key:'snowman',   label:'Зима вместе',                   color:'#eef3f7', icon:'⛄', iconPath:'/event-icons/snowman.svg' },
];

// Группировка типов событий для окна «Добавить событие» (сворачиваемые разделы).
// Подписи разделов — в i18n по ключам evcat_<id>_title / evcat_<id>_sub.
export const TYPE_CATEGORIES = [
  { id:'milestones', icon:'💍', accent:'#e89ab8', keys:['proposal','newstep','castle','movein','pet','milestone'] },
  { id:'fun',        icon:'🎉', accent:'#e6b84a', keys:['svidanie','prazdnik','osobenno','coffee','theater','cinema','play','kitchen','fooling','quest','gift','dinner','buy'] },
  { id:'adventures', icon:'🏞️', accent:'#6fb85a', keys:['picnic','forest','city','starfield','skating','beach','hike','bike','spontan','nature','newthing','viewpoint','rain'] },
  { id:'feelings',   icon:'🌊', accent:'#7bb6d8', keys:['lake','mountains','waterfall','sakura','sunflower','autumn','snowman'] },
];

function flatMat(hex){ return new THREE.MeshLambertMaterial({ color: hex }); }
function shade(hex, factor){ const c = new THREE.Color(hex); c.multiplyScalar(factor); return c.getHex(); }
function addRock(group, x, z, scale){
  scale = scale || 0.16 + Math.random()*0.08;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), flatMat(0x9a9a9a));
  rock.position.set(x, 0.6 + scale*0.55, z);
  rock.rotation.set(Math.random()*2, Math.random()*2, Math.random()*2);
  rock.castShadow = true; rock.receiveShadow = true;
  group.add(rock);
}
function addGrassTuft(group, x, z){
  const g = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.32, 4), flatMat(0x5a9a4f));
  g.position.set(x, 0.6 + 0.16, z);
  g.rotation.y = Math.random()*Math.PI;
  group.add(g);
}

export let TEXTURES = {};
function makeCanvasTexture(w, h, drawFn){
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
export function initTextures(){
  TEXTURES.roofTile = makeCanvasTexture(128,128,(ctx,w,h)=>{
    ctx.fillStyle = '#c9683a'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(90,40,20,0.45)'; ctx.lineWidth = 2;
    const rows = 8;
    for(let r=0;r<rows;r++){
      const y = r*h/rows;
      ctx.beginPath();
      for(let x=0;x<=w;x+=8){
        ctx.arc(x, y, 5, 0, Math.PI, true);
      }
      ctx.stroke();
    }
  });
  TEXTURES.roofTile.wrapS = TEXTURES.roofTile.wrapT = THREE.RepeatWrapping;
  TEXTURES.roofTile.repeat.set(2,2);

  TEXTURES.stone = makeCanvasTexture(128,128,(ctx,w,h)=>{
    ctx.fillStyle = '#d7dbe0'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#9aa1ae'; ctx.lineWidth = 2.5;
    const rows=6, cols=4;
    for(let r=0;r<=rows;r++){
      const y = r*h/rows;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }
    for(let r=0;r<rows;r++){
      const y = r*h/rows;
      const offset = (r%2)*(w/cols/2);
      for(let c=0;c<=cols;c++){
        const x = (c*w/cols + offset) % w;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+h/rows); ctx.stroke();
      }
    }
  });
  TEXTURES.stone.wrapS = TEXTURES.stone.wrapT = THREE.RepeatWrapping;
  TEXTURES.stone.repeat.set(2,3);

  TEXTURES.cinemaMarquee = makeCanvasTexture(256,64,(ctx,w,h)=>{
    ctx.fillStyle = '#1e1a30'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#f2ead4'; ctx.fillRect(6,6,w-12,h-12);
    ctx.fillStyle = '#1e1a30';
    ctx.font = 'bold 32px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CINEMA', w/2, h/2+2);
    ctx.fillStyle = '#ffcf6a';
    for(let i=0;i<12;i++){
      const x = 14 + i*(w-28)/11;
      ctx.beginPath(); ctx.arc(x, 9, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, h-9, 3, 0, Math.PI*2); ctx.fill();
    }
  });

  TEXTURES.coffeeCup = makeCanvasTexture(128,96,(ctx,w,h)=>{
    ctx.fillStyle = '#f5efe0'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#3a2a18';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('COFFEE', w/2, h/2);
  });

  TEXTURES.cafeSign = makeCanvasTexture(96,140,(ctx,w,h)=>{
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#8c7748'; ctx.lineWidth = 5;
    ctx.strokeRect(4,4,w-8,h-8);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = '16px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('cafe', w/2, h/2-14);
    ctx.font = '11px Georgia, serif';
    ctx.fillText('espresso', w/2, h/2+10);
    ctx.fillText('latte', w/2, h/2+28);
  });

  // Neutral (near-white) detail maps: they MULTIPLY the per-tile colour, adding
  // surface texture without changing the hue — so the land palette still works.
  TEXTURES.ground = makeCanvasTexture(128,128,(ctx,w,h)=>{
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
    for(let i=0;i<700;i++){
      const x=Math.random()*w, y=Math.random()*h, r=Math.random()*1.6+0.4;
      ctx.fillStyle = Math.random()<0.5 ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle='rgba(0,0,0,0.05)'; ctx.lineWidth=1;
    for(let i=0;i<90;i++){
      const x=Math.random()*w, y=Math.random()*h;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(Math.random()-0.5)*3, y-Math.random()*4); ctx.stroke();
    }
  });
  TEXTURES.ground.wrapS = TEXTURES.ground.wrapT = THREE.RepeatWrapping;
  TEXTURES.ground.repeat.set(3,3);

  TEXTURES.soil = makeCanvasTexture(64,64,(ctx,w,h)=>{
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=6){
      ctx.fillStyle = (Math.floor(y/6)%2===0) ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.11)';
      ctx.fillRect(0,y,w,3);
    }
    for(let i=0;i<140;i++){ ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fillRect(Math.random()*w, Math.random()*h, 1, 1); }
  });
  TEXTURES.soil.wrapS = TEXTURES.soil.wrapT = THREE.RepeatWrapping;
  TEXTURES.soil.repeat.set(3,1);

  TEXTURES.water = makeCanvasTexture(128,128,(ctx,w,h)=>{
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=2;
    for(let i=0;i<18;i++){
      const y=Math.random()*h; ctx.beginPath();
      for(let x=0;x<=w;x+=8) ctx.lineTo(x, y+Math.sin((x/w)*Math.PI*2+i)*2);
      ctx.stroke();
    }
    ctx.strokeStyle='rgba(0,45,75,0.10)';
    for(let i=0;i<14;i++){
      const y=Math.random()*h; ctx.beginPath();
      for(let x=0;x<=w;x+=8) ctx.lineTo(x, y+Math.cos((x/w)*Math.PI*2+i)*2);
      ctx.stroke();
    }
  });
  TEXTURES.water.wrapS = TEXTURES.water.wrapT = THREE.RepeatWrapping;
  TEXTURES.water.repeat.set(2,2);
}

export function buildTile(id, type, q, r){
  const {x, z} = hexToPos(q, r);
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.tileId = id;
  group.userData.type = type;

  const baseColors = {
    home: 0xdccf9e, forest: 0x6fa85a, mountains: 0xd7dbe0,
    lake: 0x8fbf7a, city: 0xe0cd9c, milestone: 0x8a76b8,
    starfield: 0x4a3f75, coffee: 0xdec9a0, theater: 0xe0d4b0,
    waterfall: 0x6fa85a, cinema: 0x2e2a45, play: 0xa87ad0, castle: 0xc7ccd6,
    viewpoint: 0x6fa85a, sakura: 0x7ec26a, sunflower: 0x8fc24a,
    autumn: 0xcf8a3a, snowman: 0xeef3f7,
    kitchen: 0xe08a4a, skating: 0x8fd6e8, proposal: 0xe89ab8, fooling: 0xe6c84a,
    quest: 0x5a9ea0, rain: 0x8ea0bd, beach: 0xe8d79a, hike: 0x5f9a4a,
    movein: 0xd0a878, pet: 0xc98f5c,
    bike: 0x6fa85a, gift: 0xd05a6a, dinner: 0xd07a96,
    spontan: 0xe0b84a, nature: 0x6fae55, newthing: 0x9a7ad0, buy: 0xd88a5a,
    picnic: 0x8fc24a, prazdnik: 0xd86a9a, osobenno: 0xe0b060, svidanie: 0xe07a9a, newstep: 0xb488d0
  };
  const topColor = baseColors[type] || 0x7fae5c;
  const sideColor = shade(topColor, 0.5);

  // If a 3D model is registered for this type, use it. Otherwise fall through to
  // the built-in procedural geometry below, so untouched types look as before.
  const tileModel = getTileModel(type, x, z);

  // Always place the uniform procedural hex base: it tessellates perfectly and is
  // the same height for every tile. A model (if any) is clipped to sit on top of
  // this base, so the island stays even and gap-free whatever shape the model's
  // own platform is.
  const baseGeo = new THREE.CylinderGeometry(TILE_SIZE, TILE_SIZE, 0.6, 6);
  const base = new THREE.Mesh(baseGeo, [
    new THREE.MeshLambertMaterial({ color: sideColor, map: TEXTURES.soil }),
    new THREE.MeshLambertMaterial({ color: topColor, map: TEXTURES.ground }),
    new THREE.MeshLambertMaterial({ color: sideColor, map: TEXTURES.soil }),
  ]);
  base.position.y = 0.3;
  base.receiveShadow = true;
  base.castShadow = true;
  // remember the original material colours (side/top/bottom) so land-palette
  // upgrades can re-tint the base without losing the per-type colour
  base.userData.tileBaseColors = [sideColor, topColor, sideColor];
  group.add(base);

  if (tileModel) {
    group.add(tileModel.object);
    return group;
  }

  if(type === 'home') addHomeProps(group);
  else if(type === 'forest') addForestProps(group);
  else if(type === 'mountains') addMountainProps(group);
  else if(type === 'lake') addLakeProps(group);
  else if(type === 'city') addCityProps(group);
  else if(type === 'milestone') addMilestoneProps(group);
  else if(type === 'starfield') addStarfieldProps(group);
  else if(type === 'coffee') addCoffeeProps(group);
  else if(type === 'theater') addTheaterProps(group);
  else if(type === 'waterfall') addWaterfallProps(group);
  else if(type === 'cinema') addCinemaProps(group);
  else if(type === 'castle') addCastleProps(group);
  else if(type === 'viewpoint') addViewpointProps(group);
  else if(type === 'sakura') addSakuraProps(group);
  else if(type === 'sunflower') addSunflowerProps(group);
  else if(type === 'snowman') addSnowmanProps(group);

  return group;
}

function addHomeProps(group){
  const wallColor = 0xe8dcc0;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.95), flatMat(wallColor));
  wall.position.y = 0.6 + 0.425;
  wall.castShadow = true; wall.receiveShadow = true;
  group.add(wall);

  const eaveY = 0.6 + 0.85;
  const ridgeY = eaveY + 0.5;
  const roofColor = 0xc9683a;
  const panelGeo = new THREE.BoxGeometry(1.5, 0.07, 0.72);
  const roofMat = new THREE.MeshLambertMaterial({ map: TEXTURES.roofTile });
  const panelA = new THREE.Mesh(panelGeo, roofMat);
  panelA.rotation.x = THREE.MathUtils.degToRad(38);
  panelA.position.set(0, (ridgeY+eaveY)/2, 0.27);
  panelA.castShadow = true;
  group.add(panelA);
  const panelB = new THREE.Mesh(panelGeo, roofMat);
  panelB.rotation.x = THREE.MathUtils.degToRad(-38);
  panelB.position.set(0, (ridgeY+eaveY)/2, -0.27);
  panelB.castShadow = true;
  group.add(panelB);

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-0.475, 0);
  gableShape.lineTo(0.475, 0);
  gableShape.lineTo(0, 0.5);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, {depth:0.02, bevelEnabled:false});
  const gableLeft = new THREE.Mesh(gableGeo, flatMat(wallColor));
  gableLeft.rotation.y = Math.PI/2;
  gableLeft.position.set(-0.65, eaveY, 0);
  group.add(gableLeft);
  const gableRight = new THREE.Mesh(gableGeo, flatMat(wallColor));
  gableRight.rotation.y = Math.PI/2;
  gableRight.position.set(0.648, eaveY, 0);
  group.add(gableRight);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.34,0.16), flatMat(0xb0a89a));
  chimney.position.set(0.35, ridgeY-0.02, 0.05);
  chimney.castShadow = true;
  group.add(chimney);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.28,0.5,0.06), flatMat(0x7a5230));
  door.position.set(-0.15, 0.6+0.25, 0.478);
  group.add(door);

  const winGeo = new THREE.BoxGeometry(0.22,0.22,0.05);
  const winMat = flatMat(0x9fd6e0);
  [[0.4,0.58,0.478],[-0.5,0.58,0.478]].forEach(p=>{
    const w = new THREE.Mesh(winGeo, winMat);
    w.position.set(p[0],p[1],p[2]);
    group.add(w);
  });
  const sideWin = new THREE.Mesh(winGeo, winMat);
  sideWin.rotation.y = Math.PI/2;
  sideWin.position.set(0.653, 0.6+0.55, 0.15);
  group.add(sideWin);

  [[-0.15,-0.4],[-0.15,-0.65],[-0.15,-0.9]].forEach(p=>{
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.03,6), flatMat(0xc9c3b0));
    stone.position.set(p[0], 0.6+0.016, p[1]);
    group.add(stone);
  });

  for(let i=0;i<3;i++){
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.22,0.04), flatMat(0x8c7748));
    post.position.set(0.92, 0.6+0.11, -0.5+i*0.28);
    group.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.04,0.6), flatMat(0x8c7748));
  rail.position.set(0.92, 0.6+0.16, -0.36);
  group.add(rail);

  [[-0.85,0.6],[0.85,0.62]].forEach(p=>{
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16,0), flatMat(0x5a9a4f));
    bush.position.set(p[0], 0.6+0.16, p[1]);
    group.add(bush);
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.4,6), flatMat(0x6b4423));
  trunk.position.set(-0.9, 0.6+0.2, -0.62);
  group.add(trunk);
  const treeTop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32,0), flatMat(0x4a8a45));
  treeTop.position.set(-0.9, 0.6+0.4+0.28, -0.62);
  treeTop.castShadow = true;
  group.add(treeTop);
}

function addForestProps(group){
  const spots = [[-0.7,-0.5,1.0],[0.6,0.3,0.85],[-0.1,0.8,0.95],[0.85,-0.3,0.7],[-0.85,0.35,0.65],[0.15,-0.85,0.75]];
  const greens = [0x3f7d3a, 0x5a9a4f, 0x4a8a45];
  spots.forEach((s,i)=>{
    const scale = s[2];
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08*scale,0.1*scale,0.4*scale,8), flatMat(0x6b4423));
    trunk.position.set(s[0], 0.6+0.2*scale, s[1]);
    trunk.castShadow = true;
    group.add(trunk);
    const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.42*scale, 0.9*scale, 8), flatMat(greens[i%greens.length]));
    foliage.position.set(s[0], 0.6+0.4*scale+0.5*scale, s[1]);
    foliage.castShadow = true;
    group.add(foliage);
  });
  addRock(group, 0.9, -0.5, 0.15);
  addRock(group, -1.0, -0.75, 0.12);
  addGrassTuft(group, -0.9, 0.4);
  addGrassTuft(group, 0.4, 0.95);
}

function addMountainProps(group){
  const peaks = [[-0.4,-0.3,0.62,1.75],[0.4,0.1,0.5,1.4],[-0.75,0.15,0.34,0.85],[0.15,-0.7,0.4,1.05],[0.75,-0.35,0.3,0.75]];
  peaks.forEach(p=>{
    const [px,pz,rad,h] = p;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 8), flatMat(0x9aa0ad));
    peak.position.set(px, 0.6+h/2, pz);
    peak.castShadow = true;
    group.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rad*0.5, h*0.32, 8), flatMat(0xf7f7f4));
    cap.position.set(px, 0.6+h - h*0.14, pz);
    cap.castShadow = true;
    group.add(cap);
  });
  const trunk1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.3,8), flatMat(0x6b4423));
  trunk1.position.set(-0.9, 0.6+0.15, 0.6);
  group.add(trunk1);
  const tree1 = new THREE.Mesh(new THREE.ConeGeometry(0.28,0.6,8), flatMat(0x4a8a45));
  tree1.position.set(-0.9, 0.6+0.3+0.3, 0.6);
  tree1.castShadow = true;
  group.add(tree1);
  const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.055,0.24,8), flatMat(0x6b4423));
  trunk2.position.set(-0.55, 0.6+0.12, 0.9);
  group.add(trunk2);
  const tree2 = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.48,8), flatMat(0x3f7d3a));
  tree2.position.set(-0.55, 0.6+0.24+0.24, 0.9);
  tree2.castShadow = true;
  group.add(tree2);
  const trunk3 = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.2,8), flatMat(0x6b4423));
  trunk3.position.set(1.0, 0.6+0.1, 0.35);
  group.add(trunk3);
  const tree3 = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.4,8), flatMat(0x4a8a45));
  tree3.position.set(1.0, 0.6+0.2+0.2, 0.35);
  tree3.castShadow = true;
  group.add(tree3);
  addRock(group, 1.0, 0.55, 0.17);
  addRock(group, -1.15, -0.2, 0.14);
  addRock(group, 0.15, 0.95, 0.12);
  addGrassTuft(group, 0.7, 0.8);
  addGrassTuft(group, -0.2, 0.95);
  addGrassTuft(group, -1.0, 0.5);
}

function addLakeProps(group){
  const pts = [[0,1.0],[0.65,0.75],[0.95,0.05],[0.6,-0.7],[-0.15,-0.95],[-0.8,-0.55],[-0.95,0.1],[-0.5,0.8]];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for(let i=1;i<pts.length;i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const water = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth:0.14, bevelEnabled:false}), new THREE.MeshLambertMaterial({ color:0x3f7ea8, map: TEXTURES.water }));
  water.rotation.x = -Math.PI/2;
  water.position.y = 0.6 + 0.02;
  water.receiveShadow = true;
  group.add(water);
  const shine = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), new THREE.MeshBasicMaterial({color:0xdff2f7, transparent:true, opacity:0.55}));
  shine.rotation.x = -Math.PI/2;
  shine.position.set(0.25, 0.6+0.17, -0.15);
  group.add(shine);
  const reedGeo = new THREE.ConeGeometry(0.05, 0.45, 4);
  [[1.15,0.55],[1.3,0.3],[-1.15,-0.35]].forEach(p=>{
    const reed = new THREE.Mesh(reedGeo, flatMat(0x6fa85a));
    reed.position.set(p[0], 0.6+0.22, p[1]);
    group.add(reed);
  });
  addRock(group, 1.05, -0.7, 0.15);
  addRock(group, -0.85, -0.85, 0.12);
  addGrassTuft(group, -0.5, -1.05);
  addGrassTuft(group, 1.0, 0.9);
  addGrassTuft(group, -1.0, 0.15);
}

function addCityProps(group){
  const buildings = [
    {x:-0.65,z:-0.15,w:0.42,h:0.85,d:0.42,color:0xb3a7cf,roof:'flat'},
    {x:-0.05,z:-0.55,w:0.48,h:1.5,d:0.48,color:0xd9a85c,roof:'spire'},
    {x:0.55,z:-0.35,w:0.4,h:1.15,d:0.4,color:0x8fae9a,roof:'point'},
    {x:0.75,z:0.35,w:0.42,h:0.95,d:0.42,color:0x9aa8b8,roof:'flat'},
    {x:0.1,z:0.45,w:0.4,h:0.6,d:0.4,color:0xd98f5c,roof:'flat'},
    {x:-0.55,z:0.55,w:0.32,h:0.5,d:0.32,color:0xe8e2d0,roof:'flat'},
    {x:-1.0,z:0.15,w:0.28,h:0.4,d:0.28,color:0xc9706a,roof:'flat'},
  ];
  buildings.forEach(b=>{
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w,b.h,b.d), flatMat(b.color));
    m.position.set(b.x, 0.6+b.h/2, b.z);
    m.castShadow = true;
    group.add(m);
    for(let wy=0.18; wy<b.h-0.1; wy+=0.22){
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.11,0.02), flatMat(0xd4af6a));
      win.position.set(b.x, 0.6+wy, b.z + b.d/2 + 0.01);
      group.add(win);
    }
    if(b.roof === 'spire'){
      const roof = new THREE.Mesh(new THREE.ConeGeometry(b.w*0.32, 0.4, 8), flatMat(0x7a9585));
      roof.position.set(b.x, 0.6+b.h+0.2, b.z);
      roof.castShadow = true;
      group.add(roof);
    } else if(b.roof === 'point'){
      const roof = new THREE.Mesh(new THREE.ConeGeometry(b.w*0.5, 0.22, 4), flatMat(0x6a8878));
      roof.rotation.y = Math.PI/4;
      roof.position.set(b.x, 0.6+b.h+0.11, b.z);
      group.add(roof);
    }
  });
  const roadMat = flatMat(0xc9bd9e);
  [[[-0.3,-0.35],[0.25,-0.35],0.18],[[-0.3,-0.35],[-0.3,0.25],0.18],[[-0.3,0.25],[-0.7,0.5],0.16]].forEach(seg=>{
    const [p1,p2,w] = seg;
    const dx = p2[0]-p1[0], dz = p2[1]-p1[1];
    const len = Math.sqrt(dx*dx+dz*dz);
    const road = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, w), roadMat);
    road.position.set((p1[0]+p2[0])/2, 0.6+0.011, (p1[1]+p2[1])/2);
    road.rotation.y = -Math.atan2(dz, dx);
    group.add(road);
  });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.22,8), flatMat(0x6b4423));
  trunk.position.set(-1.05, 0.6+0.11, 0.65);
  group.add(trunk);
  const tree = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22,0), flatMat(0x5a9a4f));
  tree.position.set(-1.05, 0.6+0.22+0.2, 0.65);
  tree.castShadow = true;
  group.add(tree);
  const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.04,0.18,8), flatMat(0x6b4423));
  trunk2.position.set(0.95, 0.6+0.09, -0.85);
  group.add(trunk2);
  const tree2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18,0), flatMat(0x4a8a45));
  tree2.position.set(0.95, 0.6+0.18+0.15, -0.85);
  group.add(tree2);
  const trunk3 = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.04,0.16,8), flatMat(0x6b4423));
  trunk3.position.set(-0.75, 0.6+0.08, -0.9);
  group.add(trunk3);
  const tree3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16,0), flatMat(0x5a9a4f));
  tree3.position.set(-0.75, 0.6+0.16+0.13, -0.9);
  group.add(tree3);
  addRock(group, -0.9, -0.9, 0.13);
}

function addMilestoneProps(group){
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.2,0.62), flatMat(0x3a3450));
  base1.position.y = 0.6 + 0.1;
  base1.castShadow = true;
  group.add(base1);
  const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.22,0.46), flatMat(0x423a5a));
  base2.position.y = 0.6 + 0.2 + 0.11;
  base2.castShadow = true;
  group.add(base2);
  const base3 = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.24,0.32), flatMat(0x4a4262));
  base3.position.y = 0.6 + 0.2 + 0.22 + 0.12;
  base3.castShadow = true;
  group.add(base3);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({color:0xd4af6a, emissive:0x6b5220, emissiveIntensity:0.5, flatShading:true}));
  crystal.position.y = 0.6 + 0.2 + 0.22 + 0.24 + 0.4;
  crystal.castShadow = true;
  group.add(crystal);
  group.userData.crystal = crystal;
  addRock(group, -0.85, 0.6, 0.15);
  addRock(group, 0.9, -0.55, 0.13);
  addRock(group, -0.6, -0.85, 0.12);
  addRock(group, 0.85, 0.65, 0.11);
  addGrassTuft(group, 0.75, 0.7);
  addGrassTuft(group, -0.9, -0.2);
  addGrassTuft(group, -0.3, 0.95);
}

function addStarfieldProps(group){
  const legMat = flatMat(0x2a2a30);
  for(let i=0;i<3;i++){
    const ang = i*(Math.PI*2/3);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.55,6), legMat);
    leg.position.set(Math.cos(ang)*0.18, 0.6+0.27, Math.sin(ang)*0.18);
    leg.rotation.z = Math.cos(ang)*0.35;
    leg.rotation.x = Math.sin(ang)*0.35;
    group.add(leg);
  }
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.08,8,8), flatMat(0x3a3a42));
  pivot.position.y = 0.6+0.55;
  group.add(pivot);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.55,8), flatMat(0xd4af6a));
  tube.position.set(0.15, 0.6+0.72, 0);
  tube.rotation.z = THREE.MathUtils.degToRad(55);
  tube.castShadow = true;
  group.add(tube);
  const starMat = new THREE.MeshStandardMaterial({color:0xf7e08a, emissive:0xf0c93a, emissiveIntensity:0.7});
  [[-0.7,1.3,-0.5],[0.5,1.5,0.6],[-0.2,1.1,0.8],[0.8,1.2,-0.3],[-0.9,0.95,0.2]].forEach(p=>{
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.07,0), starMat);
    star.position.set(p[0], 0.6+p[1], p[2]);
    group.add(star);
  });
  addRock(group, 0.9, 0.6, 0.14);
  addRock(group, -0.85, -0.5, 0.12);
  addGrassTuft(group, -0.5, 0.7);
  addGrassTuft(group, 0.6, -0.6);
}

function addCoffeeProps(group){
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.75,0.8), flatMat(0xcaa06b));
  wall.position.y = 0.6+0.375;
  wall.castShadow = true;
  group.add(wall);
  const roofBand = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.16,0.9), flatMat(0x6b4a2f));
  roofBand.position.y = 0.6+0.75+0.08;
  group.add(roofBand);
  for(let i=-2;i<=2;i++){
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.06,0.35), flatMat(i%2===0?0xf5efe0:0xc9683a));
    stripe.position.set(i*0.2, 0.6+0.6, 0.55);
    stripe.rotation.x = THREE.MathUtils.degToRad(20);
    group.add(stripe);
  }
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.13,0.22,8), flatMat(0xf5efe0));
  cup.position.set(0, 0.6+0.75+0.16+0.22, 0);
  cup.castShadow = true;
  group.add(cup);
  const cupLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.24,0.16), new THREE.MeshBasicMaterial({map: TEXTURES.coffeeCup}));
  cupLabel.position.set(0, 0.6+0.75+0.16+0.22, 0.14);
  group.add(cupLabel);
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.13,10), flatMat(0x4a2e18));
  liquid.rotation.x = -Math.PI/2;
  liquid.position.set(0, 0.6+0.75+0.16+0.33, 0);
  group.add(liquid);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08,0.02,8,12), flatMat(0xf5efe0));
  handle.rotation.y = Math.PI/2;
  handle.position.set(0.17, 0.6+0.75+0.16+0.24, 0);
  group.add(handle);
  const easelLegA = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.32,4), flatMat(0x6b4423));
  easelLegA.position.set(-0.66, 0.6+0.16, 0.66);
  easelLegA.rotation.z = 0.28;
  group.add(easelLegA);
  const easelLegB = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.32,4), flatMat(0x6b4423));
  easelLegB.position.set(-0.5, 0.6+0.16, 0.66);
  easelLegB.rotation.z = -0.28;
  group.add(easelLegB);
  const boardSign = new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.3), new THREE.MeshBasicMaterial({map: TEXTURES.cafeSign}));
  boardSign.position.set(-0.58, 0.6+0.32, 0.66);
  group.add(boardSign);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.45,0.05), flatMat(0x4a3320));
  doorMesh.position.set(0, 0.6+0.225, 0.4+0.03);
  group.add(doorMesh);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.03,10), flatMat(0x8c7748));
  table.position.set(-0.75,0.6+0.22,0.55);
  group.add(table);
  const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.2,6), flatMat(0x6b4423));
  tableLeg.position.set(-0.75,0.6+0.1,0.55);
  group.add(tableLeg);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.3,8), flatMat(0x6b4423));
  trunk.position.set(0.85,0.6+0.15,0.5);
  group.add(trunk);
  const treeTop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24,0), flatMat(0x5a9a4f));
  treeTop.position.set(0.85,0.6+0.3+0.2,0.5);
  treeTop.castShadow = true;
  group.add(treeTop);
  addRock(group,-0.9,-0.6,0.13);
}

function addTheaterProps(group){
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.85,0.85), flatMat(0xe6dcc0));
  wall.position.y=0.6+0.425;
  wall.castShadow=true;
  group.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95,0.35,4), new THREE.MeshLambertMaterial({map: TEXTURES.roofTile}));
  roof.rotation.y=Math.PI/4;
  roof.scale.set(1,1,0.6);
  roof.position.y=0.6+0.85+0.17;
  roof.castShadow=true;
  group.add(roof);
  for(let i=-2;i<=2;i++){
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.7,8), flatMat(0xf2ead4));
    col.position.set(i*0.22,0.6+0.35,0.44);
    group.add(col);
  }
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.02,0.55), flatMat(0xa8323a));
  carpet.position.set(0,0.6+0.011,0.75);
  group.add(carpet);
  [[-0.75,0.55],[0.75,0.55]].forEach(p=>{
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.4,6), flatMat(0x3a3a3a));
    post.position.set(p[0],0.6+0.2,p[1]);
    group.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8), new THREE.MeshStandardMaterial({color:0xffe9a8, emissive:0xffcf6a, emissiveIntensity:0.6}));
    lamp.position.set(p[0],0.6+0.42,p[1]);
    group.add(lamp);
  });
  addRock(group,-0.9,-0.6,0.12);
  addGrassTuft(group,0.9,-0.5);
}

function addWaterfallProps(group){
  const rockColor=0x9aa0ad;
  const cliffH=1.1;
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(0.9,cliffH,0.5), flatMat(rockColor));
  cliff.position.set(-0.2,0.6+cliffH/2,-0.4);
  cliff.castShadow=true;
  group.add(cliff);
  const cliff2H=0.75;
  const cliff2 = new THREE.Mesh(new THREE.BoxGeometry(0.5,cliff2H,0.45), flatMat(shade(rockColor,0.85)));
  cliff2.position.set(0.5,0.6+cliff2H/2,-0.55);
  cliff2.castShadow=true;
  group.add(cliff2);
  const fall = new THREE.Mesh(new THREE.BoxGeometry(0.2,cliffH*0.95,0.05), new THREE.MeshStandardMaterial({color:0x8fd0e8, transparent:true, opacity:0.85}));
  fall.position.set(-0.2,0.6+cliffH*0.45,-0.13);
  group.add(fall);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.14,16), new THREE.MeshLambertMaterial({ color:0x3f7ea8, map: TEXTURES.water }));
  pool.position.set(-0.1,0.6+0.07,0.35);
  group.add(pool);
  const foam = new THREE.Mesh(new THREE.CircleGeometry(0.16,10), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.7}));
  foam.rotation.x=-Math.PI/2;
  foam.position.set(-0.2,0.6+0.15,0.02);
  group.add(foam);
  const trunk1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.055,0.24,8), flatMat(0x6b4423));
  trunk1.position.set(-0.2,0.6+cliffH+0.12,-0.4);
  group.add(trunk1);
  const tree1 = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,8), flatMat(0x4a8a45));
  tree1.position.set(-0.2,0.6+cliffH+0.24+0.25,-0.4);
  tree1.castShadow=true;
  group.add(tree1);
  const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.2,8), flatMat(0x6b4423));
  trunk2.position.set(0.5,0.6+cliff2H+0.1,-0.55);
  group.add(trunk2);
  const tree2 = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.42,8), flatMat(0x3f7d3a));
  tree2.position.set(0.5,0.6+cliff2H+0.2+0.21,-0.55);
  tree2.castShadow=true;
  group.add(tree2);
  addRock(group,0.6,0.6,0.15);
  addRock(group,-0.7,0.5,0.12);
  addGrassTuft(group,0.2,0.85);
}

function addCinemaProps(group){
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.9,0.7), flatMat(0x3a3450));
  wall.position.y=0.6+0.45;
  wall.castShadow=true;
  group.add(wall);
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.15,0.24,0.05), new THREE.MeshBasicMaterial({map: TEXTURES.cinemaMarquee}));
  marquee.position.set(0,0.6+0.62,0.44);
  group.add(marquee);
  for(let i=-2;i<=2;i++){
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.022,6,6), new THREE.MeshStandardMaterial({color:0xffe9a8,emissive:0xffcf6a,emissiveIntensity:0.7}));
    bulb.position.set(i*0.24,0.6+0.62+0.14,0.47);
    group.add(bulb);
  }
  const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.5,0.04), new THREE.MeshStandardMaterial({color:0xffdf8a,emissive:0xd9a84a,emissiveIntensity:0.5}));
  doorGlow.position.set(0,0.6+0.25,0.36);
  group.add(doorGlow);
  const reel = new THREE.Mesh(new THREE.TorusGeometry(0.14,0.03,8,16), flatMat(0x8a8f9e));
  reel.position.set(0,0.6+0.9+0.2,0);
  reel.rotation.x=Math.PI/2;
  group.add(reel);
  for(let i=-1;i<=1;i++){
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.1,0.22), flatMat(0x1a1824));
    seat.position.set(i*0.28,0.6+0.05,-0.5);
    group.add(seat);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.2,8), flatMat(0x6b4423));
  trunk.position.set(0.85,0.6+0.1,-0.2);
  group.add(trunk);
  const tree = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2,0), flatMat(0x4a8a45));
  tree.position.set(0.85,0.6+0.2+0.18,-0.2);
  group.add(tree);
  addRock(group,-0.9,0.5,0.12);
}

function addCastleProps(group){
  const stoneMat = new THREE.MeshLambertMaterial({ map: TEXTURES.stone });
  const keep = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.75,0.6), stoneMat);
  keep.position.y=0.6+0.375;
  keep.castShadow=true;
  group.add(keep);
  [[-0.35,-0.3,0.9],[0.35,-0.3,0.9],[0,0.3,1.15]].forEach(t=>{
    const [tx,tz,th]=t;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.16,th,8), stoneMat);
    tower.position.set(tx,0.6+th/2,tz);
    tower.castShadow=true;
    group.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.19,0.3,8), flatMat(0x3f7ea8));
    roof.position.set(tx,0.6+th+0.15,tz);
    roof.castShadow=true;
    group.add(roof);
    const flagpole = new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.18,4), flatMat(0x8c7748));
    flagpole.position.set(tx,0.6+th+0.3+0.09,tz);
    group.add(flagpole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.06,0.005), flatMat(0x3f7ea8));
    flag.position.set(tx+0.05,0.6+th+0.36,tz);
    group.add(flag);
  });
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.35,0.05), flatMat(0x4a3320));
  gate.position.set(0,0.6+0.175,0.31);
  group.add(gate);
  [[0,-0.5],[0,-0.7]].forEach(p=>{
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.03,6), flatMat(0xc9c3b0));
    stone.position.set(p[0],0.6+0.016,p[1]);
    group.add(stone);
  });
  addRock(group,-0.85,-0.6,0.13);
  addGrassTuft(group,0.8,-0.7);
}

function addViewpointProps(group){
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.12,0.7), flatMat(0x8c6b42));
  deck.position.y=0.6+0.06;
  deck.castShadow=true;
  deck.receiveShadow=true;
  group.add(deck);
  [[-0.4,-0.3],[0.4,-0.3],[-0.4,0.3],[0.4,0.3]].forEach(p=>{
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.14,0.06), flatMat(0x6b4a2f));
    leg.position.set(p[0],0.6-0.07,p[1]);
    group.add(leg);
  });
  [-1,1].forEach(i=>{
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.03,0.03), flatMat(0x6b4a2f));
    rail.position.set(0,0.6+0.32,i*0.35);
    group.add(rail);
    [-0.4,0,0.4].forEach(px=>{
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.28,0.03), flatMat(0x6b4a2f));
      post.position.set(px,0.6+0.18,i*0.35);
      group.add(post);
    });
  });
  const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.35,8), flatMat(0x4a4e58));
  standPole.position.set(-0.1,0.6+0.12+0.175,0);
  group.add(standPole);
  const bino = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.22,8), flatMat(0x3a3e48));
  bino.rotation.z=Math.PI/2;
  bino.position.set(-0.1,0.6+0.12+0.35+0.05,0.05);
  group.add(bino);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.3,8), flatMat(0x6b4423));
  trunk.position.set(0.65,0.6+0.15,0.1);
  group.add(trunk);
  const tree = new THREE.Mesh(new THREE.ConeGeometry(0.26,0.55,8), flatMat(0x4a8a45));
  tree.position.set(0.65,0.6+0.3+0.28,0.1);
  tree.castShadow=true;
  group.add(tree);
  addGrassTuft(group,-0.8,0.6);
  addRock(group,0.8,-0.7,0.13);
}

function addSakuraProps(group){
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.13,0.55,8), flatMat(0x5a4030));
  trunk.position.y=0.6+0.275;
  trunk.castShadow=true;
  group.add(trunk);
  const blossomColors=[0xf6b8ce,0xf3a3c0,0xf8cbdc];
  [[0,0.75,0,0.4],[0.25,0.65,0.15,0.28],[-0.25,0.68,-0.1,0.28],[0,0.95,0,0.28]].forEach((s,i)=>{
    const blossom = new THREE.Mesh(new THREE.IcosahedronGeometry(s[3],0), flatMat(blossomColors[i%blossomColors.length]));
    blossom.position.set(s[0],0.6+s[1],s[2]);
    blossom.castShadow=true;
    group.add(blossom);
  });
  const lanternBase = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.14,0.16), flatMat(0x8f8f8f));
  lanternBase.position.set(-0.7,0.6+0.07,0.5);
  group.add(lanternBase);
  const lanternTop = new THREE.Mesh(new THREE.ConeGeometry(0.14,0.12,4), flatMat(0x8f8f8f));
  lanternTop.rotation.y=Math.PI/4;
  lanternTop.position.set(-0.7,0.6+0.14+0.06,0.5);
  group.add(lanternTop);
  const petalMat = flatMat(0xf6b8ce);
  [[0.5,0.6],[0.7,0.2],[-0.4,-0.6],[0.3,-0.7]].forEach(p=>{
    const petal = new THREE.Mesh(new THREE.CircleGeometry(0.05,6), petalMat);
    petal.rotation.x=-Math.PI/2;
    petal.position.set(p[0],0.6+0.012,p[1]);
    group.add(petal);
  });
  addRock(group,0.85,-0.4,0.12);
  addGrassTuft(group,-0.85,-0.5);
}

function addSunflowerProps(group){
  const positions=[];
  for(let x=-0.6;x<=0.7;x+=0.35){
    for(let z=-0.5;z<=0.5;z+=0.35){
      positions.push([x+(Math.random()-0.5)*0.08, z+(Math.random()-0.5)*0.08]);
    }
  }
  positions.forEach(p=>{
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.025,0.4,6), flatMat(0x5a9a4f));
    stem.position.set(p[0],0.6+0.2,p[1]);
    group.add(stem);
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.03,10), flatMat(0x6b4a2f));
    center.rotation.x=Math.PI/2;
    center.position.set(p[0],0.6+0.42,p[1]);
    group.add(center);
    const petals = new THREE.Mesh(new THREE.ConeGeometry(0.1,0.04,8), flatMat(0xf2c43a));
    petals.rotation.x=Math.PI/2;
    petals.position.set(p[0],0.6+0.41,p[1]);
    group.add(petals);
  });
  for(let i=0;i<4;i++){
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.2,0.04), flatMat(0x8c7748));
    post.position.set(-0.95, 0.6+0.1, -0.6+i*0.4);
    group.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.03,1.2), flatMat(0x8c7748));
  rail.position.set(-0.95,0.6+0.15,-0.05);
  group.add(rail);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.3,8), flatMat(0x6b4423));
  trunk.position.set(-0.85,0.6+0.15,0.85);
  group.add(trunk);
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22,0), flatMat(0x5a9a4f));
  bush.position.set(-0.85,0.6+0.3+0.2,0.85);
  group.add(bush);
}

function addSnowmanProps(group){
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.26,10,10), flatMat(0xffffff));
  bottom.position.y=0.6+0.26;
  bottom.castShadow=true;
  group.add(bottom);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.19,10,10), flatMat(0xffffff));
  mid.position.y=0.6+0.26*2+0.13;
  mid.castShadow=true;
  group.add(mid);
  const headY = 0.6+0.26*2+0.19*2+0.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13,10,10), flatMat(0xffffff));
  head.position.y=headY;
  head.castShadow=true;
  group.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03,0.14,6), flatMat(0xe8862a));
  nose.rotation.x=Math.PI/2;
  nose.position.set(0,headY,0.18);
  group.add(nose);
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.02,10), flatMat(0xc9403a));
  hatBrim.position.set(0,headY+0.13,0);
  group.add(hatBrim);
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,0.16,10), flatMat(0xc9403a));
  hatTop.position.set(0,headY+0.13+0.09,0);
  group.add(hatTop);
  const hatBall = new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8), flatMat(0xffffff));
  hatBall.position.set(0,headY+0.13+0.17,0);
  group.add(hatBall);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.14,0.035,8,12), flatMat(0xc9403a));
  scarf.rotation.x=Math.PI/2;
  scarf.position.set(0,0.6+0.26*2+0.1,0);
  group.add(scarf);
  [0.05,-0.02,-0.09].forEach(dy=>{
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.025,6,6), flatMat(0x2a2a2a));
    btn.position.set(0, 0.6+0.26*2+0.13+dy, 0.175);
    group.add(btn);
  });
  [[-1,-0.15],[1,-0.05]].forEach(a=>{
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.025,0.32,6), flatMat(0x6b4a2f));
    arm.rotation.z = a[0]*0.9;
    arm.position.set(a[0]*0.22, 0.6+0.26*2+0.13+a[1], 0);
    group.add(arm);
  });
  [[-0.85,0.5],[0.85,-0.5]].forEach(p=>{
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.25,8), flatMat(0x6b4423));
    trunk.position.set(p[0],0.6+0.125,p[1]);
    group.add(trunk);
    const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.2,0.45,8), flatMat(0x3f7d5a));
    foliage.position.set(p[0],0.6+0.25+0.22,p[1]);
    foliage.castShadow=true;
    group.add(foliage);
    const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.12,8), flatMat(0xffffff));
    snowCap.position.set(p[0],0.6+0.25+0.4,p[1]);
    group.add(snowCap);
  });
  [[0.5,0.6],[-0.5,-0.6],[0.6,-0.4]].forEach(p=>{
    const pile = new THREE.Mesh(new THREE.SphereGeometry(0.08,8,8), flatMat(0xffffff));
    pile.scale.y=0.5;
    pile.position.set(p[0],0.6+0.03,p[1]);
    group.add(pile);
  });
}

