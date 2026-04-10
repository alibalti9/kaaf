"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { useAuth } from "./components/AuthProvider";
import SignIn from "./components/SignIn";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { logHistory } from "@/lib/history";
import OutletDetails from "./components/OutletDetails";
import ExpenseManager from "./components/ExpenseManager";
import ProductManager from "./components/ProductManager";
import RefillManager from "./components/RefillManager";
import SalesManager from "./components/SalesManager";
import RevenuesSummary from "./components/RevenuesSummary";
import AdminUserManager from "./components/AdminUserManager";

export default function Home() {
  const { user, userDoc, loading, signOut } = useAuth();
  const [outlets, setOutlets] = useState<Array<any>>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [currentOutlet, setCurrentOutlet] = useState<any | null>(null);
  // const [loading, setLoading] = useState(true);
  const [outletChosen, setOutletChosen] = useState(false);
  const [addingOutlet, setAddingOutlet] = useState(false);
  const [newOutlet, setNewOutlet] = useState("");
  const [isAddingOutlet, setIsAddingOutlet] = useState(false);

  const [mounted, setMounted] = useState(false);

  const [tab, setTab] = useState<
    | "details"
    | "users"
    | "expenses"
    | "product"
    | "refill"
    | "sales"
    | "revenue"
  >("details");
  const [refillProductId, setRefillProductId] = useState<string | null>(null);

  const [editingOutletDetails, setEditingOutletDetails] = useState(false);
  const [outletRefreshKey, setOutletRefreshKey] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // console.log("Current outlet: ", currentOutlet);

  // Outlets sync
  useEffect(() => {
    const q = query(collection(db, "outlets"));
    onSnapshot(q, (snapshot) => {
      const hasPending = snapshot.metadata.hasPendingWrites;

      const outletDocs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("Pending writes:", hasPending);

      setOutlets(outletDocs);
    });
  }, []);

  // If the signed-in user is a non-admin, automatically select their assigned outlet
  useEffect(() => {
    if (!loading && user && userDoc) {
      if (userDoc.role && userDoc.role !== "admin") {
        if (userDoc.outletId) {
          setSelectedOutletId(userDoc.outletId);
          setOutletChosen(true);
        }
      }
    }
  }, [user, userDoc, loading]);

  console.log("Selected outlet ID:", selectedOutletId);

  // Update current outlet when selectedOutletId changes
  useEffect(() => {
    if (selectedOutletId) {
      const outlet = outlets.find((o) => o.id === selectedOutletId);
      setCurrentOutlet(outlet || null);
    }
  }, [selectedOutletId, outlets, outletRefreshKey, userDoc]);

  const handleAddOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newOutlet.trim();
    if (!name) return;

    const exists = !!outlets.filter((o) => o.name === name)?.length;
    if (!exists) {
      try {
        setIsAddingOutlet(true);
        await addDoc(collection(db, "outlets"), {
          name: name,
          location: "",
          city: "",
          country: "",
          description: "",
          createdAt: Date.now(),
        });
        await logHistory(`is adding outlet ${name}`);
      } catch (_) {
        // ignore
      } finally {
        setIsAddingOutlet(false);
      }
    }
    setNewOutlet("");
    setAddingOutlet(false);
  };

  const handleSelectOutlet = (outletId: string) => {
    setSelectedOutletId(outletId);
    setOutletChosen(true);
    setEditingOutletDetails(false);
    setTab("details");
  };

  // If auth state is loading, show null to avoid flicker
  if ((user && !userDoc) || loading) return <div style={{display: 'flex', flex: 1, justifyContent: "center", alignItems:"center"}}>Loading...</div>;
  // If not signed in, show sign-in form
  if (!user) return <SignIn />;

  return !mounted ? null : (
    <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-green-50 via-white to-green-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <div className="w-full max-w-6xl px-4 py-8 space-y-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-extrabold text-center text-green-500 dark:text-green-300 drop-shadow-sm tracking-tight">
            Admin Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Outlet Selector - Full Screen */}
        {!outletChosen && userDoc?.role === "admin" ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h2 className="text-2xl font-bold mb-8 text-green-700 dark:text-green-200">
              Select an Outlet
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full max-w-2xl mb-6">
              {(
                (userDoc?.role === "admin"
                  ? outlets
                  : outlets.filter((o) => o.id === userDoc?.outletId)) || []
              ).map((outlet, idx) => (
                <button
                  key={outlet.id}
                  onClick={() => handleSelectOutlet(outlet.id)}
                  className={`flex flex-col items-center justify-center aspect-square rounded-2xl shadow-2xl bg-white dark:bg-gray-800 text-green-700 dark:text-green-200 border-2 border-green-200 dark:border-green-700 font-bold transition-all duration-200 cursor-pointer focus:outline-none hover:scale-105 hover:shadow-green-200 dark:hover:shadow-green-900
                    ${
                      selectedOutletId === outlet.id
                        ? "ring-4 ring-green-400 dark:ring-green-600 scale-105"
                        : ""
                    }`}
                  aria-label={`Select ${outlet.name}`}
                  style={{
                    minHeight: "140px",
                    minWidth: "140px",
                    maxWidth: "180px",
                    maxHeight: "180px",
                  }}
                >
                  <span className="text-5xl mb-2">{idx + 1}</span>
                  <span className="text-lg font-medium text-center px-2">
                    {outlet.name}
                  </span>
                </button>
              ))}

              {/* Add Outlet Button */}
              <button
                onClick={() => setAddingOutlet(true)}
                className="flex flex-col items-center justify-center aspect-square rounded-2xl shadow-2xl bg-white dark:bg-gray-800 text-green-400 dark:text-green-500 border-2 border-dashed border-green-300 dark:border-green-700 font-bold text-5xl transition-all duration-200 cursor-pointer focus:outline-none hover:scale-105 hover:shadow-green-200 dark:hover:shadow-green-900"
                aria-label="Add Outlet"
                style={{
                  minHeight: "140px",
                  minWidth: "140px",
                  maxWidth: "180px",
                  maxHeight: "180px",
                }}
              >
                <span>+</span>
              </button>
            </div>

            {addingOutlet && (
              <form
                className="flex flex-col items-center gap-2 bg-white dark:bg-gray-900 p-4 rounded-xl shadow-lg border border-green-200 dark:border-green-700"
                onSubmit={handleAddOutlet}
              >
                <input
                  className="border rounded px-3 py-2 w-48 bg-transparent focus:outline-none focus:ring"
                  placeholder="Outlet name"
                  value={newOutlet}
                  onChange={(e) => setNewOutlet(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                      type="submit"
                      disabled={isAddingOutlet}
                      className="bg-green-500 text-white px-4 py-2 rounded font-semibold hover:bg-green-600 transition-colors disabled:opacity-60"
                    >
                      {isAddingOutlet ? "Adding..." : "Add"}
                    </button>
                  <button
                    type="button"
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-400 transition-colors"
                    onClick={() => {
                      setAddingOutlet(false);
                      setNewOutlet("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex justify-start overflow-x-auto gap-2 pb-4 border-b border-green-200 dark:border-gray-700">
              {(userDoc?.role === "admin"
                ? [
                    { id: "details", label: "Details" },
                    { id: "users", label: "Users" },
                    { id: "expenses", label: "Expenses" },
                    { id: "product", label: "Product" },
                    { id: "refill", label: "Refill" },
                    { id: "sales", label: "Sales" },
                    { id: "revenue", label: "Revenue" },
                  ]
                : [
                    { id: "details", label: "Details" },
                    { id: "expenses", label: "Expenses" },
                    { id: "product", label: "Product" },
                    { id: "refill", label: "Refill" },
                    { id: "sales", label: "Sales" },
                    { id: "revenue", label: "Revenue" },
                  ]
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    setTab(
                      t.id as
                        | "details"
                        | "users"
                        | "expenses"
                        | "product"
                        | "refill"
                        | "sales"
                        | "revenue",
                    )
                  }
                  className={`px-4 py-2 font-semibold whitespace-nowrap transition-colors duration-200 ${
                    tab === t.id
                      ? "text-green-700 dark:text-green-200 border-b-2 border-green-500"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content Sections */}
            <div className="space-y-8">
              {/* Users Tab (admin only) */}
              {tab === "users" && userDoc?.role === "admin" && (
                <AdminUserManager selectedOutletId={selectedOutletId || ""} />
              )}
              {/* Outlet Details Tab */}
              {tab === "details" && currentOutlet && (
                <OutletDetails
                  outlet={currentOutlet}
                  isEditing={editingOutletDetails}
                  setIsEditing={setEditingOutletDetails}
                  onUpdate={() => setOutletRefreshKey((k) => k + 1)}
                  isAdmin={userDoc?.role === "admin"}
                />
              )}

              {/* Expenses Tab */}
              {tab === "expenses" && selectedOutletId && (
                <ExpenseManager outletId={selectedOutletId} />
              )}

              {/* Product Tab */}
              {tab === "product" && selectedOutletId && (
                <ProductManager
                  outletId={selectedOutletId}
                  onOpenRefill={(pid) => {
                    setRefillProductId(pid || null);
                    setTab("refill");
                  }}
                />
              )}

              {/* Refill Tab */}
              {tab === "refill" && selectedOutletId && (
                <RefillManager
                  outletId={selectedOutletId}
                  productId={refillProductId}
                />
              )}

              {/* Sales Tab */}
              {tab === "sales" && selectedOutletId && (
                <SalesManager outletId={selectedOutletId} />
              )}

              {/* Revenue Summary Tab */}
              {tab === "revenue" && selectedOutletId && (
                <RevenuesSummary outletId={selectedOutletId} />
              )}
            </div>

            {/* Only allow admin to change/select outlet */}
            {userDoc?.role === "admin" && (
              <div className="flex justify-center pt-8">
                <button
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-400 to-green-600 text-white font-bold shadow-lg hover:from-green-500 hover:to-green-700 transition-all text-lg tracking-wide border-2 border-green-700 dark:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-300"
                  onClick={() => {
                    setOutletChosen(false);
                    setSelectedOutletId(null);
                    setCurrentOutlet(null);
                    setEditingOutletDetails(false);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Change Outlet
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
// NOTE: Make sure your tailwind.config.js has darkMode: 'class'
