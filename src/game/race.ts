import type { CarId } from './cars.ts'
import { ROAD_HALF, START_S, circuit, placeOnTrack, pointAt } from './circuit.ts'

const STEP = 1 / 60
const DURATION = 12
const LANE_MAX = ROAD_HALF - 2.5
const GRIP = 260
const ACCELERATE = 70
const BRAKE = 170
const STEER = 14
const OVERTAKE_HOLD = 1.6

const drivers: { id: CarId; pace: number; seed: number }[] = [
  { id: 'car7', pace: 140, seed: 0.4 },
  { id: 'car22', pace: 146, seed: 2.1 },
  { id: 'car3', pace: 131, seed: 4 },
  { id: 'car9', pace: 139, seed: 1.2 },
  { id: 'car14', pace: 127, seed: 5.3 },
  { id: 'car31', pace: 134, seed: 3.1 },
]

interface Car {
  id: CarId
  pace: number
  seed: number
  s: number
  v: number
  lane: number
  laneTarget: number
  hold: number
}

export interface RacerPose {
  id: CarId
  x: number
  y: number
  angle: number
}

const length = circuit.length
const gap = (from: number, to: number) => {
  const d = (((to - from) % length) + length) % length
  return d > length / 2 ? d - length : d
}

function cornerAhead(s: number) {
  let worst = 0
  for (let d = 0; d <= 36; d += 3) {
    const k = pointAt(s + d).curvature
    if (Math.abs(k) > Math.abs(worst)) worst = k
  }
  return worst
}

function pose(car: Car): RacerPose {
  const p = placeOnTrack(car.s, car.lane)
  const drift = Math.atan2(car.laneTarget - car.lane, 40) * 0.25
  return { id: car.id, x: p.x, y: p.y, angle: p.angle + drift }
}

function separation(a: Car, b: Car) {
  const pa = pose(a)
  const pb = pose(b)
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const distance = Math.hypot(dx, dy)
  const project = (angle: number) => Math.abs((dx * Math.cos(angle) + dy * Math.sin(angle)) / distance)
  const along = distance ? Math.max(project(pa.angle), project(pb.angle)) : 1
  return { distance, required: 8.4 + 3 * along }
}

function simulate() {
  const cars: Car[] = drivers.map((driver, i) => ({
    ...driver,
    s: START_S + 46 - i * 13,
    v: 72,
    lane: i % 2 ? LANE_MAX * 0.6 : -LANE_MAX * 0.6,
    laneTarget: 0,
    hold: 0,
  }))
  const frames: RacerPose[][] = []
  const steps = Math.ceil(DURATION / STEP)
  const record = () => {
    frames.push(cars.map(pose))
  }
  record()

  for (let step = 1; step <= steps; step++) {
    const t = step * STEP
    const order = [...cars].sort((a, b) => b.s - a.s)
    for (const car of order) {
      const corner = cornerAhead(car.s)
      const cornerSpeed = Math.sqrt(GRIP / Math.max(Math.abs(corner), 0.0005))
      let target = Math.min(car.pace * (1 + 0.05 * Math.sin(t * 0.7 + car.seed)), cornerSpeed)

      if (car.hold <= 0) {
        const line = Math.abs(corner) > 0.02 ? Math.sign(corner) * LANE_MAX * 0.75 : LANE_MAX * 0.5 * Math.sin(t * 0.5 + car.seed * 2)
        car.laneTarget = line
      } else car.hold -= STEP

      const ahead = cars
        .filter((other) => other !== car)
        .map((other) => ({ other, d: gap(car.s, other.s) }))
        .filter(({ other, d }) => d > 0 && d < 30 && Math.abs(other.lane - car.lane) < 7)
        .sort((x, y) => x.d - y.d)[0]

      if (ahead && ahead.d < 24 && target > ahead.other.v) {
        const side = ahead.other.lane >= 0 ? -LANE_MAX : LANE_MAX
        const blocked = cars.some(
          (other) => other !== car && other !== ahead.other && Math.abs(gap(car.s, other.s)) < 16 && Math.abs(other.lane - side) < 7,
        )
        if (!blocked) {
          car.laneTarget = side
          car.hold = OVERTAKE_HOLD
        } else target = Math.min(target, ahead.other.v)
      }
      if (ahead && ahead.d < 14 && Math.abs(ahead.other.lane - car.lane) < 6) target = Math.min(target, ahead.other.v - 4)

      const dv = target - car.v
      car.v += Math.max(-BRAKE * STEP, Math.min(ACCELERATE * STEP, dv))
      const dl = car.laneTarget - car.lane
      car.lane += Math.max(-STEER * STEP, Math.min(STEER * STEP, dl))
      car.lane = Math.max(-LANE_MAX, Math.min(LANE_MAX, car.lane))
      car.s += car.v * STEP
    }

    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          const behind = gap(cars[i].s, cars[j].s) > 0 ? cars[i] : cars[j]
          const front = behind === cars[i] ? cars[j] : cars[i]
          let { distance, required } = separation(behind, front)
          let guard = 0
          while (distance < required && guard++ < 40) {
            behind.s -= 0.5
            ;({ distance, required } = separation(behind, front))
          }
          if (guard) behind.v = Math.min(behind.v, front.v)
        }
      }
    }
    record()
  }
  return frames
}

let frames: RacerPose[][] | null = null

export function raceAt(t: number): RacerPose[] {
  frames ??= simulate()
  const index = Math.max(0, Math.min(frames.length - 1, Math.round(t / STEP)))
  return frames[index]
}
