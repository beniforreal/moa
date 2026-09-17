import {NextResponse} from 'next/server';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {db,row,instagramAccount,instagramGraph,HttpError} from '../../../lib/server';

export const runtime='nodejs';
export const maxDuration=60;

const AUTH_COOKIE='moa_session';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const safeEqual=(a,b)=>{
  const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));
  return aa.length===bb.length&&timingSafeEqual(aa,bb);
};
const authConfigured=()=>!!(process.env.MOA_LOGIN_ID&&process.env.MOA_LOGIN_PASSWORD&&process.env.MOA_SESSION_SECRET);
const expectedSession=()=>createHmac('sha256',process.env.MOA_SESSION_SECRET)
  .update(process.env.MOA_LOGIN_ID+'\n'+process.env.MOA_LOGIN_PASSWORD)
  .digest('hex');
const authenticated=req=>authConfigured()&&safeEqual(req.cookies.get(AUTH_COOKIE)?.value,expectedSession());
function requireLogin(req){
  if(!authConfigured())throw new HttpError('MOA 로그인 환경변수 설정이 필요합니다.',503);
  if(!authenticated(req))throw new HttpError('로그인이 필요합니다.',401);
}

const cleanKeywords=value=>{
  const source=Array.isArray(value)?value:String(value||'').split(',');
  return [...new Set(source.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,10).map(x=>x.slice(0,40));
};

function makeTitle(media){
  const caption=String(media.caption||'').replace(/\s+/g,' ').trim();
  if(caption)return caption.slice(0,80);
  const type=media.media_product_type||media.media_type||'POST';
  return `Instagram ${type}`;
}

async function syncInstagramPosts(clientId){
  const a=await instagramAccount(clientId);
  const fields='id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp';
  const media=await instagramGraph(a,`${a.external_id}/media?fields=${encodeURIComponent(fields)}&limit=50`);
  let imported=0;
  for(const item of media.data||[]){
    if(!item?.id)continue;
    const existing=await db('posts',`client_id=eq.${clientId}&platform=eq.instagram&external_id=eq.${encodeURIComponent(String(item.id))}&limit=1`);
    const patch={
      title:makeTitle(item),
      body:String(item.caption||''),
      external_url:item.permalink||null,
      scheduled_at:item.timestamp||null,
      status:'published',
      updated_at:new Date().toISOString()
    };
    const thumb=item.thumbnail_url||(item.media_type==='IMAGE'?item.media_url:null);
    if(thumb)patch.image_url=thumb;
    if(existing[0]){
      await db('posts',`id=eq.${existing[0].id}`,'PATCH',patch);
    }else{
      await db('posts','','POST',{
        client_id:clientId,
        platform:'instagram',
        external_id:String(item.id),
        ...patch,
        image_url:thumb||null
      });
      imported++;
    }
  }
  return imported;
}

async function handle(req){
  requireLogin(req);

  if(req.method==='GET'){
    const url=new URL(req.url);
    const clientId=url.searchParams.get('client_id');
    if(!clientId)throw new HttpError('고객사를 선택해 주세요.');
    await row('clients',clientId);
    const account=await instagramAccount(clientId);
    let syncError='';
    let imported=0;
    try{imported=await syncInstagramPosts(clientId)}
    catch(e){syncError=e instanceof Error?e.message:'Instagram 게시물을 불러오지 못했습니다.'}
    const posts=await db('posts',`client_id=eq.${clientId}&platform=eq.instagram&external_id=not.is.null&order=scheduled_at.desc.nullslast,created_at.desc&limit=100`);
    return json({
      account:{username:account.username||'',status:account.status||''},
      posts,
      imported,
      sync_error:syncError
    });
  }

  if(req.method!=='POST')throw new HttpError('지원하지 않는 요청입니다.',405);
  const body=await req.json().catch(()=>({}));
  if(body.action!=='save')throw new HttpError('지원하지 않는 작업입니다.');

  const post=await row('posts',body.post_id);
  if(post.platform!=='instagram'||!post.external_id)throw new HttpError('실제 Instagram 게시물에만 자동 DM을 설정할 수 있습니다.',409);
  await instagramAccount(post.client_id);

  const enabled=body.enabled===true||body.enabled==='true';
  const keywords=cleanKeywords(body.keywords);
  const match=body.match==='exact'?'exact':'contains';
  const message=String(body.message||'').trim();
  if(enabled&&!keywords.length)throw new HttpError('자동 DM을 켜려면 키워드를 1개 이상 입력해 주세요.');
  if(enabled&&!message)throw new HttpError('자동으로 보낼 DM 내용을 입력해 주세요.');
  if(message.length>1000)throw new HttpError('자동 DM은 1,000자 이내로 입력해 주세요.');

  await db('posts',`id=eq.${post.id}`,'PATCH',{
    auto_dm_enabled:enabled,
    auto_dm_keywords:keywords,
    auto_dm_message:message||null,
    auto_dm_match:match,
    updated_at:new Date().toISOString()
  });
  await db('audit_logs','','POST',{action:enabled?'instagram_auto_dm_enabled':'instagram_auto_dm_disabled',target_id:String(post.id)});
  return json({ok:true});
}

async function safe(req){
  try{return await handle(req)}
  catch(e){
    console.error(e);
    return json({error:e instanceof HttpError?e.message:'요청을 처리하지 못했습니다.'},e.status||500);
  }
}

export {safe as GET,safe as POST};
