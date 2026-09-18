import {decrypt} from './security.mjs';

export class HttpError extends Error {
  constructor(message,status=400){super(message);this.status=status}
}

export const supabaseKey=()=>process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
export const configured=()=>!!(process.env.SUPABASE_URL&&supabaseKey());
export function need(value,name){if(!value)throw new HttpError(`${name} 설정이 필요합니다.`,503);return value}

export async function db(table,query='',method='GET',body){
  need(configured(),'Supabase');
  const key=supabaseKey();
  const headers={
    apikey:key,
    'Content-Type':'application/json',
    Prefer:'return=representation'
  };
  // Legacy service_role keys are JWTs and can be sent as Bearer.
  // New sb_secret_* keys must be sent only via apikey.
  if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`;
  const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${query}`,{
    method,
    headers,
    body:body?JSON.stringify(body):undefined,
    cache:'no-store'
  });
  if(!r.ok){
    const detail=await r.text();
    console.error('Supabase error',table,r.status,detail);
    throw new HttpError('데이터 저장/조회에 실패했습니다. Supabase 연결과 스키마를 확인해 주세요.',502);
  }
  return r.status===204?[]:r.json();
}

export function uuid(v){if(!/^[0-9a-f-]{36}$/i.test(v||''))throw new HttpError('잘못된 항목입니다.');return v}
export async function row(table,id){const rows=await db(table,`id=eq.${uuid(id)}`);if(!rows[0])throw new HttpError('항목을 찾을 수 없습니다.',404);return rows[0]}
export const textValue=(v,max=5000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new HttpError(`내용을 1~${max}자 이내로 입력해 주세요.`);return v.trim()};

export async function integration(clientId,platform){
  const rows=await db('integrations',`client_id=eq.${uuid(clientId)}&platform=eq.${encodeURIComponent(platform)}`);
  return rows[0]||null;
}

export async function instagramAccount(clientId){
  const a=await integration(clientId,'instagram');
  if(!a?.token_encrypted)throw new HttpError('먼저 Instagram 계정을 연결해 주세요.',409);
  if(a.token_expires_at&&new Date(a.token_expires_at)<new Date())throw new HttpError('Instagram 인증이 만료되었습니다. 다시 연결해 주세요.',409);
  return a;
}

export async function instagramGraph(a,path,method='GET',body){
  const ver=need(process.env.META_GRAPH_VERSION,'Meta API 버전');
  if(!/^v\d+\.\d+$/.test(ver))throw new HttpError('Meta API 버전을 확인해 주세요.',503);
  const r=await fetch(`https://graph.instagram.com/${ver}/${path}`,{
    method,
    headers:{Authorization:`Bearer ${decrypt(a.token_encrypted)}`,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(25000),
    cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error){
    const code=data?.error?.code;
    const message=String(data?.error?.message||'').slice(0,300);
    console.error('Instagram Graph error',{path,method,status:r.status,code:code||null,message:message||null});
    const detail=[code?`Meta #${code}`:null,message||null].filter(Boolean).join(' · ');
    throw new HttpError('Instagram 요청이 실패했습니다'+(detail?` (${detail})`:'')+'. 권한과 Meta 앱 설정을 확인해 주세요.',502);
  }
  return data;
}

export async function channelTalkRequest(a,path,method='GET',body){
  if(!a?.credential_encrypted)throw new HttpError('채널톡 OpenAPI 키를 먼저 저장해 주세요.',409);
  let credential;
  try{credential=JSON.parse(decrypt(a.credential_encrypted))}catch{throw new HttpError('채널톡 인증정보를 읽을 수 없습니다.',500)}
  const r=await fetch(`https://api.channel.io/open/v5/${path}`,{
    method,
    headers:{
      'x-access-key':need(credential.accessKey,'채널톡 Access Key'),
      'x-access-secret':need(credential.accessSecret,'채널톡 Access Secret'),
      'Content-Type':'application/json'
    },
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(25000),
    cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new HttpError('채널톡 OpenAPI 요청이 실패했습니다. 유료 플랜과 API 키를 확인해 주세요.',502);
  return data;
}


export async function tiktokBusinessRequest(a,path,method='GET',body){
  if(!a?.credential_encrypted)throw new HttpError('TikTok Business API 인증정보를 먼저 저장해 주세요.',409);
  let credential;
  try{credential=JSON.parse(decrypt(a.credential_encrypted))}catch{throw new HttpError('TikTok 인증정보를 읽을 수 없습니다.',500)}
  const token=need(credential.accessToken,'TikTok Access Token');
  const r=await fetch(`https://business-api.tiktok.com/open_api/v1.3/${path}`,{
    method,
    headers:{'Access-Token':token,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(25000),
    cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||Number(data.code||0)!==0){
    const code=data?.code;
    const message=String(data?.message||'').slice(0,300);
    console.error('TikTok Business API error',{path,method,status:r.status,code:code||null,message:message||null});
    throw new HttpError('TikTok Business API 요청이 실패했습니다'+(message?` (${message})`:'')+'. API 권한과 Business Messaging 접근 권한을 확인해 주세요.',502);
  }
  return data;
}
