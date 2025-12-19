import { useState } from 'react'
import { Button, message, Input, Space, Tooltip } from 'antd'
import { SendOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import { useFunctionStore } from '../stores/function'
import PublishModal from './PublishModal'

export default function PublishButton() {
  const { current, setLastPublishedCode } = useFunctionStore()
  const [copied, setCopied] = useState(false)
  const [publishModalOpen, setPublishModalOpen] = useState(false)

  if (!current) return null

  const publicUrl = `${window.location.origin}/${current.path || current.name}`

  const handlePublished = (version: number) => {
    message.success(`发版成功，版本 v${version}`)
    // 发布成功后，更新 lastPublishedCode 以清除红点标记
    // setLastPublishedCode 会从 store 当前状态获取代码，避免闭包问题
    if (current) {
      setLastPublishedCode(current._id)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    message.success('已复制到剪贴板')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Space>
        <Input
          value={publicUrl}
          readOnly
          style={{ width: 240 }}
          addonAfter={
            <Tooltip title="复制链接">
              {copied ? (
                <CheckOutlined style={{ color: '#52c41a', cursor: 'pointer' }} />
              ) : (
                <CopyOutlined
                  style={{ cursor: 'pointer' }}
                  onClick={handleCopy}
                />
              )}
            </Tooltip>
          }
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => setPublishModalOpen(true)}
        >
          发版
        </Button>
      </Space>

      <PublishModal
        open={publishModalOpen}
        functionId={current._id}
        functionName={current.name}
        currentCode={current.code}
        onClose={() => setPublishModalOpen(false)}
        onPublished={handlePublished}
      />
    </>
  )
}
