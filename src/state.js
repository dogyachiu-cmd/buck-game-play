// Values below are prototype tuning, not new decisions made by the child.
export const SAVE_KEY = 'little-adventure-v3';
export const LEGACY_SAVE_KEY = 'little-adventure-v2';
export const BACKUP_KEY = SAVE_KEY + '-backup';
export const RULES = Object.freeze({ upgradeCost: 10, maxLevel: 4, landReward: 3, seaReward: 2, harvestReward: 1 });
export function freshSave() {
  return { version: 3, coins: 0, level: 1, farmStage: 0, visits: { land: false, sea: false }, sound: true,
    records: {}, shop: { owned: {}, equipped: null }, savedAt: null, recordsSince: null, legacyHistory: false };
}
const validId = value => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
function normalizeRecords(raw) {
  const records = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return records;
  for (const [metric, entries] of Object.entries(raw)) {
    if (!validId(metric) || !entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
    const clean = {};
    for (const [id, count] of Object.entries(entries)) {
      if (validId(id) && Number.isSafeInteger(count) && count >= 0) clean[id] = Math.min(count, 999999);
    }
    records[metric] = clean;
  }
  return records;
}
export function normalizeSave(raw) {
  const state = freshSave();
  if (!raw || ![2, 3].includes(raw.version)) return state;
  const clampInt = (v, min, max, fallback) => Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
  state.coins = clampInt(raw.coins, 0, 999999, 0);
  state.level = clampInt(raw.level, 1, RULES.maxLevel, 1);
  state.farmStage = clampInt(raw.farmStage, 0, 3, 0);
  state.visits = { land: raw.visits?.land === true, sea: raw.visits?.sea === true };
  state.sound = raw.sound !== false;
  state.records = normalizeRecords(raw.records);
  if (raw.shop?.owned && typeof raw.shop.owned === 'object' && !Array.isArray(raw.shop.owned)) {
    for (const [id, owned] of Object.entries(raw.shop.owned)) if (validId(id) && owned === true) state.shop.owned[id] = true;
  }
  if (validId(raw.shop?.equipped) && state.shop.owned[raw.shop.equipped]) state.shop.equipped = raw.shop.equipped;
  state.savedAt = timestamp(raw.savedAt);
  state.recordsSince = timestamp(raw.recordsSince);
  state.legacyHistory = raw.version === 2 || raw.legacyHistory === true;
  return state;
}
export function restoreSave(storage) {
  let damaged = false;
  for (const key of [SAVE_KEY, BACKUP_KEY, LEGACY_SAVE_KEY]) {
    try {
      const text = storage.getItem(key);
      if (!text) continue;
      const raw = JSON.parse(text);
      if (key === SAVE_KEY && raw?.version > 3) return { state: freshSave(), writable: false, warning: '這份存檔版本較新，請使用新版遊戲；本次不覆寫它。' };
      if (![2, 3].includes(raw?.version)) { damaged = true; continue; }
      return { state: normalizeSave(raw), writable: true,
        warning: key === BACKUP_KEY ? '已從上一份本機備份恢復。' : raw.version === 2 ? '舊金幣與等級已保留；種類紀錄從新版開始。' : '' };
    } catch { damaged = true; }
  }
  return { state: freshSave(), writable: true, warning: damaged ? '原存檔無法讀取，這次從新冒險開始；可由家長讀取備份。' : '' };
}
export function loadSave(storage) { return restoreSave(storage).state; }
export function writeSave(storage, state, now = new Date().toISOString()) {
  try {
    const previous = storage.getItem(SAVE_KEY);
    if (previous) {
      let raw;
      try { raw = JSON.parse(previous); } catch { /* Never overwrite the good backup with broken JSON. */ }
      if (raw?.version > 3) return false;
      if ([2, 3].includes(raw?.version)) storage.setItem(BACKUP_KEY, previous);
    }
    const next = normalizeSave(state); next.savedAt = timestamp(now);
    storage.setItem(SAVE_KEY, JSON.stringify(next)); state.savedAt = next.savedAt;
    return true;
  } catch { return false; }
}
export function recordItem(state, metric, id, count = 1) {
  if (!validId(metric) || !validId(id) || !Number.isSafeInteger(count) || count < 1) return false;
  state.records[metric] ??= {};
  state.records[metric][id] = Math.min(999999, (state.records[metric][id] || 0) + count);
  state.recordsSince ??= new Date().toISOString();
  return true;
}
export function interact(state, activity) {
  // Compatibility for old internal callers; new gameplay always passes catalog data.
  const kind = typeof activity === 'string' ? activity : activity.kind;
  let reward = 0;
  if (kind === 'farm') {
    if (state.farmStage === 0) for (const item of activity.yields || []) recordItem(state, 'planted', item.item, item.quantity);
    state.farmStage = (state.farmStage + 1) % 4;
    if (state.farmStage === 0) {
      reward = activity.reward ?? RULES.harvestReward;
      for (const item of activity.yields || []) recordItem(state, 'harvest', item.item, item.quantity);
    }
  } else if (kind === 'land') reward = RULES.landReward;
  else if (kind === 'sea') reward = RULES.seaReward;
  else if (kind === 'animal') {
    if (recordItem(state, activity.metric, activity.item)) reward = activity.reward;
  }
  reward = Number.isFinite(reward) ? Math.max(0, Math.floor(reward)) : 0;
  state.coins = Math.min(999999, state.coins + reward);
  return { reward, farmStage: state.farmStage };
}
export function exportSave(state) {
  return JSON.stringify({ format: 'little-adventure-save', exportedAt: new Date().toISOString(), data: normalizeSave(state) }, null, 2);
}
export function parseSaveFile(text) {
  if (typeof text !== 'string' || text.length > 1000000) throw new Error('存檔太大，請選擇本遊戲的備份檔。');
  let wrapper;
  try { wrapper = JSON.parse(text); } catch { throw new Error('這不是完整的 JSON 存檔。'); }
  const raw = wrapper?.data;
  if (wrapper?.format !== 'little-adventure-save' || ![2, 3].includes(raw?.version)) throw new Error('存檔格式或版本不支援，尚未替換進度。');
  for (const [key, min, max] of [['coins', 0, 999999], ['level', 1, RULES.maxLevel], ['farmStage', 0, 3]]) {
    if (!Number.isSafeInteger(raw[key]) || raw[key] < min || raw[key] > max) throw new Error('存檔數值不完整，尚未替換進度。');
  }
  if (raw.version === 3) {
    if (!raw.records || typeof raw.records !== 'object' || Array.isArray(raw.records)) throw new Error('紀錄格式不正確。');
    for (const [metric, items] of Object.entries(raw.records)) {
      if (!validId(metric) || !items || typeof items !== 'object' || Array.isArray(items)) throw new Error('紀錄格式不正確。');
      for (const [id, count] of Object.entries(items)) {
        if (!validId(id) || !Number.isSafeInteger(count) || count < 0 || count > 999999) throw new Error('紀錄數量不正確。');
      }
    }
    if (raw.shop !== undefined) {
      if (!raw.shop || typeof raw.shop !== 'object' || Array.isArray(raw.shop) || !raw.shop.owned || typeof raw.shop.owned !== 'object' || Array.isArray(raw.shop.owned)) throw new Error('商店存檔格式不正確。');
      for (const [id, owned] of Object.entries(raw.shop.owned)) if (!validId(id) || owned !== true) throw new Error('商店物品格式不正確。');
      if (raw.shop.equipped !== null && raw.shop.equipped !== undefined && (!validId(raw.shop.equipped) || raw.shop.owned[raw.shop.equipped] !== true)) throw new Error('裝備格式不正確。');
    }
  }
  return normalizeSave(raw);
}
export function replaceSave(storage, previous, next, reason = 'import') {
  try {
    // Keep the pre-import/reset progress separately from the rolling autosave backup.
    storage.setItem(SAVE_KEY + '-before-' + reason, exportSave(previous));
    return writeSave(storage, next);
  } catch { return false; }
}
export function buyUpgrade(state) {
  if (state.level >= RULES.maxLevel) return 'max';
  if (state.coins < RULES.upgradeCost) return 'insufficient';
  state.coins -= RULES.upgradeCost;
  state.level += 1;
  return 'upgraded';
}
export function buyShopItem(state, item) {
  if (!item || !validId(item.id) || !Number.isSafeInteger(item.cost) || item.cost < 0) return 'invalid';
  if (state.shop.owned[item.id]) return 'owned';
  if (state.coins < item.cost) return 'insufficient';
  state.coins -= item.cost;
  state.shop.owned[item.id] = true;
  state.shop.equipped = item.id;
  return 'bought';
}
export function equipShopItem(state, id) {
  if (id === null) { state.shop.equipped = null; return true; }
  if (!validId(id) || state.shop.owned[id] !== true) return false;
  state.shop.equipped = id;
  return true;
}
export function joystickVector(x, y, radius, deadZone = 0.12) {
  const length = Math.hypot(x, y);
  if (!radius || length <= radius * deadZone) return { x: 0, y: 0, knobX: 0, knobY: 0 };
  const limited = Math.min(length, radius);
  const strength = (limited / radius - deadZone) / (1 - deadZone);
  return { x: x / length * strength, y: y / length * strength, knobX: x / length * limited, knobY: y / length * limited };
}
