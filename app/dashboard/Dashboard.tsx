"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    PlusCircle,
    History,
    TrendingUp,
    TrendingDown,
    Pencil,
    Trash2,
    Calendar,
    XCircle,
    Search,
    ChevronDown,
    Check,
    Plus,
    Tag
} from "lucide-react";
import FinancialChart from "@/components/FinancialChart";

interface Transaction {
    id: number;
    type: "income" | "expense";
    description: string;
    amount: number;
    date: string;
    account?: string;
    category?: string;
}

const ACCOUNT_OPTIONS = ["BCA", "blu by BCA", "BRI", "BNI", "Mandiri", "BJB", "Permata", "SeaBank", "Jago", "Flip", "GoPay", "ShopeePay", "OVO", "DANA", "Bibit", "Stockbit", "Ajaib", "Superbank", "Bank Saqu", "Krom Bank", "Dana Darurat", "Uang Tunai", "Lainnya"];

const CATEGORY_OPTIONS = [
    { name: "Makanan & Minuman", icon: "🍔" },
    { name: "Belanja & Pakaian", icon: "🛍️" },
    { name: "Kesehatan & Skincare", icon: "✨" },
    { name: "Investasi & Saham", icon: "📈" },
    { name: "Top Up & Tabungan", icon: "🏦" },
    { name: "Komunikasi & Internet", icon: "📱" },
    { name: "Ibadah & Sosial", icon: "🙏" },
    { name: "Tempat Tinggal", icon: "🏠" },
    { name: "Hobby & Gaming", icon: "🎮" },
    { name: "Elektronik", icon: "🎧" },
    { name: "Transportasi", icon: "🚗" },
    { name: "Biaya Admin & Pajak", icon: "💸" },
    { name: "Pendidikan", icon: "📚" },
    { name: "Tagihan", icon: "📝" },
    { name: "Penghasilan", icon: "💰" },
    { name: "Lainnya", icon: "🏷️" }
];

