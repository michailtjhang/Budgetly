import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Wallet, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen relative overflow-hidden bg-gray-50">

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-purple-500/20 blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-2xl px-4 text-center">
        <div className="mb-6 p-4 bg-white/50 backdrop-blur-xl rounded-2xl shadow-xl shadow-indigo-100/50 border border-white/50 inline-flex items-center justify-center text-indigo-600">
          <Wallet className="w-12 h-12" />
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight text-gray-900">
          Budgetly <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">App</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed max-w-lg mx-auto">
          Catat keuanganmu dengan aman, mudah, dan modern.
          Pantau cashflow-mu tanpa ribet. 🚀
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                Mulai Sekarang
                <ArrowRight className="w-4 h-4" />
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <Link href="/dashboard">
              <button className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                Buka Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <div className="mt-6">
              <span className="text-sm text-gray-500 block mb-2">Login sebagai:</span>
              <div className="scale-125">
                <UserButton />
              </div>
            </div>
          </SignedIn>
        </div>
      </div>

      <footer className="absolute bottom-6 text-sm text-gray-400">
        &copy; {new Date().getFullYear()} Budgetly. All rights reserved.
      </footer>
    </main>
  );
}
