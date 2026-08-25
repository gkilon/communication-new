import React from 'react';

// Low-opacity "blueprint" line art — outlined circles, a rotated diamond, scattered
// dots — matching the thin technical-drawing texture behind kilon-consulting.com's pages.
export const BlueprintBackground: React.FC = () => (
  <div className="kilon-blueprint-bg" aria-hidden="true">
    <svg width="500" height="500" viewBox="0 0 500 500" style={{ top: '-80px', right: '-120px' }}>
      <circle cx="250" cy="250" r="180" fill="none" stroke="#1E1B16" strokeWidth="1" />
      <circle cx="250" cy="250" r="120" fill="none" stroke="#1E1B16" strokeWidth="1" />
    </svg>
    <svg width="300" height="300" viewBox="0 0 300 300" style={{ bottom: '-60px', left: '-80px' }}>
      <rect x="60" y="60" width="180" height="180" fill="none" stroke="#1E1B16" strokeWidth="1" transform="rotate(15 150 150)" />
    </svg>
    <svg width="200" height="200" viewBox="0 0 200 200" style={{ top: '40%', left: '5%' }}>
      <circle cx="20" cy="20" r="3" fill="#1E1B16" />
      <circle cx="60" cy="45" r="2" fill="#1E1B16" />
      <circle cx="35" cy="80" r="2.5" fill="#1E1B16" />
      <circle cx="90" cy="15" r="2" fill="#1E1B16" />
    </svg>
  </div>
);
