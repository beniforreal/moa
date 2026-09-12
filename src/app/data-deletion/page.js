export const metadata={
  title:'데이터 삭제 안내 · MOA',
  description:'MOA 사용자 데이터 삭제 안내'
};

export default function DataDeletionPage(){
  return <main style={{maxWidth:760,margin:'0 auto',padding:'56px 24px 80px',fontFamily:"'Noto Sans KR',sans-serif",color:'#262834'}}>
    <a href="/" style={{color:'#5f9f7a',textDecoration:'none',fontWeight:700}}>← MOA</a>
    <h1 style={{fontSize:32,margin:'24px 0 18px'}}>사용자 데이터 삭제 안내</h1>
    <p style={{color:'#526158',lineHeight:1.9}}>MOA에 연결된 Instagram 또는 기타 채널 데이터의 삭제를 원하는 경우 아래 방법을 이용할 수 있습니다.</p>
    <ol style={{color:'#526158',lineHeight:1.9,paddingLeft:22}}>
      <li>Instagram에서 MOA 앱의 권한을 철회합니다.</li>
      <li>MOA 고객사 관리에서 해당 고객사를 삭제하면 해당 고객사에 연결된 채널 정보, 수집된 대화 및 콘텐츠 데이터가 함께 삭제됩니다.</li>
      <li>별도의 삭제 요청이 필요한 경우 MOA 운영자에게 삭제 대상 고객사 또는 연결 계정을 알려 요청할 수 있습니다.</li>
    </ol>
    <p style={{color:'#858793',lineHeight:1.8,marginTop:28}}>법령상 별도 보존 의무가 있는 정보는 필요한 기간 동안 보관될 수 있습니다.</p>
    <p style={{marginTop:30}}><a href="/privacy" style={{color:'#5f9f7a'}}>개인정보처리방침 보기</a></p>
  </main>
}
