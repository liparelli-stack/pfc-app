import React from 'react';

interface MarkdownStatusBarProps {
  text: string;
}

export const MarkdownStatusBar: React.FC<MarkdownStatusBarProps> = ({ text }) => {
  const lines = text.split('\n').length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;

  return (
    <div className="flex items-center justify-between px-4 py-1 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 select-none">
      <div className="flex gap-4">
        <span>{words} palavras</span>
        <span>{chars} caracteres</span>
        <span>{lines} linhas</span>
      </div>
      <div>
        Visualização
      </div>
    </div>
  );
};
