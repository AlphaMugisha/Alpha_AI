"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useStudyData } from "@/hooks/useStudyData";
import { generateFlashcards } from "@/lib/ai";
import { flashcardDb } from "@/lib/db";
import { generateId, formatDate } from "@/lib/utils";
import { FlashcardDeck, Flashcard } from "@/types";
import { toast } from "sonner";
import {
  Layers,
  Upload,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  Plus,
  X,
  BookOpen,
  Shuffle,
  File,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function FlashcardView({ card }: { card: Flashcard }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="perspective-1000 w-full h-64 cursor-pointer" onClick={() => setFlipped(!flipped)}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex flex-col items-center justify-center p-8 text-white shadow-xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="text-xs font-medium uppercase tracking-wider mb-4 opacity-70">Front</div>
          <p className="text-xl font-semibold text-center">{card.front}</p>
          <div className="mt-6 text-xs opacity-60">Click to flip</div>
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex flex-col items-center justify-center p-8 text-white shadow-xl"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="text-xs font-medium uppercase tracking-wider mb-4 opacity-70">Back</div>
          <p className="text-lg text-center leading-relaxed">{card.back}</p>
          <div className="mt-6 text-xs opacity-60">Click to flip back</div>
        </div>
      </motion.div>
    </div>
  );
}

type PageMode = "list" | "study" | "create";

