import { useMemo } from 'react';
import { Prospect, Task, ContentPiece, CalendarPost } from '../types';

export function useAnalytics(prospects: Prospect[], tasks: Task[], content: ContentPiece[], calendarPosts: CalendarPost[]) {
  return useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];
    
    // Prospects this month
    const newThisMonth = prospects.filter(p => {
      if (!p.createdAt) return false;
      const d = new Date(p.createdAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    
    // Conversion rate: closed / total (avoid div by 0)
    const closed = prospects.filter(p => p.status === 'closed').length;
    const conversionRate = prospects.length > 0 ? (closed / prospects.length) * 100 : 0;
    
    // Response rate: (contacted + interested + closed) / total
    const responded = prospects.filter(p => ['contacted', 'interested', 'closed'].includes(p.status)).length;
    const responseRate = prospects.length > 0 ? (responded / prospects.length) * 100 : 0;
    
    // Leads per source
    const leadsPerSource = prospects.reduce((acc, p) => {
      acc[p.source] = (acc[p.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Tasks today
    const tasksCompletedToday = tasks.filter(t => t.status === 'done' && t.dueDate?.startsWith(today)).length;
    
    // Published content this month
    const publishedThisMonth = calendarPosts.filter(p => {
      if (!p.scheduledDate) return false;
      const d = new Date(p.scheduledDate);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    
    // 7-day prospect trend
    const prospectsTrend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      return {
        date: dayName,
        count: prospects.filter(p => p.createdAt?.startsWith(dateStr)).length
      };
    });
    
    return { 
      totalProspects: prospects.length,
      newProspectsThisMonth: newThisMonth, 
      conversionRate, 
      responseRate, 
      leadsPerSource, 
      tasksCompletedToday, 
      publishedContentThisMonth: publishedThisMonth, 
      prospectsTrend, 
      closed 
    };
  }, [prospects, tasks, content, calendarPosts]);
}
