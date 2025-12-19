/**
 * 数据库面板
 *
 * MongoDB 集合管理界面
 * 支持集合 CRUD、文档编辑、索引管理、多种视图模式
 */

import { useEffect, useState, useCallback } from 'react'
import { Empty, message } from 'antd'
import { useThemeColors } from '@/hooks/useTheme'
import { useDatabaseStore } from '@/stores/database'

// 子组件
import { CollectionList } from './CollectionList'
import { DocumentViewer } from './DocumentViewer'
import { DocumentEditor } from './DocumentEditor'
import { IndexPanel } from './IndexPanel'

// 样式
import styles from './styles.module.css'

export default function DatabasePanel() {
  const { t } = useThemeColors()

  // 从 store 获取状态
  const {
    collections,
    currentCollection,
    collectionsLoading,
    collectionSearch,
    documents,
    total,
    page,
    pageSize,
    documentsLoading,
    viewMode,
    currentDocument,
    indexes,
    indexesLoading,
    setCurrentCollection,
    setCollectionSearch,
    setPage,
    setPageSize,
    setQuery,
    setViewMode,
    setCurrentDocument,
    refreshCollections,
    createCollection,
    dropCollection,
    refreshDocuments,
    insertDocument,
    updateDocument,
    deleteDocument,
    refreshIndexes,
    createIndex,
    dropIndex,
  } = useDatabaseStore()

  // 本地状态
  const [queryInput, setQueryInput] = useState('')
  const [showIndexes, setShowIndexes] = useState(false)
  const [isCreatingDoc, setIsCreatingDoc] = useState(false)

  // 初始化加载集合
  useEffect(() => {
    refreshCollections()
  }, [refreshCollections])

  // 处理查询提交
  const handleQuerySubmit = useCallback(() => {
    try {
      const query = queryInput.trim() ? JSON.parse(queryInput) : {}
      setQuery(query)
    } catch {
      message.error('查询条件格式错误')
    }
  }, [queryInput, setQuery])

  // 处理分页变化
  const handlePageChange = useCallback((p: number, ps: number) => {
    if (ps !== pageSize) {
      setPageSize(ps)
    } else {
      setPage(p)
    }
  }, [pageSize, setPageSize, setPage])

  // 处理切换索引面板
  const handleToggleIndexes = useCallback(() => {
    setShowIndexes(prev => {
      if (!prev) refreshIndexes()
      return !prev
    })
  }, [refreshIndexes])

  // 处理开始创建文档
  const handleStartCreate = useCallback(() => {
    setIsCreatingDoc(true)
    setCurrentDocument(null)
  }, [setCurrentDocument])

  // 处理选择文档
  const handleSelectDocument = useCallback((doc: typeof currentDocument) => {
    setIsCreatingDoc(false)
    setCurrentDocument(doc)
  }, [setCurrentDocument])

  // 处理保存文档
  const handleSaveDocument = useCallback(async (doc: Record<string, unknown>) => {
    if (isCreatingDoc) {
      await insertDocument(doc)
      setIsCreatingDoc(false)
      setCurrentDocument(null)
    } else if (currentDocument) {
      await updateDocument(currentDocument._id, doc)
    }
  }, [isCreatingDoc, currentDocument, insertDocument, updateDocument, setCurrentDocument])

  // 处理删除文档
  const handleDeleteDocument = useCallback(async (id: string) => {
    try {
      await deleteDocument(id)
      message.success('删除成功')
    } catch (err) {
      message.error((err as Error).message || '删除失败')
    }
  }, [deleteDocument])

  return (
    <div className={styles.container} style={{ background: t.bg }}>
      {/* 左侧：集合列表 */}
      <CollectionList
        collections={collections}
        currentCollection={currentCollection}
        loading={collectionsLoading}
        searchValue={collectionSearch}
        onSelect={setCurrentCollection}
        onSearchChange={setCollectionSearch}
        onRefresh={refreshCollections}
        onCreate={createCollection}
        onDrop={dropCollection}
      />

      {/* 中间：文档视图 */}
      {!currentCollection ? (
        <div className={styles.main} style={{ background: t.bg }}>
          <div className={styles.emptyState}>
            <Empty description="选择一个集合" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        </div>
      ) : (
        <DocumentViewer
          documents={documents}
          currentDocument={currentDocument}
          loading={documentsLoading}
          viewMode={viewMode}
          total={total}
          page={page}
          pageSize={pageSize}
          queryInput={queryInput}
          showIndexes={showIndexes}
          onSelect={handleSelectDocument}
          onDelete={handleDeleteDocument}
          onCreate={handleStartCreate}
          onRefresh={refreshDocuments}
          onViewModeChange={setViewMode}
          onQueryChange={setQueryInput}
          onQuerySubmit={handleQuerySubmit}
          onPageChange={handlePageChange}
          onToggleIndexes={handleToggleIndexes}
          indexPanel={
            <IndexPanel
              indexes={indexes}
              loading={indexesLoading}
              onCreate={createIndex}
              onDrop={dropIndex}
            />
          }
        />
      )}

      {/* 右侧：文档编辑器 */}
      <DocumentEditor
        document={currentDocument}
        isCreating={isCreatingDoc}
        onSave={handleSaveDocument}
      />
    </div>
  )
}
