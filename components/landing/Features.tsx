"use client";

import { motion } from "framer-motion";
import {
  MessageCircle,
  FileText,
  Brain,
  Layers,
  Lightbulb,
  Calendar,
  Sparkles,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "AI Study Chat",
    description:
      "Chat with Gemini AI for instant explanations, study help, and personalized guidance on any topic.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: FileText,
    title: "Smart Notes Generator",
    description:
      "Upload PDFs, DOCXs, or text files and get beautifully structured, comprehensive study notes in seconds.",
    color: "from-violet-500 to-indigo-600",
  },
  {
    icon: Brain,
    title: "Instant Quiz Generator",
    description:
      "Transform any content into multiple-choice quizzes with detailed explanations for each answer.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Layers,
    title: "Smart Flashcards",
    description:
      "Auto-generate flashcard decks with flip animations. Study mode with spaced repetition principles.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Lightbulb,
    title: "Topic Explainer",
    description:
      "Enter any topic and get clear explanations at beginner, intermediate, or advanced difficulty levels.",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: Calendar,
    title: "Study Planner",
    description:
      "Create personalized study schedules, track progress, set goals, and stay organized for exams.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: Sparkles,
    title: "AI Insights",
    description:
      "Get personalized study insights and recommendations based on your learning patterns and progress.",
    color: "from-amber-500 to-blue-600",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    description:
      "Your API key and data stay local in your browser. No server storage, complete privacy guaranteed.",
    color: "from-slate-500 to-gray-600",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-amber-200 dark:border-amber-800">
            Everything You Need
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Features Built for{" "}
            <span className="gradient-text">Student Success</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every tool you need to study more effectively, understand deeper,
            and retain more information — powered by cutting-edge AI.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="group relative rounded-2xl border bg-card p-6 hover:shadow-xl transition-shadow duration-300"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}
              >
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
