export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;

export const angleLerp = (a, b, t) => {
  const diff = ((b - a + Math.PI) % TAU) - Math.PI;
  return a + diff * t;
};

export const randBetween = (min, max) => min + Math.random() * (max - min);
export const randChoice = (items) => items[Math.floor(Math.random() * items.length)];

export const snap = (value, step) => Math.round(value / step) * step;
