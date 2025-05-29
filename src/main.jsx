import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root') || document.body.appendChild(document.createElement('div'));
container.id = 'root';
createRoot(container).render(<App />); 