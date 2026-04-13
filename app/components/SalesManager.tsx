"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";
import {
  collection,
  writeBatch,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { logHistory } from "@/lib/history";

interface Product {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  description: string;
  outletId: string;
  createdAt: number;
}

interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  discountedTotalValue: number;
  outletId: string;
  billId?: string;
  createdAt: number;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  discountedTotalValue: number;
}

interface SalesManagerProps {
  outletId: string;
}

export default function SalesManager({ outletId }: SalesManagerProps) {
  const { user, userDoc } = useAuth();
  const isAdmin = !!userDoc && userDoc.role === "admin";

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Date range and creator filters
  const toLocalDateInput = (d: Date) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  };
  const todayInput = toLocalDateInput(new Date());
  const [startDate, setStartDate] = useState<string>(todayInput);
  const [endDate, setEndDate] = useState<string>(todayInput);

  const [formData, setFormData] = useState({
    productId: "",
    productName: "",
    quantity: "",
    unitPrice: "",
    discountValue: "",
  });

  const selectedProduct = products.find(
    (product) => product.id === formData.productId,
  );

  useEffect(() => {
    if (!outletId) return;

    const todayStr = toLocalDateInput(new Date());
    const effectiveStart = isAdmin ? startDate : todayStr;
    const effectiveEnd = isAdmin ? endDate : todayStr;

    const startParts = effectiveStart.split("-");
    const startMs = new Date(
      Number(startParts[0]),
      Number(startParts[1]) - 1,
      Number(startParts[2]),
      0,
      0,
      0,
      0,
    ).getTime();
    const endParts = effectiveEnd.split("-");
    const endOfDayMs = new Date(
      Number(endParts[0]),
      Number(endParts[1]) - 1,
      Number(endParts[2]),
      23,
      59,
      59,
      999,
    ).getTime();
    const endMs = isAdmin
      ? effectiveEnd === todayStr
        ? Date.now()
        : endOfDayMs
      : Date.now();

    // build sales query with date range and optional creator filter (admin only)
    const salesConstraints: any[] = [
      where("outletId", "==", outletId),
      where("createdAt", ">=", startMs),
      where("createdAt", "<=", endMs),
    ];
    const salesQuery = query(collection(db, "sales"), ...salesConstraints);

    const productsQuery = query(
      collection(db, "products"),
      where("outletId", "==", outletId),
    );

    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      setSales(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Sale),
      );
      setLoading(false);
    });

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product),
      );
      setLoading(false);
    });

    // also maintain list of creators for the creator filter (from all sales in outlet)
    const creatorsQ = query(
      collection(db, "sales"),
      where("outletId", "==", outletId),
    );


    return () => {
      unsubSales();
      unsubProducts();
    };
  }, [outletId, startDate, endDate, isAdmin]);

  const resetForm = () => {
    setFormData({
      productId: "",
      productName: "",
      quantity: "",
      unitPrice: "",
      discountValue: "",
    });
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  const getSubtotal = () => {
    const quantity = Number(formData.quantity);
    const unitPrice = Number(formData.unitPrice);
    if (!quantity || !unitPrice) return 0;
    return quantity * unitPrice;
  };

  const getDiscount = () => {
    const subtotal = getSubtotal();
    const value = Number(formData.discountValue || "0");
    if (!subtotal || !value) return 0;
    return value;
  };

  const handleSelectProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    setFormData({
      productId,
      productName: product.productName,
      unitPrice: String(product.unitPrice),
      quantity: "",
      discountValue: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.productId) {
      setError("Please select a product.");
      return;
    }

    if (!formData.quantity.trim()) {
      setError("Quantity is required.");
      return;
    }

    const selectedQty = Number(formData.quantity);
    const unitPrice = Number(formData.unitPrice);
    const discountValue = Number(formData.discountValue || "0");

    if (isNaN(selectedQty) || selectedQty <= 0) {
      setError("Please enter a valid quantity.");
      return;
    }

    if (!Number.isInteger(selectedQty)) {
      setError("Quantity must be a whole number.");
      return;
    }

    if (!selectedProduct) {
      setError("Selected product not found.");
      return;
    }

    if (selectedQty > Math.floor(selectedProduct.quantity)) {
      setError(
        `Quantity cannot exceed available product stock (${Math.floor(selectedProduct.quantity)}).`,
      );
      return;
    }

    if (isNaN(unitPrice) || unitPrice <= 0) {
      setError("Selected product unit price is invalid.");
      return;
    }

    const subtotal = selectedQty * unitPrice;

    if (formData.discountValue.trim()) {
      if (isNaN(discountValue) || discountValue < 0) {
        setError("Please enter a valid discount amount.");
        return;
      }
      if (discountValue >= subtotal) {
        setError("Discount amount must be less than the sale subtotal.");
        return;
      }
    }

    const discountedTotalValue = Math.max(subtotal - discountValue, 0);

    // If editing an existing sale, perform update now. Otherwise add to cart locally.
    if (!editingId) {
      // Add to local cart instead of saving directly
      const item: CartItem = {
        productId: formData.productId,
        productName: formData.productName,
        quantity: selectedQty,
        unitPrice,
        discountValue,
        discountedTotalValue,
      };
      setCart((c) => [...c, item]);
      setSuccess("Item added to cart. Click 'Create Bill' to save.");
      // keep form open for additional items
      resetForm();
      return;
    }

    // Editing path: update sale and adjust product quantities appropriately
    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      const saleRef = doc(db, "sales", editingId);
      const saleSnap = await getDoc(saleRef);
      const prevQty = saleSnap.exists()
        ? Number(saleSnap.data()?.quantity || 0)
        : 0;
      const prevProductId = saleSnap.exists()
        ? String(saleSnap.data()?.productId || "")
        : "";

      const newProductId = formData.productId;
      const newQtyValue = selectedQty;

      const lowStockAlerts: any[] = [];

      if (prevProductId === newProductId) {
        // Same product: adjust by difference
        const productRef = doc(db, "products", newProductId);
        const productSnap = await getDoc(productRef);
        const currentQty = Number(productSnap.data()?.quantity || 0);
        const qtyDiff = newQtyValue - prevQty; // positive => decrease more, negative => restore
        const updatedQty = Math.max(currentQty - qtyDiff, 0);
        batch.update(productRef, { quantity: updatedQty });
        // check minQuantity
        try {
          const minQ = Number(productSnap.data()?.minQuantity || 0);
          if (minQ > 0 && updatedQty <= minQ) {
            lowStockAlerts.push({
              productName: String(productSnap.data()?.productName || ""),
              productId: newProductId,
              outletId,
              currentQuantity: updatedQty,
              minQuantity: minQ,
            });
          }
        } catch (_) {}
      } else {
        // Product changed: restore previous product, decrement new product
        if (prevProductId) {
          const prevProductRef = doc(db, "products", prevProductId);
          const prevProductSnap = await getDoc(prevProductRef);
          const prevCurrentQty = Number(prevProductSnap.data()?.quantity || 0);
          const restoredQty = prevCurrentQty + prevQty;
          batch.update(prevProductRef, { quantity: restoredQty });
        }

        const newProductRef = doc(db, "products", newProductId);
        const newProductSnap = await getDoc(newProductRef);
        const newCurrentQty = Number(newProductSnap.data()?.quantity || 0);
        const newUpdatedQty = Math.max(newCurrentQty - newQtyValue, 0);
        batch.update(newProductRef, { quantity: newUpdatedQty });
        try {
          const minQ = Number(newProductSnap.data()?.minQuantity || 0);
          if (minQ > 0 && newUpdatedQty <= minQ) {
            lowStockAlerts.push({
              productName: String(newProductSnap.data()?.productName || ""),
              productId: newProductId,
              outletId: newProductSnap.data()?.outletId || outletId,
              currentQuantity: newUpdatedQty,
              minQuantity: minQ,
            });
          }
        } catch (_) {}
      }

      batch.update(saleRef, {
        productId: formData.productId,
        productName: formData.productName,
        quantity: selectedQty,
        unitPrice,
        discountValue,
        discountedTotalValue,
        outletId,
        createdAt: Date.now() - 6 * 60 * 60 * 1000,
      });

      await batch.commit();
      setSuccess("Sale updated and product adjusted!");
      try {
        await logHistory("is updating sale", undefined, formData.productName);
      } catch (_) {}
      // Low-stock alerts collected; frontend will surface these on product list
      if (lowStockAlerts.length > 0) {
        console.log(
          "Low-stock items (frontend alert will show):",
          lowStockAlerts,
        );
      }
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to update sale");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToCart = () => {
    // kept for compatibility (handleSubmit already adds to cart when not editing)
  };

  const handleRemoveCartItem = (index: number) => {
    setCart((c) => c.filter((_, i) => i !== index));
  };

  const handleCreateBill = async () => {
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      // aggregate quantities per product
      const totals: Record<string, number> = {};
      cart.forEach((it) => {
        totals[it.productId] = (totals[it.productId] || 0) + it.quantity;
      });

      const batch = writeBatch(db);
      const billId = `bill-${Date.now()}`;

      // validate stock and prepare product updates
      const productIds = Object.keys(totals);
      const productSnaps = await Promise.all(
        productIds.map((pid) => getDoc(doc(db, "products", pid))),
      );

      const lowStockAlerts: any[] = [];
      for (let i = 0; i < productIds.length; i++) {
        const pid = productIds[i];
        const snap = productSnaps[i];
        if (!snap.exists()) throw new Error(`Product ${pid} not found`);
        const currentQty = Number(snap.data()?.quantity || 0);
        const needed = totals[pid];
        if (needed > currentQty) {
          throw new Error(`Insufficient stock for product: ${pid}`);
        }
        const newQty = Math.max(currentQty - needed, 0);
        batch.update(doc(db, "products", pid), { quantity: newQty });
        try {
          const minQ = Number(snap.data()?.minQuantity || 0);
          if (minQ > 0 && newQty <= minQ) {
            lowStockAlerts.push({
              productName: String(snap.data()?.productName || ""),
              productId: pid,
              outletId,
              currentQuantity: newQty,
              minQuantity: minQ,
            });
          }
        } catch (_) {}
      }

      // create sale docs
      cart.forEach((it) => {
        const saleRef = doc(collection(db, "sales"));
        batch.set(saleRef, {
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountValue: it.discountValue,
          discountedTotalValue: it.discountedTotalValue,
          outletId,
          billId,
          createdAt: Date.now() - 6 * 60 * 60 * 1000,
          createdBy:
            userDoc && userDoc.email ? userDoc.email : user ? user.uid : null,
        });
      });

      await batch.commit();
      setSuccess("Bill created and products updated!");
      if (lowStockAlerts.length > 0) {
        console.log(
          "Low-stock items (frontend alert will show):",
          lowStockAlerts,
        );
      }
      setCart([]);
      resetForm();
      setShowForm(false);
      try {
        await logHistory(`is creating bill ${billId}`);
      } catch (_) {}
    } catch (err: any) {
      setError(err.message || "Failed to create bill");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (sale: Sale) => {
    setFormData({
      productId: sale.productId,
      productName: sale.productName,
      quantity: String(Math.floor(sale.quantity)),
      unitPrice: String(sale.unitPrice),
      discountValue: String(sale.discountValue),
    });
    setEditingId(sale.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    const pwd = prompt("Enter delete password:");
    if (pwd !== process.env.NEXT_PUBLIC_DELETE_PASSWORD) {
      try {
        const saleRef = doc(db, "sales", id);
        const saleSnap = await getDoc(saleRef);
        const prodName = saleSnap.exists()
          ? String(saleSnap.data()?.productName || "")
          : id;
        await logHistory("is trying to delete the sale", undefined, prodName);
      } catch (_) {}
      setError("Incorrect password. Deletion cancelled.");
      return;
    }
    setDeletingId(id);
    setError("");
    setSuccess("");
    try {
      const saleRef = doc(db, "sales", id);
      const saleSnap = await getDoc(saleRef);
      if (!saleSnap.exists()) throw new Error("Sale not found");
      const saleData: any = saleSnap.data();
      const productId = String(saleData.productId || "");
      const saleQty = Number(saleData.quantity || 0);

      const batch = writeBatch(db);
      const productRef = doc(db, "products", productId);
      const prodSnap = await getDoc(productRef);
      const currentQty = Number(prodSnap.data()?.quantity || 0);
      const newQty = currentQty + saleQty;
      batch.update(productRef, { quantity: newQty });
      batch.delete(saleRef);

      await batch.commit();
      setSuccess("Sale deleted and product quantity restored!");
      try {
        await logHistory(
          "is deleting the sale",
          undefined,
          String(saleData.productName || ""),
        );
      } catch (_) {}
    } catch (err: any) {
      setError(err.message || "Failed to delete sale");
    } finally {
      setDeletingId(null);
    }
  };

  const totalRevenue = sales.reduce((sum, s) => {
    if (
      s.discountedTotalValue !== undefined &&
      s.discountedTotalValue !== null
    ) {
      return sum + s.discountedTotalValue;
    }
    const subtotal = s.quantity * s.unitPrice;
    return sum + Math.max(subtotal - (s.discountValue || 0), 0);
  }, 0);

  const subtotal = getSubtotal();
  const discountAmount = getDiscount();
  const totalSale = Math.max(subtotal - discountAmount, 0);

  // Group sales by billId (or by sale id if no billId)
  const groupedSalesMap = sales.reduce(
    (acc: Record<string, Sale[]>, s) => {
      const key = s.billId || s.id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    },
    {} as Record<string, Sale[]>,
  );

  const groupedElements: any[] = Object.entries(groupedSalesMap).reduce(
    (arr, [billId, items]) => {
      // sort items by createdAt desc
      const sorted = items
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const groupTotal = sorted.reduce((sum, s) => {
        const st =
          s.discountedTotalValue !== undefined &&
          s.discountedTotalValue !== null
            ? s.discountedTotalValue
            : Math.max(s.quantity * s.unitPrice - (s.discountValue || 0), 0);
        return sum + st;
      }, 0);

      arr.push(
        <tr
          key={`group-${billId}`}
          className="bg-green-50 dark:bg-gray-800 border-b"
        >
          <td
            colSpan={6}
            className="px-4 py-2 font-semibold d-flex justify-between items-center w-full"
          >
            <span>
              {billId.startsWith("bill-") ? `Bill ${billId}` : `Sale ${billId}`}{" "}
              — {sorted.length} item(s) — Total: {groupTotal.toFixed(2)}
            </span>
            <span style={{ marginLeft: "auto" }}>
              {new Date(sorted[0]?.createdAt).toLocaleString()}
            </span>
          </td>
        </tr>,
      );

      sorted.forEach((sale) => {
        arr.push(
          <tr
            key={sale.id}
            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <td className="px-4 py-3 font-medium">{sale.productName}</td>
            <td className="px-4 py-3 text-right">{sale.quantity.toString()}</td>
            <td className="px-4 py-3 text-right">
              {sale.unitPrice.toFixed(2)}
            </td>
            <td className="px-4 py-3 text-right">
              {sale.discountValue.toFixed(2)}
            </td>
            <td className="px-4 py-3 text-right font-semibold">
              {(sale.discountedTotalValue !== undefined &&
              sale.discountedTotalValue !== null
                ? sale.discountedTotalValue
                : Math.max(
                    sale.quantity * sale.unitPrice - (sale.discountValue || 0),
                    0,
                  )
              ).toFixed(2)}
            </td>
            <td className="px-4 py-3 text-center space-x-2">
              <button
                onClick={() => handleEdit(sale)}
                className="text-green-600 hover:underline"
                style={{ display: "none" }}
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(sale.id)}
                disabled={deletingId === sale.id}
                className="text-red-600 hover:underline disabled:opacity-60"
              >
                {deletingId === sale.id ? "Loading..." : "Delete"}
              </button>
            </td>
          </tr>,
        );
      });

      return arr;
    },
    [] as any[],
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-green-600 dark:text-green-300">
          Sales
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
          {showForm ? "Cancel" : "+ Add Sale"}
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
                  // extend end to match start (but not beyond today)
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
                  // move start to match end if end becomes earlier
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
            {editingId ? "Edit Sale" : "Add New Sale"}
          </h3>

          <div>
            <label className="block text-sm font-medium mb-1">Product *</label>
            <select
              value={formData.productId}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
            >
              <option value="">Select a product</option>
              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                  disabled={product.quantity <= 0}
                >
                  {product.productName} ({product.quantity} available)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Quantity *
              </label>
              <input
                type="number"
                required
                step="1"
                min="1"
                max={
                  selectedProduct
                    ? String(Math.floor(selectedProduct.quantity))
                    : undefined
                }
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
                placeholder="0"
              />
              {selectedProduct && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Max: {Math.floor(selectedProduct.quantity)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Unit Price
              </label>
              <input
                type="number"
                value={formData.unitPrice}
                disabled
                className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Sale Total
              </label>
              <input
                type="text"
                disabled
                value={totalSale.toFixed(2)}
                className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Discount Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.discountValue}
                onChange={(e) =>
                  setFormData({ ...formData, discountValue: e.target.value })
                }
                className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Discount must be less than subtotal.
              </p>
            </div>
          </div>

          {/* date removed - using createdAt instead */}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 transition-colors disabled:opacity-60"
            >
              {isSaving
                ? "Loading..."
                : editingId
                  ? "Update Sale"
                  : "Add To Cart"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-400 text-white rounded font-semibold hover:bg-gray-500 transition-colors"
            >
              Reset
            </button>
          </div>
          {cart.length > 0 && (
            <div className="mt-4 p-4 border rounded bg-green-50">
              <h4 className="font-semibold mb-2">Cart ({cart.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Product</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Unit</th>
                      <th className="text-right">Total</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-2">{it.productName}</td>
                        <td className="py-2 text-right">
                          {it.quantity.toString()}
                        </td>
                        <td className="py-2 text-right">
                          {it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {it.discountedTotalValue.toFixed(2)}
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => handleRemoveCartItem(idx)}
                            disabled={isSaving}
                            className="text-red-600 hover:underline disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleCreateBill}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded font-semibold disabled:opacity-60"
                >
                  {isSaving ? "Loading..." : "Create Bill"}
                </button>
                <button
                  onClick={() => setCart([])}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold disabled:opacity-60"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-400 animate-pulse">
          Loading sales...
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Total Revenue
            </p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-300">
              {totalRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {sales.length} sales recorded
            </p>
          </div>

          <div className="overflow-x-auto rounded shadow">
            <table className="min-w-full text-sm bg-white dark:bg-gray-900">
              <thead>
                <tr className="bg-green-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left">Product Name</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-4">
                      No sales yet
                    </td>
                  </tr>
                ) : (
                  groupedElements
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
