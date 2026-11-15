import { Router } from 'express';
import { z } from 'zod';
import { login } from '../auth/auth.js';
import { audit } from '../services/audit.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }
  const result = await login(parsed.data.email, parsed.data.password);
  if (!result) {
    res.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }
  await audit({ action: 'LOGIN', entityType: 'AdminUser', metadata: { email: parsed.data.email } });
  res.json(result);
});
