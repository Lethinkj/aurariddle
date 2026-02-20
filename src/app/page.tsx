"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-12">
        {/* Logo / Title */}
        <div className="space-y-4 animate-slide-up">
          <h1 className="text-5xl sm:text-7xl font-black gradient-text tracking-tight">
            AuraRiddle
          </h1>
          <p className="text-lg text-neutral-400 max-w-md mx-auto">
            Real-time word guessing game. Compete to be the fastest!
          </p>
        </div>

        {/* Letter boxes decoration */}
        <div className="flex justify-center gap-2 animate-pop-in">
          {"AURA".split("").map((letter, i) => (
            <div
              key={i}
              className="w-14 h-16 flex items-center justify-center text-2xl font-bold
                border-2 border-gold-500/50 rounded-lg bg-gold-900/20 text-gold-300"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/join" className="btn-primary text-lg w-full sm:w-auto text-center">
            🎮 Join Event
          </Link>
          <Link href="/admin" className="btn-secondary text-lg w-full sm:w-auto text-center">
            🔑 Admin Login
          </Link>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="glass-card p-6 space-y-2">
            <div className="text-3xl">📝</div>
            <h3 className="font-bold text-white">Create Events</h3>
            <p className="text-sm text-neutral-400">
              Admin sets up questions with word answers for players to guess.
            </p>
          </div>
          <div className="glass-card p-6 space-y-2">
            <div className="text-3xl">⚡</div>
            <h3 className="font-bold text-white">Race to Answer</h3>
            <p className="text-sm text-neutral-400">
              Fill in the letter boxes correctly. First to answer gets the most points!
            </p>
          </div>
          <div className="glass-card p-6 space-y-2">
            <div className="text-3xl">🏆</div>
            <h3 className="font-bold text-white">Win the Game</h3>
            <p className="text-sm text-neutral-400">
              Live leaderboard tracks scores. Compete for the top spot!
            </p>
          </div>
        </div>

        <p className="text-xs text-neutral-700">
          Built with Next.js, Supabase & deployed on Vercel
        </p>
      </div>
    </main>
  );
}
