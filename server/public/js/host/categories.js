// Category chips in the lobby. An empty selection means "All".

const selected = new Set();
let wrap = null;
let categories = [];

export function renderCategories(container, list) {
  wrap = container;
  categories = list;
  draw();
}

export function getSelectedCategories() {
  return [...selected];
}

function chip(label, isSelected, onClick) {
  const el = document.createElement('div');
  el.className = 'chip toggle' + (isSelected ? ' selected' : '');
  el.textContent = label;
  el.onclick = onClick;
  return el;
}

function draw() {
  wrap.innerHTML = '';

  wrap.appendChild(chip('🎲 All Categories', selected.size === 0, () => {
    selected.clear();
    draw();
  }));

  categories.forEach(cat => {
    wrap.appendChild(chip(cat, selected.has(cat), () => {
      if (selected.has(cat)) selected.delete(cat);
      else selected.add(cat);
      draw();
    }));
  });
}
