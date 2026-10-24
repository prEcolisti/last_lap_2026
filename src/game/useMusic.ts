import { useEffect } from 'react'
import { music, type TrackId } from './music.ts'

export function useMusic(track?: TrackId) {
  useEffect(() => {
    if (track) music.play(track)
    else music.keep('tension')
  }, [track])
}
