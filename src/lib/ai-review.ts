import { DevotionRecord } from "./devotion";
import { CheckInRecord } from "./checkin";

export type ReviewPeriod = "week" | "month";

export type ReviewData = {
  devotionRecords: DevotionRecord[];
  checkInRecords: CheckInRecord[];
  period: ReviewPeriod;
  startDate: string;
  endDate: string;
};

export function getWeekRange(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 週一開始
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getMonthRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function filterRecordsByDateRange<T extends { date: string }>(
  records: T[],
  startDate: Date,
  endDate: Date
): T[] {
  return records.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate >= startDate && recordDate <= endDate;
  });
}

export function prepareReviewData(
  devotionRecords: DevotionRecord[],
  checkInRecords: CheckInRecord[],
  period: ReviewPeriod,
  date: Date = new Date()
): ReviewData {
  const range = period === "week" ? getWeekRange(date) : getMonthRange(date);
  return {
    devotionRecords: filterRecordsByDateRange(devotionRecords, range.start, range.end),
    checkInRecords: filterRecordsByDateRange(checkInRecords, range.start, range.end),
    period,
    startDate: range.start.toISOString(),
    endDate: range.end.toISOString(),
  };
}

export type AIProvider = "huggingface" | "gemini" | "openai" | "cohere";

function buildPrompt(reviewData: ReviewData): string {
  const { devotionRecords, checkInRecords, period, startDate, endDate } = reviewData;
  
  const periodLabel = period === "week" ? "週" : "月";
  const start = new Date(startDate).toLocaleDateString("zh-TW");
  const end = new Date(endDate).toLocaleDateString("zh-TW");

  // 構建提示詞
  let prompt = `請為我整理${periodLabel}回顧（${start} 至 ${end}）：\n\n`;

  if (devotionRecords.length > 0) {
    prompt += `## 靈修記錄（${devotionRecords.length} 次）\n\n`;
    devotionRecords.forEach((record, index) => {
      const date = new Date(record.date).toLocaleDateString("zh-TW");
      const scriptures = Array.isArray(record.scripture) 
        ? record.scripture.map(s => `${s.reference}: ${s.text}`).join("\n")
        : `${record.scripture.reference}: ${record.scripture.text}`;
      
      prompt += `### ${index + 1}. ${date}\n`;
      prompt += `經文：${scriptures}\n`;
      if (record.observation) prompt += `觀察：${record.observation}\n`;
      if (record.application) prompt += `應用：${record.application}\n`;
      if (record.prayerText) prompt += `禱告：${record.prayerText}\n`;
      prompt += "\n";
    });
  } else {
    prompt += `## 靈修記錄：本${periodLabel}無記錄\n\n`;
  }

  if (checkInRecords.length > 0) {
    prompt += `## 簽到記錄（${checkInRecords.length} 次）\n\n`;
    checkInRecords.forEach((checkIn) => {
      const date = new Date(checkIn.date).toLocaleDateString("zh-TW");
      prompt += `- ${date}`;
      if (checkIn.mood) prompt += `，心情：${checkIn.mood}`;
      if (checkIn.note) prompt += `，備註：${checkIn.note}`;
      prompt += "\n";
    });
  } else {
    prompt += `## 簽到記錄：本${periodLabel}無記錄\n\n`;
  }

  prompt += `\n請根據以上記錄，為我整理一份${periodLabel}回顧，包括：\n`;
  prompt += `1. 本${periodLabel}的靈修重點和主題\n`;
  prompt += `2. 神在本${periodLabel}對你說的話\n`;
  prompt += `3. 本${periodLabel}的成長和改變\n`;
  prompt += `4. 值得感恩的事項\n`;
  prompt += `5. 下${periodLabel}可以繼續關注的方向\n\n`;
  prompt += `請用溫暖、鼓勵的語氣，以繁體中文回應。`;

  return prompt;
}

