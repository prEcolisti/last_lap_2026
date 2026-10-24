import background from '../../assets/locations/crash-site.png'
import { clues } from '../story.ts'
import type { Location } from './location.ts'

export const crashSite: Location = {
  id: 'crash-site',
  title: 'Место аварии',
  lead: 'Обломки болида №7 так и не убрали. Пройдите к машине через проход в ленте и осмотрите всё вокруг.',
  background,
  walkable: [
    { x: 6, y: 62, w: 196, h: 46 },
    { x: 200, y: 74, w: 18, h: 20 },
    { x: 150, y: 100, w: 56, h: 24 },
    { x: 196, y: 124, w: 94, h: 50 },
  ],
  start: { x: 172, y: 84, dir: 'right' },
  clues,
  rain: true,
  music: 'premonition',
}
