import { CATEGORIES, ITEMS } from './catalog.js';
import { icon } from './icons.js';

const count = (save, metric, id) => save.records[metric]?.[id] || 0;
export function journalGroups(save) {
  const knownMetrics = new Set(CATEGORIES.flatMap(group => [group.metric, group.secondary].filter(Boolean)));
  const extraGroups = Object.keys(save.records).filter(metric => !knownMetrics.has(metric))
    .map(metric => ({ id: metric, metric, label: '其他紀錄', icon: 'star' }));
  return [...CATEGORIES, ...extraGroups].map(group => {
    const known = ITEMS.filter(item => item.category === group.id);
    const ids = new Set([...known.map(item => item.id), ...Object.keys(save.records[group.metric] || {}),
      ...Object.keys(save.records[group.secondary] || {})]);
    return { ...group, items: [...ids].map(id => ({
      ...(known.find(item => item.id === id) || { id, label: id, icon: 'star' }),
      count: count(save, group.metric, id), planted: group.secondary ? count(save, group.secondary, id) : null
    })) };
  });
}
export function renderJournal(container, save) {
  container.replaceChildren();
  for (const group of journalGroups(save)) {
    const section = document.createElement('section'); section.className = 'journal-section';
    const heading = document.createElement('h3');
    heading.innerHTML = icon(group.icon);
    const title = document.createElement('span'); title.textContent = group.label; heading.append(title);
    section.append(heading);
    const grid = document.createElement('div'); grid.className = 'journal-grid';
    for (const item of group.items) {
      const card = document.createElement('div'); card.className = 'record-card'; card.dataset.item = item.id;
      card.classList.toggle('discovered', item.count + (item.planted || 0) > 0);
      const picture = document.createElement('span'); picture.className = 'record-picture'; picture.innerHTML = icon(item.icon);
      const name = document.createElement('span'); name.className = 'record-name'; name.textContent = item.label;
      const amount = document.createElement('strong'); amount.className = 'record-count'; amount.textContent = '× ' + item.count;
      card.append(picture, name, amount);
      if (item.planted !== null) {
        amount.setAttribute('aria-label', '已收成 ' + item.count);
        const planted = document.createElement('small'); planted.textContent = '種 ' + item.planted + ' · 收 ' + item.count;
        card.append(planted);
      }
      card.setAttribute('aria-label', item.label + '：' + (item.planted === null ? item.count : '種植 ' + item.planted + '，收成 ' + item.count));
      grid.append(card);
    }
    section.append(grid); container.append(section);
  }
}
