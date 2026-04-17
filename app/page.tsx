import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Coffee } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen relative overflow-hidden bg-gray-50">

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-purple-500/20 blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-2xl px-4 text-center">
        <div className="mb-6">
          <Image
            src="/logo.png"
            alt="Budgetly Logo"
            width={96}
            height={96}
            className="object-contain rounded-3xl shadow-2xl"
          />
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

      <footer className="absolute bottom-6 flex flex-col items-center gap-3 text-sm text-gray-400">
        <a 
          href="https://trakteer.id/michail.kx" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full font-medium transition-all hover:scale-105 active:scale-95 border border-rose-100 shadow-sm"
        >
          <Coffee className="w-4 h-4" />
          Dukung via Trakteer
        </a>
        <p>&copy; {new Date().getFullYear()} Budgetly. All rights reserved.</p>
      </footer>
    </main>
  );
}
