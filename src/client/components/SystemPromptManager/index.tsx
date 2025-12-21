import { useThemeStore } from '../../stores/theme'
import type { AISystemPrompt } from '../../api/aiSystemPrompt'
import type { SystemPromptManagerProps } from './types'
import { usePrompts } from './hooks/usePrompts'
import { useEditModal } from './hooks/useEditModal'
import { useVersionHistory } from './hooks/useVersionHistory'
import { PromptListHeader } from './PromptListHeader'
import { PromptList } from './PromptList'
import { EditModal } from './EditModal'
import { VersionHistoryModal } from './VersionHistoryModal'

export default function SystemPromptManager({
  onSelect,
  selectedId,
  selectable = false
}: SystemPromptManagerProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const {
    prompts,
    loading,
    loadPrompts,
    handleDelete,
    handleSetDefault
  } = usePrompts()

  const {
    editModalOpen,
    editingPrompt,
    formName,
    formContent,
    formChangeNote,
    saving,
    setFormName,
    setFormContent,
    setFormChangeNote,
    openEditModal,
    handleSave,
    closeEditModal
  } = useEditModal(loadPrompts)

  const {
    versionModalOpen,
    versionPrompt,
    versions,
    loadingVersions,
    openVersionHistory,
    handleRollback,
    closeVersionModal
  } = useVersionHistory(loadPrompts)

  const handleSelect = (prompt: AISystemPrompt) => {
    if (selectable && onSelect) {
      onSelect(prompt)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PromptListHeader
        isDark={isDark}
        onCreateClick={() => openEditModal()}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <PromptList
          prompts={prompts}
          loading={loading}
          isDark={isDark}
          selectable={selectable}
          selectedId={selectedId}
          onSelect={handleSelect}
          onEdit={openEditModal}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
          onViewHistory={openVersionHistory}
          onCreateClick={() => openEditModal()}
        />
      </div>

      <EditModal
        open={editModalOpen}
        editingPrompt={editingPrompt}
        formName={formName}
        formContent={formContent}
        formChangeNote={formChangeNote}
        saving={saving}
        isDark={isDark}
        onNameChange={setFormName}
        onContentChange={setFormContent}
        onChangeNoteChange={setFormChangeNote}
        onSave={handleSave}
        onCancel={closeEditModal}
      />

      <VersionHistoryModal
        open={versionModalOpen}
        prompt={versionPrompt}
        versions={versions}
        loading={loadingVersions}
        isDark={isDark}
        onRollback={handleRollback}
        onClose={closeVersionModal}
      />
    </div>
  )
}
