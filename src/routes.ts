export const routes = {
  home: '/',
  login: '/login',
  register: '/register',
  intro: '/intro',
  locations: '/locations',
  location: (id: string) => `/locations/${id}`,
  suspects: '/suspects',
  interrogation: (id: string) => `/suspects/${id}`,
  accusation: (id: string) => `/accuse/${id}`,
} as const
