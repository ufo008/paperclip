# Server 开发指南

本文档为 `server/` 目录下的开发提供指南和规范。

## 目录结构

```
server/
├── src/
│   ├── routes/        # 路由定义
│   ├── services/      # 业务逻辑层
│   ├── middleware/     # 中间件
│   ├── utils/         # 工具函数
│   └── index.ts       # 入口文件
└── AGENTS.md
```

## Express REST API 规范

### 路由定义

- 所有路由统一挂载在 `/api` 前缀下
- 使用 RESTful 风格定义资源路由
- 路由文件按资源类型划分

示例：
```typescript
// routes/companies.ts
router.get('/companies', ...);
router.post('/companies', ...);
router.get('/companies/:id', ...);
```

### 请求处理

- 统一使用 `async/await` 处理异步请求
- 在 `routes/` 层只做参数校验和路由分发
- 业务逻辑下沉到 `services/` 层

## Middleware 中间件

### 认证中间件

```typescript
// middleware/auth.ts
export const authenticate = async (req, res, next) => {
  // 验证 Bearer Token
  // 从 agent_api_keys 表校验 API Key
};
```

### 错误处理中间件

- 统一在 `middleware/errorHandler.ts` 中处理所有错误
- 根据错误类型返回对应 HTTP 状态码
- 保持错误响应格式一致

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

## 服务层 Services

### 职责划分

- `services/` 包含核心业务逻辑
- 不直接处理 HTTP 请求/响应
- 返回纯数据对象，由路由层序列化

### 事务处理

涉及多表操作时使用数据库事务：
```typescript
await db.transaction(async (tx) => {
  // 原子操作
});
```

## 认证与授权

### Agent API Keys

- Agent 访问使用 Bearer Token 认证
- Token 存储时使用 bcrypt 哈希
- 每个 Key 绑定到特定 Company

### 权限检查

路由层需进行公司边界检查：
```typescript
// 确保资源属于当前公司
if (resource.companyId !== request.companyId) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

## 错误处理

### HTTP 状态码规范

| 场景 | 状态码 |
|------|--------|
| 参数错误 | 400 |
| 未认证 | 401 |
| 无权限 | 403 |
| 资源不存在 | 404 |
| 冲突 | 409 |
| 验证错误 | 422 |
| 服务器错误 | 500 |

### 日志记录

所有 mutation 操作需记录 Activity Log：
```typescript
await activityLogger.log({
  actorType: 'agent',
  actorId: req.agentId,
  action: 'create',
  resource: 'task',
  resourceId: task.id,
  companyId: companyId,
});
```

## 最佳实践

1. **保持轻量路由** - 路由层只做校验和分发
2. **事务保护** - 多步操作使用数据库事务
3. **统一错误格式** - 所有错误响应结构一致
4. **公司边界** - 始终验证资源所属公司
5. **日志审计** - mutation 操作必须记录活动日志

## 常用命令

```bash
# 启动开发服务器
pnpm dev

# 类型检查
pnpm -r typecheck

# 运行测试
pnpm test:run

# 构建生产版本
pnpm build
```
