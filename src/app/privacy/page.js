export const metadata={
  title:'개인정보처리방침 · MOA',
  description:'MOA 개인정보처리방침'
};

const section={marginTop:28};
const h2={fontSize:18,marginBottom:10};
const p={color:'#526158',lineHeight:1.85,margin:'7px 0'};
const li={color:'#526158',lineHeight:1.8,margin:'5px 0'};

export default function PrivacyPage(){
  return <main style={{maxWidth:880,margin:'0 auto',padding:'56px 24px 80px',fontFamily:"'Noto Sans KR',sans-serif",color:'#262834'}}>
    <a href="/" style={{color:'#5f9f7a',textDecoration:'none',fontWeight:700}}>← MOA</a>
    <h1 style={{fontSize:32,margin:'24px 0 8px'}}>개인정보처리방침</h1>
    <p style={{...p,color:'#858793'}}>시행일: 2026년 9월 13일</p>
    <p style={p}>MOA(이하 “서비스”)는 SNS 및 고객 커뮤니케이션 통합 관리 기능을 제공하며, 서비스 운영에 필요한 범위에서 개인정보 및 채널 데이터를 처리합니다.</p>

    <section style={section}><h2 style={h2}>1. 처리하는 정보</h2>
      <ul>
        <li style={li}>고객사 정보: 고객사명, 업종, 운영 말투 및 응대 정책</li>
        <li style={li}>Instagram 연결 정보: Instagram 사용자명, 계정 식별자, OAuth 액세스 토큰 및 토큰 만료 정보</li>
        <li style={li}>SNS 상호작용 정보: 연결된 계정의 댓글, 다이렉트 메시지, 작성자 식별 정보, 관련 게시물 정보</li>
        <li style={li}>네이버 블로그 수집 정보: 로컬 수집기가 읽은 새 댓글·새 답글 알림의 작성자, 글 제목, 링크 및 표시 시각</li>
        <li style={li}>채널톡 연동 시: 채널 식별 정보 및 상담 메시지 정보</li>
      </ul>
    </section>

    <section style={section}><h2 style={h2}>2. 이용 목적</h2>
      <ul>
        <li style={li}>고객사별 SNS 채널 연결 및 통합 관리</li>
        <li style={li}>댓글·메시지 수신, 확인, 응답 초안 작성 및 승인 후 전송</li>
        <li style={li}>콘텐츠 일정 및 발행 상태 관리</li>
        <li style={li}>서비스 오류 확인 및 보안 유지</li>
      </ul>
    </section>

    <section style={section}><h2 style={h2}>3. 보관 및 삭제</h2>
      <p style={p}>서비스는 운영에 필요한 기간 동안 정보를 보관합니다. 고객사를 삭제하거나 채널 연결을 해제하는 경우 해당 연결 정보 및 관련 운영 데이터는 서비스 운영 정책에 따라 삭제할 수 있습니다. 법령상 보존 의무가 있는 정보는 해당 기간 동안 별도로 보관할 수 있습니다.</p>
    </section>

    <section style={section}><h2 style={h2}>4. 외부 서비스 이용</h2>
      <p style={p}>서비스 제공을 위해 Meta/Instagram, Supabase, Vercel, ChannelTalk 및 선택적으로 OpenAI 등의 외부 서비스를 사용할 수 있습니다. 각 서비스에는 해당 사업자의 개인정보 및 데이터 처리 정책이 적용될 수 있습니다.</p>
    </section>

    <section style={section}><h2 style={h2}>5. 인증정보 보호</h2>
      <p style={p}>Instagram OAuth 토큰 등 민감한 연결 정보는 서버 측에서만 처리하며, 브라우저에 관리자용 비밀키를 노출하지 않습니다. 저장이 필요한 인증정보는 암호화하여 관리합니다. 네이버 로그인 비밀번호는 MOA 서버에 저장하지 않습니다.</p>
    </section>

    <section style={section}><h2 style={h2}>6. 이용자의 선택 및 삭제 요청</h2>
      <p style={p}>이용자는 연결된 채널의 권한을 해당 플랫폼에서 철회할 수 있으며, MOA에 저장된 관련 데이터의 삭제를 요청할 수 있습니다. 삭제 절차는 <a href="/data-deletion" style={{color:'#5f9f7a'}}>데이터 삭제 안내</a>에서 확인할 수 있습니다.</p>
    </section>

    <section style={section}><h2 style={h2}>7. 개인정보 보호책임자</h2>
      <p style={p}>서비스명: MOA</p>
      <p style={p}>운영자/개인정보 보호책임자: 박찬양</p>
      <p style={p}>개인정보 관련 문의는 서비스 운영자를 통해 접수할 수 있습니다.</p>
    </section>

    <section style={section}><h2 style={h2}>8. 방침 변경</h2>
      <p style={p}>본 방침은 서비스 기능 또는 관련 법령의 변경에 따라 수정될 수 있으며, 중요한 변경 사항은 서비스 내에서 안내합니다.</p>
    </section>
  </main>
}
