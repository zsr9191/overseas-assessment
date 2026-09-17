export const maxDuration = 60;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";

type AssessRequestBody = {
  inputText?: unknown;
};

type DeepSeekStreamPayload = {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

class StreamingTextResponse extends Response {
  constructor(body: ReadableStream<Uint8Array>, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("X-Accel-Buffering", "no");

    super(body, {
      ...init,
      status: init?.status ?? 200,
      headers,
    });
  }
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function getDeepSeekErrorMessage(status: number, payload: DeepSeekStreamPayload) {
  if (payload.error?.message) {
    return payload.error.message;
  }

  if (status === 401) return "DeepSeek API Key 无效，请检查环境变量 DEEPSEEK_API_KEY。";
  if (status === 402) return "DeepSeek 账户余额不足，请充值后再试。";
  if (status === 429) return "DeepSeek 请求过于频繁，请稍后重试。";
  return `DeepSeek 接口调用失败（${status}）。`;
}

function extractDeltaContent(chunk: string) {
  if (!chunk || chunk === "[DONE]") return "";

  try {
    const payload = JSON.parse(chunk) as DeepSeekStreamPayload;
    return payload.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

function toTextStream(upstream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;

            const content = extractDeltaContent(line.slice(5).trim());
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        }

        const leftover = extractDeltaContent(buffer.replace(/^data:\s*/, "").trim());
        if (leftover) {
          controller.enqueue(encoder.encode(leftover));
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

export async function POST(request: Request) {
  try {
    let body: AssessRequestBody;

    try {
      body = (await request.json()) as AssessRequestBody;
    } catch {
      return jsonError("请求体必须是有效的 JSON。", 400);
    }

    if (typeof body.inputText !== "string") {
      return jsonError("请提供字符串类型的 inputText。", 400);
    }

    const inputText = body.inputText.trim();

    if (!inputText) {
      return jsonError("inputText 不能为空。", 400);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      return jsonError("未配置 DEEPSEEK_API_KEY，无法生成评估报告。", 500);
    }

    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        stream: true,
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
    });

    if (!deepseekResponse.ok || !deepseekResponse.body) {
      let payload: DeepSeekStreamPayload = {};
      try {
        payload = (await deepseekResponse.json()) as DeepSeekStreamPayload;
      } catch {
        return jsonError("DeepSeek 返回了无法解析的响应。", 502);
      }

      return jsonError(
        getDeepSeekErrorMessage(deepseekResponse.status, payload),
        502,
      );
    }

    return new StreamingTextResponse(toTextStream(deepseekResponse.body));
  } catch (error) {
    console.error("Failed to generate assessment report:", error);

    return jsonError(
      error instanceof Error ? error.message : "生成评估报告失败，请稍后重试。",
      502,
    );
  }
}
