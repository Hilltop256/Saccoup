
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from '@/contexts/AppContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <App />
  </AppProvider>
);

// Remove dark mode class addition
createRoot(document.getElementById("root")!).render(<App />);