async function callHuggingFace(prompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("未設定 HUGGINGFACE_API_KEY");
  }

  // 使用 Meta Llama 3.1 8B 模型（免費且支援中文）
  const model = "meta-llama/Meta-Llama-3.1-8B-Instruct";
  
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n你是一位溫暖、鼓勵的靈修導師，幫助信徒整理和回顧他們的靈修歷程。<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.7,
          return_full_text: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hugging Face API 錯誤: ${error}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text.trim();
  }
  if (data.error) {
    throw new Error(`Hugging Face API 錯誤: ${data.error}`);
  }
  return JSON.stringify(data);
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("未設定 GEMINI_API_KEY");
  }

  // 嘗試多個模型名稱，按優先順序（免費 API 支援的模型）
  const models = [
    "gemini-pro",        // 標準免費模型
    "gemini-1.5-pro",   // Gemini 1.5 Pro
    "gemini-1.5-flash",  // Gemini 1.5 Flash
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `你是一位溫暖、鼓勵的靈修導師，幫助信徒整理和回顧他們的靈修歷程。\n\n${prompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
              topP: 0.95,
              topK: 40,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "請求失敗";
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error?.message || error.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        // 如果是模型不存在的錯誤，嘗試下一個模型
        if (errorMessage.includes("not found") || errorMessage.includes("not supported")) {
          lastError = new Error(`模型 ${model} 不可用: ${errorMessage}`);
          continue; // 嘗試下一個模型
        }
        
        throw new Error(`Gemini API 錯誤: ${errorMessage}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        // 檢查是否有被安全設定阻擋
        if (data.candidates?.[0]?.finishReason === "SAFETY") {
          throw new Error("內容被安全設定阻擋，請調整提示詞");
        }
        throw new Error("無法生成回顧，請檢查 API 回應");
      }
      
      // 成功，返回結果
      return text;
    } catch (error: any) {
      // 如果不是模型不存在的錯誤，直接拋出
      if (!error.message?.includes("not found") && !error.message?.includes("not supported")) {
        throw error;
      }
      lastError = error;
      // 繼續嘗試下一個模型
    }
  }

  // 所有模型都失敗了
  throw new Error(
    `所有 Gemini 模型都無法使用。最後的錯誤：${lastError?.message || "未知錯誤"}\n\n` +
    `請確認你的 API Key 是否正確，或檢查 Google AI Studio 查看可用的模型列表。`
  );
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("未設定 OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "你是一位溫暖、鼓勵的靈修導師，幫助信徒整理和回顧他們的靈修歷程。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenAI API 請求失敗");
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "無法生成回顧";
}

async function callCohere(prompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_COHERE_API_KEY;
  if (!apiKey) {
    throw new Error("未設定 COHERE_API_KEY");
  }

  const response = await fetch("https://api.cohere.ai/v1/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "command",
      prompt: `你是一位溫暖、鼓勵的靈修導師，幫助信徒整理和回顧他們的靈修歷程。\n\n${prompt}`,
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Cohere API 錯誤: ${error.message || "請求失敗"}`);
  }

  const data = await response.json();
  return data.generations?.[0]?.text || "無法生成回顧";
}

export async function generateAIReview(
  reviewData: ReviewData,
  provider?: AIProvider
): Promise<string> {
  const prompt = buildPrompt(reviewData);

  // 自動選擇可用的提供者
  if (!provider) {
    // 優先順序：Gemini > Hugging Face > OpenAI > Cohere
    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      provider = "gemini";
    } else if (process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY) {
      provider = "huggingface";
    } else if (process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      provider = "openai";
    } else if (process.env.NEXT_PUBLIC_COHERE_API_KEY) {
      provider = "cohere";
    } else {
      return `⚠️ 尚未設定任何 AI API Key。\n\n推薦設定 Google Gemini（免費且穩定）：\n\n1. **Google Gemini**（推薦⭐）\n   - 前往：https://makersuite.google.com/app/apikey\n   - 點擊「Create API Key」建立新的 API Key\n   - 在專案根目錄的 .env.local 檔案中添加：\n     NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here\n   - 重新啟動開發伺服器：npm run dev\n\n其他免費選項：\n\n2. **Hugging Face**（完全免費）\n   - 註冊：https://huggingface.co/\n   - 取得 API Key：https://huggingface.co/settings/tokens\n   - 在 .env.local 設定：NEXT_PUBLIC_HUGGINGFACE_API_KEY=your_key\n\n3. **Cohere**（每月 1000 次免費）\n   - 註冊：https://cohere.com/\n   - 在 .env.local 設定：NEXT_PUBLIC_COHERE_API_KEY=your_key\n\n4. **OpenAI**（$5 試用額度）\n   - 註冊：https://platform.openai.com/\n   - 在 .env.local 設定：NEXT_PUBLIC_OPENAI_API_KEY=your_key\n\n以下是準備好的資料：\n\n${prompt}`;
    }
  }

  try {
    switch (provider) {
      case "huggingface":
        return await callHuggingFace(prompt);
      case "gemini":
        return await callGemini(prompt);
      case "openai":
        return await callOpenAI(prompt);
      case "cohere":
        return await callCohere(prompt);
      default:
        throw new Error(`不支援的 AI 提供者: ${provider}`);
    }
  } catch (error: any) {
    console.error("AI 回顧生成失敗", error);
    throw new Error(`生成 AI 回顧失敗（${provider}）：${error.message}`);
  }
}
