# OOS — Only One Sentence

알바·스태프용 **한 문장 영어** 도우미. 카페 / 편의점 / 식당 / 뷰티샵 상황에서 바로 쓸 문장을 고르고, 연습·발음·즐겨찾기를 지원합니다.

## 기능

- 업종별 상황 플로우와 짧은 영어 문장 (`js/data.js`)
- Text / Voice 연습, 즐겨찾기·최근 사용 (localStorage)
- Web Speech로 듣기·말하기
- Gemini 도우미: 역할극, 번역, TTS/STT (키 있을 때)

## 실행

**기본 UI만** — `index.html`을 브라우저로 연다.

**Gemini 사용** — `.env`에 키를 넣고 **로컬 HTTP**로 연다 (`file://`에서는 `.env` fetch가 막힐 수 있음).

```env
GEMINI_API_KEY=your_key_here
```

선택: Node 프록시 서버

```bash
node server.mjs
# http://localhost:8787
```

또는 VS Code Live Server 등으로 폴더를 연다.

`.env`는 git에 올리지 마세요 (`.gitignore`에 포함됨).

## 구조

```
OOS/
  index.html
  styles.css
  server.mjs          # 선택: 정적 + Gemini 프록시
  js/
    data.js           # 업종·상황·문장
    app.js            # UI
    storage.js
    speech.js
    gemini.js
    practice-demo.js
    helper-ui.js
  assets/
```

문장·상황을 바꾸려면 `js/data.js`의 `SITUATIONS` / `INDUSTRIES`를 수정한 뒤 새로고침하면 됩니다.

## 라이선스

개인·학습용 초안입니다. 문구는 전문 감수된 자료가 아닙니다.
