import React from 'react';
import { HardHat } from 'lucide-react';

const EmConstrucaoPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 dark:text-dark-t2">
      <div className="neumorphic-convex rounded-2xl p-8 max-w-md w-full">
        <HardHat className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-dark-t1">Em Construção</h1>
        <p className="mt-2">
          Esta seção está sendo preparada com muito cuidado e estará disponível em breve.
        </p>
      </div>
    </div>
  );
};

export default EmConstrucaoPage;
