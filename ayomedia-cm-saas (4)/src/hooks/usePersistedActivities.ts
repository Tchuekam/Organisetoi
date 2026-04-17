import { useState, useEffect } from 'react';

export function usePersistedActivities() {
  const todayKey = new Date().toISOString().split('T')[0];
  
  const [activities, setActivities] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`activities_${todayKey}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [streak, setStreak] = useState(() => {
    return Number(localStorage.getItem('lastProspStreak') || 0);
  });

  useEffect(() => {
    localStorage.setItem(`activities_${todayKey}`, JSON.stringify(activities));
  }, [activities, todayKey]);

  const updateStreak = (completedTasks: any[]) => {
    // Logic for consecutive days of 'PROSP' tasks
    // This would ideally check history, but for MVP we track current streak
    // If a PROSP task is done today for the first time, check if yesterday was also done.
    // Simplified for now: if user completes all today's PROSP tasks, increment if not already incremented today.
    
    const todayProspDone = completedTasks.some(t => t.tag === 'PROSP' || t.tag === 'PROSPER');
    if (todayProspDone) {
      // In a real app we'd check if yesterday had one. 
      // We'll set a 'streakUpdatedLast' flag
      const lastUpdate = localStorage.getItem('streakUpdatedLast');
      if (lastUpdate !== todayKey) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        localStorage.setItem('lastProspStreak', String(newStreak));
        localStorage.setItem('streakUpdatedLast', todayKey);
      }
    }
  };

  const toggleActivity = (id: string) => {
    setActivities(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return { activities, toggleActivity, streak, updateStreak };
}
