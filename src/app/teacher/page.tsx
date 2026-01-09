"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  List,
  BarChart3,
  LogOut,
  Trash2,
  Copy,
  Check,
  BookOpen,
  Volume2,
  Layers,
  Upload,
  FileText,
  Loader2,
  ChevronRight,
  Eye,
  Settings,
  Key,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { parseWordsFromText, extractWordsFromFile, DetectedSection } from "@/lib/file-parser";
import ListDetail from "@/components/list-detail";
import TeacherDashboard from "@/components/teacher-dashboard";
import { VersionBadge } from "@/components/changelog-modal";
import type { WordList, Word, TrainingMode } from "@/types/database";

const modeLabels: Record<TrainingMode, { label: string; icon: React.ReactNode; color: string; description?: string }> = {
  flashcard: { label: "Flashcard", icon: <BookOpen className="w-4 h-4" />, color: "bg-blue-100 text-blue-700" },
  audio: { label: "Audio", icon: <Volume2 className="w-4 h-4" />, color: "bg-green-100 text-green-700" },
  progression: { label: "Progression", icon: <Layers className="w-4 h-4" />, color: "bg-purple-100 text-purple-700" },
  "fill-blanks": { label: "Dictée à trous", icon: <PenTool className="w-4 h-4" />, color: "bg-orange-100 text-orange-700", description: "Texte avec trous + audio" },
};

