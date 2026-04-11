---
title: 本地开发
summary: 为本地开发设置 Paperclip
---

运行 Paperclip 本地开发，零外部依赖。

## 先决条件

- Node.js 20+
- pnpm 9+

## 启动开发服务器

```sh
pnpm install
pnpm dev
```

这启动：

- **API 服务器**在 `http://localhost:3100`
- **UI** 由 API 服务器在开发中间件模式（同一来源）提供服务

无需 Docker 或外部数据库。Paperclip 自动使用嵌入式 PostgreSQL。

## 一命令引导

对于首次安装：

```sh
pnpm paperclipai run
```

这执行：

1. 如果配置缺失则自动引导
2. 运行带有修复功能的 `paperclipai doctor`
3. 当检查通过时启动服务器

## Tailscale/私有认证开发模式

要为网络访问以 `authenticated/private` 模式运行：

```sh
pnpm dev --tailscale-auth
```

这将服务器绑定到 `0.0.0.0` 以进行私有网络访问。

别名：

```sh
pnpm dev --authenticated-private
```

允许额外的私有主机名：

```sh
pnpm paperclipai allowed-hostname dotta-macbook-pro
```

有关完整设置和故障排除，请参见 [Tailscale 私有访问](../deploy/tailscale-private-access.md)。

## 健康检查

```sh
curl http://localhost:3100/api/health
# -> {"status":"ok"}

curl http://localhost:3100/api/companies
# -> []
```

## 重置开发数据

要擦除本地数据并重新开始：

```sh
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

## 数据位置

| 数据 | 路径 |
|------|------|
| 配置 | `~/.paperclip/instances/default/config.json` |
| 数据库 | `~/.paperclip/instances/default/db` |
| 存储 | `~/.paperclip/instances/default/data/storage` |
| 密钥 | `~/.paperclip/instances/default/secrets/master.key` |
| 日志 | `~/.paperclip/instances/default/logs` |

用环境变量覆盖：

```sh
PAPERCLIP_HOME=/custom/path PAPERCLIP_INSTANCE_ID=dev pnpm paperclipai run
```
