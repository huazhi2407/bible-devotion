# AI 回顧功能 - 免費 API 設定指南

本專案支援多個免費 AI API，你可以選擇其中一個來使用 AI 回顧功能。

## 🆓 免費選項（推薦順序）

### 1. Google Gemini（推薦⭐）

**優點：**
- ✅ 免費層級額度充足
- ✅ Google 官方 API，穩定可靠
- ✅ 中文支援優秀
- ✅ 響應速度快
- ✅ 使用最新的 Gemini 1.5 Flash 模型

**設定步驟：**
1. 前往 https://makersuite.google.com/app/apikey 建立 API Key
2. 點擊「Create API Key」按鈕
3. 複製生成的 API Key
4. 在專案根目錄的 `.env.local` 檔案中添加：
   ```
   NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
   ```
5. 重新啟動開發伺服器：`npm run dev`

---

### 2. Hugging Face（完全免費）

**優點：**
- ✅ 免費層級額度充足
- ✅ Google 官方 API，穩定可靠
- ✅ 中文支援優秀

**設定步驟：**
1. 前往 https://makersuite.google.com/app/apikey 建立 API Key
2. 在 `.env.local` 檔案中添加：
   ```
   NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
   ```
3. 重新啟動開發伺服器

---

### 3. Cohere（每月 1000 次免費）

**優點：**
- ✅ 每月 1000 次免費 API 調用
- ✅ 簡單易用
- ⚠️ 中文支援較弱

**設定步驟：**
1. 前往 https://cohere.com/ 註冊帳號
2. 在 Dashboard 取得 API Key
3. 在 `.env.local` 檔案中添加：
   ```
   NEXT_PUBLIC_COHERE_API_KEY=your_api_key_here
   ```
4. 重新啟動開發伺服器

---

### 4. OpenAI（$5 試用額度）

**優點：**
- ✅ 品質優秀
- ✅ 中文支援極佳
- ⚠️ 僅有 $5 試用額度（約 3 個月）

**設定步驟：**
1. 前往 https://platform.openai.com/ 註冊帳號
2. 在 API Keys 頁面建立新的 API Key
3. 在 `.env.local` 檔案中添加：
   ```
   NEXT_PUBLIC_OPENAI_API_KEY=your_api_key_here
   ```
4. 重新啟動開發伺服器

---

## 📝 .env.local 範例

```env
# 推薦使用 Gemini（優先順序最高）
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxx

# 其他選項（如果未設定 Gemini，系統會依序嘗試）
# NEXT_PUBLIC_HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
# NEXT_PUBLIC_COHERE_API_KEY=xxxxxxxxxxxxx
# NEXT_PUBLIC_OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

## 🔄 自動選擇機制

系統會按照以下優先順序自動選擇可用的 API：
1. **Google Gemini**（優先）
2. Hugging Face
3. OpenAI
4. Cohere

如果都沒有設定，系統會顯示設定說明。

## 💡 建議

- **推薦使用**：Google Gemini（免費、穩定、中文支援優秀）⭐
- **開發測試**：Hugging Face（完全免費）
- **高品質需求**：OpenAI（需付費）

## ⚠️ 注意事項

1. `.env.local` 檔案不會被提交到 Git，請妥善保管你的 API Key
2. 重新啟動開發伺服器後，新的環境變數才會生效
3. 如果 API 調用失敗，請檢查：
   - API Key 是否正確
   - 網路連線是否正常
   - API 額度是否用完
