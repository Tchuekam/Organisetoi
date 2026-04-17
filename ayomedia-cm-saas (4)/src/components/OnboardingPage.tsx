import * as React from 'react';
import { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, ArrowRight, Building2, UserCircle } from 'lucide-react';
import { UserProfile } from '../types';

export default function OnboardingPage() {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setLoading(true);
    setError(null);
    try {
      const companyId = companyName.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).substring(7);
      
      const newProfile: UserProfile = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        displayName: name,
        companyId,
        companyName,
        role: 'admin',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', auth.currentUser.uid), newProfile);
      
      // Also create a basic company doc if needed
      await setDoc(doc(db, 'companies', companyId), {
        name: companyName,
        adminUid: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });

    } catch (err: any) {
      setError("Erreur lors de la configuration de votre profil. Veuillez réessayer.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ink)] flex items-center justify-center p-6 grayscale-0 animate-in fade-in duration-700">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[var(--gold)]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[var(--gold)]/20">
            <UserCircle size={32} className="text-[var(--gold)]" />
          </div>
          <h1 className="text-3xl font-serif text-[var(--gold)] font-bold mb-2">Configurez votre espace</h1>
          <p className="text-[var(--ink-faint)] text-sm">Commençons par les bases de votre agence CM.</p>
        </div>

        <div className="section-card bg-white border-none p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-row">
              <label className="form-label">Votre Nom Complet</label>
              <div className="relative">
                <input
                  type="text"
                  className="form-input pl-10 h-12"
                  placeholder="Jean Dupont"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <UserCircle className="absolute left-3 top-3.5 text-gray-400" size={18} />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Nom de votre Entreprise / Agence</label>
              <div className="relative">
                <input
                  type="text"
                  className="form-input pl-10 h-12"
                  placeholder="AyoMedia Lyon"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
                <Building2 className="absolute left-3 top-3.5 text-gray-400" size={18} />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading || !name || !companyName}
              className="btn-gold w-full h-12 flex items-center justify-center gap-2 mt-8 text-sm group"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>Terminer la configuration</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
