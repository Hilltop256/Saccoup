
import React from 'react';
import AppLayout from '@/components/AppLayout';
import { AppProvider } from '@/contexts/AppContext';
import { RoscaProvider } from '@/contexts/RoscaContext';

const Index: React.FC = () => {
  return (
    <AppProvider>
      <RoscaProvider>
        <AppLayout />
      </RoscaProvider>
    </AppProvider>
  );
};

export default Index;
