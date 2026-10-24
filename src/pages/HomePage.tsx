import { useLocation } from 'react-router-dom'
import { ButtonLink } from '../components/Button.tsx'
import { PageShell } from '../components/PageShell.tsx'
import { useMusic } from '../game/useMusic.ts'
import { routes } from '../routes.ts'
import './HomePage.css'

export function HomePage() {
  const afterWrong = (useLocation().state as { afterWrong?: boolean } | null)?.afterWrong
  useMusic(afterWrong ? 'sad' : 'menu')
  return (
    <PageShell
      withCar
      headerSlot={<span>Круг 3/3</span>}
      footerSlot={
        <>
          <span>Команда «прЕколисты»</span>
          <span>Кейс банка «Центр-инвест» · Разработка игры</span>
        </>
      }
    >
      <div className="home">
        <p className="home__tagline">Основано на реальных событиях</p>
        <h1 className="home__title">
          <span>Последний</span>
          <span>круг</span>
        </h1>
        <p className="home__lead">Зарегистрируйся или войди, чтобы начать игру</p>
        <div className="home__actions">
          <ButtonLink to={routes.login}>Войти</ButtonLink>
          <ButtonLink to={routes.register} variant="ghost">
            Регистрация
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  )
}
