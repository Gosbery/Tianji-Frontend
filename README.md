# bazi-web

命盘显微镜 Next.js 用户端，负责出生信息输入、可点击命盘、对话和证据展示。

## 启动

先确保 `bazi-api` 已在 `http://127.0.0.1:8000` 运行。

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

前端默认通过同源 `/api` 代理访问后端，避免本地端口变化导致浏览器跨域失败。
启动前在 `.env.local` 配置与后端完全相同的访问口令；后端地址不同也在此配置：

```dotenv
APP_ACCESS_KEY=<与后端相同的至少32字符随机口令>
BACKEND_API_URL=http://127.0.0.1:8000
```

浏览器首次访问会要求登录：用户名 `bazi`，密码为 `APP_ACCESS_KEY`。
页面与 API 代理分别检查凭证，事件流也需要认证。未配置口令时拒绝访问；修改口令后重启前后端。
口令只用于单用户工作台访问控制，共享口令者会看到同一工作台；公网部署必须使用 HTTPS。
不要给此变量添加 `NEXT_PUBLIC_` 前缀，也不要将配置文件提交到版本库。
保持浏览器通过同源代理访问后端，使请求与事件流沿用浏览器认证信息。

生产环境若通过代理保留按客户端限流，入口必须先覆写一个可信、仅含单个 IP 的请求头，再为
Next 与后端配置同一个服务端密钥：

```dotenv
TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip
INTERNAL_PROXY_SECRET=<strong-random-secret>
```

后端还需配置相同的 `INTERNAL_PROXY_SECRET` 与实际代理网段。不要把未经入口覆写的
`X-Forwarded-For` 设为可信来源，也不要使用 `NEXT_PUBLIC_` 前缀暴露密钥。

浏览器打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

前端通过后端 `/api/v1` 接口工作，不读取模型 API Key，也不直接连接 SQLite 或 Qdrant。
会话上下文会保存在浏览器本地并在刷新后从后端恢复；切换命盘、流派或证据范围会新建会话。
历史回答可重新选中其证据链，正文中的数字引用可直接定位到右侧对应依据。
