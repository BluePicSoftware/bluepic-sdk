export function getQuery(query: { [k: string]: unknown }, noUndefined = true) {
  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(query)
        .filter(([, v]) => v !== undefined || !noUndefined)
        .map(([key, value]) => [key, String(value)])
    )
  );
}
