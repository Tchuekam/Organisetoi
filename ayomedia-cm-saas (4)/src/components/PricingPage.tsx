import { useState, useMemo } from 'react';
import { Invoice } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  Plus, Copy, Download, Landmark, TrendingUp, AlertCircle, CheckCircle2, MoreVertical
} from 'lucide-react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { jsPDF } from 'jspdf';
import { format, startOfMonth, isAfter, subMonths } from 'date-fns';

interface PricingPageProps {
  invoices: Invoice[];
  companyId: string;
  userId: string;
  addNotification: (params: { type: 'success' | 'warning' | 'error' | 'info', title: string, message: string }) => void;
  onLoadMore: () => void;
  onRefreshStats?: () => void;
}

const PACKAGES = [
  { name: 'Starter', price: 45000, posts: 3, strategy: 'WhatsApp management', report: 'Monthly', margin: 65, recommended: false },
  { name: 'Growth', price: 85000, posts: 5, strategy: '+ Facebook Ads setup', report: 'Bi-weekly', margin: 55, recommended: true },
  { name: 'Premium', price: 150000, posts: 'Daily', strategy: '+ Full strategy', report: 'Weekly', margin: 45, recommended: false },
];

export default function PricingPage({ invoices, companyId, userId, addNotification, onLoadMore, onRefreshStats }: PricingPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetMRR, setTargetMRR] = useState(500000);
  const [formData, setFormData] = useState({ clientName: '', service: 'Growth', amount: 85000, dueDate: format(new Date(), 'yyyy-MM-dd') });

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    
    const paidThisMonth = invoices.filter(inv => inv.status === 'paid' && isAfter(new Date(inv.date), monthStart));
    const mrr = paidThisMonth.reduce((sum, inv) => sum + inv.amount, 0);
    
    const pending = invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue');
    const receivables = pending.reduce((sum, inv) => sum + inv.amount, 0);

    // Group by month for chart - showing last 6 months
    const lastSixMonths = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(now, 5 - i);
      return {
        name: format(d, 'MMM'),
        fullDate: format(d, 'yyyy-MM'),
        amount: 0
      };
    });

    invoices.filter(i => i.status === 'paid').forEach(inv => {
      const invMonth = format(new Date(inv.date), 'yyyy-MM');
      const monthBucket = lastSixMonths.find(m => m.fullDate === invMonth);
      if (monthBucket) {
        monthBucket.amount += inv.amount;
      }
    });

    return { mrr, receivables, chartData: lastSixMonths };
  }, [invoices]);

  const copyQuote = (pkg: typeof PACKAGES[0]) => {
    const text = `*DEVIS AYOMEDIA - OFFRE ${pkg.name.toUpperCase()}*\n\n` +
                 `Boostez votre présence digitale avec notre expertise.\n\n` +
                 `• *Tarif :* ${pkg.price.toLocaleString()} FCFA/mois\n` +
                 `• *Fréquence :* ${pkg.posts} ${pkg.posts === 'Daily' ? 'contenu par jour' : 'publications par semaine'}\n` +
                 `• *Gestion :* ${pkg.strategy}\n` +
                 `• *Rapport :* ${pkg.report}\n\n` +
                 `🏷️ _Marge estimée : ${pkg.margin}%_\n\n` +
                 `Discutons de votre projet dès aujourd'hui !`;
    navigator.clipboard.writeText(text);
    addNotification({
      type: 'success',
      title: 'Devis copié',
      message: `Offre ${pkg.name} prête à être envoyée.`
    });
  };

  const downloadInvoicePDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(26, 24, 21); // Ink
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(201, 168, 76); // Gold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('AYOMEDIA', 20, 25);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('CM SOCIAL SAAS', 20, 32);
    
    // Invoice Info
    doc.setTextColor(26, 24, 21);
    doc.setFontSize(20);
    doc.text('FACTURE', 140, 60);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Numéro: INV-${invoice.id.substring(0, 8).toUpperCase()}`, 140, 70);
    doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`, 140, 75);
    doc.text(`Échéance: ${new Date(invoice.dueDate).toLocaleDateString()}`, 140, 80);
    
    // Client Info
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURÉ À:', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.clientName, 20, 65);
    
    // Table
    doc.setFillColor(245, 243, 238);
    doc.rect(20, 100, 170, 10, 'F');
    doc.text('Description', 25, 106);
    doc.text('Quantité', 120, 106);
    doc.text('Total', 160, 106);
    
    doc.text(`Service Community Management: ${invoice.service}`, 25, 120);
    doc.text('1', 125, 120);
    doc.text(`${invoice.amount.toLocaleString()} ${invoice.currency}`, 160, 120);
    
    // Total
    doc.line(20, 140, 190, 140);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 130, 150);
    doc.text(`${invoice.amount.toLocaleString()} ${invoice.currency}`, 160, 150);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Merci de votre confiance. Ayomedia Social SaaS - Solution de croissance.', 105, 280, { align: 'center' });
    
    doc.save(`Facture_${invoice.clientName}_${invoice.date}.pdf`);
    
    addNotification({
      type: 'success',
      title: 'PDF Généré',
      message: `La facture pour ${invoice.clientName} a été téléchargée.`
    });
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date();
      await addDoc(collection(db, 'invoices'), {
        clientName: formData.clientName,
        service: formData.service as 'Starter' | 'Growth' | 'Premium' | 'Custom',
        amount: formData.amount,
        currency: 'FCFA',
        date: now.toISOString().split('T')[0],
        dueDate: formData.dueDate,
        status: 'pending',
        companyId,
        userId,
        createdAt: now.toISOString()
      });
      setIsModalOpen(false);
      addNotification({
        type: 'success',
        title: 'Facture créée',
        message: `La facture pour ${formData.clientName} a été enregistrée.`
      });
      onRefreshStats?.();
    } catch (err) {
      console.error("Invoice error:", err);
    }
  };

  const toggleInvoiceStatus = async (inv: Invoice) => {
    const nextStatus: Record<string, 'paid' | 'pending' | 'overdue'> = {
      'pending': 'paid',
      'paid': 'overdue',
      'overdue': 'pending'
    };
    try {
      await updateDoc(doc(db, 'invoices', inv.id), { status: nextStatus[inv.status] || 'pending' });
      onRefreshStats?.();
    } catch (err) {
      console.error("Update status error:", err);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 sm:space-y-12">
      {/* Section A: Packages */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-semibold text-[var(--ink)]">Nos Forfaits de Services</h2>
          <span className="text-xs text-[var(--ink-soft)] uppercase tracking-widest font-bold">Catalogue Digital</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PACKAGES.map((pkg) => (
            <div 
              key={pkg.name} 
              className={`relative bg-white p-8 rounded-2xl border-2 transition-all hover:shadow-xl ${pkg.recommended ? 'border-[var(--gold)] scale-105 shadow-gold/10' : 'border-[var(--border)]'}`}
            >
              {pkg.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--gold)] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Recommandé
                </div>
              )}
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-serif font-bold text-[var(--ink)]">{pkg.name}</h3>
                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded uppercase">Marge {pkg.margin}%</span>
              </div>
              <div className="mb-6">
                <span className="text-3xl font-bold text-[var(--gold)]">{pkg.price.toLocaleString()}</span>
                <span className="text-sm text-[var(--ink-soft)] ml-1">FCFA/mois</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm text-[var(--ink-soft)]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[var(--gold)]" />
                  {pkg.posts} publications par semaine
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[var(--gold)]" />
                  {pkg.strategy}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[var(--gold)]" />
                  Reporting {pkg.report}
                </li>
              </ul>
              <button 
                onClick={() => copyQuote(pkg)}
                className="w-full btn-outline flex items-center justify-center gap-2 group hover:bg-[var(--gold)] hover:text-white hover:border-[var(--gold)]"
              >
                <Copy size={16} className="group-hover:scale-110 transition-transform" />
                Copier le devis
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Section C: Revenue Tracker (Integrated Stats) */}
      <section className="bg-[var(--ink)] text-white p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gold)] opacity-5 blur-[80px] -mr-32 -mt-32"></div>
        
        <div className="relative z-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--gold)] mb-2">Revenue Tracker</h2>
              <div className="text-4xl font-serif font-light">{stats.mrr.toLocaleString()} <span className="text-lg opacity-40 ml-1">FCFA / mois</span></div>
            </div>
            <div className="flex gap-4">
              <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl">
                <div className="text-[10px] uppercase tracking-widest text-[#999] mb-1">Créances</div>
                <div className="text-lg font-bold text-amber-400">{stats.receivables.toLocaleString()}</div>
              </div>
              <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl">
                <div className="text-[10px] uppercase tracking-widest text-[#999] mb-1">Objectif</div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={targetMRR} 
                    onChange={e => setTargetMRR(Number(e.target.value))}
                    className="bg-transparent border-none p-0 w-20 text-lg font-bold focus:ring-0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#666'}} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                    contentStyle={{backgroundColor: '#1A1815', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'}} 
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={40}>
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.amount > 0 ? 'var(--gold)' : '#333'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                  <span className="text-[#999]">Progression</span>
                  <span>{Math.round((stats.mrr/targetMRR)*100)}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--gold)]" style={{width: `${Math.min((stats.mrr/targetMRR)*100, 100)}%`}}></div>
                </div>
              </div>
              <p className="text-xs text-[#666] italic font-serif">
                "Votre succès financier est le reflet direct du succès de vos clients."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section B: Invoices Table */}
      <section>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-[var(--ink)]">Historique des Factures</h2>
          <button onClick={() => setIsModalOpen(true)} className="btn-gold flex items-center gap-2 w-full sm:w-auto justify-center">
            <Plus size={16} /> Nouvelle Facture
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--border)] overflow-x-auto shadow-sm no-scrollbar">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-[#FAF9F6] border-b border-[var(--border)]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">Client</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">Service</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">Montant</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">Statut</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {invoices.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[var(--ink-soft)] italic">Aucune facture enregistrée</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[var(--ink)]">{inv.clientName}</td>
                    <td className="px-6 py-4 text-sm">{inv.service}</td>
                    <td className="px-6 py-4 font-bold text-[var(--gold)]">{inv.amount.toLocaleString()} FCFA</td>
                    <td className="px-6 py-4 text-xs text-[var(--ink-soft)]">{inv.date}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleInvoiceStatus(inv)}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter cursor-pointer transition-all ${
                        inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                        inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}
                      >
                        {inv.status.toUpperCase()}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => downloadInvoicePDF(inv)} className="p-2 text-[var(--ink-soft)] hover:text-[var(--gold)] transition-colors">
                          <Download size={16} />
                        </button>
                        <button 
                          className="p-2 text-red-300 hover:text-red-600 transition-colors" 
                          onClick={async () => {
                            await deleteDoc(doc(db, 'invoices', inv.id));
                            onRefreshStats?.();
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="p-4 border-t border-[var(--border)] flex justify-center">
            <button className="text-xs font-bold text-[var(--gold)] hover:underline" onClick={onLoadMore}>
              Charger plus de factures
            </button>
          </div>
        </div>
      </section>

      {/* Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 border border-[var(--border)] animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-serif font-bold mb-6">Nouvelle Facture</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="form-row">
                <label className="form-label">Nom du Client</label>
                <input 
                  className="form-input" 
                  value={formData.clientName} 
                  onChange={e => setFormData({...formData, clientName: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-row">
                <label className="form-label">Service</label>
                <select 
                  className="form-select" 
                  value={formData.service} 
                  onChange={e => {
                    const pkg = PACKAGES.find(p => p.name === e.target.value);
                    setFormData({...formData, service: e.target.value, amount: pkg ? pkg.price : formData.amount});
                  }}
                >
                  {PACKAGES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  <option value="Custom">Service Personnalisé</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Montant (FCFA)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: Number(e.target.value)})} 
                  required 
                />
              </div>
              <div className="form-row">
                <label className="form-label">Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.dueDate} 
                  onChange={e => setFormData({...formData, dueDate: e.target.value})} 
                  required 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-outline">Annuler</button>
                <button type="submit" className="flex-1 btn-gold">Générer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
