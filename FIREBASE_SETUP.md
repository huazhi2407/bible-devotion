# Firebase 設定說明

Firebase 設定值需要從 Firebase Console 取得，然後填入專案根目錄的 `.env.local` 檔案中。

## 📍 在哪裡更改 Firebase 設定？

**答案：在專案根目錄的 `.env.local` 檔案中**

如果還沒有這個檔案，請：
1. 複製 `.env.example` 為 `.env.local`
2. 填入從 Firebase Console 取得的設定值

---

## 🔧 步驟 1：建立 Firebase 專案（如果還沒有）

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「新增專案」或「Add project」
3. 輸入專案名稱（例如：`bible-devotion`）
4. 選擇是否啟用 Google Analytics（可選）
5. 點擊「建立專案」

---

## 🔑 步驟 2：取得 Firebase 設定值

### 2.1 註冊 Web 應用程式

1. 在 Firebase Console 中，選擇你的專案
2. 點擊左側選單的「專案設定」（⚙️ 圖示）
3. 向下滾動到「你的應用程式」區塊
4. 點擊「Web」圖示（`</>`）
5. 輸入應用程式暱稱（例如：`Bible Devotion Web`）
6. **不要**勾選「也為此應用程式設定 Firebase Hosting」（除非你需要）
7. 點擊「註冊應用程式」

### 2.2 複製設定值

註冊後，你會看到類似這樣的設定值：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijklmnop"
};
```

**請複製這些值，稍後會用到。**

---

## 📝 步驟 3：設定環境變數

1. 在專案根目錄（與 `package.json` 同一層）找到或建立 `.env.local` 檔案
2. 將 Firebase 設定值填入：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...（從 firebaseConfig.apiKey）
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com（從 firebaseConfig.authDomain）
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id（從 firebaseConfig.projectId）
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app（從 firebaseConfig.storageBucket）
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012（從 firebaseConfig.messagingSenderId）
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop（從 firebaseConfig.appId）
```

**範例：**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=bible-devotion.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bible-devotion
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=bible-devotion.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop
```

---

## 🔐 步驟 4：啟用 Authentication（Google 登入）

1. 在 Firebase Console 左側選單，點擊「Authentication」
2. 點擊「開始使用」或「Get started」
3. 點擊「Sign-in method」標籤
4. 找到「Google」，點擊啟用
5. 輸入專案支援電子郵件（通常是你的 Gmail）
6. 點擊「儲存」

---

## 💾 步驟 5：設定 Firestore Database

1. 在 Firebase Console 左側選單，點擊「Firestore Database」
2. 點擊「建立資料庫」
3. 選擇「以測試模式啟動」（之後可以修改規則）
4. 選擇資料庫位置（建議選擇離你最近的區域，例如：`asia-east1`）
5. 點擊「啟用」

### 5.1 設定 Firestore 安全規則

1. 在 Firestore Database 頁面，點擊「規則」標籤
2. 將 `firestore.rules` 檔案的內容貼上：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/records/{recordId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/checkins/{checkInId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. 點擊「發布」

---

## 🚀 步驟 6：重新啟動開發伺服器

修改 `.env.local` 後，**必須重新啟動開發伺服器**：

```bash
npm run dev
```

---

## ✅ 驗證設定是否成功

1. 開啟應用程式（通常是 http://localhost:3000）
2. 點擊右上角「設定與記錄」
3. 在「帳戶」區塊，應該會看到「以 Google 帳號登入」按鈕
4. 點擊登入，如果成功，代表 Firebase 設定正確！

---

## 🔄 如何更改 Firebase 設定？

如果已經設定過，想要更改：

1. **更改專案：** 在 `.env.local` 中更新所有 Firebase 相關的環境變數
2. **重新啟動伺服器：** `npm run dev`
3. **清除瀏覽器快取：** 如果遇到問題，清除瀏覽器快取或使用無痕模式

---

## 📍 檔案位置提醒

- **設定檔案：** `.env.local`（在專案根目錄）
- **Firebase 設定值來源：** [Firebase Console](https://console.firebase.google.com/)
- **Firestore 規則檔案：** `firestore.rules`（在專案根目錄）

---

## ⚠️ 常見問題

**Q: 找不到 `.env.local` 檔案？**
A: 這個檔案可能不存在，請複製 `.env.example` 並重新命名為 `.env.local`

**Q: 設定後還是無法登入？**
A: 
- 確認已重新啟動開發伺服器
- 檢查 `.env.local` 中的值是否正確（沒有多餘的空格或引號）
- 確認 Firebase Console 中已啟用 Google Authentication

**Q: 可以有多個 Firebase 專案嗎？**
A: 可以，只要在 `.env.local` 中更改設定值即可切換不同的 Firebase 專案

**Q: Firestore 規則在哪裡設定？**
A: Firebase Console → Firestore Database → 規則標籤

---

## 📚 相關資源

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase 文件](https://firebase.google.com/docs)
- [Firestore 安全規則文件](https://firebase.google.com/docs/firestore/security/get-started)
