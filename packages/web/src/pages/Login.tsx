import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        <h1 style={{ color: 'var(--azul)', margin: '0 0 0.25rem' }}>EduGestão</h1>
        <p style={{ color: 'var(--texto-suave)', marginTop: 0 }}>
          Central de Atendimento Escolar
        </p>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="msg-error">{error}</p>}
        <button className="primary" style={{ width: '100%', marginTop: '1rem' }} disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
