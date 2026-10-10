// Keep protocol messages unchanged; localize them only for presentation.
export const SERVER_ERRORS_ZH = {
  'invalid candidate set': '请选择有效的候选符号组。',
  'only the sender may select a target': '只有发送者可以选择目标。',
  'this protocol does not allow target selection': '当前协议不支持发送者选数，请创建新房间。',
  'target is already locked': '发送目标已经锁定，不能修改。',
  'target selection is not available': '当前阶段不能选择目标，请等待页面同步。',
  'confidence must be null or a number in [0, 100]': '信心评分须留空或在 0–100 之间。',
  'guess must be an integer in [1, 5]': '请选择 1–5 的整数。',
  'missing bearer token': '缺少会话凭证，请重新开始。',
  'invalid token for this session': '会话凭证无效，请重新开始。',
  'session not found': '找不到这场实验。',
  'experimentType must be hidden, precognition or telepathy': '请选择有效的实验模块。',
  'code is required': '请输入邀请码。',
  'room code not found': '邀请码无效或已经使用，请向发送者确认。',
  'room not found': '找不到该房间。',
  'room already joined': '该房间已有接收者加入。',
  'only the receiver may submit guesses': '只有接收者可以提交答案。',
  'session is already finished': '这场实验已经结束。',
  'round not found': '找不到这一轮。',
  'round is already locked': '答案已经锁定，不能修改。',
  'answering window has not opened': '作答期尚未开始，请等待。',
  'only the receiver may start the next round': '只有接收者可以开始下一轮。',
  'round has not been revealed yet': '这一轮尚未揭晓，请等待。',
  'request body too large': '请求内容过大。',
  'invalid JSON body': '请求数据格式不正确。',
  'JSON body must be an object': '请求数据格式不正确。',
  'method not allowed': '不支持此请求方式。',
  'invalid path': '请求地址无效。',
  'not found': '找不到请求内容。',
  'invalid request': '请求无效，请重试。',
  'unknown endpoint': '找不到此服务接口。',
  'internal server error': '实验服务出现错误，请稍后重试。',
}

export function translateServerError(text) {
  if (Object.hasOwn(SERVER_ERRORS_ZH, text)) return SERVER_ERRORS_ZH[text]
  if (/^cannot (guess in|advance from) status /.test(text)) return '当前阶段不允许此操作，请等待页面同步。'
  const field = /^(\w+) must be an integer in \[(\d+), (\d+)\]$/.exec(text)
  if (field) return `参数 ${field[1]} 须为 ${field[2]}–${field[3]} 之间的整数。`
  return text
}
