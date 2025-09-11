const GEMINI_KEY_STORAGE = 'ai-toolbox:gemini_api_key'
const OPENAI_KEY_STORAGE = 'ai-toolbox:openai_api_key'

const getKey = (storage) => {
  try {
    return localStorage.getItem(storage) || ''
  } catch {
    return ''
  }
}

const setKey = (storage, key) => {
  try {
    if (key) localStorage.setItem(storage, key)
    else localStorage.removeItem(storage)
    window.dispatchEvent(new Event('ai-toolbox:config-updated'))
  } catch {
    // ignore storage errors
  }
}

export const getGeminiApiKey = () => getKey(GEMINI_KEY_STORAGE)
export const setGeminiApiKey = (key) => setKey(GEMINI_KEY_STORAGE, key)
export const clearGeminiApiKey = () => setGeminiApiKey('')

export const getOpenAIApiKey = () => getKey(OPENAI_KEY_STORAGE)
export const setOpenAIApiKey = (key) => setKey(OPENAI_KEY_STORAGE, key)
export const clearOpenAIApiKey = () => setOpenAIApiKey('')

export const getApiKey = getGeminiApiKey
export const setApiKey = setGeminiApiKey
export const clearApiKey = clearGeminiApiKey

