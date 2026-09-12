# MOA 네이버 블로그 로컬 수집기

네이버 블로그 댓글/알림은 MOA 서버에 네이버 ID/비밀번호를 저장하지 않습니다.

## 구조

1. 이 PC에서 Playwright 브라우저를 실행합니다.
2. 처음 한 번 네이버 로그인 화면에서 직접 로그인합니다.
3. 로그인 세션은 `profile/` 폴더에만 저장됩니다.
4. 수집기는 댓글 관리 페이지를 읽어 정규화한 뒤 MOA의 `/api/collector/naver/import`로 전송합니다.
5. MOA에서 승인한 네이버 답변은 `/api/collector/naver/jobs`에서 가져와 로컬 브라우저가 처리하도록 확장할 수 있습니다.

## 설치

Node.js 설치 후 이 폴더에서:

```bash
npm install
npx playwright install chromium
```

`.env.example`을 복사해 `.env`를 만들고 값을 입력합니다.

중요:
- `NAVER_PASSWORD` 같은 값은 사용하지 않습니다.
- `COLLECTOR_SECRET`은 Vercel의 `COLLECTOR_SHARED_SECRET`과 같은 값이어야 합니다.
- `CLIENT_ID`는 MOA 고객사 UUID입니다.
- `NAVER_MANAGEMENT_URL`은 네이버 블로그 관리의 댓글/활동 페이지 URL을 넣습니다. 네이버 화면 구조가 바뀌면 이 URL/선택자를 조정해야 합니다.

## 실행

```bash
npm start
```

첫 실행 시 브라우저가 열립니다. 네이버 로그인이 필요하면 직접 로그인한 뒤 터미널에서 Enter를 누르세요.
