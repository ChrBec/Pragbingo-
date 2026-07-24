export interface BingoLine {
  key: string;
  cells: number[];
}

export const BINGO_LINES: BingoLine[] = (() => {
  const lines: BingoLine[] = [];
  for (let r = 0; r < 5; r++) {
    lines.push({
      key: `row${r}`,
      cells: Array.from({ length: 5 }, (_, c) => r * 5 + c),
    });
  }
  for (let c = 0; c < 5; c++) {
    lines.push({
      key: `col${c}`,
      cells: Array.from({ length: 5 }, (_, r) => r * 5 + c),
    });
  }
  lines.push({ key: "diag0", cells: [0, 6, 12, 18, 24] });
  lines.push({ key: "diag1", cells: [4, 8, 12, 16, 20] });
  return lines;
})();

export function newlyCompletedLines(
  markedSet: Set<number>,
  alreadyAwarded: Set<string>,
): BingoLine[] {
  return BINGO_LINES.filter(
    (line) =>
      !alreadyAwarded.has(line.key) && line.cells.every((c) => markedSet.has(c)),
  );
}
