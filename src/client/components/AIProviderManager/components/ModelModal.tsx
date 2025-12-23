import { useState, useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, Switch, message } from 'antd'
import { useThemeStore } from '../../../stores/theme'
import { aiModelApi, type ModelPricing } from '../../../api/aiProvider'
import type { AIModel, ModelFormValues } from '../types'

interface ModelModalProps {
  open: boolean
  providerId: string | null
  model: AIModel | null
  onClose: () => void
  onSuccess: (providerId: string) => void
}

export function ModelModal({ open, providerId, model, onClose, onSuccess }: ModelModalProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const [form] = Form.useForm<ModelFormValues>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      form.setFieldsValue(model ? {
        name: model.name,
        alias: model.alias,
        temperature: model.temperature,
        maxTokens: model.maxTokens,
        contextLimit: model.contextLimit || 128000,
        inputPrice: model.pricing?.inputPricePerMillion,
        outputPrice: model.pricing?.outputPricePerMillion,
        currency: model.pricing?.currency || 'USD',
        supportsThinking: model.supportsThinking || false,
      } : {
        name: '',
        alias: '',
        temperature: 0.7,
        maxTokens: 4096,
        contextLimit: 128000,
        inputPrice: 0,
        outputPrice: 0,
        currency: 'USD',
        supportsThinking: false,
      })
    }
  }, [open, model, form])

  const handleSave = async () => {
    if (!providerId) return

    try {
      const values = await form.validateFields()
      setSaving(true)

      const pricing: ModelPricing | undefined = (values.inputPrice !== undefined || values.outputPrice !== undefined) ? {
        inputPricePerMillion: values.inputPrice || 0,
        outputPricePerMillion: values.outputPrice || 0,
        currency: (values.currency || 'USD') as 'USD' | 'CNY',
      } : undefined

      const data = {
        name: values.name,
        alias: values.alias,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        contextLimit: values.contextLimit,
        pricing,
        supportsThinking: values.supportsThinking || false,
      }

      if (model) {
        await aiModelApi.update(model._id, data)
        message.success('更新成功')
      } else {
        await aiModelApi.create(providerId, data)
        message.success('创建成功')
      }

      onSuccess(providerId)
      onClose()
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={model ? '编辑模型' : '添加模型'}
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      width={500}
      zIndex={1100}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="模型 ID"
          rules={[{ required: true, message: '请输入模型 ID' }]}
        >
          <Input placeholder="如: gpt-4o, claude-3-opus-20240229" />
        </Form.Item>
        <Form.Item
          name="alias"
          label="显示名称"
          rules={[{ required: true, message: '请输入显示名称' }]}
        >
          <Input placeholder="如: GPT-4o, Claude 3 Opus" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="temperature" label="温度" style={{ flex: 1 }}>
            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxTokens" label="输出上限" style={{ flex: 1 }} tooltip="单次生成的最大 Token 数">
            <InputNumber min={1} max={200000} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="contextLimit" label="上下文窗口" tooltip="模型支持的最大上下文长度（如 GPT-4o 为 128K，Claude 3 为 200K）">
          <InputNumber min={1000} max={2000000} step={1000} style={{ width: '100%' }} addonAfter="tokens" />
        </Form.Item>
        <div style={{
          padding: '12px',
          background: isDark ? '#1a1a1a' : '#f5f5f5',
          borderRadius: 6,
          marginBottom: 16
        }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>定价信息 (每百万 Token)</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="inputPrice" label="输入价格" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="outputPrice" label="输出价格" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="currency" label="货币" style={{ width: 100, marginBottom: 0 }}>
              <Select
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'CNY', label: 'CNY' },
                ]}
              />
            </Form.Item>
          </div>
        </div>
        <Form.Item
          name="supportsThinking"
          label="支持深度思考"
          valuePropName="checked"
          tooltip="如 DeepSeek-R1 等支持思考模式的模型，开启后会输出思考过程"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
