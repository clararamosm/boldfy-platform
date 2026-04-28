// src/hooks/use-scroll-spy.ts
// Hook que observa quais elementos de uma lista de IDs estao
// "em vista" no viewport e devolve o ID atualmente ativo.
//
// Uso tipico: tabela de conteudos sticky que destaca a secao
// onde o usuario esta scrollando. Ex:
//
//   const active = useScrollSpy(['identidade', 'platform', 'historico']);
//   return <a className={active === 'identidade' ? 'font-bold' : ''}>...</a>
//
// Implementacao usa IntersectionObserver — nao escuta scroll diretamente,
// entao tem custo zero quando o usuario nao esta scrollando.

'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseScrollSpyOptions {
  /**
   * Margin do root do IntersectionObserver. Default
   * `'-30% 0px -65% 0px'` cria uma "zona ativa" no terco superior
   * do viewport (sentido natural de leitura).
   */
  rootMargin?: string;
}

const DEFAULT_ROOT_MARGIN = '-30% 0px -65% 0px';

export function useScrollSpy(
  sectionIds: string[],
  opts?: UseScrollSpyOptions,
): string | null {
  const [activeId, setActiveId] = useState<string | null>(
    sectionIds[0] ?? null,
  );

  // Mantem ref dos IDs pra evitar recriacao do observer a cada render.
  const idsRef = useRef(sectionIds);
  idsRef.current = sectionIds;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sectionIds.length === 0) return;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pega o primeiro elemento intersectando (ordem do DOM).
        // Se nenhum, mantem o ultimo ativo (nao "limpa").
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          );
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: opts?.rootMargin ?? DEFAULT_ROOT_MARGIN,
        threshold: 0,
      },
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIds.join('|'), opts?.rootMargin]);

  return activeId;
}
