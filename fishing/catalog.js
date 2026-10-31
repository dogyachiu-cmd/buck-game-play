// Stable IDs, independent of the adventure game's items and economy.
export const FISH = Object.freeze([
  { id: 'small', name: '小魚', coins: 1, scale: 1, color: '#b7d6c7' },
  { id: 'large', name: '大魚', coins: 10, scale: 1.65, color: '#81aeba' },
]);
export const RODS = Object.freeze([
  { id: 'reed', name: '湖畔竿', price: 0, maxLength: 2.4, color: '#b48751' },
  { id: 'silver', name: '銀波竿', price: 12, maxLength: 3.6, color: '#b8d4d7' },
  { id: 'sunrise', name: '晨光竿', price: 30, maxLength: 4.8, color: '#e5b875' },
]);
export const MIN_LENGTH = 0.8;
export const fishById = id => FISH.find(fish => fish.id === id);
export const rodById = id => RODS.find(rod => rod.id === id);
export const totalCaught = state => Object.values(state.records).reduce((a, b) => a + b, 0);
