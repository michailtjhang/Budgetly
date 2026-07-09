import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Coffee, ShieldCheck, PieChart, Wallet, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen relative overflow-hidden bg-slate-950 text-white">
      {/* Background Decor - Modern Dark Theme */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-violet-500/30 to-fuchsia-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-4xl px-4 text-center mt-12 mb-24">
        
        {/* Floating Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-gray-300 tracking-wide">Financial Freedom Starts Here</span>
        </div>

        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full"></div>
          <Image
            src="/logo.png"
            alt="Budgetly Logo"
            width={112}
            height={112}
            className="object-contain rounded-3xl shadow-2xl relative z-10 border border-white/10"
          />
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight text-white leading-tight">
          Manage Your Money <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            With Confidence
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 mb-12 leading-relaxed max-w-2xl mx-auto">
          Catat keuanganmu dengan aman, mudah, dan modern. 
          Pantau cashflow-mu secara real-time dan raih tujuan finansialmu tanpa ribet.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 w-full justify-center items-center">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="group relative px-8 py-4 bg-white text-gray-950 rounded-full font-bold shadow-[0_0_40px_rgba(99,102,241,0.3)] hover:shadow-[0_0_60px_rgba(99,102,241,0.5)] transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 overflow-hidden">
                <span className="relative z-10">Mulai Sekarang — Gratis</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <Link href="/dashboard">
              <button className="group relative px-8 py-4 bg-white text-gray-950 rounded-full font-bold shadow-[0_0_40px_rgba(99,102,241,0.3)] hover:shadow-[0_0_60px_rgba(99,102,241,0.5)] transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 overflow-hidden">
                <span className="relative z-10">Buka Dashboard</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </Link>
            <div className="mt-6 flex flex-col items-center">
              <span className="text-sm text-gray-400 block mb-3 font-medium">Login sebagai:</span>
              <div className="scale-125 ring-4 ring-white/10 rounded-full">
                <UserButton />
              </div>
            </div>
          </SignedIn>
        </div>

        {/* Feature Highlights */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl opacity-80">
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm transition-colors hover:bg-white/10">
             <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400"><Wallet className="w-6 h-6" /></div>
             <div className="text-left">
               <h3 className="font-semibold text-white">Multi Akun</h3>
               <p className="text-xs text-gray-400">Pantau semua dompetmu</p>
             </div>
          </div>
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm transition-colors hover:bg-white/10">
             <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400"><PieChart className="w-6 h-6" /></div>
             <div className="text-left">
               <h3 className="font-semibold text-white">Statistik Visual</h3>
               <p className="text-xs text-gray-400">Analisa pengeluaran</p>
             </div>
          </div>
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm transition-colors hover:bg-white/10">
             <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400"><ShieldCheck className="w-6 h-6" /></div>
             <div className="text-left">
               <h3 className="font-semibold text-white">Aman & Terenkripsi</h3>
               <p className="text-xs text-gray-400">Privasi data terjamin</p>
             </div>
          </div>
        </div>
      </div>

      <footer className="absolute bottom-6 flex flex-col md:flex-row items-center gap-4 md:gap-8 text-sm text-gray-500 z-10 w-full justify-center px-4">
        <a 
          href="https://trakteer.id/michail.kx" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-full font-medium transition-all hover:scale-105 active:scale-95 border border-rose-500/20 backdrop-blur-sm"
        >
          <Coffee className="w-4 h-4" />
          Dukung via Trakteer
        </a>
        <p className="font-medium tracking-wide">&copy; {new Date().getFullYear()} Budgetly. All rights reserved.</p>
      </footer>
    </main>
  );
}
