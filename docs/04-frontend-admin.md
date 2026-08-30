# 管理前端

仓库有两个职责不同的管理类前端：

| 工程 | 用户 | 主要职责 |
| --- | --- | --- |
| `admin/` | 平台管理员、超级管理员 | 平台账号、角色权限、系统日志 |
| `web/` | 门店商家 | 商品、订单、门店经营与集成开关 |

两者均使用 Vue 3、Vite、TypeScript、Vue Router 和 Element Plus，API audience 与后端守卫不同，不可共享登录 token。共享内容只应包括 contracts、icons、observability 和 `theme/colors.css`；业务页面与会话状态留在各自工程。

## 约定

1. 路由元数据描述页面所需角色，真正的数据范围由后端 guard/service 强制执行。
2. Element Plus 通过工程内 UI boundary 导入，避免页面散落全量依赖。
3. 主题主色和语义色来自 `theme/`；页面只增加确有业务语义的局部 token。
4. 表格查询必须分页，详情/编辑使用按需接口，禁止一次加载完整商品配置列表。
5. 商家可通过门店 integration API 查看并切换已由部署层允许的可选连接器。

## 验证

```bash
pnpm --filter @lingdian/admin test
pnpm --filter @lingdian/admin build
pnpm --filter @lingdian/web test
pnpm --filter @lingdian/web build
```

后端接口与鉴权见 [05-backend-nestjs.md](./05-backend-nestjs.md)。
