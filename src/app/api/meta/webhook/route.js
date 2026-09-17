import {NextResponse} from 'next/server';
import {db,instagramGraph,HttpError,need} from '../../../../lib/server';
import {verifySignature} from '../../../../lib/security.mjs';
import {sendPush} from '../../../../lib/push.mjs';

export const runtime='nodejs';
export const maxDuration=60;

const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});

async function upsertInbox(item){
  const existing=await db('inbox_items',`platform=eq.${encodeURIComponent(item.platform)}&external_id=eq.${encodeURIComponent(item.external_id)}`);
  if(existing[0]){
    const {status:_incomingStatus,created_at:_incomingCreatedAt,metadata:incomingMetadata,...rest}=item;
    const metadata={...(existing[0].metadata||{}),...(incomingMetadata||{})};
    await db('inbox_items',`id=eq.${existing[0].id}`,'PATCH',{
      ...rest,
      metadata,
      status:existing[0].status||_incomingStatus||'new',
      updated_at:new Date().toISOString()
    });
    return {...existing[0],...rest,metadata};
  }

  const created=(await db('inbox_items','','POST',item))[0];
  const id=created?.id;
  const alertTitle='Instagram 새 '+(item.kind==='comment'?'댓글':'문의');
  const alertBody=(item.author?item.author+': ':'')+String(item.body||'').slice(0,160);
  try{
    await db('notifications','','POST',{
      client_id:item.client_id||null,
      title:alertTitle,
      body:alertBody,
      platform:'instagram'
    });
  }catch(e){console.error('Notification row create failed',e)}
  try{
    const devices=await db('push_devices','enabled=eq.true&select=token');
    await sendPush(devices.map(x=>x.token),{
      title:alertTitle,
      body:alertBody,
      data:{platform:'instagram',inbox_item_id:id||'',view:'inbox'}
    });
  }catch(e){console.error('Push notification failed',e)}
  return created;
}

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

async function tryAutoDm(account,change,inbox){
  const mediaId=String(change.value?.media?.id||'');
  if(!mediaId||!inbox?.id)return;
  if(['sent','confirmed','sending'].includes(inbox.status))return;
  if(inbox.metadata?.auto_dm?.attempted)return;

  const posts=await db('posts',`client_id=eq.${account.client_id}&platform=eq.instagram&external_id=eq.${encodeURIComponent(mediaId)}&auto_dm_enabled=eq.true&limit=1`);
  const post=posts[0];
  if(!post?.auto_dm_message)return;

  const keyword=matchedKeyword(change.value?.text,post);
  if(!keyword)return;

  const attempt={attempted:true,post_id:post.id,keyword,attempted_at:new Date().toISOString()};
  await db('inbox_items',`id=eq.${inbox.id}`,'PATCH',{
    status:'sending',
    metadata:{...(inbox.metadata||{}),auto_dm:attempt},
    updated_at:new Date().toISOString()
  });

  try{
    const sent=await instagramGraph(account,`${account.external_id}/messages`,'POST',{
      recipient:{comment_id:String(change.value.id)},
      message:{text:post.auto_dm_message}
    });
    const sentAt=new Date().toISOString();
    const messageId=sent.message_id||sent.id||null;
    await db('inbox_items',`id=eq.${inbox.id}`,'PATCH',{
      status:'sent',
      draft:post.auto_dm_message,
      approved_text:post.auto_dm_message,
      approved_at:sentAt,
      reply_external_id:messageId,
      metadata:{...(inbox.metadata||{}),auto_dm:{...attempt,sent:true,sent_at:sentAt,message_id:messageId}},
      updated_at:sentAt
    });
    await db('posts',`id=eq.${post.id}`,'PATCH',{
      auto_dm_sent_count:Number(post.auto_dm_sent_count||0)+1,
      auto_dm_last_sent_at:sentAt
    });
    try{
      await db('notifications','','POST',{
        client_id:account.client_id,
        title:'Instagram 자동 DM 전송',
        body:`${inbox.author||'Instagram 사용자'} · ${keyword}`,
        platform:'instagram'
      });
    }catch(e){console.error('Auto DM notification failed',e)}
  }catch(e){
    const failedAt=new Date().toISOString();
    console.error('Instagram auto DM failed',e);
    await db('inbox_items',`id=eq.${inbox.id}`,'PATCH',{
      status:'failed',
      metadata:{...(inbox.metadata||{}),auto_dm:{...attempt,sent:false,failed_at:failedAt,error:String(e?.message||'전송 실패').slice(0,500)}},
      updated_at:failedAt
    });
  }
}

async function handle(req){
  const secret=need(process.env.META_APP_SECRET,'Meta');
  const url=new URL(req.url);

  if(req.method==='GET'){
    if(url.searchParams.get('hub.mode')==='subscribe'&&process.env.META_WEBHOOK_VERIFY_TOKEN&&url.searchParams.get('hub.verify_token')===process.env.META_WEBHOOK_VERIFY_TOKEN){
      return new Response(url.searchParams.get('hub.challenge'));
    }
    throw new HttpError('검증 실패',403);
  }
  if(req.method!=='POST')throw new HttpError('지원하지 않는 요청입니다.',405);

  const raw=await req.text();
  if(Buffer.byteLength(raw)>1048576)throw new HttpError('요청 크기 초과',413);
  if(!verifySignature(raw,req.headers.get('x-hub-signature-256'),secret))throw new HttpError('서명 검증 실패',403);
  const payload=JSON.parse(raw);
  if(payload.object!=='instagram')return json({received:true});

  for(const entry of payload.entry||[]){
    const account=(await db('integrations',`platform=eq.instagram&external_id=eq.${encodeURIComponent(entry.id||'')}&limit=1`))[0];
    if(!account)continue;

    for(const change of entry.changes||[]){
      if(change.field!=='comments'||!change.value?.id||change.value.from?.id===entry.id)continue;
      const inbox=await upsertInbox({
        client_id:account.client_id,
        platform:'instagram',
        kind:'comment',
        external_id:String(change.value.id),
        author:change.value.from?.username||'Instagram 사용자',
        body:change.value.text||'',
        context:String(change.value.media?.id||''),
        status:'new',
        metadata:{raw:change.value}
      });
      await tryAutoDm(account,change,inbox);
    }

    for(const message of entry.messaging||[]){
      if(!message.message?.mid||message.message.is_echo||message.sender?.id===entry.id)continue;
      await upsertInbox({
        client_id:account.client_id,
        platform:'instagram',
        kind:'message',
        external_id:String(message.message.mid),
        recipient_id:String(message.sender?.id||''),
        author:String(message.sender?.id||'Instagram 사용자'),
        body:message.message.text||'[첨부 메시지]',
        context:'Instagram DM',
        status:'new',
        created_at:new Date(message.timestamp||Date.now()).toISOString(),
        metadata:{raw:message}
      });
    }
  }

  return json({received:true});
}

async function safe(req){
  try{return await handle(req)}
  catch(e){
    console.error(e);
    return json({error:e instanceof HttpError?e.message:'Webhook 처리에 실패했습니다.'},e.status||500);
  }
}

export {safe as GET,safe as POST};
