import * as React from 'react';
import { useState, useEffect, useMemo, useRef, Component } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  AreaChart, Area, LineChart, Line
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  getDocFromServer,
  Timestamp,
  limit,
  orderBy,
  startAfter,
  getCountFromServer
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Prospect, Task, ContentPiece, UserProfile, Role, CalendarPost, Message, ResearchItem, Invoice, Template } from './types';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Calendar, 
  Users, 
  FileText, 
  MessageSquare, 
  Search, 
  Tag, 
  Trash2,
  LogOut,
  Plus,
  Clock,
  TrendingUp,
  Globe,
  DollarSign,
  ChevronRight,
  Bell,
  Sparkles,
  Send,
  Bot,
  LogIn,
  Instagram,
  Facebook,
  Video,
  X,
  Loader2,
  Download,
  Copy,
  FilePlus,
  Zap,
  Check,
  MessageCircle,
  Share2,
  Menu,
  AlertCircle,
  Info,
  ChevronLeft
} from 'lucide-react';
import { generateContentIdeas, refineCaption, chatWithGemini, generateMarketInsights, analyzeProspect, generateOutreachMessages } from './services/geminiService';
import axios from 'axios';
import { useNotifications, AppNotification } from './hooks/useNotifications';
import { useAnalytics } from './hooks/useAnalytics';
import { useGlobalAnalytics } from './hooks/useGlobalAnalytics';
import { useProspects } from './hooks/useProspects';
import { usePersistedActivities } from './hooks/usePersistedActivities';
import SkeletonCard from './components/ui/SkeletonCard';
import PricingPage from './components/PricingPage';
import { useAuth } from './hooks/useAuth';
import SplashScreen from './components/SplashScreen';
import LoginPage from './components/LoginPage';
import OnboardingPage from './components/OnboardingPage';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// --- Constants ---
// No more defaults needed inside MainApp as we use props

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Error Boundary ---
// --- Error Boundary ---
interface EBProps { children: React.ReactNode; }
interface EBState { hasError: boolean; error: any; }
class ErrorBoundary extends React.Component<EBProps, EBState> {
  state: EBState = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("EB caught error", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-20 text-center">
          <h1 className="text-2xl font-serif mb-4">Oups ! Quelque chose s'est mal passé.</h1>
          <pre className="text-xs bg-red-50 p-4 rounded text-red-800 overflow-auto max-w-full">{this.state.error?.toString()}</pre>
          <button className="mt-4 btn-gold" onClick={() => window.location.reload()}>Recharger la page</button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <SplashScreen />;

  // Show login page if no user AND no skip_auth flag
  const shouldSkip = localStorage.getItem('skip_auth') === 'true';
  if (!user && !shouldSkip) return <LoginPage />;
  
  // If we have a user but no profile (new user), show onboarding
  if (user && !profile) return <OnboardingPage />;
  
  // If we have a profile (demo or real)
  return (
    <ErrorBoundary>
      <MainApp 
        companyId={profile?.companyId || 'ayomedia_hq'} 
        userId={user?.uid || 'demo_user'} 
        isDemo={!user}
      />
    </ErrorBoundary>
  );
}

function MainApp({ companyId, userId, isDemo = false }: { companyId: string, userId: string, isDemo?: boolean }) {
  console.log("App Rendering...");
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Data State
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [content, setContent] = useState<ContentPiece[]>([]);
  const [calendarPosts, setCalendarPosts] = useState<CalendarPost[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const sessionId = useMemo(() => Math.random().toString(36).substring(7), []);
  const prospectsCountRef = useRef(0);

  const { 
    notifications, 
    addNotification, 
    markAsRead, 
    markAllAsRead, 
    clearNotification, 
    unreadCount 
  } = useNotifications();

  const localAnalytics = useAnalytics(prospects, tasks, content, calendarPosts);
  const { analytics: globalAnalytics, loading: statsLoading, refresh: refreshStats } = useGlobalAnalytics(companyId);
  const { activities, toggleActivity, streak, updateStreak } = usePersistedActivities();
  
  // Combine stats
  const realAnalytics = globalAnalytics || localAnalytics;
  const isDataLoading = statsLoading && prospects.length === 0;

  useProspects(prospects, addNotification);

  // Update streak when tasks change
  useEffect(() => {
    updateStreak(tasks.filter(t => t.status === 'done'));
  }, [tasks]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'prospect' | 'post' | 'task' | 'message' | 'research' | 'confirmDelete' | 'schedule'>('prospect');
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [prospectToDelete, setProspectToDelete] = useState<Prospect | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isOutreachOpen, setIsOutreachOpen] = useState(false);
  const [selectedProspectForOutreach, setSelectedProspectForOutreach] = useState<Prospect | null>(null);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', parts: {text: string}[]}[]>([]);
  const notifiedTasks = React.useRef<Set<string>>(new Set());
  const notifiedPosts = useRef<Set<string>>(new Set());
  const prevStreak = useRef(streak);

  // Task Notification Checker
  useEffect(() => {
    if (tasks.length === 0) return;

    const checkTasks = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.status === 'done' || !task.dueDate) return;
        
        const dueDate = new Date(task.dueDate);
        const diffInHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        const taskKey = `${task.id}-${diffInHours < 0 ? 'overdue' : 'upcoming'}`;

        if (notifiedTasks.current.has(taskKey)) return;

        if (diffInHours < 0) {
          // Overdue
          addNotification({
            type: 'error',
            title: 'Tâche en retard',
            message: task.title
          });
          notifiedTasks.current.add(taskKey);
        } else if (diffInHours < 24) {
          // Due soon (within 24h)
          addNotification({
            type: 'warning',
            title: 'Échéance proche',
            message: task.title
          });
          notifiedTasks.current.add(taskKey);
        }
      });
    };

    checkTasks();
    const interval = setInterval(checkTasks, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [tasks]);

  // Content Notification Checker
  useEffect(() => {
    if (calendarPosts.length === 0) return;
    const checkPosts = () => {
      const now = new Date();
      calendarPosts.forEach(post => {
        if (!post.scheduledDate) return;
        const scheduledDate = new Date(post.scheduledDate);
        const diffInHours = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (diffInHours > 0 && diffInHours < 24 && !notifiedPosts.current.has(post.id)) {
          addNotification({
            type: 'info',
            title: 'Publication imminente',
            message: `Un post est prévu dans moins de 24h.`
          });
          notifiedPosts.current.add(post.id);
        }
      });
    };
    checkPosts();
    const interval = setInterval(checkPosts, 3600000); // Check every hour
    return () => clearInterval(interval);
  }, [calendarPosts]);

  // Streak Milestone notification
  useEffect(() => {
    if (streak > prevStreak.current && streak > 0 && streak % 3 === 0) {
      addNotification({
        type: 'success',
        title: '🔥 Streak Increvable !',
        message: `Vous avez atteint ${streak} jours consécutifs !`
      });
    }
    prevStreak.current = streak;
  }, [streak]);

  // List Limits for Pagination
  const [prospectsLimit, setProspectsLimit] = useState(20);
  const [contentLimit, setContentLimit] = useState(20);
  const [invoicesLimit, setInvoicesLimit] = useState(20);

  // Real-time Data Listeners
  useEffect(() => {
    // Prospects with limit and order for pagination
    const qProspects = query(
      collection(db, 'prospects'), 
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
      limit(prospectsLimit)
    );
    const unsubProspects = onSnapshot(qProspects, (snap) => {
      const newProspects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect));
      setProspects(newProspects);
      if (!snap.metadata.hasPendingWrites && newProspects.length > prospectsCountRef.current && prospectsCountRef.current > 0) {
        addNotification({
          type: 'success',
          title: 'Nouveau Prospect',
          message: 'Un nouveau prospect a été injecté dans le pipeline.'
        });
      }
      prospectsCountRef.current = newProspects.length;
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'prospects'));

    const qTasks = query(
      collection(db, 'tasks'), 
      where('companyId', '==', companyId),
      orderBy('status', 'asc'),
      limit(50)
    );
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    const qContent = query(
      collection(db, 'content'), 
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
      limit(contentLimit)
    );
    const unsubContent = onSnapshot(qContent, (snap) => {
      setContent(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentPiece)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'content'));

