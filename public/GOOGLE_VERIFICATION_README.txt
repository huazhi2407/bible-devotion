Google 網站驗證檔說明
========================

1. 前往 Google Search Console：https://search.google.com/search-console
2. 新增資源（網域或網址前綴），選擇「網址前綴」並輸入你的網站網址
3. 選擇驗證方式「HTML 標記」或「HTML 檔案」：
   - HTML 標記：把 meta 的 content 值貼到專案 layout 或 _document 的 <head>
   - HTML 檔案：Google 會給你一個檔名（例如 google0a1b2c3d4e5f6.html）
     → 在 public 資料夾新增「該檔名」的檔案，內容可為空白或一行文字
4. 若使用「HTML 檔案」：請將 Google 提供的檔名重新命名現有的
   google-site-verification.html，或新增一個與 Google 要求同名的檔案
5. 部署後在 Search Console 按「驗證」

目前 public 內有 google-site-verification.html 範本，
請依 Google 給的驗證碼替換 meta content，或改用 Google 指定的檔名與內容。
