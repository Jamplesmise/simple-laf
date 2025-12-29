# 站点 HTML 模板最佳实践

> AI 助手生成 HTML 文件时的参考模板和资源引用规范

---

## 📋 目录

1. [单文件 HTML 模板](#单文件-html-模板)
2. [分离文件模板](#分离文件模板)
3. [资源引用规则](#资源引用规则)
4. [云函数调用示例](#云函数调用示例)
5. [常见场景](#常见场景)

---

## 单文件 HTML 模板

**适用场景**：简单页面、快速原型、独立页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题</title>
  <style>
    /* === 全局样式 === */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    /* === 组件样式 === */
    .header {
      background: #059669;
      color: white;
      padding: 1rem 0;
      text-align: center;
    }

    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    button {
      background: #059669;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    button:hover {
      background: #047857;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>欢迎使用 Simple IDE</h1>
  </div>

  <div class="container">
    <div class="card">
      <h2>功能展示</h2>
      <p>这是一个单文件 HTML 示例</p>
      <button onclick="handleClick()">点击测试</button>
      <div id="result"></div>
    </div>
  </div>

  <script>
    // === 工具函数 ===
    function showMessage(message) {
      const result = document.getElementById('result')
      result.textContent = message
      result.style.marginTop = '10px'
      result.style.color = '#059669'
    }

    // === 事件处理 ===
    function handleClick() {
      showMessage('按钮被点击了！')

      // 调用云函数
      fetchData()
    }

    // === API 调用 ===
    async function fetchData() {
      try {
        // ✅ 正确：使用 /invoke/ 前缀调用云函数
        const response = await fetch('/invoke/hello')
        const data = await response.json()
        console.log('云函数返回:', data)
      } catch (error) {
        console.error('请求失败:', error)
      }
    }

    // === 页面加载 ===
    document.addEventListener('DOMContentLoaded', () => {
      console.log('页面已加载')
    })
  </script>
</body>
</html>
```

---

## 分离文件模板

**适用场景**：复杂页面、多页面应用、团队协作

### 文件结构

```
/login/
├── index.html      # 主页面
├── css/
│   ├── common.css  # 通用样式
│   └── login.css   # 登录页样式
├── js/
│   ├── utils.js    # 工具函数
│   └── login.js    # 登录逻辑
└── images/
    └── logo.png
```

### index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>用户登录</title>

  <!-- ✅ 相对路径引用 CSS -->
  <link rel="stylesheet" href="css/common.css">
  <link rel="stylesheet" href="css/login.css">
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <!-- ✅ 相对路径引用图片 -->
      <img src="images/logo.png" alt="Logo" class="logo">

      <h1>登录</h1>
      <form id="loginForm">
        <input type="text" id="username" placeholder="用户名" required>
        <input type="password" id="password" placeholder="密码" required>
        <button type="submit">登录</button>
      </form>
      <div id="message"></div>
    </div>
  </div>

  <!-- ✅ 相对路径引用 JS，按依赖顺序加载 -->
  <script src="js/utils.js"></script>
  <script src="js/login.js"></script>
</body>
</html>
```

### css/common.css

```css
/* 通用样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

/* 工具类 */
.text-center { text-align: center; }
.mt-2 { margin-top: 20px; }
.p-2 { padding: 20px; }
```

### css/login.css

```css
/* 登录页专属样式 */
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.logo {
  width: 80px;
  height: 80px;
  display: block;
  margin: 0 auto 20px;
}

form input {
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

form button {
  width: 100%;
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
}

form button:hover {
  background: #5568d3;
}
```

### js/utils.js

```javascript
// 工具函数库
const utils = {
  // 显示消息
  showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId)
    element.textContent = message
    element.className = `message message-${type}`
    element.style.display = 'block'
  },

  // 隐藏消息
  hideMessage(elementId) {
    const element = document.getElementById(elementId)
    element.style.display = 'none'
  },

  // 验证表单
  validateForm(formData) {
    if (!formData.username || !formData.password) {
      return { valid: false, message: '请填写所有字段' }
    }
    if (formData.password.length < 6) {
      return { valid: false, message: '密码至少6位' }
    }
    return { valid: true }
  }
}
```

### js/login.js

```javascript
// 登录页逻辑
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const formData = {
    username: document.getElementById('username').value,
    password: document.getElementById('password').value
  }

  // 表单验证
  const validation = utils.validateForm(formData)
  if (!validation.valid) {
    utils.showMessage('message', validation.message, 'error')
    return
  }

  try {
    utils.showMessage('message', '登录中...', 'info')

    // ✅ 调用云函数 - 使用 /invoke/ 前缀
    const response = await fetch('/invoke/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })

    const result = await response.json()

    if (result.success) {
      utils.showMessage('message', '登录成功！', 'success')

      // 保存 token
      localStorage.setItem('token', result.data.token)

      // 跳转到首页（使用相对路径）
      setTimeout(() => {
        window.location.href = '../dashboard/'
      }, 1000)
    } else {
      utils.showMessage('message', result.error.message, 'error')
    }
  } catch (error) {
    utils.showMessage('message', '网络错误，请重试', 'error')
    console.error('登录失败:', error)
  }
})
```

---

## 资源引用规则

### ✅ 正确示例

```html
<!-- 1. 站点内部资源 - 相对路径 -->
<link rel="stylesheet" href="css/style.css">
<script src="js/app.js"></script>
<img src="images/logo.png" alt="Logo">
<a href="about.html">关于我们</a>

<!-- 2. 云函数调用 - /invoke/ 前缀 -->
<script>
  fetch('/invoke/getUserData')
  fetch('/invoke/api/users/123')
  fetch('/invoke/auth/login', { method: 'POST', ... })
</script>

<!-- 3. 跨页面导航 - 相对路径 -->
<a href="../dashboard/">返回首页</a>
<a href="profile/">个人资料</a>
```

### ❌ 错误示例

```html
<!-- ❌ 错误：硬编码完整URL -->
<link rel="stylesheet" href="http://localhost:3000/site/abc123/css/style.css">

<!-- ❌ 错误：使用绝对路径引用站点资源 -->
<script src="/site/abc123/js/app.js"></script>

<!-- ❌ 错误：云函数调用缺少 /invoke/ 前缀 -->
<script>
  fetch('/getUserData')  // 应该是 /invoke/getUserData
</script>

<!-- ❌ 错误：混用绝对和相对路径 -->
<img src="/images/logo.png">  <!-- 应该是 images/logo.png -->
```

---

## 云函数调用示例

### GET 请求

```javascript
// 获取数据
async function fetchData() {
  try {
    const response = await fetch('/invoke/getData')
    const result = await response.json()

    if (result.success) {
      console.log('数据:', result.data)
    }
  } catch (error) {
    console.error('请求失败:', error)
  }
}

// 带查询参数
async function getUserById(id) {
  const response = await fetch(`/invoke/getUser?id=${id}`)
  return response.json()
}
```

### POST 请求

```javascript
async function createUser(userData) {
  try {
    const response = await fetch('/invoke/createUser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('创建失败:', error)
  }
}
```

### 带认证的请求

```javascript
async function fetchProtectedData() {
  const token = localStorage.getItem('token')

  const response = await fetch('/invoke/protectedData', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  return response.json()
}
```

---

## 常见场景

### 场景1：单页应用 (SPA)

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>SPA 应用</title>
  <style>
    /* 样式省略 */
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    // 简单的路由
    const routes = {
      '/': () => '<h1>首页</h1>',
      '/about': () => '<h1>关于</h1>',
      '/contact': () => '<h1>联系我们</h1>'
    }

    function navigate(path) {
      const app = document.getElementById('app')
      const render = routes[path] || routes['/']
      app.innerHTML = render()

      // 更新 URL（不刷新页面）
      history.pushState({}, '', path)
    }

    // 监听浏览器后退/前进
    window.addEventListener('popstate', () => {
      navigate(location.pathname)
    })

    // 初始渲染
    navigate(location.pathname)
  </script>
</body>
</html>
```

### 场景2：表单提交

```html
<form id="contactForm">
  <input type="text" name="name" placeholder="姓名" required>
  <input type="email" name="email" placeholder="邮箱" required>
  <textarea name="message" placeholder="留言" required></textarea>
  <button type="submit">提交</button>
</form>

<script>
  document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault()

    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData)

    const response = await fetch('/invoke/submitContact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    const result = await response.json()
    alert(result.success ? '提交成功！' : '提交失败')
  })
</script>
```

### 场景3：实时数据更新

```javascript
// 轮询更新
function startPolling() {
  setInterval(async () => {
    const response = await fetch('/invoke/getLatestData')
    const data = await response.json()
    updateUI(data)
  }, 5000) // 每5秒更新一次
}

function updateUI(data) {
  document.getElementById('dataContainer').innerHTML =
    `<p>最新数据: ${data.value}</p>`
}

startPolling()
```

---

## 最佳实践总结

### ✅ DO（推荐做法）

1. **单文件优先** - 简单页面使用单文件 HTML
2. **相对路径** - 站点内资源统一使用相对路径
3. **/invoke/ 前缀** - 所有云函数调用使用 `/invoke/` 前缀
4. **语义化标签** - 使用 `<header>`, `<nav>`, `<main>`, `<footer>`
5. **响应式设计** - 添加 viewport meta 标签
6. **错误处理** - API 调用添加 try-catch
7. **加载状态** - 显示加载中、成功、失败状态

### ❌ DON'T（避免做法）

1. ❌ 硬编码完整 URL
2. ❌ 直接调用函数名（不加 /invoke/）
3. ❌ 使用绝对路径引用站点资源
4. ❌ 忽略错误处理
5. ❌ 内联样式过多（应使用 `<style>` 或外部 CSS）
6. ❌ 全局变量污染
7. ❌ 忘记添加 charset 和 viewport

---

## 附录：常用代码片段

### 加载状态管理

```javascript
function setLoading(isLoading) {
  const button = document.querySelector('button[type="submit"]')
  button.disabled = isLoading
  button.textContent = isLoading ? '提交中...' : '提交'
}
```

### Toast 消息提示

```javascript
function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => toast.remove(), 3000)
}
```

### 本地存储封装

```javascript
const storage = {
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  },
  get(key) {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : null
  },
  remove(key) {
    localStorage.removeItem(key)
  }
}
```

---

**文档版本**: 1.0
**更新日期**: 2025-01-XX
**维护者**: Simple IDE Team
