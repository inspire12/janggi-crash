const startingPoints = [
  [1, 2], [7, 2],
  [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
  [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
  [1, 7], [7, 7],
] as const;

export default function JanggiBoardMarks() {
  return <div className="start-marks" aria-hidden="true">
    {startingPoints.map(([x, y]) => <i key={`${x}-${y}`} className="start-mark" style={{ left: `${x * 12.5}%`, top: `${y * (100 / 9)}%` }} />)}
  </div>;
}
