# UI 开发指南

本文档为 `ui/` 目录下的开发人员提供指南和规范。

## 技术栈

- **React 18+** - UI 框架
- **Vite** - 构建工具和开发服务器
- **TypeScript** - 类型安全
- **React Router** - 路由管理
- **TanStack Query (React Query)** - 服务端状态管理
- **Zustand** - 客户端状态管理

## 目录结构

```
ui/
├── src/
│   ├── components/     # 可复用组件
│   ├── pages/          # 页面组件
│   ├── hooks/          # 自定义 Hooks
│   ├── api/            # API 客户端
│   ├── stores/         # Zustand stores
│   ├── types/          # TypeScript 类型定义
│   └── utils/          # 工具函数
├── public/             # 静态资源
└── index.html
```

## 组件规范

### 命名约定

- 组件文件：`PascalCase.tsx`（如 `UserProfile.tsx`）
- 工具函数：`camelCase.ts`（如 `formatDate.ts`）
- 样式文件：`ComponentName.module.css`

### 组件结构

```tsx
// 1. 导入
import { useState, useEffect } from 'react';
import type { ComponentProps } from './types';

// 2. 类型定义
interface Props extends ComponentProps {
  title: string;
}

// 3. 组件定义
export function ComponentName({ title, ...props }: Props) {
  // 4. Hooks
  const [state, setState] = useState(initialValue);

  // 5. 副作用
  useEffect(() => {
    // effect
  }, []);

  // 6. 事件处理
  const handleClick = () => {
    // handler
  };

  // 7. 条件渲染
  if (!title) return null;

  // 8. 返回 JSX
  return (
    <div>
      <h1>{title}</h1>
    </div>
  );
}
```

## API 客户端

### 使用 TanStack Query

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

// 查询
function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/users'),
  });
}

// 变更
function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserData) => apiClient.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

### API 错误处理

```tsx
try {
  const response = await apiClient.post('/endpoint', data);
} catch (error) {
  if (isApiError(error)) {
    switch (error.status) {
      case 401:
        // 处理未授权
        break;
      case 403:
        // 处理禁止访问
        break;
      case 404:
        // 处理未找到
        break;
      default:
        // 处理其他错误
    }
  }
}
```

## 路由

### 路由定义

```tsx
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'users', element: <UsersPage /> },
    ],
  },
]);
```

### 导航

```tsx
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

// 编程式导航
const navigate = useNavigate();
navigate('/users/new');

// 获取参数
const { id } = useParams();
const [searchParams] = useSearchParams();
const query = searchParams.get('q');
```

## 状态管理

### Zustand Store

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'app-storage' }
  )
);
```

### 使用 Store

```tsx
function ThemeToggle() {
  const { theme, setTheme } = useAppStore();
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      当前主题: {theme}
    </button>
  );
}
```

## 样式规范

### CSS Modules

```css
/* Button.module.css */
.button {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.primary {
  background: blue;
  color: white;
}
```

```tsx
import styles from './Button.module.css';

export function Button({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      点击
    </button>
  );
}
```

## 开发命令

```bash
# 安装依赖
pnpm install

# 开发服务器
pnpm dev

# 类型检查
pnpm typecheck

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview
```

## 注意事项

1. **性能优化**
   - 使用 `React.memo` 避免不必要的重渲染
   - 合理使用 `useMemo` 和 `useCallback`
   - 实现虚拟滚动处理长列表

2. **可访问性**
   - 使用语义化 HTML 标签
   - 添加适当的 `aria-label`
   - 确保键盘导航支持

3. **响应式设计**
   - 使用 CSS Grid/Flexbox 布局
   - 移动优先的断点设计
   - 测试不同屏幕尺寸

4. **错误边界**
   - 为关键组件添加 Error Boundary
   - 提供有意义的错误提示
   - 记录错误日志便于调试
