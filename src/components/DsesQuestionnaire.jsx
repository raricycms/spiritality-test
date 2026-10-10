import { useI18n } from '../i18n/I18n.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DSES_PDF,
  DSES_ITEM_COUNT,
  DSES_ITEM_THEMES,
  answerOptionsFor,
  computeDsesScore,
  createDsesRecord,
  loadDsesRecords,
  saveDsesRecords,
  clearDsesRecords,
  exportDsesRecords,
  parseDsesRecords,
  mergeDsesRecords,
  loadDsesDraft,
  saveDsesDraft,
  clearDsesDraft,
} from '../lib/dses.js'
import './DsesQuestionnaire.css'

const BLANK = 'blank'

function blankAnswers() {
  return new Array(DSES_ITEM_COUNT).fill(null)
}

function fmtDate(ts) {
  if (!Number.isFinite(ts)) return '—'
  const d = new Date(ts)
  const pad = (n) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtMean(mean) {
  return mean == null ? '—' : mean.toFixed(2)
}

function fmtDelta(delta) {
  if (delta == null) return '—'
  if (Math.abs(delta) < 0.005) return '持平'
  const sign = delta > 0 ? '+' : '−'
  return `较上次 ${sign}${Math.abs(delta).toFixed(2)}`
}

/**
 * DSES answer sheet with provenance panel, optional local draft, and an
 * independent, sanitized record store (`spirituality:v2:dses`).
 *
 * Props:
 *   onBack?() => void   optional back / close action.
 */
export function DsesQuestionnaire({ onBack }) {
  const { localize, t, language } = useI18n()
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState([])
  const [answers, setAnswers] = useState(blankAnswers)
  const [draftEnabled, setDraftEnabled] = useState(true)
  const [message, setMessage] = useState(null)
  const [draftStatus, setDraftStatus] = useState('')
  const importRef = useRef(null)

  // Load finished records + an optional local draft on mount.
  useEffect(() => {
    let restored = false
    try {
      const stored = loadDsesRecords()
      setRecords(stored)
      const draft = loadDsesDraft()
      if (computeDsesScore(draft).answered > 0) {
        setAnswers(draft)
        restored = true
      }
    } catch (e) {
      setMessage({ type: 'error', text: `读取本机数据失败：${e.message}` })
    }
    setLoading(false)
    if (restored) setMessage({ type: 'info', text: '已恢复本机保存的答题草稿。' })
  }, [])

  const score = useMemo(() => computeDsesScore(answers), [answers])
  const savedRecords = useMemo(
    () => records.map((r) => ({ record: r, score: computeDsesScore(r.answers) })),
    [records],
  )

  function setMessageSafe(next) {
    setMessage(next)
  }

  function handleAnswer(index, rawValue) {
    const value = rawValue === BLANK ? null : Number(rawValue)
    const next = answers.slice()
    next[index] = value
    setAnswers(next)
    if (draftEnabled) {
      const ok = saveDsesDraft(next)
      setDraftStatus(ok ? '草稿已暂存本机' : '草稿无法保存（本机存储不可用）')
    }
  }

  function handleDraftToggle(checked) {
    setDraftEnabled(checked)
    if (checked) {
      const ok = saveDsesDraft(answers)
      setDraftStatus(ok ? '草稿已暂存本机' : '草稿无法保存（本机存储不可用）')
    } else {
      clearDsesDraft()
      setDraftStatus('已关闭本地草稿')
    }
  }

  function handleClearDraft() {
    clearDsesDraft()
    setAnswers(blankAnswers())
    setDraftStatus('草稿已清除')
  }

  function handleSave() {
    if (score.answered === 0) {
      setMessageSafe({ type: 'error', text: '至少作答一题后才能保存（空答案不会保存）。' })
      return
    }
    const record = createDsesRecord(answers)
    if (!record) {
      setMessageSafe({ type: 'error', text: '没有有效作答，未保存。' })
      return
    }
    const next = mergeDsesRecords(records, [record])
    const ok = saveDsesRecords(next)
    if (!ok) {
      setMessageSafe({
        type: 'error',
        text: '保存失败：本机存储不可用或被拒绝。答题内容仍保留在页面，可复制后重试。',
      })
      return
    }
    setRecords(next)
    clearDsesDraft()
    setAnswers(blankAnswers())
    setDraftStatus('')
    setMessageSafe({
      type: 'success',
      text: `已保存本次记录（已答 ${score.answered}/16，仅存本机，未上传）。`,
    })
  }

  function handleDelete(id) {
    const next = records.filter((r) => r.id !== id)
    const ok = saveDsesRecords(next)
    if (!ok) {
      setMessageSafe({ type: 'error', text: '删除失败：本机存储不可用。' })
      return
    }
    setRecords(next)
    setMessageSafe({ type: 'success', text: '已删除该条记录。' })
  }

  function handleClearAll() {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm(t('确定清空本机全部 DSES 记录？此操作不影响实验历史或其他数据。'))) return
    }
    const ok = clearDsesRecords()
    if (!ok) {
      setMessageSafe({ type: 'error', text: '清空失败：本机存储不可用。' })
      return
    }
    setRecords([])
    setMessageSafe({ type: 'success', text: '已清空本机 DSES 记录。' })
  }

  function handleExport() {
    try {
      const blob = exportDsesRecords(records)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dses-records-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMessageSafe({ type: 'success', text: `已导出 ${records.length} 条记录（本地文件）。` })
    } catch (e) {
      setMessageSafe({ type: 'error', text: `导出失败：${e.message}` })
    }
  }

  async function handleImportFile(file) {
    try {
      const text = await file.text()
      const incoming = parseDsesRecords(text)
      const next = mergeDsesRecords(records, incoming)
      const ok = saveDsesRecords(next)
      if (!ok) {
        setMessageSafe({ type: 'error', text: '导入失败：本机存储不可用，未写入。' })
        return
      }
      setRecords(next)
      setMessageSafe({
        type: 'success',
        text: `导入成功：文件含 ${incoming.length} 条记录，合并后共 ${next.length} 条（按 id 去重，分值由答案重新计算）。`,
      })
    } catch (e) {
      setMessageSafe({ type: 'error', text: e.message || '导入失败：无法解析文件。' })
    }
  }

  return (
    localize(<section className="dses" aria-label="日常灵性体验问卷（DSES）">
      <header className="dses-header">
        <h2 className="dses-title">日常灵性体验量表（DSES）</h2>
        {onBack ? (
          <button type="button" className="dses-btn" onClick={onBack}>
            返回
          </button>
        ) : null}
      </header>

      <p className="dses-intro">
        本问卷为个人频率自评，独立于三个能力实验计分与存储，不进入命中率或异常能力概率，不推断任何超自然能力。
      </p>

      {/* ---------------- Original PDF & provenance ---------------- */}
      <section className="dses-panel" aria-label="原版问卷入口与来源说明">
        <h3 className="dses-panel-title">原版问卷（英文）</h3>
        <p className="dses-hint">
          题目原文以作者发布的英文原版 PDF 为准，本页不复制原文。
        </p>
        <div className="dses-pdf-actions">
          <a
            className="dses-btn dses-btn-primary"
            href={DSES_PDF.path}
            target="_blank"
            rel="noreferrer noopener"
          >
            打开原版 PDF
          </a>
          <a className="dses-btn" href={DSES_PDF.path} download>
            下载原版 PDF
          </a>
          <a
            className="dses-btn"
            href={DSES_PDF.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            作者官网原始链接（备用）
          </a>
        </div>

        <details className="dses-details">
          <summary>来源、版权与使用说明</summary>
          <ul className="dses-source-list">
            <li>英文原版于 {DSES_PDF.downloadedAt} 从作者官网下载，文件保持原样。</li>
            <li>
              官方来源：
              <a href={DSES_PDF.officialSite} target="_blank" rel="noreferrer noopener">
                dsescale.org
              </a>
              ，计分依据作者{' '}
              <a href={DSES_PDF.scoringUrl} target="_blank" rel="noreferrer noopener">
                2022 年 1 月计分说明
              </a>
              。
            </li>
            <li>
              版权归 <strong>{DSES_PDF.copyrightHolder}</strong> 所有（Daily Spiritual Experience
              Scale）。作者官网要求登记并取得使用许可，非营利用途可免费；本项目未代表用户申请，也未核实是否已获授权。
            </li>
            <li>
              本页中文仅为逐题<strong>主题摘要</strong>，用于辅助定位题目，不是经校验的中文译本，也不能替代原版题目文本。
              本项目未取得可核验的经验证中文问卷文件。
            </li>
          </ul>
        </details>
      </section>

      {/* ---------------- Answer sheet ---------------- */}
      <section className="dses-panel" aria-label="答题卡">
        <div className="dses-progress">
          <span>{`已答 ${score.answered} / ${DSES_ITEM_COUNT}`}</span>
          <span>{`缺失 ${score.missing}`}</span>
          <span className="dses-progress-mean">
            当前均值（仅计已答题目）：<strong>{fmtMean(score.mean)}</strong>
          </span>
        </div>
        <p className="dses-hint">
          均值越高表示该体验报告得越频繁；本量表不设“高／中／低”门槛，也不构造未经验证的分量表。
        </p>

        <ol className="dses-items">
          {Array.from({ length: DSES_ITEM_COUNT }, (_, index) => {
            const options = answerOptionsFor(index)
            const name = `dses-item-${index + 1}`
            return (
              <li key={name} className="dses-item">
                <fieldset className="dses-fieldset">
                  <legend className="dses-legend">
                    <span className="dses-item-no">{t(`第 ${index + 1} 题`)}</span>
                    <span className="dses-item-theme">{DSES_ITEM_THEMES[index]}</span>
                  </legend>
                  <div className="dses-options">
                    {options.map((opt) => {
                      const id = `${name}-${opt.value}`
                      return (
                        <label key={opt.value} className="dses-option" htmlFor={id}>
                          <input
                            id={id}
                            type="radio"
                            name={name}
                            value={opt.value}
                            checked={answers[index] === opt.value}
                            onChange={() => handleAnswer(index, opt.value)}
                          />
                          <span className="dses-option-text">
                            <span className="dses-option-zh">{language === 'zh' ? opt.zh : opt.en}</span>
                          </span>
                        </label>
                      )
                    })}
                    <label className="dses-option dses-option-blank" htmlFor={`${name}-blank`}>
                      <input
                        id={`${name}-blank`}
                        type="radio"
                        name={name}
                        value={BLANK}
                        checked={answers[index] == null}
                        onChange={() => handleAnswer(index, BLANK)}
                      />
                      <span className="dses-option-text">
                        <span className="dses-option-zh">未作答</span>
                        <span className="dses-option-en">留空，不计入均值</span>
                      </span>
                    </label>
                  </div>
                </fieldset>
              </li>
            )
          })}
        </ol>

        <div className="dses-sheet-actions">
          <button
            type="button"
            className="dses-btn dses-btn-primary"
            onClick={handleSave}
            disabled={score.answered === 0}
          >
            保存本次记录
          </button>
          <button type="button" className="dses-btn" onClick={handleClearDraft}>
            清空答题卡
          </button>
          <label className="dses-check">
            <input
              type="checkbox"
              checked={draftEnabled}
              onChange={(e) => handleDraftToggle(e.target.checked)}
            />
            在本机保留答题草稿
          </label>
        </div>
        {draftStatus ? (
          <p className="dses-hint" aria-live="polite">
            {draftStatus}
          </p>
        ) : null}
      </section>

      {/* ---------------- Records ---------------- */}
      <section className="dses-panel" aria-label="个人记录">
        <header className="dses-panel-header">
          <h3 className="dses-panel-title">我的记录（仅本机）</h3>
          <div className="dses-panel-actions">
            <button
              type="button"
              className="dses-btn"
              onClick={handleExport}
              disabled={records.length === 0}
            >
              导出 JSON
            </button>
            <button
              type="button"
              className="dses-btn"
              onClick={() => importRef.current && importRef.current.click()}
            >
              导入 JSON
            </button>
            <input
              ref={importRef}
              className="dses-file-input"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files && e.target.files[0]
                if (file) handleImportFile(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="dses-btn dses-btn-danger"
              onClick={handleClearAll}
              disabled={records.length === 0}
            >
              清空
            </button>
          </div>
        </header>

        {loading ? (
          <p className="dses-empty" role="status">
            正在读取本机记录…
          </p>
        ) : savedRecords.length === 0 ? (
          <p className="dses-empty">还没有记录。完成答题后点击“保存本次记录”。</p>
        ) : (
          <ul className="dses-records">
            {savedRecords.map(({ record, score: s }, i) => {
              const older = savedRecords[i + 1]
              const delta = older && older.score.mean != null && s.mean != null
                ? s.mean - older.score.mean
                : null
              return (
                <li key={record.id} className="dses-record">
                  <span className="dses-record-date">{fmtDate(record.createdAt)}</span>
                  <span className="dses-record-count">
                    {`已答 ${s.answered}/16 · 缺失 ${s.missing}`}
                  </span>
                  <span className="dses-record-mean">均值 {fmtMean(s.mean)}</span>
                  <span className="dses-record-delta">{fmtDelta(delta)}</span>
                  <button
                    type="button"
                    className="dses-btn dses-btn-mini dses-btn-danger"
                    onClick={() => handleDelete(record.id)}
                    aria-label={`删除 ${fmtDate(record.createdAt)} 的记录`}
                  >
                    删除
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="dses-hint">
          记录采用作者 2022 年计分规则，保留 16 项答案与完成时间；导入后会重新计算分值并去除重复记录。
          “差值”仅为个人纵向参考，不代表任何好坏判断。
        </p>
      </section>

      {message ? (
        <p
          className={`dses-message dses-message-${message.type}`}
          role={message.type === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}
    </section>)
  )
}