export default function FlashcardsPage() {
  const { aiConfig, hasApiKey } = useSettings();
  const { addSession } = useStudyData();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [mode, setMode] = useState<PageMode>("list");
  const [studyDeck, setStudyDeck] = useState<FlashcardDeck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [shuffled, setShuffled] = useState<Flashcard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputContent, setInputContent] = useState("");
  const [numCards, setNumCards] = useState("15");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const studyStartRef = useRef(0);
  const studyLoggedRef = useRef(false);

  const refreshDecks = async () => setDecks(await flashcardDb.getAll());

  // Log a flashcard study session (once) with the real time spent studying.
  const finishStudySession = () => {
    if (studyLoggedRef.current || !studyDeck) return;
    studyLoggedRef.current = true;
    const minutes = studyStartRef.current
      ? Math.max(1, Math.round((Date.now() - studyStartRef.current) / 60000))
      : 1;
    addSession("flashcards", `Studied: ${studyDeck.title}`, { duration: minutes });
  };

  useEffect(() => {
    refreshDecks().catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    const { validateFile: vf, parseFile: pf } = await import("@/lib/fileParser");
    const error = vf(file);
    if (error) { toast.error(error); return; }
    try {
      const parsed = await pf(file);
      setUploadedFile({ name: parsed.name, content: parsed.content });
      toast.success("File loaded!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleGenerate = async () => {
    const content = uploadedFile?.content || inputContent;
    if (!content.trim()) { toast.error("Please upload a file or enter content."); return; }
    if (!hasApiKey) { toast.error("Please add your Gemini API key in Settings."); return; }

    setIsGenerating(true);
    try {
      const cards = await generateFlashcards(aiConfig, content, parseInt(numCards));
      const deck: FlashcardDeck = {
        id: generateId(),
        title: uploadedFile?.name.replace(/\.[^.]+$/, "") || "Custom Deck",
        cards,
        createdAt: new Date(),
      };
      await flashcardDb.save(deck);
      await refreshDecks();
      startStudy(deck);
      addSession("flashcards", deck.title);
      toast.success(`${cards.length} flashcards created!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate flashcards");
    } finally {
      setIsGenerating(false);
    }
  };

  const startStudy = (deck: FlashcardDeck) => {
    const updated: FlashcardDeck = { ...deck, lastStudied: new Date() };
    flashcardDb.save(updated).then(() => refreshDecks()).catch(() => {});
    setStudyDeck(updated);
    setShuffled([...deck.cards]);
    setCardIndex(0);
    setMode("study");
    studyStartRef.current = Date.now();
    studyLoggedRef.current = false;
  };

  const shuffleDeck = () => {
    if (!studyDeck) return;
    const arr = [...studyDeck.cards];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffled(arr);
    setCardIndex(0);
    toast.success("Deck shuffled!");
  };

  const deleteDeck = async (id: string) => {
    await flashcardDb.delete(id);
    await refreshDecks();
    toast.success("Deck deleted");
  };

  if (mode === "study" && studyDeck && shuffled.length > 0) {
    const card = shuffled[cardIndex];
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{studyDeck.title}</h2>
              <p className="text-sm text-muted-foreground">
                Card {cardIndex + 1} of {shuffled.length}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={shuffleDeck}>
                <Shuffle className="w-4 h-4 mr-2" /> Shuffle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  finishStudySession();
                  setMode("list");
                }}
              >
                <X className="w-4 h-4 mr-2" /> Exit
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mb-2">
            {shuffled.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors cursor-pointer",
                  i === cardIndex ? "bg-primary" : i < cardIndex ? "bg-primary/40" : "bg-muted"
                )}
                onClick={() => setCardIndex(i)}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={card.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <FlashcardView card={card} />
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCardIndex(Math.max(0, cardIndex - 1))}
              disabled={cardIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Previous
            </Button>
            {cardIndex === shuffled.length - 1 ? (
              <Button
                onClick={() => { finishStudySession(); setCardIndex(0); toast.success("Deck complete! Starting over..."); }}
                className="bg-gradient-to-r from-violet-600 to-indigo-600"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Restart Deck
              </Button>
            ) : (
              <Button onClick={() => setCardIndex(Math.min(shuffled.length - 1, cardIndex + 1))}>
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (mode === "create") {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-xl">Create Flashcard Deck</h2>
            <Button variant="outline" size="sm" onClick={() => setMode("list")}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {uploadedFile ? (
                  <div className="flex items-center gap-3 text-left">
                    <File className="w-8 h-8 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">Click to change file</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="font-medium text-sm">Upload a file</p>
                    <p className="text-xs text-muted-foreground">Or paste content below</p>
                  </>
                )}
              </div>

              <div className="text-center text-sm text-muted-foreground">— or —</div>

              <div>
                <Label className="text-sm mb-2 block">Paste Content</Label>
                <Textarea
                  placeholder="Paste your study content here..."
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Number of Cards</Label>
                <Select value={numCards} onValueChange={setNumCards}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["10", "15", "20", "25", "30"].map(n => (
                      <SelectItem key={n} value={n}>{n} cards</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={(!uploadedFile && !inputContent.trim()) || isGenerating || !hasApiKey}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Layers className="w-4 h-4 mr-2" /> Generate Flashcards</>
                )}
              </Button>
              {!hasApiKey && (
                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/settings" className="text-primary hover:underline">Add your API key</Link> first.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Flashcards"
        description="Auto-generate flashcard decks and study with flip animations"
        icon={<Layers className="w-5 h-5" />}
        action={
          <Button onClick={() => setMode("create")} className="bg-gradient-to-r from-violet-600 to-indigo-600">
            <Plus className="w-4 h-4 mr-2" /> New Deck
          </Button>
        }
      />

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No Flashcard Decks Yet</h3>
          <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
            Create your first flashcard deck by uploading study material or pasting content.
          </p>
          <Button onClick={() => setMode("create")} className="bg-gradient-to-r from-violet-600 to-indigo-600">
            <Plus className="w-4 h-4 mr-2" /> Create First Deck
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <motion.div
              key={deck.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -2 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                      <Layers className="w-6 h-6 text-white" />
                    </div>
                    <button
                      onClick={() => deleteDeck(deck.id)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-semibold mb-1">{deck.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Badge variant="secondary">{deck.cards.length} cards</Badge>
                    <span className="text-xs">{formatDate(deck.createdAt)}</span>
                  </div>
                  {deck.lastStudied && (
                    <p className="text-xs text-muted-foreground mb-3">
                      Last studied: {formatDate(deck.lastStudied)}
                    </p>
                  )}
                  <Button className="w-full" onClick={() => startStudy(deck)}>
                    <BookOpen className="w-4 h-4 mr-2" /> Study Deck
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
