"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function CTA() {
  const { user } = useAuth();

  return (
    <section className="py-24 px-6">
      <div className="container max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-12 text-center text-white overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              Free to Use — No Credit Card Required
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ready to Transform Your Studies?
            </h2>
            <p className="text-amber-100 text-lg max-w-xl mx-auto mb-8">
              Join thousands of students already using Alpha. Create a
              free account and bring your own Gemini or OpenAI API key to get
              started instantly.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-amber-700 hover:bg-amber-50 text-lg px-8 h-12 font-semibold"
                >
                  <Link href="/dashboard">
                    Go to Dashboard <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    className="bg-white text-amber-700 hover:bg-amber-50 text-lg px-8 h-12 font-semibold"
                  >
                    <Link href="/signup">
                      Create Free Account <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="border-white/40 text-white hover:bg-white/10 text-lg px-8 h-12"
                  >
                    <Link href="/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
