"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { logHistory } from "@/lib/history";
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useAuth } from "./AuthProvider";

interface Expense {
  id: string;
  description: string;
  amount: number;
  outletId: string;
  createdAt: number;
}

interface ExpenseManagerProps {
  outletId: string;
}

export default function ExpenseManager({ outletId }: ExpenseManagerProps) {
  const { user, userDoc } = useAuth();
  const isAdmin = !!userDoc && userDoc.role === "admin";
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [rawMaterialOptions, setRawMaterialOptions] = useState<string[]>([]);
  const [inedibleOptions, setInedibleOptions] = useState<string[]>([]);
  const [expenseOptions, setExpenseOptions] = useState<string[]>([]);

  // date range and creator filter
  const toLocalDateInput = (d: Date) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  };
  const todayInput = toLocalDateInput(new Date());
  const [startDate, setStartDate] = useState<string>(todayInput);
  const [endDate, setEndDate] = useState<string>(todayInput);
  const [creators, setCreators] = useState<string[]>([]);

  const defaultExpenseOptions = [
    "Product",
    "Raw Material",
    "Inedible Material",
    "Others",
  ];

  const [formData, setFormData] = useState({
    expenseName: "",
    rawMaterial: "",
    description: "",
    amount: "",
  });

  useEffect(() => {
    if (!outletId) return;

    const todayStr = toLocalDateInput(new Date());
    const effectiveStart = isAdmin ? startDate : todayStr;
    const effectiveEnd = isAdmin ? endDate : todayStr;

    const startParts = effectiveStart.split("-");
    const startMs = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]), 0, 0, 0, 0).getTime();
    const endParts = effectiveEnd.split("-");
    const endOfDayMs = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]), 23, 59, 59, 999).getTime();
    const endMs = isAdmin ? (effectiveEnd === todayStr ? Date.now() : endOfDayMs) : Date.now();

    const q = query(
      collection(db, "expenses"),
      where("outletId", "==", outletId),
      where("createdAt", ">=", startMs),
      where("createdAt", "<=", endMs),
    );
    // if admin and creator filter set, include it
    const expensesQuery = isAdmin ? query(collection(db, "expenses"), where("outletId", "==", outletId), where("createdAt", ">=", startMs), where("createdAt", "<=", endMs)) : q;

    const unsub = onSnapshot(expensesQuery, (snapshot) => {
      setExpenses(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Expense))
      );
      setLoading(false);
    });

    // also subscribe to product names for raw material options
    const productsQuery = query(
      collection(db, "products"),
      where("outletId", "==", outletId),
    );
    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setProductOptions(snap.docs.map((d) => String(d.data()?.productName || "")).filter(Boolean));
    });

    // subscribe to expense items (raw / inedible) set in admin tab
    const itemsQuery = query(collection(db, "expenseItems"), where("outletId", "==", outletId));
    const unsubItems = onSnapshot(itemsQuery, (snap) => {
      const rows = snap.docs.map((d) => (d.data() as any) || {});
      setRawMaterialOptions(rows.filter((r: any) => r.type === "raw").map((r: any) => String(r.name || "")).filter(Boolean));
      setInedibleOptions(rows.filter((r: any) => r.type === "inedible").map((r: any) => String(r.name || "")).filter(Boolean));
      setExpenseOptions(rows.filter((r: any) => r.type === "expense").map((r: any) => String(r.name || "")).filter(Boolean));
    });

    return () => {
      unsub();
      unsubProducts();
      unsubItems();
    };
  }, [outletId, startDate, endDate, isAdmin]);

  const resetForm = () => {
    setFormData({
      expenseName: "",
      rawMaterial: "",
      description: "",
      amount: "",
    });
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    setIsSaving(true);

    if (!formData.expenseName.trim()) {
      setError("Please select or enter an expense name");
      setIsSaving(false);
      return;
    }

    if (!formData.amount.trim()) {
      setError("Amount is required");
      setIsSaving(false);
      return;
    }

    if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      setIsSaving(false);
      return;
    }

    try {
      // build a stored description string for compatibility
      let desc = formData.expenseName;
      if (formData.expenseName === "Product" && formData.rawMaterial.trim()) {
        desc = `Product: ${formData.rawMaterial}`;
      }
      if (formData.expenseName === "Raw Material" && formData.rawMaterial.trim()) {
        desc = `Raw Material: ${formData.rawMaterial}`;
      }
      if (formData.expenseName === "Inedible Material" && formData.rawMaterial.trim()) {
        desc = `Inedible Material: ${formData.rawMaterial}`;
      }
      if (formData.description && formData.description.trim()) {
        desc = `${desc} - ${formData.description.trim()}`;
      }
      if (editingId) {
        await updateDoc(doc(db, "expenses", editingId), {
          description: desc,
          amount: Number(formData.amount),
        });
        setSuccess("Expense updated successfully!");
        try {
          await logHistory("is updating expense", undefined, desc);
        } catch (_) {}
      } else {
        await addDoc(collection(db, "expenses"), {
          description: desc,
          amount: Number(formData.amount),
          outletId,
          createdAt: Date.now() - 6 * 60 * 60 * 1000,
          createdBy: (userDoc && userDoc.email) ? userDoc.email : (user ? user.uid : null),
        });
        setSuccess("Expense added successfully!");
        try {
          await logHistory("is adding expense", undefined, desc);
        } catch (_) {}
      }
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to save expense");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    // Try to prefill expenseName/rawMaterial if it follows the stored pattern
    const prodPrefix = "Product: ";
    const rawPrefix = "Raw Material: ";
    const inediblePrefix = "Inedible Material: ";
    if (expense.description.startsWith(prodPrefix)) {
      const rest = expense.description.slice(prodPrefix.length);
      const parts = rest.split(" - ");
      setFormData({
        expenseName: "Product",
        rawMaterial: parts[0] || "",
        description: parts[1] || "",
        amount: String(expense.amount),
      });
    } else if (expense.description.startsWith(rawPrefix)) {
      const rest = expense.description.slice(rawPrefix.length);
      const parts = rest.split(" - ");
      setFormData({
        expenseName: "Raw Material",
        rawMaterial: parts[0] || "",
        description: parts[1] || "",
        amount: String(expense.amount),
      });
    } else if (expense.description.startsWith(inediblePrefix)) {
      const rest = expense.description.slice(inediblePrefix.length);
      const parts = rest.split(" - ");
      setFormData({
        expenseName: "Inedible Material",
        rawMaterial: parts[0] || "",
        description: parts[1] || "",
        amount: String(expense.amount),
      });
    } else {
      setFormData({
        expenseName: expense.description || "",
        rawMaterial: "",
        description: "",
        amount: String(expense.amount),
      });
    }
    setEditingId(expense.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    const pwd = prompt("Enter delete password:");
    const expenseObj = expenses.find((e) => e.id === id);
    const expenseName = expenseObj?.description || id;
    if (pwd !== process.env.NEXT_PUBLIC_DELETE_PASSWORD) {
      try {
        await logHistory("is trying to delete the expense", undefined, expenseName);
      } catch (_) {}
      setError("Incorrect password. Deletion cancelled.");
      return;
    }
    setDeletingId(id);
    setError("");
    setSuccess("");
    try {
      await deleteDoc(doc(db, "expenses", id));
      setSuccess("Expense deleted successfully!");
      try {
        await logHistory("is deleting the expense", undefined, expenseName);
      } catch (_) {}
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    } finally {
      setDeletingId(null);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-green-600 dark:text-green-300">
          Expenses
        </h2>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              setShowForm(true);
            }
          }}
          className="px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Expense"}
        </button>
      </div>

      {isAdmin && (
        <div className="flex gap-4 items-end mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                let v = e.target.value;
                if (v > todayInput) v = todayInput;
                if (v > endDate) {
                  const newEnd = v > todayInput ? todayInput : v;
                  setEndDate(newEnd);
                }
                setStartDate(v);
              }}
              className="border rounded px-3 py-2 bg-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                let v = e.target.value;
                if (v > todayInput) v = todayInput;
                if (v < startDate) {
                  setStartDate(v);
                }
                setEndDate(v);
              }}
              className="border rounded px-3 py-2 bg-transparent"
            />
          </div>
          <div className="flex items-center">
            <button
              onClick={() => { 
                setStartDate(todayInput); 
                setEndDate(todayInput); 
               }}
              className="px-3 py-2 bg-gray-200 rounded"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-green-200 dark:border-green-700 space-y-4"
        >
          <h3 className="text-lg font-semibold">
            {editingId ? "Edit Expense" : "Add New Expense"}
          </h3>

          <div>
            <label className="block text-sm font-medium mb-1">
              Expense Name *
            </label>
            <Autocomplete
              freeSolo
              options={[...expenseOptions, ...defaultExpenseOptions]}
              value={formData.expenseName}
              onChange={(_e: any, value: any) =>
                setFormData({ ...formData, expenseName: String(value || "") })
              }
              renderInput={(params: any) => (
                <TextField
                  {...params}
                  required
                  placeholder="Select or type to create"
                  variant="outlined"
                  size="small"
                />
              )}
            />
          </div>

          {formData.expenseName === "Product" && (
            <div>
              <label className="block text-sm font-medium mb-1">Product</label>
              <Autocomplete
                freeSolo
                options={productOptions}
                value={formData.rawMaterial}
                onChange={(_e: any, value: any) =>
                  setFormData({ ...formData, rawMaterial: String(value || "") })
                }
                renderInput={(params: any) => (
                  <TextField
                    {...params}
                    placeholder="Select or type product"
                    variant="outlined"
                    size="small"
                  />
                )}
              />
            </div>
          )}

          {formData.expenseName === "Raw Material" && (
            <div>
              <label className="block text-sm font-medium mb-1">Raw Material</label>
              <Autocomplete
                freeSolo
                options={rawMaterialOptions}
                value={formData.rawMaterial}
                onChange={(_e: any, value: any) =>
                  setFormData({ ...formData, rawMaterial: String(value || "") })
                }
                renderInput={(params: any) => (
                  <TextField
                    {...params}
                    placeholder="Select or type raw material"
                    variant="outlined"
                    size="small"
                  />
                )}
              />
            </div>
          )}

          {formData.expenseName === "Inedible Material" && (
            <div>
              <label className="block text-sm font-medium mb-1">Inedible Material</label>
              <Autocomplete
                freeSolo
                options={inedibleOptions}
                value={formData.rawMaterial}
                onChange={(_e: any, value: any) =>
                  setFormData({ ...formData, rawMaterial: String(value || "") })
                }
                renderInput={(params: any) => (
                  <TextField
                    {...params}
                    placeholder="Select or type inedible item"
                    variant="outlined"
                    size="small"
                  />
                )}
              />
            </div>
          )}

          {/* show optional description for Other/custom selections */}
          {(formData.expenseName === "Others" || formData.expenseName === "Product" || formData.expenseName === "Raw Material" || formData.expenseName === "Inedible Material" || (formData.expenseName && !defaultExpenseOptions.includes(formData.expenseName))) && (
            <div>
              <label className="block text-sm font-medium mb-1">Additional Description (optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
                placeholder="Optional details"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Amount *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 transition-colors disabled:opacity-60"
            >
              {isSaving ? "Loading..." : editingId ? "Update Expense" : "Add Expense"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-400 text-white rounded font-semibold hover:bg-gray-500 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-400 animate-pulse">
          Loading expenses...
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Total Expenses
            </p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-300">
              {totalExpenses.toFixed(2)}
            </p>
          </div>

          <div className="overflow-x-auto rounded shadow">
            <table className="min-w-full text-sm bg-white dark:bg-gray-900">
              <thead>
                <tr className="bg-green-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-center text-gray-400 py-4"
                    >
                      No expenses yet
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-3 font-medium">
                        {expense.description}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {expense.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center space-x-2">
                        <button
                          style={{ display: 'none' }}
                          onClick={() => handleEdit(expense)}
                          className="text-green-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          className="text-red-600 hover:underline disabled:opacity-60"
                        >
                          {deletingId === expense.id ? "Loading..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
