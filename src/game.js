import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RULES, restoreSave, writeSave, freshSave, interact, buyUpgrade, buyShopItem, equipShopItem, exportSave, parseSaveFile, replaceSave } from './state.js';
import { icon, decorateIcons } from './icons.js';
import { bindGameControls } from './controls.js';
import { ACTIVITIES } from './catalog.js';
import { renderJournal } from './journal.js';
import { SHOP_ITEMS } from './shop.js';

const $ = id => document.getElementById(id);
decorateIcons();
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const restored = restoreSave(storage);
let save = restored.state, pendingImport = null;
let screen = 'home', world = 'land', paused = false, modelPromise = null;
let renderer, scene, camera, root, groups, heroes, weapon, swordRest, targetRing;
let shopRings;
let nearest = null, actionUntil = 0, nextAction = 0, requestId = 0, walkTime = 0;
let needsCameraSnap = true, toastTimer, tipTimer, gameTime = 0, lastTime = performance.now();
const targets = { land: [], sea: [] }, particles = [], actors = new Map();
const analog = { x: 0, y: 0 }, keys = new Set();
let touchControls;
const cameraGoal = new THREE.Vector3(), cameraLook = new THREE.Vector3();
const particleGeometry = new THREE.IcosahedronGeometry(.075, 0);
const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffca44 });
const rayPoint = new THREE.Vector3();
let audioContext;

