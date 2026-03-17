/*
-- ===================================================
-- Código: /src/pages/AgendaPage.tsx
-- Versão: 1.2.0
-- Data/Hora: 2025-10-31 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Atualizar a lógica de cores e status dos compromissos com base na data/hora atual.
-- Fluxo: Renderizado pelo App.tsx.
-- Regras:
--   - Atrasado (vermelho): data < hoje E não concluído.
--   - Futuro (azul): data > hoje E não concluído.
--   - Hoje (azul/vermelho): pendente antes do horário, atrasado após.
--   - Concluído (verde): is_done = true, independentemente da data.
-- ===================================================
*/
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAppointmentsForMonth } from '@/services/agendaService';
import { AgendaAppointment } from '@/types/agenda';
import { useToast } from '@/contexts/ToastContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, Phone, MessageSquareText, Mail, CheckSquare, Calendar as CalendarIcon, Building, User } from 'lucide-react';
import clsx from 'clsx';

// [--BLOCO--] Tipos e Helpers
type AppointmentsByDay = { [day: number]: AgendaAppointment[] };

const getChannelIcon = (channelType: string | null) => {
  switch (channelType) {
    case 'call': return <Phone className="h-4 w-4 text-gray-500" />;
    case 'whatsapp': return <MessageSquareText className="h-4 w-4 text-green-500" />;
    case 'email': return <Mail className="h-4 w-4 text-blue-500" />;
    case 'task': return <CheckSquare className="h-4 w-4 text-purple-500" />;
    default: return <CalendarIcon className="h-4 w-4 text-gray-400" />;
  }
};

// [--BLOCO--] Componente de Item de Compromisso com lógica de status atualizada
const AppointmentItem: React.FC<{ appointment: AgendaAppointment }> = ({ appointment }) => {
  // [--REGRA--] Lógica de status baseada na data e hora atual
  const getStatus = () => {
    const now = new Date();
    
    // Ajusta a data do compromisso para o início do dia para comparação de datas
    const appointmentDateOnly = new Date(appointment.calendar_at);
    appointmentDateOnly.setUTCHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (appointment.is_done) {
      return { label: 'Concluída', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
    }

    if (appointmentDateOnly < today) {
      return { label: 'Atrasada', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' };
    }

    if (appointmentDateOnly > today) {
      return { label: 'Pendente', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' };
    }

    // Se for hoje, verifica a hora
    if (appointment.on_time) {
      const [hours, minutes] = appointment.on_time.split(':').map(Number);
      const appointmentTimeToday = new Date();
      appointmentTimeToday.setHours(hours, minutes, 0, 0);
      
      if (now > appointmentTimeToday) {
        return { label: 'Atrasada', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' };
      }
    }
    
    // Se for hoje e a hora ainda não passou (ou não tem hora), é pendente
    return { label: 'Pendente', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' };
  };

  const status = getStatus();
  const { company, contact } = appointment;

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg neumorphic-convex bg-plate dark:bg-plate-dark">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">{getChannelIcon(appointment.channel_type)}</div>
        <div className="flex-1">
          <p className="font-semibold text-gray-800 dark:text-gray-100">{appointment.subject || 'Sem assunto'}</p>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
            <span>{appointment.on_time || 'Dia todo'}</span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>
      {(company || contact) && (
        <div className="mt-2 pt-3 border-t border-dark-shadow/40 dark:border-dark-dark-shadow/40 space-y-2 text-sm">
          {company && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Building className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{company.trade_name}</span>
            </div>
          )}
          {contact && (
            <>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <User className="h-4 w-4 flex-shrink-0" />
                <span>{contact.full_name}</span>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};


// [--BLOCO--] Componente Principal da Agenda
const AgendaPage: React.FC = () => {
  const { addToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AgendaAppointment[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [isLoading, setIsLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // [--BLOCO--] Fetch de dados
  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      try {
        const data = await getAppointmentsForMonth(year, month + 1);
        setAppointments(data);
      } catch (error) {
        addToast('Erro ao carregar compromissos.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAppointments();
  }, [year, month, addToast]);

  // [--BLOCO--] Agrupamento e cálculos para o calendário
  const { daysInMonth, firstDayOfMonth, appointmentsByDay } = useMemo(() => {
    const days = new Date(year, month + 1, 0).getDate();
    const first = new Date(year, month, 1).getDay();
    const byDay: AppointmentsByDay = {};
    appointments.forEach(app => {
      const day = new Date(app.calendar_at + 'T00:00:00').getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(app);
    });
    return { daysInMonth: days, firstDayOfMonth: first, appointmentsByDay: byDay };
  }, [year, month, appointments]);

  const selectedDayAppointments = useMemo(() => {
    return selectedDay ? appointmentsByDay[selectedDay] || [] : [];
  }, [selectedDay, appointmentsByDay]);

  // [--BLOCO--] Navegação
  const changeMonth = (offset: number) => {
    const newDate = new Date(year, month + offset, 1);
    setCurrentDate(newDate);
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      setSelectedDay(today.getDate());
    } else {
      setSelectedDay(1);
    }
  };
  
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today.getDate());
  };

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Agenda Inteligente</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna do Calendário */}
        <div className="lg:col-span-2 bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold capitalize">
              {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="default" onClick={() => changeMonth(-1)} className="!p-2"><ChevronLeft /></Button>
              <Button variant="default" onClick={goToToday}>Hoje</Button>
              <Button variant="default" onClick={() => changeMonth(1)} className="!p-2"><ChevronRight /></Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center font-medium text-gray-500 dark:text-gray-400 mb-2">
            {weekdays.map(day => <div key={day}>{day}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayAppointments = appointmentsByDay[day] || [];
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dayDate = new Date(year, month, day);
              
              // [--REGRA--] Lógica de cor agregada para o dia do calendário
              let dayColorClass = 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20'; // Default para dia passado sem tarefas
              if (dayAppointments.length > 0) {
                const isAnyOverdue = dayAppointments.some(a => !a.is_done && new Date(a.calendar_at + 'T00:00:00') < today);
                const areAllDone = dayAppointments.every(a => a.is_done);

                if (isAnyOverdue) {
                  dayColorClass = 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30'; // Vermelho se houver atraso
                } else if (areAllDone) {
                  dayColorClass = 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30'; // Verde se tudo concluído
                } else {
                  dayColorClass = 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30'; // Azul se houver pendentes (sem atraso)
                }
              } else if (dayDate > today) {
                  dayColorClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'; // Azul para dias futuros sem tarefas
              }

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={clsx(
                    "relative aspect-square flex flex-col items-center justify-center rounded-lg transition-all duration-200 border",
                    "neumorphic-convex hover:neumorphic-concave",
                    dayColorClass,
                    { 'ring-2 ring-primary': selectedDay === day }
                  )}
                >
                  <span className="text-lg font-bold">{day}</span>
                  {dayAppointments.length > 0 && (
                    <span className="absolute bottom-1 right-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                      {dayAppointments.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Coluna de Compromissos */}
        <div className="lg:col-span-1 bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex">
          <h2 className="text-xl font-bold mb-4">
            Compromissos de {selectedDay ? `${selectedDay} de ${currentDate.toLocaleString('pt-BR', { month: 'long' })}` : 'Nenhum dia selecionado'}
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : selectedDayAppointments.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {selectedDayAppointments.map(app => <AppointmentItem key={app.id} appointment={app} />)}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-center text-gray-500 dark:text-gray-400">
              <p>Nenhum compromisso para este dia.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgendaPage;
