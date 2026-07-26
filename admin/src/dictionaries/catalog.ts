import { dictionaryRegistry } from './registry'

export const DICTIONARY_CODES = {
  userRole: 'user_role',
  userStatus: 'user_status',
  logSource: 'system_log_source',
  logLevel: 'system_log_level',
} as const

dictionaryRegistry.register(DICTIONARY_CODES.userRole, [
  { value: 'SUPER_ADMIN', labelKey: 'dict.userRole.superAdmin', fallbackLabel: '超级管理员' },
  { value: 'ADMIN', labelKey: 'dict.userRole.admin', fallbackLabel: '管理员' },
  { value: 'MERCHANT', labelKey: 'dict.userRole.merchant', fallbackLabel: '商家' },
  { value: 'USER', labelKey: 'dict.userRole.user', fallbackLabel: '普通用户' },
])

dictionaryRegistry.register(DICTIONARY_CODES.userStatus, [
  { value: 'ACTIVE', labelKey: 'dict.userStatus.active', fallbackLabel: '正常' },
  { value: 'DISABLED', labelKey: 'dict.userStatus.disabled', fallbackLabel: '已停用' },
])

dictionaryRegistry.register(DICTIONARY_CODES.logSource, [
  { value: 'SERVER', labelKey: 'dict.logSource.server', fallbackLabel: '服务端' },
  { value: 'MINIAPP', labelKey: 'dict.logSource.miniapp', fallbackLabel: '小程序' },
  { value: 'MERCHANT_WEB', labelKey: 'dict.logSource.merchantWeb', fallbackLabel: '商家端' },
  { value: 'ADMIN_WEB', labelKey: 'dict.logSource.adminWeb', fallbackLabel: '管理端' },
])

dictionaryRegistry.register(DICTIONARY_CODES.logLevel, [
  { value: 'INFO', labelKey: 'dict.logLevel.info', fallbackLabel: '信息' },
  { value: 'WARN', labelKey: 'dict.logLevel.warn', fallbackLabel: '警告' },
  { value: 'ERROR', labelKey: 'dict.logLevel.error', fallbackLabel: '错误' },
  { value: 'FATAL', labelKey: 'dict.logLevel.fatal', fallbackLabel: '严重' },
])
