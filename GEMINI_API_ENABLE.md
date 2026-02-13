# 如何啟用 Gemini API

如果你遇到「模型不可用」或「API has not been used」的錯誤，可能是因為尚未在 Google Cloud Console 中啟用 Gemini API。

## 🔧 啟用步驟

### 方法 1：透過 API 庫啟用（推薦）

1. **前往 API 庫頁面**
   - 開啟：https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
   - 或前往：Google Cloud Console → API 和服務 → 程式庫

2. **選擇專案**
   - 確認選擇的是「Default Gemini Project」或你建立 API Key 的專案

3. **啟用 API**
   - 點擊「啟用」按鈕
   - 等待幾秒鐘讓 API 啟用完成

4. **驗證**
   - 啟用後，頁面會顯示「API 已啟用」
   - 等待 1-2 分鐘讓設定生效

### 方法 2：透過 Google AI Studio 啟用

1. **前往 Google AI Studio**
   - 開啟：https://aistudio.google.com/
   - 使用你的 Google 帳號登入

2. **建立 API Key**
   - 如果還沒有 API Key，點擊「Get API key」
   - 選擇「Create API key in new project」或選擇現有專案

3. **API 會自動啟用**
   - Google AI Studio 會自動為你啟用必要的 API

## ✅ 驗證 API 是否已啟用

1. 前往 Google Cloud Console：https://console.cloud.google.com/
2. 選擇你的專案
3. 前往「API 和服務」→「已啟用的 API」
4. 搜尋「Generative Language API」或「Gemini API」
5. 確認狀態顯示為「已啟用」

## 🔍 常見問題

### Q: 啟用後還是無法使用？
A: 
- 等待 1-2 分鐘讓設定生效
- 確認 API Key 是否正確設定在 `.env.local` 檔案中
- 確認已重新啟動開發伺服器（`npm run dev`）

### Q: 找不到「Generative Language API」？
A: 
- 嘗試搜尋「Gemini API」或「generativelanguage」
- 確認你選擇的是正確的 Google Cloud 專案

### Q: 需要付費嗎？
A: 
- 免費層級通常有足夠的額度供個人使用
- 查看配額：https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

## 📝 設定 API Key

啟用 API 後，確保你的 `.env.local` 檔案中有正確的設定：

```env
NEXT_PUBLIC_GEMINI_API_KEY=你的_API_Key
```

然後重新啟動開發伺服器：

```bash
npm run dev
```

## 🆘 仍然遇到問題？

如果啟用 API 後仍然無法使用，請檢查：

1. **API Key 是否正確**
   - 確認 API Key 沒有多餘的空格或引號
   - 確認 API Key 是從正確的專案中取得的

2. **專案是否正確**
   - 確認 API Key 和啟用的 API 屬於同一個 Google Cloud 專案

3. **網路連線**
   - 確認網路連線正常
   - 如果使用 VPN，嘗試關閉後重試

4. **查看詳細錯誤訊息**
   - 檢查瀏覽器控制台（F12）的錯誤訊息
   - 查看終端機的錯誤輸出