function persist() {
  const ok = restored.writable && writeSave(storage, save);
  $('saveNotice').hidden = ok;
  updateSaveDetails();
  return ok;
}
function updateSaveDetails() {
  $('saveDetails').textContent = save.savedAt ? '最近存檔：' + new Date(save.savedAt).toLocaleString('zh-TW') : '尚未建立本機存檔。';
  $('storageWarning').textContent = restored.warning;
}
function showJournal() {
  renderJournal($('journalRecords'), save);
  $('journalNotice').textContent = !restored.writable ? restored.warning : save.legacyHistory
    ? '舊成績保留，種類紀錄從新版開始。' : '每次冒險都會自動存檔。';
  openDialog('journalDialog');
}
function renderShop() {
  $('shopCoins').textContent = save.coins;
  $('shopItems').innerHTML = SHOP_ITEMS.map(item => {
    const owned = save.shop.owned[item.id] === true;
    const equipped = save.shop.equipped === item.id;
    const status = equipped ? icon('check') + '使用中' : owned ? '換上' : icon('coin') + item.cost;
    const classes = ['shop-item', equipped ? 'equipped' : owned ? 'owned' : save.coins < item.cost ? 'unavailable' : ''].join(' ');
    return `<button class="${classes}" data-shop-item="${item.id}" aria-label="${item.name}，${equipped ? '使用中，點擊收起' : owned ? '換上' : item.cost + '枚金幣購買'}"><span class="shop-picture">${icon(item.icon)}</span><strong>${item.name}</strong><span class="shop-price">${status}</span></button>`;
  }).join('');
}
function updateShopVisual() {
  if (!shopRings) return;
  const item = SHOP_ITEMS.find(entry => entry.id === save.shop.equipped);
  for (const ring of Object.values(shopRings)) {
    ring.visible = Boolean(item);
    if (item) ring.material.color.setHex(item.color);
  }
}
function showShop() {
  renderShop(); $('shopNotice').textContent = '試玩商品，之後一起決定。';
  openDialog('shopDialog');
}
function renderUI() {
  $('coins').textContent = save.coins;
  $('homeCoins').textContent = save.coins;
  $('weaponStars').innerHTML = icon('star').repeat(save.level);
  $('upgradeBtn').classList.toggle('available', save.coins >= RULES.upgradeCost && save.level < RULES.maxLevel);
  $('upgradeBtn').classList.toggle('max', save.level >= RULES.maxLevel);
  $('upgradeBtn').setAttribute('aria-label', save.level >= RULES.maxLevel ? '武器已達試玩最高等級' : '花十枚金幣升級武器');
  $('soundIcon').innerHTML = icon(save.sound ? 'speaker' : 'mute');
  $('soundLabel').textContent = save.sound ? '聲音開' : '聲音關';
  $('soundBtn').setAttribute('aria-pressed', String(save.sound));
  if ($('shopDialog').open) renderShop();
}
function wakeAudio() {
  if (!save.sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch { /* Audio is optional. */ }
}
function chime(kind = 'reward') {
  if (!save.sound || !audioContext || audioContext.state !== 'running') return;
  const notes = kind === 'upgrade' ? [523, 659, 784, 1047] : kind === 'reward' ? [659, 880] : [392, 523];
  for (let i = 0; i < notes.length; i++) {
    const start = audioContext.currentTime + i * .10;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = notes[i];
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.075, start + .014);
    gain.gain.exponentialRampToValueAtTime(.001, start + .2);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(start); oscillator.stop(start + .23);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
function toast(markup) {
  clearTimeout(toastTimer);
  $('rewardToast').innerHTML = markup;
  $('rewardToast').classList.remove('show');
  void $('rewardToast').offsetWidth;
  $('rewardToast').classList.add('show');
  toastTimer = setTimeout(() => $('rewardToast').classList.remove('show'), 1300);
}
function tip(text, duration = 4200) {
  clearTimeout(tipTimer); $('tipText').textContent = text; $('tip').hidden = false;
  tipTimer = setTimeout(() => { $('tip').hidden = true; }, duration);
}
function clearControls() {
  keys.clear();
  touchControls?.reset();
}
function showHome() {
  requestId++; clearControls();
  screen = 'home'; nearest = null;
  $('homeScreen').hidden = false; $('gameScreen').hidden = true; $('loadingScreen').hidden = true;
  $('app').dataset.screen = 'home';
  if (root) root.visible = false;
  renderUI();
}
function openDialog(id) {
  clearControls(); paused = true;
  $(id).showModal();
}
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => { paused = Boolean(document.querySelector('dialog[open]')); clearControls(); nextAction = gameTime + .2; });
});
$('homeSettings').addEventListener('click', () => openDialog('settingsDialog'));
$('settingsBtn').addEventListener('click', () => openDialog('settingsDialog'));
$('homeJournal').addEventListener('click', showJournal);
$('journalBtn').addEventListener('click', showJournal);
$('homeShop').addEventListener('click', showShop);
$('shopBtn').addEventListener('click', showShop);
$('shopItems').addEventListener('click', event => {
  const button = event.target.closest('[data-shop-item]');
  if (!button) return;
  const item = SHOP_ITEMS.find(entry => entry.id === button.dataset.shopItem);
  if (!item) return;
  wakeAudio();
  if (save.shop.owned[item.id]) {
    equipShopItem(save, save.shop.equipped === item.id ? null : item.id);
    $('shopNotice').textContent = save.shop.equipped ? '換好了！' : '收起來了。';
  } else {
    const result = buyShopItem(save, item);
    if (result === 'insufficient') { $('shopNotice').textContent = '金幣還不夠，先去冒險！'; chime('tap'); return; }
    if (result !== 'bought') return;
    $('shopNotice').textContent = '買好了！已經換上。';
  }
  updateShopVisual(); renderUI();
  if (!persist()) $('shopNotice').textContent = '這次無法存檔，請找家長備份。';
  chime('upgrade');
});
$('saveBtn').addEventListener('click', () => {
  wakeAudio();
  const ok = persist();
  $('journalNotice').textContent = ok ? '存好了！' : '這次沒存好，請找家長備份。';
  if (ok) chime('tap');
});
$('parentBtn').addEventListener('click', () => {
  $('resetConfirm').hidden = true; $('importConfirm').hidden = true; pendingImport = null;
  $('backupNotice').textContent = ''; updateSaveDetails(); openDialog('parentDialog');
});
$('exportBtn').addEventListener('click', () => {
  persist();
  const contents = exportSave(save);
  $('backupText').value = contents; $('manualBackup').hidden = false;
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'little-adventure-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  link.hidden = true; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('backupNotice').textContent = '已交給瀏覽器下載。請把備份放進 NAS 資料夾；另一台裝置用「讀取備份」。';
});
$('importBtn').addEventListener('click', () => { $('importFile').value = ''; $('importFile').click(); });
$('importFile').addEventListener('change', async event => {
  pendingImport = null; $('importConfirm').hidden = true;
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1000000) throw new Error('存檔太大，請選擇本遊戲的備份檔。');
    pendingImport = parseSaveFile(await file.text());
    $('importSummary').textContent = '這份備份：' + pendingImport.coins + ' 金幣，武器 ' + pendingImport.level + ' 級。';
    $('backupNotice').textContent = ''; $('importConfirm').hidden = false;
  } catch (error) { $('backupNotice').textContent = error.message; }
});
$('cancelImport').addEventListener('click', () => { pendingImport = null; $('importConfirm').hidden = true; });
$('confirmImport').addEventListener('click', () => {
  if (!pendingImport) return;
  if (!restored.writable || !replaceSave(storage, save, pendingImport)) {
    $('backupNotice').textContent = '無法安全寫入，沒有替換目前進度。請先下載備份。'; return;
  }
  save = pendingImport; pendingImport = null; restored.warning = '';
  renderUI(); setFarmVisual(); recolorWeapon(); updateShopVisual(); updateSaveDetails();
  $('importConfirm').hidden = true; $('backupNotice').textContent = '已讀取並存好。';
  showHome();
});
$('homeBtn').addEventListener('click', showHome);
$('loadBackBtn').addEventListener('click', showHome);
$('retryBtn').addEventListener('click', () => location.reload());
$('soundBtn').addEventListener('click', () => { save.sound = !save.sound; wakeAudio(); renderUI(); persist(); chime('tap'); });
$('fullscreenBtn').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else $('fullscreenBtn').querySelector('span:last-child').textContent = '用主畫面開啟';
  } catch { $('fullscreenBtn').querySelector('span:last-child').textContent = '用主畫面開啟'; }
});
$('resetBtn').addEventListener('click', () => { $('resetConfirm').hidden = false; });
$('cancelReset').addEventListener('click', () => { $('resetConfirm').hidden = true; });
$('confirmReset').addEventListener('click', () => {
  const next = freshSave(); next.sound = save.sound;
  if (!restored.writable || !replaceSave(storage, save, next, 'reset')) {
    $('backupNotice').textContent = '無法安全保留舊進度，沒有清除。請先下載備份。'; return;
  }
  save = next; restored.warning = '';
  renderUI(); setFarmVisual(); recolorWeapon(); updateShopVisual();
  if (heroes) Object.values(heroes).forEach(hero => hero.position.set(0, .1, .2));
  $('parentDialog').close(); showHome();
});

function createRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  $('stage').appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); clearControls(); paused = true;
    $('loadMessage').textContent = '畫面休息了，點一下重開';
    $('retryBtn').hidden = false; $('loadingScreen').hidden = false;
  });
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb4e9ed, 25, 65);
  camera = new THREE.PerspectiveCamera(49, 1, .1, 90);
  scene.add(new THREE.HemisphereLight(0xfff5dc, 0x75987e, 1.9));
  const sun = new THREE.DirectionalLight(0xffefce, 2.2);
  sun.position.set(-7, 13, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 35 });
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .035;
  scene.add(sun);
  // A transparent shadow catcher anchors the Blender characters over the painted background.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6.6, 64), new THREE.ShadowMaterial({ opacity: .16 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = .084; ground.receiveShadow = true; scene.add(ground);
  targetRing = new THREE.Mesh(new THREE.RingGeometry(.69, .78, 40), new THREE.MeshBasicMaterial({ color: 0xffe48a, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
  targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false; scene.add(targetRing);
  resize();
}
function setFarmVisual() {
  if (!root) return;
  root.getObjectByName('SEED').visible = save.farmStage === 0;
  root.getObjectByName('SPROUT').visible = save.farmStage === 1 || save.farmStage === 2;
  root.getObjectByName('SPROUT').scale.setScalar(save.farmStage === 2 ? 1.4 : 1);
  root.getObjectByName('HARVEST').visible = save.farmStage === 3;
}
function recolorWeapon() {
  if (!weapon) return;
  const colors = [0xab733e, 0xcc8945, 0xcadbe3, 0xffce43];
  weapon.traverse(object => { if (object.isMesh) object.material.color.setHex(colors[save.level - 1]); });
  weapon.scale.setScalar(1 + (save.level - 1) * .07);
}
function prepareModel(gltf) {
  root = gltf.scene;
  const required = ['LAND_WORLD', 'SEA_WORLD', 'HERO_LAND', 'HERO_SEA', 'WEAPON', 'SEED', 'SPROUT', 'HARVEST', ...ACTIVITIES.map(activity => activity.node)];
  const missing = required.filter(name => !root.getObjectByName(name));
  if (missing.length) throw new Error('模型缺少：' + missing.join(', '));
  groups = { land: root.getObjectByName('LAND_WORLD'), sea: root.getObjectByName('SEA_WORLD') };
  heroes = { land: root.getObjectByName('HERO_LAND'), sea: root.getObjectByName('HERO_SEA') };
  shopRings = {};
  for (const region of ['land', 'sea']) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.48, .065, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffcc49 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 2.36; ring.visible = false;
    heroes[region].add(ring); shopRings[region] = ring;
  }
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    if (object.material?.name === 'MAT_grass2') object.material.color.setHex(0xa6d96e);
    if (object.material?.name === 'MAT_water2') object.material.color.setHex(0x77d5dc);
  });
  for (const name of ['LAND_BASE', 'LAND_TOP', 'SEA_BASE', 'SEA_TOP', 'RAINBOW', 'SKY_DECOR']) {
    const backdrop = root.getObjectByName(name);
    if (backdrop) backdrop.visible = false;
  }
  // Characters are from the Blender model; floor rings and particles are runtime effects.
  weapon = root.getObjectByName('WEAPON'); swordRest = weapon.rotation.clone();
  weapon.traverse(object => { if (object.isMesh) object.material = object.material.clone(); });
  for (const region of ['land', 'sea']) {
    targets[region] = ACTIVITIES.filter(activity => activity.world === region).map(activity => {
      const object = root.getObjectByName(activity.node);
      return { object, activity, kind: activity.kind, origin: object.position.clone(), baseY: object.position.y, restingY: object.rotation.y, availableAt: 0, hop: null };
    });
    const hero = heroes[region];
    const legs = hero.children.filter(child => /^leg[LR]/.test(child.name)).map(child => ({ object: child, start: child.rotation.clone() }));
    actors.set(hero, legs);
  }
  // Bring the farm into sight on a small phone; no game rule changes.
  root.getObjectByName('TARGET_FARM').position.set(-1.6, 0, 3.1);
  targets.land.find(target => target.kind === 'farm').origin.set(-1.6, 0, 3.1);
  root.visible = false; scene.add(root);
  setFarmVisual(); recolorWeapon(); updateShopVisual();
}
async function ensureModel() {
  if (root && groups) return;
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    if (!renderer) createRenderer();
    let timer;
    try {
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('載入超時')), 25000); });
      const gltf = await Promise.race([new GLTFLoader().loadAsync('../assets/models/cute_adventure.glb'), timeout]);
      prepareModel(gltf);
    } finally { clearTimeout(timer); }
  })();
  return modelPromise;
}
async function startWorld(next) {
  const id = ++requestId;
  wakeAudio(); chime('tap');
  clearControls(); $('loadingScreen').hidden = false; $('retryBtn').hidden = true;
  $('loadMessage').textContent = '冒險準備中';
  try {
    await ensureModel();
    if (requestId !== id) return;
    world = next; screen = 'game'; nearest = null; nextAction = 0;
    root.visible = true;
    groups.land.visible = world === 'land'; groups.sea.visible = world === 'sea';
    $('app').dataset.world = world;
    scene.fog.color.setHex(world === 'land' ? 0xb4e9ed : 0x88d8e5);
    heroes[world].position.set(0, .1, .2); heroes[world].rotation.y = 0;
    needsCameraSnap = true;
    $('homeScreen').hidden = true; $('gameScreen').hidden = false; $('loadingScreen').hidden = true;
    $('app').dataset.screen = 'game';
    $('placeLabel').textContent = world === 'land' ? '陸地' : '海洋';
    $('placeBadge').querySelector('[data-icon]').innerHTML = icon(world === 'land' ? 'tree' : 'wave');
    $('targetBubble').hidden = true;
    tip(save.visits[world] ? '靠近朋友，按右邊' : '拖動左邊搖桿');
    save.visits[world] = true; persist(); renderUI(); resize();
  } catch (error) {
    if (requestId !== id) return;
    console.error('Game initialization failed:', error);
    $('loadMessage').textContent = '冒險還沒準備好，請再試一次';
    $('retryBtn').hidden = false;
  }
}
document.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => startWorld(button.dataset.start)));

