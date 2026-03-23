import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Search, Replace, ReplaceAll } from 'lucide-react';
import clsx from 'clsx';

interface FindReplaceBarProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, options: { caseSensitive: boolean }) => void;
  onNext: () => void;
  onPrev: () => void;
  onReplace: (replacement: string) => void;
  onReplaceAll: (replacement: string) => void;
  matchCount: number;
  currentMatchIndex: number;
}

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  isOpen,
  onClose,
  onSearch,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  matchCount,
  currentMatchIndex
}) => {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [mode, setMode] = useState<'find' | 'replace'>('find');

  useEffect(() => {
    if (isOpen) {
      onSearch(query, { caseSensitive });
    }
  }, [query, caseSensitive, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  return (
    <div className="absolute top-2 right-4 z-50 w-80 bg-white dark:bg-dark-s2 rounded-lg shadow-xl border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header / Toggle Mode */}
      <div className="flex items-center justify-between mb-1">
         <div className="flex gap-1 bg-gray-100 dark:bg-dark-s3 p-0.5 rounded-md">
            <button 
              onClick={() => setMode('find')}
              className={clsx("px-2 py-0.5 text-xs rounded-sm font-medium transition-colors", mode === 'find' ? "bg-white dark:bg-dark-s2 shadow-sm text-primary" : "text-gray-500")}
            >
              Buscar
            </button>
            <button 
              onClick={() => setMode('replace')}
              className={clsx("px-2 py-0.5 text-xs rounded-sm font-medium transition-colors", mode === 'replace' ? "bg-white dark:bg-dark-s2 shadow-sm text-primary" : "text-gray-500")}
            >
              Substituir
            </button>
         </div>
         <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
           <X className="h-4 w-4" />
         </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          autoFocus
          type="text"
          placeholder="Buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-8 pr-16 py-1.5 text-sm border border-gray-300 dark:border-white/10 rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
           <span className="text-[10px] text-gray-400 mr-1">
             {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : '0/0'}
           </span>
           <button onClick={onPrev} className="p-0.5 hover:bg-gray-100 dark:hover:bg-dark-s3 rounded"><ChevronUp className="h-3 w-3" /></button>
           <button onClick={onNext} className="p-0.5 hover:bg-gray-100 dark:hover:bg-dark-s3 rounded"><ChevronDown className="h-3 w-3" /></button>
        </div>
      </div>

      {/* Replace Input */}
      {mode === 'replace' && (
        <div className="flex gap-2">
           <div className="relative flex-1">
              <Replace className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Substituir por..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="w-full pl-8 py-1.5 text-sm border border-gray-300 dark:border-white/10 rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
              />
           </div>
           <button 
             onClick={() => onReplace(replaceText)}
             disabled={matchCount === 0}
             className="px-2 py-1 bg-gray-100 dark:bg-dark-s2 border border-gray-300 dark:border-white/10 rounded-md text-xs hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
             title="Substituir atual"
           >
             <Replace className="h-3.5 w-3.5" />
           </button>
           <button 
             onClick={() => onReplaceAll(replaceText)}
             disabled={matchCount === 0}
             className="px-2 py-1 bg-gray-100 dark:bg-dark-s2 border border-gray-300 dark:border-white/10 rounded-md text-xs hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
             title="Substituir todos"
           >
             <ReplaceAll className="h-3.5 w-3.5" />
           </button>
        </div>
      )}

      {/* Options */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-dark-t1 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={caseSensitive} 
            onChange={(e) => setCaseSensitive(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary h-3 w-3"
          />
          Diferenciar maiúsculas
        </label>
      </div>
    </div>
  );
};
