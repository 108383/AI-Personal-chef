from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_tavily import TavilySearch
from langgraph.checkpoint.sqlite import SqliteSaver
from app.common.logger import logger
from langchain.messages import HumanMessage,AIMessage,AIMessageChunk
import sqlite3
import os
from pathlib import Path

# 1.加载环境变量
from dotenv import load_dotenv
load_dotenv()

# 2. web搜索工具
search_tool = TavilySearch(
    max_results=5,
    topic="general",
)

# 3. 初始化多模态模型
model = init_chat_model(
    model = "qwen3.7-plus", #模型名称
    model_provider="openai", #指定模型提供者,使用国内大部分都兼容的openai
    base_url = os.getenv("DASHSCOPE_BASE_URL"),
    api_key = os.getenv("DASHSCOPE_API_KEY")
)

# 4.初始化checkpointer
# 连接sqlite
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_DIR = PROJECT_ROOT / "app" / "db"
DB_DIR.mkdir(parents=True, exist_ok=True)
connection = sqlite3.connect(DB_DIR / "personal_chief.db", check_same_thread=False)
# 初始化checkpointer
checkpointer = SqliteSaver(connection)
# 自动建表
checkpointer.setup()

# 5. 系统提示词

system_prompt = """
你是一名私人厨师。收到用户提供的食材照片或清单后，请按以下流程操作：
1.识别和评估食材：若用户提供照片，首先辨识所有可见食材。基于食材的外观状态，评估其新鲜度与可用量，整理出一份“当前可用食材清单”。
2.智能食谱检索：优先调用 web_search 工具，以“可用食材清单”为核心关键词，查找可行菜谱。
3.多维度评估与排序：从营养价值和制作难度两个维度对检索到的候选食谱进行量化打分，并根据得分排序，制作简单且营养丰富的排名靠前。
4.结构化方案输出：把排序后的食谱整理为一份结构清晰的建议报告，要包含食谱信息、得分、推荐理由，帮助用户快速做出决策。

请严格按照流程，优先调用 web_search 工具搜索食谱，再搜索不到的情况下才能自己发挥。
"""

# 6. 创建agent
agent = create_agent(
    model=model,#模型
    tools=[search_tool],#工具
    system_prompt = system_prompt,#系统提示词
    checkpointer = checkpointer,#记忆
)
#---------------------------------------------------------
#直接用langgraph调用,可以在网页调试,终端: uv run langgraph dev
#---------------------------------------------------------
# 流式对话
async def sreach_recipes(prompt:str ,image:str ,thread_id: str):
    """调用agent搜索食谱"""
    logger.info(f"[用户]:{prompt},image:{image},thread_id: {thread_id}")
    try:
        #判断是否有图片,封装不同格式的消息
        if not image or image.strip() == "":
            message = HumanMessage(content=prompt)
        else:
            message = HumanMessage(content=[
                {"type": "image", "url": image},
                {"type": "text", "text": prompt}
            ])

        #流式调用Agent
        for chunk,metadata in agent.stream(
                {"messages": [message]},
                {"configurable":{"thread_id": thread_id}},
                stream_mode = "messages"
        ):
            if isinstance(chunk,AIMessageChunk) and chunk.content:
                yield chunk.content

    except Exception as e:
        logger.error(f"\n[错误]:{str(e)}")
        yield "信息检索失败,试试看手动输入食物列表?"

#清空对话
def clear_messages(thread_id:str):
    """清空会话"""
    logger.info(f"清空历史消息,thread_id:{thread_id}")
    checkpointer.delete_thread(thread_id)

# 查询会话历史
def get_messages(thread_id:str) -> list[dict[str,str]]:
    """获取会话历史"""
    logger.info(f"获取历史消息,thread_id:{thread_id}")

    # 根据 thread_id 查询 checkpoint
    checkpoint = checkpointer.get({"configurable":{"thread_id":thread_id}})

    # 如果不存在,返回空列表
    if not checkpoint:
        return []

    #安全获取 messages
    channel_values = checkpoint.get("channel_values")
    if not channel_values:
        return []
    messages = channel_values.get("messages",[])
    if not channel_values:
        return []

    #转换消息格式
    result = []
    for msg in messages:
        if not msg.content:
            continue

        if isinstance(msg,HumanMessage):
            result.append({"role":"user","content":msg.content})
        elif isinstance(msg,AIMessage):
            result.append({"role": "assistant", "content": msg.content})

    return result
