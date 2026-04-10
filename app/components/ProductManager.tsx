"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { logHistory } from "@/lib/history";
// router navigation not needed; parent handles opening refill tab

interface Product {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  minQuantity?: number;
  description: string;
  outletId: string;
  createdAt: number;
}

interface ProductManagerProps {
  outletId: string;
  onOpenRefill?: (productId?: string) => void;
}

export default function ProductManager({ outletId, onOpenRefill }: ProductManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState({
    quantity: "",
    unitPrice: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [dismissedLowStockIds, setDismissedLowStockIds] = useState<string[]>([]);
  const [whatsappCopySuccess, setWhatsappCopySuccess] = useState<string>("");
  // optional callback from parent to open refill tab with selected product

  const [formData, setFormData] = useState({
    productName: "",
    quantity: "",
    unitPrice: "",
    minQuantity: "",
    description: "",
  });

  useEffect(() => {
    if (!outletId) return;

    const q = query(
      collection(db, "products"),
      where("outletId", "==", outletId),
    //   orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setProducts(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product))
      );
      setLoading(false);
    });

    return () => unsub();
  }, [outletId]);

  const resetForm = () => {
    setFormData({
      productName: "",
      quantity: "",
      unitPrice: "",
      minQuantity: "",
      description: "",
    });
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !formData.productName.trim() ||
      !formData.quantity.trim() ||
      !formData.unitPrice.trim()
    ) {
      setError("Product name, quantity, and unit price are required");
      return;
    }

    if (formData.minQuantity.trim()) {
      if (isNaN(Number(formData.minQuantity)) || Number(formData.minQuantity) < 0) {
        setError("Please enter a valid minimum quantity");
        return;
      }
    }

    if (isNaN(Number(formData.quantity)) || Number(formData.quantity) < 0) {
      setError("Please enter a valid quantity");
      return;
    }

    if (isNaN(Number(formData.unitPrice)) || Number(formData.unitPrice) < 0) {
      setError("Please enter a valid unit price");
      return;
    }

    try {
      setIsSaving(true);
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), {
          productName: formData.productName,
          quantity: Number(formData.quantity),
          unitPrice: Number(formData.unitPrice),
          minQuantity: formData.minQuantity ? Number(formData.minQuantity) : 0,
          description: formData.description,
        });
        setSuccess("Product updated successfully!");
        await logHistory("is updating product");
      } else {
        await addDoc(collection(db, "products"), {
          productName: formData.productName,
          quantity: Number(formData.quantity),
          unitPrice: Number(formData.unitPrice),
          minQuantity: formData.minQuantity ? Number(formData.minQuantity) : 0,
          description: formData.description,
          createdAt: Date.now(),
          outletId,
        });
        setSuccess("Product added successfully!");
        await logHistory("is adding product");
      }
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      productName: product.productName,
      quantity: String(product.quantity),
      unitPrice: String(product.unitPrice),
      minQuantity: product.minQuantity ? String(product.minQuantity) : "",
      description: product.description,
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    const pwd = prompt("Enter delete password:");
    if (pwd !== "TESTING!") {
      try {
        await logHistory("is trying to delete the product");
      } catch (_) {
        // ignore
      }
      setError("Incorrect password. Deletion cancelled.");
      return;
    }
    try {
      setDeletingProductId(id);
      setError("");
      setSuccess("");
      await deleteDoc(doc(db, "products", id));
      setSuccess("Product deleted successfully!");
        await logHistory("is deleting the product");
    } catch (err: any) {
      setError(err.message || "Failed to delete product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const startInlineEdit = (product: Product) => {
    setInlineEditId(product.id);
    setInlineEditData({
      quantity: "0",
      unitPrice: String(product.unitPrice),
    });
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineEditData({ quantity: "", unitPrice: "" });
  };

  const handleInlineUpdate = async (productId: string) => {
    setError("");
    setSuccess("");
    setUpdatingProductId(productId);

    if (!inlineEditData.quantity.trim()) {
      setError("Quantity is required");
      setUpdatingProductId(null);
      return;
    }

    const addQty = Number(inlineEditData.quantity);
    if (isNaN(addQty) || addQty <= 0) {
      setError("Please enter a valid quantity to add");
      setUpdatingProductId(null);
      return;
    }

    try {
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error("Product not found");
      const newQty = Number(product.quantity) + addQty;

      await updateDoc(doc(db, "products", productId), {
        quantity: newQty,
      });
      setSuccess("Product quantity updated successfully!");
        await logHistory("is adding quantity to product");
      cancelInlineEdit();
    } catch (err: any) {
      setError(err.message || "Failed to update product");
    } finally {
      setUpdatingProductId(null);
    }
  };

  const totalProductValue = products.reduce(
    (sum, p) => sum + p.quantity * p.unitPrice,
    0
  );

  const lowStockItems = products.filter(
    (p) => (Number(p.minQuantity || 0) > 0) && Number(p.quantity) <= Number(p.minQuantity || 0) && !dismissedLowStockIds.includes(p.id)
  );

  const composeWhatsApp = (items: Product[]) => {
    if (!items || items.length === 0) return;
    const lines = items.map((it) => `${it.productName} — ${it.quantity} units (min ${it.minQuantity ?? 0})`);
    const message = `Low stock alert:\n${lines.join("\n")}`;
    const encoded = encodeURIComponent(message);
    const phone = process.env.NEXT_PUBLIC_PHONE_NUMBER;
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    window.open(url, "_blank");
  };

  const copyMessage = async (items: Product[]) => {
    if (!items || items.length === 0) return;
    const lines = items.map((it) => `${it.productName} — ${it.quantity} units (min ${it.minQuantity ?? 0})`);
    const message = `Low stock alert:\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(message);
      setWhatsappCopySuccess("Copied to clipboard");
      setTimeout(() => setWhatsappCopySuccess(""), 3000);
    } catch (err) {
      setError("Failed to copy message");
      setTimeout(() => setError(""), 3000);
    }
  };

  const dismissItem = (id: string) => setDismissedLowStockIds((s) => [...s, id]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-green-600 dark:text-green-300">
          Product Management
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
          {showForm ? "Cancel" : "+ Add Product"}
        </button>
      </div>

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
            {editingId ? "Edit Product" : "Add New Product"}
          </h3>

          <div>
            <label className="block text-sm font-medium mb-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={formData.productName}
              onChange={(e) =>
                setFormData({ ...formData, productName: e.target.value })
              }
              className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
              placeholder="e.g., Coffee Beans, Croissant, Latte"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Quantity *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Unit Price *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) =>
                  setFormData({ ...formData, unitPrice: e.target.value })
                }
                className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min Quantity</label>
              <input
                type="number"
                step="1"
                value={formData.minQuantity}
                onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
                placeholder="e.g., 5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Total Value
              </label>
              <input
                type="text"
                disabled
                value={
                  (formData.quantity && formData.unitPrice
                    ? (
                        Number(formData.quantity) * Number(formData.unitPrice)
                      ).toFixed(2)
                    : "0.00") || "0.00"
                }
                className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
              placeholder="Notes about this product (e.g., supplier, quality, etc.)"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 transition-colors disabled:opacity-60"
            >
              {isSaving ? "Loading..." : editingId ? "Update Product" : "Add Product"}
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
          Loading products...
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Total Product Value
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">
              {totalProductValue.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {products.length} products in inventory
            </p>
          </div>

          {lowStockItems.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-yellow-800 font-semibold">Low stock items</h3>
                  <p className="text-sm text-yellow-700">Products below minimum quantity:</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {lowStockItems.map((it) => (
                      <li key={it.id} className="flex justify-between items-center">
                        <span>{it.productName} — {it.quantity} (min {it.minQuantity})</span>
                        <button onClick={() => dismissItem(it.id)} className="text-xs text-gray-600 ml-2">Dismiss</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => composeWhatsApp(lowStockItems)} className="px-3 py-2 bg-green-600 text-white rounded">Prepare WhatsApp</button>
                  <button onClick={() => copyMessage(lowStockItems)} className="px-3 py-2 bg-gray-200 rounded">Copy message</button>
                  {whatsappCopySuccess && <span className="text-sm text-green-600">{whatsappCopySuccess}</span>}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded shadow">
            <table className="min-w-full text-sm bg-white dark:bg-gray-900">
              <thead>
                <tr className="bg-green-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left">Product Name</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Min Qty</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-gray-400 py-4"
                    >
                      No products in inventory yet
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-3 font-medium">
                        {product.productName}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inlineEditId === product.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={inlineEditData.quantity}
                            onChange={(e) =>
                              setInlineEditData({
                                ...inlineEditData,
                                quantity: e.target.value,
                              })
                            }
                            className="w-20 border rounded px-2 py-1 bg-transparent focus:outline-none focus:ring focus:ring-blue-300"
                          />
                        ) : (
                          product.quantity.toFixed(2)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {product.unitPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {product.minQuantity !== undefined ? String(product.minQuantity) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {(product.quantity * product.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {product.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-center space-x-2">
                        {inlineEditId === product.id ? (
                          <>
                            <button
                              onClick={() => handleInlineUpdate(product.id)}
                              disabled={updatingProductId === product.id}
                              className="text-blue-600 hover:underline font-semibold disabled:opacity-60"
                            >
                              {updatingProductId === product.id ? "Loading..." : "Add"}
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="text-gray-600 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onOpenRefill ? onOpenRefill(product.id) : null}
                              className="text-blue-600 hover:underline"
                            >
                              Add Quantity
                            </button>
                            <button
                              style={{ display: 'none' }}
                              onClick={() => handleEdit(product)}
                              className="text-green-600 hover:underline"
                            >
                              Edit All
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deletingProductId === product.id}
                              className="text-red-600 hover:underline disabled:opacity-60"
                            >
                              {deletingProductId === product.id ? "Loading..." : "Delete"}
                            </button>
                          </>
                        )}
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
