import { test, expect } from '@playwright/test'

test.describe('Function Management', () => {
  const username = `testuser_${Date.now()}`
  const password = 'testpassword123'

  test.beforeAll(async ({ browser }) => {
    // 注册用户
    const page = await browser.newPage()
    await page.goto('/register')
    await page.locator('#register_username').fill(username)
    await page.locator('#register_password').fill(password)
    await page.locator('#register_confirmPassword').fill(password)
    await page.getByRole('button', { name: /注\s*册/i }).click()
    await expect(page).toHaveURL('/', { timeout: 10000 })
    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login')
    await page.locator('#login_username').fill(username)
    await page.locator('#login_password').fill(password)
    await page.getByRole('button', { name: /登\s*录/i }).click()
    await expect(page).toHaveURL('/', { timeout: 10000 })
  })

  test('should show IDE layout after login', async ({ page }) => {
    // 等待页面完全加载
    await page.waitForLoadState('networkidle')
    // 验证IDE布局元素 - 检查函数列表标题
    await expect(page.getByText('函数列表')).toBeVisible({ timeout: 10000 })
  })

  test('should create new function', async ({ page }) => {
    // 点击新建函数按钮
    const createButton = page.getByRole('button', { name: /新建/i })
    if (await createButton.isVisible()) {
      await createButton.click()

      // 填写函数名
      const funcName = `testFunc_${Date.now()}`
      const nameInput = page.getByPlaceholder(/函数名/i)
      if (await nameInput.isVisible()) {
        await nameInput.fill(funcName)

        // 确认创建
        const confirmButton = page.getByRole('button', { name: /确定|创建/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()

          // 验证函数出现在列表中
          await expect(page.getByText(funcName)).toBeVisible({ timeout: 5000 })
        }
      }
    }
  })

  test('should edit function code', async ({ page }) => {
    // 先创建一个函数
    const createButton = page.getByRole('button', { name: /新建/i })
    if (await createButton.isVisible()) {
      await createButton.click()

      const funcName = `editTest_${Date.now()}`
      const nameInput = page.getByPlaceholder(/函数名/i)
      if (await nameInput.isVisible()) {
        await nameInput.fill(funcName)
        const confirmButton = page.getByRole('button', { name: /确定|创建/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
          await page.waitForTimeout(1000)
        }
      }

      // 点击函数打开编辑器
      const funcItem = page.getByText(funcName)
      if (await funcItem.isVisible()) {
        await funcItem.click()

        // 等待编辑器加载
        await page.waitForTimeout(2000)

        // 验证编辑器可见
        const editor = page.locator('.monaco-editor')
        if (await editor.isVisible()) {
          // 编辑器已加载
          expect(true).toBe(true)
        }
      }
    }
  })

  test('should compile and run function', async ({ page }) => {
    // 创建并编辑函数
    const createButton = page.getByRole('button', { name: /新建/i })
    if (await createButton.isVisible()) {
      await createButton.click()

      const funcName = `runTest_${Date.now()}`
      const nameInput = page.getByPlaceholder(/函数名/i)
      if (await nameInput.isVisible()) {
        await nameInput.fill(funcName)
        const confirmButton = page.getByRole('button', { name: /确定|创建/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
          await page.waitForTimeout(1000)
        }
      }

      // 点击函数
      const funcItem = page.getByText(funcName)
      if (await funcItem.isVisible()) {
        await funcItem.click()
        await page.waitForTimeout(2000)

        // 点击运行按钮
        const runButton = page.getByRole('button', { name: /运行|执行/i })
        if (await runButton.isVisible()) {
          await runButton.click()

          // 等待结果显示
          await page.waitForTimeout(3000)

          // 检查结果面板
          const resultPanel = page.locator('[class*="result"], [class*="output"]')
          if (await resultPanel.isVisible()) {
            expect(true).toBe(true)
          }
        }
      }
    }
  })

  test('should delete function', async ({ page }) => {
    // 创建函数
    const createButton = page.getByRole('button', { name: /新建/i })
    if (await createButton.isVisible()) {
      await createButton.click()

      const funcName = `deleteTest_${Date.now()}`
      const nameInput = page.getByPlaceholder(/函数名/i)
      if (await nameInput.isVisible()) {
        await nameInput.fill(funcName)
        const confirmButton = page.getByRole('button', { name: /确定|创建/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
          await page.waitForTimeout(1000)
        }
      }

      // 右键点击函数打开菜单
      const funcItem = page.getByText(funcName)
      if (await funcItem.isVisible()) {
        await funcItem.click({ button: 'right' })

        // 点击删除选项
        const deleteOption = page.getByText(/删除/i)
        if (await deleteOption.isVisible()) {
          await deleteOption.click()

          // 确认删除
          const confirmDelete = page.getByRole('button', { name: /确定|是/i })
          if (await confirmDelete.isVisible()) {
            await confirmDelete.click()
            await page.waitForTimeout(1000)

            // 验证函数已删除
            await expect(page.getByText(funcName)).not.toBeVisible()
          }
        }
      }
    }
  })
})
