/**
 * GB STUDY Application Entry Point
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Clear any previous devtools lockout tokens
try {
  localStorage.removeItem('tb_security_lockout_until');
  localStorage.removeItem('tb_security_lockout_start');
  localStorage.removeItem('tb_security_lockout_reason');
  localStorage.removeItem('tb_security_strikes_count');
} catch {}

// Import GB STUDY application bundle
import './gbstudy.js';
import { GBStudyEnhancements } from './components/GBFeatures';

// Mount enhancements (Carousel, 10-tap Admin panel, Online Test Series, All Courses)
let enhancementsContainer = document.getElementById('gb-enhancements-root');
if (!enhancementsContainer) {
  enhancementsContainer = document.createElement('div');
  enhancementsContainer.id = 'gb-enhancements-root';
  document.body.appendChild(enhancementsContainer);
}

const root = createRoot(enhancementsContainer);
root.render(<GBStudyEnhancements />);
