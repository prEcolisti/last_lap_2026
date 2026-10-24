export interface User {
  id: string
  nickname: string
  createdAt: string
}

export interface Credentials {
  nickname: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface AuthApi {
  login(credentials: Credentials): Promise<AuthResponse>
  register(credentials: Credentials): Promise<AuthResponse>
  me(token: string): Promise<User>
  logout(token: string): Promise<void>
}
