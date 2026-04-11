# packages/db 开发指南

本文档为 `packages/db/` 目录下的数据库开发提供指南和规范。

## 技术栈

- **ORM**: Drizzle ORM
- **数据库**: PostgreSQL (生产环境) / PGlite (开发环境)
- **迁移工具**: Drizzle Kit

## 目录结构

```
packages/db/
├── src/
│   ├── schema/          # 数据库表结构定义
│   │   ├── *.ts         # 各域实体表
│   │   └── index.ts     # schema 统一导出
│   ├── migrations/      # Drizzle 迁移文件（自动生成）
│   ├── index.ts         # 数据库客户端导出
│   └── client.ts        # 数据库连接配置
├── drizzle.config.ts    # Drizzle Kit 配置
└── package.json
```

## Schema 设计规范

### 命名约定

- 表名使用**复数名词**，如 `users`、`tasks`、`companies`
- 列名使用**蛇形命名**，如 `created_at`、`updated_at`
- 主键列统一命名 `id`，类型为 `uuid`
- 外键列命名格式：`{表名}_id`，如 `company_id`

### 必需字段

每个表必须包含：

```typescript
// 通用审计字段
createdAt: timestamp("created_at").defaultNow(),
updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
```

### 索引规范

- 高频查询列必须建立索引
- 外键列必须建立索引
- 使用 `index()` 而非 `uniqueIndex()` 除非有唯一性要求

## 迁移工作流

### 生成迁移

```bash
pnpm db:generate
```

### 应用迁移

```bash
pnpm db:migrate
```

### 重置开发数据库

```bash
rm -rf data/pglite
pnpm dev
```

## 开发注意事项

1. **修改 schema 后必须生成迁移**：`pnpm db:generate`
2. **迁移文件提交前需检查**：确保生成的 SQL 正确无误
3. **不要手动修改迁移文件**：所有变更通过 schema 修改触发
4. **PGlite 仅用于开发**：生产环境使用 PostgreSQL

## 常见问题

### PGlite 数据丢失

开发环境下 `data/pglite` 目录包含嵌入式数据库文件。删除此目录会丢失所有本地数据。

### 类型同步

Schema 变更后，运行以下命令确保类型同步：

```bash
pnpm -r typecheck
```

## 相关资源

- [Drizzle ORM 文档](https://orm.drizzle.team)
- [Drizzle Kit 文档](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
