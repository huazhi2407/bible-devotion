# API Keys 設定總覽

本專案需要設定以下 API Keys 才能完整使用所有功能。

## 📋 必需的 API Keys

### 1. Google Gemini API（AI 回顧功能）⭐

**用途：** 生成每週/每月靈修回顧

**設定步驟：**
1. 前往：https://makersuite.google.com/app/apikey
2. 點擊「Create API Key」
3. 複製 API Key
4. 在 `.env.local` 添加：
   ```env
   NEXT_PUBLIC_GEMINI_API_KEY=你的_API_Key
   ```

**詳細說明：** 請參考 [AI_API_SETUP.md](./AI_API_SETUP.md)

---

### 2. Firebase（Google 登入與雲端同步）

**用途：** 
- Google 帳號登入
- 靈修記錄雲端同步
- 簽到記錄雲端同步

**需要設定的環境變數：**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

**設定步驟：**
1. 前往：https://console.firebase.google.com/
2. 建立新專案或選擇現有專案
3. 前往「專案設定」→「一般」→「你的應用程式」
4. 選擇「Web」圖示（</>）
5. 註冊應用程式後，複製設定值到 `.env.local`

**詳細說明：** 請參考 [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

**注意：** 如果不需要雲端同步功能，可以不設定 Firebase，記錄會儲存在瀏覽器的 localStorage。

---

## 🔧 選填的 API Keys

### 3. Scripture API（經文載入功能）

**用途：** 在「選擇書卷與章」功能中自動載入經文

**設定步驟：**
1. 前往：https://scripture.api.bible
2. 註冊帳號並取得 API Key
3. 在 `.env.local` 添加：
   ```env
   NEXT_PUBLIC_SCRIPTURE_API_KEY=你的_API_Key
   NEXT_PUBLIC_SCRIPTURE_BIBLE_ID=04fb2bec0d582d1f-01
   ```

**可用的中文譯本：**
- `04fb2bec0d582d1f-01` - 免費易讀聖經（預設）
- `7ea794434e9ea7ee-01` - 當代譯本（簡體）2022
- `a6e06d2c5b90ad89-01` - 當代譯本（繁體）2023

**注意：** 如果不設定此 API，仍可手動貼上經文，不影響主要功能。

---

## 📝 完整的 .env.local 範例

```env
# ============================================
# 必需的 API Keys
# ============================================

# Google Gemini API（AI 回顧功能）
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxx

# Firebase（Google 登入與雲端同步）
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop

# ============================================
# 選填的 API Keys
# ============================================

# Scripture API（經文載入功能）
NEXT_PUBLIC_SCRIPTURE_API_KEY=your_api_key_here
NEXT_PUBLIC_SCRIPTURE_BIBLE_ID=04fb2bec0d582d1f-01

# ============================================
# 其他 AI API 選項（如果不想用 Gemini）
# ============================================

# Hugging Face（完全免費）
# NEXT_PUBLIC_HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx

# OpenAI（$5 試用額度）
# NEXT_PUBLIC_OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Cohere（每月 1000 次免費）
# NEXT_PUBLIC_COHERE_API_KEY=xxxxxxxxxxxxx
```

---

## 🚀 快速開始

### 最小設定（基本功能）

只需要設定 Gemini API 即可使用 AI 回顧功能：

```env
NEXT_PUBLIC_GEMINI_API_KEY=你的_API_Key
```

### 完整設定（所有功能）

設定 Firebase + Gemini API：

```env
# Gemini API
NEXT_PUBLIC_GEMINI_API_KEY=你的_API_Key

# Firebase（6 個變數）
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

---

## ⚠️ 重要提醒

1. **`.env.local` 檔案位置：** 必須放在專案根目錄（與 `package.json` 同一層）

2. **重新啟動伺服器：** 修改 `.env.local` 後，必須重新啟動開發伺服器：
   ```bash
   npm run dev
   ```

3. **不要提交 API Key：** `.env.local` 已在 `.gitignore` 中，不會被提交到 Git

4. **API Key 安全：** 
   - 不要分享你的 API Key
   - 不要在公開場所（如 GitHub）暴露 API Key
   - 如果 API Key 洩露，請立即重新生成

---

## 📚 相關文件

- [AI_API_SETUP.md](./AI_API_SETUP.md) - AI 回顧功能詳細設定
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) - Firebase 詳細設定

---

## ❓ 常見問題

**Q: 哪些功能是必需的？**
A: 只有 AI 回顧功能需要 API Key（Gemini）。Firebase 是可選的（用於雲端同步），Scripture API 也是可選的（用於自動載入經文）。

**Q: 如果沒有設定 Firebase，還能使用嗎？**
A: 可以！記錄會儲存在瀏覽器的 localStorage，只是無法在不同裝置間同步。

**Q: 可以同時設定多個 AI API 嗎？**
A: 可以，但系統會按照優先順序自動選擇：Gemini > Hugging Face > OpenAI > Cohere

**Q: API Key 有使用限制嗎？**
A: 
- Gemini: 免費層級有額度限制，但通常足夠個人使用
- Firebase: 免費層級有配額限制，但個人使用通常不會超過
- Scripture API: 有免費層級，但有限制
