import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Cifra/decifra tokens OAuth em repouso (AES-256-GCM).
 * A chave vem de TOKEN_ENCRYPTION_KEY (32 bytes em base64).
 *
 * Se a chave não estiver configurada, os tokens são guardados em texto puro
 * no banco local — aceitável só em desenvolvimento. Em produção, configure
 * a chave. Senhas de conta NUNCA são guardadas; apenas tokens OAuth.
 */

function getKey(): Buffer | null {
  if (!config.tokenEncryptionKey) return null;
  const key = Buffer.from(config.tokenEncryptionKey, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY deve ter 32 bytes (base64).');
  }
  return key;
}

export function encryptToken(plain: string): string {
  const key = getKey();
  if (!key) return `plain:${plain}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptToken(stored: string): string {
  if (stored.startsWith('plain:')) return stored.slice('plain:'.length);
  const key = getKey();
  if (!key) throw new Error('Token cifrado, mas TOKEN_ENCRYPTION_KEY ausente.');
  const [, ivB64, tagB64, dataB64] = stored.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Gera uma chave nova (utilitário de setup). */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}
