import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import Router from './Router.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
