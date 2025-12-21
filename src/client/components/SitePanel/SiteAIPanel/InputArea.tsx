import { Input, Button } from 'antd'
import { SendOutlined, ClearOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface InputAreaProps {
  isDark: boolean
  prompt: string
  placeholder: string
  isGenerating: boolean
  isConfigured: boolean
  hasOutput: boolean
  onPromptChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  onClear: () => void
}

export default function InputArea({
  isDark,
  prompt,
  placeholder,
  isGenerating,
  isConfigured,
  hasOutput,
  onPromptChange,
  onKeyDown,
  onSend,
  onClear,
}: InputAreaProps) {
  return (
    <div style={{
      padding: 12,
      borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
      background: isDark ? '#141414' : '#fff',
    }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <TextArea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={isGenerating}
          style={{
            flex: 1,
            borderRadius: 8,
            resize: 'none',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={onSend}
            loading={isGenerating}
            disabled={!isConfigured}
            style={{
              borderRadius: 8,
              background: '#00a9a6',
              borderColor: '#00a9a6',
            }}
          />
          {hasOutput && (
            <Button
              type="text"
              icon={<ClearOutlined />}
              onClick={onClear}
              size="small"
              style={{ color: isDark ? '#666' : '#999' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
