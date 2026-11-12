import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CookieConsent } from './components/common/CookieConsent';
import { applySchoolFavicon } from './utils/favicon';

// Immediately synchronize browser tab favicon with school logo
applySchoolFavicon();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <CookieConsent />
  </StrictMode>,
);