export default function Dashboard() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState<number | "">("");
    const [type, setType] = useState<"income" | "expense">("income");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]); // Default today
    const [account, setAccount] = useState("BRI");
    const [customAccount, setCustomAccount] = useState("");
    const [category, setCategory] = useState("Lainnya");
    const [customCategory, setCustomCategory] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [accountSearch, setAccountSearch] = useState("");
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const [categorySearch, setCategorySearch] = useState("");
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    // Filter State
    const [activeFilter, setActiveFilter] = useState<"all" | "income" | "expense">("all");
    const [activeAccountFilter, setActiveAccountFilter] = useState<string>("all");
    const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");
    const [historyAccountSearch, setHistoryAccountSearch] = useState("");
    const [showHistoryAccountDropdown, setShowHistoryAccountDropdown] = useState(false);
    const [historyCategorySearch, setHistoryCategorySearch] = useState("");
    const [showHistoryCategoryDropdown, setShowHistoryCategoryDropdown] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [loading, setLoading] = useState(false);

    // 🚀 Load data dari JSON via API
    useEffect(() => {
        fetch("/api/transactions")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setTransactions(data);
                } else {
                    console.error("Failed to fetch transactions:", data);
                    setTransactions([]);
                }
            })
            .catch(err => {
                console.error("Network error:", err);
                setTransactions([]);
            });
    }, []);

    // 💰 Tambah / Edit Transaksi
    const saveTransaction = async () => {
        if (!description || !amount || !date) return;
        setLoading(true);

        const transactionData = {
            type,
            description,
            amount: Number(amount),
            date: new Date(date).toISOString(),
            account: account === "Lainnya" ? customAccount : account,
            category: category === "Lainnya" ? customCategory : category,
        };

        try {
            let res;
            if (editingId) {
                // Edit Mode (PUT)
                res = await fetch("/api/transactions", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: editingId, ...transactionData }),
                });
            } else {
                // Add Mode (POST)
                res = await fetch("/api/transactions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(transactionData),
                });
            }

            const saved = await res.json();

            if (res.ok) {
                if (editingId) {
                    setTransactions(transactions.map(t => t.id === editingId ? saved : t));
                    alert("Transaksi berhasil diupdate!");
                } else {
                    setTransactions([saved, ...transactions]);
                }
                resetForm();
            } else {
                alert("Gagal menyimpan transaksi: " + (saved.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("Terjadi kesalahan jaringan");
        }
        setLoading(false);
    };

    const deleteTransaction = async (id: number) => {
        if (!confirm("Yakin mau hapus transaksi ini?")) return;

        try {
            const res = await fetch(`/api/transactions?id=${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setTransactions(transactions.filter(t => t.id !== id));
            } else {
                alert("Gagal menghapus transaksi");
            }
        } catch (error) {
            console.error("Delete error:", error);
        }
    };

    const resetForm = () => {
        setDescription("");
        setAmount("");
        setType("income");
        setDate(new Date().toISOString().split("T")[0]);
        setAccount("BRI");
        setCustomAccount("");
        setCategory("Lainnya");
        setCustomCategory("");
        setEditingId(null);
    };

    const handleEdit = (t: Transaction) => {
        setDescription(t.description);
        setAmount(t.amount);
        setType(t.type);
        setDate(new Date(t.date).toISOString().split("T")[0]);

        if (t.account && !ACCOUNT_OPTIONS.includes(t.account)) {
            setAccount("Lainnya");
            setCustomAccount(t.account);
        } else {
            setAccount(t.account || "BRI");
            setCustomAccount("");
        }

        if (t.category && !CATEGORY_OPTIONS.some(opt => opt.name === t.category)) {
            setCategory("Lainnya");
            setCustomCategory(t.category);
        } else {
            setCategory(t.category || "Lainnya");
            setCustomCategory("");
        }

        setEditingId(t.id);

        // Scroll to top to see form
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Filter Logic: Filter by Month AND Type
    const filteredByMonth = (transactions || []).filter(t =>
        t && t.date && typeof t.date === "string" && t.date.startsWith(selectedMonth)
    );

    // Calculate Summary based on MONTHLY data
    // Categories that need "Net Outflow" logic: Top Up & Investasi
    const NET_ONLY_CATEGORIES = ["Top Up & Tabungan", "Investasi & Saham"];

    // 1. Calculate totals for normal categories
    const normalIncome = filteredByMonth
        .filter((t) => t.type === "income" && !NET_ONLY_CATEGORIES.includes(t.category || ""))
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const normalExpense = filteredByMonth
        .filter((t) => t.type === "expense" && !NET_ONLY_CATEGORIES.includes(t.category || ""))
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    // 2. Calculate net for specialized categories
    const netSpecializedExpense = NET_ONLY_CATEGORIES.reduce((totalNet, catName) => {
        const catTransactions = filteredByMonth.filter(t => t.category === catName);
        const catIncome = catTransactions.filter(t => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
        const catExpense = catTransactions.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);

        const netOutflow = catExpense - catIncome;
        return totalNet + (netOutflow > 0 ? netOutflow : 0);
    }, 0);

    // Final global totals for the dashboard boxes
    const income = normalIncome; // Incomes in TopUp/Invest are treated as offsets, not "earned income"
    const expense = normalExpense + netSpecializedExpense;

    const balance = income - expense;
    const remainingPercentage = income > 0 ? Math.round(((balance) / income) * 100) : 0;

    // Calculate Overall Summary (All Time)
    const totalIncomeAllTime = (transactions || [])
        .filter((t) => t && t.type === "income")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpenseAllTime = (transactions || [])
        .filter((t) => t && t.type === "expense")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalBalanceAllTime = totalIncomeAllTime - totalExpenseAllTime;

    // Calculate Balance by Account (All Time)
    const accountBalances = (transactions || []).reduce((acc, t) => {
        const accountName = t.account || "Lainnya";
        const amount = t.amount || 0;

        if (!acc[accountName]) {
            acc[accountName] = 0;
        }

        if (t.type === "income") {
            acc[accountName] += amount;
        } else {
            acc[accountName] -= amount;
        }

        return acc;
    }, {} as Record<string, number>);

    // Get unique accounts list including defaults
    const allAccounts = Array.from(new Set([...ACCOUNT_OPTIONS, ...Object.keys(accountBalances)]));

    // Final list filter for display
    const visibleTransactions = filteredByMonth.filter((t) => {
        const matchesType = activeFilter === "all" ? true : t.type === activeFilter;
        const matchesAccount = activeAccountFilter === "all" ? true : (t.account === activeAccountFilter || (activeAccountFilter === "Lainnya" && !ACCOUNT_OPTIONS.includes(t.account || "")));
        const matchesCategory = activeCategoryFilter === "all" ? true : (t.category === activeCategoryFilter || (activeCategoryFilter === "Lainnya" && !CATEGORY_OPTIONS.some(opt => opt.name === t.category)));
        return matchesType && matchesAccount && matchesCategory;
    });

    const formatRupiah = (amount: number) => {
        return new Intl.NumberFormat('id-ID').format(amount);
    };

    const getAccountColor = (acc: string) => {
        switch (acc) {
            case "BCA": return "bg-blue-100 text-blue-800";
            case "blu by BCA": return "bg-cyan-100 text-cyan-800";
            case "BRI": return "bg-blue-50 text-blue-600";
            case "BNI": return "bg-teal-50 text-teal-600";
            case "Mandiri": return "bg-yellow-100 text-yellow-700";
            case "BJB": return "bg-cyan-100 text-cyan-700";
            case "Permata": return "bg-lime-100 text-lime-700";
            case "SeaBank": return "bg-orange-100 text-orange-600";
            case "Jago": return "bg-fuchsia-100 text-fuchsia-600";
            case "Flip": return "bg-orange-500 text-white";
            case "GoPay": return "bg-green-100 text-green-600";
            case "ShopeePay": return "bg-orange-200 text-orange-800";
            case "OVO": return "bg-violet-100 text-violet-700";
            case "DANA": return "bg-sky-100 text-sky-600";
            case "Bibit": return "bg-emerald-100 text-emerald-600";
            case "Stockbit": return "bg-green-200 text-green-800";
            case "Ajaib": return "bg-purple-200 text-purple-800";
            case "Superbank": return "bg-yellow-400 text-yellow-950";
            case "Bank Saqu": return "bg-orange-200 text-orange-800";
            case "Krom Bank": return "bg-violet-200 text-violet-800";
            case "Dana Darurat": return "bg-red-100 text-red-600";
            case "Uang Tunai": return "bg-slate-200 text-slate-700";
            default: return "bg-gray-100 text-gray-600";
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 pb-20">
            {/* Navbar */}
            <nav className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <img 
                                src="/logo.png" 
                                alt="Budgetly Logo" 
                                className="w-10 h-10 object-contain rounded-xl"
                            />
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                                Budgetly
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Month Selector in Navbar */}
                            <div className="hidden sm:flex items-center bg-gray-100 rounded-lg px-2 py-1">
                                <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 outline-none"
                                />
                            </div>
                            <UserButton afterSignOutUrl="/" />
                        </div>
                    </div>
                    {/* Mobile Month Selector */}
                    <div className="sm:hidden pb-2">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                </div>
            </nav>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* Hero / Balance Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-600 p-8 text-white shadow-xl shadow-indigo-200">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-4">
                            <div>
                                <p className="text-indigo-100 font-medium mb-1">
                                    Saldo Bulan {new Date(selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                </p>
                                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                                    Rp {formatRupiah(balance)}
                                </h2>
                            </div>

                            {/* Overall Balance Indicator */}
                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center gap-2 text-sm bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20">
                                    <span className="text-indigo-100">Budget Bulan Ini:</span>
                                    <span className="font-bold">{remainingPercentage}%</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm bg-indigo-500/30 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20">
                                    <span className="text-indigo-100 italic">Total Saldo:</span>
                                    <span className="font-bold">Rp {formatRupiah(totalBalanceAllTime)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-2 text-indigo-100">
                                    <ArrowUpCircle className="w-4 h-4 text-emerald-300" />
                                    <span className="text-sm">Pemasukan</span>
                                </div>
                                <p className="text-xl font-semibold">Rp {formatRupiah(income)}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-2 text-indigo-100">
                                    <ArrowDownCircle className="w-4 h-4 text-rose-300" />
                                    <span className="text-sm">Pengeluaran</span>
                                </div>
                                <p className="text-xl font-semibold">Rp {formatRupiah(expense)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Decorative circles */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-indigo-500/30 blur-3xl"></div>
                </div>

                {/* Account Balances Scrollable Section */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 px-1">Saldo per Akun</h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                        {allAccounts.map((acc, idx) => {
                            const balance = accountBalances[acc] || 0;
                            return (
                                <div key={idx} className="min-w-[160px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm snap-start flex-shrink-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getAccountColor(acc)}`}>
                                            {acc.substring(0, 1)}
                                        </div>
                                        <span className="text-sm font-medium text-gray-600 truncate">{acc}</span>
                                    </div>
                                    <p className={`text-lg font-bold ${balance >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
                                        Rp {formatRupiah(balance)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Charts Section */}
                <FinancialChart transactions={filteredByMonth} month={selectedMonth} />

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Input Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className={`bg-white rounded-2xl shadow-sm border p-6 transition-colors ${editingId ? 'border-indigo-300 ring-2 ring-indigo-500/10' : 'border-gray-100'}`}>

                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    {editingId ? <Pencil className="w-5 h-5 text-indigo-600" /> : <PlusCircle className="w-5 h-5 text-indigo-600" />}
                                    {editingId ? "Edit Transaksi" : "Tambah Transaksi"}
                                </h3>
                                {editingId && (
                                    <button onClick={resetForm} className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-full">
                                        <XCircle className="w-3 h-3" /> Batal
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                                    <input
                                        type="text"
                                        placeholder="Cth: Beli Kopi"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Akun / Sumber Dana</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm bg-white flex justify-between items-center"
                                        >
                                            <span className={account ? "text-gray-900" : "text-gray-400"}>
                                                {account || "Pilih Akun"}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAccountDropdown ? "rotate-180" : ""}`} />
                                        </button>

                                        {showAccountDropdown && (
                                            <div className="absolute z-20 w-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                                <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Cari akun..."
                                                            value={accountSearch}
                                                            onChange={(e) => setAccountSearch(e.target.value)}
                                                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto p-1 py-2">
                                                    {ACCOUNT_OPTIONS.filter(opt =>
                                                        opt.toLowerCase().includes(accountSearch.toLowerCase())
                                                    ).map((opt) => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => {
                                                                setAccount(opt);
                                                                setShowAccountDropdown(false);
                                                                setAccountSearch("");
                                                            }}
                                                            className="w-full px-4 py-2 text-sm text-left hover:bg-indigo-50 rounded-lg flex justify-between items-center transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-2 h-2 rounded-full ${getAccountColor(opt).split(' ')[0]}`} />
                                                                <span className={account === opt ? "font-semibold text-indigo-600" : "text-gray-700"}>
                                                                    {opt}
                                                                </span>
                                                            </div>
                                                            {account === opt && <Check className="w-4 h-4 text-indigo-600" />}
                                                        </button>
                                                    ))}
                                                    {ACCOUNT_OPTIONS.filter(opt =>
                                                        opt.toLowerCase().includes(accountSearch.toLowerCase())
                                                    ).length === 0 && (
                                                            <div className="px-4 py-8 text-center text-gray-400 text-sm italic">
                                                                Akun tidak ditemukan
                                                            </div>
                                                        )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Handle Click Outside (Simple version via overlay) */}
                                    {showAccountDropdown && (
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => {
                                                setShowAccountDropdown(false);
                                                setAccountSearch("");
                                            }}
                                        />
                                    )}

                                    {account === "Lainnya" && (
                                        <input
                                            type="text"
                                            placeholder="Masukkan nama bank/e-wallet"
                                            value={customAccount}
                                            onChange={(e) => setCustomAccount(e.target.value)}
                                            className="w-full mt-2 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm bg-white flex justify-between items-center"
                                        >
                                            <span className={category ? "text-gray-900" : "text-gray-400"}>
                                                {CATEGORY_OPTIONS.find(c => c.name === category)?.icon || "🏷️"} {category || "Pilih Kategori"}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`} />
                                        </button>

                                        {showCategoryDropdown && (
                                            <div className="absolute z-20 w-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                                <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Cari kategori..."
                                                            value={categorySearch}
                                                            onChange={(e) => setCategorySearch(e.target.value)}
                                                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto p-1 py-2">
                                                    {CATEGORY_OPTIONS.filter(opt =>
                                                        opt.name.toLowerCase().includes(categorySearch.toLowerCase())
                                                    ).map((opt) => (
                                                        <button
                                                            key={opt.name}
                                                            type="button"
                                                            onClick={() => {
                                                                setCategory(opt.name);
                                                                setShowCategoryDropdown(false);
                                                                setCategorySearch("");
                                                            }}
                                                            className="w-full px-4 py-2 text-sm text-left hover:bg-indigo-50 rounded-lg flex justify-between items-center transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-lg">{opt.icon}</span>
                                                                <span className={category === opt.name ? "font-semibold text-indigo-600" : "text-gray-700"}>
                                                                    {opt.name}
                                                                </span>
                                                            </div>
                                                            {category === opt.name && <Check className="w-4 h-4 text-indigo-600" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Overlay for Click Outside */}
                                    {showCategoryDropdown && (
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => {
                                                setShowCategoryDropdown(false);
                                                setCategorySearch("");
                                            }}
                                        />
                                    )}

                                    {category === "Lainnya" && (
                                        <input
                                            type="text"
                                            placeholder="Masukkan nama kategori baru"
                                            value={customCategory}
                                            onChange={(e) => setCustomCategory(e.target.value)}
                                            className="w-full mt-2 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                                        <button
                                            onClick={() => setType("income")}
                                            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${type === "income"
                                                ? "bg-white text-indigo-600 shadow-sm"
                                                : "text-gray-500 hover:text-gray-700"
                                                }`}
                                        >
                                            Pemasukan
                                        </button>
                                        <button
                                            onClick={() => setType("expense")}
                                            className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${type === "expense"
                                                ? "bg-white text-rose-600 shadow-sm"
                                                : "text-gray-500 hover:text-gray-700"
                                                }`}
                                        >
                                            Pengeluaran
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={saveTransaction}
                                    disabled={loading}
                                    className={`w-full py-3 text-white rounded-xl font-medium shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 ${editingId
                                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                                        }`}
                                >
                                    {loading ? "Menyimpan..." : (editingId ? "Update Transaksi" : "Simpan Transaksi")}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: List & History */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 shrink-0">
                                    <History className="w-5 h-5 text-indigo-600" />
                                    Riwayat Transaksi
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                                    {/* Account Filter Dropdown (Searchable) */}
                                    <div className="relative shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setShowHistoryAccountDropdown(!showHistoryAccountDropdown)}
                                            className="px-3 py-2 h-[34px] rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500/20 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <Wallet className="w-3 h-3" />
                                            {activeAccountFilter === "all" ? "Semua Akun" : activeAccountFilter}
                                            <ChevronDown className={`w-3 h-3 transition-transform ${showHistoryAccountDropdown ? "rotate-180" : ""}`} />
                                        </button>

                                        {showHistoryAccountDropdown && (
                                            <div className="absolute z-20 left-0 lg:right-0 mt-2 w-60 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                                <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Cari akun..."
                                                            value={historyAccountSearch}
                                                            onChange={(e) => setHistoryAccountSearch(e.target.value)}
                                                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto p-1 py-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveAccountFilter("all");
                                                            setShowHistoryAccountDropdown(false);
                                                            setHistoryAccountSearch("");
                                                        }}
                                                        className="w-full px-3 py-2 text-xs text-left hover:bg-indigo-50 rounded-lg flex justify-between items-center transition-colors group"
                                                    >
                                                        <span className={activeAccountFilter === "all" ? "font-semibold text-indigo-600" : "text-gray-700"}>
                                                            Semua Akun
                                                        </span>
                                                        {activeAccountFilter === "all" && <Check className="w-3 h-3 text-indigo-600" />}
                                                    </button>
                                                    {allAccounts.filter(acc =>
                                                        acc.toLowerCase().includes(historyAccountSearch.toLowerCase())
                                                    ).map((acc) => (
                                                        <button
                                                            key={acc}
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveAccountFilter(acc);
                                                                setShowHistoryAccountDropdown(false);
                                                                setHistoryAccountSearch("");
                                                            }}
                                                            className="w-full px-3 py-2 text-xs text-left hover:bg-indigo-50 rounded-lg flex justify-between items-center transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${getAccountColor(acc).split(' ')[0]}`} />
                                                                <span className={activeAccountFilter === acc ? "font-semibold text-indigo-600" : "text-gray-700"}>
                                                                    {acc}
                                                                </span>
                                                            </div>
                                                            {activeAccountFilter === acc && <Check className="w-3 h-3 text-indigo-600" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Overlay for Click Outside */}
                                    {showHistoryAccountDropdown && (
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => {
                                                setShowHistoryAccountDropdown(false);
                                                setHistoryAccountSearch("");
                                            }}
                                        />
                                    )}

                                    {/* Category Filter Dropdown (Searchable) */}
                                    <div className="relative shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setShowHistoryCategoryDropdown(!showHistoryCategoryDropdown)}
                                            className="px-3 py-2 h-[34px] rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500/20 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <Tag className="w-3 h-3" />
                                            {activeCategoryFilter === "all" ? "Semua Kategori" : activeCategoryFilter}
                                            <ChevronDown className={`w-3 h-3 transition-transform ${showHistoryCategoryDropdown ? "rotate-180" : ""}`} />
                                        </button>

                                        {showHistoryCategoryDropdown && (
                                            <div className="absolute z-20 left-0 lg:right-0 mt-2 w-60 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                                <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Cari kategori..."
                                                            value={historyCategorySearch}
                                                            onChange={(e) => setHistoryCategorySearch(e.target.value)}
                                                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto p-1 py-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveCategoryFilter("all");
                                                            setShowHistoryCategoryDropdown(false);
                                                            setHistoryCategorySearch("");
                                                        }}
                                                        className="w-full px-3 py-2 text-xs text-left hover:bg-indigo-50 rounded-lg flex justify-between items-center transition-colors group"
                                                    >
                                                        <span className={activeCategoryFilter === "all" ? "font-semibold text-indigo-600" : "text-gray-700"}>
                                                            Semua Kategori
                                                        </span>
                                                        {activeCategoryFilter === "all" && <Check className="w-3 h-3 text-indigo-600" />}
                                                    </button>
                                                    {CATEGORY_OPTIONS.filter(opt =>
                                                        opt.name.toLowerCase().includes(historyCategorySearch.toLowerCase())
                                                    ).map((opt) => (
                                                        <button
                                                            key={opt.name}
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveCategoryFilter(opt.name);
                                                                setShowHistoryCategoryDropdown(false);
                                                                setHistoryCategorySearch("");
                                                            }}
                                                            className="w-full px-3 py-2 text-xs text-left hover:bg-indigo-50 rounded-lg flex justify-between items-center transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm">{opt.icon}</span>
                                                                <span className={activeCategoryFilter === opt.name ? "font-semibold text-indigo-600" : "text-gray-700"}>
                                                                    {opt.name}
                                                                </span>
                                                            </div>
                                                            {activeCategoryFilter === opt.name && <Check className="w-3 h-3 text-indigo-600" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Overlay for Category Click Outside */}
                                    {showHistoryCategoryDropdown && (
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => {
                                                setShowHistoryCategoryDropdown(false);
                                                setHistoryCategorySearch("");
                                            }}
                                        />
                                    )}

                                    <button
                                        onClick={() => setActiveFilter("all")}
                                        className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors h-[34px] flex items-center shrink-0 whitespace-nowrap ${activeFilter === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                            }`}
                                    >
                                        Semua
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter("income")}
                                        className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors h-[34px] flex items-center shrink-0 whitespace-nowrap ${activeFilter === "income" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                            }`}
                                    >
                                        Pemasukan
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter("expense")}
                                        className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors h-[34px] flex items-center shrink-0 whitespace-nowrap ${activeFilter === "expense" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                            }`}
                                    >
                                        Pengeluaran
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {visibleTransactions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <Wallet className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-gray-500">Belum ada transaksi di bulan ini</p>
                                    </div>
                                ) : (
                                    visibleTransactions.map((transaction) => (
                                        <div
                                            key={transaction.id}
                                            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all duration-200 gap-4"
                                        >
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${transaction.type === "income" ? "bg-emerald-100/50 text-emerald-600" : "bg-rose-100/50 text-rose-600"
                                                    }`}>
                                                    {transaction.type === "income" ? (
                                                        <TrendingUp className="w-6 h-6" />
                                                    ) : (
                                                        <TrendingDown className="w-6 h-6" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                                        {transaction.description}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {transaction.date ? new Date(transaction.date).toLocaleDateString("id-ID", {
                                                            day: "numeric", month: "long", year: "numeric"
                                                        }) : "Tanpa Tanggal"}

                                                        {transaction.account && (
                                                            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] border border-transparent font-medium ${getAccountColor(transaction.account)}`}>
                                                                {transaction.account}
                                                            </span>
                                                        )}

                                                        {transaction.category && (
                                                            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] border border-gray-200 bg-gray-50 text-gray-600 font-medium flex items-center gap-1">
                                                                <span>{CATEGORY_OPTIONS.find(c => c.name === transaction.category)?.icon || "🏷️"}</span>
                                                                {transaction.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                                                <p className={`font-bold whitespace-nowrap ${transaction.type === "income" ? "text-emerald-600" : "text-gray-900"
                                                    }`}>
                                                    {transaction.type === "income" ? "+" : "-"} Rp {formatRupiah(transaction.amount)}
                                                </p>

                                                {/* Action Buttons */}
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(transaction)}
                                                        className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTransaction(transaction.id)}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}