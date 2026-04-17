"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";
import { Tag } from "lucide-react";

interface Transaction {
    id: number;
    type: "income" | "expense";
    amount: number;
    date: string;
    description: string;
    category?: string;
}

interface FinancialChartProps {
    transactions: Transaction[];
    month: string; // YYYY-MM
}

const CATEGORY_ICONS: Record<string, string> = {
    "Makanan & Minuman": "🍔",
    "Belanja & Pakaian": "🛍️",
    "Kesehatan & Skincare": "✨",
    "Investasi & Saham": "📈",
    "Top Up & Tabungan": "🏦",
    "Komunikasi & Internet": "📱",
    "Ibadah & Sosial": "🙏",
    "Tempat Tinggal": "🏠",
    "Hobby & Gaming": "🎮",
    "Elektronik": "🎧",
    "Transportasi": "🚗",
    "Biaya Admin & Pajak": "💸",
    "Pendidikan": "📚",
    "Tagihan": "📝",
    "Penghasilan": "💰",
    "Lainnya": "🏷️"
};

export default function FinancialChart({ transactions, month }: FinancialChartProps) {
    // 1. Prepare Data for Area Chart (Daily Activity)
    // ... (rest of dailyData calculation remains same)
    const daysInMonth = new Date(
        parseInt(month.split("-")[0]),
        parseInt(month.split("-")[1]),
        0
    ).getDate();

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dateStr = `${month}-${String(day).padStart(2, "0")}`;

        const dayTransactions = transactions.filter(t => t.date.startsWith(dateStr));

        const income = dayTransactions
            .filter(t => t.type === "income")
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        const expense = dayTransactions
            .filter(t => t.type === "expense")
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        return {
            name: String(day),
            date: dateStr,
            Pemasukan: income,
            Pengeluaran: expense
        };
    });

    // 2. Prepare Data for Pie Chart (Income vs Expense)
    const totalIncome = transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const pieData = [
        { name: "Pemasukan", value: totalIncome },
        { name: "Pengeluaran", value: totalExpense },
    ];

    // 3. Prepare Data for Category Pie Chart (Expense Breakdown)
    // Specially handle "Top Up & Tabungan": Only count if Net (Expense - Income) is positive
    const initialCategoryMap = transactions.reduce((acc, t) => {
        const cat = t.category || "Lainnya";
        if (!acc[cat]) acc[cat] = { income: 0, expense: 0 };
        if (t.type === "income") acc[cat].income += (t.amount || 0);
        else acc[cat].expense += (t.amount || 0);
        return acc;
    }, {} as Record<string, { income: number, expense: number }>);

    const categoryDataRaw = Object.entries(initialCategoryMap)
        .map(([name, data]) => {
            let value = 0;
            if (name === "Top Up & Tabungan" || name === "Investasi & Saham") {
                // For Transfers and Investments, we only care about the NET outflow (money gone)
                const netOutflow = data.expense - data.income;
                value = netOutflow > 0 ? netOutflow : 0;
            } else {
                // For other categories, we treat expenses as spending
                value = data.expense;
            }
            return { name, value };
        })
        .filter(item => item.value > 0) // Only show categories with actual spending
        .sort((a, b) => b.value - a.value);

    const categoryData = categoryDataRaw;

    // Recalculate total actual "spending" for the category chart to match its data
    const totalActualSpending = categoryData.reduce((sum, item) => sum + item.value, 0);

    const CATEGORY_COLORS = [
        "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
        "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#64748b"
    ];

    const COLORS = ["#10b981", "#f43f5e"]; // Emerald-500, Rose-500

    const formatRupiah = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    if (transactions.length === 0) {
        return null;
    }

    return (
        <div className="space-y-8 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Area Chart: Tren Keuangan */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6 font-primary">Tren Keuangan Bulan Ini</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                    tickFormatter={(value) => `${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number | undefined) => formatRupiah(value ?? 0)}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Pemasukan"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorIncome)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Pengeluaran"
                                    stroke="#f43f5e"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorExpense)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart: Perbandingan */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6 font-primary">Pemasukan vs Pengeluaran</h3>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        {totalIncome === 0 && totalExpense === 0 ? (
                            <p className="text-gray-400 text-sm">Belum ada data visual</p>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number | undefined) => formatRupiah(value ?? 0)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* New Section: Spending Category Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 font-primary">Pengeluaran per Kategori</h3>
                        <p className="text-gray-500 text-sm mt-1">Distribusi pengeluaran Anda bulan ini</p>
                    </div>
                    <div className="bg-rose-50 px-4 py-2 rounded-xl border border-rose-100">
                        <span className="text-rose-600 font-bold text-lg">Total: {formatRupiah(totalActualSpending)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* Donut Chart */}
                    <div className="h-[350px] w-full relative">
                        {categoryData.length === 0 ? (
                            <div className="h-full flex flex-center justify-center items-center flex-col text-gray-400">
                                <Tag className="w-12 h-12 mb-2 opacity-20" />
                                <p>Belum ada pengeluaran</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={90}
                                        outerRadius={120}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                        animationBegin={0}
                                        animationDuration={1500}
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-cat-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number | undefined) => formatRupiah(value ?? 0)}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                        {/* Center Text for Donut */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Boncos!</p>
                            <p className="text-xl font-bold text-indigo-600 truncate max-w-[120px]">
                                {categoryData[0]?.name || "-"}
                            </p>
                        </div>
                    </div>

                    {/* Detailed List with Progress Bars */}
                    <div className="space-y-5">
                        {categoryData.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 italic">
                                Catat pengeluaran Anda untuk melihat analisis di sini.
                            </div>
                        ) : (
                            categoryData.slice(0, 6).map((item, index) => {
                                const percentage = totalActualSpending > 0 ? Math.round((item.value / totalActualSpending) * 100) : 0;
                                return (
                                    <div key={item.name} className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl filter drop-shadow-sm">{CATEGORY_ICONS[item.name] || "🏷️"}</span>
                                                <span className="font-semibold text-gray-700">{item.name}</span>
                                                {index === 0 && (
                                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded-full uppercase tracking-tighter">
                                                        🔥 Boncos!
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-gray-900">{formatRupiah(item.value)}</span>
                                                <span className="text-gray-400 text-xs ml-2">({percentage}%)</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        {categoryData.length > 6 && (
                            <p className="text-center text-xs text-gray-400 italic mt-4">
                                + {categoryData.length - 6} kategori lainnya
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
