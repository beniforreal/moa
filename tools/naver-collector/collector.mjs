import 'dotenv/config';
import { chromium } from 'playwright';
import readline from 'node:readline/promises';
import process from 'node:process';
import { createHash } from 'node:crypto';

const required=['MOA_URL','COLLECTOR_SECRET','CLIENT_ID','NAVER_BLOG_ID','NAVER_MANAGEMENT_URL'];
for(const key of required){if(!process.env[key])throw new Error(`${key}가 필요합니다.`)}

const pollMs=Math.max(30,Number(process.env.POLL_SECONDS||60))*1000;
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const context=await chromium.launchPersistentContext('./profile',{headless:false,channel:'chromium'});
const page=context.pages()[0]||await context.newPage();

function clean(text=''){return text.replace(/\s+/g,' ').trim()}
function hash(value){return createHash('sha256').update(value).digest('hex')}

async function isLoggedIn(){
  if(page.url().includes('nid.naver.com'))return false;
  const body=clean(await page.locator('body').innerText().catch(()=>''));
  if(/로그아웃/.test(body))return true;
  if(/내 블로그/.test(body)&&!/네이버 로그인/.test(body))return true;
  return false;
}

async function ensureLogin(){
  await page.goto(process.env.NAVER_MANAGEMENT_URL,{waitUntil:'domcontentloaded'});
  if(await isLoggedIn())return;

  console.log('');
  console.log('네이버 로그인이 필요합니다.');
  console.log('지금 열린 Chromium 창에서 네이버 로그인을 직접 완료하세요.');
  console.log('비밀번호는 MOA나 Supabase로 전송되지 않습니다.');
  console.log('');

  const loginLink=page.locator('a[href*="nid.naver.com"]').filter({hasText:/로그인/}).first();
  if(await loginLink.count())await loginLink.click().catch(()=>{});

  await rl.question('로그인을 완료한 뒤 이 PowerShell 창에서 Enter를 누르세요: ');
  await page.goto(process.env.NAVER_MANAGEMENT_URL,{waitUntil:'domcontentloaded'});

  if(!(await isLoggedIn()))throw new Error('로그인 상태를 확인하지 못했습니다. Chromium에서 로그인된 상태인지 확인해 주세요.');
}

async function findNewsPanel(){
  // 네이버 블로그 홈 오른쪽의 "내 소식" 탭이 들어 있는 작은 패널을 찾는다.
  const tab=page.getByText('내 소식',{exact:true}).first();
  if(!(await tab.count()))return null;

  return tab.evaluateHandle((node)=>{
    let el=node;
    for(let i=0;i<7&&el;i++,el=el.parentElement){
      const text=(el.innerText||'').replace(/\s+/g,' ').trim();
      const clickable=el.querySelectorAll('a,button,[role="button"]').length;
      if(text.includes('내 소식')&&text.length<2500&&clickable>=2)return el;
    }
    return node.parentElement;
  });
}

async function collectNewsItems(){
  const panelHandle=await findNewsPanel();
  if(!panelHandle){
    console.log('오른쪽 "내 소식" 영역을 찾지 못했습니다.');
    return [];
  }

  const raw=await panelHandle.evaluate((panel)=>{
    const candidates=[...panel.querySelectorAll('a, li, [role="listitem"], button')];
    return candidates.map((el,index)=>({
      index,
      text:(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim(),
      href:el.tagName==='A'?el.href:(el.querySelector('a')?.href||'')
    })).filter(x=>x.text);
  });

  const ignore=/^(내 소식|내 활동|이웃 목록|로그아웃|내 블로그|글쓰기)$/;
  const looksLikeNews=/(님이|댓글|답글|공감|좋아요|반응|이웃|언급|스크랩)/;
  const seen=new Set();
  const items=[];

  for(const x of raw){
    const text=clean(x.text);
    if(!text||ignore.test(text)||text.length<4||text.length>700)continue;
    if(!looksLikeNews.test(text))continue;

    const key=`${x.href||''}|${text}`;
    if(seen.has(key))continue;
    seen.add(key);

    const author=(text.match(/^(.{1,80}?)님이\s/)||[])[1]||'네이버 사용자';
    const kind=/댓글|답글/.test(text)?'comment':'message';

    items.push({
      external_id:hash(key),
      kind,
      author,
      body:text,
      context:'네이버 블로그 · 내 소식',
      context_url:x.href||null,
      created_at:new Date().toISOString(),
      metadata:{
        source:'naver-blog-home-news',
        original_text:text
      }
    });
  }

  // 같은 알림이 중첩 DOM 때문에 여러 번 잡힐 때 짧고 구체적인 항목을 우선한다.
  return items
    .sort((a,b)=>a.body.length-b.body.length)
    .filter((item,index,list)=>!list.slice(0,index).some(x=>x.body===item.body||x.body.includes(item.body)))
    .slice(0,30);
}

async function push(items){
  const r=await fetch(new URL('/api/collector/naver/import',process.env.MOA_URL),{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-moa-collector-secret':process.env.COLLECTOR_SECRET
    },
    body:JSON.stringify({
      client_id:process.env.CLIENT_ID,
      blog_id:process.env.NAVER_BLOG_ID,
      items
    })
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`MOA 전송 실패: ${r.status}`);
  console.log(new Date().toLocaleString(),'내 소식 수집/전송',data.count,'건');
}

async function cycle(){
  await ensureLogin();
  await page.goto(process.env.NAVER_MANAGEMENT_URL,{waitUntil:'domcontentloaded'}).catch(()=>{});
  await page.waitForTimeout(2500);

  const items=await collectNewsItems();
  if(items.length){
    console.log('수집된 내 소식:');
    for(const item of items.slice(0,5))console.log(' -',item.body);
  }else{
    console.log('현재 화면에서 새로 읽은 "내 소식" 항목이 없습니다.');
  }
  await push(items);
}

console.log('MOA 네이버 블로그 홈 "내 소식" 수집기 시작');
console.log('대상:',process.env.NAVER_MANAGEMENT_URL);
await cycle().catch(e=>console.error('수집 오류:',e.message));
setInterval(()=>cycle().catch(e=>console.error('수집 오류:',e.message)),pollMs);

process.on('SIGINT',async()=>{
  await context.close();
  rl.close();
  process.exit(0);
});
