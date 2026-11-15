import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { prisma } from '../db.js';

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '12h' });
}

/** Middleware: exige um token de sessão válido. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    (req as Request & { user?: AuthPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

export function getUser(req: Request): AuthPayload | undefined {
  return (req as Request & { user?: AuthPayload }).user;
}

/** Valida credenciais e devolve o token, ou null se inválidas. */
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; name: string; role: string } | null> {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.active) return null;
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return null;
  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  return { token, name: user.name, role: user.role };
}
