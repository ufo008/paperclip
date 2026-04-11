# Docker Release Browser E2E Plan

## Context

今天，发布的 Paperclip 包的发布烟雾测试是手动和 shell 驱动的：

```sh
HOST_PORT=3232 DATA_DIR=./data/release-smoke-canary PAPERCLIPAI_VERSION=canary ./scripts/docker-onboard-smoke.sh
HOST_PORT=3233 DATA_DIR=./data/release-smoke-stable PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
```

这很有用，因为它锻炼了用户遇到的相同公共安装表面：

- Docker
- `npx paperclipai@canary`
- `npx paperclipai@latest`
- 认证引导流程

但它仍然将最重要的问题留给使用浏览器的人类：

- 我可以用烟雾凭证登录吗？
- 我进入引导了吗？
- 我能完成引导吗？
- 初始 CEO 代理实际上被创建并运行了吗？

repo 已经有两个相邻的部分：

- `tests/e2e/onboarding.spec.ts` 针对本地源码树覆盖引导向导
- `scripts/docker-onboard-smoke.sh` 启动发布的 Docker 安装并自动引导认证模式，但仅验证 API/session 层

缺少的是一个确定性的浏览器测试，连接这两个路径。

## Goal

添加一个发布级的 Docker 支持浏览器 E2E，验证发布的 `canary` 和 `latest` 安装端到端：

1. 在 Docker 中启动发布的包
2. 用已知烟雾凭证登录
3. 验证用户被路由到引导
4. 在浏览器中完成引导
5. 验证第一个 CEO 代理存在
6. 验证初始 CEO 运行被触发并达到终止或活动状态

然后将该测试接入 GitHub Actions，这样发布验证不再仅是手动。

## Recommendation In One Sentence

将当前 Docker 烟雾脚本转换为机器友好的测试工具，添加一个专用的 Playwright release-smoke spec，针对发布的 Docker 安装驱动认证浏览器流程，并为 `canary` 和 `latest` 在 GitHub Actions 中运行。

## What We Have Today

### Docker smoke script

`scripts/docker-onboard-smoke.sh` 当前做：

1. 拉取 Docker 镜像
2. 使用随机端口启动容器
3. 等待 API 就绪
4. 调用 `/api/health` 验证
5. 调用 `/api/auth/session` 验证认证
6. 清理容器

### Onboarding spec

`tests/e2e/onboarding.spec.ts` 当前做：

1. 启动本地开发服务器
2. 导航到 `/onboarding`
3. 填写引导表单
4. 提交并验证重定向
5. 验证 CEO 代理创建

### Gap

烟雾脚本验证 API/session 层，但不验证浏览器流程。onboarding spec 针对本地源码，但不验证发布的 Docker 安装。

## Proposed Implementation

### New Playwright spec: release-smoke.spec.ts

```ts
// tests/e2e/release-smoke.spec.ts

test('canary Docker install E2E', async ({ page }) => {
  // Start container
  const container = await startDockerContainer({
    image: 'paperclipai/paperclipai:canary',
    port: 3232,
  });
  
  try {
    // Navigate to app
    await page.goto('http://localhost:3232');
    
    // Verify landing on onboarding
    await expect(page).toHaveURL(/\/onboarding/);
    
    // Complete onboarding form
    await page.fill('[data-testid="company-name"]', 'Smoke Test Co');
    await page.fill('[data-testid="first-agent"]', 'CEO');
    await page.click('[data-testid="submit-onboarding"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Verify CEO agent exists
    const ceoAgent = await page.locator('[data-testid="agent-ceo"]');
    await expect(ceoAgent).toBeVisible();
    
    // Verify initial run was triggered
    const runStatus = await page.locator('[data-testid="run-status"]');
    await expect(runStatus).toBeVisible();
    
  } finally {
    // Always cleanup
    await container.stop();
  }
});
```

### GitHub Actions workflow addition

```yaml
# .github/workflows/release-smoke.yml
name: Release Smoke Tests

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to test (canary or latest)'
        required: true
        type: choice
        options:
          - canary
          - latest

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Start Docker container
        run: |
          docker run -d \
            --name paperclip-smoke \
            -p 3232:3100 \
            paperclipai/paperclipai:${{ inputs.version }}
      
      - name: Wait for API
        run: |
          for i in {1..30}; do
            curl -s http://localhost:3232/api/health && break
            sleep 2
          done
      
      - name: Run Playwright tests
        run: |
          npx playwright test \
            tests/e2e/release-smoke.spec.ts \
            --project=chromium
      
      - name: Cleanup
        if: always()
        run: docker stop paperclip-smoke
```

## Implementation Plan

### Phase 1: Create Playwright release-smoke spec

1. 创建 `tests/e2e/release-smoke.spec.ts`
2. 实现 Docker 容器启动/停止助手
3. 实现认证浏览器流程测试
4. 实现 CEO 代理创建验证

### Phase 2: Add GitHub Actions workflow

1. 创建 `.github/workflows/release-smoke.yml`
2. 配置 `workflow_dispatch` 触发
3. 添加容器启动/停止步骤
4. 添加 Playwright 测试步骤

### Phase 3: Wire into release process

1. 在 `release.yml` 中添加对 release-smoke 工作流程的调用
2. 配置 canary 和 latest 的 required check
3. 添加失败时的通知

## Security Considerations

1. 烟雾测试使用专用测试凭证
2. 容器在测试后完全清理
3. 没有持久化敏感数据

## Maintenance

1. 如果 UI 更改，更新选择器
2. 如果流程更改，更新测试步骤
3. 定期运行以验证发布流程健康
