// Which pills wrap below the first row, given each pill's offsetTop. They are clipped from view, so they must also
// leave the focus order and the accessibility tree.
export function hiddenAfterFirstRow(tops: number[]): boolean[] {
  return tops.map((top) => top > tops[0]);
}
