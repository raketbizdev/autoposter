import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/manrope';
import { theme } from './theme.js';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>,
);
