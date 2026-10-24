const CONTROL: [number, number][] = [
  [70, 148],
  [160, 148],
  [244, 148],
  [272, 146],
  [288, 134],
  [292, 112],
  [291, 84],
  [292, 56],
  [286, 36],
  [270, 28],
  [254, 34],
  [248, 52],
  [252, 70],
  [244, 84],
  [224, 90],
  [206, 82],
  [186, 70],
  [150, 62],
  [112, 54],
  [78, 44],
  [54, 46],
  [40, 62],
  [38, 86],
  [44, 104],
  [34, 122],
  [36, 140],
  [50, 148],
]

export const ROAD_HALF = 7
export const KERB = 2

export interface PathPoint {
  x: number
  y: number
  angle: number
  curvature: number
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
}

function build() {
  const dense: { x: number; y: number }[] = []
  const n = CONTROL.length
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((d) => CONTROL[(i + d + n) % n])
    for (let k = 0; k < 40; k++) {
      const t = k / 40
      dense.push({ x: catmullRom(p0[0], p1[0], p2[0], p3[0], t), y: catmullRom(p0[1], p1[1], p2[1], p3[1], t) })
    }
  }
  const cumulative = [0]
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1]
    const b = dense[i % dense.length]
    cumulative.push(cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const length = cumulative[cumulative.length - 1]
  const count = Math.round(length)
  const xy: { x: number; y: number }[] = []
  let j = 0
  for (let i = 0; i < count; i++) {
    const s = (i / count) * length
    while (cumulative[j + 1] < s) j++
    const k = (s - cumulative[j]) / (cumulative[j + 1] - cumulative[j])
    const a = dense[j]
    const b = dense[(j + 1) % dense.length]
    xy.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
  }
  const at = (i: number) => xy[((i % count) + count) % count]
  const heading = (i: number) => Math.atan2(at(i + 1).y - at(i - 1).y, at(i + 1).x - at(i - 1).x)
  const points: PathPoint[] = xy.map((p, i) => {
    let turn = heading(i + 4) - heading(i - 4)
    turn = Math.atan2(Math.sin(turn), Math.cos(turn))
    return { ...p, angle: heading(i), curvature: turn / 8 }
  })
  return { points, length: count }
}

export const circuit = build()

export function pointAt(s: number): PathPoint {
  const { points, length } = circuit
  const wrapped = ((s % length) + length) % length
  const i = Math.floor(wrapped)
  const a = points[i]
  const b = points[(i + 1) % length]
  const k = wrapped - i
  let turn = b.angle - a.angle
  turn = Math.atan2(Math.sin(turn), Math.cos(turn))
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    angle: a.angle + turn * k,
    curvature: a.curvature + (b.curvature - a.curvature) * k,
  }
}

export function placeOnTrack(s: number, lane: number) {
  const p = pointAt(s)
  return { x: p.x - Math.sin(p.angle) * lane, y: p.y + Math.cos(p.angle) * lane, angle: p.angle }
}

export const START_S = circuit.points.reduce(
  (best, p, i) => (Math.abs(p.y - 148) < 2 && Math.abs(p.x - 160) < Math.abs(circuit.points[best].x - 160) ? i : best),
  0,
)

export function nearest(x: number, y: number) {
  let best = 0
  let bestD = Infinity
  const { points } = circuit
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - x
    const dy = points[i].y - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return { index: best, distance: Math.sqrt(bestD) }
}
