import type { ReactNode } from 'react'
import { Logo } from './Logo.tsx'
import { TrackBackdrop } from './TrackBackdrop.tsx'
import './PageShell.css'

interface PageShellProps {
  children: ReactNode
  headerSlot?: ReactNode
  footerSlot?: ReactNode
  fadedTrack?: boolean
  withCar?: boolean
}

export function PageShell({ children, headerSlot, footerSlot, fadedTrack, withCar }: PageShellProps) {
  return (
    <div className="shell">
      <div className="shell__backdrop">
        <TrackBackdrop faded={fadedTrack} withCar={withCar} />
      </div>

      <header className="shell__header">
        <Logo />
        {headerSlot && <div className="shell__header-slot">{headerSlot}</div>}
      </header>

      <main className="shell__main">{children}</main>

      <div className="shell__chequer" aria-hidden="true" />

      <footer className="shell__footer">{footerSlot}</footer>
    </div>
  )
}
