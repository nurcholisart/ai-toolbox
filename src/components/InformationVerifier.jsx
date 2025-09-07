import React, { useEffect, useMemo, useState } from 'react'
import { IconShare } from '@tabler/icons-react'
import { getApiKey } from '../lib/config.js'
import Disclosure from './Disclosure.jsx'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from '../lib/lz.js'

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

  // Parse shared payload from hash or search; also react to hash changes
  useEffect(() => {
    const b64UrlDecode = (input) => {
      const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new TextDecoder().decode(bytes)
    }

    const parseEncodedPayload = (encoded) => {
      // Prefer base64url JSON; fallback to LZ-URI if needed (back-compat)
      // Try base64url first
      try {
        const json = b64UrlDecode(encoded)
        return JSON.parse(json)
      } catch {}
      // Try LZ after
      try {
        const lz = decompressFromEncodedURIComponent(encoded)
        if (lz) return JSON.parse(lz)
      } catch {}
      return null
    }

    const parseShared = () => {
      try {
        // Prefer hash: #/information-verifier?result=...
        let encoded = null
        const h = window.location.hash || ''
        const qIndex = h.indexOf('?')
        if (qIndex !== -1) {
          const query = new URLSearchParams(h.slice(qIndex + 1))
          encoded = query.get('result')
        }

        // Fallback: look in search (?result=...) in case some redirectors broke the '#'
        if (!encoded) {
          const qs = new URLSearchParams(window.location.search || '')
          const fromSearch = qs.get('result')
          if (fromSearch) {
            // Normalize URL so our router state is consistent
            const newHash = `#/information-verifier?result=${fromSearch}`
            if (window.location.hash !== newHash) {
              // Use replace to avoid pushing history entries; drop search params
              window.location.replace(
                `${window.location.origin}${window.location.pathname}${newHash}`,
              )
            }
            encoded = fromSearch
          }
        }

        if (!encoded) return

        const parsed = parseEncodedPayload(encoded)
        if (!parsed) return
        const verdict = normalizeVerdict(parsed.verdict)
        const reason = String(parsed.reason || '').trim()
        const citations = Array.isArray(parsed.citations)
          ? parsed.citations
              .map((c) => ({
                title: (c && c.title ? String(c.title) : '').trim() || 'Source',
                url: (c && c.url ? String(c.url) : '').trim(),
              }))
              .filter((c) => c.url)
          : []
        setResult({ verdict, reason, citations })
        if (parsed.claim) setClaim(String(parsed.claim))
        setStatus('Loaded shared result')
      } catch (e) {
        // ignore bad payloads
      }
    }

    parseShared()
    window.addEventListener('hashchange', parseShared)
    return () => window.removeEventListener('hashchange', parseShared)
  }, [])

  // Update OG meta tags when result is present
  useEffect(() => {
    if (!result) return
    const b64UrlEncode = (str) => {
      const bytes = new TextEncoder().encode(str)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    const shortClaim = claim?.trim() ? claim.trim().slice(0, 160) : ''
    const summary = shortClaim
      ? `[${result.verdict}] Claim: ${shortClaim}`
      : `[${result.verdict}] ${String(result.reason || '').slice(0, 160)}`
    const shareUrl = (() => {
      try {
        const payload = { ...result, claim }
        const encoded = b64UrlEncode(JSON.stringify(payload))
        return `${window.location.origin}${window.location.pathname}#/information-verifier?result=${encoded}`
      } catch {
        return `${window.location.origin}${window.location.pathname}#/information-verifier`
      }
    })()

    const setMeta = (property, content) => {
      if (!content) return
      let tag = document.head.querySelector(`meta[property="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('property', property)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }

    document.title = `Information Verifier — ${result.verdict}`
    setMeta('og:type', 'website')
    setMeta('og:site_name', 'AI Toolbox')
    setMeta('og:title', `Information Verifier — ${result.verdict}`)
    setMeta('og:description', summary)
    setMeta('og:url', shareUrl)
  }, [result, claim])

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

  const buildShareUrl = () => {
    const payload = { ...result, claim }
    const bytes = new TextEncoder().encode(JSON.stringify(payload))
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    return `${window.location.origin}${window.location.pathname}#/information-verifier?result=${b64}`
  }

  const shortenUrl = async (longUrl) => {
    try {
      const resp = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
      )
      if (!resp.ok) throw new Error(`Shortener HTTP ${resp.status}`)
      const text = (await resp.text()).trim()
      if (!/^https?:\/\//i.test(text)) throw new Error('Invalid short URL')
      return text
    } catch (e) {
      // Propagate so caller can fallback to the original URL
      throw e
    }
  }

  const handleShare = async () => {
    if (!result) return
    const url = buildShareUrl()
    let finalUrl = url
    const title = `Information Verifier — ${result.verdict}`
    const text = claim?.trim()
      ? `[${result.verdict}] Claim: ${claim.trim()}`
      : `[${result.verdict}] ${String(result.reason || '').slice(0, 160)}`
    try {
      setStatus('Shortening link…')
      try {
        finalUrl = await shortenUrl(url)
        setStatus('Link shortened')
      } catch {
        // Fallback silently to the original URL
        setStatus('Using original link (shortening unavailable)')
      }

      if (navigator.share) {
        await navigator.share({ title, text, url: finalUrl })
        setStatus('Share dialog opened')
        return
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(finalUrl)
      setStatus('Share link copied to clipboard.')
    } catch {
      setStatus('Copy failed. You can manually copy the URL.')
    }
  }

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
              {result && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <IconShare size={18} stroke={2} />
                  Share result
                </button>
              )}
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
