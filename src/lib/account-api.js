export async function accountRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Account request failed')
  return data
}
export const getAccountSession = () => accountRequest('/auth/session')
export const getAccountHistory = () => accountRequest('/account/history')
export const logoutAccount = () => accountRequest('/auth/logout', { method: 'POST' })
export const saveAccountDses = answers => accountRequest('/account/dses', { method: 'POST', body: { answers } })
export const deleteAccountDses = id => accountRequest(`/account/dses${id ? '/' + encodeURIComponent(id) : ''}`, { method: 'DELETE' })
export const clearAccountExperiments = () => accountRequest('/account/experiments', { method: 'DELETE' })
export async function downloadAccountReport(language) {
  const res = await fetch(`/api/account/report.pdf?lang=${language}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Report download failed')
  const url = URL.createObjectURL(await res.blob()), a = document.createElement('a')
  a.href = url; a.download = 'spirituality-report.pdf'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
