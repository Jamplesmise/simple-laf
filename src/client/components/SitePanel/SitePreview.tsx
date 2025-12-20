import { useEffect, useRef } from 'react'
import { Button, Space, Segmented, Empty, Tooltip } from 'antd'
import {
  ReloadOutlined,
  DesktopOutlined,
  TabletOutlined,
  MobileOutlined,
  ExpandOutlined,
} from '@ant-design/icons'
import { useSiteStore } from '../../stores/site'

const DEVICE_SIZES = {
  desktop: { width: '100%', maxWidth: '100%' },
  tablet: { width: '768px', maxWidth: '768px' },
  mobile: { width: '375px', maxWidth: '375px' },
}

export default function SitePreview() {
  const { site, previewUrl, previewDevice, setPreviewDevice, refreshPreview } = useSiteStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 初始化预览
  useEffect(() => {
    if (site && !previewUrl) {
      refreshPreview()
    }
  }, [site, previewUrl, refreshPreview])

  // 打开新窗口
  const openInNewWindow = () => {
    if (site) {
      window.open(`/site/${site.userId}/`, '_blank')
    }
  }

  if (!site) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Empty description="加载中..." />
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Empty description="暂无预览" />
      </div>
    )
  }

  const size = DEVICE_SIZES[previewDevice]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 500, fontSize: 13 }}>预览</span>
        <Space size={8}>
          <Segmented
            size="small"
            options={[
              { value: 'desktop', icon: <DesktopOutlined /> },
              { value: 'tablet', icon: <TabletOutlined /> },
              { value: 'mobile', icon: <MobileOutlined /> },
            ]}
            value={previewDevice}
            onChange={(v) => setPreviewDevice(v as 'desktop' | 'tablet' | 'mobile')}
          />
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
          background: '#f5f5f5',
          overflow: 'auto',
        }}
      >
        <iframe
          ref={iframeRef}
          src={previewUrl}
          style={{
            width: size.width,
            maxWidth: size.maxWidth,
            height: 'calc(100vh - 200px)',
            minHeight: 400,
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
          title="站点预览"
        />
      </div>
    </div>
  )
}
