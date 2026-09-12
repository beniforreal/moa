import {decrypt} from './security.mjs';

export class HttpError extends Error {
  constructor(message,status=400){super(message);this.status=status}
}

export const configured=()=>!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
export function need(value,name){if(!value)throw new HttpError(`${name} 설정이 필요합니다.`,503);return value}

export async function db(table,query='',method='GET',body){
  need(configured(),'Supabase');
  const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${query}`,{
    method,
    headers:{
      apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type':'application/json',
      Prefer:'return=representation'
    },
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
    signal:AbortSignal.timeout(25000)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error)throw new HttpError('Instagram 요청이 실패했습니다. 권한과 Meta 앱 설정을 확인해 주세요.',502);
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
