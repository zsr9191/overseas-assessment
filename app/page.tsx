"use client";

import { FormEvent, useState } from "react";

type AssessErrorResponse = {
  error?: string;
  report?: string;
};

async function readErrorMessage(response: Response) {
  const raw = await response.text();

  try {
    const data = JSON.parse(raw) as AssessErrorResponse;
    return data.error || "生成评估报告失败，请稍后重试。";
  } catch {
    return "生成超时，请稍后重试";
  }
}

export default function Home() {
  const [brief, setBrief] = useState("");
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inputText = brief.trim();
    if (!inputText || loading) return;

    setLoading(true);
    setReport("");

    try {
      const response = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText }),
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok || contentType.includes("text/html")) {
        throw new Error(await readErrorMessage(response));
      }

      if (contentType.includes("application/json")) {
        try {
          const data = (await response.json()) as AssessErrorResponse;
          if (!data.report) {
            throw new Error(data.error || "生成评估报告失败，请稍后重试。");
          }
          setReport(data.report);
          return;
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error("生成超时，请稍后重试");
          }
          throw error;
        }
      }

      if (!response.body) {
        throw new Error("服务器未返回可读取的报告内容。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReport = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fullReport += decoder.decode(value, { stream: true });
        setReport(fullReport);
      }

      fullReport += decoder.decode();
      setReport(fullReport.trim());

      if (!fullReport.trim()) {
        throw new Error("未生成有效的评估报告，请稍后重试。");
      }
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "生成超时，请稍后重试"
          : error instanceof Error
            ? error.message
            : "生成超时，请稍后重试";
      window.alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),_transparent_60%)]"
      />

      <header className="relative mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-6">
        <p className="text-sm font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
          Outbound Insight
        </p>
        <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
          企业出海评估
        </p>
      </header>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-16 pt-8 sm:px-6 sm:pt-16">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-5xl sm:leading-tight dark:text-white">
            用一份报告，看清产品的出海机会
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600 sm:mt-5 sm:text-lg sm:leading-8 dark:text-zinc-400">
            描述你的产品、目标市场与现有能力。我们将从市场匹配、合规风险、渠道策略和竞争格局四个维度，生成一份可执行的出海评估报告。
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:mt-10 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <label
            htmlFor="business-brief"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            产品 / 业务信息
          </label>
          <textarea
            id="business-brief"
            name="brief"
            required
            rows={10}
            value={brief}
            disabled={loading}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="例如：我们是一家面向中小商家的 SaaS 库存系统，计划进入东南亚市场。现有客户以制造业为主，团队 20 人，暂无海外销售渠道……"
            className="mt-3 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base leading-7 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              写得越具体，评估越准确。
            </p>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-600/50 sm:w-auto"
            >
              {loading ? (
                <>
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  生成中...
                </>
              ) : (
                "生成评估报告"
              )}
            </button>
          </div>
        </form>

        {loading || report ? (
          <section
            aria-live="polite"
            className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:mt-10 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
              评估报告
            </h2>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 text-zinc-700 dark:text-zinc-300">
              {report || "正在生成..."}
            </pre>
          </section>
        ) : null}
      </main>
    </div>
  );
}
