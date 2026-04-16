window.onerror = function (message, source, lineno, colno, error) {
  console.error('GLOBAL ERROR:', { message, source, lineno, colno, error });
};

window.onunhandledrejection = function (event) {
  console.error('UNHANDLED PROMISE:', event.reason);
};

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AppProvider } from '@/contexts/AppContext';
import { RoscaProvider } from '@/contexts/RoscaContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <RoscaProvider>
        <App />
      </RoscaProvider>
    </AppProvider>
  </React.StrictMode>
);
