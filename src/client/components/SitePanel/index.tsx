import { useEffect, useState, useCallback, useMemo } from 'react'
import { Layout, Button, Space, Tooltip, message, Upload, FloatButton } from 'antd'
import {
  UploadOutlined,
  RobotOutlined,
  ReloadOutlined,
  DesktopOutlined,
  TabletOutlined,
  MobileOutlined,
  ExpandOutlined,
  FileAddOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useSiteStore } from '../../stores/site'
import { useThemeStore } from '../../stores/theme'
import SiteFileTree from './SiteFileTree'
import { AIConversationDialog } from '../AIConversationDialog'
import type { SiteFile } from '../../api/site'

const { Sider, Content } = Layout

const DEVICE_SIZES = {
  desktop: { width: '100%', label: '桌面' },
  tablet: { width: 768, label: '平板' },
  mobile: { width: 375, label: '手机' },
}

export default function SitePanel() {
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [previewPath, setPreviewPath] = useState('/') // 当前预览的路径

  const { mode: themeMode } = useThemeStore()
  const isDark = themeMode === 'dark'

  const {
    site,
    files,
    fetchSite,
    fetchFiles,
    fetchStats,
    uploadFiles,
    createFile,
  } = useSiteStore()

  // 初始化加载
  useEffect(() => {
    fetchSite()
    fetchFiles()
    fetchStats()
  }, [fetchSite, fetchFiles, fetchStats])

  // 上传文件
  const handleUpload = async (file: File) => {
    try {
      await uploadFiles('/', [file])
      message.success('上传成功')
      refreshPreview()
    } catch (error) {
      const err = error as Error
      message.error(err.message || '上传失败')
    }
    return false
  }

  // 刷新预览
  const refreshPreview = useCallback(() => {
    setPreviewKey(prev => prev + 1)
  }, [])

  // 在新窗口打开
  const openInNewWindow = useCallback(() => {
    if (site) {
      window.open(`/site/${site.userId}${previewPath}`, '_blank')
    }
  }, [site, previewPath])

  // 处理文件选择 - 切换预览
  const handleFileSelect = useCallback((file: SiteFile) => {
    if (file.isDirectory) return

    // 只有 HTML 文件才切换预览
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'html' || ext === 'htm') {
      setPreviewPath(file.path)
      setPreviewKey(prev => prev + 1)
    }
  }, [])

  // 返回首页预览
  const goToHome = useCallback(() => {
    setPreviewPath('/')
    setPreviewKey(prev => prev + 1)
  }, [])

  // 创建默认首页
  const createDefaultIndex = useCallback(async () => {
    try {
      await createFile('/index.html', `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>我的站点</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 3rem; margin-bottom: 1rem; }
    p { font-size: 1.2rem; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <h1>欢迎来到我的站点</h1>
    <p>使用 AI 建站助手开始创建你的网站</p>
  </div>
</body>
</html>`)
      message.success('已创建默认首页')
      refreshPreview()
    } catch (error) {
      const err = error as Error
      message.error(err.message || '创建失败')
    }
  }, [createFile, refreshPreview])

  // 检查是否有 index.html 或正在预览其他 HTML 文件
  const hasIndexHtml = files.some(f => f.path === '/index.html')
  const isPreviewingHtml = previewPath !== '/' && (previewPath.endsWith('.html') || previewPath.endsWith('.htm'))
  const canPreview = hasIndexHtml || isPreviewingHtml

  // 转换文件列表为站点上下文格式
  const siteContextFiles = useMemo(() => {
    return files.map(f => ({
      path: f.path,
      mimeType: f.mimeType,
      isDirectory: f.isDirectory,
    }))
  }, [files])

  // 获取预览 URL
  const previewUrl = site ? `/site/${site.userId}${previewPath}?t=${previewKey}` : ''

  // 获取预览宽度
  const deviceConfig = DEVICE_SIZES[previewDevice]
  const previewWidth = typeof deviceConfig.width === 'number'
    ? `${deviceConfig.width}px`
    : deviceConfig.width

  return (
    <Layout style={{ height: '100%', background: isDark ? '#141414' : '#fff' }}>
      {/* 左侧: 文件树 */}
      <Sider
        width={240}
        theme={isDark ? 'dark' : 'light'}
        style={{ borderRight: `1px solid ${isDark ? '#303030' : '#e5e7eb'}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: isDark ? '#1f1f1f' : '#fff' }}
      >
        <SiteFileTree onFileSelect={handleFileSelect} />

        {/* 底部上传按钮 */}
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${isDark ? '#303030' : '#e5e7eb'}` }}>
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            multiple
          >
            <Button icon={<UploadOutlined />} size="small" block>
              上传文件
            </Button>
          </Upload>
        </div>
      </Sider>

      {/* 右侧: 预览区 */}
      <Content style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: isDark ? '#000' : '#f5f5f5', position: 'relative' }}>
        {/* 预览工具栏 */}
        <div
          style={{
            padding: '8px 16px',
            borderBottom: `1px solid ${isDark ? '#303030' : '#e5e7eb'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: isDark ? '#1f1f1f' : '#fff',
          }}
        >
          <Space size={8}>
            <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#e5e5e5' : '#333' }}>
              站点预览
            </span>
            {previewPath !== '/' && (
              <>
                <span style={{ color: isDark ? '#888' : '#999', fontSize: 12 }}>
                  {previewPath}
                </span>
                <Tooltip title="返回首页">
                  <Button
                    type="text"
                    size="small"
                    icon={<HomeOutlined />}
                    onClick={goToHome}
                  />
                </Tooltip>
              </>
            )}
          </Space>
          <Space size={8}>
            {/* 设备切换 */}
            <Space.Compact>
              <Tooltip title="桌面">
                <Button
                  type={previewDevice === 'desktop' ? 'primary' : 'default'}
                  size="small"
                  icon={<DesktopOutlined />}
                  onClick={() => setPreviewDevice('desktop')}
                />
              </Tooltip>
              <Tooltip title="平板">
                <Button
                  type={previewDevice === 'tablet' ? 'primary' : 'default'}
                  size="small"
                  icon={<TabletOutlined />}
                  onClick={() => setPreviewDevice('tablet')}
                />
              </Tooltip>
              <Tooltip title="手机">
                <Button
                  type={previewDevice === 'mobile' ? 'primary' : 'default'}
                  size="small"
                  icon={<MobileOutlined />}
                  onClick={() => setPreviewDevice('mobile')}
                />
              </Tooltip>
            </Space.Compact>

            <Tooltip title="刷新预览">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={refreshPreview}
              />
            </Tooltip>
            <Tooltip title="新窗口打开">
              <Button
                type="text"
                size="small"
                icon={<ExpandOutlined />}
                onClick={openInNewWindow}
              />
            </Tooltip>
          </Space>
        </div>

        {/* 预览区域 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: 16,
            overflow: 'auto',
          }}
        >
          {!site ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999',
              }}
            >
              加载中...
            </div>
          ) : !canPreview ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: isDark ? '#aaa' : '#666',
                textAlign: 'center',
                gap: 16,
              }}
            >
              <FileAddOutlined style={{ fontSize: 48, color: '#00a9a6' }} />
              <div>
                <div style={{ fontSize: 16, marginBottom: 8, color: isDark ? '#e5e5e5' : undefined }}>站点还没有首页</div>
                <div style={{ fontSize: 13, color: isDark ? '#888' : '#999', marginBottom: 16 }}>
                  创建 index.html 文件后即可预览
                </div>
              </div>
              <Space>
                <Button
                  type="primary"
                  onClick={createDefaultIndex}
                  style={{ background: '#00a9a6', borderColor: '#00a9a6' }}
                >
                  创建默认首页
                </Button>
                <Button onClick={() => setAiDialogOpen(true)}>
                  用 AI 创建
                </Button>
              </Space>
            </div>
          ) : (
            <div
              style={{
                width: previewWidth,
                height: '100%',
                background: '#fff',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                transition: 'width 0.3s ease',
              }}
            >
              <iframe
                key={previewKey}
                src={previewUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title="站点预览"
              />
            </div>
          )}
        </div>

        {/* 浮动 AI 按钮 */}
        <FloatButton
          icon={<RobotOutlined />}
          type="primary"
          tooltip="AI 建站助手"
          onClick={() => setAiDialogOpen(true)}
          style={{
            right: 24,
            bottom: 24,
            width: 56,
            height: 56,
            boxShadow: '0 4px 12px rgba(0, 169, 166, 0.4)',
          }}
        />
      </Content>

      {/* AI 对话弹窗 - 站点模式 */}
      <AIConversationDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        mode="site"
        siteContext={{
          files: siteContextFiles,
          onContentChange: refreshPreview,
        }}
      />
    </Layout>
  )
}

export { SiteFileTree }
