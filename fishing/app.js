import { FISH, RODS, MIN_LENGTH, fishById, rodById, totalCaught } from './catalog.js';
import { loadGame, saveGame, catchFish, chooseRod, changeLength, parseSave } from './state.js';
import { FishingTrip } from './fishing.js';
import { icon, rodArt, fishArt, LakeScene } from './art.js';

const $ = id => document.getElementById(id);
document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
let storage;
try { storage = window.localStorage; } catch {}
const loaded = loadGame(storage);
let state = loaded.state, pendingImport = null, lastPhase = '', lastSaveOK = !loaded.readOnly;
const trip = new FishingTrip(), scene = new LakeScene($('lake'));
let audio, noticeTimer, lastFrame = performance.now(), time = 0;
$('storage-message').textContent = loaded.message;

function notice(text) {
  clearTimeout(noticeTimer); $('notice').textContent = text; $('notice').hidden = false;
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 2800);
}
function persist() {
  lastSaveOK = saveGame(storage, state, loaded.readOnly);
  $('save-status').textContent = lastSaveOK ? '已自動存檔' : '未能存檔 · 請備份';
  document.querySelector('.save-line').classList.toggle('error', !lastSaveOK);
  if (!lastSaveOK) $('storage-message').textContent = loaded.message || '本機保存沒有成功。請用備份存檔保存目前成績。';
  return lastSaveOK;
}
function tone(kind) {
  if (!state.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    void audio.resume().catch(() => {});
    const now = audio.currentTime;
    const notes = kind === 'catch' ? [523.25, 659.25, 783.99] : kind === 'bite' ? [523.25, 659.25] : [294];
    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator(), volume = audio.createGain(), start = now + index * .09;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start); volume.gain.linearRampToValueAtTime(.055, start + .025); volume.gain.exponentialRampToValueAtTime(.001, start + .32);
      oscillator.connect(volume); volume.connect(audio.destination); oscillator.start(start); oscillator.stop(start + .34);
    });
  } catch {}
}
function updateScore() {
  $('coins').textContent = state.coins;
  $('fish-count').textContent = totalCaught(state);
  $('rod-name').textContent = rodById(state.equipped).name;
  $('rod-length').max = rodById(state.equipped).maxLength;
  $('rod-length').value = state.length;
  $('length-value').value = state.length.toFixed(1);
  $('rod-length').setAttribute('aria-valuetext', state.length.toFixed(1));
  $('sound-button').innerHTML = icon(state.sound ? 'sound' : 'mute') + (state.sound ? '聲音開' : '聲音關');
  renderControls();
}
function renderControls() {
  const ready = trip.phase === 'ready', biting = trip.phase === 'bite';
  $('extend').disabled = !ready || state.length >= rodById(state.equipped).maxLength;
  $('shorten').disabled = !ready || state.length <= MIN_LENGTH;
  $('rod-length').disabled = !ready;
  $('shop-button').disabled = !ready;
  $('action').disabled = !ready && !biting;
  $('action').className = 'action-button' + (biting ? ' bite' : !ready ? ' waiting' : '');
  $('action').setAttribute('aria-label', biting ? '收竿釣起魚' : ready ? '拋竿釣魚' : '等待魚兒咬鉤');
  $('action-icon').innerHTML = icon(biting ? 'reel' : trip.phase === 'caught' ? 'check' : 'hook');
  $('action-label').textContent = biting ? '收竿' : ready ? '釣魚' : trip.phase === 'caught' ? '釣到了' : '等魚兒';
  $('status').className = 'status' + (biting ? ' bite' : '');
  $('status').textContent = biting ? '魚來了！收竿！' : trip.phase === 'waiting' ? '看看浮標，等魚兒靠近' : trip.phase === 'caught' ? '釣到了！' : totalCaught(state) ? '再來釣一條' : '伸長釣竿，試著釣一條魚';
}
function length(value) {
  if (trip.phase !== 'ready') return;
  state = changeLength(state, value); updateScore();
}
$('shorten').addEventListener('click', () => { length(state.length - .4); persist(); });
$('extend').addEventListener('click', () => { length(state.length + .4); persist(); });
$('rod-length').addEventListener('input', event => length(Number(event.target.value)));
$('rod-length').addEventListener('change', persist);
$('action').addEventListener('click', () => {
  if (trip.phase === 'ready') {
    $('catch-result').hidden = true;
    if (trip.cast(state.length)) tone('cast');
  } else if (trip.phase === 'bite') {
    const id = trip.reel();
    if (id) {
      const fish = fishById(id); state = catchFish(state, id); persist(); updateScore(); tone('catch');
      $('catch-result').innerHTML = fishArt(id) + `<strong>${fish.name}</strong><p>${icon('coin')} +${fish.coins}</p>`;
      $('catch-result').hidden = false;
    }
  }
  renderControls();
});

