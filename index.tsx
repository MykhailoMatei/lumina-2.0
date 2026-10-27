import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initGlobalErrorListeners } from './services/errorMonitoring';

// Initialize lightweight global client-side error tracking
initGlobalErrorListeners();

/**
 * Robust Service Worker Registration
 * Mobile PWAs sometimes need a relative path to find the script.
 */
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;

  try {
    const swPath = './sw.js';
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: './'
    });
    
    console.log('Lumina Core registered:', registration.scope);

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.update();
  } catch (err: any) {
    console.warn('Lumina Core initialization skipped:', err.message);
  }
};

// Start registration immediately
registerServiceWorker();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('Lumina Core has claimed control of the session.');
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);