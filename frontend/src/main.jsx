import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {ChefHat, Plus, Trash2, ArrowUp, ImagePlus, X, Menu, Square, Leaf, Clock, RefreshCw} from 'lucide-react';
import './styles.css';

async function api(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) { let data; try {data = await response.json();} catch {} throw new Error(typeof data?.detail === 'string' ? data.detail : '请求失败，请检查服务和配置'); }
  return response;
}
function normalise(content) {
  if (typeof content === 'string') return {text:content};
  const blocks = Array.isArray(content) ? content : [];
  const image = blocks.find(x=>x.type==='image'||x.type==='image_url');
  return {text:blocks.filter(x=>x.type==='text').map(x=>x.text).join('\n'), image:image?.url||image?.image_url?.url};
}
function App() {
  const [sessions,setSessions]=useState([]), [session,setSession]=useState(null), [messages,setMessages]=useState([]);
  const [input,setInput]=useState(''), [picture,setPicture]=useState(null), [busy,setBusy]=useState(false), [uploading,setUploading]=useState(false);
  const [menu,setMenu]=useState(false), [error,setError]=useState(''), [deletion,setDeletion]=useState(null), [deleting,setDeleting]=useState(false);
  const bottom=useRef(null), abort=useRef(null), fileInput=useRef(null), textInput=useRef(null), sending=useRef(false), loading=useRef(false);
  const selected=sessions.find(x=>x.thread_id===session);
  const refresh=async()=>{const r=await api('/api/v1/chat/sessions');setSessions((await r.json()).sessions);};
  useEffect(()=>{refresh().catch(e=>setError(e.message));return()=>abort.current?.abort();},[]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[messages]);
  useEffect(()=>{if(!textInput.current)return;textInput.current.style.height='auto';textInput.current.style.height=Math.min(textInput.current.scrollHeight,140)+'px';},[input]);
  function newChat(){if(sending.current||uploading||loading.current)return;setSession(null);setMessages([]);setInput('');setPicture(null);setMenu(false);setError('');}
  async function open(id){
    if(sending.current||uploading||loading.current)return;
    loading.current=true;
    try{const data=await(await api(`/api/v1/chat/messages?thread_id=${encodeURIComponent(id)}`)).json();setMessages(data.messages.map(m=>({...m,...normalise(m.content)})));setSession(id);setPicture(null);setMenu(false);setError('');}catch(e){setError(e.message);}finally{loading.current=false;}
  }
  async function remove(){
    if(!deletion||busy||deleting)return;setDeleting(true);
    try{await api(`/api/v1/chat/messages?thread_id=${encodeURIComponent(deletion.thread_id)}`,{method:'DELETE'});if(session===deletion.thread_id)newChat();setDeletion(null);await refresh();}catch(e){setError(e.message);}finally{setDeleting(false);}
  }
  async function upload(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>10*1024*1024){setError('请选择不超过 10MB 的 JPG、PNG、WebP 或 GIF 图片');return;}
    setUploading(true);setError('');
    try{
      const filename=`ingredients/${crypto.randomUUID()}.${file.name.split('.').pop().toLowerCase()}`;
      const signature=await(await api(`/api/v1/oss/presign?filename=${encodeURIComponent(filename)}`)).json();
      const result=await fetch(signature.uploadUrl,{method:'PUT',headers:{'Content-Type':signature.contentType},body:file});
      if(!result.ok)throw new Error('图片上传失败，请检查 OSS 权限与跨域配置');
      setPicture({url:signature.accessUrl,name:file.name});
    }catch(e){setError(e.message);}finally{setUploading(false);}
  }
  async function send(event,suggestion){
    event?.preventDefault();if(sending.current||uploading||loading.current)return;
    const text=suggestion||input.trim()||(picture?'请根据图片中的食材推荐简单、营养的菜谱。':'');if(!text)return;
    sending.current=true;const id=session||crypto.randomUUID();setSession(id);setBusy(true);setError('');
    const image=picture?.url;setMessages(prev=>[...prev,{role:'user',text,image},{role:'assistant',text:''}]);setInput('');setPicture(null);abort.current=new AbortController();
    try{
      const response=await api('/api/v1/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.current.signal,body:JSON.stringify({message:text,image_url:image||null,thread_id:id})});
      const reader=response.body.getReader(),decoder=new TextDecoder();let answer='';
      while(true){const{done,value}=await reader.read();if(done){answer+=decoder.decode();break;}answer+=decoder.decode(value,{stream:true});setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{...m,text:answer}:m));}
      setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{...m,text:answer||'没有收到回答，请重试。'}:m));
    }catch(e){if(e.name!=='AbortError')setError(e.message);setMessages(prev=>prev.map((m,i)=>i===prev.length-1&&!m.text?{...m,text:e.name==='AbortError'?'已停止生成。':'回答未能生成，请重试。'}:m));}
    finally{sending.current=false;setBusy(false);abort.current=null;refresh().catch(e=>setError(e.message));}
  }
  const suggestions=[['十分钟晚餐','鸡蛋、番茄和米饭，十分钟能做什么？'],['高蛋白轻食','鸡胸肉和西兰花，推荐高蛋白低脂晚餐。'],['清空冰箱','有土豆、胡萝卜和豆腐，怎么搭配不浪费？']];
  return <div className="app">
    {menu&&<button className="backdrop" aria-label="关闭侧栏" onClick={()=>setMenu(false)}/>}
    <aside className={menu?'sidebar open':'sidebar'}>
      <a className="brand" href="/" onClick={e=>{e.preventDefault();newChat();}}><span className="logo"><ChefHat size={25}/></span><div><b>AI 私厨</b><small>你的每日餐桌灵感</small></div></a>
      <button className="new-chat" onClick={newChat} disabled={busy||uploading}><Plus size={18}/>开始新的料理</button>
      <div className="section-label">料理记录<button onClick={()=>refresh().catch(e=>setError(e.message))} title="刷新记录"><RefreshCw size={14}/></button></div>
      <div className="history">{!sessions.length&&<p className="empty">你的料理灵感会保存在这里</p>}{sessions.map(s=><div className={`history-row ${s.thread_id===session?'active':''}`} key={s.thread_id}><button disabled={busy||uploading} onClick={()=>open(s.thread_id)}><b>{s.title}</b><small>{new Date(s.updated_at).toLocaleDateString('zh-CN')}</small></button><button className="delete" title={`删除 ${s.title}`} aria-label={`删除 ${s.title}`} disabled={busy} onClick={()=>setDeletion(s)}><Trash2 size={15}/></button></div>)}</div>
      <div className="sidebar-foot"><Leaf size={18}/><div>好好吃饭，从现有食材开始<small>文字食材 · 图片识别 · 联网菜谱</small></div></div>
    </aside>
    <main><header><button className="mobile-menu" aria-label="打开历史记录" onClick={()=>setMenu(true)}><Menu/></button><div><b>{selected?.title||(messages.length?'今日料理咨询':'我的料理工作台')}</b><small>为你搭配简单、营养的每一餐</small></div><span className="header-tag"><ChefHat size={15}/> PERSONAL CHEF</span></header>
      <section className="chat-area">{!messages.length?<div className="welcome"><span className="eyebrow"><span/> EVERYDAY, A LITTLE DELICIOUS</span><h1>冰箱里的食材，<br/>也可以有<span>新灵感。</span></h1><p>告诉我有什么食材，或者拍张照片。<br/>一起把今天的“吃什么”，变成一道简单的好菜。</p><div className="feature-line"><span><ImagePlus size={16}/>看图识别食材</span><span><Leaf size={16}/>营养搭配</span><span><Clock size={16}/>简单易做</span></div><div className="suggestions">{suggestions.map(([label,text],i)=><button key={label} disabled={busy||uploading} onClick={e=>send(e,text)}><small>0{i+1} / {label}</small><strong>{text}</strong><ArrowUp size={18}/></button>)}</div><div className="welcome-note"><ChefHat size={18}/>让每一份食材都不被辜负</div></div>:<div className="messages">{messages.map((m,i)=><article key={i} className={`message ${m.role}`}>{m.role==='assistant'&&<span className="assistant-icon"><ChefHat size={19}/></span>}<div className="message-body">{m.image&&<img src={m.image} alt="上传的食材" referrerPolicy="no-referrer"/>}{m.role==='assistant'?(m.text?<ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>:<div className="thinking"><span/><span/><span/>正在为你整理食谱</div>):<p>{m.text}</p>}</div></article>)}<div ref={bottom}/></div>}</section>
      <footer>{error&&<div className="error" role="alert">{error}<button aria-label="关闭提示" onClick={()=>setError('')}><X size={15}/></button></div>}{picture&&<div className="attachment"><img src={picture.url} alt="待发送食材"/><span>{picture.name}</span><button aria-label="移除图片" onClick={()=>setPicture(null)}><X size={14}/></button></div>}<form className="composer" onSubmit={send}><textarea ref={textInput} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e);}}} disabled={busy} maxLength={8000} placeholder="今天有什么食材？也可以上传一张照片……" rows={1}/><div className="composer-bottom"><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={upload}/><button type="button" className="upload" onClick={()=>fileInput.current.click()} disabled={busy||uploading}><ImagePlus size={18}/>{uploading?'正在上传…':'添加食材照片'}</button><span>Enter 发送 · Shift + Enter 换行</span>{busy?<button type="button" className="send" aria-label="停止生成" onClick={()=>abort.current?.abort()}><Square size={17}/></button>:<button className="send" aria-label="发送" disabled={uploading||(!input.trim()&&!picture)}><ArrowUp size={21}/></button>}</div></form><p className="disclaimer">AI 建议仅供参考，请留意食物过敏、食材新鲜度与个人饮食需求。</p></footer>
    </main>
    {deletion&&<div className="modal-overlay"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><span className="danger-icon"><Trash2/></span><h2 id="delete-title">删除这份料理记录？</h2><p>“{deletion.title}”的所有对话将从服务器永久删除，无法恢复。</p><div><button disabled={deleting} onClick={()=>setDeletion(null)}>保留记录</button><button className="danger" disabled={deleting} onClick={remove}>{deleting?'正在删除…':'确认删除'}</button></div></div></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
