import { FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('Running global setup...')
  // 可以在这里添加全局设置，比如创建测试数据库等
}

export default globalSetup
