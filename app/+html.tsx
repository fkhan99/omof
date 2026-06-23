import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="preconnect" href="https://omof-eed24.firebaseapp.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://omof-eed24.firebaseapp.com" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <style dangerouslySetInnerHTML={{ __html: bootSplash }} />
        <style dangerouslySetInnerHTML={{ __html: refreshGearKeyframes }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>
        <div id="omof-boot-overlay" aria-hidden="true"></div>
        {children}
      </body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #F7F3EE;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #1A1D1F;
  }
}`;

const bootSplash = `
#omof-boot-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F7F3EE;
}
@media (prefers-color-scheme: dark) {
  #omof-boot-overlay {
    background: #1A1D1F;
  }
}
#omof-boot-overlay::after {
  content: '';
  width: 56px;
  height: 56px;
  border: 4px solid rgba(192, 86, 33, 0.2);
  border-top-color: #C05621;
  border-radius: 50%;
  animation: omof-boot-spin 0.9s linear infinite;
}
@keyframes omof-boot-spin {
  to { transform: rotate(360deg); }
}`;

const refreshGearKeyframes = `
@keyframes refreshGearSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`;
