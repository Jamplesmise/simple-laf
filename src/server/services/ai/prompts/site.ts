/**
 * 站点托管相关提示词
 */

/**
 * 站点文件操作说明
 */
export const SITE_OPERATIONS = `### 静态站点操作

- \`site_create_file\`: 创建站点文件
  - path (必填): 文件路径。单页面用 "/index.html"；多页面用 "/页面名/index.html"
  - content (必填): 文件内容。HTML 文件应包含完整的 DOCTYPE、head、body
  - description (可选): 文件描述

- \`site_update_file\`: 更新站点文件内容
  - path (必填): 要更新的文件路径
  - content (必填): 新的文件内容
  - description (可选): 修改说明

- \`site_delete_file\`: 删除站点文件
  - path (必填): 要删除的文件路径
  - reason (可选): 删除原因

- \`site_create_folder\`: 创建站点文件夹
  - path (必填): 文件夹路径，如 "/css"、"/js/lib"`

/**
 * 站点文件最佳实践
 */
export const SITE_BEST_PRACTICES = `## 站点文件最佳实践

1. **默认使用单文件 HTML**
   - 将 CSS 放在 \`<style>\` 标签中
   - 将 JS 放在 \`<script>\` 标签中
   - 这样更简单且不会有文件联动问题

2. **如果需要分离文件**
   - 必须先创建文件夹（如 \`/login\`）
   - 然后将相关的 HTML/CSS/JS 都放在该文件夹内
   - 例如：\`/login/index.html\`、\`/login/style.css\`、\`/login/script.js\`

3. **不要将多个页面的文件混在根目录**
   - 每个页面应该有自己的文件夹
   - 根目录只放首页文件 \`/index.html\`

4. **HTML 文件命名**
   - 页面主文件命名为 \`index.html\`
   - 这样访问 \`/login/\` 就能直接显示页面`

/**
 * 单文件 HTML 模板
 */
export const SINGLE_FILE_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题</title>
  <style>
    /* CSS 样式写在这里 */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <!-- HTML 内容写在这里 -->
  <h1>Hello World</h1>

  <script>
    // JavaScript 代码写在这里
    document.addEventListener('DOMContentLoaded', () => {
      console.log('页面加载完成')
    })
  </script>
</body>
</html>`
