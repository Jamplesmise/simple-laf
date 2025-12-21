import { useState } from 'react'
import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useProviders } from './hooks/useProviders'
import { useModels } from './hooks/useModels'
import { ProviderList } from './components/ProviderList'
import { ProviderModal } from './components/ProviderModal'
import { ModelModal } from './components/ModelModal'
import type { AIProvider, AIModel } from './types'

export default function AIProviderManager() {
  const {
    providers,
    loading,
    loadProviders,
    handleDelete: handleDeleteProvider,
    handleSetDefault: handleSetDefaultProvider,
  } = useProviders()

  const {
    modelsByProvider,
    loadingModels,
    testingModels,
    testResults,
    loadModels,
    handleDelete: handleDeleteModel,
    handleSetDefault: handleSetDefaultModel,
    handleTest: handleTestModel,
  } = useModels()

  // 供应商编辑
  const [providerModalOpen, setProviderModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)

  // 模型编辑
  const [modelModalOpen, setModelModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<AIModel | null>(null)
  const [modelProviderId, setModelProviderId] = useState<string | null>(null)

  const openProviderModal = (provider?: AIProvider) => {
    setEditingProvider(provider || null)
    setProviderModalOpen(true)
  }

  const openModelModal = (providerId: string, model?: AIModel) => {
    setModelProviderId(providerId)
    setEditingModel(model || null)
    setModelModalOpen(true)
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>AI 模型供应商</span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openProviderModal()}
        >
          添加供应商
        </Button>
      </div>

      {/* 供应商列表 */}
      <ProviderList
        providers={providers}
        loading={loading}
        modelsByProvider={modelsByProvider}
        loadingModels={loadingModels}
        testingModels={testingModels}
        testResults={testResults}
        onEditProvider={openProviderModal}
        onDeleteProvider={handleDeleteProvider}
        onSetDefaultProvider={handleSetDefaultProvider}
        onLoadModels={loadModels}
        onAddModel={(providerId) => openModelModal(providerId)}
        onEditModel={openModelModal}
        onDeleteModel={handleDeleteModel}
        onSetDefaultModel={handleSetDefaultModel}
        onTestModel={handleTestModel}
      />

      {/* 供应商编辑弹窗 */}
      <ProviderModal
        open={providerModalOpen}
        provider={editingProvider}
        onClose={() => setProviderModalOpen(false)}
        onSuccess={loadProviders}
      />

      {/* 模型编辑弹窗 */}
      <ModelModal
        open={modelModalOpen}
        providerId={modelProviderId}
        model={editingModel}
        onClose={() => setModelModalOpen(false)}
        onSuccess={loadModels}
      />
    </div>
  )
}
