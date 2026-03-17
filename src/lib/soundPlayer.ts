/*
-- ===================================================
-- Código             : /src/lib/soundPlayer.ts
-- Versão (.v20)      : 3.1.0
-- Data/Hora          : 2025-11-17 20:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Sons procedurais para o CRM Appy (Web Audio API)
-- Fluxo              : playCoinWinSound() / playWinSound()
-- Alterações (3.1.0) :
--   • Mantido playCoinWinSound() como som "coin" padrão.
--   • Criado playWinSound() como som de vitória de qualidade superior.
--   • Removido som de perda conforme solicitado.
-- Dependências       : AudioContext / webkitAudioContext
-- ===================================================
*/

let audioCtx: AudioContext | null = null;

// Obtém ou cria um AudioContext seguro
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    const AnyWindow = window as any;
    const Ctx = window.AudioContext || AnyWindow.webkitAudioContext;

    if (!Ctx) return null;

    if (!audioCtx) audioCtx = new Ctx();

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    return audioCtx;
  } catch {
    return null;
  }
}

/* ==========================================================
   Som Original (mantido): playCoinWinSound()
   Coin simples — útil para testes e fallback
========================================================== */
export function playCoinWinSound() {
  const ctx = getCtx();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.18);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch {}
}

/* ==========================================================
   Novo som principal: playWinSound()
   Coin Premium • Bonito • Limpo • Subida + Descida suave
========================================================== */
export function playWinSound() {
  const ctx = getCtx();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Timbre mais rico
    osc.type = "triangle";

    // Frequência com "efeito vitória"
    osc.frequency.setValueAtTime(900, now);               // base
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.08); // sobe
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.18); // desce suave

    // Envelope polido
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  } catch {}
}
