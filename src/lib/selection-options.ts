export function disambiguatedLabels<T>(
  items: readonly T[],
  labelFor: (item: T) => string,
  duplicateSuffixFor: (item: T) => string
): string[] {
  const baseLabels = items.map(labelFor);
  const counts = new Map<string, number>();
  for (const label of baseLabels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return items.map((item, index) => (
    (counts.get(baseLabels[index]) ?? 0) > 1
      ? `${baseLabels[index]} · ${duplicateSuffixFor(item)}`
      : baseLabels[index]
  ));
}
