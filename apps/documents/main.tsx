import React from 'react';
import {createRoot} from 'react-dom/client';
import {DocumentsApp} from './DocumentsApp';
import './documents.css';
import './documents-enhancements.css';
import './documents-content-flow.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DocumentsApp />
  </React.StrictMode>,
);
