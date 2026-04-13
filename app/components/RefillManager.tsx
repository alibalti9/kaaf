"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { logHistory } from "@/lib/history";

interface Product {
  id: string;
  productName: string;
  quantity: number;
}

export default function RefillManager({ outletId, productId }: { outletId?: string | null; productId?: string | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(productId || "");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!outletId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "products"), where("outletId", "==", outletId));
    const unsub = onSnapshot(q, (snapshot) => {
      setProducts(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[]
      );
      setLoading(false);
    });

    return () => unsub();
  }, [outletId]);

  useEffect(() => {
    setSelectedProductId(productId || "");
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedProductId || !quantity) {
      setError("All fields are required");
      return;
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Enter valid quantity");
      return;
    }

    try {
      setIsSaving(true);
      const product = products.find((p) => p.id === selectedProductId);
      if (!product) throw new Error("Product not found");
      const newQty = (product.quantity || 0) + qty;
      await updateDoc(doc(db, "products", selectedProductId), { quantity: newQty });
      setSuccess("Stock refilled successfully!");
      try {
        await logHistory("is refilling product", undefined, product.productName);
      } catch (_) {}
      setQuantity("");
      setSelectedProductId("");
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!outletId) return <p className="text-center mt-6">Select an outlet to refill products.</p>;
  if (loading) return <p className="text-center mt-6">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-green-200 dark:border-green-700 space-y-4">
        <h2 className="text-xl font-bold">Refill Product</h2>

        {error && <p className="text-red-500">{error}</p>}
        {success && <p className="text-green-500">{success}</p>}

        <div>
          <label className="block mb-1">Product *</label>
          <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent">
            <option value="">Select Product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.productName} (Current: {p.quantity})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Quantity to Add *</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" placeholder="Enter quantity" />
        </div>

        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600">
          {isSaving ? "Loading..." : "Refill"}
        </button>
      </form>
    </div>
  );
}
