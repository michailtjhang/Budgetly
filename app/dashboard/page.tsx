import { currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
    const user = await currentUser();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">
                Halo, {user?.firstName || "User"} 👋
            </h1>
            <p className="mt-2 text-gray-600">Selamat datang di Dompetin Dashboard</p>
            {/* Nanti kita tambahkan TransactionForm + TransactionList di sini */}
        </div>
    );
}
