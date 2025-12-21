import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, message } from 'antd'
import { aiProviderApi } from '../../../api/aiProvider'
import type { AIProvider, ProviderFormValues } from '../types'
import { providerTypes } from '../types'

interface ProviderModalProps {
  open: boolean
  provider: AIProvider | null
  onClose: () => void
  onSuccess: () => void
}

export function ProviderModal({ open, provider, onClose, onSuccess }: ProviderModalProps) {
  const [form] = Form.useForm<ProviderFormValues>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      form.setFieldsValue(provider || {
        name: '',
        type: 'openai',
        baseUrl: '',
        apiKey: '',
      })
    }
  }, [open, provider, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      if (provider) {
        await aiProviderApi.update(provider._id, values)
        message.success('更新成功')
      } else {
        await aiProviderApi.create(values)
        message.success('创建成功')
      }

      onSuccess()
      onClose()
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={provider ? '编辑供应商' : '添加供应商'}
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      zIndex={1100}
    >
      <Form form={form} layout="vertical" name="provider">
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入供应商名称' }]}
        >
          <Input placeholder="如: OpenAI, 本地 Ollama" />
        </Form.Item>
        <Form.Item
          name="type"
          label="类型"
          rules={[{ required: true }]}
        >
          <Select options={providerTypes} />
        </Form.Item>
        <Form.Item
          name="baseUrl"
          label="API 地址"
          rules={[{ required: true, message: '请输入 API 地址' }]}
        >
          <Input placeholder="如: https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item name="apiKey" label="API Key">
          <Input.Password placeholder="输入新的 API Key (留空则不更新)" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
