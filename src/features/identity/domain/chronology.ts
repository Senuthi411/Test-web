/** Compare recorded instants, never their offset-bearing display strings. Equal instants
 * return zero so stable Array.sort retains the source order. Invalid values also retain
 * source order; this does not repair or rewrite historical records. */
export function newestFirst(left: { at: string }, right: { at: string }): number {
  const difference = Date.parse(right.at) - Date.parse(left.at)
  return Number.isFinite(difference) ? difference : 0
}
