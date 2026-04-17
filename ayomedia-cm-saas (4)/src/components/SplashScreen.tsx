import * as React from 'react';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-[var(--ink)] flex flex-col items-center justify-center z-[9999]">
      <div className="text-4xl font-serif text-[var(--gold)] font-bold tracking-[0.2em] animate-pulse">
        AYOMEDIA
      </div>
      <div className="mt-4 w-12 h-[1px] bg-[var(--gold)]/30"></div>
      <p className="mt-4 text-[var(--ink-faint)] text-[10px] uppercase tracking-widest">Initialisation de l'espace de travail</p>
    </div>
  );
}
