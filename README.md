# bazi-web

命盘显微镜 Next.js 用户端，负责出生信息输入、可点击命盘、对话和证据展示。

## 启动

先确保 `bazi-api` 已在 `http://127.0.0.1:8000` 运行。

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

如后端地址不同，创建 `.env.local`：

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

浏览器打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

## 验证

```bash
npm run lint
npm run build
```

前端通过后端 `/api/v1` 接口工作，不读取模型 API Key，也不直接连接 SQLite 或 Qdrant。

