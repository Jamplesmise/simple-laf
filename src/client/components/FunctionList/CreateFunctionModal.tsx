import { Modal, Form, Input, Select, Radio, Card } from 'antd'
import {
  FileOutlined,
  SmileOutlined,
  ApiOutlined,
  CloudOutlined,
  FileTextOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  CalendarOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { FUNCTION_TEMPLATES, TEMPLATE_CATEGORIES } from '../../constants/templates'
import type { HttpMethod } from '../../stores/function'

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

const iconMap: Record<string, React.ReactNode> = {
  FileOutlined: <FileOutlined />,
  SmileOutlined: <SmileOutlined />,
  ApiOutlined: <ApiOutlined />,
  CloudOutlined: <CloudOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  SafetyOutlined: <SafetyOutlined />,
  ClockCircleOutlined: <ClockCircleOutlined />,
  SettingOutlined: <SettingOutlined />,
  CalendarOutlined: <CalendarOutlined />,
  ToolOutlined: <ToolOutlined />,
}

interface CreateFunctionModalProps {
  open: boolean
  creating: boolean
  isDark: boolean
  newFunctionName: string
  newFunctionMethods: HttpMethod[]
  newFunctionDesc: string
  newFunctionTags: string[]
  selectedTemplate: string
  templateCategory: string
  onNameChange: (name: string) => void
  onMethodsChange: (methods: HttpMethod[]) => void
  onDescChange: (desc: string) => void
  onTagsChange: (tags: string[]) => void
  onTemplateChange: (templateId: string) => void
  onCategoryChange: (category: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function CreateFunctionModal({
  open,
  creating,
  isDark,
  newFunctionName,
  newFunctionMethods,
  newFunctionDesc,
  newFunctionTags,
  selectedTemplate,
  templateCategory,
  onNameChange,
  onMethodsChange,
  onDescChange,
  onTagsChange,
  onTemplateChange,
  onCategoryChange,
  onConfirm,
  onCancel,
}: CreateFunctionModalProps) {
  const filteredTemplates =
    templateCategory === 'all'
      ? FUNCTION_TEMPLATES
      : FUNCTION_TEMPLATES.filter((t) => t.category === templateCategory)

  return (
    <Modal
      title="新建函数"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      confirmLoading={creating}
      width={600}
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="函数名称"
          required
          help="支持路径格式，如 user/login 会自动创建 user 文件夹"
        >
          <Input
            placeholder="例如: user/login 或 hello"
            value={newFunctionName}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </Form.Item>

        <Form.Item label="选择模板">
          <div style={{ marginBottom: 12 }}>
            <Radio.Group
              value={templateCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="all">全部</Radio.Button>
              <Radio.Button value="basic">{TEMPLATE_CATEGORIES.basic.name}</Radio.Button>
              <Radio.Button value="http">{TEMPLATE_CATEGORIES.http.name}</Radio.Button>
              <Radio.Button value="data">{TEMPLATE_CATEGORIES.data.name}</Radio.Button>
              <Radio.Button value="util">{TEMPLATE_CATEGORIES.util.name}</Radio.Button>
            </Radio.Group>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              maxHeight: 240,
              overflow: 'auto',
            }}
          >
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                size="small"
                hoverable
                style={{
                  cursor: 'pointer',
                  border:
                    selectedTemplate === template.id
                      ? `2px solid ${isDark ? '#1890ff' : '#1890ff'}`
                      : `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                  background:
                    selectedTemplate === template.id
                      ? isDark
                        ? '#112a45'
                        : '#e6f7ff'
                      : isDark
                        ? '#1a1a1a'
                        : '#fff',
                }}
                onClick={() => onTemplateChange(template.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, color: '#1890ff' }}>
                    {iconMap[template.icon] || <FileOutlined />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {template.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: isDark ? '#888' : '#999',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {template.description}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Form.Item>

        <Form.Item label="请求方式">
          <Select
            mode="multiple"
            value={newFunctionMethods}
            onChange={onMethodsChange}
            options={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
            placeholder="选择允许的请求方式"
          />
        </Form.Item>
        <Form.Item label="函数描述">
          <Input.TextArea
            placeholder="简要描述函数功能"
            value={newFunctionDesc}
            onChange={(e) => onDescChange(e.target.value)}
            rows={2}
          />
        </Form.Item>
        <Form.Item label="标签">
          <Select
            mode="tags"
            value={newFunctionTags}
            onChange={onTagsChange}
            placeholder="输入标签后回车"
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
