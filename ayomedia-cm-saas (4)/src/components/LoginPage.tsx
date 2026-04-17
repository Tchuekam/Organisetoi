import * as React from 'react';
import { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../firebase';
import { Loader2, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add custom parameter to force account selection if needed
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("La fenêtre de connexion a été fermée.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError("Requête annulée.");
      } else {
        setError("Erreur de connexion avec Google. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ink)] flex items-center justify-center p-6 bg-cover bg-center" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #2D2A25 0%, #1A1815 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif text-[var(--gold)] font-bold tracking-[0.2em] mb-2">AYOMEDIA</h1>
          <p className="text-[var(--ink-faint)] text-xs uppercase tracking-widest">Customer Relationship Management</p>
        </div>

        <div className="section-card border-[var(--border-soft)] bg-[var(--surface)]/80 backdrop-blur-xl p-10 shadow-2xl text-center">
          <div className="mb-8">
            <h2 className="text-2xl font-serif font-medium text-[var(--ink)] mb-1">Bienvenue</h2>
            <p className="text-[var(--ink-soft)] text-sm">Connectez-vous pour accéder à votre espace.</p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-12 border border-[var(--border)] bg-white rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-md group active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin text-[var(--gold)]" />
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span className="text-sm font-semibold text-gray-700">Continuer avec Google</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              localStorage.setItem('skip_auth', 'true');
              window.location.reload();
            }}
            className="mt-4 w-full text-xs text-[var(--ink-faint)] hover:text-[var(--gold)] transition-colors font-medium underline underline-offset-4"
          >
            Accéder en mode démonstration (sans connexion)
          </button>

          {error && (
            <div className="mt-6 p-3 bg-red-50 rounded-lg border border-red-100 flex items-center justify-center gap-2">
              <p className="text-red-600 text-[11px] font-medium">{error}</p>
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-[var(--border-soft)]">
            <p className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider leading-relaxed">
              En continuant, vous accédez à l'infrastructure sécurisée de AYOMEDIA.
            </p>
          </div>
        </div>
        
        <p className="mt-10 text-center text-[var(--ink-faint)] text-[10px] uppercase tracking-[0.3em]">
          &copy; {new Date().getFullYear()} Ayomedia HQ • Creative Agency
        </p>
      </div>
    </div>
  );
}
