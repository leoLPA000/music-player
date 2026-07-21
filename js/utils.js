export function formatTime(seconds) {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* Clamp a value between min and max */
export function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}

/* Pick a random index different from current */
export function randomOther(current, length) {
  if (length <= 1) return 0;
  let n;
  do { n = Math.floor(Math.random() * length); } while (n === current);
  return n;
}
