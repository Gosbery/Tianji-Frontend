# bazi-web

命盘显微镜 Next.js 用户端，负责出生信息输入、可点击命盘、对话和证据展示。

## 启动

先确保 `bazi-api` 已在 `http://127.0.0.1:8000` 运行。

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

前端默认通过同源 `/api` 代理访问后端，避免本地端口变化导致浏览器跨域失败。
如后端地址不同，创建 `.env.local`：

```dotenv
BACKEND_API_URL=http://127.0.0.1:8001
```

只有部署时确实需要浏览器跨域直连后端，才配置 `NEXT_PUBLIC_API_BASE_URL`，并同步设置后端
`CORS_ORIGINS`。

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
