import type { ReactNode } from 'react'
import './AuthCard.css'

interface AuthCardProps {
  fileLabel: string
  stamp: string
  stampTone?: 'danger' | 'warning'
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({
  fileLabel,
  stamp,
  stampTone = 'danger',
  title,
  subtitle,
  children,
  footer,
}: AuthCardProps) {
  return (
    <section className="auth-card">
      <div className="auth-card__top">
        <span className="auth-card__file">{fileLabel}</span>
        <span className={`auth-card__stamp auth-card__stamp--${stampTone}`}>{stamp}</span>
      </div>
      <h1 className="auth-card__title">{title}</h1>
      <p className="auth-card__subtitle">{subtitle}</p>
      {children}
      {footer && <p className="auth-card__footer">{footer}</p>}
    </section>
  )
}
