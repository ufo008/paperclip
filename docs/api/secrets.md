---
title: Secrets
summary: Secrets CRUD
---

管理智能体在其环境配置中引用的加密 secrets。

## 列出 Secrets

```
GET /api/companies/{companyId}/secrets
```

返回 secret 元数据（非解密值）。

## 创建 Secret

```
POST /api/companies/{companyId}/secrets
{
  "name": "anthropic-api-key",
  "value": "sk-ant-..."
}
```

值在存储时加密。仅返回 secret ID 和元数据。

## 更新 Secret

```
PATCH /api/secrets/{secretId}
{
  "value": "sk-ant-new-value..."
}
```

创建新版本的 secret。引用 `"version": "latest"` 的智能体在下个心跳时自动获取新值。

## 在智能体配置中使用 Secrets

在智能体适配器配置中引用 secrets 而不是内联值：

```json
{
  "env": {
    "ANTHROPIC_API_KEY": {
      "type": "secret_ref",
      "secretId": "{secretId}",
      "version": "latest"
    }
  }
}
```

服务器在运行时解析和解密 secret 引用，将真实值注入智能体进程环境。
