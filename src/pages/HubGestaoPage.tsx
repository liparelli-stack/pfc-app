import React from 'react';
import { AreaChart } from 'lucide-react';

const HubGestaoPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="neumorphic-convex rounded-2xl p-8 max-w-md w-full">
        <AreaChart className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Hub de Gestão</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Esta seção está em construção e estará disponível em breve.
        </p>
      </div>
    </div>
  );
};

export default HubGestaoPage;
