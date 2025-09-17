// URL params helpers with debounce syncing

export const readParams = () => new URLSearchParams(window.location.search || '')

export const writeParams = (params) => {
  const qs = params.toString()
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
  window.history.replaceState({}, '', url)
}

export const debounce = (fn, ms = 300) => {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

