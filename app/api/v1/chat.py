from fastapi import APIRouter, HTTPException
from threading import Lock
from app.models.schemas import ChatRequest
from app.agents.personal_chief import sreach_recipes,get_messages,clear_messages,list_sessions
from fastapi.responses import StreamingResponse

router = APIRouter()
locks = {}
registry_lock = Lock()

def get_lock(thread_id):
    with registry_lock:
        return locks.setdefault(thread_id, Lock())


@router.post("/chat/stream")
def chat_endpoint(request: ChatRequest):
    """流式对话"""
    lock = get_lock(request.thread_id)
    if not lock.acquire(blocking=False):
        raise HTTPException(409, "会话正在生成回答")
    def generate():
        try:
            yield from sreach_recipes(request.message, request.image_url, request.thread_id)
        finally:
            lock.release()
    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8", headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


@router.get("/chat/messages")
def get_chat_messages(thread_id: str):
    """获取历史消息"""
    messages = get_messages(thread_id)
    return {"messages": messages}


@router.delete("/chat/messages")
def clear_chat_messages(thread_id: str):
    """清空历史消息"""
    lock = get_lock(thread_id)
    if not lock.acquire(blocking=False):
        raise HTTPException(409, "请等待回答结束后删除")
    try:
        clear_messages(thread_id)
    finally:
        lock.release()
    return {"success": True}

@router.get("/chat/sessions")
def sessions():
    return {"sessions": list_sessions()}
