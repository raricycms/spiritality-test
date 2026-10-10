import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createDsesRecord, validateAnswers } from '../src/lib/dses.js'
import { HttpError } from './service.js'

/** Serialized private account store. Identity and experiment records come only from the server. */
export function createAccountStore({ file = '.data/accounts.json', memory = false, clock = Date.now } = {}) {
  let state = { version: 1, users: {} }
  let queue = Promise.resolve()
  const ready = memory ? Promise.resolve() : fs.readFile(path.resolve(file), 'utf8').then(raw => {
    const data = JSON.parse(raw)
    if (data.version !== 1 || !data.users || Array.isArray(data.users)) throw new Error('Invalid account storage')
    state = data
  }).catch(error => { if (error.code !== 'ENOENT') throw error })
  const copy = value => JSON.parse(JSON.stringify(value))
  function mutate(fn) {
    const operation = queue.then(async () => {
      await ready
      const next = copy(state)
      const result = fn(next)
      if (!memory) {
        const target = path.resolve(file)
        await fs.mkdir(path.dirname(target), { recursive: true })
        const tmp = `${target}.${randomUUID()}.tmp`
        try {
          const fd = await fs.open(tmp, 'wx', 0o600)
          try { await fd.writeFile(JSON.stringify(next)); await fd.sync() } finally { await fd.close() }
          await fs.rename(tmp, target)
        } finally { await fs.unlink(tmp).catch(() => {}) }
      }
      state = next
      return copy(result ?? null)
    })
    queue = operation.catch(() => {})
    return operation
  }
  function userIn(data, account) {
    // Stable OAuth sub, not the mutable username, owns records.
    if (!Object.hasOwn(data.users, account.sub)) {
      Object.defineProperty(data.users, account.sub, { value: { experiments: [], dses: [] }, enumerable: true, writable: true })
    }
    return data.users[account.sub]
  }
  return {
    async init() { await ready },
    async history(account) {
      await ready; await queue
      const user = Object.hasOwn(state.users, account.sub) ? state.users[account.sub] : { experiments: [], dses: [] }
      return copy(user)
    },
    archive(entries) {
      if (!entries.length) return Promise.resolve()
      return mutate(data => {
        for (const { account, snapshot } of entries) {
          const records = userIn(data, account).experiments
          if (!records.some(record => record.id === snapshot.id)) records.push(snapshot)
        }
      })
    },
    saveDses(account, answers) {
      try { validateAnswers(answers) } catch { throw new HttpError(400, 'invalid DSES answers') }
      const record = createDsesRecord(answers, { id: randomUUID(), createdAt: clock() })
      if (!record) throw new HttpError(400, 'at least one DSES answer is required')
      return mutate(data => { userIn(data, account).dses.push(record); return record })
    },
    deleteDses(account, id) {
      return mutate(data => { const user = userIn(data, account); user.dses = id ? user.dses.filter(r => r.id !== id) : []; return {} })
    },
    clearExperiments(account) {
      return mutate(data => { userIn(data, account).experiments = []; return {} })
    },
  }
}
