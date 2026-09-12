'use client';
import {useEffect,useMemo,useState} from 'react';
import {
  LayoutDashboard,PenLine,Inbox,Building2,Settings,Plus,ArrowRight,Search,Bell,Check,Send,
  Sparkles,Instagram,ExternalLink,LockKeyhole,X,Menu,RefreshCw,ShieldCheck,MessageCircle,
  FileText,Link2,KeyRound,Database,Zap,Cloud,Copy
} from 'lucide-react';

const EMPTY={clients:[],posts:[],comments:[],accounts:[],notifications:[]};
const labels={draft:'초안',planned:'일정 등록',published:'발행 완료',publishing:'발행 중',new:'미답변',approved:'승인 완료',sending:'전송 중',sent:'답변 완료',failed:'확인 필요'};

const nav=[
  ['dashboard','대시보드',LayoutDashboard],
  ['posts','게시물 관리',PenLine],
  ['inbox','통합 댓글함',Inbox],
  ['clients','고객사 관리',Building2],
  ['settings','채널 연결',Settings]
];

const names={dashboard:'대시보드',posts:'게시물 관리',inbox:'통합 댓글함',clients:'고객사 관리',settings:'채널 연결'};

function Badge({status}){return <span className={'badge '+status}>{labels[status]||status}</span>}

function Channel({platform,small=false}){
  const cls='channel '+platform+(small?' small':'');
  if(platform==='naver')return <span className={cls}><b>N</b>{!small&&'네이버 블로그'}</span>;
  if(platform==='channel_talk')return <span className={cls}><MessageCircle size={small?13:16}/>{!small&&'카카오 상담톡'}</span>;
  return <span className={cls}><Instagram size={small?13:16}/>{!small&&'Instagram'}</span>;
}

function Empty({text='아직 실제 데이터가 없습니다.'}){return <div className="empty"><Inbox size={30}/><p>{text}</p></div>}

const fmt=d=>d?new Date(d).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';

