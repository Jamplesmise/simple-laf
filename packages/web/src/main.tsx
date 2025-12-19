import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './config/monaco' // Monaco 本地加载配置 (必须在组件之前)
import App from './App'
import './styles/fonts.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
