import { prisma } from '../db.js';

export interface AutomationSettings {
  pollIntervalMinutes: number;
  autoSyncEnabled: boolean;
  queueBatchSize: number;
  queueIntervalMinutes: number;
  pauseAfterFailures: number;
  workStartHour: number; // 0-23
  workEndHour: number; // 0-23
}

export const DEFAULT_AUTOMATION: AutomationSettings = {
  pollIntervalMinutes: 5,
  autoSyncEnabled: true,
  queueBatchSize: 10,
  queueIntervalMinutes: 5,
  pauseAfterFailures: 5,
  workStartHour: 0,
  workEndHour: 23,
};

export const DEFAULT_SIGNATURE = [
  'Atenciosamente,',
  '',
  'Secretaria Escolar',
  'EduGestão — Gestão e Atendimento Escolar',
  'E-mail: secretariaedugestao@gmail.com',
].join('\n');

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(row.value) as object) } as T;
  } catch {
    return fallback;
  }
}

async function setJson(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

export function getAutomation(): Promise<AutomationSettings> {
  return getJson('automation', DEFAULT_AUTOMATION);
}
export function setAutomation(v: Partial<AutomationSettings>): Promise<void> {
  return getAutomation().then((cur) => setJson('automation', { ...cur, ...v }));
}

export async function getSignature(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: 'signature' } });
  return row?.value ?? DEFAULT_SIGNATURE;
}
export async function setSignature(text: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: 'signature' },
    create: { key: 'signature', value: text },
    update: { value: text },
  });
}
