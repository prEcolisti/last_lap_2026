import { isWalkable, type Location, type Point } from './locations/index.ts'
import { H, W } from './pixels.ts'

const CELL = 4
const COLS = W / CELL
const ROWS = H / CELL

const grids = new Map<string, Uint8Array>()

function grid(location: Location) {
  let hit = grids.get(location.id)
  if (!hit) {
    hit = new Uint8Array(COLS * ROWS)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        hit[r * COLS + c] = isWalkable(location, c * CELL + CELL / 2, r * CELL + CELL / 2) ? 1 : 0
      }
    }
    grids.set(location.id, hit)
  }
  return hit
}

const cellOf = (p: Point) => ({
  c: Math.min(COLS - 1, Math.max(0, Math.floor(p.x / CELL))),
  r: Math.min(ROWS - 1, Math.max(0, Math.floor(p.y / CELL))),
})
const center = (index: number): Point => ({
  x: (index % COLS) * CELL + CELL / 2,
  y: Math.floor(index / COLS) * CELL + CELL / 2,
})

function nearestOpen(cells: Uint8Array, p: Point): number {
  const { c, r } = cellOf(p)
  if (cells[r * COLS + c]) return r * COLS + c
  let best = -1
  let bestDistance = Infinity
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue
    const q = center(i)
    const d = Math.hypot(q.x - p.x, q.y - p.y)
    if (d < bestDistance) {
      best = i
      bestDistance = d
    }
  }
  return best
}

function lineOfSight(location: Location, a: Point, b: Point) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2)
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    if (!isWalkable(location, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)) return false
  }
  return true
}

export function reachable(location: Location, target: Point): Point {
  if (isWalkable(location, target.x, target.y)) return target
  const index = nearestOpen(grid(location), target)
  return index < 0 ? target : center(index)
}

export function findPath(location: Location, from: Point, target: Point): Point[] {
  const cells = grid(location)
  const goal = reachable(location, target)
  const start = nearestOpen(cells, from)
  const end = nearestOpen(cells, goal)
  if (start < 0 || end < 0) return []

  const previous = new Int32Array(cells.length).fill(-1)
  previous[start] = start
  const queue = [start]
  for (let head = 0; head < queue.length && previous[end] < 0; head++) {
    const index = queue[head]
    const c = index % COLS
    const r = Math.floor(index / COLS)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const nc = c + dc
        const nr = r + dr
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue
        const next = nr * COLS + nc
        if (!cells[next] || previous[next] >= 0) continue
        if (dr && dc && (!cells[r * COLS + nc] || !cells[nr * COLS + c])) continue
        previous[next] = index
        queue.push(next)
      }
    }
  }
  if (previous[end] < 0) return []

  const raw: Point[] = [goal]
  for (let index = previous[end]; index !== start; index = previous[index]) raw.unshift(center(index))

  const path: Point[] = []
  let anchor = from
  for (let i = 0; i < raw.length; i++) {
    const next = raw[i + 1]
    if (next && lineOfSight(location, anchor, next)) continue
    path.push(raw[i])
    anchor = raw[i]
  }
  return path
}
