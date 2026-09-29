// These entries describe the existing prototype assets, not newly confirmed lore.
// Stable IDs stay unchanged when display names change. New content is added here.
export const CATEGORIES = [
  { id: 'hunting', label: '打獵', icon: 'paw', metric: 'hunting' },
  { id: 'ocean', label: '海洋', icon: 'fish', metric: 'ocean' },
  { id: 'growing', label: '種植', icon: 'seed', metric: 'harvest', secondary: 'planted' }
];
export const ITEMS = [
  { id: 'deer', category: 'hunting', label: '鹿', icon: 'deer' },
  { id: 'boar', category: 'hunting', label: '野豬', icon: 'boar' },
  { id: 'rabbit', category: 'hunting', label: '兔子', icon: 'rabbit' },
  { id: 'fish', category: 'ocean', label: '魚', icon: 'fish' },
  { id: 'crab', category: 'ocean', label: '螃蟹', icon: 'crab' },
  { id: 'octopus', category: 'ocean', label: '章魚', icon: 'octopus' },
  { id: 'carrot', category: 'growing', label: '紅蘿蔔', icon: 'carrot' },
  { id: 'berry', category: 'growing', label: '莓果', icon: 'berry' }
];
export const ACTIVITIES = [
  { id: 'deer', node: 'TARGET_DEER', world: 'land', kind: 'animal', metric: 'hunting', item: 'deer', reward: 3 },
  { id: 'boar', node: 'TARGET_BOAR', world: 'land', kind: 'animal', metric: 'hunting', item: 'boar', reward: 3 },
  { id: 'rabbit', node: 'TARGET_RABBIT', world: 'land', kind: 'animal', metric: 'hunting', item: 'rabbit', reward: 3 },
  { id: 'fish', node: 'TARGET_FISH', world: 'sea', kind: 'animal', metric: 'ocean', item: 'fish', reward: 2 },
  { id: 'crab', node: 'TARGET_CRAB', world: 'sea', kind: 'animal', metric: 'ocean', item: 'crab', reward: 2 },
  { id: 'octopus', node: 'TARGET_OCTOPUS', world: 'sea', kind: 'animal', metric: 'ocean', item: 'octopus', reward: 2 },
  // The original Blender patch contains one carrot AND one berry per harvest.
  { id: 'garden', node: 'TARGET_FARM', world: 'land', kind: 'farm', reward: 1,
    yields: [{ item: 'carrot', quantity: 1 }, { item: 'berry', quantity: 1 }] }
];
