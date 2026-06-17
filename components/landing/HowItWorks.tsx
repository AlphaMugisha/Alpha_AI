"use client";

import { motion } from "framer-motion";
import { Key, Upload, Sparkles, Trophy } from "lucide-react";

const steps = [
  {
    icon: Key,
    step: "01",
    title: "Add Your API Key",
    description:
      "Get a free Gemini API key from Google AI Studio and add it in Settings. Your key stays private in your browser.",
  },
  {
    icon: Upload,
    step: "02",
    title: "Upload Your Content",
    description:
      "Upload study materials as PDF, DOCX, or TXT files, or simply type any topic you want to learn.",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "Let AI Work",
    description:
      "Alpha generates notes, quizzes, flashcards, and explanations tailored to your learning needs.",
  },
  {
    icon: Trophy,
    step: "04",
    title: "Learn & Succeed",
    description:
      "Study the AI-generated content, track your progress, and master any subject faster than ever before.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 gradient-bg">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Get Started in <span className="gradient-text">4 Simple Steps</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From setup to studying in under 2 minutes. No credit card, no
            complicated setup.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative text-center"
            >
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-px border-t-2 border-dashed border-amber-200 dark:border-amber-800 z-0" />
              )}
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/25">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-amber-600 dark:text-amber-400 font-bold text-sm mb-2">
                  Step {step.step}
                </div>
                <h3 className="font-bold text-lg mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
