# MOA 네이버 블로그 로컬 수집기

네이버 블로그 홈 오른쪽의 **내 소식** 영역을 읽어서 MOA 통합 댓글함으로 전송합니다.

## 현재 수집 대상

수집기는 네이버 블로그 홈 오른쪽 `.list_news .item`에서 다음 유형만 읽습니다.

- 새 댓글
- 새 답글

공감, 좋아요, 이웃, 스크랩 등 다른 반응은 가져오지 않습니다.

실제 DOM에서 `.blind`, `a.name em.name`, `a.post_link`, `.title_my_post`, `.text_datetime`를 읽고, 댓글 URL의 `commentNoPosition`을 안정적인 중복 키로 사용합니다.

별도 댓글 관리 화면을 열어둘 필요는 없습니다.

## 구조

1. 이 PC에서 Playwright Chromium을 실행합니다.
2. 처음 한 번 Chromium에서 네이버에 직접 로그인합니다.
3. 로그인 세션은 `profile/` 폴더에 저장됩니다.
4. 수집기는 블로그 홈의 **내 소식** 패널을 약 60초마다 확인합니다.
5. 읽은 항목은 MOA의 `/api/collector/naver/import`로 전송됩니다.
6. MOA 통합 댓글함에서 해당 고객사의 **네이버 채널** 항목으로 표시됩니다.
7. MOA에서 **확인**을 누르면 해당 항목은 `confirmed` 상태가 되어 숨겨지고, 수집기가 같은 `commentNoPosition`을 다시 보내도 새 알림으로 되살아나지 않습니다.

## 설치

Node.js 실행 경로를 잡은 뒤:

```powershell
cd "D:\moa app\moa\tools\naver-collector"
npm.cmd install
npx.cmd playwright install chromium
```

## .env

`.env.example`을 복사해 `.env`를 만듭니다.

예:

```text
MOA_URL=https://your-moa-domain.vercel.app
COLLECTOR_SECRET=Vercel의 COLLECTOR_SHARED_SECRET과 동일한 값
CLIENT_ID=고객사 UUID
NAVER_BLOG_ID=네이버 블로그 ID
NAVER_MANAGEMENT_URL=https://section.blog.naver.com/BlogHome.naver
POLL_SECONDS=60
```

`NAVER_MANAGEMENT_URL`은 이름은 기존 호환 때문에 그대로지만, 이제 **블로그 홈 주소**를 넣으면 됩니다.

현재 화면처럼 아래 주소를 사용할 수 있습니다.

```text
https://section.blog.naver.com/BlogHome.naver
```

## 첫 실행

```powershell
npm.cmd start
```

Chromium이 열렸는데 로그인되어 있지 않으면 직접 네이버에 로그인합니다.

터미널에:

```text
로그인을 완료한 뒤 이 PowerShell 창에서 Enter를 누르세요:
```

가 뜨면 로그인 완료 후 Enter를 누릅니다.

로그인 정보와 비밀번호는 MOA로 보내지 않습니다.

## 정상 동작 예시

```text
MOA 네이버 블로그 홈 "내 소식" 수집기 시작
수집된 내 소식:
 - alth4160님이 ...
 - alth4160님이 ...
2026. 9. 13. 오전 1:00:00 내 소식 수집/전송 2 건
```

이후 같은 알림은 MOA 서버에서 중복 저장되지 않습니다.

## 주의

네이버가 블로그 홈 화면 구조를 바꾸면 수집 선택자를 다시 조정해야 할 수 있습니다.
Playwright Chromium과 PowerShell 프로세스가 실행 중이어야 수집이 계속됩니다.
