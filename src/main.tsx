import '@xyflow/react/dist/style.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { IconGallery } from './ui/IconGallery';
import './store/install';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).has('gallery') ? <IconGallery /> : <App />}
  </StrictMode>,
);
