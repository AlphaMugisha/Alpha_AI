"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Medical Student",
    avatar: "SC",
    rating: 5,
    content:
      "Alpha turned my 200-page anatomy textbook into perfectly structured notes and a quiz in minutes. I went from struggling to acing my exams!",
  },
  {
    name: "James Rodriguez",
    role: "Computer Science Major",
    avatar: "JR",
    rating: 5,
    content:
      "The AI chat is like having a genius tutor available 24/7. I asked it to explain recursion and it gave me the clearest explanation I've ever read.",
  },
  {
    name: "Emily Park",
    role: "High School Senior",
    avatar: "EP",
    rating: 5,
    content:
      "The flashcard generator is incredible! I uploaded my history notes and had 50 flashcards ready to study. My grades went up significantly.",
  },
  {
    name: "Michael Torres",
    role: "Law Student",
    avatar: "MT",
    rating: 5,
    content:
      "Being able to get complex legal concepts explained at different difficulty levels is a game-changer. The 'beginner mode' finally made contract law click for me.",
  },
  {
    name: "Priya Sharma",
    role: "MBA Student",
    avatar: "PS",
    rating: 5,
    content:
      "The study planner helped me organize an entire semester's worth of coursework. I've never felt more in control of my studies.",
  },
  {
    name: "Alex Kim",
    role: "Undergraduate Researcher",
    avatar: "AK",
    rating: 5,
    content:
      "I use the Notes Generator for every research paper I read. The AI extracts the key insights so I can focus on understanding, not note-taking.",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 px-6">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Students Love <span className="gradient-text">Alpha</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join thousands of students who are already studying smarter and
            achieving better results.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="w-4 h-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                &ldquo;{t.content}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {t.avatar}
                </div>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
