'use client';

import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {MessageCircle} from 'lucide-react';

export default function AutoDmShortcut(){
  const pathname=usePathname();
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    fetch('/api/auth/status',{cache:'no-store'})
      .then(r=>r.json())
      .then(x=>setVisible(!!x.authenticated))
      .catch(()=>setVisible(false));
  },[]);
  if(!visible||pathname==='/auto-dm')return null;
  return <a href="/auto-dm" title="Instagram 댓글 자동 DM" style={{
    position:'fixed',right:18,bottom:18,zIndex:90,display:'flex',alignItems:'center',gap:7,
    padding:'10px 13px',borderRadius:14,background:'#244f39',color:'#fff',textDecoration:'none',
    fontSize:12,fontWeight:800,boxShadow:'0 10px 24px rgba(26,63,43,.22)'
  }}><MessageCircle size={16}/>자동 DM</a>;
}
