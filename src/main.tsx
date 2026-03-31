
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Debug: intercept fetch to log Supabase requests (helps diagnose API key issues on Vercel)
if (import.meta.env.PROD) {
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('.supabase.co')) {
      const headers = new Headers(init?.headers);
      const apiKey = headers.get('apikey');
      const auth = headers.get('Authorization');
      console.log('[SaccoUp][fetch]', url.split('?')[0], '| apikey:', apiKey ? apiKey.substring(0, 20) + '...' : 'MISSING', '| auth:', auth ? auth.substring(0, 30) + '...' : 'MISSING');
    }
    return originalFetch(input, init);
  } as typeof fetch;
}

// Remove dark mode class addition
createRoot(document.getElementById("root")!).render(<App />);
