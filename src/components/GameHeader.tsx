import { useAuth } from '../auth/useAuth.ts'
import './GameHeader.css'

export function GameHeader({ label }: { label: string }) {
  const { logout } = useAuth()
  return (
    <span className="game-header">
      <span>{label}</span>
      <button type="button" className="game-header__logout" onClick={() => void logout()}>
        Выйти
      </button>
    </span>
  )
}
