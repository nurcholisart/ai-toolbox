import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { getApiKey } from '../lib/config.js'
import Disclosure from './Disclosure.jsx'

export default function AssessmentRoast() {
  const [inputType, setInputType] = useState('markdown') // 'markdown' | 'file'
  const [assessmentContent, setAssessmentContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('') // neutral-only text
  const [language, setLanguage] = useState('English')
  const [roastIntensity, setRoastIntensity] = useState('Medium')
  const [roastResult, setRoastResult] = useState('')
  const [apiKey, setApiKey] = useState('')

  const dropRef = useRef(null)

  useEffect(() => {
    marked.setOptions({ gfm: true, breaks: true })
  }, [])

  useEffect(() => {
    const load = () => setApiKey(getApiKey())
    load()
    const onCfg = () => load()
    window.addEventListener('ai-toolbox:config-updated', onCfg)
    window.addEventListener('storage', onCfg)
    return () => {
      window.removeEventListener('ai-toolbox:config-updated', onCfg)
      window.removeEventListener('storage', onCfg)
    }
  }, [])

  useEffect(() => {
    const el = dropRef.current
    if (!el) return

    const onDragOver = (e) => {
      e.preventDefault()
      el.classList.add('bg-gray-100')
    }
    const onDragLeave = () => {
      el.classList.remove('bg-gray-100')
    }
    const onDrop = (e) => {
      e.preventDefault()
      el.classList.remove('bg-gray-100')
      const files = e.dataTransfer.files
      if (!files || !files.length) return
      const file = files[0]
      handleFile(file)
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [])

  const handleFile = (file) => {
    if (!file) return
    const ok = /\.(md|txt|csv)$/i.test(file.name)
    if (!ok) {
      setStatus('Please select a .md, .txt, or .csv file.')
      setFileName('')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setAssessmentContent(String(e.target?.result || ''))
      setFileName(file.name)
      setStatus('')
    }
    reader.onerror = () => {
      setStatus('Could not read the file.')
      setFileName('')
    }
    reader.readAsText(file)
  }

  const handleFileChange = (e) => handleFile(e.target.files?.[0])

  const previewHtml = useMemo(
    () => (roastResult ? marked.parse(roastResult) : ''),
    [roastResult],
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!assessmentContent.trim()) {
      setStatus('Please provide content to roast.')
      return
    }
    if (!apiKey) {
      setStatus('API key not set. Open Settings to add your Gemini key.')
      return
    }

    setIsLoading(true)
    setStatus('Summoning RoastMaster…')
    setRoastResult('')

    const isIndonesian = language === 'Indonesia'
    let personaDescription = ''
    switch (roastIntensity) {
      case 'Soft':
        personaDescription = isIndonesian
          ? 'Nada Anda konstruktif dan memberi semangat, menunjukkan area perbaikan dengan lembut. Anda adalah seorang senior engineer yang sedang membimbing junior.'
          : 'Your tone is constructive and encouraging, pointing out areas for improvement gently. You are a helpful senior engineer mentoring a junior.'
        break
      case 'Harsh':
        personaDescription = isIndonesian
          ? "Nada Anda brutal, tanpa ampun, dan penuh sarkasme. Anda tidak menahan diri. Tujuannya adalah untuk menghancurkan semua ilusi dan memaksa evaluasi ulang total atas rencana tersebut. Anda adalah perwujudan dari engineer 'ini tidak akan pernah berhasil', tetapi poin Anda valid."
          : "Your tone is brutally honest, merciless, and dripping with sarcasm. You don't hold back. The goal is to shatter any illusions and force a complete re-evaluation of the plan. You are the embodiment of the 'this will never work' engineer, but your points are valid."
        break
      default:
        personaDescription = isIndonesian
          ? 'Nada Anda sinis namun pada akhirnya konstruktif; tujuannya adalah membuat proyek lebih baik dengan menguji rencana tersebut. Anda skeptis, sarkastik, dan tujuan utama Anda adalah mengungkap setiap kelemahan...'
          : 'Your tone is cynical but ultimately constructive; the goal is to make the project better by stress-testing the plan. You are skeptical, sarcastic, and your primary goal is to expose every weakness...'
        break
    }

    const detailedCritiquePoints = isIndonesian
      ? `\n# POIN KRITIK DETAIL\nSelain hal-hal umum, cari kelemahan spesifik berikut:\n- **Tidak Ada Bukti Kolaborasi**: Apakah ada link rekaman meeting? Jika tidak, ini red flag besar yang menunjukkan diskusi mungkin tidak terjadi.\n- **Minim Visualisasi**: Apakah ada diagram (Sequence, ERD, Flowchart)? Ketiadaan diagram menunjukkan pemikiran yang belum matang.\n- **Diagram Amatir**: Jika ada diagram, apakah menggunakan notasi standar (UML, C4, dll.)? Apakah diagramnya malah membingungkan dan tidak jelas?\n- **Keamanan Diabaikan**: Apakah ada pembahasan tentang keamanan yang spesifik untuk industri klien (misalnya, HIPAA untuk kesehatan, PCI-DSS untuk keuangan)?\n- **Tercium Bau AI Generik**: Analisis teksnya. Apakah terasa seperti output mentah dari AI (kalimat generik, terlalu formal, tanpa wawasan mendalam)? Tunjukkan seberapa besar kemungkinannya ini hasil copy-paste.\n- **Penuh Asumsi**: Perhatikan penggunaan kata-kata yang tidak pasti seperti "sepertinya", "seharusnya", "mungkin", "kemungkinan". Terlalu banyak asumsi adalah tanda perencanaan yang buruk.\n- **Tidak Konsisten**: Apakah ada kontradiksi dalam dokumen? Apakah alur pemikirannya logis dan koheren dari awal sampai akhir?\n- **"Jadi, Bikin Apa Sebenarnya?"**: Setelah membaca semuanya, apakah Anda benar-benar paham apa yang akan dibuat? Jika visi produknya kabur, itu masalah besar.\n`
      : `\n# DETAILED CRITIQUE POINTS\nIn addition to the general structure, specifically hunt for these weaknesses:\n- **No Proof of Collaboration**: Is there a meeting recording link? Its absence is a huge red flag that a proper discussion may not have happened.\n- **Lack of Visualization**: Are there any diagrams (Sequence, ERD, Flowchart)? A complete lack of diagrams suggests immature or abstract thinking.\n- **Amateur Diagrams**: If diagrams exist, do they use standard notation (UML, C4, etc.)? Are they confusing or poorly drawn?\n- **Security as an Afterthought**: Is there any mention of security considerations specific to the client's industry (e.g., HIPAA for healthcare, PCI-DSS for finance)?\n- **Smells Like Generic AI**: Analyze the text. Does it feel like a raw, unedited AI output (generic phrasing, overly formal, lacks deep insight)? Assess the likelihood of it being a lazy copy-paste job.\n- **Riddled with Assumptions**: Watch out for weasel words like "it seems," "it should be," "probably," "likely." Over-reliance on assumptions is a sign of poor planning.\n- **Inconsistent & Incoherent**: Are there contradictions in the document? Is the narrative logical and coherent from start to finish?\n- **"So, What Are We Actually Building?"**: After reading the whole thing, do you have a crystal-clear picture of the end product? If the core vision is fuzzy, that's a major problem.\n`

    const outputStructure = isIndonesian
      ? `\n# Roast dari: [Ekstrak atau Simpulkan Nama Proyek]\n\n## Kesan Umum\n(Berikan ringkasan tingkat tinggi yang jenaka 1-2 paragraf. Mulailah dengan kalimat pembuka yang sarkastik. Apa firasat Anda? Apakah ini rencana yang dipikirkan dengan matang atau resep untuk proyek tanpa akhir?)\n\n## 🚩 Red Flags & Asumsi Meragukan\n(Buat daftar berpoin. Untuk setiap poin, kutip atau rujuk bagian spesifik dari asesmen dan dekonstruksi secara brutal. Tunjukkan celah logika, persyaratan yang tidak jelas, penggunaan buzzword, dan klaim yang terlalu optimis.)\n- **Tentang [Topik/Kutipan]**: [Kritik tajam Anda]\n- **Mengenai [Topik/Kutipan]**: [Kritik tajam Anda]\n\n## 🤔 Pertanyaan yang Lupa Anda Tanyakan\n(Buat daftar berpoin berisi pertanyaan-pertanyaan kritis dan tajam yang gagal dijawab oleh asesmen. Fokus pada persyaratan non-fungsional, dependensi, migrasi data, keamanan, observability, kemampuan tim, dan dampak bisnis yang sebenarnya.)\n- **Skalabilitas & Performa**: [Pertanyaan tentang beban yang diharapkan, volume data, waktu respons]\n- **Keamanan**: [Pertanyaan tentang otentikasi, otorisasi, privasi data, kepatuhan]\n- **Operasional & Observability**: [Pertanyaan tentang logging, monitoring, alerting, strategi deployment, rollback]\n- **Dependensi**: [Pertanyaan tentang ketergantungan pada tim lain, API pihak ketiga, atau sistem lama]\n- **Data**: [Pertanyaan tentang pemodelan data, migrasi, integritas, dan kepemilikan]\n- **User Experience (UX)**: [Pertanyaan tentang alur kerja pengguna yang sebenarnya, validasi, atau metrik keberhasilan]\n\n## 😈 Hantu Scope Creep yang Mengintai di Kegelapan\n(Identifikasi persyaratan atau pernyataan yang tidak jelas yang hampir dijamin akan menyebabkan pembengkakan ruang lingkup. Bingkai mereka sebagai "hantu" yang menunggu untuk menimbulkan masalah.)\n- **Integrasi "Sederhana"**: [Kutip tugas yang tampaknya sederhana dan jelaskan bagaimana kompleksitasnya akan membengkak.]\n- **Kerangka Kerja yang "Fleksibel"**: [Tunjukkan persyaratan untuk fleksibilitas dan gambarkan jurang pengembangan tanpa akhir yang bisa ditimbulkannya.]\n- **"Sedikit" Perubahan UI**: [Jelaskan bagaimana permintaan perubahan kecil mengisyaratkan epik yang jauh lebih besar dan tidak disebutkan.]\n\n## 🔥 Skor "Semoga Berhasil"\n(Berikan skor yang jujur dan brutal dari 10, menilai kualitas dan kelengkapan asesmen. Ikuti dengan penutup akhir yang sarkastik dan mudah diingat.)\n**Skor**: [X]/10. [Komentar jenaka/sarkastik terakhir Anda.]\n`
      : `\n# Roast of: [Extract or Infer Project Name]\n\n## Overall Impression\n(Provide a 1-2 paragraph, witty, high-level summary. Start with a sarcastic opening line. What's your gut feeling? Is this a well-thought-out plan or a recipe for a death march?)\n\n## 🚩 Red Flags & Questionable Assumptions\n(Create a bulleted list. For each point, quote or reference a specific part of the assessment and then brutally deconstruct it. Point out logical gaps, vague requirements, buzzword bingo, and overly optimistic claims.)\n- **On [Topic/Quote]**: [Your sharp critique]\n- **Regarding [Topic/Quote]**: [Your sharp critique]\n\n## 🤔 The Questions You Forgot to Ask\n(Create a bulleted list of critical, piercing questions that the assessment fails to address. Focus on non-functional requirements, dependencies, data migration, security, observability, team capabilities, and the actual business impact.)\n- **Scalability & Performance**: [Question about expected load, data volume, response times]\n- **Security**: [Question about authentication, authorization, data privacy, compliance]\n- **Operations & Observability**: [Question about logging, monitoring, alerting, deployment, rollback strategy]\n- **Dependencies**: [Question about reliance on other teams, third-party APIs, or legacy systems]\n- **Data**: [Question about data modeling, migration, integrity, and ownership]\n- **User Experience (UX)**: [Question about actual user workflows, validation, or success metrics]\n\n## 😈 Scope Creep Demons Lurking in the Shadows\n(Identify vague requirements or statements that are almost guaranteed to lead to scope expansion. Frame them as "demons" waiting to cause trouble.)\n- **The "Simple" Integration**: [Quote a seemingly simple task and explain how it will balloon in complexity.]\n- **The "Flexible" Framework**: [Point out a requirement for flexibility and describe the endless pit of development it could become.]\n- **The "Minor" UI Tweak**: [Explain how a small change request hints at a much larger, unstated epic.]\n\n## 🔥 "Good Luck With That" Score\n(Provide a brutally honest score out of 10, rating the quality and completeness of the assessment. Follow it with a final, sarcastic, and memorable sign-off.)\n**Score**: [X]/10. [Your final witty/sarcastic comment.]\n`

    const prompt = `\n# ROLE & PERSONA\nYou are 'RoastMaster,' a jaded but brilliant Principal Engineer with 20 years of battle-hardened experience shipping complex software. ${personaDescription}\n\n# TASK\nAnalyze the provided project assessment (which could be unstructured text, Markdown, or CSV data). Generate a critical review—a "roast"—of the assessment. Your output MUST be in GitHub-Flavored Markdown (GFM).\n\n${detailedCritiquePoints}\n\n# LANGUAGE\nYour entire response MUST be in ${language}. Do not mix languages.\n\n# INPUT (User-provided assessment text)\n\`\`\`\n${assessmentContent}\n\`\`\`\n\n# REQUIRED OUTPUT STRUCTURE (Strictly follow this format in ${language})\n${outputStructure}\n`

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`
      const payload = { contents: [{ parts: [{ text: prompt }] }] }

      let retries = 3
      let delay = 1000
      for (let i = 0; i < retries; i++) {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (resp.ok) {
          const result = await resp.json()
          const candidate = result.candidates?.[0]
          const textOut = candidate?.content?.parts?.[0]?.text
          if (!textOut) throw new Error('Invalid response from API.')
          setRoastResult(textOut)
          setStatus('Roast complete.')
          return
        }
        if (resp.status === 429 || resp.status >= 500) {
          await new Promise((r) => setTimeout(r, delay))
          delay *= 2
          continue
        }
        let msg = `HTTP error ${resp.status}`
        try {
          const err = await resp.json()
          msg = err.error?.message || msg
        } catch {}
        throw new Error(msg)
      }
      throw new Error('API request failed after multiple retries.')
    } catch (e) {
      console.error(e)
      setStatus(e.message || 'An error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!roastResult) return
    try {
      await navigator.clipboard.writeText(roastResult)
      setStatus('Copied to clipboard.')
      setTimeout(() => setStatus(''), 1500)
    } catch {
      setStatus('Failed to copy to clipboard.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg border-2 border-black shadow-md p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Assessment Roast</h1>
            <p className="text-gray-600 mt-2">Paste or upload your assessment. Let the RoastMaster stress-test it.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-800 mb-1">Roast Language</label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none"
                >
                  <option value="English">English</option>
                  <option value="Indonesia">Bahasa Indonesia</option>
                </select>
              </div>
              <div>
                <label htmlFor="intensity" className="block text-sm font-medium text-gray-800 mb-1">Roast Intensity</label>
                <select
                  id="intensity"
                  value={roastIntensity}
                  onChange={(e) => setRoastIntensity(e.target.value)}
                  className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none"
                >
                  <option value="Soft">Soft</option>
                  <option value="Medium">Medium</option>
                  <option value="Harsh">Harsh</option>
                </select>
              </div>
            </div>

            <div className="flex border-b border-black/20 text-sm">
              <button
                type="button"
                onClick={() => setInputType('markdown')}
                className={
                  inputType === 'markdown'
                    ? 'text-black py-2 px-3 border-b-2 border-black'
                    : 'text-gray-600 hover:text-gray-800 py-2 px-3 border-b-2 border-transparent'
                }
              >
                Paste Content
              </button>
              <button
                type="button"
                onClick={() => setInputType('file')}
                className={
                  inputType === 'file'
                    ? 'text-black py-2 px-3 border-b-2 border-black'
                    : 'text-gray-600 hover:text-gray-800 py-2 px-3 border-b-2 border-transparent'
                }
              >
                Upload File
              </button>
            </div>

            {inputType === 'markdown' ? (
              <textarea
                rows={14}
                value={assessmentContent}
                onChange={(e) => setAssessmentContent(e.target.value)}
                placeholder="Paste your project assessment here..."
                className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none text-gray-900 placeholder-gray-500"
              />
            ) : (
              <label
                ref={dropRef}
                htmlFor="roast-file"
                className="flex flex-col items-center justify-center w-full h-56 bg-white border-2 border-dashed border-black rounded-lg cursor-pointer hover:bg-gray-100 transition"
              >
                <svg className="w-8 h-8 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0017.25 4.5H9.75a2.25 2.25 0 00-2.25 2.25v12.75z" />
                </svg>
                <p className="mt-3 text-sm text-gray-700"><span className="font-medium">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-500">.md, .txt, or .csv files</p>
                {fileName && <p className="mt-2 text-sm font-medium text-gray-800">{fileName}</p>}
                <input id="roast-file" type="file" accept=".md,.txt,.csv" className="hidden" onChange={handleFileChange} />
              </label>
            )}

            {status && (
              <div className="text-sm text-gray-800">{status}</div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
              >
                {isLoading ? 'Roasting…' : 'Roast My Assessment'}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!roastResult}
                className="bg-white border-2 border-black text-black px-4 py-2 rounded-lg hover:bg-gray-100 focus:outline-none disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="flex items-center justify-between border-b border-black/20 pb-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">The Roast</h2>
            </div>
            <div className="h-[36rem] overflow-y-auto bg-white border-2 border-black rounded-lg p-4">
              {isLoading ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-gray-700">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <p className="mt-3">The RoastMaster is sharpening his knives…</p>
                </div>
              ) : roastResult ? (
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-gray-500">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 12c2-2.96 0-7-1-8-1 4-3 6-5 8-2 2 0 5 2 7 2 2 5 0 7-2" />
                    <path d="M18 18c1.333-3.333 0-6.333-1-8-1 2.667-2.333 4.333-4 6" />
                  </svg>
                  <p className="mt-2">Awaiting your sacrifice.</p>
                </div>
              )}
            </div>
          </div>
          <Disclosure />
        </div>
      </div>
    </div>
  )
}
