// app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Dashboard from "./Dashboard"; // komponen client

export default async function DashboardPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/"); // kalau belum login, balik ke halaman utama
    }

    return <Dashboard />; // kalau login, render dashboard
}
