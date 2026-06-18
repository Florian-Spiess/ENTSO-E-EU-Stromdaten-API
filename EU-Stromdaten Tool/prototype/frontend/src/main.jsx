import React from 'react';
import ReactDOM from 'react-dom/client';
import Plotly from 'plotly.js-dist-min';
import App from './App.jsx';
import './style.css';

window.Plotly = Plotly;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
