import { Modal, Input } from 'antd'

interface RenameModalProps {
  open: boolean
  newFunctionName: string
  onNameChange: (name: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function RenameModal({
  open,
  newFunctionName,
  onNameChange,
  onConfirm,
  onCancel,
}: RenameModalProps) {
  return (
    <Modal title="重命名函数" open={open} onOk={onConfirm} onCancel={onCancel}>
      <Input
        placeholder="请输入新名称"
        value={newFunctionName}
        onChange={(e) => onNameChange(e.target.value)}
        onPressEnter={onConfirm}
        style={{ marginTop: 16 }}
      />
    </Modal>
  )
}
