import React from 'react';
import ReactDOM from 'react-dom/client';
import './storage-shim.js'; // must run before any component that reads window.storage
import './styles.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
