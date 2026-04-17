import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getCountFromServer, Timestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AnalyticsSummary } from '../types';
import { startOfMonth, subDays, format, startOfWeek } from 'date-fns';

export function useGlobalAnalytics(companyId: string) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const weekStart = startOfWeek(now);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // BASE QUERIES
      const baseProspects = query(collection(db, 'prospects'), where('companyId', '==', companyId));
      const baseTasks = query(collection(db, 'tasks'), where('companyId', '==', companyId));
      const baseContent = query(collection(db, 'content'), where('companyId', '==', companyId));

      // 1. Total and status counts
      const [
        totalSnap,
        newThisMonthSnap,
        newStatusSnap,
        contactedStatusSnap,
        interestedStatusSnap,
        closedStatusSnap,
        coldStatusSnap
      ] = await Promise.all([
        getCountFromServer(baseProspects),
        getCountFromServer(query(baseProspects, where('createdAt', '>=', monthStart.toISOString()))),
        getCountFromServer(query(baseProspects, where('status', '==', 'new'))),
        getCountFromServer(query(baseProspects, where('status', '==', 'contacted'))),
        getCountFromServer(query(baseProspects, where('status', '==', 'interested'))),
        getCountFromServer(query(baseProspects, where('status', '==', 'closed'))),
        getCountFromServer(query(baseProspects, where('status', '==', 'cold'))),
      ]);

      // 2. Sources (WhatsApp, Facebook, Marketplace, Ads, Inbox)
      const sources = ['WhatsApp', 'Facebook', 'Marketplace', 'Ads', 'Inbox'];
      const sourceSnaps = await Promise.all(
        sources.map(s => getCountFromServer(query(baseProspects, where('source', '==', s))))
      );
      const leadsPerSource: Record<string, number> = {};
      sources.forEach((s, i) => { leadsPerSource[s] = sourceSnaps[i].data().count; });

      // 3. Content
      const [publishedThisMonthSnap, reelSnap, imageSnap, storySnap, videoSnap] = await Promise.all([
        getCountFromServer(query(baseContent, where('status', '==', 'Published'), where('createdAt', '>=', monthStart.toISOString()))),
        getCountFromServer(query(baseContent, where('type', '==', 'reel'))),
        getCountFromServer(query(baseContent, where('type', '==', 'image'))),
        getCountFromServer(query(baseContent, where('type', '==', 'story'))),
        getCountFromServer(query(baseContent, where('type', '==', 'video'))),
      ]);

      // 4. Tasks (completed today/week)
      const [tasksTodaySnap, tasksWeekSnap] = await Promise.all([
        getCountFromServer(query(baseTasks, where('status', '==', 'done'), where('dueDate', '>=', todayStart.toISOString()))),
        getCountFromServer(query(baseTasks, where('status', '==', 'done'), where('dueDate', '>=', weekStart.toISOString()))),
      ]);

      // 5. Trend (7 days) - This is tricky with counts because indexing issues might arise for multiple range filters
      // For trend, we'll fetch the last 100 prospects and aggregate locally if it's small, 
      // or just use 7 count queries (better for scaling).
      const trendQueries = Array.from({ length: 7 }).map((_, i) => {
        const start = subDays(now, 6 - i);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setHours(23,59,59,999);
        return getCountFromServer(query(baseProspects, where('createdAt', '>=', start.toISOString()), where('createdAt', '<=', end.toISOString())));
      });
      const trendSnaps = await Promise.all(trendQueries);
      const prospectsTrend = trendSnaps.map((snap, i) => {
        const d = subDays(now, 6 - i);
        return { date: format(d, 'dd/MM'), count: snap.data().count };
      });

      const total = totalSnap.data().count || 1;
      const closed = closedStatusSnap.data().count;
      const others = contactedStatusSnap.data().count + interestedStatusSnap.data().count + closed;

      setAnalytics({
        totalProspects: totalSnap.data().count,
        newProspectsThisMonth: newThisMonthSnap.data().count,
        prospectsByStatus: {
          new: newStatusSnap.data().count,
          contacted: contactedStatusSnap.data().count,
          interested: interestedStatusSnap.data().count,
          closed: closedStatusSnap.data().count,
          cold: coldStatusSnap.data().count,
        },
        leadsPerSource,
        conversionRate: (closed / total) * 100,
        responseRate: (others / total) * 100,
        publishedContentThisMonth: publishedThisMonthSnap.data().count,
        contentByType: {
          reel: reelSnap.data().count,
          image: imageSnap.data().count,
          story: storySnap.data().count,
          video: videoSnap.data().count,
        },
        tasksCompletedToday: tasksTodaySnap.data().count,
        tasksCompletedThisWeek: tasksWeekSnap.data().count,
        prospectsTrend
      });
    } catch (err) {
      console.error("Global stats error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchStats();
    // Refresh every 10 minutes or on mount
    const interval = setInterval(fetchStats, 600000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { analytics, loading, refresh: fetchStats };
}
