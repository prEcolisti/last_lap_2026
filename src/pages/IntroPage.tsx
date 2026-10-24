import { useNavigate } from 'react-router-dom'
import { Cutscene } from '../cutscene/Cutscene.tsx'
import { script } from '../cutscene/script.ts'
import { useAuth } from '../auth/useAuth.ts'
import { saveProgress } from '../game/progress.ts'
import { routes } from '../routes.ts'

export function IntroPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <Cutscene
      scenes={script}
      playerName={user?.nickname ?? 'детектив'}
      onFinish={() => {
        if (user) saveProgress(user.id, { introSeen: true })
        navigate(routes.locations)
      }}
    />
  )
}
