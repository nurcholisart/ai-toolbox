import React, { useEffect, useMemo, useState } from "react";
import { getApiKey } from "../lib/config.js";
import Disclosure from "./Disclosure.jsx";

const extractJson = (text) => {
  if (!text) return null;
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}
  // Try fenced code block ```json ... ```
  const codeBlock = text.match(/```json\s*([\s\S]*?)```/i);
  if (codeBlock && codeBlock[1]) {
    try {
      return JSON.parse(codeBlock[1]);
    } catch {}
  }
  // Try to find the first JSON-like object
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slice = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }
  return null;
};

const normalizeVerdict = (v) => {
  const s = String(v || "").toLowerCase();
  if (
    ["valid", "benar", "true", "akurasi", "akurat"].some((k) => s.includes(k))
  )
    return "Valid";
  if (
    ["mislead", "menyesat", "parsial", "konteks", "partially"].some((k) =>
      s.includes(k),
    )
  )
    return "Mislead";
  if (
    ["hoax", "palsu", "false", "salah", "fabricated"].some((k) => s.includes(k))
  )
    return "Hoax";
  return "Mislead";
};

export default function InformationVerifier() {
  const [apiKey, setApiKey] = useState("");
  const [claim, setClaim] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [useGrounding, setUseGrounding] = useState(true);
  const [reasonLang, setReasonLang] = useState("en"); // 'en' | 'id'

  useEffect(() => {
    const load = () => setApiKey(getApiKey());
    load();
    const onCfg = () => load();
    window.addEventListener("ai-toolbox:config-updated", onCfg);
    window.addEventListener("storage", onCfg);
    return () => {
      window.removeEventListener("ai-toolbox:config-updated", onCfg);
      window.removeEventListener("storage", onCfg);
    };
  }, []);

  const handleVerify = async () => {
    if (!claim.trim()) {
      setStatus("Enter a claim to verify.");
      return;
    }
    if (!apiKey) {
      setStatus("API key not set. Open Settings to add your Gemini key.");
      return;
    }

    setIsLoading(true);
    setStatus("Verifying with Gemini…");
    setResult(null);

    const model = "gemini-2.5-flash-preview-05-20";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const languageName = reasonLang === "id" ? "Bahasa Indonesia" : "English";

    const systemInstruction = [
      "You are an objective, rigorous fact-checker.",
      "Task: verify the claim using reliable sources.",
      "Classify exactly one of: Valid, Mislead, Hoax.",
      "Provide a concise reason and include a citations list (title + URL).",
      'Respond ONLY as strict JSON matching this schema exactly: { verdict: "Valid|Mislead|Hoax", reason: string, citations: Array<{ title: string, url: string }> }.',
      "Use web search when available to ensure accuracy and cite primary sources.",
      `Write the value of the "reason" field in ${languageName}. The "verdict" must remain one of: Valid, Mislead, Hoax (English).`,
    ].join("\n");

    const userPrompt = [
      "# CLAIM",
      claim.trim(),
      "",
      "# OUTPUT",
      "Return ONLY valid JSON with no extra text or commentary.",
    ].join("\n");

    const payloadBase = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
    };

    // Try with Google Search Grounding tool first (if enabled)
    const payloadWithTools = useGrounding
      ? { ...payloadBase, tools: [{ googleSearch: {} }] }
      : payloadBase;

    const tryRequest = async (payload) => {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return resp;
    };

    try {
      let resp = await tryRequest(payloadWithTools);

      // Fallback without tools if the request fails due to unsupported field
      if (!resp.ok) {
        const retriable = resp.status === 429 || resp.status >= 500;
        const maybeToolIssue = resp.status === 400 || resp.status === 404;
        if (maybeToolIssue && useGrounding) {
          resp = await tryRequest(payloadBase);
        } else if (retriable) {
          // simple retry once
          await new Promise((r) => setTimeout(r, 1000));
          resp = await tryRequest(
            useGrounding ? payloadWithTools : payloadBase,
          );
        }
      }

      if (!resp.ok) {
        let msg = `HTTP error ${resp.status}`;
        try {
          const err = await resp.json();
          msg = err.error?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = extractJson(text);
      if (!parsed)
        throw new Error("Failed to parse AI output. Please try again.");

      const verdict = normalizeVerdict(parsed.verdict);
      const reason = String(parsed.reason || "").trim();
      const citations = Array.isArray(parsed.citations)
        ? parsed.citations
            .map((c) => ({
              title: (c && c.title ? String(c.title) : "").trim() || "Source",
              url: (c && c.url ? String(c.url) : "").trim(),
            }))
            .filter((c) => c.url)
        : [];

      setResult({ verdict, reason, citations });
      setStatus("Done");
    } catch (e) {
      console.error(e);
      setStatus(e.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const verdictBadge = useMemo(() => {
    if (!result?.verdict) return null;
    const base =
      "inline-block px-3 py-1 border-2 border-black rounded-lg text-sm font-semibold";
    return <span className={base}>{result.verdict}</span>;
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl border-2 border-black shadow-md p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Information Verifier
            </h1>
            <p className="text-gray-600 mt-2">
              Verify a claim’s truthfulness with reasoning and citations.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="claim"
                className="block text-sm font-medium text-gray-800 mb-1"
              >
                Claim
              </label>
              <textarea
                id="claim"
                rows={6}
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                placeholder="Type the claim you want to verify…"
                className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none text-gray-900 placeholder-gray-500"
              />
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  id="grounding"
                  type="checkbox"
                  checked={useGrounding}
                  onChange={(e) => setUseGrounding(e.target.checked)}
                  className="h-4 w-4 border-2 border-black rounded"
                />
                <label htmlFor="grounding">
                  Use Google Search Grounding (if available)
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <label htmlFor="reasonLang" className="whitespace-nowrap">
                  Reasoning language
                </label>
                <select
                  id="reasonLang"
                  value={reasonLang}
                  onChange={(e) => setReasonLang(e.target.value)}
                  className="bg-white border-2 border-black rounded-lg px-2 py-1 focus:outline-none text-gray-900"
                >
                  <option value="en">English</option>
                  <option value="id">Bahasa Indonesia</option>
                </select>
              </div>
            </div>

            {status && <div className="text-sm text-gray-800">{status}</div>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleVerify}
                disabled={isLoading}
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
              >
                {isLoading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setClaim("");
                  setResult(null);
                  setStatus("");
                }}
                className="bg-white border-2 border-black text-black px-4 py-2 rounded-lg hover:bg-gray-100 focus:outline-none"
              >
                Reset
              </button>
            </div>

            {result && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">Result:</span>
                  {verdictBadge}
                </div>
                {result.reason && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      Reasoning
                    </h3>
                    <div className="bg-white border-2 border-black rounded-lg p-3 text-gray-900 whitespace-pre-line">
                      {result.reason}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    Citations
                  </h3>
                  {result.citations?.length ? (
                    <ul className="list-disc pl-6 text-gray-900">
                      {result.citations.map((c, i) => (
                        <li key={i} className="mb-1">
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-black hover:text-gray-700"
                          >
                            {c.title || c.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-600">No citations available.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <Disclosure />
        </div>
      </div>
    </div>
  );
}
