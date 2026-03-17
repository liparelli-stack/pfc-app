/*
-- ===================================================
-- Código: /src/utils/statusHelper.ts
-- Versão: 1.0.0
-- Data/Hora: 2025-11-01 10:30
-- Autor: Dualite Alpha (AD)
-- Objetivo: Centralizar a lógica de status de compromissos.
-- ===================================================
*/
export const getStatus = (isDone: boolean, calendarAt: string | null, onTime: string | null) => {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isDone) {
    return { label: 'Concluída', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
  }

  if (calendarAt) {
    const appointmentDateOnly = new Date(calendarAt);
    appointmentDateOnly.setUTCHours(0, 0, 0, 0);

    if (appointmentDateOnly < today) {
      return { label: 'Atrasada', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' };
    }

    if (appointmentDateOnly.getTime() === today.getTime() && onTime) {
      const [hours, minutes] = onTime.split(':').map(Number);
      const appointmentTimeToday = new Date();
      appointmentTimeToday.setHours(hours, minutes, 0, 0);
      if (now > appointmentTimeToday) {
        return { label: 'Atrasada', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' };
      }
    }
  }
  
  return { label: 'Pendente', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' };
};
