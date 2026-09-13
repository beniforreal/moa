import {createSign} from 'node:crypto';

let cachedToken=null;
let cachedUntil=0;

function serviceAccount(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)return null;
  try{
    const parsed=JSON.parse(raw);
    if(!parsed.client_email||!parsed.private_key||!parsed.project_id)return null;
    return parsed;
  }catch{
    return null;
  }
}

const b64url=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value))
  .toString('base64')
  .replace(/=/g,'')
  .replace(/\+/g,'-')
  .replace(/\//g,'_');

async function accessToken(){
  if(cachedToken&&Date.now()<cachedUntil)return cachedToken;
  const sa=serviceAccount();
  if(!sa)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');

  const now=Math.floor(Date.now()/1000);
  const header=b64url({alg:'RS256',typ:'JWT'});
  const payload=b64url({
    iss:sa.client_email,
    scope:'https://www.googleapis.com/auth/firebase.messaging',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now+3600
  });
  const unsigned=header+'.'+payload;
  const signer=createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature=signer.sign(sa.private_key)
    .toString('base64')
    .replace(/=/g,'')
    .replace(/\+/g,'-')
    .replace(/\//g,'_');
  const assertion=unsigned+'.'+signature;

  const r=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }),
    signal:AbortSignal.timeout(15000)
  });
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body.access_token)throw new Error('Firebase OAuth token request failed.');
  cachedToken=body.access_token;
  cachedUntil=Date.now()+Math.max(60,(body.expires_in||3600)-120)*1000;
  return cachedToken;
}

export function pushConfigured(){
  return !!serviceAccount();
}

export async function sendPush(tokens,{title,body,data={}}){
  if(!tokens?.length||!pushConfigured())return {sent:0,failed:0};
  const sa=serviceAccount();
  const bearer=await accessToken();
  let sent=0,failed=0;

  for(const token of [...new Set(tokens.filter(Boolean))]){
    const r=await fetch(
      'https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(sa.project_id)+'/messages:send',
      {
        method:'POST',
        headers:{
          Authorization:'Bearer '+bearer,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          message:{
            token,
            notification:{title:String(title||'MOA'),body:String(body||'새 알림이 있습니다.')},
            data:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v??'')])),
            android:{
              priority:'high',
              notification:{channel_id:'moa_updates',sound:'default'}
            }
          }
        }),
        signal:AbortSignal.timeout(15000)
      }
    );
    if(r.ok)sent++;
    else{
      failed++;
      console.error('FCM send failed',r.status,await r.text());
    }
  }
  return {sent,failed};
}
