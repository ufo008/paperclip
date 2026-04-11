# Humans and Permissions Implementation (V1)

状态：草案
日期：2026-02-21
所有者：Server + UI + CLI + DB + Shared
配套计划：`doc/plan/humans-and-permissions.md`

## 1. Document role

本文档是人类和权限计划工程实施契约。
它将产品决策转化为具体的 schema、API、中间件、UI、CLI 和测试工作。

如果本文档与之前的探索性笔记冲突，本文档对 V1 执行获胜。

## 2. Locked V1 decisions

1. 两种部署模式保持：
   - `local_trusted`
   - `cloud_hosted`

## 3. Data Model

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Company Members Table

```sql
CREATE TABLE company_members (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);
```

## 4. API Endpoints

### Auth

- `POST /api/auth/register` - 注册用户
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 获取当前用户

### Users

- `GET /api/users` - 列出用户
- `GET /api/users/:id` - 获取用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

### Company Members

- `GET /api/companies/:id/members` - 列出公司成员
- `POST /api/companies/:id/members` - 添加公司成员
- `DELETE /api/companies/:id/members/:userId` - 移除公司成员

## 5. Implementation

### Phase 1: Core User Model

1. 添加 users 表
2. 添加 company_members 表
3. 创建 UserService
4. 实现注册/登录

### Phase 2: Authentication

1. 实现 JWT 认证
2. 添加会话管理
3. 实现权限检查

### Phase 3: UI

1. 添加登录/注册 UI
2. 添加用户管理 UI
3. 添加权限管理 UI
