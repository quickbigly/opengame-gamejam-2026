/** Game minutes after 6:00 PM → "7:05 PM". */
export function clock(minutes: number): string {
  const total = 18 * 60 + Math.round(minutes);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export function mins(n: number): string {
  return `${n} min`;
}

export function stars(tier: number): string {
  return '★'.repeat(tier) + '☆'.repeat(4 - tier);
}
