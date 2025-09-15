"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";

interface Transaction {
    id: number;
    type: "income" | "expense";
    description: string;
    amount: number;
    date: string;
}

export default function Dashboard() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState<number>(0);
    const [type, setType] = useState<"income" | "expense">("income");
    const [activeFilter, setActiveFilter] = useState<"all" | "income" | "expense">("all");

    // 🚀 Load data dari JSON via API
    useEffect(() => {
        fetch("/api/transactions")
            .then((res) => res.json())
            .then((data) => setTransactions(data));
    }, []);

    // 💰 Tambah transaksi
    const addTransaction = async () => {
        if (!description || !amount) return;

        const newTransaction = {
            type,
            description,
            amount,
        };

        const res = await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTransaction),
        });

        const saved = await res.json();
        setTransactions([saved, ...transactions]);

        setDescription("");
        setAmount(0);
    };

    const income = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

    const expense = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    // Calculate remaining percentage (avoid division by zero)
    const remainingPercentage = income > 0 ? Math.round(((balance) / income) * 100) : 0;

    const filteredTransactions = transactions.filter((t) => {
        if (activeFilter === "all") return true;
        return t.type === activeFilter;
    });

    const formatRupiah = (amount: number) => {
        return new Intl.NumberFormat('id-ID').format(amount);
    };

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">BUDGETLY APPS</h1>
                    <UserButton afterSignOutUrl="/" />
                </div>

                {/* Balance Card */}
                <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-8 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
                        Rp. {formatRupiah(balance)},-
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Sisa uang kamu tersisa {remainingPercentage}% lagi
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-sm p-6">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-500 text-sm">Pemasukan</p>
                                <p className="text-2xl font-bold text-gray-800">Rp. {formatRupiah(income)},-</p>
                                <p className="text-blue-500 text-sm">{transactions.filter(t => t.type === 'income').length} Transaksi</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm p-6">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4">
                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-500 text-sm">Pengeluaran</p>
                                <p className="text-2xl font-bold text-gray-800">Rp. {formatRupiah(expense)},-</p>
                                <p className="text-red-500 text-sm">{transactions.filter(t => t.type === 'expense').length} Transaksi</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add Transaction Form */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Tambah Transaksi</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input
                            type="text"
                            placeholder="Deskripsi transaksi"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                            type="number"
                            placeholder="Jumlah"
                            value={amount || ""}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as "income" | "expense")}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                            <option value="income">Pemasukan</option>
                            <option value="expense">Pengeluaran</option>
                        </select>
                        <button
                            onClick={addTransaction}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                        >
                            Tambah
                        </button>
                    </div>
                </div>

                {/* Transaction History */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 md:mb-0">Ringkasan Transaksi</h3>

                        {/* Filter Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveFilter("income")}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeFilter === "income"
                                        ? "bg-blue-600 text-white"
                                        : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                                    }`}
                            >
                                Pemasukan
                            </button>
                            <button
                                onClick={() => setActiveFilter("expense")}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeFilter === "expense"
                                        ? "bg-red-600 text-white"
                                        : "bg-red-100 text-red-600 hover:bg-red-200"
                                    }`}
                            >
                                Pengeluaran
                            </button>
                        </div>
                    </div>

                    {/* Transactions List */}
                    {filteredTransactions.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <p className="text-gray-500">Belum ada transaksi</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredTransactions.map((transaction) => (
                                <div
                                    key={transaction.id}
                                    className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${transaction.type === "income"
                                                ? "bg-blue-100"
                                                : "bg-red-100"
                                            }`}>
                                            {transaction.type === "income" ? (
                                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                            ) : (
                                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17l-1.5-1.5m2.999-8.485c.44.44.44 1.154 0 1.596l-6.01 6.008a1.125 1.125 0 01-1.595 0l-.798-.798" />
                                                </svg>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">{transaction.description}</p>
                                            <p className="text-sm text-gray-500">{transaction.date}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${transaction.type === "income" ? "text-blue-600" : "text-red-600"
                                            }`}>
                                            Rp. {transaction.type === "income" ? "+" : "-"}{formatRupiah(transaction.amount)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}