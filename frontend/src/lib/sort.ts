/** Sort groups/batches by the first number in the name, then alphabetically. */
export function naturalGroupSort<T extends { name: string }>(a: T, b: T): number {
  const firstNum = (name: string) => { const m = name.match(/\d+/); return m ? parseInt(m[0]) : 0; };
  const na = firstNum(a.name);
  const nb = firstNum(b.name);
  if (na !== nb) return na - nb;
  return a.name.localeCompare(b.name);
}
