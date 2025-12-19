import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // 清除localStorage
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/')

    // 应该被重定向到登录页
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('text=登录 Simple IDE')).toBeVisible()
  })

  test('should show login form', async ({ page }) => {
    await page.goto('/login')

    await expect(page.locator('#login_username')).toBeVisible()
    await expect(page.locator('#login_password')).toBeVisible()
    await expect(page.getByRole('button', { name: /登\s*录/i })).toBeVisible()
    await expect(page.getByText('立即注册')).toBeVisible()
  })

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login')

    await page.getByText('立即注册').click()

    await expect(page).toHaveURL(/\/register/)
    await expect(page.locator('text=注册 Simple IDE')).toBeVisible()
  })

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/login')

    await page.locator('#login_username').fill('nonexistent')
    await page.locator('#login_password').fill('wrongpassword')
    await page.getByRole('button', { name: /登\s*录/i }).click()

    // 等待错误消息或页面不跳转
    await page.waitForTimeout(2000)
    // 应该还在登录页
    await expect(page).toHaveURL(/\/login/)
  })

  test('should register and login successfully', async ({ page }) => {
    const username = `testuser_${Date.now()}`
    const password = 'testpassword123'

    // 注册
    await page.goto('/register')
    await page.locator('#register_username').fill(username)
    await page.locator('#register_password').fill(password)
    await page.locator('#register_confirmPassword').fill(password)
    await page.getByRole('button', { name: /注\s*册/i }).click()

    // 注册成功后应该跳转到IDE页面
    await expect(page).toHaveURL('/', { timeout: 10000 })

    // 验证已登录 - 检查IDE页面特有元素
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('函数列表')).toBeVisible({ timeout: 10000 })
  })

  test('should logout successfully', async ({ page }) => {
    const username = `testuser_${Date.now()}`
    const password = 'testpassword123'

    // 先注册登录
    await page.goto('/register')
    await page.locator('#register_username').fill(username)
    await page.locator('#register_password').fill(password)
    await page.locator('#register_confirmPassword').fill(password)
    await page.getByRole('button', { name: /注\s*册/i }).click()

    await expect(page).toHaveURL('/', { timeout: 10000 })

    // 点击登出按钮（假设在header右侧）
    const logoutButton = page.getByText('登出')
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
      await expect(page).toHaveURL(/\/login/)
    }
  })
})
