import {
  Html5Outlined,
  FileTextOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import type { ActionButton } from './types'

export const ACTION_BUTTONS: ActionButton[] = [
  {
    key: 'create-page',
    icon: <Html5Outlined />,
    label: '创建页面',
    placeholder: '描述你想要的页面，如：一个登录页面，包含用户名密码输入框...',
  },
  {
    key: 'create-component',
    icon: <FileTextOutlined />,
    label: '创建组件',
    placeholder: '描述你想要的组件，如：一个轮播图组件...',
  },
  {
    key: 'create-site',
    icon: <AppstoreOutlined />,
    label: '创建网站',
    placeholder: '描述你想要的网站，如：一个产品展示网站，包含首页、关于我们、联系方式...',
  },
]
