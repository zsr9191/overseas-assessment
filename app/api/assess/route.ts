import { NextResponse } from "next/server";

export const maxDuration = 60;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";

type AssessRequestBody = {
  inputText?: unknown;
};

type DeepSeekMessage = {
  content?: string | null;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: DeepSeekMessage;
  }>;
  error?: {
    message?: string;
  };
};

function getDeepSeekErrorMessage(status: number, payload: DeepSeekResponse) {
  if (payload.error?.message) {
    return payload.error.message;
  }

  if (status === 401) return "DeepSeek API Key 无效，请检查环境变量 DEEPSEEK_API_KEY。";
  if (status === 402) return "DeepSeek 账户余额不足，请充值后再试。";
  if (status === 429) return "DeepSeek 请求过于频繁，请稍后重试。";
  return `DeepSeek 接口调用失败（${status}）。`;
}

async function generateReport(inputText: string, apiKey: string) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "你是企业出海评估顾问。请根据用户提供的产品/业务信息，生成一份结构清晰、可执行的出海评估报告。必须包含：业务摘要、市场匹配、合规风险、渠道策略、竞争格局、下一步建议。使用简体中文，语气专业克制，不要编造无法从输入推断的具体数据。",
        },
        {
          role: "user",
          content: `请基于以下产品/业务信息生成出海评估报告：\n\n${inputText}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  });

  let payload: DeepSeekResponse = {};
  try {
    payload = (await response.json()) as DeepSeekResponse;
  } catch {
    throw new Error("DeepSeek 返回了无法解析的响应。");
  }

  if (!response.ok) {
    throw new Error(getDeepSeekErrorMessage(response.status, payload));
  }

  const report = payload.choices?.[0]?.message?.content?.trim();
  if (!report) {
    throw new Error("DeepSeek 未返回有效的评估报告内容。");
  }

  return report;
}

export async function POST(request: Request) {
  try {
    let body: AssessRequestBody;

    try {
      body = (await request.json()) as AssessRequestBody;
    } catch {
      return NextResponse.json(
        { error: "请求体必须是有效的 JSON。" },
        { status: 400 },
      );
    }

    if (typeof body.inputText !== "string") {
      return NextResponse.json(
        { error: "请提供字符串类型的 inputText。" },
        { status: 400 },
      );
    }

    const inputText = body.inputText.trim();

    if (!inputText) {
      return NextResponse.json(
        { error: "inputText 不能为空。" },
        { status: 400 },
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "未配置 DEEPSEEK_API_KEY，无法生成评估报告。" },
        { status: 500 },
      );
    }

    const report = await generateReport(inputText, apiKey);

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Failed to generate assessment report:", error);

    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "生成评估报告超时，请稍后重试。"
        : error instanceof Error
          ? error.message
          : "生成评估报告失败，请稍后重试。";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
