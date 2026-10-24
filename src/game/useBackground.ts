import { useMemo } from 'react'
import type { Location } from './locations/index.ts'
import { useImage } from './useImage.ts'

export function useBackground(location: Location): CanvasImageSource | null {
  const src = typeof location.background === 'string' ? location.background : ''
  const image = useImage(src)
  const drawn = useMemo(
    () => (typeof location.background === 'function' ? location.background() : null),
    [location],
  )
  return drawn ?? image
}
