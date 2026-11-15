import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';

const links = [
  { to: '/', label: 'Painel', end: true },
  { to: '/solicitacoes', label: 'Solicitações' },
  { to: '/fila', label: 'Fila de envio' },
  { to: '/integracoes', label: 'Integrações' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/configuracoes', label: 'Configurações' },
];

export function Shell({ children }: { children: ReactNode }) {
  const { logout, session } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <h1>EduGestão</h1>
          <div className="sub">Central de Atendimento</div>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="foot">
          <div style={{ marginBottom: '0.5rem', opacity: 0.85 }}>{session?.name}</div>
          <button onClick={logout}>Sair</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
