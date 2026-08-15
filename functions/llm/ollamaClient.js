const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma2:2b";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function todayInJST() {
  // Asia/Tokyo is UTC+9 with no DST; toISOString() alone would use UTC
  // and could report the previous day during early-morning JST hours.
  const now = new Date();
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000;
  return new Date(jstMs);
}

function addDays(d, days) {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function buildDateReferenceTable(today) {
  const todayDow = today.getUTCDay(); // 0=Sun..6=Sat
  const daysUntilNextMon = ((1 - todayDow + 7) % 7) || 7;
  const nextMon = addDays(today, daysUntilNextMon);

  const lines = [`今日: ${formatDate(today)}（${WEEKDAY_JA[todayDow]}）`];

  // Remaining days of this week (today through this Sunday)
  for (let dow = todayDow; dow <= 6; dow++) {
    const d = addDays(today, dow - todayDow);
    const label = dow === todayDow ? `今日・今週${WEEKDAY_JA[dow]}` : `今週${WEEKDAY_JA[dow]}`;
    lines.push(`${label}: ${formatDate(d)}`);
  }

  // All days of next week (next Monday through next Sunday)
  for (let i = 0; i < 7; i++) {
    const d = addDays(nextMon, i);
    lines.push(`来週${WEEKDAY_JA[(1 + i) % 7]}: ${formatDate(d)}`);
  }

  const thisMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const nextMonth1st = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const nextMonth15th = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 15));
  const nextMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0));

  lines.push(`今月末: ${formatDate(thisMonthEnd)}`);
  lines.push(`来月1日: ${formatDate(nextMonth1st)}`);
  lines.push(`来月15日: ${formatDate(nextMonth15th)}`);
  lines.push(`来月末: ${formatDate(nextMonthEnd)}`);

  return lines.join("\n");
}

function buildPrompt(rawText, participants, strict) {
  const today = todayInJST();
  const dateTable = buildDateReferenceTable(today);
  const strictNote = strict
    ? "\n重要: 必ずJSONのみを出力してください。マークダウンのコードブロック（```）や説明文を一切含めないでください。"
    : "";
  return `あなたは日本語の会議議事録を整理するアシスタントです。
以下の文字起こし/メモを読み、次のJSON形式で出力してください。
出力はJSONのみとし、説明文や前置き、マークダウンのコードブロック記法（\`\`\`）は一切含めないでください。${strictNote}

todosには、会議の中で「誰が」「何を」「いつまでに」やるかが述べられたタスクをすべて含めてください。
contentには必ず具体的な作業内容を書いてください（nullや空文字にしないでください）。担当者・期限が不明な場合のみ、assigneeを空文字、due_dateをnullにしてください。

decisionsには、会議で合意・確定した事項（日程・方針・仕様など）を含めてください。「了解しました」「承知しました」のような相槌だけの発言は含めないでください。明確に「決定」「確定」と言っていなくても、会議で合意された事項があれば含めてください。

due_dateを計算する際は、下の「日付の参考」の表にある日付をそのまま使ってください。自分で曜日や日数を計算しないでください。表にない表現の場合のみ、今日の日付を基準に自分で計算してください。

出力形式の例:
{
  "summary": "会議の要点を3〜5文で簡潔にまとめた文章",
  "decisions": ["リリース日を8月10日に決定"],
  "todos": [
    {"content": "マニュアルの更新", "assignee": "佐藤", "due_date": "2026-08-05"}
  ]
}

--- 日付の参考 ---
${dateTable}

参加者: ${participants.join("、")}

--- 文字起こし ---
${rawText}`;
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function callOllama(rawText, participants, strict) {
  const prompt = buildPrompt(rawText, participants, strict);
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }
  const data = await response.json();
  return extractJson(data.response);
}

async function analyzeWithRetry(rawText, participants) {
  try {
    return await callOllama(rawText, participants, false);
  } catch (firstError) {
    try {
      return await callOllama(rawText, participants, true);
    } catch (secondError) {
      return null;
    }
  }
}

module.exports = { analyzeWithRetry };
