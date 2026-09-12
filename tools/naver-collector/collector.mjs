import 'dotenv/config';
import { chromium } from 'playwright';
import readline from 'node:readline/promises';
import process from 'node:process';

const required=['MOA_URL','COLLECTOR_SECRET','CLIENT_ID','NAVER_BLOG_ID','NAVER_MANAGEMENT_URL'];
for(const key of required){if(!process.env[key])throw new Error(`${key}가 필요합니다.`)}

const pollMs=Math.max(30,Number(process.env.POLL_SECONDS||60))*1000;
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const context=await chromium.launchPersistentContext('./profile',{headless:false,channel:'chromium'});
const page=context.pages()[0]||await context.newPage();

async function ensureLogin(){
  await page.goto(process.env.NAVER_MANAGEMENT_URL,{waitUntil:'domcontentloaded'});
  if(page.url().includes('nid.naver.com')){
    console.log('네이버 로그인 창에서 직접 로그인하세요. 비밀번호는 MOA에 저장되지 않습니다.');
    await rl.question('로그인을 마친 뒤 Enter를 누르세요: ');
    await page.goto(process.env.NAVER_MANAGEMENT_URL,{waitUntil:'domcontentloaded'});
  }
}

function clean(text=''){return text.replace(/\s+/g,' ').trim()}

async function collectVisibleItems(){
  // 네이버 DOM은 자주 바뀌므로 특정 class 이름에 고정하지 않고
  // 화면에 보이는 링크/텍스트 구조에서 댓글 후보를 추출합니다.
  // 실제 운영 시 댓글 관리 화면에 맞춰 selector를 조정하세요.
  const raw=await page.locator('body').evaluate((body)=>{
    const nodes=[...body.querySelectorAll('a, li, article, tr, div')];
    return nodes.slice(0,1500).map((el,i)=>({
      i,
      text:(el.innerText||'').trim(),
      href:el.tagName==='A'?el.href:(el.querySelector('a')?.href||'')
    })).filter(x=>x.text&&x.text.length<1200);
  });

  const seen=new Set();
  const items=[];
  for(const x of raw){
    const text=clean(x.text);
    if(text.length<3)continue;
    const looksLikeComment=/댓글|답글|작성|공감/.test(text);
    if(!looksLikeComment)continue;
    const key=(x.href||'')+'|'+text;
    if(seen.has(key))continue;
    seen.add(key);
    items.push({
      external_id:Buffer.from(key).toString('base64url').slice(0,120),
      kind:'comment',
      author:'네이버 사용자',
      body:text.slice(0,2000),
      context:'네이버 블로그 관리 화면',
      context_url:x.href||null,
      created_at:new Date().toISOString(),
      metadata:{source:'local-playwright'}
    });
    if(items.length>=50)break;
  }
  return items;
}

async function push(items){
  const r=await fetch(new URL('/api/collector/naver/import',process.env.MOA_URL),{
    method:'POST',
    headers:{'Content-Type':'application/json','x-moa-collector-secret':process.env.COLLECTOR_SECRET},
    body:JSON.stringify({client_id:process.env.CLIENT_ID,blog_id:process.env.NAVER_BLOG_ID,items})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`MOA 전송 실패: ${r.status}`);
  console.log(new Date().toLocaleString(),'수집/전송',data.count,'건');
}

async function cycle(){
  await ensureLogin();
  await page.reload({waitUntil:'domcontentloaded'}).catch(()=>{});
  const items=await collectVisibleItems();
  await push(items);
}

console.log('MOA 네이버 수집기 시작');
await cycle().catch(e=>console.error(e.message));
setInterval(()=>cycle().catch(e=>console.error(e.message)),pollMs);

process.on('SIGINT',async()=>{await context.close();rl.close();process.exit(0)});
