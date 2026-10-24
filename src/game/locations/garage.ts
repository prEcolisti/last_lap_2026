import background from '../../assets/locations/garage.png'
import { garageClues } from '../story.ts'
import type { Location } from './location.ts'

export const garage: Location = {
  id: 'garage',
  title: 'Бокс №7',
  lead: 'Здесь болид №7 готовили к гонке. Осмотрите площадку, стены и всё, что оставила команда.',
  background,
  walkable: [
    { x: 76, y: 60, w: 164, h: 84 },
    { x: 4, y: 100, w: 72, h: 16 },
    { x: 38, y: 88, w: 38, h: 28 },
    { x: 94, y: 144, w: 100, h: 32 },
    { x: 72, y: 162, w: 22, h: 14 },
    { x: 4, y: 158, w: 70, h: 18 },
    { x: 218, y: 112, w: 28, h: 64 },
    { x: 240, y: 112, w: 26, h: 32 },
    { x: 194, y: 162, w: 26, h: 14 },
  ],
  start: { x: 166, y: 166, dir: 'up' },
  clues: garageClues,
  rain: false,
  music: 'garage',
}
