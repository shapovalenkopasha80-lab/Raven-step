export function overlaps(a, b) {
  return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 &&
    a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
}
export function inside(a, r) {
  return a.x >= r.x && a.y >= r.y && a.x+a.w <= r.x+r.width && a.y+a.h <= r.y+r.height;
}
export function rangeInUnits(units) {
  const u = String(units).trim().toLowerCase();
  if (["ft", "feet", "foot", "фут", "фути", "футів"].includes(u)) return 30;
  if (["m", "meter", "meters", "metre", "metres", "м"].includes(u)) return 9.144;
  throw new Error("Одиниці сцени мають бути ft або m.");
}
