"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { logHistory } from "@/lib/history";

export default function ExpenseItems({ outletId }: { outletId?: string | null }) {
  const [items, setItems] = useState<Array<any>>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"raw" | "inedible" | "expense">("raw");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!outletId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "expenseItems"), where("outletId", "==", outletId));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [outletId]);

  const reset = () => {
    setName("");
    setType("raw");
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!outletId) {
      setError("Select an outlet first");
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "expenseItems", editingId), {
          name: name.trim(),
          type,
          updatedAt: Date.now() - 6 * 60 * 60 * 1000,
        });
        setSuccess("Updated");
        try {
          await logHistory("is updating expense item", undefined, name.trim());
        } catch (_) {}
      } else {
        await addDoc(collection(db, "expenseItems"), {
          name: name.trim(),
          type,
          outletId,
          createdAt: Date.now() - 6 * 60 * 60 * 1000,
        });
        setSuccess("Added");
        try {
          await logHistory("is adding expense item", undefined, name.trim());
        } catch (_) {}
      }
      reset();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (it: any) => {
    setEditingId(it.id);
    setName(it.name || "");
    setType(it.type || "raw");
    setError("");
    setSuccess("");
  };

  const handleDelete = async (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteDoc(doc(db, "expenseItems", id));
      try {
        await logHistory("is deleting expense item", undefined, it?.name || id);
      } catch (_) {}
      setSuccess("Deleted");
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  if (!outletId) return <p className="text-center mt-6">Select an outlet to manage expense items.</p>;
  if (loading) return <p className="text-center mt-6">Loading...</p>;

  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded shadow">
      <h2 className="text-xl font-semibold mb-3">Manage Expense Items</h2>

      {error && <div className="text-red-500 mb-2">{error}</div>}
      {success && <div className="text-green-600 mb-2">{success}</div>}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name (e.g. Plates, Flour)"
          className="px-3 py-2 border rounded bg-transparent"
        />
        <select value={type} onChange={(e) => setType(e.target.value as any)} className="px-3 py-2 border rounded bg-transparent">
          <option value="raw">Raw Material</option>
          <option value="inedible">Inedible Material</option>
          <option value="expense">Expense</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" disabled={isSaving} className="px-4 py-2 bg-green-600 text-white rounded">
            {isSaving ? "Saving..." : editingId ? "Update" : "Add"}
          </button>
          <button type="button" onClick={reset} className="px-4 py-2 bg-gray-300 rounded">
            Reset
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Name</th>
              <th className="text-left">Type</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-4 text-gray-500">No items found</td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="py-2">{it.name}</td>
                  <td className="py-2">{it.type === "raw" ? "Raw Material" : it.type === "inedible" ? "Inedible" : "Expense"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => startEdit(it)} className="text-blue-600 mr-3">Edit</button>
                    <button onClick={() => handleDelete(it.id)} className="text-red-600">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