function openDialog(id) { $(id).showModal(); }
document.querySelectorAll('.close-button').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
});
function renderShop() {
  $('shop-coins').textContent = state.coins;
  $('rod-cards').replaceChildren();
  for (const rod of RODS) {
    const owned = state.rods.includes(rod.id), equipped = state.equipped === rod.id;
    const card = document.createElement('article'); card.className = 'rod-card' + (equipped ? ' equipped' : '');
    card.innerHTML = rodArt(rod) + `<div class="rod-meta"><div><h2>${rod.name}</h2><small>最長 ${rod.maxLength.toFixed(1)}</small></div><button class="rod-buy" type="button" aria-label="${equipped ? '使用中' : owned ? '換上' : '購買'}${rod.name}">${equipped ? icon('check') + '使用中' : owned ? '換上' : icon('coin') + rod.price}</button></div>`;
    const button = card.querySelector('button'); button.disabled = equipped;
    button.addEventListener('click', () => {
      const result = chooseRod(state, rod.id);
      if (!result.ok) { $('shop-message').textContent = result.reason; return; }
      state = result.state; const saved = persist(); updateScore(); renderShop(); tone('catch');
      $('shop-message').textContent = (owned ? '已換上' : '買到了') + rod.name + (saved ? '！' : '。請備份目前成績。');
    });
    $('rod-cards').append(card);
  }
}
$('shop-button').addEventListener('click', () => { if (trip.phase !== 'ready') return; $('shop-message').textContent = ''; renderShop(); openDialog('shop-dialog'); });
$('journal-button').addEventListener('click', () => {
  $('fish-records').replaceChildren();
  const ids = [...new Set([...FISH.map(fish => fish.id), ...Object.keys(state.records)])];
  for (const id of ids) {
    const row = document.createElement('div'); row.className = 'fish-record';
    row.innerHTML = fishArt(id);
    const name = document.createElement('span'), count = document.createElement('b');
    name.textContent = fishById(id)?.name || id; count.textContent = state.records[id] || 0;
    row.append(name, count); $('fish-records').append(row);
  }
  $('earned').textContent = state.earned; openDialog('journal-dialog');
});
$('manual-save').addEventListener('click', () => {
  const success = persist(); $('manual-save').innerHTML = icon(success ? 'check' : 'save') + (success ? '已存檔' : '請到設定備份');
});
$('settings-button').addEventListener('click', () => { $('settings-message').textContent = ''; openDialog('settings-dialog'); });
$('sound-button').addEventListener('click', () => { state = { ...state, sound: !state.sound }; updateScore(); persist(); if (state.sound) tone('cast'); });
$('fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else $('settings-message').textContent = '這個瀏覽器請使用「加入主畫面」，開啟後畫面會更完整。';
  } catch { $('settings-message').textContent = '目前無法切換全螢幕，可以直接繼續玩。'; }
});
$('export-button').addEventListener('click', () => {
  const text = JSON.stringify(state, null, 2); $('backup-text').value = text; $('backup-details').open = true;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'buck-fishing-save.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('settings-message').textContent = '已準備備份。請確認下載的檔案，或複製下方備份文字。';
});
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; pendingImport = null; $('import-preview').hidden = true;
  try {
    if (!file) return;
    if (file.size > 262144) throw new Error('存檔太大');
    pendingImport = parseSave(await file.text());
    $('import-description').textContent = `讀入 ${pendingImport.coins} 金幣、${totalCaught(pendingImport)} 條魚？確認後會取代目前成績，原成績會先保留一份備份。`;
    $('import-preview').hidden = false; $('settings-message').textContent = '';
  } catch (error) { $('settings-message').textContent = error.message; }
  finally { event.target.value = ''; }
});
$('import-cancel').addEventListener('click', () => { pendingImport = null; $('import-preview').hidden = true; });
$('import-confirm').addEventListener('click', () => {
  if (!pendingImport) return;
  if (loaded.readOnly || !saveGame(storage, state) || !saveGame(storage, pendingImport)) {
    $('settings-message').textContent = '目前無法安全保存，沒有取代成績。請先備份。'; return;
  }
  state = pendingImport; pendingImport = null; trip.phase = 'ready'; trip.fish = null; trip.elapsed = 0;
  $('import-preview').hidden = true; $('catch-result').hidden = true; updateScore();
  $('settings-message').textContent = '已讀取釣魚存檔，原成績已保留為上一份備份。';
});
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); lastFrame = performance.now(); });
updateScore();
if (loaded.readOnly) { $('save-status').textContent = '未能存檔 · 請備份'; document.querySelector('.save-line').classList.add('error'); }
if (loaded.message) notice(loaded.message);
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, .1); lastFrame = now;
  if (!document.hidden && !document.querySelector('dialog[open]')) {
    time += dt; trip.tick(dt);
    if (trip.phase !== lastPhase) {
      if (trip.phase === 'bite') tone('bite');
      if (trip.phase === 'ready') $('catch-result').hidden = true;
      renderControls(); lastPhase = trip.phase;
    }
  }
  scene.draw(time, state, trip); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(registration => {
    const ready = () => { $('offline-status').textContent = '離線檔案已準備，可再次開啟這個網址遊玩。'; };
    if (registration.active) ready();
    const worker = registration.installing || registration.waiting;
    if (worker) worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') ready();
      if (worker.state === 'redundant' && !registration.active) $('offline-status').textContent = '離線檔案尚未準備好，請連線時重新開啟。';
    });
  }).catch(() => { $('offline-status').textContent = '離線檔案尚未準備好，目前請保持連線。'; });
} else $('offline-status').textContent = '這個開啟方式不支援離線快取。';
