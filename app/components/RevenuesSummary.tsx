"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

interface RevenuesSummaryProps {
  outletId: string;
}

export default function RevenuesSummary({ outletId }: RevenuesSummaryProps) {
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!outletId) return;

    // Fetch Sales
    const salesQuery = query(
      collection(db, "sales"),
      where("outletId", "==", outletId)
    );
    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      setSales(snapshot.docs.map((doc) => doc.data()));
    });

    // Fetch Expenses
    const expensesQuery = query(
      collection(db, "expenses"),
      where("outletId", "==", outletId)
    );
    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      setExpenses(snapshot.docs.map((doc) => doc.data()));
      setLoading(false);
    });

    return () => {
      unsubSales();
      unsubExpenses();
    };
  }, [outletId]);

  const totalRevenue = sales.reduce((sum, s) => {
    if (s.discountedTotalValue !== undefined && s.discountedTotalValue !== null) {
      return sum + s.discountedTotalValue;
    }
    const subtotal = s.quantity * s.unitPrice || 0;
    const discount = s.discountValue || 0;
    return sum + Math.max(subtotal - discount, 0);
  }, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const profit = totalRevenue - totalExpenses;
  const profitMargin =
    totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : 0;

  if (loading) {
    return (
      <div className="text-center text-gray-400 animate-pulse">
        Loading summary...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-600 dark:text-green-300">
        Sales & Revenue Summary
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 p-6 rounded-lg shadow-md border border-green-200 dark:border-green-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            Total Revenue
          </p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-300 mt-2">
            {totalRevenue.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {sales.length} sales transactions
          </p>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 p-6 rounded-lg shadow-md border border-red-200 dark:border-red-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            Total Expenses
          </p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-300 mt-2">
            {totalExpenses.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {expenses.length} expense records
          </p>
        </div>

        {/* Profit Card */}
        <div
          className={`bg-gradient-to-br p-6 rounded-lg shadow-md border ${
            profit >= 0
              ? "from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-800 border-emerald-200 dark:border-emerald-700"
              : "from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 border-orange-200 dark:border-orange-700"
          }`}
        >
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            Profit/Loss
          </p>
          <p
            className={`text-3xl font-bold mt-2 ${
              profit >= 0
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-orange-600 dark:text-orange-300"
            }`}
          >
            {profit.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {profit >= 0 ? "✓ Profitable" : "⚠ Loss"}
          </p>
        </div>

        {/* Profit Margin Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 p-6 rounded-lg shadow-md border border-blue-200 dark:border-blue-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            Profit Margin
          </p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-300 mt-2">
            {profitMargin}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            of total revenue
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-green-200 dark:border-green-700">
        <h3 className="text-lg font-semibold mb-4">Quick Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
              Average Sale Value
            </p>
            <p className="text-2xl font-bold">
              {sales.length > 0
                ? (totalRevenue / sales.length).toFixed(2)
                : "0.00"}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
              Average Expense
            </p>
            <p className="text-2xl font-bold">
              {expenses.length > 0
                ? (totalExpenses / expenses.length).toFixed(2)
                : "0.00"}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
              Total Units Sold
            </p>
            <p className="text-2xl font-bold">
              {sales.reduce((sum, s) => sum + s.quantity, 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
              Expense to Revenue
            </p>
            <p className="text-2xl font-bold">
              {totalRevenue > 0
                ? ((totalExpenses / totalRevenue) * 100).toFixed(2)
                : "0.00"}
              %
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {totalRevenue > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-green-200 dark:border-green-700">
          <h3 className="text-lg font-semibold mb-4">Revenue Breakdown</h3>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Expenses</span>
                <span className="text-sm font-medium">
                  {((totalExpenses / totalRevenue) * 100).toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div
                  className="bg-red-500 h-4 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      (totalExpenses / totalRevenue) * 100,
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Profit</span>
                <span className="text-sm font-medium">
                  {((profit / totalRevenue) * 100).toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all duration-300 ${
                    profit >= 0 ? "bg-green-500" : "bg-orange-500"
                  }`}
                  style={{
                    width: `${Math.max(Math.min((profit / totalRevenue) * 100, 100), 0)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