    const qCalendar = query(
      collection(db, 'calendar_posts'), 
      where('companyId', '==', companyId),
      limit(50)
    );
    const unsubCalendar = onSnapshot(qCalendar, (snap) => {
      setCalendarPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarPost)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'calendar_posts'));

    const qMessages = query(
      collection(db, 'messages'), 
      where('companyId', '==', companyId),
      orderBy('timestamp', 'desc'),
      limit(30)
    );
    const unsubMessages = onSnapshot(qMessages, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages'));

    const qResearch = query(
      collection(db, 'research'), 
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsubResearch = onSnapshot(qResearch, (snap) => {
      setResearch(snap.docs.map(d => ({ id: d.id, ...d.data() } as ResearchItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'research'));

    const qInvoices = query(
      collection(db, 'invoices'), 
      where('companyId', '==', companyId),
      orderBy('date', 'desc'),
      limit(invoicesLimit)
    );
    const unsubInvoices = onSnapshot(qInvoices, (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'invoices'));

    const qTemplates = query(
      collection(db, 'templates'), 
      where('companyId', '==', companyId),
      limit(20)
    );
    const unsubTemplates = onSnapshot(qTemplates, (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'templates'));

    // Presence remains mostly the same
    const presenceDoc = doc(db, 'presence', sessionId);
    const updatePresence = async () => {
      try {
        await setDoc(presenceDoc, {
          lastActive: new Date().toISOString(),
          userId: userId,
          companyId: companyId
        }, { merge: true });
      } catch (err) {
        // Presence errors are secondary
      }
    };
    
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 30000);

    const qPresence = query(
      collection(db, 'presence'), 
      where('companyId', '==', companyId),
      limit(50)
    );
    const unsubPresence = onSnapshot(qPresence, (snap) => {
      const now = new Date().getTime();
      const active = snap.docs.filter(d => {
        const data = d.data();
        if (!data.lastActive) return false;
        const lastActive = new Date(data.lastActive).getTime();
        return now - lastActive < 90000;
      }).length;
      setOnlineUsers(active || 1);
    });

    return () => {
      unsubProspects();
      unsubTasks();
      unsubContent();
      unsubCalendar();
      unsubMessages();
      unsubResearch();
      unsubInvoices();
      unsubTemplates();
      unsubPresence();
      clearInterval(presenceInterval);
    };
  }, [prospectsLimit, contentLimit, invoicesLimit]);

  const analyzeProspectScore = async (prospect: Prospect, force = false) => {
    if (prospect.aiScore !== undefined && !force) return;
    try {
      addNotification({
        type: 'info',
        title: 'IA en action',
        message: `Analyse de ${prospect.name} en cours...`
      });
      const result = await analyzeProspect(prospect);
      await updateDoc(doc(db, 'prospects', prospect.id), {
        aiScore: result.score,
        aiRecommendation: result.recommendation
      });
      addNotification({
        type: 'success',
        title: 'Analyse terminée',
        message: `IA : Analyse terminée pour ${prospect.name}`
      });
    } catch (err) {
      console.error("AI Analysis error:", err);
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: task.status === 'done' ? 'pending' : 'done'
      });
      refreshStats();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const addProspect = async (data: any) => {
    try {
      await addDoc(collection(db, 'prospects'), {
        ...data,
        companyId: companyId,
        userId: userId,
        createdAt: new Date().toISOString(),
        status: 'new'
      });
      setIsModalOpen(false);
      refreshStats();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'prospects');
    }
  };

  const handleAddTaskToDate = (date: string) => {
    setSelectedDate(date);
    setModalType('task');
    setIsModalOpen(true);
  };

  const addTask = async (data: any) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        ...data,
        companyId: companyId,
        userId: userId,
        createdAt: new Date().toISOString(),
        status: 'pending',
        dueDate: data.dueDate || null
      });
      setIsModalOpen(false);
      addNotification({
        type: 'success',
        title: 'Tâche créée',
        message: data.title
      });
      refreshStats();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tasks');
    }
  };

  const addContent = async (data: any) => {
    try {
      if (data.id) {
        const { id, ...updateData } = data;
        await updateDoc(doc(db, 'content', id), updateData);
        addNotification({
          type: 'success',
          title: 'Contenu mis à jour',
          message: data.title
        });
      } else {
        await addDoc(collection(db, 'content'), {
          ...data,
          companyId: companyId,
          userId: userId,
          createdAt: new Date().toISOString()
        });
        addNotification({
          type: 'success',
          title: 'Contenu créé',
          message: data.title
        });
      }
      setIsModalOpen(false);
      setSelectedContentId(null);
      refreshStats();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'content');
    }
  };

  const addMessage = async (data: any) => {
    try {
      await addDoc(collection(db, 'messages'), {
        ...data,
        companyId: companyId,
        timestamp: new Date().toISOString(),
        sender: 'cm'
      });
      setIsModalOpen(false);
      addNotification({
        type: 'info',
        title: 'Message envoyé',
        message: `Destinataire : ${data.prospectId}`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  const addResearch = async (data: any) => {
    try {
      await addDoc(collection(db, 'research'), {
        ...data,
        companyId: companyId,
        userId: userId,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      addNotification({
        type: 'success',
        title: 'Recherche sauvegardée',
        message: data.keyword
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'research');
    }
  };

  const deleteProspect = async (id: string) => {
    const prospect = prospects.find(p => p.id === id);
    if (prospect) {
      setProspectToDelete(prospect);
      setModalType('confirmDelete');
      setIsModalOpen(true);
    }
  };

  const confirmDeleteProspect = async () => {
    if (!prospectToDelete) return;
    try {
      await deleteDoc(doc(db, 'prospects', prospectToDelete.id));
      addNotification({
        type: 'info',
        title: 'Prospect supprimé',
        message: prospectToDelete.name
      });
      setIsModalOpen(false);
      setProspectToDelete(null);
      refreshStats();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `prospects/${prospectToDelete.id}`);
    }
  };

  const updateProspectStatus = async (prospectId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'prospects', prospectId), {
        status: newStatus
      });
      addNotification({
        type: 'success',
        title: 'Statut mis à jour',
        message: `Le prospect est maintenant ${newStatus}.`
      });
      refreshStats();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `prospects/${prospectId}`);
    }
  };

  const reschedulePost = async (postId: string, newDate: string) => {
    try {
      await updateDoc(doc(db, 'calendar_posts', postId), {
        scheduledDate: newDate
      });
      addNotification({
        type: 'info',
        title: 'Calendrier mis à jour',
        message: 'La publication a été déplacée.'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `calendar_posts/${postId}`);
    }
  };

  const schedulePost = async (contentId: string, date: string, platforms: string[]) => {
    try {
      await addDoc(collection(db, 'calendar_posts'), {
        contentId,
        scheduledDate: date,
        platforms,
        companyId: companyId,
        userId: userId
      });
      await updateDoc(doc(db, 'content', contentId), { status: 'Scheduled' });
      addNotification({
        type: 'success',
        title: 'Planification réussie',
        message: 'Votre contenu a été ajouté au calendrier.'
      });
      refreshStats();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'calendar_posts');
    }
  };

  return (
    <ErrorBoundary>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1050] md:hidden animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo-area">
          <div className="logo-mark">AYOMEDIA</div>
          <div className="logo-sub">Espace de travail</div>
        </div>

        <div className="user-pill">
          <div className="avatar">CM</div>
          <div className="user-info">
            <div className="name">Ayo Manager</div>
            <div className="role">Community Manager HQ</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section">
            <div className="nav-label">Général</div>
            <NavItem active={activePage === 'dashboard'} onClick={() => setActivePage('dashboard')} icon={<LayoutDashboard size={16}/>} label="Tableau de bord" />
            <NavItem active={activePage === 'tasks'} onClick={() => setActivePage('tasks')} icon={<CheckSquare size={16}/>} label="Tâches du jour" badge={tasks.filter(t => t.status !== 'done').length} />
          </div>

          <div className="nav-section">
            <div className="nav-label">Opérations</div>
            <NavItem active={activePage === 'prospects'} onClick={() => setActivePage('prospects')} icon={<Users size={16}/>} label="Prospection" />
            <NavItem active={activePage === 'calendar'} onClick={() => setActivePage('calendar')} icon={<Calendar size={16}/>} label="Calendrier éditorial" />
            <NavItem active={activePage === 'content'} onClick={() => setActivePage('content')} icon={<FileText size={16}/>} label="Création de contenu" />
          </div>

          <div className="nav-section">
            <div className="nav-label">Support & Recherche</div>
            <NavItem active={activePage === 'messages'} onClick={() => setActivePage('messages')} icon={<MessageSquare size={16}/>} label="Service Client" />
            <NavItem active={activePage === 'research'} onClick={() => setActivePage('research')} icon={<Globe size={16}/>} label="Veille Marché" />
            <NavItem active={activePage === 'pricing'} onClick={() => setActivePage('pricing')} icon={<DollarSign size={16}/>} label="Tarification & Factures" />
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="day-stat">Objectif du jour : <span>85%</span> complété</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        <div className="topbar">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg text-[var(--ink-soft)]"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="page-title flex items-center gap-4">
              <div>
                {activePage === 'dashboard' && <>Aperçu <span>Général</span></>}
                {activePage === 'tasks' && <>Mes <span>Tâches</span></>}
                {activePage === 'prospects' && <>Pipeline <span>Prospects</span></>}
                {activePage === 'calendar' && <>Planning <span>Éditorial</span></>}
                {activePage === 'content' && <>Hub <span>Contenu</span></>}
                {activePage === 'messages' && <>Service <span>Client</span></>}
                {activePage === 'research' && <>Veille <span>Marché</span></>}
                {activePage === 'pricing' && <>Tarification & <span>Factures</span></>}
              </div>
              {isOffline ? (
                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold border border-red-200 animate-pulse">
                  MODE HORS LIGNE
                </span>
              ) : (
                <span className="text-[10px] hidden sm:flex bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold border border-emerald-200 items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  LIVE SYNC ({onlineUsers} {onlineUsers > 1 ? 'actifs' : 'actif'})
                </span>
              )}
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-date hidden lg:block">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            
            {isDemo ? (
              <button 
                onClick={() => {
                  localStorage.removeItem('skip_auth');
                  window.location.reload();
                }} 
                className="text-[10px] font-bold bg-[var(--gold)] text-white px-3 py-1.5 rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <LogIn size={14} />
                <span>Se Connecter</span>
              </button>
            ) : (
              <button 
                onClick={() => auth.signOut()}
                className="text-[10px] font-bold text-[var(--ink-soft)] hover:text-[var(--gold)] transition-colors"
              >
                Déconnexion
              </button>
            )}

            <NotificationCenter 
              notifications={notifications} 
              unreadCount={unreadCount} 
              onMarkAsRead={markAsRead} 
              onMarkAllAsRead={markAllAsRead} 
            />

            <button className="btn-gold hidden sm:block whitespace-nowrap shadow-sm" onClick={() => { setModalType('prospect'); setIsModalOpen(true); }}>+ Nouveau Prospect</button>
            <button className="sm:hidden btn-gold p-2 rounded-full shadow-sm" onClick={() => { setModalType('prospect'); setIsModalOpen(true); }}>
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="content">
          <div className="flex-1 overflow-x-hidden relative flex h-full">
            <div className={`flex-1 overflow-y-auto no-scrollbar transition-all ${isOutreachOpen ? 'mr-0 md:mr-4' : ''}`}>
              {activePage === 'dashboard' && (
                isDataLoading ? (
                  <div className="space-y-6">
                    <div className="metrics-row">
                      <SkeletonCard height="110px" hasHeader={false} />
                      <SkeletonCard height="110px" hasHeader={false} />
                      <SkeletonCard height="110px" hasHeader={false} />
                      <SkeletonCard height="110px" hasHeader={false} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <SkeletonCard height="300px" />
                      <SkeletonCard height="300px" />
                    </div>
                  </div>
                ) : (
                  <DashboardView 
                    prospects={prospects} 
                    tasks={tasks} 
                    analytics={realAnalytics} 
                    content={content}
                    calendarPosts={calendarPosts}
                    onToggleTask={toggleTask} 
                    onAddProspect={() => { setModalType('prospect'); setIsModalOpen(true); }}
                    streak={streak}
                    activities={activities}
                    onToggleActivity={toggleActivity}
                  />
                )
              )}
              {activePage === 'tasks' && <TasksView tasks={tasks} onToggleTask={toggleTask} onAddTask={() => { setModalType('task'); setIsModalOpen(true); }} />}
              {activePage === 'prospects' && (
                isDataLoading ? (
                  <div className="grid grid-cols-4 gap-4">
                    <SkeletonCard height="400px" />
                    <SkeletonCard height="400px" />
                    <SkeletonCard height="400px" />
                    <SkeletonCard height="400px" />
                  </div>
                ) : (
                  <ProspectsView 
                    prospects={prospects.slice(0, prospectsLimit)} 
                    onAdd={() => { setModalType('prospect'); setIsModalOpen(true); }} 
                    onDelete={deleteProspect} 
                    onUpdateStatus={updateProspectStatus}
                    onAnalyze={analyzeProspectScore}
                    onOpenOutreach={(p: Prospect) => { setSelectedProspectForOutreach(p); setIsOutreachOpen(true); }}
                    onLoadMore={() => setProspectsLimit(prev => prev + 20)}
                  />
                )
              )}
              {activePage === 'calendar' && (
                isDataLoading ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-xs z-10 flex items-center justify-center">
                      <Loader2 className="animate-spin text-[var(--gold)]" />
                    </div>
                    <CalendarView calendarPosts={calendarPosts} content={content} tasks={tasks} onReschedule={reschedulePost} onAddTaskToDate={handleAddTaskToDate} />
                  </div>
                ) : (
                  <CalendarView calendarPosts={calendarPosts} content={content} tasks={tasks} onReschedule={reschedulePost} onAddTaskToDate={handleAddTaskToDate} />
                )
              )}
              {activePage === 'content' && (
                isDataLoading ? (
                  <div className="grid grid-cols-3 gap-6">
                    <SkeletonCard height="240px" />
                    <SkeletonCard height="240px" />
                    <SkeletonCard height="240px" />
                  </div>
                ) : (
                  <ContentView 
                    content={content.slice(0, contentLimit)} 
                    onAdd={() => { setSelectedContentId(null); setModalType('post'); setIsModalOpen(true); }} 
                    onSchedule={(id: string) => { setSelectedContentId(id); setModalType('schedule'); setIsModalOpen(true); }} 
                    onEdit={(c: any) => { setSelectedContentId(c.id); setModalType('post'); setIsModalOpen(true); }} 
                    onLoadMore={() => setContentLimit(prev => prev + 20)}
                  />
                )
              )}
              {activePage === 'messages' && (
                <MessagesView 
                  messages={messages} 
                  prospects={prospects} 
                  onSendMessage={(pid: string) => { 
                    setSelectedProspectId(pid); 
                    setModalType('message'); 
                    setIsModalOpen(true); 
                  }} 
                />
              )}
              {activePage === 'research' && (
                <ResearchView 
                  research={research} 
                  onAdd={() => { 
                    setModalType('research'); 
                    setIsModalOpen(true); 
                  }} 
                />
              )}
              {activePage === 'pricing' && (
                <PricingPage 
                  invoices={invoices.slice(0, invoicesLimit)} 
                  companyId={companyId} 
                  userId={userId} 
                  addNotification={addNotification} 
                  onLoadMore={() => setInvoicesLimit(prev => prev + 20)}
                  onRefreshStats={refreshStats}
                />
              )}
            </div>

            {isOutreachOpen && (
              <OutreachPanel 
                prospect={selectedProspectForOutreach} 
                onClose={() => setIsOutreachOpen(false)}
                onSaveTemplate={async (t: any) => {
                  try {
                    await addDoc(collection(db, 'templates'), { ...t, companyId: companyId, userId: userId, createdAt: new Date().toISOString() });
                    addNotification({
                      type: 'success',
                      title: 'Template enregistré',
                      message: t.name
                    });
                  } catch (err) {
                    handleFirestoreError(err, OperationType.WRITE, 'templates');
                  }
                }}
              />
            )}
          </div>
        </div>
      </main>

      {/* Notifications / Toasts for immediate feedback - Moved to bottom to avoid Topbar overlap */}
      <div className="fixed bottom-5 right-5 z-[2000] space-y-2 pointer-events-none">
        {notifications.filter(n => !n.read).slice(0, 3).map((n) => (
          <div key={n.id} className={`notif shadow-2xl border-l-4 animate-in slide-in-from-right duration-300 pointer-events-auto bg-white ${
            n.type === 'success' ? 'border-emerald-500' : 
            n.type === 'warning' ? 'border-amber-500' : 
            n.type === 'error' ? 'border-red-500' : 'border-blue-500'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-full ${
                n.type === 'success' ? 'bg-emerald-50' : 
                n.type === 'warning' ? 'bg-amber-50' : 
                n.type === 'error' ? 'bg-red-50' : 'bg-blue-50'
              }`}>
                {n.type === 'success' ? <Check size={12} className="text-emerald-500" /> : <Info size={12} className={n.type === 'error' ? 'text-red-500' : 'text-blue-500'} />}
              </div>
              <div className="text-xs font-bold text-[var(--ink)]">{n.title}</div>
            </div>
            <div className="text-[10px] mt-1 opacity-80 text-[var(--ink-soft)] px-6">{n.message}</div>
          </div>
        ))}
      </div>

      {/* Gemini Chatbot Trigger */}
      <button 
        className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--gold)] text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-[1500]"
        onClick={() => setIsChatOpen(true)}
      >
        <Bot size={28} />
      </button>

      {/* Gemini Chatbot Window */}
      {isChatOpen && (
        <GeminiChatbot 
          history={chatHistory} 
          setHistory={setChatHistory} 
          onClose={() => setIsChatOpen(false)} 
        />
      )}

      {/* Modal Overlay */}
      <div className={`modal-overlay ${isModalOpen ? 'open' : ''}`} onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-title">
            {modalType === 'prospect' ? 'Nouveau Prospect' : 
             modalType === 'task' ? 'Nouvelle Tâche' : 
             modalType === 'post' ? 'Nouveau Contenu' :
             modalType === 'message' ? 'Envoyer un Message' : 
             modalType === 'confirmDelete' ? 'Confirmer la Suppression' : 'Nouvelle Recherche'}
          </div>
          <div className="modal-sub">
            {modalType === 'confirmDelete' 
              ? `Êtes-vous sûr de vouloir supprimer le prospect "${prospectToDelete?.name}" ? Cette action est irréversible.` 
              : 'Remplissez les informations pour mettre à jour votre espace.'}
          </div>
          
          {modalType === 'prospect' && <ProspectForm onSubmit={addProspect} onCancel={() => setIsModalOpen(false)} />}
          {modalType === 'task' && <TaskForm onSubmit={addTask} onCancel={() => { setIsModalOpen(false); setSelectedDate(null); }} initialDate={selectedDate} />}
          {modalType === 'post' && <ContentForm onSubmit={addContent} onCancel={() => { setIsModalOpen(false); setSelectedContentId(null); }} initialData={selectedContentId ? content.find(c => c.id === selectedContentId) : null} />}
          {modalType === 'message' && <MessageForm prospectId={selectedProspectId} onSubmit={addMessage} onCancel={() => setIsModalOpen(false)} />}
          {modalType === 'research' && <ResearchForm onSubmit={addResearch} onCancel={() => setIsModalOpen(false)} />}
          {modalType === 'schedule' && <ScheduleForm contentId={selectedContentId} onSubmit={schedulePost} onCancel={() => setIsModalOpen(false)} />}
          {modalType === 'confirmDelete' && (
            <div className="flex justify-end gap-3 mt-6">
              <button className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] hover:bg-[var(--surface-warm)] transition-colors" onClick={() => setIsModalOpen(false)}>Annuler</button>
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors" onClick={confirmDeleteProspect}>Supprimer</button>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Components ---

function NotificationCenter({ 
  notifications, 
  unreadCount, 
  onMarkAsRead, 
  onMarkAllAsRead 
}: { 
  notifications: AppNotification[], 
  unreadCount: number, 
  onMarkAsRead: (id: string) => void, 
  onMarkAllAsRead: () => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check size={14} className="text-emerald-500" />;
      case 'warning': return <AlertCircle size={14} className="text-amber-500" />;
      case 'error': return <X size={14} className="text-red-500" />;
      default: return <Info size={14} className="text-blue-500" />;
    }
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return "À l'instant";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        className="relative p-2 hover:bg-gray-100 rounded-full text-[var(--ink-soft)] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="text-xs font-bold text-[var(--ink)]">Notifications</span>
            <button 
              className="text-[10px] text-[var(--gold)] hover:underline"
              onClick={() => { onMarkAllAsRead(); setIsOpen(false); }}
            >
              Tout marquer comme lu
            </button>
          </div>
          <div className="notif-list custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.slice(0, 5).map(n => (
                <div 
                  key={n.id} 
                  className={`notif-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => onMarkAsRead(n.id)}
                >
                  <div className={`notif-icon ${
                    n.type === 'success' ? 'bg-emerald-50' : 
                    n.type === 'warning' ? 'bg-amber-50' : 
                    n.type === 'error' ? 'bg-red-50' : 'bg-blue-50'
                  }`}>
                    {getIcon(n.type)}
                  </div>
                  <div className="notif-content">
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-msg">{n.message}</div>
                    <div className="notif-time">{getRelativeTime(n.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          {notifications.length > 5 && (
            <div className="p-3 text-center border-t border-[var(--border-soft)]">
              <button className="text-[10px] text-gray-400 hover:text-[var(--gold)]">Voir tout</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub-Views ---

const DeadlineTimer = ({ date }: { date: string }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      let deadline = new Date(date);
      
      if (date.length <= 10) {
        deadline = new Date(date + 'T23:59:59');
      }

      const diff = deadline.getTime() - now.getTime();
      
      if (diff < 0) {
        setIsOverdue(true);
        const absDiff = Math.abs(diff);
        const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
        if (days > 0) {
          setTimeLeft(`En retard de ${days}j`);
        } else {
          setTimeLeft(`En retard`);
        }
      } else {
        setIsOverdue(false);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
          setTimeLeft(`Dans ${days}j`);
        } else if (hours > 0) {
          setTimeLeft(`Dans ${hours}h`);
        } else {
          setTimeLeft(`Dans ${minutes}m`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [date]);

  if (!timeLeft) return null;

  return (
    <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${isOverdue ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
      {timeLeft}
    </span>
  );
};

const DashboardView = ({ prospects = [], tasks = [], analytics, content = [], calendarPosts = [], onToggleTask, onAddProspect, streak = 0, activities = {}, onToggleActivity }: any) => {
  console.log("DashboardView Rendering...", { prospects, tasks, analytics });
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const generatePdfReport = async () => {
    setIsGeneratingPdf(true);
    try {
      const dashboardElement = document.getElementById('dashboard-content');
      if (!dashboardElement) return;

      const canvas = await html2canvas(dashboardElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Rapport_Performance_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const leadsData = useMemo(() => {
    if (!analytics?.leadsPerSource) return [];
    return Object.entries(analytics.leadsPerSource).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const performanceData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: 'Réponse', value: Math.round(analytics.responseRate || 0) },
      { name: 'Conversion', value: Math.round(analytics.conversionRate || 0) },
    ];
  }, [analytics]);

  const trendData = useMemo(() => analytics?.prospectsTrend || [], [analytics]);

  const COLORS = ['#D4AF37', '#378ADD', '#1D9E75', '#E63946', '#F1FAEE'];

  const bestSource = useMemo(() => {
    if (!analytics?.leadsPerSource) return null;
    return Object.entries(analytics.leadsPerSource).sort((a: any, b: any) => b[1] - a[1])[0];
  }, [analytics]);

  const stats = [
    { label: 'Total Prospects', value: analytics?.totalProspects || 0, sub: `+${analytics?.newProspectsThisMonth || 0} ce mois`, icon: '👥' },
    { label: 'Meilleure Source', value: bestSource ? bestSource[0] : 'N/A', sub: `${bestSource ? bestSource[1] : 0} prospects`, icon: '🔥' },
    { label: 'Taux de réponse', value: `${Math.round(analytics?.responseRate || 0)}%`, sub: 'Real-time', icon: '💬' },
    { label: 'Conversion', value: `${Math.round(analytics?.conversionRate || 0)}%`, sub: 'Objectif: 15%', icon: '🚀' },
  ];

  return (
    <div id="dashboard-content" className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-serif font-bold text-[var(--ink)]">Performance Opérationnelle</h2>
        <button 
          onClick={generatePdfReport}
          disabled={isGeneratingPdf}
          className="btn-outline text-xs flex items-center gap-2"
        >
          {isGeneratingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exporter Rapport PDF
        </button>
      </div>

      <div className="metrics-row">
        {stats.map((s, i) => (
          <div key={i} className="metric-card">
            <div className="metric-icon">{s.icon}</div>
            <div className="metric-label">{s.label}</div>
            <div className="metric-value">{s.value}</div>
            <div className="metric-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-1 section-card bg-gradient-to-br from-[var(--ink)] to-[#2D2A25] text-white border-none flex flex-col justify-center items-center text-center p-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[var(--gold)] opacity-0 group-hover:opacity-5 transition-opacity"></div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 mx-auto border border-white/20">
              <Zap size={32} className="text-[var(--gold)]" />
            </div>
            <div className="text-sm font-bold uppercase tracking-widest text-[var(--ink-faint)] mb-1">Prospect Streak</div>
            <div className="text-5xl font-serif text-[var(--gold)] mb-2">{streak}</div>
            <div className="text-[10px] uppercase opacity-40">Jours consécutifs</div>
          </div>
        </div>

        <div className="lg:col-span-3 section-card">
          <div className="section-head">
            <div className="section-title">Checklist Activity Day</div>
            <div className="text-[10px] text-[var(--ink-soft)] font-medium bg-[var(--surface-warm)] px-2 py-1 rounded capitalize">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'whatsapp', label: 'Check WhatsApp & DMs', icon: <MessageCircle size={14} /> },
              { id: 'comments', label: 'Répondre aux commentaires', icon: <MessageSquare size={14} /> },
              { id: 'prospecting', label: 'Session Prospection Active', icon: <Search size={14} /> },
              { id: 'posting', label: 'Vérifier les publications', icon: <Share2 size={14} /> }
            ].map(act => (
              <div 
                key={act.id} 
                onClick={() => onToggleActivity(act.id)}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${activities[act.id] ? 'bg-emerald-50 border-emerald-200 opacity-60' : 'bg-white border-[var(--border)] hover:border-[var(--gold)]'}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${activities[act.id] ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--ink-faint)]'}`}>
                  {activities[act.id] && <Check size={12} className="text-white" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className={activities[act.id] ? 'text-emerald-700' : 'text-[var(--ink-soft)]'}>{act.icon}</span>
                  <span className={`text-xs font-medium ${activities[act.id] ? 'text-emerald-800 line-through' : 'text-[var(--ink)]'}`}>{act.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 section-card">
          <div className="section-head">
            <div className="section-title">Croissance des Prospects (7 jours)</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--gold)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                <Area type="monotone" dataKey="count" stroke="var(--gold)" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Répartition des Sources</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadsData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {leadsData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Performance Globale (%)</div>
            <TrendingUp size={16} className="text-[var(--gold)]" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {performanceData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#378ADD' : '#1D9E75'} />
                  ))}
                  <LabelList dataKey="value" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 12, fontWeight: 600, fill: '#333' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Tâches prioritaires</div>
            <button className="section-action">Voir tout</button>
          </div>
          <div className="task-list">
            {tasks.filter((t: any) => t.status !== 'done').slice(0, 5).map((t: any) => (
              <div key={t.id} className="task-item" onClick={() => onToggleTask(t)}>
                <div className="task-cb" />
                <div className="task-info flex-1">
                  <div className="task-label">{t.title}</div>
                  {t.dueDate && (
                    <div className="text-[10px] text-[var(--ink-soft)] flex items-center gap-1">
                      <Clock size={10} /> {new Date(t.dueDate).toLocaleDateString()}
                      <DeadlineTimer date={t.dueDate} />
                    </div>
                  )}
                </div>
                <div className={`task-tag tag-${t.tag?.toLowerCase() || 'prosp'}`}>{t.tag || 'PROSP'}</div>
              </div>
            ))}
            {tasks.filter((t: any) => t.status !== 'done').length === 0 && (
              <div className="py-8 text-center text-[var(--ink-faint)] text-sm">Toutes les tâches sont terminées ! ✨</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Derniers Prospects</div>
            <button className="section-action" onClick={onAddProspect}>+ Ajouter</button>
          </div>
          <table className="prospects-table">
            <thead>
              <tr>
                <th>NOM / PAGE</th>
                <th>SOURCE</th>
                <th>DATE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {prospects.slice(0, 5).map((p: any) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><span className="source-chip">{p.source}</span></td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className={`status-badge st-${p.status === 'new' ? 'new' : p.status === 'contacted' ? 'contact' : 'hot'}`}>
                      <div className="s-dot"></div> {p.status === 'new' ? 'Nouveau' : p.status === 'contacted' ? 'Contacté' : 'Intéressé'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Actions Rapides</div>
          </div>
          <div className="quick-actions">
            <button className="qa-btn">
              <div className="qa-icon" style={{ background: 'rgba(55,138,221,0.1)', color: '#378ADD' }}><MessageSquare size={16}/></div>
              <div className="qa-text">
                <div className="qt">Relancer prospects</div>
                <div className="qs">3 prospects en attente</div>
              </div>
            </button>
            <button className="qa-btn" onClick={generatePdfReport} disabled={isGeneratingPdf}>
              <div className="qa-icon" style={{ background: 'rgba(29,158,117,0.1)', color: '#1D9E75' }}>
                {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16}/>}
              </div>
              <div className="qa-text">
                <div className="qt">Rapport Performance</div>
                <div className="qs">{isGeneratingPdf ? 'Génération...' : 'Télécharger PDF'}</div>
              </div>
            </button>
            <button className="qa-btn">
              <div className="qa-icon" style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}><Calendar size={16}/></div>
              <div className="qa-text">
                <div className="qt">Planning Reels</div>
                <div className="qs">Session de tournage</div>
              </div>
            </button>
            <button className="qa-btn">
              <div className="qa-icon" style={{ background: 'rgba(239,159,39,0.1)', color: '#EF9F27' }}><Bell size={16}/></div>
              <div className="qa-text">
                <div className="qt">Alertes Inbox</div>
                <div className="qs">12 nouveaux messages</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Calendar Day Sub-component ---
function CalendarDay({ day, month, year, isToday, dayPosts, dayTasks, dragOver, content, onDragStart, onDragOver, onDragLeave, onDrop, onAddTaskToDate, isWide }: any) {
  return (
    <div 
      className={`cal-cell group ${isToday ? 'today' : ''} ${dragOver ? 'bg-[var(--surface-warm)] border-[var(--gold)]' : ''} ${isWide ? 'min-h-[200px]' : ''}`}
      onDragOver={(e) => onDragOver(e, { d: day, m: month, y: year })}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, { d: day, m: month, y: year })}
    >
      <div className="flex justify-between items-center mb-1">
        <button 
          className="opacity-0 group-hover:opacity-100 text-[var(--gold)] hover:bg-[var(--surface-warm)] rounded p-1 transition-all"
          onClick={() => onAddTaskToDate(`${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T10:00:00Z`)}
          title="Ajouter une tâche"
        >
          <Plus size={12} />
        </button>
        <span className={`w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[var(--gold)] text-white' : ''}`}>
          {day}
          {isWide && <span className="ml-1 text-[8px] font-normal opacity-50">{new Date(year, month, day).toLocaleString('fr-FR', { weekday: 'short' })}</span>}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto no-scrollbar">
        {dayPosts.map((p: any) => {
          const item = content.find((c: any) => c.id === p.contentId);
          return (
            <div 
              key={p.id} 
              draggable={true}
              onDragStart={(e) => onDragStart(e, p.id)}
              className="w-full bg-white border border-[var(--border)] rounded p-1.5 cursor-move hover:border-[var(--gold)] transition-all shadow-sm flex flex-col gap-1"
              title={item?.title || 'Contenu inconnu'}
            >
              <div className="text-[10px] font-medium text-[var(--ink)] truncate">{item?.title || 'Contenu'}</div>
              <div className="flex gap-1 items-center">
                {p.platforms?.includes('IG') && <Instagram size={10} className="text-[#E1306C]" />}
                {p.platforms?.includes('TikTok') && <Video size={10} className="text-black" />}
                {p.platforms?.includes('FB') && <Facebook size={10} className="text-[#1877F2]" />}
              </div>
            </div>
          );
        })}
        {dayTasks.map((t: any) => (
          <div 
            key={t.id} 
            className={`w-full border rounded p-1.5 shadow-sm flex flex-col gap-1 ${t.status === 'done' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-blue-50 border-blue-200'}`}
            title={t.title}
          >
            <div className={`text-[10px] font-medium truncate ${t.status === 'done' ? 'line-through text-gray-500' : 'text-blue-800'}`}>
              {t.title}
            </div>
            <div className="text-[8px] font-bold text-blue-600 uppercase">{t.tag || 'TÂCHE'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TasksView = ({ tasks = [], onToggleTask, onAddTask }: any) => {
  const [search, setSearch] = useState('');
  const filtered = (tasks || []).filter((t: any) => t.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="section-card">
        <div className="section-head flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="section-title">Liste des Tâches</div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Rechercher..." 
              className="text-xs p-2 border rounded bg-[var(--surface-warm)] flex-1 sm:w-48"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn-gold whitespace-nowrap px-4" onClick={onAddTask}>+ Tâche</button>
          </div>
        </div>
        <div className="space-y-2">
          {filtered.map((t: any) => (
            <div key={t.id} className={`task-item ${t.status === 'done' ? 'done' : ''}`} onClick={() => onToggleTask(t)}>
              <div className="task-cb" />
              <div className="task-info flex-1">
                <div className="task-label">{t.title}</div>
                {t.dueDate && (
                  <div className="text-[10px] text-[var(--ink-soft)] flex items-center gap-1">
                    <Clock size={10} /> Échéance : {new Date(t.dueDate).toLocaleDateString()}
                    <DeadlineTimer date={t.dueDate} />
                  </div>
                )}
              </div>
              <div className={`task-tag tag-${t.tag?.toLowerCase() || 'prosp'}`}>{t.tag || 'PROSP'}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-[var(--ink-faint)] italic text-sm">Aucune tâche trouvée.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProspectsView = ({ prospects = [], onAdd, onDelete, onUpdateStatus, onAnalyze, onOpenOutreach, onLoadMore }: any) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [mobileActiveStatus, setMobileActiveStatus] = useState('new');
  
  const filtered = (prospects || []).filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const onDragStart = (e: React.DragEvent, prospectId: string) => {
    e.dataTransfer.setData('text/plain', prospectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const onDragLeave = () => {
    setDragOverStatus(null);
  };

  const onDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverStatus(null);
    const prospectId = e.dataTransfer.getData('text/plain');
    if (!prospectId) return;
    onUpdateStatus(prospectId, status);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
          {['all', 'new', 'contacted', 'interested', 'closed', 'cold'].map(status => (
            <button 
              key={status} 
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-[var(--gold)] text-white' : 'bg-white border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--surface-warm)]'}`}
              onClick={() => {
                setFilterStatus(status);
                if (status !== 'all') setMobileActiveStatus(status);
              }}
            >
              {status === 'all' ? 'Tous' : status === 'new' ? 'Nouveaux' : status === 'contacted' ? 'Contactés' : status === 'interested' ? 'Chauds' : status === 'closed' ? 'Clôturés' : 'Froids'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 relative w-full sm:w-auto">
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="text-sm p-2 pr-8 border rounded bg-white w-full sm:w-64 shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button 
              className="absolute right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="kanban h-[calc(100vh-320px)] md:h-[calc(100vh-320px)]">
        {['new', 'contacted', 'interested', 'closed', 'cold'].map(status => (
          <div 
            key={status} 
            className={`kanban-col ${mobileActiveStatus === status ? 'active-mobile' : ''} ${dragOverStatus === status ? 'bg-[var(--surface)] border-[var(--gold)]' : ''}`}
            onDragOver={(e) => onDragOver(e, status)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, status)}
          >
            <div className="kanban-col-title">
              {status === 'new' ? 'Nouveaux' : status === 'contacted' ? 'Contactés' : status === 'interested' ? 'Chauds' : status === 'closed' ? 'Clôturés' : 'Froids'}
              <span className="kcol-count">{filtered.filter((p: any) => p?.status === status).length}</span>
            </div>
            {filtered.filter((p: any) => p?.status === status).map((p: any) => (
              <div 
                key={p.id} 
                draggable={true}
                onDragStart={(e) => onDragStart(e, p.id)}
                className="kanban-card group cursor-move relative"
                onClick={() => onOpenOutreach(p)}
              >
                <div className="flex justify-between items-start">
                  <div className="cn">{p.name}</div>
                  <div className="flex items-center gap-1">
                    <button 
                      className="opacity-0 group-hover:opacity-100 p-1 text-[var(--gold)] hover:bg-[var(--gold)]/10 rounded transition-all"
                      onClick={(e) => { e.stopPropagation(); onAnalyze(p); }}
                      title="Analyser avec IA"
                    >
                      <Sparkles size={12} />
                    </button>
                    <button 
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                      onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                
                {p.aiScore !== undefined && (
                  <div className="my-2 group/score relative">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${p.aiScore > 75 ? 'bg-emerald-500' : p.aiScore > 40 ? 'bg-amber-500' : 'bg-red-500'}`} 
                          style={{width: `${p.aiScore}%`}} 
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${p.aiScore > 75 ? 'text-emerald-600' : p.aiScore > 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {p.aiScore}%
                      </span>
                    </div>
                    {p.aiRecommendation && (
                      <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-[var(--ink)] text-white text-[9px] rounded-lg opacity-0 group-hover/score:opacity-100 transition-opacity z-10 shadow-xl pointer-events-none">
                        <Sparkles size={10} className="text-[var(--gold)] mb-1" />
                        "{p.aiRecommendation}"
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className="cs mb-0">{p.source}</div>
                  {p.tag && (
                    <div className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-warm)] text-[var(--gold)] border border-[var(--gold)]">
                      {p.tag}
                    </div>
                  )}
                </div>
                <div className="cd">
                  <div className="ct">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Date inconnue'}</div>
                  <ChevronRight size={12} className="text-[var(--gold)] opacity-50" />
                </div>
              </div>
            ))}
            <button className="add-card-btn" onClick={onAdd}>+ Ajouter</button>
          </div>
        ))}
      </div>
      <div className="flex justify-center pt-2">
        <button 
          className="text-xs font-bold text-[var(--gold)] hover:underline flex items-center gap-1"
          onClick={onLoadMore}
        >
          Visualiser plus de prospects
        </button>
      </div>
    </div>
  );
};

const OutreachPanel = ({ prospect, onClose, onSaveTemplate }: any) => {
  const [tone, setTone] = useState('Professionnel');
  const [niche, setNiche] = useState('E-commerce');
  const [messages, setMessages] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'initial' | 'relance1' | 'relance2'>('initial');

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateOutreachMessages(prospect.name, niche, tone);
      setMessages(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Use non-blocking feedback instead of alert
    console.log("Message copié");
  };

  return (
    <div className="w-80 bg-white border-l border-[var(--border)] h-full flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[#FAF9F6]">
        <div>
          <h3 className="font-serif font-bold text-[var(--ink)]">Assistant Outreach</h3>
          <p className="text-[10px] text-[var(--ink-soft)] uppercase tracking-widest">{prospect?.name}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1 block">Niche / Secteur</label>
            <input 
              className="w-full text-xs p-2 border rounded bg-[var(--surface-warm)] focus:border-[var(--gold)] outline-none" 
              value={niche} 
              onChange={e => setNiche(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1 block">Ton du message</label>
            <select 
              className="w-full text-xs p-2 border rounded bg-[var(--surface-warm)] focus:border-[var(--gold)] outline-none"
              value={tone}
              onChange={e => setTone(e.target.value)}
            >
              <option>Professionnel</option>
              <option>Amical</option>
              <option>Direct</option>
              <option>Humoristique</option>
            </select>
          </div>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full btn-gold flex items-center justify-center gap-2 py-2"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isGenerating ? 'Rédaction...' : 'Générer Messages AI'}
          </button>
        </div>

        {messages && (
          <div className="space-y-4 border-t pt-4 border-[var(--border)]">
            <div className="flex gap-1">
              {['initial', 'relance1', 'relance2'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 py-1 px-2 border rounded text-[9px] font-bold uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-[var(--gold)] text-white border-[var(--gold)]' : 'bg-white text-[var(--ink-soft)] hover:bg-gray-50'}`}
                >
                  {tab === 'initial' ? 'Initial' : tab === 'relance1' ? 'Relance 1' : 'Relance 2'}
                </button>
              ))}
            </div>

            <div className="relative group">
              <textarea 
                readOnly 
                className="w-full h-48 text-xs p-3 bg-[var(--surface-warm)] border rounded-lg resize-none italic leading-relaxed text-[var(--ink)]"
                value={(messages as any)[activeTab]}
              />
              <button 
                onClick={() => copyToClipboard((messages as any)[activeTab])}
                className="absolute bottom-2 right-2 p-1.5 bg-white shadow-md border rounded text-[var(--gold)] hover:scale-110 transition-transform"
                title="Copier"
              >
                <Copy size={12} />
              </button>
            </div>

            <button 
              onClick={() => onSaveTemplate({ title: `Outreach ${tone} - ${niche}`, content: (messages as any)[activeTab], type: 'email' })}
              className="w-full btn-outline text-[10px] py-1.5 font-bold flex items-center justify-center gap-2"
            >
              <FilePlus size={12} /> Enregistrer comme Template
            </button>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 border-t text-[9px] text-[var(--ink-faint)] italic leading-tight">
        L'IA génère des messages basés sur les meilleures pratiques de prospection en Afrique.
      </div>
    </div>
  );
};

const CalendarView = ({ calendarPosts = [], content = [], tasks = [], onReschedule, onAddTaskToDate }: any) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setViewMode('week');
      else setViewMode('month');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [dragOverDay, setDragOverDay] = useState<{d: number, m: number, y: number} | null>(null);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const startOffset = (firstDayOfMonth + 6) % 7; // Adjust to Mon-Sun (0-6)

  const getItemsForDate = (d: number, m: number, y: number) => {
    const dateStr = `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    const dayPosts = (calendarPosts || []).filter((p: any) => p?.scheduledDate?.startsWith(dateStr));
    const dayTasks = (tasks || []).filter((t: any) => t?.dueDate?.startsWith(dateStr));
    return { dayPosts, dayTasks };
  };

  const onDragStart = (e: React.DragEvent, postId: string) => {
    e.dataTransfer.setData('text/plain', postId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, date: {d: number, m: number, y: number}) => {
    e.preventDefault();
    setDragOverDay(date);
  };

  const onDrop = (e: React.DragEvent, date: {d: number, m: number, y: number}) => {
    e.preventDefault();
    setDragOverDay(null);
    const postId = e.dataTransfer.getData('text/plain');
    if (!postId) return;
    const newDate = `${date.y}-${(date.m + 1).toString().padStart(2, '0')}-${date.d.toString().padStart(2, '0')}T10:00:00Z`;
    onReschedule(postId, newDate);
  };

  const changeView = (offset: number) => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + offset, 1));
    } else {
      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + offset * 7);
      setCurrentDate(nextDate);
    }
  };

  const getWeekDays = () => {
    const day = currentDate.getDay(); // 0-6
    const diff = currentDate.getDate() - (day === 0 ? 6 : day - 1); // Adjust to Monday
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(diff);
    
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return { d: d.getDate(), m: d.getMonth(), y: d.getFullYear() };
    });
  };

  const monthName = viewMode === 'month' 
    ? currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
    : `Semaine du ${getWeekDays()[0].d} ${new Date(getWeekDays()[0].y, getWeekDays()[0].m).toLocaleString('fr-FR', { month: 'short' })}`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="section-card">
        <div className="section-head">
          <div className="section-title capitalize">{monthName}</div>
          <div className="flex gap-2">
            <button className="section-action p-1.5" onClick={() => changeView(-1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="section-action p-1.5" onClick={() => changeView(1)}>
              <ChevronRight size={16} />
            </button>
            <button 
              className="section-action hidden sm:block" 
              onClick={() => setViewMode(viewMode === 'month' ? 'week' : 'month')}
            >
              {viewMode === 'month' ? 'Vue Semaine' : 'Vue Mois'}
            </button>
          </div>
        </div>
        <div className="cal-days-header">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d} className="cal-dname">{d}</div>)}
        </div>
        <div className="cal-grid">
          {viewMode === 'month' ? (
            <>
              {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} className="cal-cell empty"></div>)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const { dayPosts, dayTasks } = getItemsForDate(d, month, year);
                const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                return (
                  <CalendarDay 
                    key={d}
                    day={d}
                    month={month}
                    year={year}
                    isToday={isToday}
                    dayPosts={dayPosts}
                    dayTasks={dayTasks}
                    dragOver={dragOverDay?.d === d && dragOverDay?.m === month}
                    content={content}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDragLeave={() => setDragOverDay(null)}
                    onDrop={onDrop}
                    onAddTaskToDate={onAddTaskToDate}
                  />
                );
              })}
            </>
          ) : (
            getWeekDays().map(date => {
              const { dayPosts, dayTasks } = getItemsForDate(date.d, date.m, date.y);
              const isToday = date.d === new Date().getDate() && date.m === new Date().getMonth() && date.y === new Date().getFullYear();
              return (
                <CalendarDay 
                  key={`${date.y}-${date.m}-${date.d}`}
                  day={date.d}
                  month={date.m}
                  year={date.y}
                  isToday={isToday}
                  dayPosts={dayPosts}
                  dayTasks={dayTasks}
                  dragOver={dragOverDay?.d === date.d && dragOverDay?.m === date.m}
                  content={content}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={onDrop}
                  onAddTaskToDate={onAddTaskToDate}
                  isWide={true}
                />
              );
            })
          )}
        </div>
      </div>
      
      <div className="mt-8 section-card">
        <div className="section-title mb-4">Prochains rendez-vous éditoriaux</div>
        <div className="space-y-3">
          {calendarPosts
            .filter((p: any) => new Date(p.scheduledDate) >= new Date(new Date().setHours(0,0,0,0)))
            .sort((a: any, b: any) => a.scheduledDate.localeCompare(b.scheduledDate))
            .map((p: any) => {
            const item = content.find((c: any) => c.id === p.contentId);
            return (
              <div 
                key={p.id} 
                draggable={true}
                onDragStart={(e) => onDragStart(e, p.id)}
                className="flex items-center justify-between p-3 bg-white border border-[var(--border)] rounded-lg shadow-sm cursor-move hover:border-[var(--gold)] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--surface-warm)] rounded flex items-center justify-center">
                    {item?.type === 'reel' ? '🎬' : item?.type === 'image' ? '🖼️' : '✨'}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{item?.title || 'Contenu inconnu'}</div>
                    <div className="text-xs text-[var(--ink-soft)] flex items-center gap-1">
                      {new Date(p.scheduledDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      <DeadlineTimer date={p.scheduledDate} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {p.platforms?.map((plat: string) => (
                    <div key={plat} className="text-[10px] font-bold text-[var(--gold)] border border-[var(--gold)] px-1 rounded">{plat}</div>
                  ))}
                </div>
              </div>
            );
          })}
          {calendarPosts.length === 0 && (
            <div className="text-center py-6 text-[var(--ink-faint)] text-sm italic">Aucun post planifié pour le moment.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const ContentView = ({ content = [], onAdd, onSchedule, onEdit, onLoadMore }: any) => {
  const [filter, setFilter] = useState('all');
  const filtered = (content || []).filter((c: any) => filter === 'all' || c.category === filter || c.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
          {['all', 'Informative', 'Entertainment', 'Promotional', 'Idea', 'Draft', 'Scheduled', 'Published'].map(f => (
            <button 
              key={f} 
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-[var(--gold)] text-white' : 'bg-white border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--surface-warm)]'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Tout' : f}
            </button>
          ))}
        </div>
        <button className="btn-gold w-full sm:w-auto" onClick={onAdd}>+ Nouveau Contenu</button>
      </div>

      <div className="content-grid">
        {filtered.map((c: any) => (
          <div key={c.id} className="content-card group">
            <div className={`content-thumb ct-${c.type}`}>
              {c.type === 'reel' ? '🎬' : c.type === 'image' ? '🖼️' : c.type === 'video' ? '📹' : '✨'}
              <div className="absolute top-2 right-2 flex gap-1">
                <div className={`text-[8px] px-1.5 py-0.5 rounded-full text-white font-bold uppercase ${c.status === 'Published' ? 'bg-green-500' : c.status === 'Scheduled' ? 'bg-blue-500' : 'bg-orange-500'}`}>
                  {c.status}
                </div>
              </div>
            </div>
            <div className="content-body">
              <div className="flex justify-between items-start mb-1">
                <div className="content-type">{c.category} · {c.type}</div>
                <div className="flex gap-2">
                  <button 
                    className="text-[10px] text-[var(--ink-soft)] hover:text-[var(--ink)] font-medium"
                    onClick={(e) => { e.stopPropagation(); onEdit(c); }}
                  >
                    Modifier
                  </button>
                  {c.status !== 'Scheduled' && c.status !== 'Published' && (
                    <button 
                      className="text-[10px] text-[var(--gold)] hover:underline font-bold"
                      onClick={(e) => { e.stopPropagation(); onSchedule(c.id); }}
                    >
                      Planifier
                    </button>
                  )}
                </div>
              </div>
              <div className="content-name">{c.title}</div>
              <div className="content-desc line-clamp-2">{c.description}</div>
              {c.caption && (
                <div className="mt-2 p-2 bg-[var(--surface-warm)] rounded text-[10px] text-[var(--ink-soft)] italic line-clamp-2">
                  "{c.caption}"
                </div>
              )}
            </div>
            <div className="content-footer">
              <div className="content-platform">{c.platform || 'Multi-plateforme'}</div>
              <div className="flex gap-1">
                {c.mediaUrl && <div className="w-2 h-2 rounded-full bg-[var(--gold)]" title="Media attaché" />}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center text-[var(--ink-faint)]">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <div className="text-lg font-serif">Aucun contenu trouvé</div>
            <p className="text-sm mt-2">Commencez par ajouter une idée ou un brouillon.</p>
          </div>
        )}
      </div>
      <div className="flex justify-center pt-4">
        <button 
          className="text-xs font-bold text-[var(--gold)] hover:underline"
          onClick={onLoadMore}
        >
          Charger plus de contenu
        </button>
      </div>
    </div>
  );
};

const MessagesView = ({ messages = [], prospects = [], onSendMessage }: any) => {
  const [activeProspectId, setActiveProspectId] = useState<string | null>(null);
  
  const activeMessages = (messages || []).filter((m: any) => m.prospectId === activeProspectId)
    .sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));

  return (
    <div className="grid grid-cols-[300px_1fr] gap-6 h-[calc(100vh-200px)]">
      <div className="section-card overflow-y-auto">
        <div className="section-title mb-4">Conversations</div>
        <div className="space-y-2">
          {prospects.filter((p: any) => p.status !== 'cold').map((p: any) => (
            <div 
              key={p.id} 
              className={`p-3 rounded-lg cursor-pointer transition-all ${activeProspectId === p.id ? 'bg-[var(--gold)] text-white shadow-md' : 'bg-white border border-[var(--border)] hover:bg-[var(--surface-warm)]'}`}
              onClick={() => setActiveProspectId(p.id)}
            >
              <div className="font-medium text-sm">{p.name}</div>
              <div className={`text-[10px] ${activeProspectId === p.id ? 'text-white/70' : 'text-[var(--ink-soft)]'}`}>{p.source}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="section-card flex flex-col">
        {activeProspectId ? (
          <>
            <div className="section-head">
              <div className="section-title">Discussion avec {prospects.find((p: any) => p.id === activeProspectId)?.name}</div>
              <button className="btn-gold text-xs" onClick={() => onSendMessage(activeProspectId)}>Répondre</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 p-4">
              {activeMessages.map((m: any) => (
                <div key={m.id} className={`flex ${m.sender === 'cm' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${m.sender === 'cm' ? 'bg-[var(--gold)] text-white rounded-tr-none' : 'bg-[var(--surface-warm)] text-[var(--ink)] rounded-tl-none'}`}>
                    {m.text}
                    <div className={`text-[9px] mt-1 ${m.sender === 'cm' ? 'text-white/60' : 'text-[var(--ink-faint)]'}`}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {activeMessages.length === 0 && (
                <div className="text-center py-20 text-[var(--ink-faint)] italic text-sm">Aucun message pour le moment.</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--ink-faint)]">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <div className="text-lg font-serif">Sélectionnez une conversation</div>
          </div>
        )}
      </div>
    </div>
  );
};

const ResearchView = ({ research = [], onAdd }: any) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'my-research' | 'ai-insights'>('ai-insights');
  const [niche, setNiche] = useState('');
  const [insights, setInsights] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const filtered = (research || []).filter((r: any) => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || 
                          r.platform.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || r.category === filter;
    return matchesSearch && matchesFilter;
  });

  const handleGenerateInsights = async () => {
    if (!niche) return alert("Veuillez saisir votre niche (ex: Salon de coiffure, E-commerce mode).");
    setIsGenerating(true);
    try {
      const data = await generateMarketInsights(niche);
      if (data) {
        setInsights(data);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération des insights.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-[var(--border)] pb-2">
        <button 
          className={`pb-2 px-2 font-medium text-sm transition-colors ${activeTab === 'ai-insights' ? 'text-[var(--gold)] border-b-2 border-[var(--gold)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
          onClick={() => setActiveTab('ai-insights')}
        >
          Insights IA (Afrique)
        </button>
        <button 
          className={`pb-2 px-2 font-medium text-sm transition-colors ${activeTab === 'my-research' ? 'text-[var(--gold)] border-b-2 border-[var(--gold)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
          onClick={() => setActiveTab('my-research')}
        >
          Mes Veilles
        </button>
      </div>

      {activeTab === 'ai-insights' && (
        <div className="space-y-6">
          <div className="section-card bg-gradient-to-br from-[var(--surface-warm)] to-white">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="form-label">Votre Niche / Secteur d'activité</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ex: Vente de mèches, Agence immobilière à Douala..." 
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerateInsights()}
                />
              </div>
              <button 
                className="btn-gold whitespace-nowrap flex items-center gap-2"
                onClick={handleGenerateInsights}
                disabled={isGenerating || !niche}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Générer l'Analyse
                  </>
                )}
              </button>
            </div>
          </div>

          {insights && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="section-card">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-[var(--gold)]" size={20} />
                  <div className="section-title">Sujets Viraux</div>
                </div>
                <div className="space-y-4">
                  {insights.viralTopics?.map((topic: any, i: number) => (
                    <div key={i} className="p-3 bg-[var(--surface-warm)] rounded-lg border border-[var(--border)]">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-sm text-[var(--ink)]">{topic.title}</div>
                        <div className="text-[10px] bg-white px-2 py-0.5 rounded-full text-[var(--gold)] font-bold border border-[var(--gold)]">{topic.format}</div>
                      </div>
                      <div className="text-xs text-[var(--ink-soft)]">{topic.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-card">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="text-[#378ADD]" size={20} />
                  <div className="section-title">Hashtags Tendance</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {insights.trendingHashtags?.map((tag: string, i: number) => (
                    <div key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                      {tag}
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-card">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="text-red-500" size={20} />
                  <div className="section-title">Analyse Concurrentielle</div>
                </div>
                <div className="space-y-4">
                  {insights.competitorAnalysis?.map((comp: any, i: number) => (
                    <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <div className="font-bold text-xs text-red-700 mb-2 uppercase tracking-wider">{comp.type}</div>
                      <div className="mb-2">
                        <span className="text-[10px] font-bold text-red-600 block mb-0.5">LEUR STRATÉGIE :</span>
                        <span className="text-xs text-[var(--ink)]">{comp.strategy}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-green-600 block mb-0.5">OPPORTUNITÉ :</span>
                        <span className="text-xs text-[var(--ink)]">{comp.opportunity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'my-research' && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex gap-2">
              {['all', 'competitor', 'trend', 'idea'].map(cat => (
                <button 
                  key={cat} 
                  className={`section-action capitalize ${filter === cat ? 'bg-[var(--gold)] text-white' : ''}`}
                  onClick={() => setFilter(cat)}
                >
                  {cat === 'all' ? 'Tout' : cat}
                </button>
              ))}
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Rechercher une idée..." 
                className="text-sm p-2 border rounded bg-white flex-1 md:w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button className="btn-gold whitespace-nowrap" onClick={onAdd}>+ Nouvelle Veille</button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r: any) => (
              <div key={r.id} className="section-card hover:shadow-lg transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                    r.category === 'competitor' ? 'bg-red-50 text-red-600' : 
                    r.category === 'trend' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {r.category}
                  </div>
                  <div className="text-[10px] text-[var(--ink-faint)]">{new Date(r.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="font-medium text-[var(--ink)] mb-1">{r.title}</div>
                <div className="text-xs text-[var(--gold)] mb-3">{r.platform}</div>
                <p className="text-xs text-[var(--ink-soft)] line-clamp-3 mb-4">{r.notes}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--ink-soft)] hover:text-[var(--gold)] flex items-center gap-1">
                    <Globe size={10} /> Voir la source
                  </a>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-[var(--ink-faint)]">
                <Globe size={48} className="mx-auto mb-4 opacity-20" />
                <div className="text-lg font-serif">Aucun résultat trouvé</div>
                <p className="text-sm mt-2">Essayez de modifier vos critères de recherche ou de filtre.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const PlaceholderView = ({ title, icon }: any) => (
  <div className="flex flex-col items-center justify-center py-20 text-[var(--ink-faint)]">
    <div className="mb-4">{icon}</div>
    <div className="text-xl font-serif">{title}</div>
    <div className="text-sm mt-2">Cette fonctionnalité est en cours de déploiement...</div>
  </div>
);

// --- Forms ---

const NavItem = ({ active, onClick, icon, label, badge }: any) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    <div className="nav-icon">{icon}</div>
    {label}
    {badge !== undefined && badge > 0 && <div className="nav-badge">{badge}</div>}
  </div>
);

const ProspectForm = ({ onSubmit, onCancel }: any) => {
  const [name, setName] = useState('');
  const [source, setSource] = useState('WhatsApp');
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, source, tag, notes }); }}>
      <div className="form-row">
        <label className="form-label">Nom / Page</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Boutique de Mode" />
      </div>
      <div className="form-row">
        <label className="form-label">Source</label>
        <select className="form-select" value={source} onChange={e => setSource(e.target.value)}>
          <option>WhatsApp</option>
          <option>Facebook</option>
          <option>Marketplace</option>
          <option>Ads</option>
          <option>Inbox</option>
        </select>
      </div>
      <div className="form-row">
        <label className="form-label">Tag (Catégorie)</label>
        <select className="form-select" value={tag} onChange={e => setTag(e.target.value)}>
          <option value="">Aucun</option>
          <option value="VIP">VIP</option>
          <option value="Partenaire">Partenaire</option>
          <option value="Potentiel">Potentiel</option>
          <option value="Urgent">Urgent</option>
        </select>
      </div>
      <div className="form-row">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Détails sur le prospect..." />
      </div>
      <div className="modal-btns">
        <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-gold">Enregistrer</button>
      </div>
    </form>
  );
};

const ContentForm = ({ onSubmit, onCancel, initialData }: any) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [type, setType] = useState(initialData?.type || 'reel');
  const [category, setCategory] = useState(initialData?.category || 'Informative');
  const [status, setStatus] = useState(initialData?.status || 'Idea');
  const [description, setDescription] = useState(initialData?.description || '');
  const [script, setScript] = useState(initialData?.script || '');
  const [caption, setCaption] = useState(initialData?.caption || '');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAiGenerate = async () => {
    if (!title) return alert("Veuillez saisir un titre ou un sujet d'abord.");
    setIsGenerating(true);
    try {
      const ideas = await generateContentIdeas(title);
      if (ideas && ideas.length > 0) {
        const idea = ideas[0];
        setTitle(idea.titre || title);
        setType(idea.type?.toLowerCase() || 'reel');
        setCategory(idea.catégorie || 'Informative');
        setScript(idea.script || '');
        setDescription(idea.description || '');
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération AI. Vérifiez votre connexion ou la configuration.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineCaption = async () => {
    if (!caption) return;
    setIsGenerating(true);
    try {
      const refined = await refineCaption(caption);
      if (refined) setCaption(refined);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ id: initialData?.id, title, type, category, status, description, script, caption }); }}>
      <div className="form-row">
        <label className="form-label flex justify-between">
          Titre / Sujet
          <button type="button" onClick={handleAiGenerate} disabled={isGenerating} className="text-[var(--gold)] flex items-center gap-1 hover:underline disabled:opacity-50">
            <Sparkles size={12} /> {isGenerating ? 'Génération...' : 'Générer avec AI'}
          </button>
        </label>
        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: 5 astuces pour..." />
      </div>
      <div className="form-row-2">
        <div className="form-row">
          <label className="form-label">Type</label>
          <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="reel">🎬 Reel</option>
            <option value="video">📹 Vidéo</option>
            <option value="image">🖼️ Image</option>
            <option value="story">✨ Story</option>
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Catégorie</label>
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="Informative">Informatif</option>
            <option value="Entertainment">Divertissant</option>
            <option value="Promotional">Promotionnel</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <label className="form-label">Statut</label>
        <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="Idea">💡 Idée</option>
          <option value="Draft">📝 Brouillon</option>
          <option value="Scheduled">📅 Planifié</option>
          <option value="Published">✅ Publié</option>
        </select>
      </div>
      <div className="form-row">
        <label className="form-label">Script / Structure</label>
        <textarea className="form-textarea h-24" value={script} onChange={e => setScript(e.target.value)} placeholder="Détails du script..." />
      </div>
      <div className="form-row">
        <label className="form-label flex justify-between">
          Légende (Caption)
          {caption && (
            <button type="button" onClick={handleRefineCaption} disabled={isGenerating} className="text-[var(--gold)] flex items-center gap-1 hover:underline disabled:opacity-50">
              <Sparkles size={12} /> Améliorer
            </button>
          )}
        </label>
        <textarea className="form-textarea h-20" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Écrivez votre légende ici..." />
      </div>
      <div className="modal-btns">
        <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-gold">Enregistrer</button>
      </div>
    </form>
  );
};

const GeminiChatbot = ({ history, setHistory, onClose }: any) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setInput('');
    const newHistory = [...history, { role: 'user', parts: [{ text: userMsg }] }];
    setHistory(newHistory);
    setIsLoading(true);

    try {
      const response = await chatWithGemini(history, userMsg);
      setHistory([...newHistory, { role: 'model', parts: [{ text: response }] }]);
    } catch (err) {
      console.error(err);
      setHistory([...newHistory, { role: 'model', parts: [{ text: "Désolé, j'ai rencontré une erreur. Assurez-vous que la clé API Gemini est configurée." }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-[1600] border border-[var(--border)] overflow-hidden">
      <div className="p-4 bg-[var(--gold)] text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <div className="font-medium">Assistant Ayomedia</div>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded">
          <X size={18} />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--surface-warm)]">
        {history.length === 0 && (
          <div className="text-center py-10 text-[var(--ink-faint)]">
            <Sparkles size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Bonjour ! Comment puis-je vous aider avec votre stratégie de contenu aujourd'hui ?</p>
          </div>
        )}
        {history.map((msg: any, i: number) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-[var(--gold)] text-white rounded-tr-none' : 'bg-white text-[var(--ink)] shadow-sm rounded-tl-none'}`}>
              {msg.parts[0].text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-[var(--gold)] rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-[var(--gold)] rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-[var(--gold)] rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-[var(--border)] bg-white flex gap-2">
        <input 
          className="flex-1 text-sm p-2 border rounded-lg focus:outline-none focus:border-[var(--gold)]" 
          placeholder="Posez une question..." 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button 
          className="p-2 bg-[var(--gold)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

const MessageForm = ({ prospectId, onSubmit, onCancel }: any) => {
  const [text, setText] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ prospectId, text }); }}>
      <div className="form-row">
        <label className="form-label">Message</label>
        <textarea 
          className="form-textarea" 
          value={text} 
          onChange={e => setText(e.target.value)} 
          required 
          placeholder="Écrivez votre réponse ici..." 
          autoFocus
        />
      </div>
      <div className="modal-btns">
        <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-gold">Envoyer</button>
      </div>
    </form>
  );
};

const ResearchForm = ({ onSubmit, onCancel }: any) => {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [category, setCategory] = useState('trend');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ title, platform, category, url, notes }); }}>
      <div className="form-row">
        <label className="form-label">Titre / Sujet</label>
        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: Tendance Reels Transition" />
      </div>
      <div className="form-row-2">
        <div className="form-row">
          <label className="form-label">Plateforme</label>
          <select className="form-select" value={platform} onChange={e => setPlatform(e.target.value)}>
            <option>Instagram</option>
            <option>Facebook</option>
            <option>TikTok</option>
            <option>LinkedIn</option>
            <option>Marketplace</option>
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Catégorie</label>
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="trend">Tendance</option>
            <option value="competitor">Concurrent</option>
            <option value="idea">Idée</option>
            <option value="platform">Plateforme</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <label className="form-label">URL (Optionnel)</label>
        <input className="form-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="form-row">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Détails, observations..." />
      </div>
      <div className="modal-btns">
        <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-gold">Enregistrer</button>
      </div>
    </form>
  );
};

const ScheduleForm = ({ contentId, onSubmit, onCancel }: any) => {
  const [date, setDate] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['IG']);

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(contentId, date, platforms); }}>
      <div className="form-row">
        <label className="form-label">Date et Heure de publication</label>
        <input 
          type="datetime-local" 
          className="form-input" 
          value={date} 
          onChange={e => setDate(e.target.value)} 
          required 
        />
      </div>
      <div className="form-row">
        <label className="form-label">Plateformes</label>
        <div className="flex gap-3">
          {['IG', 'TikTok', 'FB'].map(p => (
            <button 
              key={p} 
              type="button"
              className={`flex-1 p-3 rounded-lg border text-sm font-bold transition-all ${platforms.includes(p) ? 'bg-[var(--gold)] text-white border-[var(--gold)]' : 'bg-white text-[var(--ink-soft)] border-[var(--border)]'}`}
              onClick={() => togglePlatform(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="modal-btns">
        <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-gold" disabled={!date || platforms.length === 0}>Confirmer le planning</button>
      </div>
    </form>
  );
};

const TaskForm = ({ onSubmit, onCancel, initialDate }: any) => {
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('PROSP');
  const [dueDate, setDueDate] = useState(initialDate ? initialDate.split('T')[0] : '');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ title, tag, dueDate }); }}>
      <div className="form-row">
        <label className="form-label">Titre de la tâche</label>
        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: Répondre aux messages WhatsApp" />
      </div>
      <div className="form-row">
        <label className="form-label">Catégorie</label>
        <select className="form-select" value={tag} onChange={e => setTag(e.target.value)}>
          <option>PROSP</option>
          <option>EDIT</option>
          <option>CONTENT</option>
          <option>CLIENT</option>
          <option>SITE</option>
        </select>
      </div>
      <div className="form-row">
        <label className="form-label">Date d'échéance</label>
        <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      </div>
      <div className="modal-btns">
        <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-gold">Créer</button>
      </div>
    </form>
  );
};