export default function TeacherPage() {
  const router = useRouter();
  const { user, setUser, demoLists, demoWords, apiConfig, setApiConfig } = useAppStore();
  const { createList, deleteList, isSyncing } = useSupabaseSync();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [selectedList, setSelectedList] = useState<WordList | null>(null);

  // Configuration API
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiConfig?.apiKey || "");

  // Sections détectées dans un fichier
  const [detectedSections, setDetectedSections] = useState<DetectedSection[]>([]);
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  // Refs for autofocus
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<TrainingMode>("progression");
  const [wordsText, setWordsText] = useState("");

  // Autofocus on title when dialog opens
  useEffect(() => {
    if (isCreateOpen && titleInputRef.current && !showSectionPicker) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isCreateOpen, showSectionPicker]);

  // Parse words from text
  const getParsedWords = () => {
    return parseWordsFromText(wordsText);
  };

  const handleLogout = () => {
    setUser(null);
    router.push("/");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    try {
      const result = await extractWordsFromFile(file);

      if (result.hasMultipleSections && result.sections.length > 1) {
        // Plusieurs dictées détectées - afficher le sélecteur
        setDetectedSections(result.sections);
        setShowSectionPicker(true);
        toast.success(`${result.sections.length} dictées détectées dans le fichier !`);
      } else if (result.words.length > 0) {
        // Une seule dictée ou pas de sections - importer directement
        addWordsToList(result.words);

        // Auto-fill title if empty
        if (!title.trim()) {
          const fileName = file.name.replace(/\.[^/.]+$/, "");
          setTitle(fileName);
        }
      } else {
        toast.error("Aucun mot détecté dans le fichier");
      }
    } catch (error) {
      console.error("Erreur lors de l'extraction:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de la lecture du fichier");
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const addWordsToList = (words: string[]) => {
    const existingWords = getParsedWords();
    const newWords = words.filter(w => !existingWords.some(ew => ew.toLowerCase() === w.toLowerCase()));

    if (newWords.length > 0) {
      setWordsText(prev => {
        const current = prev.trim();
        return current ? `${current}\n${newWords.join('\n')}` : newWords.join('\n');
      });
      toast.success(`${newWords.length} mots ajoutés !`);
    } else {
      toast.info("Tous les mots sont déjà dans la liste");
    }
  };

  const handleSelectSection = (section: DetectedSection) => {
    setTitle(section.title);
    setWordsText(section.words.join('\n'));
    setShowSectionPicker(false);
    setDetectedSections([]);
    toast.success(`"${section.title}" sélectionnée avec ${section.words.length} mots`);
  };

  const handleCreateList = async () => {
    if (!title.trim()) {
      toast.error("Veuillez entrer un titre");
      titleInputRef.current?.focus();
      return;
    }

    const wordsList = getParsedWords();

    if (wordsList.length === 0) {
      toast.error("Veuillez entrer au moins un mot");
      return;
    }

    // Créer dans Supabase (passer undefined si c'est un ID démo, pas un vrai UUID)
    const teacherId = user?.id?.startsWith('demo-') ? undefined : user?.id;
    const result = await createList(title.trim(), mode, wordsList, teacherId);

    if (result) {
      toast.success(`Liste "${title}" créée avec ${wordsList.length} mots !`);
      // Reset form
      setTitle("");
      setMode("progression");
      setWordsText("");
      setIsCreateOpen(false);
    } else {
      toast.error("Erreur lors de la création de la liste");
    }
  };

  const handleCopyCode = (code: string, listId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(listId);
    toast.success("Code copié !");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteList = async (listId: string, listTitle: string) => {
    const success = await deleteList(listId);
    if (success) {
      toast.success(`Liste "${listTitle}" supprimée`);
    } else {
      toast.error("Erreur lors de la suppression");
    }
  };

  const parsedWordsCount = getParsedWords().length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-indigo-50 to-blue-50 pb-safe">
      {/* Header avec profondeur */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-white to-white/95 backdrop-blur-xl border-b shadow-lg shadow-purple-100/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                DictéeMaster
              </h1>
              <VersionBadge />
            </div>
            <p className="text-xs text-gray-400 font-medium">Espace enseignant</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setTempApiKey(apiConfig?.apiKey || "");
                setIsSettingsOpen(true);
              }}
              className="hover:bg-purple-50 hover:text-purple-500 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Modal Configuration API */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-500" />
              Configuration IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-gray-700">Cle API</Label>
              <Input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Coller votre cle API..."
                className="font-mono"
              />
              <p className="text-xs text-gray-400">
                La cle est stockee localement. Sans cle, des templates simples seront utilises.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setApiConfig(null);
                  setTempApiKey("");
                  toast.success("Configuration supprimee");
                  setIsSettingsOpen(false);
                }}
              >
                Supprimer
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600"
                onClick={() => {
                  if (tempApiKey.trim()) {
                    setApiConfig({ apiKey: tempApiKey.trim() });
                    toast.success("Configuration sauvegardee");
                  } else {
                    setApiConfig(null);
                  }
                  setIsSettingsOpen(false);
                }}
              >
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stats avec effet 3D */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl transform rotate-2 opacity-50" />
            <Card className="relative bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 rounded-2xl shadow-xl shadow-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <List className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{demoLists.length}</p>
                    <p className="text-xs opacity-80">Listes créées</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl transform -rotate-2 opacity-50" />
            <Card className="relative bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0 rounded-2xl shadow-xl shadow-indigo-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">
                      {Object.values(demoWords).reduce((acc, words) => acc + words.length, 0)}
                    </p>
                    <p className="text-xs opacity-80">Mots au total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dashboard statistiques */}
        <TeacherDashboard />

        {/* Bouton créer avec gradient */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setShowSectionPicker(false);
            setDetectedSections([]);
          }
        }}>
          <DialogTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full h-16 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-2xl shadow-xl shadow-purple-200 flex items-center justify-center gap-3 transition-all"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6" />
              </div>
              Créer une nouvelle liste
            </motion.button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-3xl border-0 shadow-2xl">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                {showSectionPicker ? "Choisir une dictée" : "Nouvelle liste de mots"}
              </DialogTitle>
            </DialogHeader>

            {/* Sélecteur de section */}
            {showSectionPicker ? (
              <div className="space-y-4 py-4">
                <p className="text-sm text-gray-500">
                  {detectedSections.length} dictées trouvées. Laquelle importer ?
                </p>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {detectedSections.map((section, index) => (
                    <motion.button
                      key={section.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSelectSection(section)}
                      className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100 transition-all text-left flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{section.title}</p>
                          <p className="text-xs text-gray-400">
                            {section.words.length} mots : {section.words.slice(0, 3).join(", ")}
                            {section.words.length > 3 && "..."}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                    </motion.button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl border-2"
                  onClick={() => {
                    setShowSectionPicker(false);
                    setDetectedSections([]);
                  }}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              /* Formulaire de création */
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-bold text-gray-700">Titre de la liste</Label>
                  <Input
                    ref={titleInputRef}
                    id="title"
                    placeholder="Ex: Dictée semaine 12"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-12 rounded-xl border-2 border-gray-100 focus:border-purple-300 text-base"
                    autoFocus
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-gray-700">Mode d&apos;entraînement</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(modeLabels) as TrainingMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          mode === m
                            ? "border-purple-400 bg-purple-50 shadow-md shadow-purple-100"
                            : "border-gray-100 bg-gray-50 hover:border-purple-200"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className={`p-2 rounded-lg ${mode === m ? "bg-purple-500 text-white" : "bg-white text-gray-500"}`}>
                            {modeLabels[m].icon}
                          </div>
                          <span className={`text-xs font-bold ${mode === m ? "text-purple-600" : "text-gray-500"}`}>
                            {modeLabels[m].label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    {mode === "flashcard" && "L'élève voit le mot puis l'écrit"}
                    {mode === "audio" && "L'élève entend le mot et l'écrit"}
                    {mode === "progression" && "Flashcard puis audio quand maîtrisé"}
                    {mode === "fill-blanks" && "Texte à trous avec dictée audio"}
                  </p>
                </div>

                {/* Import fichier */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-gray-700">Importer un fichier</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.odt,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFile}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-purple-300 hover:bg-purple-50 transition-all flex items-center justify-center gap-3"
                  >
                    {isProcessingFile ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                        <span className="font-medium text-purple-600">Analyse en cours...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
                          <Upload className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-700">Glisser ou cliquer</p>
                          <p className="text-xs text-gray-400">PDF, Word, ODT ou TXT</p>
                        </div>
                      </>
                    )}
                  </motion.button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="words" className="text-sm font-bold text-gray-700">
                    Mots
                    <span className="text-gray-400 font-normal ml-1">
                      (collez votre liste)
                    </span>
                  </Label>
                  <textarea
                    id="words"
                    className="w-full h-36 p-4 border-2 border-gray-100 rounded-xl resize-none focus:outline-none focus:border-purple-300 text-base transition-colors"
                    placeholder={"enfin - voiture - mer\nou un mot par ligne..."}
                    value={wordsText}
                    onChange={(e) => setWordsText(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-sm">
                      <span className="font-bold text-purple-600">{parsedWordsCount}</span>
                      <span className="text-gray-400"> mot{parsedWordsCount > 1 ? 's' : ''} détecté{parsedWordsCount > 1 ? 's' : ''}</span>
                    </p>
                    {parsedWordsCount > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        onClick={() => {
                          const words = getParsedWords();
                          setWordsText(words.join('\n'));
                          toast.success("Mots formatés !");
                        }}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Formater
                      </Button>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleCreateList}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-xl shadow-lg shadow-purple-200"
                >
                  Créer la liste
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Liste des listes */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <List className="w-5 h-5 text-purple-500" />
            Mes listes
          </h2>
          <AnimatePresence mode="popLayout">
            {demoLists.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <List className="w-10 h-10 text-gray-300" />
                </div>
                <p className="font-medium text-gray-600">Aucune liste créée</p>
                <p className="text-sm text-gray-400">Créez votre première liste !</p>
              </motion.div>
            ) : (
              demoLists.map((list, index) => (
                <motion.div
                  key={list.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-2xl transform rotate-1 opacity-10" />
                    <div className="relative bg-white rounded-2xl border-2 border-gray-100 shadow-lg shadow-gray-100 overflow-hidden hover:shadow-xl hover:border-purple-200 transition-all">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
                              <BookOpen className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-800">{list.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${modeLabels[list.mode].color}`}>
                                  {modeLabels[list.mode].label}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {demoWords[list.id]?.length || 0} mots
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-purple-50"
                              onClick={() => setSelectedList(list)}
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-green-50"
                              onClick={() => handleCopyCode(list.share_code, list.id)}
                            >
                              {copiedId === list.id ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-red-50 hover:text-red-500"
                              onClick={() => handleDeleteList(list.id, list.title)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* Code section */}
                      <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-t border-purple-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Code élève :</span>
                          <code className="font-mono font-bold text-lg text-purple-600 tracking-wider">
                            {list.share_code}
                          </code>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                          onClick={() => handleCopyCode(list.share_code, list.id)}
                        >
                          {copiedId === list.id ? "Copié !" : "Copier"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* List Detail Modal */}
      <AnimatePresence>
        {selectedList && (
          <ListDetail
            list={selectedList}
            onClose={() => setSelectedList(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
