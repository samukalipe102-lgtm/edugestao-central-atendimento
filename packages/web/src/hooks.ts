import { useEffect, useRef, useState } from 'react';

/**
 * Carrega dados da API de forma estável. A atualização em segundo plano
 * (refetch) NÃO zera os dados atuais — evita o "piscar"/tremer da tela.
 */
export function useApiData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);

  function run() {
    // Só mostra "carregando" na primeira vez; refetch é silencioso.
    if (first.current) setLoading(true);
    loader()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setLoading(false);
        first.current = false;
      });
  }

  useEffect(run, deps);
  return { data, loading, error, reload: run };
}
