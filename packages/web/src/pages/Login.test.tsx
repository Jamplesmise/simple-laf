import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Login from './Login'
import { useAuthStore } from '../stores/auth'

// Mock the auth API
vi.mock('../api/auth', () => ({
  authApi: {
    login: vi.fn(),
  },
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }
})

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ token: null, user: null })
  })

  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )
  }

  it('should render login form', () => {
    renderLogin()

    expect(screen.getByText('登录 Simple IDE')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
    // Ant Design button adds space between characters, so use regex with optional space
    expect(screen.getByRole('button', { name: /登\s*录/i })).toBeInTheDocument()
  })

  it('should have link to register page', () => {
    renderLogin()

    const registerLink = screen.getByText('立即注册')
    expect(registerLink).toBeInTheDocument()
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register')
  })

  it('should show validation errors for empty fields', async () => {
    renderLogin()

    const submitButton = screen.getByRole('button', { name: /登\s*录/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument()
    })
  })

  it('should call login API with form values', async () => {
    const { authApi } = await import('../api/auth')
    const mockLogin = vi.mocked(authApi.login)
    mockLogin.mockResolvedValue({
      data: {
        success: true,
        data: {
          token: 'test-token',
          user: { id: '1', username: 'testuser' },
        },
      },
    } as never)

    renderLogin()

    const usernameInput = screen.getByPlaceholderText('用户名')
    const passwordInput = screen.getByPlaceholderText('密码')
    const submitButton = screen.getByRole('button', { name: /登\s*录/i })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123')
    })
  })

  it('should navigate to home after successful login', async () => {
    const { authApi } = await import('../api/auth')
    const mockLogin = vi.mocked(authApi.login)
    mockLogin.mockResolvedValue({
      data: {
        success: true,
        data: {
          token: 'test-token',
          user: { id: '1', username: 'testuser' },
        },
      },
    } as never)

    renderLogin()

    const usernameInput = screen.getByPlaceholderText('用户名')
    const passwordInput = screen.getByPlaceholderText('密码')
    const submitButton = screen.getByRole('button', { name: /登\s*录/i })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('should store auth data after successful login', async () => {
    const { authApi } = await import('../api/auth')
    const mockLogin = vi.mocked(authApi.login)
    mockLogin.mockResolvedValue({
      data: {
        success: true,
        data: {
          token: 'test-token',
          user: { id: '1', username: 'testuser' },
        },
      },
    } as never)

    renderLogin()

    const usernameInput = screen.getByPlaceholderText('用户名')
    const passwordInput = screen.getByPlaceholderText('密码')
    const submitButton = screen.getByRole('button', { name: /登\s*录/i })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      const state = useAuthStore.getState()
      expect(state.token).toBe('test-token')
      expect(state.user?.username).toBe('testuser')
    })
  })
})