touchControls = bindGameControls({
  joystick: $('joystick'), stick: $('stick'), action: $('actionBtn'),
  isActive: () => screen === 'game' && !paused && !document.hidden,
  onMove: move => { analog.x = move.x; analog.y = move.y; },
  onReset: () => keys.clear(), onAction: doAction, onGesture: wakeAudio
});
const moveKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'];
addEventListener('keydown', event => {
  if (screen !== 'game' || paused) return;
  if (moveKeys.includes(event.key)) { event.preventDefault(); keys.add(event.key); }
  if ((event.code === 'Space' || event.key === 'e') && !event.repeat && event.target === document.body) { event.preventDefault(); doAction(); }
});
addEventListener('keyup', event => keys.delete(event.key));
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); });
$('upgradeBtn').addEventListener('click', () => {
  if (paused || screen !== 'game') return;
  wakeAudio();
  const result = buyUpgrade(save);
  if (result === 'upgraded') {
    recolorWeapon(); renderUI(); persist(); chime('upgrade');
    toast(icon('sword') + icon('star')); emitParticles(heroes[world].position, 18);
  } else if (result === 'insufficient') toast(icon('coin') + '<span>10</span>' + icon('sword'));
  else toast(icon('star').repeat(3));
});

function nearestTarget() {
  const hero = heroes[world]; let found = null, distance = 1.8;
  for (const target of targets[world]) {
    if (target.availableAt > gameTime) continue;
    const d = Math.hypot(hero.position.x - target.object.position.x, hero.position.z - target.object.position.z);
    if (d < distance) { distance = d; found = target; }
  }
  return found;
}
function actionPresentation(target) {
  if (!target) return { icon: 'hand', label: '找朋友' };
  if (target.kind === 'farm') return [{ icon: 'seed', label: '種一種' }, { icon: 'water', label: '澆澆水' }, { icon: 'water', label: '再澆水' }, { icon: 'carrot', label: '收成囉' }][save.farmStage];
  return world === 'land' ? { icon: 'sword', label: '揮一揮' } : { icon: 'net', label: '抓一抓' };
}
let lastActionSignature = '';
function updateTarget() {
  nearest = nearestTarget();
  const choice = actionPresentation(nearest), signature = choice.icon + ':' + choice.label + ':' + Boolean(nearest);
  if (signature !== lastActionSignature) {
    $('actionIcon').innerHTML = icon(choice.icon);
    $('actionLabel').textContent = choice.label;
    $('actionBtn').classList.toggle('ready', Boolean(nearest));
    $('actionBtn').setAttribute('aria-disabled', String(!nearest));
    $('actionBtn').setAttribute('aria-label', nearest ? choice.label : '靠近後互動');
    $('targetBubble').innerHTML = icon(choice.icon);
    lastActionSignature = signature;
  }
  targetRing.visible = Boolean(nearest); $('targetBubble').hidden = !nearest;
  if (nearest) {
    const pos = nearest.object.position;
    targetRing.position.set(pos.x, .13, pos.z);
    targetRing.scale.setScalar(1 + Math.sin(gameTime * 4) * .055);
    rayPoint.set(pos.x, nearest.kind === 'farm' ? 1.45 : 1.8, pos.z).project(camera);
    const x = (rayPoint.x * .5 + .5) * $('stage').clientWidth;
    const y = (-rayPoint.y * .5 + .5) * $('stage').clientHeight;
    $('targetBubble').style.left = x + 'px'; $('targetBubble').style.top = y + 'px';
  }
}
function doAction() {
  if (screen !== 'game' || paused || !heroes || gameTime < nextAction) return;
  const target = nearestTarget();
  if (!target) { tip('再靠近一點', 1800); return; }
  wakeAudio(); nextAction = gameTime + .65; actionUntil = gameTime + .45;
  const result = interact(save, target.activity);
  const h = heroes[world], pos = target.object.position;
  h.rotation.y = Math.atan2(pos.x - h.position.x, pos.z - h.position.z);
  if (target.kind === 'farm') {
    setFarmVisual(); target.availableAt = gameTime + .7;
    if (!result.reward) toast(icon(save.farmStage === 3 ? 'carrot' : 'seed'));
  } else {
    target.availableAt = gameTime + 2.2;
    const angle = Math.atan2(pos.z, pos.x) + .8 + Math.random() * .9;
    const radius = 3.4 + Math.random() * .7;
    target.hop = { time: gameTime, from: pos.clone(), to: new THREE.Vector3(Math.cos(angle) * radius, target.baseY, Math.sin(angle) * radius) };
  }
  if (result.reward) {
    toast('<span>+' + result.reward + '</span>' + icon('coin')); chime();
    emitParticles(pos, 10);
    navigator.vibrate?.(30);
  } else chime('tap');
  renderUI(); persist();
}
function emitParticles(position, count) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(particleGeometry, particleMaterial);
    mesh.position.copy(position); mesh.position.y += 1.2;
    scene.add(mesh);
    particles.push({ mesh, age: 0, velocity: new THREE.Vector3((Math.random() - .5) * 2.2, 1.5 + Math.random(), (Math.random() - .5) * 2.2) });
  }
}
function updateSimulation(dt) {
  const hero = heroes[world];
  let dx = analog.x + (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
  let dz = analog.y + (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
  const length = Math.hypot(dx, dz);
  if (length > 1) { dx /= length; dz /= length; }
  if (length > .01) {
    let x = hero.position.x + dx * 3 * dt, z = hero.position.z + dz * 3 * dt;
    const distance = Math.hypot(x, z);
    if (distance > 5.35) { x *= 5.35 / distance; z *= 5.35 / distance; }
    hero.position.x = x; hero.position.z = z;
    const angle = Math.atan2(dx, dz), delta = Math.atan2(Math.sin(angle - hero.rotation.y), Math.cos(angle - hero.rotation.y));
    hero.rotation.y += delta * Math.min(1, dt * 14);
    walkTime += dt * 11; hero.position.y = .1 + Math.abs(Math.sin(walkTime)) * .055;
  } else hero.position.y = THREE.MathUtils.lerp(hero.position.y, .1, Math.min(1, dt * 10));
  (actors.get(hero) || []).forEach((leg, index) => { leg.object.rotation.x = leg.start.x + (length > .01 ? Math.sin(walkTime + index * Math.PI) * .3 : 0); });
  if (weapon) weapon.rotation.x = swordRest.x + (gameTime < actionUntil ? Math.sin((actionUntil - gameTime) / .45 * Math.PI) * -1.4 : 0);
  for (const target of targets[world]) {
    if (target.hop) {
      const u = Math.min((gameTime - target.hop.time) / .8, 1), smooth = u * u * (3 - 2 * u);
      target.object.position.lerpVectors(target.hop.from, target.hop.to, smooth);
      target.object.position.y = target.baseY + Math.sin(u * Math.PI) * .7;
      if (u === 1) target.hop = null;
    } else if (target.kind === 'animal') {
      target.object.rotation.y = target.restingY + Math.sin(gameTime * .75 + target.object.id) * .16;
      if (world === 'sea') target.object.position.y = target.baseY + Math.sin(gameTime * 2 + target.object.id) * .06;
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.age += dt;
    p.velocity.y -= dt * 3; p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.rotation.y += dt * 4; p.mesh.scale.setScalar(Math.max(.01, 1 - p.age / .85));
    if (p.age > .85) { scene.remove(p.mesh); particles.splice(i, 1); }
  }
}
function updateCamera(dt) {
  const hero = heroes[world], portrait = camera.aspect < .9;
  const distance = portrait ? 10.8 : 9.4;
  cameraGoal.set(hero.position.x * .62, portrait ? 9.3 : 8.1, hero.position.z * .55 + distance);
  cameraLook.set(hero.position.x * .72, .4, hero.position.z * .68 - .7);
  camera.position.lerp(cameraGoal, needsCameraSnap ? 1 : 1 - Math.exp(-5 * dt));
  camera.lookAt(cameraLook); needsCameraSnap = false;
}
function resize() {
  clearControls();
  if (!renderer) return;
  const width = $('stage').clientWidth, height = $('stage').clientHeight;
  renderer.setSize(width, height, false); camera.aspect = width / height;
  camera.fov = width > height ? 44 : 49; camera.updateProjectionMatrix(); needsCameraSnap = true;
}
addEventListener('resize', resize);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, .05); lastTime = now;
  if (screen !== 'game' || !root || document.hidden || paused) return;
  gameTime += dt; updateSimulation(dt); updateCamera(dt); updateTarget(); renderer.render(scene, camera);
}
requestAnimationFrame(frame);
renderUI();
updateSaveDetails();
if (!restored.writable) $('saveNotice').hidden = false;

// Cached assets stay within this game's scope; no private project files are cached.
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('../sw.js').then(registration => {
    const worker = registration.installing;
    const showCacheState = () => { $('cacheStatus').textContent = navigator.serviceWorker.controller ? '遊戲已可離線開啟。' : '第一次載入中，完成後會準備離線遊玩。'; };
    showCacheState();
    navigator.serviceWorker.addEventListener('controllerchange', showCacheState);
    worker?.addEventListener('statechange', showCacheState);
  }).catch(() => { $('cacheStatus').textContent = '這個瀏覽器目前未啟用離線遊玩。'; });
}
