/*
-- ===================================================
-- Código             : /src/components/vision360/mini/MiniPie.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-11-14 09:55 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Mini pizza (pie chart) em SVG para representar
--                      Ações Ativas vs Concluídas em um único olhar.
--                      Tooltip compacto com legenda de cores.
-- Fluxo              : Dashboard → MiniPie (por tipo) com tooltip:
--                      "Ativas (verde): X • Concluídas (cinza): Y • Total: Z"
-- Alterações (1.1.0) :
--  • Tooltip revisado para incluir legenda de cores (verde/cinza) em formato
--    compacto, conforme nova diretriz do Dashboard.
--  • Nenhuma alteração estrutural ou visual além do texto do tooltip.
-- Alterações (1.0.0) :
--  • Criação do componente MiniPie com 2 fatias (ativas x concluídas),
--    usando paths em SVG e cores contrastantes.
-- Dependências       : react
-- ===================================================
*/

import React, { useMemo } from 'react';

type MiniPieProps = {
  active: number;
  completed: number;
  width?: number;
  height?: number;
  className?: string;
  /**
   * Tooltip customizado. Se não informado, usa tooltip compacto com legenda.
   */
  tooltip?: string;
  activeColor?: string;
  completedColor?: string;
};

type Point = { x: number; y: number };

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number
): Point {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    cx,
    cy,
    'L',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
}

const MiniPie: React.FC<MiniPieProps> = ({
  active,
  completed,
  width = 48,
  height = 48,
  className,
  tooltip,
  activeColor = '#10B981',   // verde (ativas)
  completedColor = '#CBD5F5', // cinza-claro (concluídas)
}) => {
  const total = Math.max(0, active) + Math.max(0, completed);

  const { activePath, completedPath } = useMemo(() => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 2;

    if (total <= 0) {
      const fullCircle = describeArc(cx, cy, radius, 0, 359.999);
      return {
        activePath: '',
        completedPath: fullCircle,
      };
    }

    const activeFrac = Math.max(0, active) / total;
    const activeAngle = activeFrac * 360;

    const completedPath =
      completed > 0
        ? describeArc(cx, cy, radius, 0, 360 - activeAngle)
        : '';

    const activeStart = 360 - activeAngle;
    const activePath =
      active > 0
        ? describeArc(cx, cy, radius, activeStart, 360)
        : '';

    return { activePath, completedPath };
  }, [active, completed, total, width, height]);

  // --- Tooltip compacto com legenda de cores (nova diretriz) ---
  const finalTooltip =
    tooltip ??
    `Ativas (verde): ${active} • Concluídas (cinza): ${completed} • Total: ${total}`;

  return (
    <div
      className={className}
      title={finalTooltip}
      aria-label={finalTooltip}
      role="img"
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {completedPath && <path d={completedPath} fill={completedColor} />}
        {activePath && <path d={activePath} fill={activeColor} />}
        <circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2 - 2}
          fill="none"
          stroke="rgba(15,23,42,0.12)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};

export default MiniPie;
