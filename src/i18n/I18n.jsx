import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import english from './en.json'
import { translateServerError } from './server-errors.js'

export const LANGUAGE_KEY = 'spirituality:ui:language'
const I18nContext = createContext({ language: 'zh', setLanguage: () => {} })
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const patterns = Object.entries(english).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
  const indices = []
  let source = ''
  let start = 0
  for (const match of key.matchAll(/\{(\d+)\}/g)) {
    source += escape(key.slice(start, match.index)) + '(.*?)'
    indices.push(match[1])
    start = match.index + match[0].length
  }
  return { expression: new RegExp(`^${source + escape(key.slice(start))}$`, 's'), value, indices }
})
const fragments = Object.entries(english).filter(([key]) => !/\{\d+\}/.test(key)).sort(([a], [b]) => b.length - a.length)

/** Translate presentation strings only; experiment data and scale wording stay intact. */
export function translateText(text, language = 'zh') {
  if (language === 'zh' && typeof text === 'string') return translateServerError(text)
  if (language !== 'en' || typeof text !== 'string') return text
  const key = text.trim().replace(/\s+/g, ' ')
  if (Object.hasOwn(english, key)) return text.replace(text.trim(), english[key])
  if (!/[\u3400-\u9fff]/.test(text)) return text
  for (const pattern of patterns) {
    const match = pattern.expression.exec(key)
    if (!match) continue
    const params = Object.fromEntries(pattern.indices.map((index, i) => [index, translateText(match[i + 1], language)]))
    return pattern.value.replace(/\{(\d+)\}/g, (_, index) => params[index] ?? '')
  }
  // Handles mixed JSX text (numbers / emphasized terms split across children).
  return fragments.reduce((result, [from, to]) => result.split(from).join(to), text)
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'zh' } catch { return 'zh' }
  })
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN'
    document.title = language === 'en' ? 'Spirituality Lab' : '灵性实验室'
    try { localStorage.setItem(LANGUAGE_KEY, language) } catch { /* preference is still usable in this tab */ }
  }, [language])
  const value = useMemo(() => ({ language, setLanguage }), [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const { language, setLanguage } = useContext(I18nContext)
  const t = useCallback((text) => translateText(text, language), [language])
  // JSX stays readable in its source language; translate text and accessible
  // attributes during React render, never by rewriting DOM nodes after render.
  const localize = useCallback(function visit(node) {
    if (typeof node === 'string') return t(node)
    if (Array.isArray(node)) return node.map(visit)
    if (!isValidElement(node)) return node
    const props = {}
    for (const name of ['title', 'aria-label', 'aria-description', 'placeholder', 'alt']) {
      if (typeof node.props[name] === 'string') props[name] = t(node.props[name])
    }
    if (node.props.children !== undefined) props.children = Children.map(node.props.children, visit)
    return cloneElement(node, props)
  }, [t])
  return { language, setLanguage, t, localize }
}
