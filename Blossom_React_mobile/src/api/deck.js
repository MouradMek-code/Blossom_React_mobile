import { seededShuffle, shuffle } from "./shuffle";

// Folds a fresh list from the server into the Browse deck.
//
// `isUpcoming(profile)` says whether a card is still to be seen (not passed,
// matches the filters); the first such card is the one on screen.
//
// - The card on screen never moves: a refresh can't swap it out from under
//   the user's finger.
// - People who weren't in the deck before - new members above all - go right
//   after it, so they show up at once rather than at the bottom of a long deck.
// - Everyone else keeps their place, with their latest details (new photos,
//   bio...); people the server no longer returns (matched, blocked, account
//   deleted) drop out.
// - With `reshuffle` (nothing swiped yet, or starting over) the rest is
//   shuffled afresh, so the same faces aren't always first.
export function mergeDeck(current, fresh, { isUpcoming, reshuffle = false, seed = Math.random() }) {
  const freshById = new Map(fresh.map((p) => [p.id, p]));
  const known = new Set(current.map((p) => p.id));
  const top = current.find((p) => freshById.has(p.id) && isUpcoming(p));
  const newcomers = shuffle(fresh.filter((p) => !known.has(p.id)));

  if (reshuffle) {
    const rest = seededShuffle(
      fresh.filter((p) => known.has(p.id) && p.id !== top?.id),
      seed,
    );
    return [...(top ? [freshById.get(top.id)] : []), ...newcomers, ...rest];
  }

  const kept = current.filter((p) => freshById.has(p.id)).map((p) => freshById.get(p.id));
  const topIndex = top ? kept.findIndex((p) => p.id === top.id) : -1;
  if (topIndex === -1) return [...kept, ...newcomers];
  return [...kept.slice(0, topIndex + 1), ...newcomers, ...kept.slice(topIndex + 1)];
}
