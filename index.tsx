import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ActivityLogger } from './lib/utils/activityLogger';
import { PerformanceMonitor } from './lib/utils/performanceObserver';

// Initialize the user activity logger as soon as the app starts
ActivityLogger.init();
PerformanceMonitor.init();

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