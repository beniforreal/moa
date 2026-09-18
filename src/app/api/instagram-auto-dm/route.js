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
const normalize=value=>String(value||'').trim().toLocaleLowerCase('ko-KR');
function matchedKeyword(text,post){
  const source=normalize(text);
  if(!source)return '';
  for(const raw of post.auto_dm_keywords||[]){
    const keyword=normalize(raw);
    if(!keyword)continue;
    if(post.auto_dm_match==='exact'?source===keyword:source.includes(keyword))return String(raw);
  }
  return '';
}

function makeTitle(media){
  const caption=String(media.caption||'').replace(/\s+/g,' ').trim();
  if(caption)return caption.slice(0,80);
  const type=media.media_product_type||media.media_type||'POST';
  return `Instagram ${type}`;
}

async function ensureWebhookSubscription(account){
  await instagramGraph(account,`${account.external_id}/subscribed_apps?subscribed_fields=comments,messages`,'POST');
  await db('integrations',`id=eq.${account.id}`,'PATCH',{
    last_sync_at:new Date().toISOString(),
    config:{...(account.config||{}),webhook_subscription:'comments,messages',webhook_repaired_at:new Date().toISOString()}
  });
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
      status:'published'
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

async function upsertRecoveredComment(account,post,comment){
  const externalId=String(comment.id||'');
  if(!externalId)return null;
  const existing=await db('inbox_items',`platform=eq.instagram&external_id=eq.${encodeURIComponent(externalId)}&limit=1`);
  if(existing[0])return existing[0];
  const author=comment.username||comment.from?.username||comment.from?.id||'Instagram 사용자';
  const created=(await db('inbox_items','','POST',{
    client_id:account.client_id,
    platform:'instagram',
    kind:'comment',
    external_id:externalId,
    author:String(author),
    body:String(comment.text||''),
    context:String(post.external_id),
    context_url:post.external_url||null,
    status:'new',
    created_at:comment.timestamp||new Date().toISOString(),
    metadata:{raw:comment,recovered:true}
  }))[0];
  return created;
}

async function sendAutoDm(account,post,inbox,commentId,keyword){
  const attempt={attempted:true,post_id:post.id,keyword,attempted_at:new Date().toISOString()};
  await db('inbox_items',`id=eq.${inbox.id}`,'PATCH',{
    status:'sending',
    metadata:{...(inbox.metadata||{}),auto_dm:attempt},
    updated_at:new Date().toISOString()
  });
  try{
    const sent=await instagramGraph(account,`${account.external_id}/messages`,'POST',{
      recipient:{comment_id:String(commentId)},
      message:{text:post.auto_dm_message}
    });
    const sentAt=new Date().toISOString();
    const messageId=sent.message_id||sent.id||null;
    let commentReply=null;
    const replyText=String(post.auto_dm_comment_reply||'').trim();
    if(replyText){
      commentReply={attempted:true,text:replyText,attempted_at:new Date().toISOString(),sent:false};
      try{
        const reply=await instagramGraph(account,`${encodeURIComponent(String(commentId))}/replies`,'POST',{message:replyText});
        commentReply={...commentReply,sent:true,sent_at:new Date().toISOString(),reply_id:reply.id||null};
        await db('audit_logs','','POST',{action:'instagram_auto_dm_comment_reply_sent',target_id:String(inbox.id)});
      }catch(replyError){
        commentReply={...commentReply,sent:false,failed_at:new Date().toISOString(),error:String(replyError?.message||'대댓글 전송 실패').slice(0,500)};
        console.error('Instagram auto DM comment reply failed',replyError);
        await db('audit_logs','','POST',{action:'instagram_auto_dm_comment_reply_failed',target_id:String(inbox.id)});
      }
    }
    await db('inbox_items',`id=eq.${inbox.id}`,'PATCH',{
      status:'sent',draft:post.auto_dm_message,approved_text:post.auto_dm_message,approved_at:sentAt,
      reply_external_id:messageId,
      metadata:{...(inbox.metadata||{}),auto_dm:{...attempt,sent:true,sent_at:sentAt,message_id:messageId,comment_reply:commentReply}},
      updated_at:sentAt
    });
    await db('posts',`id=eq.${post.id}`,'PATCH',{
      auto_dm_sent_count:Number(post.auto_dm_sent_count||0)+1,
      auto_dm_last_sent_at:sentAt
    });
    await db('audit_logs','','POST',{action:'instagram_auto_dm_sent',target_id:String(inbox.id)});
    return true;
  }catch(e){
    const failedAt=new Date().toISOString();
    await db('inbox_items',`id=eq.${inbox.id}`,'PATCH',{
      status:'failed',
      metadata:{...(inbox.metadata||{}),auto_dm:{...attempt,sent:false,failed_at:failedAt,error:String(e?.message||'전송 실패').slice(0,500)}},
      updated_at:failedAt
    });
    await db('audit_logs','','POST',{action:'instagram_auto_dm_failed',target_id:String(inbox.id)});
    throw e;
  }
}

async function recoverEnabledPostComments(account,posts){
  let recovered=0,sent=0,failed=0;
  for(const post of posts.filter(x=>x.auto_dm_enabled&&x.external_id&&x.auto_dm_message)){
    let result;
    try{
      result=await instagramGraph(account,`${post.external_id}/comments?fields=id,text,username,timestamp,from&limit=50`);
    }catch(e){
      console.error('Instagram comment recovery failed',post.external_id,e);
      continue;
    }
    const enabledAt=new Date(post.auto_dm_enabled_at||post.updated_at||0).getTime();
    for(const comment of result.data||[]){
      const keyword=matchedKeyword(comment.text,post);
      if(!keyword)continue;
      const commentTime=comment.timestamp?new Date(comment.timestamp).getTime():Date.now();
      if(enabledAt&&commentTime+60000<enabledAt)continue;
      const inbox=await upsertRecoveredComment(account,post,comment);
      if(!inbox)continue;
      if(inbox.metadata?.auto_dm?.attempted||['sent','sending'].includes(inbox.status))continue;
      recovered++;
      try{if(await sendAutoDm(account,post,inbox,comment.id,keyword))sent++}
      catch(e){failed++;console.error('Recovered auto DM failed',comment.id,e)}
    }
  }
  return {recovered,sent,failed};
}

async function handle(req){
  requireLogin(req);

  if(req.method==='GET'){
    const url=new URL(req.url);
    const clientId=url.searchParams.get('client_id');
    if(!clientId)throw new HttpError('고객사를 선택해 주세요.');
    await row('clients',clientId);
    const account=await instagramAccount(clientId);
    let syncError='',subscriptionError='',imported=0;
    try{await ensureWebhookSubscription(account)}catch(e){subscriptionError=e instanceof Error?e.message:'Webhook 구독을 확인하지 못했습니다.'}
    try{imported=await syncInstagramPosts(clientId)}catch(e){syncError=e instanceof Error?e.message:'Instagram 게시물을 불러오지 못했습니다.'}
    let posts=await db('posts',`client_id=eq.${clientId}&platform=eq.instagram&external_id=not.is.null&order=scheduled_at.desc.nullslast,created_at.desc&limit=100`);
    let recovery={recovered:0,sent:0,failed:0};
    try{recovery=await recoverEnabledPostComments(account,posts)}catch(e){console.error('Auto DM recovery failed',e)}
    if(recovery.sent||recovery.failed)posts=await db('posts',`client_id=eq.${clientId}&platform=eq.instagram&external_id=not.is.null&order=scheduled_at.desc.nullslast,created_at.desc&limit=100`);
    const inbox=await db('inbox_items',`client_id=eq.${clientId}&platform=eq.instagram&order=created_at.desc&limit=500`);
    const history=inbox.filter(x=>x.metadata?.auto_dm?.attempted).map(x=>({
      id:x.id,post_id:x.metadata?.auto_dm?.post_id||null,author:x.author||'Instagram 사용자',body:x.body||'',status:x.status,
      keyword:x.metadata?.auto_dm?.keyword||'',sent_at:x.metadata?.auto_dm?.sent_at||null,failed_at:x.metadata?.auto_dm?.failed_at||null,
      error:x.metadata?.auto_dm?.error||'',created_at:x.created_at,
      comment_reply:x.metadata?.auto_dm?.comment_reply||null
    }));
    return json({
      account:{username:account.username||'',status:account.status||''},posts,history,imported,recovery,
      sync_error:syncError,subscription_error:subscriptionError
    });
  }

  if(req.method!=='POST')throw new HttpError('지원하지 않는 요청입니다.',405);
  const body=await req.json().catch(()=>({}));
  if(body.action!=='save')throw new HttpError('지원하지 않는 작업입니다.');

  const post=await row('posts',body.post_id);
  if(post.platform!=='instagram'||!post.external_id)throw new HttpError('실제 Instagram 게시물에만 자동 DM을 설정할 수 있습니다.',409);
  const account=await instagramAccount(post.client_id);

  const enabled=body.enabled===true||body.enabled==='true';
  const keywords=cleanKeywords(body.keywords);
  const match=body.match==='exact'?'exact':'contains';
  const message=String(body.message||'').trim();
  const commentReply=String(body.comment_reply||'').trim();
  if(enabled&&!keywords.length)throw new HttpError('자동 DM을 켜려면 키워드를 1개 이상 입력해 주세요.');
  if(enabled&&!message)throw new HttpError('자동으로 보낼 DM 내용을 입력해 주세요.');
  if(message.length>1000)throw new HttpError('자동 DM은 1,000자 이내로 입력해 주세요.');
  if(commentReply.length>2200)throw new HttpError('자동 대댓글은 2,200자 이내로 입력해 주세요.');

  const wasEnabled=!!post.auto_dm_enabled;
  const now=new Date().toISOString();
  await db('posts',`id=eq.${post.id}`,'PATCH',{
    auto_dm_enabled:enabled,
    auto_dm_keywords:keywords,
    auto_dm_message:message||null,
    auto_dm_comment_reply:commentReply||null,
    auto_dm_match:match,
    auto_dm_enabled_at:enabled&&!wasEnabled?now:(post.auto_dm_enabled_at||null),
    updated_at:now
  });
  try{await ensureWebhookSubscription(account)}catch(e){console.error('Webhook subscription repair on save failed',e)}
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
