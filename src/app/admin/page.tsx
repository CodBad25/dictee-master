"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, Eye, EyeOff, Loader2, Bug, X, CheckCircle2,
  MessageSquare, Trash2, ChevronDown, ChevronUp, Users,
  BookOpen, BarChart3, GraduationCap, LogOut, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getClasses, getEleves, type HubClasse, type HubEleve } from "@/lib/hub";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────
interface BugReport {
  id: string;
  description: string;
  screenshot: string | null;
  page_url: string | null;
  user_agent: string | null;
  reporter_name: string | null;
  reporter_type: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface Dictee {
  id: string;
  title: string;
  position: number;
  share_code: string;
}

interface DmClass {
  id: string;
  name: string;
  teacher_id: string;
  unlocked_dictees: number[];
  created_at: string;
}

interface DmResult {
  id: string;
  student_id: string;
  student_name: string;
  dictee_id: string;
  activity_mode: string;
  percentage: number;
  created_at: string;
}

// ─── Login ───────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: (pwd: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        localStorage.setItem("dm_admin_pwd", password);
        onLogin(password);
      } else {
        setError("Mot de passe incorrect");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-gray-700 bg-gray-800/80">
        <CardContent className="p-6 space-y-5">
          <div className="text-center">
            <Shield className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <h1 className="text-xl font-bold text-white">Administration</h1>
          </div>
          {error && <div className="bg-red-900/50 text-red-300 p-2 rounded text-sm">{error}</div>}
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe admin"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
              onKeyDown={(e) => { if (e.key === "Enter" && password) handleSubmit(); }}
              autoFocus
            />
            <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={handleSubmit} disabled={!password || loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se connecter"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page Admin ──────────────────────────────────────────────────────
export default function AdminPage() {
  const [adminPwd, setAdminPwd] = useState<string | null>(null);
  const [tab, setTab] = useState<"stats" | "bugs" | "classes" | "dictees">("stats");

  // Vérifier une session admin existante
  useEffect(() => {
    const saved = localStorage.getItem("dm_admin_pwd");
    if (saved) setAdminPwd(saved);
  }, []);

  if (!adminPwd) return <AdminLogin onLogin={setAdminPwd} />;

  const logout = () => {
    localStorage.removeItem("dm_admin_pwd");
    setAdminPwd(null);
  };

  const tabs = [
    { id: "stats" as const, label: "Vue d'ensemble", icon: BarChart3 },
    { id: "bugs" as const, label: "Signalements", icon: Bug },
    { id: "classes" as const, label: "Classes", icon: Users },
    { id: "dictees" as const, label: "Dictées", icon: BookOpen },
  ];

  return (
    <div className="min-h-dvh bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h1 className="font-bold text-lg">DictéeMaster — Admin</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </header>

      {/* Tabs */}
      <nav className="bg-gray-900/50 border-b border-gray-800 px-4 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="p-4 max-w-6xl mx-auto">
        {tab === "stats" && <StatsTab adminPwd={adminPwd} />}
        {tab === "bugs" && <BugsTab adminPwd={adminPwd} />}
        {tab === "classes" && <ClassesTab />}
        {tab === "dictees" && <DicteesTab />}
      </main>
    </div>
  );
}

// ─── Stats Tab ───────────────────────────────────────────────────────
function StatsTab({ adminPwd }: { adminPwd: string }) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSessions: 0,
    totalDictees: 0,
    totalBugs: 0,
    bugsNew: 0,
    avgScore: 0,
    recentSessions: [] as DmResult[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const sb = createClient();

      const [dictees, results, bugs] = await Promise.all([
        sb.from("dictees").select("id"),
        sb.from("dm_results").select("id, student_id, student_name, dictee_id, activity_mode, percentage, created_at").order("created_at", { ascending: false }).limit(500),
        fetch("/api/bugs?admin=true", { headers: { "x-admin-password": adminPwd } }).then(r => r.ok ? r.json() : []),
      ]);

      const allResults = results.data || [];
      const uniqueStudents = new Set(allResults.map((r) => r.student_id));
      const avgPct = allResults.length > 0
        ? Math.round(allResults.reduce((a, r) => a + (r.percentage || 0), 0) / allResults.length)
        : 0;

      setStats({
        totalStudents: uniqueStudents.size,
        totalSessions: allResults.length,
        totalDictees: dictees.data?.length || 0,
        totalBugs: bugs.length || 0,
        bugsNew: (bugs as BugReport[]).filter((b) => b.status === "new").length,
        avgScore: avgPct,
        recentSessions: allResults.slice(0, 20),
      });
      setLoading(false);
    };
    load();
  }, [adminPwd]);

  if (loading) return <Loading />;

  const cards = [
    { label: "Élèves actifs", value: stats.totalStudents, icon: Users, color: "text-blue-400" },
    { label: "Sessions totales", value: stats.totalSessions, icon: BarChart3, color: "text-purple-400" },
    { label: "Dictées", value: stats.totalDictees, icon: BookOpen, color: "text-emerald-400" },
    { label: "Score moyen", value: `${stats.avgScore}%`, icon: GraduationCap, color: "text-amber-400" },
    { label: "Signalements", value: stats.totalBugs, extra: stats.bugsNew > 0 ? `${stats.bugsNew} nouveau(x)` : undefined, icon: Bug, color: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <c.icon className={`w-5 h-5 ${c.color} mb-2`} />
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-gray-400">{c.label}</div>
            {c.extra && <div className="text-xs text-red-400 mt-1">{c.extra}</div>}
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="font-bold mb-3">Activité récente</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {stats.recentSessions.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune session récente</p>
          ) : (
            stats.recentSessions.map((r) => {
              const date = new Date(r.created_at);
              const pctColor = r.percentage >= 80 ? "text-green-400" : r.percentage >= 50 ? "text-amber-400" : "text-red-400";
              return (
                <div key={r.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-gray-400 text-xs w-28 flex-shrink-0">
                    {date.toLocaleDateString("fr-FR")} {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-medium flex-1 truncate">{r.student_name}</span>
                  <span className="text-gray-400 text-xs">{r.activity_mode}</span>
                  <span className={`font-bold ${pctColor}`}>{Math.round(r.percentage)}%</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bugs Tab ────────────────────────────────────────────────────────
function BugsTab({ adminPwd }: { adminPwd: string }) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "read" | "resolved">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const headers = { "x-admin-password": adminPwd };

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bugs?admin=true", { headers });
      if (res.ok) setReports(await res.json());
    } catch { /* silencieux */ } finally { setLoading(false); }
  }, [adminPwd]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const updateStatus = async (id: string, status: string, adminNote?: string) => {
    const body: Record<string, string> = { status };
    if (adminNote !== undefined) body.adminNote = adminNote;
    await fetch(`/api/bugs/${id}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    loadReports();
    toast.success(status === "resolved" ? "Résolu" : "Mis à jour");
  };

  const deleteReport = async (id: string) => {
    await fetch(`/api/bugs/${id}`, { method: "DELETE", headers });
    setReports((p) => p.filter((r) => r.id !== id));
    toast.success("Supprimé");
  };

  const saveNote = (id: string) => {
    updateStatus(id, "resolved", noteText);
    setEditingNote(null);
    setNoteText("");
  };

  if (loading) return <Loading />;

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const newCount = reports.filter((r) => r.status === "new").length;

  const statusConfig: Record<string, { text: string; color: string }> = {
    new: { text: "Nouveau", color: "bg-red-900/50 text-red-300" },
    read: { text: "Lu", color: "bg-yellow-900/50 text-yellow-300" },
    resolved: { text: "Résolu", color: "bg-green-900/50 text-green-300" },
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex gap-2">
        {(["all", "new", "read", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {f === "all" ? "Tous" : statusConfig[f].text}
            {f === "new" && newCount > 0 && <span className="ml-1 text-red-300">({newCount})</span>}
          </button>
        ))}
        <button onClick={loadReports} className="ml-auto text-gray-400 hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Aucun signalement</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => {
            const cfg = statusConfig[report.status] || statusConfig.new;
            const isExpanded = expandedId === report.id;
            const date = new Date(report.created_at);

            return (
              <div key={report.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : report.id);
                    if (!isExpanded && report.status === "new") updateStatus(report.id, "read");
                  }}
                  className="w-full p-4 flex items-start gap-3 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">{report.reporter_name || "Anonyme"}</span>
                      <span className="text-xs text-gray-600">
                        {date.toLocaleDateString("fr-FR")} {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{report.description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>{cfg.text}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-800 p-4 space-y-3 bg-gray-900/50">
                    <p className="text-sm whitespace-pre-wrap">{report.description}</p>
                    {report.screenshot && (
                      <img src={report.screenshot} alt="Capture" className="max-w-full rounded-lg border border-gray-700 cursor-pointer" onClick={() => window.open(report.screenshot!, "_blank")} />
                    )}
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {report.page_url && <p>URL : {report.page_url}</p>}
                      {report.user_agent && <p>Navigateur : {report.user_agent.slice(0, 100)}</p>}
                    </div>
                    {report.admin_note && (
                      <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium mb-0.5">
                          <MessageSquare className="w-3 h-3" /> Votre réponse
                        </div>
                        <p className="text-sm text-emerald-200">{report.admin_note}</p>
                      </div>
                    )}
                    {editingNote === report.id ? (
                      <div className="space-y-2">
                        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Réponse visible par l'élève..." rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none resize-none" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveNote(report.id)} className="bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Résoudre
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingNote(null)} className="text-gray-400">Annuler</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {report.status !== "resolved" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { setEditingNote(report.id); setNoteText(report.admin_note || ""); }} className="border-gray-700 text-gray-300">
                              <MessageSquare className="w-4 h-4 mr-1" /> Répondre
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateStatus(report.id, "resolved")} className="border-green-800 text-green-400">
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Résolu
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deleteReport(report.id)} className="text-red-400 ml-auto">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Classes Tab ─────────────────────────────────────────────────────
function ClassesTab() {
  const [classes, setClasses] = useState<HubClasse[]>([]);
  const [dmClasses, setDmClasses] = useState<DmClass[]>([]);
  const [students, setStudents] = useState<Record<string, HubEleve[]>>({});
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [hubClasses, dmData] = await Promise.all([
          getClasses(),
          createClient().from("dm_classes").select("*"),
        ]);
        setClasses(hubClasses);
        setDmClasses((dmData.data as DmClass[]) || []);
      } catch (e) {
        console.error(e);
        toast.error("Erreur de chargement des classes");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleClass = async (classId: string) => {
    if (expandedClass === classId) {
      setExpandedClass(null);
      return;
    }
    setExpandedClass(classId);
    if (!students[classId]) {
      try {
        const eleves = await getEleves(classId);
        setStudents((prev) => ({ ...prev, [classId]: eleves }));
      } catch {
        toast.error("Erreur de chargement des élèves");
      }
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Classes Hub ({classes.length})</h2>
      </div>

      {classes.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Aucune classe trouvée dans le Hub</p>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => {
            const dmClass = dmClasses.find((d) => d.name === cls.nom);
            const isExpanded = expandedClass === cls.id;
            const eleves = students[cls.id] || [];

            return (
              <div key={cls.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleClass(cls.id)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-800/50"
                >
                  <Users className="w-5 h-5 text-blue-400" />
                  <div className="flex-1">
                    <div className="font-bold">{cls.nom}</div>
                    <div className="text-xs text-gray-400">
                      {cls.nbEleves} élèves · {cls.niveau}
                      {dmClass && ` · ${dmClass.unlocked_dictees?.length || 0} dictées déverrouillées`}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-800 p-4">
                    {eleves.length === 0 ? (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {eleves.map((e) => (
                          <div key={e.id} className="bg-gray-800 rounded-lg px-3 py-2 text-sm">
                            <span className="font-medium">{e.prenom}</span>{" "}
                            <span className="text-gray-400">{e.nom}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {dmClass && (
                      <div className="mt-3 text-xs text-gray-500">
                        Dictées déverrouillées : {dmClass.unlocked_dictees?.join(", ") || "aucune"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Dictees Tab ─────────────────────────────────────────────────────
function DicteesTab() {
  const [dictees, setDictees] = useState<Dictee[]>([]);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [resultCounts, setResultCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const sb = createClient();
      const [dicteesRes, wordsRes, resultsRes] = await Promise.all([
        sb.from("dictees").select("id, title, position, share_code").order("position"),
        sb.from("dictee_words").select("dictee_id"),
        sb.from("dm_results").select("dictee_id"),
      ]);

      setDictees((dicteesRes.data as Dictee[]) || []);

      // Compter les mots par dictée
      const wc: Record<string, number> = {};
      (wordsRes.data || []).forEach((w: { dictee_id: string }) => {
        wc[w.dictee_id] = (wc[w.dictee_id] || 0) + 1;
      });
      setWordCounts(wc);

      // Compter les résultats par dictée
      const rc: Record<string, number> = {};
      (resultsRes.data || []).forEach((r: { dictee_id: string }) => {
        rc[r.dictee_id] = (rc[r.dictee_id] || 0) + 1;
      });
      setResultCounts(rc);

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Dictées ({dictees.length})</h2>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Titre</th>
              <th className="px-4 py-3 text-center">Mots</th>
              <th className="px-4 py-3 text-center">Sessions</th>
              <th className="px-4 py-3 text-left">Code partage</th>
            </tr>
          </thead>
          <tbody>
            {dictees.map((d) => (
              <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-400 font-mono">{d.position}</td>
                <td className="px-4 py-3 font-medium">{d.title}</td>
                <td className="px-4 py-3 text-center">{wordCounts[d.id] || 0}</td>
                <td className="px-4 py-3 text-center">{resultCounts[d.id] || 0}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{d.share_code || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Loading ─────────────────────────────────────────────────────────
function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
    </div>
  );
}
