#!/usr/bin/env node

/**
 * 敏感信息检查脚本
 * 扫描代码库中可能泄露的敏感信息
 *
 * 使用方法: node scripts/check-secrets.js
 */

const fs = require('fs')
const path = require('path')

// 敏感信息匹配规则
const PATTERNS = [
  // API Keys
  { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{32,}/, severity: 'high' },
  { name: 'Anthropic API Key', pattern: /sk-ant-[a-zA-Z0-9-]{32,}/, severity: 'high' },
  { name: 'Generic API Key', pattern: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/, severity: 'medium' },

  // AWS
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'high' },
  { name: 'AWS Secret Key', pattern: /aws[_-]?secret[_-]?key\s*[:=]\s*['"][a-zA-Z0-9\/+=]{40}['"]/, severity: 'high' },

  // MongoDB
  { name: 'MongoDB Connection String', pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\/]+/, severity: 'high' },

  // JWT/Tokens
  { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, severity: 'medium' },
  { name: 'Bearer Token', pattern: /bearer\s+[a-zA-Z0-9_-]{20,}/i, severity: 'medium' },

  // Passwords
  { name: 'Password in URL', pattern: /:\/\/[^:]+:[^@]{8,}@/, severity: 'high' },
  { name: 'Hardcoded Password', pattern: /password\s*[:=]\s*['"][^'"]{8,}['"]/, severity: 'high' },

  // Private Keys
  { name: 'Private Key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, severity: 'critical' },
  { name: 'SSH Private Key', pattern: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/, severity: 'critical' },

  // S3/MinIO
  { name: 'S3 Secret Key', pattern: /s3[_-]?secret[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/, severity: 'high' },

  // Generic Secrets
  { name: 'Secret Variable', pattern: /secret\s*[:=]\s*['"][a-zA-Z0-9!@#$%^&*]{12,}['"]/, severity: 'medium' },

  // IP Addresses (internal)
  { name: 'Internal IP', pattern: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/, severity: 'low' },

  // Email (可能是个人邮箱)
  { name: 'Personal Email', pattern: /[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|qq|163)\.[a-z]{2,}/, severity: 'low' },
]

// 忽略的文件/目录
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',           // 测试覆盖率报告
  'public',             // 构建产物
  'playwright-report',
  'test-results',
  '.env.example',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '*.woff',
  '*.woff2',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.svg',
  '*.bundle.js',        // 打包文件
  '*.min.js',
  '*.map',
  'check-secrets.js',   // 忽略自身
  '.test.ts',           // 测试文件
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
]

// 忽略的特定行 (误报白名单)
const WHITELIST = [
  'sk-xxx',           // 示例占位符
  'your-secret',
  'change-this',
  'example.com',
  'localhost',
  '127.0.0.1',
  'mongodb://localhost',
  'mongodb://mongo:27017',
  'password123',      // 测试密码
  'testpassword',
  'correctpass',
  'wrongpass',
  'password456',
  'newpassword',
  'http://www.apache.org',  // License URLs
  'https://www.apache.org',
  'http://json-schema.org',
  'https://developer.mozilla.org',
]

function shouldIgnore(filePath) {
  const fileName = path.basename(filePath)
  return IGNORE_PATTERNS.some(pattern => {
    if (pattern.startsWith('*.')) {
      // 文件扩展名匹配
      return filePath.endsWith(pattern.slice(1))
    }
    if (pattern.startsWith('.')) {
      // 文件名后缀匹配 (如 .test.ts)
      return fileName.includes(pattern)
    }
    // 路径包含匹配
    return filePath.includes(pattern)
  })
}

function isWhitelisted(line) {
  const lowerLine = line.toLowerCase()
  return WHITELIST.some(w => lowerLine.includes(w.toLowerCase()))
}

function scanFile(filePath) {
  const findings = []

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // 跳过白名单
      if (isWhitelisted(line)) return

      PATTERNS.forEach(({ name, pattern, severity }) => {
        if (pattern.test(line)) {
          findings.push({
            file: filePath,
            line: index + 1,
            rule: name,
            severity,
            content: line.trim().substring(0, 100) + (line.length > 100 ? '...' : ''),
          })
        }
      })
    })
  } catch (err) {
    // 跳过二进制文件等
  }

  return findings
}

function scanDirectory(dir, findings = []) {
  const items = fs.readdirSync(dir)

  for (const item of items) {
    const fullPath = path.join(dir, item)

    if (shouldIgnore(fullPath)) continue

    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      scanDirectory(fullPath, findings)
    } else if (stat.isFile()) {
      const fileFindings = scanFile(fullPath)
      findings.push(...fileFindings)
    }
  }

  return findings
}

function formatSeverity(severity) {
  const colors = {
    critical: '\x1b[31m', // red
    high: '\x1b[91m',     // light red
    medium: '\x1b[33m',   // yellow
    low: '\x1b[36m',      // cyan
  }
  const reset = '\x1b[0m'
  return `${colors[severity] || ''}${severity.toUpperCase()}${reset}`
}

function main() {
  console.log('🔍 扫描敏感信息...\n')

  const rootDir = process.argv[2] || '.'
  const findings = scanDirectory(rootDir)

  if (findings.length === 0) {
    console.log('✅ 未发现敏感信息泄露风险\n')
    process.exit(0)
  }

  // 按严重程度排序
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  console.log(`⚠️  发现 ${findings.length} 个潜在问题:\n`)

  findings.forEach(({ file, line, rule, severity, content }) => {
    console.log(`${formatSeverity(severity)} ${rule}`)
    console.log(`   📄 ${file}:${line}`)
    console.log(`   📝 ${content}`)
    console.log()
  })

  // 统计
  const stats = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1
    return acc
  }, {})

  console.log('📊 统计:')
  Object.entries(stats).forEach(([severity, count]) => {
    console.log(`   ${formatSeverity(severity)}: ${count}`)
  })

  // 如果有 critical 或 high，返回非零退出码
  if (stats.critical || stats.high) {
    console.log('\n❌ 发现高危敏感信息，请处理后再提交!')
    process.exit(1)
  }

  console.log('\n⚠️  请检查以上低风险项是否为误报')
  process.exit(0)
}

main()
