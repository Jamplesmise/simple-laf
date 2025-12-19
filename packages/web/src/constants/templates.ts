export interface FunctionTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'basic' | 'http' | 'data' | 'util'
  code: string
}

export const FUNCTION_TEMPLATES: FunctionTemplate[] = [
  {
    id: 'empty',
    name: '空白函数',
    description: '最简单的函数模板，从零开始',
    icon: 'FileOutlined',
    category: 'basic',
    code: `import cloud from '@simple-ide/cloud'

export default async function (ctx: FunctionContext) {
  const { body, query } = ctx

  // 在这里编写你的业务逻辑

  return {
    message: 'Hello, World!'
  }
}
`,
  },
  {
    id: 'hello',
    name: 'Hello World',
    description: '带参数处理的示例函数',
    icon: 'SmileOutlined',
    category: 'basic',
    code: `import cloud from '@simple-ide/cloud'

export default async function (ctx: FunctionContext) {
  const { body, query } = ctx
  const name = body.name || query.name || 'World'

  console.log(\`收到请求，参数: name=\${name}\`)

  return {
    message: \`Hello, \${name}!\`,
    timestamp: new Date().toISOString()
  }
}
`,
  },
  {
    id: 'restful',
    name: 'RESTful API',
    description: '支持 GET/POST/PUT/DELETE 的 RESTful 接口',
    icon: 'ApiOutlined',
    category: 'http',
    code: `import cloud from '@simple-ide/cloud'

export default async function (ctx: FunctionContext) {
  const { body, query, method } = ctx

  switch (method) {
    case 'GET':
      // 获取资源
      const id = query.id
      return {
        success: true,
        data: { id, name: '示例数据' }
      }

    case 'POST':
      // 创建资源
      console.log('创建数据:', body)
      return {
        success: true,
        message: '创建成功',
        data: { id: Date.now(), ...body }
      }

    case 'PUT':
      // 更新资源
      console.log('更新数据:', body)
      return {
        success: true,
        message: '更新成功'
      }

    case 'DELETE':
      // 删除资源
      console.log('删除数据:', query.id)
      return {
        success: true,
        message: '删除成功'
      }

    default:
      return {
        success: false,
        error: '不支持的请求方法'
      }
  }
}
`,
  },
  {
    id: 'http-request',
    name: 'HTTP 请求',
    description: '调用外部 API 的示例',
    icon: 'CloudOutlined',
    category: 'http',
    code: `import cloud from '@simple-ide/cloud'
import axios from 'axios'

export default async function (ctx: FunctionContext) {
  const { body } = ctx
  const url = body.url || 'https://api.github.com'

  try {
    console.log(\`请求外部 API: \${url}\`)

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Simple-IDE-Function'
      }
    })

    return {
      success: true,
      status: response.status,
      data: response.data
    }
  } catch (error) {
    const err = error as Error
    console.error('请求失败:', err.message)

    return {
      success: false,
      error: err.message
    }
  }
}
`,
  },
  {
    id: 'json-process',
    name: 'JSON 数据处理',
    description: '处理和转换 JSON 数据',
    icon: 'FileTextOutlined',
    category: 'data',
    code: `import cloud from '@simple-ide/cloud'
import _ from 'lodash'

export default async function (ctx: FunctionContext) {
  const { body } = ctx
  const data = body.data || []

  // 数据过滤
  const filtered = _.filter(data, (item: any) => item.active !== false)

  // 数据转换
  const transformed = _.map(filtered, (item: any) => ({
    ...item,
    processedAt: new Date().toISOString()
  }))

  // 数据分组
  const grouped = _.groupBy(transformed, 'category')

  // 统计信息
  const stats = {
    total: data.length,
    filtered: filtered.length,
    categories: Object.keys(grouped).length
  }

  console.log('处理统计:', stats)

  return {
    success: true,
    stats,
    data: transformed
  }
}
`,
  },
  {
    id: 'validator',
    name: '参数验证',
    description: '带参数验证的函数模板',
    icon: 'SafetyOutlined',
    category: 'util',
    code: `import cloud from '@simple-ide/cloud'

// 简单的验证函数
function validate(data: any, rules: Record<string, string[]>) {
  const errors: string[] = []

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field]

    for (const rule of fieldRules) {
      if (rule === 'required' && (value === undefined || value === '')) {
        errors.push(\`\${field} 是必填项\`)
      }
      if (rule === 'email' && value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
        errors.push(\`\${field} 格式不正确\`)
      }
      if (rule.startsWith('min:')) {
        const min = parseInt(rule.split(':')[1])
        if (typeof value === 'string' && value.length < min) {
          errors.push(\`\${field} 最少 \${min} 个字符\`)
        }
      }
      if (rule.startsWith('max:')) {
        const max = parseInt(rule.split(':')[1])
        if (typeof value === 'string' && value.length > max) {
          errors.push(\`\${field} 最多 \${max} 个字符\`)
        }
      }
    }
  }

  return errors
}

export default async function (ctx: FunctionContext) {
  const { body } = ctx

  // 定义验证规则
  const rules = {
    username: ['required', 'min:3', 'max:20'],
    email: ['required', 'email'],
    password: ['required', 'min:6']
  }

  // 执行验证
  const errors = validate(body, rules)

  if (errors.length > 0) {
    return {
      success: false,
      errors
    }
  }

  // 验证通过，处理业务逻辑
  console.log('验证通过:', body.username)

  return {
    success: true,
    message: '验证通过',
    data: {
      username: body.username,
      email: body.email
    }
  }
}
`,
  },
  {
    id: 'scheduler-task',
    name: '定时任务',
    description: '适用于定时执行器的任务函数',
    icon: 'ClockCircleOutlined',
    category: 'util',
    code: `import cloud from '@simple-ide/cloud'

export default async function (ctx: FunctionContext) {
  const { body } = ctx
  const isScheduled = body._scheduler === true

  console.log(\`任务开始执行, 触发方式: \${isScheduled ? '定时任务' : '手动调用'}\`)
  console.log(\`执行时间: \${new Date().toLocaleString('zh-CN')}\`)

  try {
    // 在这里编写定时任务逻辑
    // 例如：数据清理、报表生成、消息推送等

    // 模拟任务执行
    const result = {
      taskName: '示例定时任务',
      executedAt: new Date().toISOString(),
      processedItems: Math.floor(Math.random() * 100),
      duration: Math.floor(Math.random() * 1000) + 'ms'
    }

    console.log('任务执行完成:', result)

    return {
      success: true,
      ...result
    }
  } catch (error) {
    const err = error as Error
    console.error('任务执行失败:', err.message)

    return {
      success: false,
      error: err.message
    }
  }
}
`,
  },
  {
    id: 'env-config',
    name: '环境变量',
    description: '使用环境变量的示例',
    icon: 'SettingOutlined',
    category: 'util',
    code: `import cloud from '@simple-ide/cloud'

export default async function (ctx: FunctionContext) {
  // 通过 cloud.env 访问环境变量
  const apiKey = cloud.env.API_KEY
  const dbUrl = cloud.env.DATABASE_URL
  const appName = cloud.env.APP_NAME || 'Simple IDE'

  console.log(\`应用名称: \${appName}\`)
  console.log(\`API Key 已配置: \${apiKey ? '是' : '否'}\`)
  console.log(\`数据库 URL 已配置: \${dbUrl ? '是' : '否'}\`)

  // 检查必需的环境变量
  const missingVars: string[] = []
  if (!apiKey) missingVars.push('API_KEY')
  if (!dbUrl) missingVars.push('DATABASE_URL')

  if (missingVars.length > 0) {
    return {
      success: false,
      error: \`缺少环境变量: \${missingVars.join(', ')}\`,
      hint: '请在环境变量设置中配置这些变量'
    }
  }

  // 使用环境变量进行业务逻辑
  return {
    success: true,
    message: '环境变量配置正确',
    config: {
      appName,
      hasApiKey: true,
      hasDbUrl: true
    }
  }
}
`,
  },
  {
    id: 'date-util',
    name: '日期处理',
    description: '使用 dayjs 处理日期时间',
    icon: 'CalendarOutlined',
    category: 'util',
    code: `import cloud from '@simple-ide/cloud'
import dayjs from 'dayjs'

export default async function (ctx: FunctionContext) {
  const { body, query } = ctx
  const inputDate = body.date || query.date

  const now = dayjs()
  const date = inputDate ? dayjs(inputDate) : now

  // 日期格式化
  const formats = {
    iso: date.toISOString(),
    date: date.format('YYYY-MM-DD'),
    time: date.format('HH:mm:ss'),
    full: date.format('YYYY年MM月DD日 HH:mm:ss'),
    relative: date.fromNow ? date.fromNow() : '需要 relativeTime 插件'
  }

  // 日期计算
  const calculations = {
    tomorrow: now.add(1, 'day').format('YYYY-MM-DD'),
    nextWeek: now.add(1, 'week').format('YYYY-MM-DD'),
    nextMonth: now.add(1, 'month').format('YYYY-MM-DD'),
    startOfMonth: now.startOf('month').format('YYYY-MM-DD'),
    endOfMonth: now.endOf('month').format('YYYY-MM-DD')
  }

  // 日期比较
  const comparisons = {
    isToday: date.isSame(now, 'day'),
    isPast: date.isBefore(now),
    isFuture: date.isAfter(now),
    daysFromNow: date.diff(now, 'day')
  }

  console.log('当前时间:', formats.full)

  return {
    success: true,
    input: inputDate || '当前时间',
    formats,
    calculations,
    comparisons
  }
}
`,
  },
]

// 按分类分组
export const TEMPLATE_CATEGORIES = {
  basic: { name: '基础', icon: 'AppstoreOutlined' },
  http: { name: 'HTTP', icon: 'GlobalOutlined' },
  data: { name: '数据处理', icon: 'DatabaseOutlined' },
  util: { name: '工具', icon: 'ToolOutlined' },
}

// 获取分类后的模板
export function getTemplatesByCategory() {
  const result: Record<string, FunctionTemplate[]> = {}

  for (const template of FUNCTION_TEMPLATES) {
    if (!result[template.category]) {
      result[template.category] = []
    }
    result[template.category].push(template)
  }

  return result
}
