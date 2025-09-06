const API_KEY_STORAGE = 'ai-toolbox:gemini_api_key'

export const getApiKey = () => {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export const setApiKey = (key) => {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key)
    else localStorage.removeItem(API_KEY_STORAGE)
    window.dispatchEvent(new Event('ai-toolbox:config-updated'))
  } catch {
    // ignore storage errors
  }
}

export const clearApiKey = () => setApiKey('')

