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

async function collectNewsItems(){
  // 네이버 블로그 홈 오른쪽 "내 소식"의 실제 DOM만 읽습니다.
  // .list_news > .item 내부의 댓글/답글 알림만 수집합니다.
  await page.locator('.list_news').first().waitFor({state:'visible',timeout:10000}).catch(()=>{});

  const items=await page.locator('.list_news .item').evaluateAll((nodes)=>{
    return nodes.map((el)=>{
      const type=(el.querySelector('.blind')?.textContent||'').trim();
      const author=(el.querySelector('a.name em.name')?.textContent||'').trim();
      const link=el.querySelector('a.post_link');
      const href=link?.href||'';
      const title=(el.querySelector('.title_my_post')?.textContent||'').trim();
      const tail=(link?.querySelector('span[ng-bind-html]')?.textContent||'').trim();
      const datetime=(el.querySelector('.text_datetime')?.textContent||'').trim();

      let commentNo='';
      try{
        const u=new URL(href);
        commentNo=u.searchParams.get('commentNoPosition')||u.searchParams.get('focusingCommentNo')||'';
      }catch{}

      return {type,author,href,title,tail,datetime,commentNo};
    });
  });

  const result=[];
  const seen=new Set();

  for(const x of items){
    // 공감/이웃 등은 제외하고 새 댓글/새 답글만 MOA로 보냅니다.
    if(!['새 댓글','새 답글'].includes(clean(x.type)))continue;
    if(!x.href)continue;

    const stable=x.commentNo
      ? `naver-news:${process.env.NAVER_BLOG_ID}:${x.commentNo}`
      : `naver-news:${hash([x.type,x.author,x.href,x.title,x.tail,x.datetime].join('|'))}`;

    if(seen.has(stable))continue;
    seen.add(stable);

    const eventText=clean(x.tail)||`${clean(x.type)} 알림`;
    result.push({
      external_id:stable,
      kind:'comment',
      author:clean(x.author)||'네이버 사용자',
      body:eventText,
      context:clean(x.title)||'네이버 블로그',
      context_url:x.href,
      created_at:new Date().toISOString(),
      metadata:{
        source:'naver-blog-home-list-news',
        news_type:clean(x.type),
        display_datetime:clean(x.datetime),
        post_title:clean(x.title),
        comment_no:x.commentNo||null
      }
    });
  }

  return result.slice(0,50);
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
    console.log('수집된 댓글/답글 알림:');
    for(const item of items.slice(0,5)){
      console.log(' -',item.metadata?.news_type,item.author,'/',item.context,'/',item.body);
    }
  }else{
    console.log('현재 .list_news에서 댓글/답글 알림을 찾지 못했습니다.');
  }
  await push(items);
}

console.log('MOA 네이버 블로그 홈 ".list_news" 댓글/답글 수집기 시작');
console.log('대상:',process.env.NAVER_MANAGEMENT_URL);
await cycle().catch(e=>console.error('수집 오류:',e.message));
setInterval(()=>cycle().catch(e=>console.error('수집 오류:',e.message)),pollMs);

process.on('SIGINT',async()=>{
  await context.close();
  rl.close();
  process.exit(0);
});
