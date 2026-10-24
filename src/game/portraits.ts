import bartenderCalm from '../assets/portraits/bartender-calm.png'
import bartenderRecall from '../assets/portraits/bartender-recall.png'
import detectiveCalm from '../assets/portraits/detective-calm.png'
import detectiveSharp from '../assets/portraits/detective-sharp.png'
import mechanicBroken from '../assets/portraits/mechanic-broken.png'
import mechanicCalm from '../assets/portraits/mechanic-calm.png'
import mechanicLie from '../assets/portraits/mechanic-lie.png'
import mechanicNervous from '../assets/portraits/mechanic-nervous.png'
import pilot1Calm from '../assets/portraits/pilot1-calm.png'
import pilot1Happy from '../assets/portraits/pilot1-happy.png'
import pilot22Broken from '../assets/portraits/pilot22-broken.png'
import pilot22Calm from '../assets/portraits/pilot22-calm.png'
import pilot22Lie from '../assets/portraits/pilot22-lie.png'
import pilot22Nervous from '../assets/portraits/pilot22-nervous.png'
import sponsorBroken from '../assets/portraits/sponsor-broken.png'
import sponsorCalm from '../assets/portraits/sponsor-calm.png'
import sponsorLie from '../assets/portraits/sponsor-lie.png'
import sponsorNervous from '../assets/portraits/sponsor-nervous.png'

export const PORTRAIT_SIZE = 62

export type Mood = 'calm' | 'nervous' | 'lie' | 'broken'

export const suspectPortraits: Record<string, Record<Mood, string>> = {
  pilot: { calm: pilot22Calm, nervous: pilot22Nervous, lie: pilot22Lie, broken: pilot22Broken },
  mechanic: { calm: mechanicCalm, nervous: mechanicNervous, lie: mechanicLie, broken: mechanicBroken },
  sponsor: { calm: sponsorCalm, nervous: sponsorNervous, lie: sponsorLie, broken: sponsorBroken },
}

export const detectivePortraits = { calm: detectiveCalm, sharp: detectiveSharp }

export const bartenderPortraits = { calm: bartenderCalm, recall: bartenderRecall }

export const victimPortraits = { calm: pilot1Calm, happy: pilot1Happy }
