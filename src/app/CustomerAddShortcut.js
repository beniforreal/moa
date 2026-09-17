'use client';

import {useEffect,useState} from 'react';
import {Building2,Plus,X} from 'lucide-react';

export default function CustomerAddShortcut(){
  const [visible,setVisible]=useState(false);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    fetch('/api/auth/status',{cache:'no-store'})
      .then(r=>r.json())
      .then(x=>setVisible(!!x.authenticated))
      .catch(()=>setVisible(false));
  },[]);

  async function submit(e){
    e.preventDefault();
    if(busy)return;
    setBusy(true);
    setError('');
    try{
      const form=new FormData(e.currentTarget);
      const body={
        name:String(form.get('name')||'').trim(),
        category:String(form.get('category')||'').trim(),
        tone:String(form.get('tone')||'').trim(),
        policy:String(form.get('policy')||'').trim()
      };
      const r=await fetch('/api/clients',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
        cache:'no-store'
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'고객사를 추가하지 못했습니다.');
      setOpen(false);
      window.location.reload();
    }catch(err){
      setError(err.message||'고객사를 추가하지 못했습니다.');
    }finally{
      setBusy(false);
    }
  }

  if(!visible)return null;

  return <>
    <button type="button" onClick={()=>{setError('');setOpen(true)}} title="새 고객사 추가" style={{
      position:'fixed',right:18,bottom:64,zIndex:90,display:'flex',alignItems:'center',gap:7,
      padding:'10px 13px',border:'1px solid #d8e8de',borderRadius:14,background:'#fff',color:'#244f39',
      fontSize:12,fontWeight:800,boxShadow:'0 10px 24px rgba(26,63,43,.14)',cursor:'pointer'
    }}><Plus size={16}/>고객사 추가</button>

    {open&&<div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}} style={{
      position:'fixed',inset:0,zIndex:200,display:'grid',placeItems:'center',padding:18,
      background:'rgba(20,35,27,.42)',backdropFilter:'blur(3px)'
    }}>
      <section role="dialog" aria-modal="true" aria-label="고객사 추가" style={{
        width:'min(520px,100%)',maxHeight:'calc(100vh - 36px)',overflow:'auto',position:'relative',
        background:'#fff',border:'1px solid #e4eee8',borderRadius:22,padding:24,
        boxShadow:'0 24px 80px rgba(24,55,38,.22)'
      }}>
        <button type="button" aria-label="닫기" onClick={()=>setOpen(false)} style={{
          position:'absolute',right:16,top:16,width:36,height:36,border:'1px solid #e2e9e5',borderRadius:11,
          background:'#fff',display:'grid',placeItems:'center',cursor:'pointer',color:'#456252'
        }}><X size={19}/></button>

        <div style={{display:'flex',alignItems:'center',gap:10,color:'#244f39',marginBottom:6}}>
          <span style={{width:38,height:38,borderRadius:12,display:'grid',placeItems:'center',background:'#edf6f0'}}><Building2 size={19}/></span>
          <div><div style={{fontSize:11,fontWeight:800,letterSpacing:'.08em',color:'#749080'}}>CLIENT PROFILE</div><h2 style={{margin:'2px 0 0',fontSize:22}}>고객사 추가</h2></div>
        </div>
        <p style={{margin:'0 0 20px',fontSize:13,color:'#718077'}}>새 고객사를 만든 뒤 채널 연결에서 Instagram·네이버·카카오를 각각 연결할 수 있습니다.</p>

        <form onSubmit={submit} style={{display:'grid',gap:14}}>
          <label style={labelStyle}>고객사명<input name="name" required autoFocus style={inputStyle}/></label>
          <label style={labelStyle}>업종<input name="category" style={inputStyle}/></label>
          <label style={labelStyle}>브랜드 말투<input name="tone" style={inputStyle}/></label>
          <label style={labelStyle}>응대 정책<textarea name="policy" rows={5} style={{...inputStyle,resize:'vertical',minHeight:110}}/></label>
          {error&&<p style={{margin:0,padding:'10px 12px',borderRadius:10,background:'#fff4f4',color:'#a33a3a',fontSize:13}}>{error}</p>}
          <button type="submit" disabled={busy} style={{
            border:0,borderRadius:12,padding:'12px 16px',background:'#244f39',color:'#fff',fontWeight:800,
            cursor:busy?'default':'pointer',opacity:busy?0.65:1
          }}>{busy?'저장 중...':'고객사 저장'}</button>
        </form>
      </section>
    </div>}
  </>;
}

const labelStyle={display:'grid',gap:7,fontSize:13,fontWeight:700,color:'#405449'};
const inputStyle={width:'100%',boxSizing:'border-box',border:'1px solid #dce7e0',borderRadius:11,padding:'11px 12px',font:'inherit',fontWeight:500,outline:'none',background:'#fff',color:'#24382d'};
