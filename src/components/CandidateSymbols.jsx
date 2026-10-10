import { CANDIDATE_SETS, getCandidateSet } from '../../shared/candidate-sets.js'
import { useI18n } from '../i18n/I18n.jsx'
import { Icon } from './Icon.jsx'
import './CandidateSymbols.css'

export function CandidateSymbol({ setId, value }) {
  const { t } = useI18n()
  const option = getCandidateSet(setId).options[value - 1]
  if (!option) return <span>—</span>
  if (!option.icon) return <span className="candidate-symbol">{option.text}</span>
  return <span className="candidate-symbol"><Icon name={option.icon} /><span className="sr-only">{t(option.label)}</span></span>
}

export function CandidateSetPicker({ value, onChange, disabled }) {
  const { t } = useI18n()
  return <fieldset className="candidate-picker" disabled={disabled}>
    <legend>{t('候选符号')}</legend>
    <p className="setup-hint">{t('六组选一，每组五个选项；整场使用同一组。双人房间由发送者决定。')}</p>
    <div className="candidate-set-grid">
      {CANDIDATE_SETS.map(set => <label key={set.id} className={`candidate-set ${value === set.id ? 'selected' : ''}`}>
        <input type="radio" name="candidate-set" value={set.id} checked={value === set.id} onChange={() => onChange(set.id)} />
        <span className="candidate-set-name">{t(set.label)}</span>
        <span className="candidate-set-preview" aria-hidden="true">{set.options.map((option, i) => <CandidateSymbol key={i} setId={set.id} value={i + 1} />)}</span>
      </label>)}
    </div>
  </fieldset>
}
