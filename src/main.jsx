import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

const container = document.getElementById('root') || document.body.appendChild(document.createElement('div'));
container.id = 'root';
createRoot(container).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
