import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // First get the doc to check if it exists
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          // Then subscribe for updates
          const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            }
          });
          setLoading(false);
          return () => unsubscribeProfile();
        } else {
          setProfile(null);
          setLoading(false);
        }
      } else {
        const shouldSkip = localStorage.getItem('skip_auth') === 'true';
        if (shouldSkip) {
          // Fallback to demo profile if not logged in but auth is skipped
          setProfile({
            uid: 'demo_user',
            email: 'demo@ayomedia.com',
            displayName: 'Invité Démo',
            companyId: 'ayomedia_hq',
            companyName: 'AyoMedia Demo',
            role: 'admin',
            createdAt: new Date().toISOString()
          } as UserProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return { user, profile, loading };
}
