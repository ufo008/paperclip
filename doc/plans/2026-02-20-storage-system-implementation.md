# Storage System Implementation Plan (V1)

状态：草案
所有者：Backend + UI
日期：2026-02-20

## Goal

为 Paperclip 添加单一存储子系统，支持：

- 单用户本地部署的本地磁盘存储
- 云部署的 S3 兼容对象存储
- 用于 issue 图片和未来文件附件的提供商无关接口

## V1 Scope

- 第一个消费者：issue 附件/图片。
- 存储适配器：`local_disk` 和 `s3`。
- 文件始终是公司范围和访问控制的。
- API 通过认证 Paperclip 端点提供附件字节。

## Data Model

### StorageProvider

```ts
interface StorageProvider {
  id: string;
  companyId: string;
  type: 'local_disk' | 's3';
  config: {
    path?: string;
    bucket?: string;
    region?: string;
  };
}
```

### StorageFile

```ts
interface StorageFile {
  id: string;
  companyId: string;
  providerId: string;
  key: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}
```

## API Endpoints

- `POST /api/storage/upload` - 上传文件
- `GET /api/storage/:id` - 获取文件
- `DELETE /api/storage/:id` - 删除文件

## Implementation

### Phase 1: Core Storage

1. 添加存储数据模型
2. 创建 StorageService
3. 实现本地磁盘适配器

### Phase 2: S3 Adapter

1. 实现 S3 适配器
2. 添加 S3 配置 UI

### Phase 3: Integration

1. 将存储集成到 issue 附件
2. 添加文件上传 UI
