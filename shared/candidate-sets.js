// Wire/storage values remain positions 1–5. The immutable set determines
// their display on both peers, including after refresh and history import.
export const CANDIDATE_SETS = [
  { id: 'digits', label: '数字', options: ['1', '2', '3', '4', '5'].map(text => ({ text, label: text })) },
  { id: 'letters', label: '字母', options: ['A', 'B', 'C', 'D', 'E'].map(text => ({ text, label: text })) },
  { id: 'cosmos', label: '天体', options: [
    { icon: 'star', label: '星星' }, { icon: 'moon', label: '月亮' }, { icon: 'sun', label: '太阳' },
    { icon: 'black-hole', label: '黑洞' }, { icon: 'earth', label: '地球' },
  ] },
  { id: 'colors', label: '颜色', options: ['🟥', '🟧', '🟨', '🟩', '🟦'].map((text, i) => ({ text, label: ['红色', '橙色', '黄色', '绿色', '蓝色'][i] })) },
  { id: 'faces', label: '表情', options: ['😀', '😢', '😡', '😨', '😴'].map((text, i) => ({ text, label: ['开心', '难过', '生气', '害怕', '困倦'][i] })) },
  { id: 'directions', label: '方向', options: ['⬆️', '⬇️', '⬅️', '➡️', '🔄'].map((text, i) => ({ text, label: ['向上', '向下', '向左', '向右', '旋转'][i] })) },
]

export const CANDIDATE_SET_IDS = Object.freeze(CANDIDATE_SETS.map(set => set.id))
export function getCandidateSet(id) {
  return CANDIDATE_SETS.find(set => set.id === id) || CANDIDATE_SETS[0]
}
export function candidateLabel(id, value) {
  return getCandidateSet(id).options[value - 1]?.label ?? '—'
}
