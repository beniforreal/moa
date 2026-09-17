'use client';

import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,ExternalLink,Instagram,MessageCircle,RefreshCw,Send,ShieldCheck,UserRound,Zap} from 'lucide-react';
import styles from './page.module.css';

const fmt=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';

export default function AutoDmPage(){
  const [clients,setClients]=useState([]);
  const [accounts,setAccounts]=useState([]);
  const [clientId,setClientId]=useState('');
  const [posts,setPosts]=useState([]);
  const [history,setHistory]=useState([]);
  const [account,setAccount]=useState(null);
  const [selectedId,setSelectedId]=useState('');
  const [form,setForm]=useState({enabled:false,keywords:'오디션',match:'contains',message:''});
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState('');
  const [syncError,setSyncError]=useState('');
  const [subscriptionError,setSubscriptionError]=useState('');

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
      setHistory(result.history||[]);
      setAccount(result.account||null);
      setSyncError(result.sync_error||'');
      setSubscriptionError(result.subscription_error||'');
      if(result.recovery?.sent>0)setToast(`누락 댓글을 복구해 자동 DM ${result.recovery.sent}건을 전송했습니다.`);
      else if(result.recovery?.failed>0)setToast(`자동 DM 복구 중 ${result.recovery.failed}건이 실패했습니다. 발송 현황에서 확인하세요.`);
      else if(result.imported>0)setToast(`Instagram 게시물 ${result.imported}개를 새로 불러왔습니다.`);
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

  useEffect(()=>{if(clientId){setSelectedId('');setHistory([]);loadPosts(clientId)}},[clientId]);
  useEffect(()=>{if(toast){const id=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(id)}},[toast]);

  const selected=posts.find(x=>x.id===selectedId);
  const selectedHistory=useMemo(()=>selectedId?history.filter(x=>x.post_id===selectedId):history,[history,selectedId]);
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
      setToast(form.enabled?'이 게시물의 자동 DM 설정을 저장했습니다. 다른 게시물과 독립적으로 동작합니다.':'이 게시물의 자동 DM을 껐습니다.');
    }catch(e){setToast(e.message)}
    finally{setBusy(false)}
  }

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/" className={styles.back}><ArrowLeft size={17}/>MOA</a>
      <div className={styles.brand}><span><Zap size={16}/></span>댓글 자동 DM</div>
    </header>

    <section className={styles.hero}>
      <div><span className={styles.eyebrow}>INSTAGRAM AUTOMATION</span><h1>댓글 키워드 → 자동 DM</h1><p>게시물마다 키워드와 메시지를 따로 저장합니다. 게시글 A와 게시글 B에 서로 다른 키워드·DM을 설정해도 각각 독립적으로 발송됩니다.</p></div>
      <div className={styles.flow}><span>댓글 <b>“오디션”</b></span><i>→</i><span>해당 게시물 규칙 확인</span><i>→</i><span>그 게시물의 DM 전송</span></div>
    </section>

    <div className={styles.notice}><ShieldCheck size={20}/><div><b>게시물별 자동화입니다.</b><p>일반 댓글·DM 답변은 기존처럼 사람 승인 후 전송됩니다. 이 화면에서 직접 활성화한 Instagram 게시물에만 저장된 키워드와 메시지가 적용됩니다.</p></div></div>

    <section className={styles.toolbar}>
      <label>Instagram 고객사
        <select value={clientId} onChange={e=>setClientId(e.target.value)}>
          {!instagramClients.length&&<option value="">연결된 Instagram 없음</option>}
          {instagramClients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className={styles.account}>{account?.username?<><Instagram size={17}/><b>@{account.username}</b></>:<span>Instagram 계정을 먼저 연결해 주세요.</span>}</div>
      <button className={styles.refresh} disabled={!clientId||loading} onClick={()=>loadPosts(clientId)}><RefreshCw size={16}/>{loading?'확인 중':'게시물·댓글 새로고침'}</button>
    </section>

    {subscriptionError&&<div className={styles.error}>Instagram 댓글 Webhook 구독 확인 실패 · {subscriptionError}</div>}
    {syncError&&<div className={styles.error}>최근 Instagram 게시물 동기화는 실패했습니다. 기존에 불러온 게시물은 계속 설정할 수 있습니다. · {syncError}</div>}

    <div className={styles.grid}>
      <section className={styles.postsPanel}>
        <div className={styles.panelTitle}><div><h2>Instagram 게시물</h2><p>각 게시물을 선택해 서로 다른 키워드와 DM 내용을 저장하세요.</p></div><span>{posts.length}</span></div>
        {loading?<div className={styles.empty}>Instagram 게시물과 댓글을 확인하는 중입니다.</div>:
        posts.length?<div className={styles.postList}>{posts.map(post=><button key={post.id} className={`${styles.postCard} ${selectedId===post.id?styles.selected:''}`} onClick={()=>selectPost(post)}>
          <div className={styles.postTop}><span className={post.auto_dm_enabled?styles.on:styles.off}>{post.auto_dm_enabled?'자동 DM ON':'OFF'}</span><small>{fmt(post.scheduled_at||post.created_at)}</small></div>
          <b>{post.title||'Instagram 게시물'}</b>
          <p>{post.body||'캡션 없음'}</p>
          <div className={styles.postBottom}><span><MessageCircle size={14}/>전송 {post.auto_dm_sent_count||0}건</span>{post.external_url&&<a href={post.external_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>Instagram <ExternalLink size={13}/></a>}</div>
        </button>)}</div>:<div className={styles.empty}>{clientId?'가져온 Instagram 게시물이 없습니다. 새로고침을 눌러 확인해 주세요.':'Instagram이 연결된 고객사가 없습니다.'}</div>}
      </section>

      <section className={styles.configPanel}>
        {selected?<form onSubmit={save}>
          <div className={styles.panelTitle}><div><span className={styles.eyebrow}>AUTOMATION RULE</span><h2>이 게시물 자동 DM</h2></div><label className={styles.switch}><input type="checkbox" checked={form.enabled} onChange={e=>setForm(v=>({...v,enabled:e.target.checked}))}/><span></span><b>{form.enabled?'사용':'중지'}</b></label></div>

          <div className={styles.selectedPost}><Instagram size={18}/><div><small>선택한 게시물</small><b>{selected.title}</b></div></div>

          <label className={styles.field}>댓글 키워드 <small>이 게시물에만 적용 · 쉼표로 최대 10개</small>
            <input value={form.keywords} onChange={e=>setForm(v=>({...v,keywords:e.target.value}))} placeholder="오디션, 지원, 모델"/>
          </label>
          <label className={styles.field}>키워드 일치 방식
            <select value={form.match} onChange={e=>setForm(v=>({...v,match:e.target.value}))}>
              <option value="contains">댓글에 키워드가 포함되면</option>
              <option value="exact">댓글 전체가 키워드와 정확히 같으면</option>
            </select>
          </label>
          <label className={styles.field}>자동으로 보낼 DM <small>이 게시물 전용 · {form.message.length}/1000</small>
            <textarea maxLength={1000} rows={8} value={form.message} onChange={e=>setForm(v=>({...v,message:e.target.value}))} placeholder={'안녕하세요! 요청하신 정보를 보내드려요.\n\n신청 👉 https://...'}/>
          </label>

          <div className={styles.preview}><span>이 게시물의 발송 미리보기</span><div><b>댓글: {(form.keywords.split(',')[0]||'오디션').trim()}</b><p>{form.message||'저장한 메시지가 이곳에 표시됩니다.'}</p></div></div>

          <button className={styles.save} disabled={busy}><Send size={16}/>{busy?'저장 중...':'이 게시물 자동 DM 저장'}</button>
          <p className={styles.ruleNote}>다른 게시물의 설정은 변경되지 않습니다. 같은 댓글에는 자동 DM을 한 번만 시도합니다.</p>

          <div className={styles.historyBlock}>
            <div className={styles.historyTitle}><div><span className={styles.eyebrow}>DELIVERY STATUS</span><h3>이 게시물 발송 현황</h3></div><b>{selectedHistory.length}건</b></div>
            {selectedHistory.length?<div className={styles.historyList}>{selectedHistory.map(x=><div className={styles.historyRow} key={x.id}>
              <span className={styles.userIcon}><UserRound size={15}/></span>
              <div className={styles.historyMain}><b>@{x.author}</b><p>{x.body}</p><small>키워드 · {x.keyword||'-'} · {fmt(x.sent_at||x.failed_at||x.created_at)}</small>{x.error&&<em>{x.error}</em>}</div>
              <span className={`${styles.deliveryBadge} ${x.status==='sent'?styles.deliverySent:styles.deliveryFailed}`}>{x.status==='sent'?'전송 완료':'실패'}</span>
            </div>)}</div>:<div className={styles.historyEmpty}>아직 이 게시물에서 자동 DM을 보낸 사용자가 없습니다.</div>}
          </div>
        </form>:<div className={styles.emptyConfig}><MessageCircle size={34}/><h2>게시물을 선택하세요</h2><p>왼쪽에서 게시물 또는 릴스를 고르면 그 게시물만의 키워드·메시지와 발송 현황을 확인할 수 있습니다.</p></div>}
      </section>
    </div>

    {toast&&<div className={styles.toast}><Check size={16}/>{toast}</div>}
  </main>
}
