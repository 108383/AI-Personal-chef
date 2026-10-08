# AI 私厨

基于 React、FastAPI 与 LangGraph 的多模态智能食谱助手。支持文字食材、OSS 图片上传、联网菜谱检索、营养与难度评估、流式回答、服务器端会话历史查看和确认删除。

## 本地启动

需要 Python 3.13+、Node.js 18+。先复制 `.env.example` 为 `.env`，配置模型、Tavily 与 OSS。OSS Bucket 需要允许你的前端域名进行 PUT 上传。

```bash
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
```

另开终端：

```bash
cd frontend
npm ci
npm run dev
```

打开 Vite 输出的地址（默认 http://127.0.0.1:5173）。开发服务自动代理 `/api` 到端口 8001。

## 单服务部署

```bash
cd frontend
npm ci
npm run build
cd ..
uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

构建后 FastAPI 直接托管 React 页面。`frontend/dist` 是本地生成的构建产物，不上传；源码和锁文件在仓库中。

## 接口

- POST `/api/v1/chat/stream`：UTF-8 文本流，提交 message、image_url、thread_id。
- GET `/api/v1/chat/sessions`：读取持久化会话列表。
- GET `/api/v1/chat/messages?thread_id=...`：恢复消息（含图片）。
- DELETE `/api/v1/chat/messages?thread_id=...`：永久删除该会话的全部 checkpoint 与 writes。
- GET `/api/v1/oss/presign?filename=...`：获取图片上传签名。

## 数据与安全

旧 `app/static` 页面只在本地保留，不再提供服务、不加入 Git。`.env`、数据库、会话历史、日志、缓存、依赖和 IDE 文件均不上传。

删除会话不等于删除 OSS 中的已上传图片。停止生成会中止浏览器读取，但服务器可能仍在完成当前模型调用。请勿对无身份认证的本项目直接开放公共服务：部署前应增加登录、会话归属校验、限流、上传限制与 HTTPS。当前为单用户作品演示。
