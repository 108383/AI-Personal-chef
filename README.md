# 智能私厨

一个基于 FastAPI、LangChain 和 LangGraph 的智能食谱助手。用户可以输入食材清单，或上传食材图片，由智能体搜索并整理适合的菜谱建议。

## 功能

- 根据文字或图片中的食材生成菜谱建议
- 使用 Tavily 搜索网络菜谱
- 通过 LangGraph SQLite checkpointer 保存会话历史
- FastAPI 流式对话接口
- 使用阿里云 OSS 生成图片上传签名 URL
- 内置静态前端资源服务

## 环境要求

- Python 3.13 或更高版本
- [uv](https://docs.astral.sh/uv/) 包管理器
- DashScope/Qwen 兼容 API Key
- Tavily API Key（联网搜索需要）
- 阿里云 OSS 配置（图片上传需要）

## 安装

```bash
git clone <你的 GitHub 仓库地址>
cd 智能私厨
uv sync
```

复制环境变量模板并填写自己的密钥：

```bash
copy .env.example .env
```

Linux/macOS 使用：

```bash
cp .env.example .env
```

`.env` 只保存在本地，禁止提交到 GitHub。

## 启动

启动 FastAPI 服务：

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

打开 <http://127.0.0.1:8001> 即可访问前端；接口文档地址为 <http://127.0.0.1:8001/docs>。

如需使用 LangGraph 开发调试服务：

```bash
uv run langgraph dev
```

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/chat/stream` | 流式发送食材和问题 |
| GET | `/api/v1/chat/messages?thread_id=...` | 获取会话历史 |
| DELETE | `/api/v1/chat/messages?thread_id=...` | 清空会话历史 |
| GET | `/api/v1/oss/presign?filename=...` | 获取 OSS 上传签名 |

## 项目结构

```text
app/
├── agents/       # LangGraph 智能体
├── api/          # FastAPI 路由
├── common/       # 日志等公共模块
├── db/           # 本地 SQLite 数据库目录（运行时自动生成）
├── models/       # 请求/响应模型
├── static/       # 前端静态资源
└── main.py       # FastAPI 应用入口
```

## GitHub 上传

首次上传前检查：

```bash
git status --short
git add .
git status
git commit -m "Initial commit"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

`.gitignore` 已排除 `.env`、虚拟环境、IDE 配置、LangGraph 本地状态、SQLite 数据库、缓存和日志。

## 安全提醒

不要在代码、README、截图或 Git 提交中写入 API Key、OSS 密钥、数据库密码和真实用户数据。如果密钥曾经提交到公开仓库，应立即撤销并重新生成。

## 许可证

暂未指定许可证。如需公开他人使用，请根据你的授权需求补充 LICENSE 文件。
