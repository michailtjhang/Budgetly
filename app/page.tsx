import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-4xl font-bold mb-4">Dompetin 💰</h1>
      <p className="mb-6">Catat keuanganmu dengan aman & mudah 🚀</p>

      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <Link href="/dashboard">
          <button className="px-6 py-2 bg-green-600 text-white rounded-lg shadow">
            Go to Dashboard
          </button>
        </Link>
        <div className="mt-4">
          <UserButton />
        </div>
      </SignedIn>
    </main>
  );
}
