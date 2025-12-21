import { Modal, Input } from 'antd'
import type { AISystemPrompt } from '../../api/aiSystemPrompt'

const { TextArea } = Input

interface EditModalProps {
  open: boolean
  editingPrompt: AISystemPrompt | null
  formName: string
  formContent: string
  formChangeNote: string
  saving: boolean
  isDark: boolean
  onNameChange: (value: string) => void
  onContentChange: (value: string) => void
  onChangeNoteChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}

export function EditModal({
  open,
  editingPrompt,
  formName,
  formContent,
  formChangeNote,
  saving,
  isDark,
  onNameChange,
  onContentChange,
  onChangeNoteChange,
  onSave,
  onCancel
}: EditModalProps) {
  return (
    <Modal
      title={editingPrompt ? '编辑提示词' : '新建提示词'}
      open={open}
      onOk={onSave}
      onCancel={onCancel}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      width={600}
      zIndex={1100}
      okButtonProps={{ style: { background: '#10b981' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: isDark ? '#d1d5db' : '#4b5563' }}>
            名称
          </label>
          <Input
            placeholder="提示词名称"
            value={formName}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: isDark ? '#d1d5db' : '#4b5563' }}>
            内容
          </label>
          <TextArea
            placeholder="系统提示词内容"
            value={formContent}
            onChange={(e) => onContentChange(e.target.value)}
            rows={10}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        </div>
        {editingPrompt && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: isDark ? '#d1d5db' : '#4b5563' }}>
              变更说明（可选）
            </label>
            <Input
              placeholder="本次修改说明"
              value={formChangeNote}
              onChange={(e) => onChangeNoteChange(e.target.value)}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
