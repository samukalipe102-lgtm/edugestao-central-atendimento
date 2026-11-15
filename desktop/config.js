/**
 * Configuração do usuário do app desktop EduGestão.
 *
 * Guardada em JSON na pasta userData do Electron, FORA do binário e fora do
 * repositório. Guarda apenas o que o usuário precisa informar: as credenciais
 * do app OAuth do Google (Client ID/Secret), a chave da IA (opcional) e os
 * segredos de servidor. Tokens OAuth das contas ficam no banco (data/), cifrados.
 */

import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export function caminhoConfig() {
  return join(app.getPath('userData'), 'config.json');
}

const CAMPOS = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'JWT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'GEMINI_API_KEY',
];

export function carregarConfig() {
  try {
    const p = caminhoConfig();
    if (!existsSync(p)) return {};
    const obj = JSON.parse(readFileSync(p, 'utf-8'));
    const limpo = {};
    for (const k of CAMPOS) if (obj[k]) limpo[k] = obj[k];
    return limpo;
  } catch {
    return {};
  }
}

export function salvarConfig(nova) {
  const atual = carregarConfig();
  const merge = { ...atual };
  for (const k of CAMPOS) {
    if (k in (nova || {})) {
      const v = nova[k];
      if (v === null || v === '') delete merge[k];
      else merge[k] = v;
    }
  }
  const p = caminhoConfig();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(merge, null, 2), 'utf-8');
  return merge;
}
