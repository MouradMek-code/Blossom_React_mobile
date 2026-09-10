// Deterministic shuffle for the browse deck.
//
// The deck is re-fetched during a session (e.g. the web browse screen refetches
// after a match), so a plain random shuffle would reorder the cards under the
// user and lose their place. Instead the order is derived from a seed that's
// generated once per mount: the order is random each time the screen is opened,
// but stable for as long as the user stays on it.
function pseudoRandom(seed, n) {
  const x = Math.sin(seed * 9999 + n * 7919) * 10000;
  return x - Math.floor(x);
}

export function seededShuffle(items, seed) {
  return items
    .map((item, i) => ({ item, key: pseudoRandom(seed, Number(item?.id) || i) }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

// Plain Fisher-Yates, for one-off shuffles where stability doesn't matter.
export function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
