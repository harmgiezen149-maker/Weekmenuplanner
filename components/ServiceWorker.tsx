"use client";

import { useEffect } from "react";

/**
 * Registreert de service worker.
 *
 * Staat in de layout en toont zelf niets. Mislukt de registratie — oudere
 * browser, privémodus, geen https — dan werkt de app gewoon zonder: geen
 * bewaarde boodschappenlijst en geen meldingen, verder niets aan de hand.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const registreer = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* zonder service worker doet de app het ook */
      });
    };
    // Pas na het laden: de registratie mag niet met het eerste scherm
    // concurreren om bandbreedte.
    if (document.readyState === "complete") registreer();
    else window.addEventListener("load", registreer, { once: true });
  }, []);

  return null;
}
