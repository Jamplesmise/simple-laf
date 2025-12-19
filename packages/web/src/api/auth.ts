import client from './client'

interface AuthResponse {
  success: boolean
  data: {
    token: string
    user: {
      id: string
      username: string
    }
  }
}

export const authApi = {
  login: (username: string, password: string) =>
    client.post<AuthResponse>('/api/auth/login', { username, password }),

  register: (username: string, password: string) =>
    client.post<AuthResponse>('/api/auth/register', { username, password }),

  me: () =>
    client.get<{ success: boolean; data: { id: string; username: string } }>(
      '/api/auth/me'
    ),
}
