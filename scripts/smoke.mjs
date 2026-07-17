// Standalone smoke test: render <App /> to a string via react-dom/server
// without going through the Vite/ssr transform pipeline.
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'

// Polyfill localStorage for Node.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
}

// Polyfill window (not strictly required for renderToString but jsdom would)
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis
}

const React = await import('react')
const App = (await import('../src/App.jsx')).App

try {
  const html = renderToString(createElement(App))
  console.log('Rendered successfully:')
  console.log('---')
  console.log(html.slice(0, 800))
  console.log('---')
  console.log(`Total length: ${html.length} chars`)
  // Quick assertions
  if (!html.includes('灵性测试')) throw new Error('missing title')
  if (!html.includes('开始一场测试')) throw new Error('missing start button')
  console.log('✓ Smoke test passed')
} catch (e) {
  console.error('✗ Render error:', e)
  process.exit(1)
}
