import { useEffect } from 'react';
import { Prospect } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { subDays, isBefore } from 'date-fns';

export function useProspects(
  prospects: Prospect[],
  addNotification: (params: { type: 'success' | 'warning' | 'error' | 'info', title: string, message: string }) => void
) {
  useEffect(() => {
    if (prospects.length === 0) return;

    const autoColdDetection = async () => {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      let markedCount = 0;

      const updates = prospects
        .filter(p => (p.status === 'new' || p.status === 'contacted'))
        .filter(p => p.createdAt && isBefore(new Date(p.createdAt), thirtyDaysAgo));

      if (updates.length === 0) return;

      for (const p of updates) {
        try {
          await updateDoc(doc(db, 'prospects', p.id), { status: 'cold' });
          markedCount++;
        } catch (err) {
          console.error("Cold detection update error:", err);
        }
      }

      if (markedCount > 0) {
        addNotification({
          type: 'info',
          title: 'Prospects Froids',
          message: `${markedCount} prospects marqués comme froids automatiquement`
        });
      }
    };

    autoColdDetection();
  }, [prospects.length]);
}
