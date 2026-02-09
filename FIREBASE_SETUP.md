# Firebase 設定說明

## 1. 複製環境變數

將 `.env.example` 複製為 `.env.local`，填入 Firebase Console 專案設定中的值：

```
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ku-yu-bible.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ku-yu-bible
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ku-yu-bible.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

## 2. Firestore 安全規則

在 Firebase Console → Firestore Database → 規則，貼上 `firestore.rules` 的內容。

## 3. Firestore 索引（若出現錯誤）

首次載入雲端記錄時，若出現「需要建立索引」的錯誤，點擊錯誤訊息中的連結即可自動建立。

## 4. 安裝依賴

```bash
npm install
```

## 5. 執行

```bash
npm run dev
```

登入後，靈修記錄會同步至 Firestore，手機與電腦使用同一 Google 帳號即可看到相同記錄。
