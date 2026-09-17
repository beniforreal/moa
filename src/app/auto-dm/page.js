'use client';

import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,ExternalLink,Instagram,MessageCircle,RefreshCw,Send,ShieldCheck,Zap} from 'lucide-react';
import styles from './page.module.css';

const fmt=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';

export default function AutoDmPage(){
  const [clients,setClients]=useState([]);
  const [accounts,setAccounts]=useState([]);
  const [clientId,setClientId]=useState('');
  const [posts,setPosts]=useState([]);
  const [account,setAccount]=useState(null);
  const [selectedId,setSelectedId]=useState('');
  const [form,setForm]=useState({enabled:false,keywords:'오디션',match:'contains',message:''});
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState('');
  const [syncError,setSyncError]=useState('');

  async function api(path,body){
    const response=await fetch('/api/'+path,{
      method:body?'POST':'GET',
      headers:{'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined,
      cache:'no-store'
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'요청에 실패했습니다.');
    return data;
  }

  const instagramClients=useMemo(()=>{
    const connected=new Set(accounts.filter(x=>x.platform==='instagram'&&x.status==='connected').map(x=>x.client_id));
    return clients.filter(x=>connected.has(x.id));
  },[clients,accounts]);

  async function loadPosts(id,{quiet=false}={}){
    if(!id)return;
    if(!quiet)setLoading(true);
    try{
      const result=await api('instagram-auto-dm?client_id='+encodeURIComponent(id));
      setPosts(result.posts||[]);
      setAccount(result.account||null);
      setSyncError(result.sync_error||'');
      if(result.imported>0)setToast(`Instagram 게시물 ${result.imported}개를 새로 불러왔습니다.`);
    }catch(e){
      setToast(e.message);
    }finally{
      if(!quiet)setLoading(false);
    }
  }

  useEffect(()=>{
    (async()=>{
      try{
        const status=await fetch('/api/auth/status',{cache:'no-store'}).then(r=>r.json());
        if(!status.authenticated){window.location.assign('/');return}
        const data=await api('data');
        setClients(data.clients||[]);
        setAccounts(data.accounts||[]);
        const connected=(data.clients||[]).find(c=>(data.accounts||[]).some(a=>a.client_id===c.id&&a.platform==='instagram'&&a.status==='connected'));
        if(connected)setClientId(connected.id);
        else setLoading(false);
      }catch(e){
        setToast(e.message||'데이터를 불러오지 못했습니다.');
        setLoading(false);
      }
    })();
  },[]);

  useEffect(()=>{if(clientId){setSelectedId('');loadPosts(clientId)}},[clientId]);
  useEffect(()=>{if(toast){const id=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(id)}},[toast]);

  const selected=posts.find(x=>x.id===selectedId);
  function selectPost(post){
    setSelectedId(post.id);
    setForm({
      enabled:!!post.auto_dm_enabled,
      keywords:(post.auto_dm_keywords||[]).join(', ')||'오디션',
      match:post.auto_dm_match||'contains',
      message:post.auto_dm_message||''
    });
  }

  async function save(e){
    e.preventDefault();
    if(!selected||busy)return;
    setBusy(true);
    try{
      await api('instagram-auto-dm',{
        action:'save',
        post_id:selected.id,
        enabled:form.enabled,
        keywords:form.keywords,
        match:form.match,
        message:form.message
      });
      await loadPosts(clientId,{quiet:true});
      setToast(form.enabled?'자동 DM을 켰습니다.':'자동 DM을 껐습니다.');
    }catch(e){setToast(e.message)}
    finally{setBusy(false)}
  }

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/" className={styles.back}><ArrowLeft size={17}/>MOA</a>
      <div className={styles.brand}><span><Zap size={16}/></span>댓글 자동 DM</div>
    </header>

    <section className={styles.hero}>
      <div><span className={styles.eyebrow}>INSTAGRAM AUTOMATION</span><h1>댓글 키워드 → 자동 DM</h1><p>게시물마다 키워드와 메시지를 저장해 두면, 해당 키워드가 포함된 댓글에만 자동으로 1회 DM을 보냅니다.</p></div>
      <div className={styles.flow}><span>댓글 <b>“오디션”</b></span><i>→</i><span>MOA 감지</span><i>→</i><span>저장한 DM 전송</span></div>
    </section>

    <div className={styles.notice}><ShieldCheck size={20}/><div><b>자동화 범위가 분리되어 있습니다.</b><p>일반 댓글·DM 답변은 기존처럼 사람 승인 후 전송됩니다. 이 화면에서 직접 활성화한 Instagram 게시물의 키워드 댓글만 자동 전송합니다.</p></div></div>

    <section className={styles.toolbar}>
      <label>Instagram 고객사
        <select value={clientId} onChange={e=>setClientId(e.target.value)}>
          {!instagramClients.length&&<option value="">연결된 Instagram 없음</option>}
          {instagramClients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className={styles.account}>{account?.username?<><Instagram size={17}/><b>@{account.username}</b></>:<span>Instagram 계정을 먼저 연결해 주세요.</span>}</div>
      <button className={styles.refresh} disabled={!clientId||loading} onClick={()=>loadPosts(clientId)}><RefreshCw size={16}/>{loading?'불러오는 중':'최근 게시물 새로고침'}</button>
    </section>

    {syncError&&<div className={styles.error}>최근 Instagram 게시물 동기화는 실패했습니다. 기존에 불러온 게시물은 계속 설정할 수 있습니다. · {syncError}</div>}

    <div className={styles.grid}>
      <section className={styles.postsPanel}>
        <div className={styles.panelTitle}><div><h2>Instagram 게시물</h2><p>최근 게시물·릴스를 불러와 자동 DM을 설정할 게시물을 선택하세요.</p></div><span>{posts.length}</span></div>
        {loading?<div className={styles.empty}>Instagram 게시물을 불러오는 중입니다.</div>:
        posts.length?<div className={styles.postList}>{posts.map(post=><button key={post.id} className={`${styles.postCard} ${selectedId===post.id?styles.selected:''}`} onClick={()=>selectPost(post)}>
          <div className={styles.postTop}><span className={post.auto_dm_enabled?styles.on:styles.off}>{post.auto_dm_enabled?'자동 DM ON':'OFF'}</span><small>{fmt(post.scheduled_at||post.created_at)}</small></div>
          <b>{post.title||'Instagram 게시물'}</b>
          <p>{post.body||'캡션 없음'}</p>
          <div className={styles.postBottom}><span><MessageCircle size={14}/>전송 {post.auto_dm_sent_count||0}건</span>{post.external_url&&<a href={post.external_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>Instagram <ExternalLink size={13}/></a>}</div>
        </button>)}</div>:<div className={styles.empty}>{clientId?'가져온 Instagram 게시물이 없습니다. 새로고침을 눌러 확인해 주세요.':'Instagram이 연결된 고객사가 없습니다.'}</div>}
      </section>

      <section className={styles.configPanel}>
        {selected?<form onSubmit={save}>
          <div className={styles.panelTitle}><div><span className={styles.eyebrow}>AUTOMATION RULE</span><h2>자동 DM 설정</h2></div><label className={styles.switch}><input type="checkbox" checked={form.enabled} onChange={e=>setForm(v=>({...v,enabled:e.target.checked}))}/><span></span><b>{form.enabled?'사용':'중지'}</b></label></div>

          <div className={styles.selectedPost}><Instagram size={18}/><div><small>선택한 게시물</small><b>{selected.title}</b></div></div>

          <label className={styles.field}>댓글 키워드 <small>쉼표로 최대 10개</small>
            <input value={form.keywords} onChange={e=>setForm(v=>({...v,keywords:e.target.value}))} placeholder="오디션, 지원, 모델"/>
          </label>
          <label className={styles.field}>키워드 일치 방식
            <select value={form.match} onChange={e=>setForm(v=>({...v,match:e.target.value}))}>
              <option value="contains">댓글에 키워드가 포함되면</option>
              <option value="exact">댓글 전체가 키워드와 정확히 같으면</option>
            </select>
          </label>
          <label className={styles.field}>자동으로 보낼 DM <small>{form.message.length}/1000</small>
            <textarea maxLength={1000} rows={8} value={form.message} onChange={e=>setForm(v=>({...v,message:e.target.value}))} placeholder={'안녕하세요! 요청하신 청소년 모델 모집 정보를 보내드려요.\n\n모집 내용 및 신청 👉 https://...\n\n지원 조건을 확인한 뒤 본인이 직접 신청해 주세요.'}/>
          </label>

          <div className={styles.preview}><span>미리보기</span><div><b>댓글: 오디션</b><p>{form.message||'저장한 메시지가 이곳에 표시됩니다.'}</p></div></div>

          <button className={styles.save} disabled={busy}><Send size={16}/>{busy?'저장 중...':'자동 DM 설정 저장'}</button>
          <p className={styles.ruleNote}>같은 댓글에는 Private Reply를 한 번만 전송합니다. 사용자가 답장을 보내면 이후 대화는 MOA 통합 댓글함에서 기존 승인 방식으로 이어집니다.</p>
        </form>:<div className={styles.emptyConfig}><MessageCircle size={34}/><h2>게시물을 선택하세요</h2><p>왼쪽에서 게시물 또는 릴스를 고르면 키워드와 자동 DM 내용을 저장할 수 있습니다.</p></div>}
      </section>
    </div>

    {toast&&<div className={styles.toast}><Check size={16}/>{toast}</div>}
  </main>
}
