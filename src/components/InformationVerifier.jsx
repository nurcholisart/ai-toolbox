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
  const s = String(v || '').toLowerCase()
  // Order matters: check more specific phrases first
  const tests = [
    { out: 'Partly True', any: ['sebagian benar', 'partly true', 'partially true', 'partial', 'parsial', 'mixed'] },
    { out: 'Misleading', any: ['mislead', 'misleading', 'menyesat', 'konteks', 'out of context', 'cherry-pick'] },
    { out: 'False', any: ['keliru', 'false', 'palsu', 'salah', 'hoax', 'fabricated', 'not true', 'incorrect'] },
    { out: 'Fallacious', any: ['sesat', 'fallacy', 'fallacious', 'unsound', 'incorrect inference', 'salah kaprah'] },
    { out: 'True', any: ['benar', 'true', 'valid', 'akurasi', 'akurat', 'correct', 'accurate'] },
  ]
  for (const t of tests) if (t.any.some((k) => s.includes(k))) return t.out
  return 'Misleading'
}

export default function InformationVerifier() {
  const [apiKey, setApiKey] = useState("");
  const [claim, setClaim] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  // Always use Google Search Grounding
  const [reasonLang, setReasonLang] = useState("id"); // 'en' | 'id'

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

  // Parse shared payload from the URL query (?result=...); react to history changes
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
        const qs = new URLSearchParams(window.location.search || '')
        const encoded = qs.get('result')
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
    window.addEventListener('popstate', parseShared)
    return () => window.removeEventListener('popstate', parseShared)
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
        return `${window.location.origin}/information-verifier?result=${encoded}`
      } catch {
        return `${window.location.origin}/information-verifier`
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
    setMeta('og:site_name', 'Toolbox')
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
    const nowIso = new Date().toISOString()

    const systemInstruction = [
      'You are an objective, rigorous fact-checker.',
      'Task: verify the claim using reliable sources.',
      'Classify exactly one of: True, Partly True, False, Misleading, Fallacious.',
      'Definitions:',
      '- True: Substantively accurate and supported by credible sources; core context is not misleading.',
      '- Partly True: Contains factual elements but is incomplete/partial; key details or context are missing or wrong.',
      '- False: Materially incorrect or contradicted by evidence on the main point.',
      '- Misleading: Presentation steers readers to a wrong conclusion (twisted context, old clip with new narrative, cherry-picked evidence, etc.).',
      '- Fallacious: Uses accurate fragments but draws an invalid conclusion (faulty link between facts).',
      `Current date/time: ${nowIso}. Prefer the most recent, authoritative sources (official sites, primary documents). If the claim is time-sensitive (appointments/dismissals, regulations, events), explicitly verify recency.`,
      'Provide a concise reason and include a citations list (title + URL). Indicate temporality in the reason (e.g., "As of <date>, …").',
      'Respond ONLY as strict JSON matching exactly this schema: { verdict: "True|Partly True|False|Misleading|Fallacious", reason: string, citations: Array<{ title: string, url: string }>, checkedAt: string (ISO 8601) }. No extra commentary.',
      'Use web search when available to ensure accuracy and cite primary sources.',
      `Write the value of the "reason" field in ${languageName}. The "verdict" must remain one of: True, Partly True, False, Misleading, Fallacious (English).`,
    ].join('\n')

    const userPrompt = [
      '# CLAIM',
      claim.trim(),
      '',
      '# OUTPUT',
      'Return ONLY valid JSON per the schema with fields: verdict, reason, citations, checkedAt. No prose outside JSON.',
    ].join('\n')

    const payloadBase = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
    }

    // Always use Google Search Grounding tool
    const payloadWithTools = { ...payloadBase, tools: [{ googleSearch: {} }] }

    const tryRequest = async (payload) => {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return resp;
    };

    try {
      // 1) Grounded retrieval + initial reasoning
      let resp = await tryRequest(payloadWithTools);

      // Simple retry for rate-limit/server errors; keep tools enabled
      if (!resp.ok) {
        const retriable = resp.status === 429 || resp.status >= 500
        if (retriable) {
          await new Promise((r) => setTimeout(r, 1000))
          resp = await tryRequest(payloadWithTools)
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

      const data1 = await resp.json();
      const findingsText = data1?.candidates?.[0]?.content?.parts?.[0]?.text || ''

      // 2) Structured formatting without tools (enforce schema)
      setStatus('Refining structured output…')

      const systemInstruction2 = [
        'You are a precise formatter.',
        'Given a claim and grounded findings, produce a final fact-check result in strict JSON only.',
        'Schema: { verdict: "True|Partly True|False|Misleading|Fallacious", reason: string, citations: Array<{ title: string, url: string }>, checkedAt: string (ISO 8601) }.',
        'Rules:',
        '- verdict must be ONE of the enum values above (English).',
        `- reason is written in ${languageName}, concise, and indicates temporality (e.g., "As of <date>, …").`,
        '- citations contain credible, directly relevant sources; include title and full URL.',
        `- checkedAt is the current date/time close to now (${new Date().toISOString()}) in ISO 8601.`,
        'Return ONLY the JSON object. No commentary.',
      ].join('\n')

      const userPrompt2 = [
        '# CLAIM',
        claim.trim(),
        '',
        '# GROUNDED FINDINGS',
        findingsText || '(no findings text provided)'
      ].join('\n')

      const payloadRefine = {
        contents: [{ parts: [{ text: userPrompt2 }] }],
        systemInstruction: { parts: [{ text: systemInstruction2 }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              verdict: { type: 'STRING', enum: ['True','Partly True','False','Misleading','Fallacious'] },
              reason: { type: 'STRING' },
              citations: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    url: { type: 'STRING' },
                  },
                  required: ['url'],
                  propertyOrdering: ['title','url']
                }
              },
              checkedAt: { type: 'STRING' }
            },
            required: ['verdict','reason','citations','checkedAt'],
            propertyOrdering: ['verdict','reason','citations','checkedAt']
          }
        }
      }

      const resp2 = await tryRequest(payloadRefine)
      if (!resp2.ok) {
        let msg = `HTTP error ${resp2.status}`
        try {
          const err = await resp2.json()
          msg = err.error?.message || msg
        } catch {}
        throw new Error(msg)
      }
      const data2 = await resp2.json()
      const text2 = data2?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed2 = extractJson(text2)
      if (!parsed2) throw new Error('Failed to parse structured output.')

      const verdict = normalizeVerdict(parsed2.verdict)
      const reason = String(parsed2.reason || '').trim()
      const citations = Array.isArray(parsed2.citations)
        ? parsed2.citations
            .map((c) => ({
              title: (c && c.title ? String(c.title) : '').trim() || 'Source',
              url: (c && c.url ? String(c.url) : '').trim(),
            }))
            .filter((c) => c.url)
        : []

      setResult({ verdict, reason, citations })
      setStatus('Done')
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
    return `${window.location.origin}/information-verifier?result=${b64}`
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
              <div className="flex items-center gap-2 text-sm text-gray-700">
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
              {/* Grounding is always enabled; toggle removed */}
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
