/** Dictionary namespace owned by the session attention plugin. */
export const NS = 'sessionAttention'

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  'trigger.label': '会话提醒：{pending} 个待处理，{completed} 个已完成',
  'trigger.short': '{count} 个会话需要关注',
  'panel.title': '会话提醒',
  'panel.description': '其他会话需要你的关注',
  'panel.list': '需要关注的会话',
  'panel.more': '另有 {count} 个会话',
  'panel.close': '关闭会话提醒',
  'status.question': '等待回答',
  'status.plan-review': '等待审核计划',
  'status.approval': '等待审批',
  'status.completed': '已完成',
  'navigation.error': '暂时无法打开该会话，请重试',
} as const

/** English dictionary with the same keys as the Chinese source. */
export const en: Record<SessionAttentionKey, string> = {
  'trigger.label': 'Session attention: {pending} pending, {completed} completed',
  'trigger.short': '{count} sessions need attention',
  'panel.title': 'Session attention',
  'panel.description': 'Other sessions need your attention',
  'panel.list': 'Sessions needing attention',
  'panel.more': '{count} more sessions',
  'panel.close': 'Close session attention',
  'status.question': 'Waiting for an answer',
  'status.plan-review': 'Waiting for plan review',
  'status.approval': 'Waiting for approval',
  'status.completed': 'Completed',
  'navigation.error': 'This session cannot be opened right now. Try again.',
}

/** Keys available in the plugin's locale namespace. */
export type SessionAttentionKey = keyof typeof zh