export default function App(){
  const [data,setData]=useState(EMPTY);
  const [config,setConfig]=useState(null);
  const [view,setView]=useState('dashboard');
  const [client,setClient]=useState('all');
  const [modal,setModal]=useState(null);
  const [toast,setToast]=useState('');
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState('');
  const [draft,setDraft]=useState('');
  const [search,setSearch]=useState('');
  const [mobile,setMobile]=useState(false);

  async function api(path,body,options={}){
    const r=await fetch('/api/'+path,{
      method:body?'POST':'GET',
      headers:{'Content-Type':'application/json',...(options.headers||{})},
      body:body?JSON.stringify(body):undefined,
      cache:'no-store'
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'요청에 실패했습니다.');
    return d;
  }

  async function refresh(){
    const [d,c]=await Promise.all([api('data'),api('config')]);
    setData(d);setConfig(c);
    if(!selected&&d.comments?.[0]?.id)setSelected(d.comments[0].id);
  }

  useEffect(()=>{refresh().catch(e=>setToast(e.message))},[]);
  useEffect(()=>{if(toast){const id=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(id)}},[toast]);

  const filteredClients=useMemo(()=>data.clients.filter(c=>client==='all'||c.id===client),[data.clients,client]);
  const posts=useMemo(()=>data.posts.filter(p=>client==='all'||p.client_id===client),[data.posts,client]);
  const comments=useMemo(()=>data.comments.filter(c=>client==='all'||c.client_id===client),[data.comments,client]);
  const pending=comments.filter(x=>x.status!=='sent');
  const item=data.comments.find(x=>x.id===selected);
  const cName=id=>data.clients.find(c=>c.id===id)?.name||'고객사';

  useEffect(()=>{setDraft(item?.draft||'')},[item?.id,item?.draft]);

  function go(v){setView(v);setMobile(false);setSearch('')}
  async function run(fn){if(busy)return;setBusy(true);try{await fn()}catch(e){setToast(e.message)}finally{setBusy(false)}}

  async function saveClient(e){
    e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));
    await run(async()=>{await api('clients',{...b,id:modal?.item?.id});await refresh();setModal(null);setToast('고객사 정보를 저장했습니다.')});
  }

  async function savePost(e){
    e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));
    if(b.scheduled_at)b.scheduled_at=new Date(b.scheduled_at+'+09:00').toISOString();
    await run(async()=>{await api('posts',{...b,id:modal?.item?.id});await refresh();setModal(null);setToast('게시물을 저장했습니다.')});
  }

  async function reply(action){
    if(!item)return;
    await run(async()=>{
      const d=await api('reply/'+action,{id:item.id,text:draft});
      if(d.draft)setDraft(d.draft);
      await refresh();
      setToast(action==='generate'?'AI 답변 초안을 만들었습니다.':action==='approve'?'답변을 승인했습니다.':action==='send'?'전송을 요청했습니다.':'초안을 저장했습니다.');
    });
  }

  const account=(clientId,platform)=>data.accounts.find(a=>a.client_id===clientId&&a.platform===platform);

  return <div className="shell">
    <aside className={'sidebar '+(mobile?'open':'')}>
      <a className="brand" href="/" aria-label="모아 홈"><span className="brand-mark">m<span>•</span></span><strong>모아<span>moa</span></strong></a>
      <div className="workspace"><span className="workspace-icon">P</span><span><b>개인 운영 워크스페이스</b><small>박찬양 · 마케팅 대행</small></span></div>
      <span className="nav-label">WORKSPACE</span>
      <nav>{nav.map(([id,name,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>go(id)}><Icon size={19}/><span>{name}</span>{id==='inbox'&&pending.length>0&&<b className="count">{pending.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="approval-note"><ShieldCheck size={21}/><b>답변은 항상 승인 후 전송</b><p>AI는 초안만 만들고<br/>최종 전송은 직접 승인합니다.</p></div>
        <div className="profile"><span className="avatar">박</span><span><b>단일 운영자</b><small>앱 내부 로그인 없음</small></span></div>
      </div>
    </aside>

    <div className="main">
      <header className="topbar">
        <div className="row"><button className="icon-btn mobile-menu" onClick={()=>setMobile(!mobile)} aria-label="메뉴"><Menu size={21}/></button><span className="breadcrumb">워크스페이스 <span>/</span> <b>{names[view]}</b></span></div>
        <div className="top-actions"><span className="mode-pill live">LIVE DATA ONLY</span><button className="icon-btn" onClick={()=>run(refresh)} aria-label="새로고침"><RefreshCw size={18}/></button><button className="icon-btn" onClick={()=>setModal({type:'notifications'})} aria-label="알림"><Bell size={19}/>{data.notifications.length>0&&<i/>}</button><span className="avatar small">박</span></div>
      </header>

      <main>
        <div className="page-heading">
          <div><div className="eyebrow">YOUR SOCIAL WORKSPACE</div><h1>{view==='dashboard'?'실제 채널 데이터만 한곳에.':names[view]}</h1><p>{view==='dashboard'?'가상 데이터 없이 Instagram, 네이버 블로그, 카카오 상담 데이터를 모읍니다.':view==='settings'?'서비스별 공식 연결 방식과 수집기를 관리합니다.':view==='inbox'?'실제 댓글과 상담 메시지만 표시합니다.':'운영 중인 실제 데이터를 관리합니다.'}</p></div>
          {view==='clients'?<button className="primary" onClick={()=>setModal({type:'client'})}><Plus size={18}/>고객사 추가</button>:view==='posts'?<button className="primary" disabled={!data.clients.length} onClick={()=>setModal({type:'post'})}><Plus size={18}/>게시물 작성</button>:null}
        </div>

        {view!=='settings'&&<div className="filterbar">
          <div className="select-wrap"><Building2 size={17}/><select value={client} onChange={e=>setClient(e.target.value)}><option value="all">모든 고객사</option>{data.clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div>
          <span className="muted">Supabase 실제 데이터 · {new Date().toLocaleDateString('ko-KR')}</span>
        </div>}

        {view==='dashboard'&&<>
          <div className="stats-grid">
            <div className="stat"><div className="row"><span>관리 고객사</span><Building2 size={20}/></div><strong>{filteredClients.length}<small> 곳</small></strong><p>현재 등록된 실제 고객사</p></div>
            <div className="stat"><div className="row"><span>작성 중 콘텐츠</span><FileText size={20}/></div><strong>{posts.filter(p=>['draft','planned'].includes(p.status)).length}<small> 건</small></strong><p>초안 및 일정 등록</p></div>
            <div className="stat stat-2"><div className="row"><span>답변 필요</span><MessageCircle size={20}/></div><strong>{pending.length}<small> 건</small></strong><p>수집된 미답변 대화</p></div>
            <div className="stat"><div className="row"><span>발행 완료</span><Check size={20}/></div><strong>{posts.filter(p=>p.status==='published').length}<small> 건</small></strong><p>실제 발행 기록</p></div>
          </div>
          <div className="dashboard-grid">
            <section className="panel"><div className="section-title"><h2>최근 콘텐츠</h2><button className="text-link" onClick={()=>go('posts')}>전체 보기 <ArrowRight size={15}/></button></div>{posts.length?<div className="simple-list">{posts.slice(0,5).map(p=><button key={p.id} onClick={()=>setModal({type:'detail',item:p})}><span><Channel platform={p.platform} small/><b>{p.title}</b></span><Badge status={p.status}/></button>)}</div>:<Empty text="실제 콘텐츠가 아직 없습니다."/>}</section>
            <section className="panel"><div className="section-title"><h2>답변을 기다리는 대화 <span className="number">{pending.length}</span></h2><button className="text-link" onClick={()=>go('inbox')}>댓글함 <ArrowRight size={15}/></button></div>{pending.length?<div className="simple-list">{pending.slice(0,5).map(m=><button key={m.id} onClick={()=>{setSelected(m.id);go('inbox')}}><span><Channel platform={m.platform} small/><b>{m.author}</b><small>{m.body}</small></span><Badge status={m.status}/></button>)}</div>:<Empty text="수집된 미답변 대화가 없습니다."/>}</section>
          </div>
        </>}

        {view==='posts'&&<section className="panel list-panel">
          <div className="section-title"><h2>게시물</h2><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="제목 검색"/></div></div>
          {posts.filter(p=>p.title.toLowerCase().includes(search.toLowerCase())).length?<div className="table-list">{posts.filter(p=>p.title.toLowerCase().includes(search.toLowerCase())).map(p=><button key={p.id} onClick={()=>setModal({type:'detail',item:p})}><Channel platform={p.platform}/><span className="grow"><b>{p.title}</b><small>{cName(p.client_id)} · {fmt(p.scheduled_at||p.created_at)}</small></span><Badge status={p.status}/></button>)}</div>:<Empty text="등록된 실제 게시물이 없습니다."/>}
        </section>}

        {view==='inbox'&&<section className="inbox-layout panel">
          <div className="conversation-list">
            <div className="inbox-filters"><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="대화 검색"/></div></div>
            {comments.filter(c=>(c.body+c.author).toLowerCase().includes(search.toLowerCase())).map(c=><button className={'conversation '+(selected===c.id?'selected':'')} key={c.id} onClick={()=>setSelected(c.id)}><div className="row"><span className="row"><Channel platform={c.platform} small/><b>{c.author}</b></span><Badge status={c.status}/></div><p>{c.body}</p><small>{cName(c.client_id)} · {fmt(c.created_at)}</small></button>)}
            {!comments.length&&<Empty text="채널을 연결하면 실제 댓글과 상담이 여기에 표시됩니다."/>}
          </div>
          <div className="conversation-detail">
            {item?<><div className="detail-head"><div><h2>{item.author}</h2><span className="muted">{cName(item.client_id)} · <Channel platform={item.platform}/></span></div><Badge status={item.status}/></div>
              <div className="message-context">{item.context||'수집된 대화'}{item.context_url&&<a href={item.context_url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> 원문</a>}</div>
              <div className="incoming"><span className="letter-avatar">{item.author?.slice(0,1)||'?'}</span><div><b>{item.author}</b><p>{item.body}</p><small>{fmt(item.created_at)}</small></div></div>
              <div className="reply-area"><div className="section-title"><h3><Sparkles size={18}/>답변 작성</h3><button className="ai-button" disabled={busy||['sent','sending'].includes(item.status)} onClick={()=>reply('generate')}><Sparkles size={15}/>AI 답변 추천</button></div>
                <textarea value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)} placeholder="AI 추천을 받거나 직접 답변을 작성하세요." disabled={['sent','sending'].includes(item.status)}/>
                <div className="approval-steps"><span className={draft?'done':''}>1 작성</span><ArrowRight size={14}/><span className={item.status==='approved'||item.status==='sent'?'done':''}>2 승인</span><ArrowRight size={14}/><span className={item.status==='sent'?'done':''}>3 전송</span></div>
                <div className="reply-actions"><button className="secondary" disabled={busy||!draft.trim()} onClick={()=>reply('save')}>초안 저장</button><div className="row"><button className="secondary" disabled={busy||!draft.trim()} onClick={()=>reply('approve')}><Check size={16}/>승인</button><button className="primary" disabled={busy||item.status!=='approved'||draft!==item.approved_text} onClick={()=>reply('send')}><Send size={15}/>승인 답변 전송</button></div></div>
                {item.platform==='channel_talk'&&<p className="notice">채널톡은 현재 수신·AI 초안·승인 기반까지 연결했습니다. 메시지 전송 API는 채널의 OpenAPI 권한 확인 후 활성화됩니다.</p>}
              </div>
            </>:<Empty text="왼쪽에서 실제 대화를 선택해 주세요."/>}
          </div>
        </section>}

        {view==='clients'&&<div className="client-grid">
          {filteredClients.map(c=><article className="panel client-card" key={c.id}><div className="row"><span className="client-avatar">{c.name.slice(0,1)}</span><button className="secondary" onClick={()=>setModal({type:'client',item:c})}>수정</button></div><h2>{c.name}</h2><p className="muted">{c.category||'업종 미등록'}</p><div className="client-policy"><small>브랜드 말투</small><p>{c.tone||'미등록'}</p><small>응대 정책</small><p>{c.policy||'미등록'}</p></div><button className="text-link" onClick={()=>{setClient(c.id);go('settings')}}>채널 연결 관리 <ArrowRight size={15}/></button></article>)}
          {!data.clients.length&&<Empty text="첫 실제 고객사를 등록해 주세요."/>}
        </div>}

        {view==='settings'&&<>
          <div className="panel setting-status"><div><h2>실제 채널 연결</h2><p className="muted">앱 로그인은 없습니다. 서비스별 인증정보는 아래 방식으로만 연결합니다.</p></div><div className="row"><span className={'badge '+(config?.configured?'published':'failed')}>{config?.configured?'Supabase 연결됨':'Supabase 설정 필요'}</span><span className={'badge '+(config?.vault?'published':'failed')}>{config?.vault?'암호화 키 설정됨':'암호화 키 필요'}</span></div></div>

          {!data.clients.length&&<div className="info-box"><Building2 size={23}/><div><b>먼저 고객사를 등록하세요.</b><p>채널 인증정보는 고객사별로 분리 저장합니다.</p></div></div>}

          <div className="integration-grid three">
            <section className="panel integration">
              <div className="section-title"><Channel platform="instagram"/><span className="badge published">공식 OAuth</span></div><h2>Instagram</h2><p className="muted">아이디·비밀번호를 저장하지 않습니다. Meta/Instagram OAuth 인증으로 게시물·댓글·DM을 연결합니다.</p>
              {filteredClients.map(c=>{const a=account(c.id,'instagram');return <div className="account-row" key={c.id}><div className="row"><b>{c.name}</b><span className={'badge '+(a?.status==='connected'?'published':'')}>{a?.status==='connected'?'연결됨':'미연결'}</span></div><small>{a?.username?'@'+a.username:'Instagram 인증 필요'}</small><button className="primary compact" disabled={!config?.instagram||busy} onClick={()=>run(async()=>{const d=await api('instagram/connect',{client_id:c.id});window.location.assign(d.url)})}><Instagram size={15}/>Instagram 인증</button></div>})}
              <p className="safety-note"><LockKeyhole size={14}/>Vercel에는 META_APP_ID, META_APP_SECRET, META_GRAPH_VERSION, META_WEBHOOK_VERIFY_TOKEN, APP_URL이 필요합니다.</p>
            </section>

            <section className="panel integration">
              <div className="section-title"><Channel platform="naver"/><span className="badge planned">로컬 브라우저 수집</span></div><h2>네이버 블로그</h2><p className="muted">댓글·알림용 공식 API가 없어 웹 서버에 네이버 비밀번호를 저장하지 않습니다. 내 PC의 로그인된 네이버 브라우저 세션을 로컬 수집기가 사용합니다.</p>
              {filteredClients.map(c=>{const a=account(c.id,'naver');return <div className="account-row" key={c.id}><div className="row"><b>{c.name}</b><span className="badge">{a?.status==='connected'?'수집기 연결됨':a?.status==='waiting_for_collector'?'수집기 대기':'미설정'}</span></div><small>{a?.username||'블로그 ID 미등록'}</small><button className="secondary compact" onClick={()=>setModal({type:'naver',client:c,account:a})}><KeyRound size={15}/>블로그 ID / 수집기 설정</button></div>})}
              <p className="safety-note"><ShieldCheck size={14}/>네이버 로그인은 MOA 웹에 입력하지 않고 로컬 브라우저에서 직접 합니다.</p>
            </section>

            <section className="panel integration">
              <div className="section-title"><Channel platform="channel_talk"/><span className="badge planned">채널톡 OpenAPI</span></div><h2>카카오톡 채널</h2><p className="muted">카카오 상담톡을 채널톡에 연결하고, MOA는 채널톡 OpenAPI/Webhook을 통해 상담 데이터를 받는 구조입니다.</p>
              {filteredClients.map(c=>{const a=account(c.id,'channel_talk');return <div className="account-row" key={c.id}><div className="row"><b>{c.name}</b><span className={'badge '+(a?.status==='connected'?'published':'')}>{a?.status==='connected'?'API 확인됨':a?.configured?'키 저장됨':'미설정'}</span></div><small>{a?.username||'채널톡 Access Key/Secret 필요'}</small><button className="secondary compact" disabled={!config?.vault} onClick={()=>setModal({type:'channel',client:c,account:a})}><KeyRound size={15}/>OpenAPI 키 설정</button></div>})}
              <p className="safety-note"><Cloud size={14}/>채널톡 OpenAPI는 유료 플랜 기능입니다. 카카오 상담톡은 별도 사용량 과금이 적용될 수 있습니다.</p>
            </section>
          </div>

          <div className="setup-grid">
            <div className="info-box"><Database size={23}/><div><b>Supabase</b><p>고객사, 게시물, 실제 수집 대화, 채널 설정만 저장합니다. 현재 가상 데이터는 사용하지 않습니다.</p></div></div>
            <div className="info-box"><Zap size={23}/><div><b>네이버 로컬 수집기</b><p>COLLECTOR_SHARED_SECRET으로 MOA API와 통신합니다. 첫 실행에서 네이버 브라우저 로그인만 직접 진행합니다.</p></div></div>
          </div>
        </>}

        <footer>모아 <span>·</span> 실제 운영 데이터 기반 SNS 워크스페이스 <span className="footer-right">SINGLE OPERATOR</span></footer>
      </main>
    </div>

    {toast&&<div className="toast"><Check size={18}/>{toast}<button onClick={()=>setToast('')}><X size={16}/></button></div>}

    {modal&&<div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}><section className={'modal '+(modal.type==='post'?'wide':'')}>
      <button className="modal-close icon-btn" onClick={()=>setModal(null)}><X size={22}/></button>

      {modal.type==='client'&&<form onSubmit={saveClient}><span className="eyebrow">CLIENT PROFILE</span><h2>{modal.item?'고객사 수정':'고객사 추가'}</h2><label>고객사명<input name="name" required defaultValue={modal.item?.name}/></label><label>업종<input name="category" defaultValue={modal.item?.category}/></label><label>브랜드 말투<input name="tone" defaultValue={modal.item?.tone}/></label><label>응대 정책<textarea name="policy" rows={5} defaultValue={modal.item?.policy}/></label><button className="primary full" disabled={busy}>저장</button></form>}

      {modal.type==='post'&&<form onSubmit={savePost}><span className="eyebrow">CONTENT</span><h2>게시물 작성</h2><div className="form-grid"><label>고객사<select name="client_id" required defaultValue={client==='all'?data.clients[0]?.id:client}>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>채널<select name="platform"><option value="instagram">Instagram</option><option value="naver">네이버 블로그</option></select></label></div><label>제목<input name="title" required/></label><label>본문<textarea name="body" rows={8} required/></label><label>Instagram 이미지 공개 URL<input name="image_url" type="url" placeholder="https://..."/></label><label>예정일<input name="scheduled_at" type="datetime-local"/></label><button className="primary full" disabled={busy}>저장</button></form>}

      {modal.type==='naver'&&<form onSubmit={e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));run(async()=>{await api('integrations/naver',{client_id:modal.client.id,...b});await refresh();setModal(null);setToast('네이버 수집기 설정을 저장했습니다.')})}}><Channel platform="naver"/><h2>네이버 로컬 수집기</h2><p className="muted">MOA에는 네이버 비밀번호를 저장하지 않습니다.</p><label>네이버 블로그 ID<input name="blog_id" required defaultValue={modal.account?.username}/></label><div className="notice">1) 이 PC에서 로컬 수집기를 실행합니다.<br/>2) 수집기가 연 브라우저에서 네이버에 직접 로그인합니다.<br/>3) 로그인 세션은 이 PC에만 남고, 수집된 댓글 데이터만 MOA로 전송합니다.</div><button className="primary full" disabled={busy}>저장</button></form>}

      {modal.type==='channel'&&<form onSubmit={e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));run(async()=>{await api('integrations/channel-talk',{client_id:modal.client.id,...b,test:'true'});await refresh();setModal(null);setToast('채널톡 OpenAPI 설정을 확인했습니다.')})}}><Channel platform="channel_talk"/><h2>채널톡 OpenAPI</h2><p className="muted">채널톡 → 보안 및 개발 → OpenAPI에서 발급한 키를 입력합니다.</p><label>채널 이름<input name="channel_name" defaultValue={modal.account?.username}/></label><label>Access Key<input name="access_key" required autoComplete="off"/></label><label>Access Secret<input name="access_secret" type="password" required autoComplete="new-password"/></label><p className="safety-note"><LockKeyhole size={14}/>Secret은 AES-256-GCM으로 암호화해 Supabase에 저장합니다.</p><button className="primary full" disabled={busy}>저장하고 API 확인</button></form>}

      {modal.type==='detail'&&<><Channel platform={modal.item.platform}/><h2>{modal.item.title}</h2><div className="row"><span className="muted">{cName(modal.item.client_id)}</span><Badge status={modal.item.status}/></div><div className="post-body">{modal.item.body}</div><div className="detail-buttons"><button className="secondary" onClick={()=>navigator.clipboard.writeText(modal.item.title+'\n\n'+modal.item.body).then(()=>setToast('원고를 복사했습니다.'))}><Copy size={16}/>원고 복사</button>{modal.item.platform==='naver'&&<a className="secondary" href="https://blog.naver.com" target="_blank" rel="noreferrer">블로그 열기 <ExternalLink size={15}/></a>}</div></>}

      {modal.type==='notifications'&&<><h2>알림</h2>{data.notifications.length?data.notifications.map(n=><div className="notification-row" key={n.id}><b>{n.title}</b><p>{n.body}</p><small>{fmt(n.created_at)}</small></div>):<Empty text="실제 알림이 없습니다."/>}</>}
    </section></div>}
  </div>
}
