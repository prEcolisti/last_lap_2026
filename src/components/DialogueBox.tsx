import type { Conversation } from '../game/useConversation.ts'
import { PORTRAIT_SIZE, detectivePortraits } from '../game/portraits.ts'
import './DialogueBox.css'

interface DialogueBoxProps {
  talk: Conversation
  speaker: string
  placeholder: string
}

export function DialogueBox({ talk, speaker, placeholder }: DialogueBoxProps) {
  const { topic, spoken, lineIndex, shown, typing, finished } = talk

  return (
    <div className="talk__dialogue">
      <div className="talk__log" aria-live="polite" onClick={finished ? undefined : talk.advance} data-waiting={topic !== null && !finished}>
        {topic ? (
          spoken.map((item, i) => (
            <div key={i} className={`talk__line talk__line--${item.by}`}>
              {item.by === 'detective' && (
                <img
                  className="talk__avatar"
                  src={item.sharp ? detectivePortraits.sharp : detectivePortraits.calm}
                  alt=""
                  width={PORTRAIT_SIZE}
                  height={PORTRAIT_SIZE}
                />
              )}
              <p>
                <b>{item.by === 'detective' ? 'Детектив' : speaker}</b>
                {i === lineIndex ? item.text.slice(0, shown) : item.text}
              </p>
            </div>
          ))
        ) : (
          <p className="talk__placeholder">{placeholder}</p>
        )}
        {topic && !finished && !typing && <span className="talk__more" aria-hidden="true">▼</span>}
      </div>

      {topic && !finished ? (
        <p className="talk__hint">
          Нажмите на текст<span className="talk__keys">, пробел или Enter</span> — дальше
        </p>
      ) : (
        <ul className="talk__questions">
          {talk.available.map((item) => (
            <li key={item.id}>
              <button type="button" className="talk__question" data-asked={talk.isAsked(item.id)} onClick={() => talk.start(item.id)}>
                <span aria-hidden="true">{talk.isAsked(item.id) ? '✓' : '?'}</span>
                {item.question}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
