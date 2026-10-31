import { MIN_LENGTH, fishById, rodById } from './catalog.js';

export const GAME_ID = 'buck-fishing';
export const SAVE_KEY = 'buck-fishing-v1';
export const BACKUP_KEY = SAVE_KEY + '-backup';
const LIMIT = 1_000_000_000;
const validId = value => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= LIMIT;

export function freshState() {
  return { gameId: GAME_ID, version: 1, coins: 0, earned: 0, records: {}, rods: ['reed'], equipped: 'reed', length: 1.8, sound: true };
}

export function parseSave(raw) {
  if (typeof raw !== 'string' || raw.length > 262144) throw new Error('存檔太大或格式不正確');
  const value = JSON.parse(raw);
  if (!value || value.gameId !== GAME_ID) throw new Error('這不是釣魚遊戲的存檔');
  if (value.version !== 1) throw new Error('這份存檔需要其他版本的釣魚遊戲');
  if (!count(value.coins) || !count(value.earned) || value.earned < value.coins) throw new Error('金幣資料不正確');
  if (!value.records || Array.isArray(value.records) || typeof value.records !== 'object') throw new Error('魚類紀錄不正確');
  const records = {};
  const entries = Object.entries(value.records);
  if (entries.length > 500) throw new Error('魚類項目過多');
  for (const [id, amount] of entries) {
    if (!validId(id) || !count(amount)) throw new Error('魚類紀錄不正確');
    records[id] = amount;
  }
  if (!Array.isArray(value.rods) || value.rods.length > 100 || !value.rods.every(validId)) throw new Error('釣竿資料不正確');
  const rods = [...new Set(['reed', ...value.rods])];
  const equipped = rods.includes(value.equipped) && rodById(value.equipped) ? value.equipped : 'reed';
  const length = Number.isFinite(value.length) ? Math.max(MIN_LENGTH, Math.min(rodById(equipped).maxLength, value.length)) : 1.8;
  return { gameId: GAME_ID, version: 1, coins: value.coins, earned: value.earned, records, rods, equipped, length, sound: value.sound !== false };
}

export function loadGame(storage) {
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
    // A newer version must never be silently replaced by an older backup.
    if (raw) {
      try {
        const header = JSON.parse(raw);
        if (header.gameId === GAME_ID && Number(header.version) > 1) {
          return { state: freshState(), readOnly: true, message: '找到較新版本的存檔。已保留原檔，請更新遊戲後再讀取。' };
        }
      } catch {}
      try { return { state: parseSave(raw), readOnly: false, message: '' }; } catch {}
    }
    const backup = storage.getItem(BACKUP_KEY);
    if (backup) {
      try { return { state: parseSave(backup), readOnly: false, message: '已從上一份備份讀回成績。' }; } catch {}
    }
    if (raw || backup) return { state: freshState(), readOnly: true, message: '舊存檔目前讀不到，已保留原檔。本次試玩請另做備份。' };
    return { state: freshState(), readOnly: false, message: '' };
  } catch {
    return { state: freshState(), readOnly: true, message: '瀏覽器無法存檔。本次成績請用備份保存。' };
  }
}

export function saveGame(storage, state, readOnly = false) {
  if (readOnly) return false;
  try {
    const next = JSON.stringify(parseSave(JSON.stringify(state)));
    const previous = storage.getItem(SAVE_KEY);
    if (previous) {
      try {
        const header = JSON.parse(previous);
        if (header?.gameId === GAME_ID && Number(header.version) > 1) return false;
      } catch {}
      let valid = false;
      try { parseSave(previous); valid = true; } catch {}
      if (valid) storage.setItem(BACKUP_KEY, previous);
    }
    storage.setItem(SAVE_KEY, next);
    return true;
  } catch { return false; }
}

export function catchFish(state, id) {
  const fish = fishById(id);
  if (!fish) return state;
  return { ...state, coins: Math.min(LIMIT, state.coins + fish.coins), earned: Math.min(LIMIT, state.earned + fish.coins), records: { ...state.records, [id]: Math.min(LIMIT, (state.records[id] || 0) + 1) } };
}

export function chooseRod(state, id) {
  const rod = rodById(id);
  if (!rod) return { ok: false, reason: '找不到這支釣竿', state };
  const owned = state.rods.includes(id);
  if (!owned && state.coins < rod.price) return { ok: false, reason: '金幣還不夠，再釣幾條魚！', state };
  return { ok: true, state: { ...state, coins: state.coins - (owned ? 0 : rod.price), rods: owned ? [...state.rods] : [...state.rods, id], equipped: id, length: Math.min(state.length, rod.maxLength) } };
}

export function changeLength(state, value) {
  if (!Number.isFinite(value)) return state;
  return { ...state, length: Math.round(Math.max(MIN_LENGTH, Math.min(rodById(state.equipped).maxLength, value)) * 10) / 10 };
}
