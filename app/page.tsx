'use client'
import Image from "next/image";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
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
import Form from "./form";

export default function Home() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tab, setTab] = useState<"add-material" | "list">("add-material");
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(true);
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);
  const [selectedOutlet, setSelectedOutlet] = useState("Main");
  const [outletChosen, setOutletChosen] = useState(false);
  const [outlets, setOutlets] = useState(["Main"]);
  const [addingOutlet, setAddingOutlet] = useState(false);
  const [newOutlet, setNewOutlet] = useState("");

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "materials"), orderBy("name"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setMaterials(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  // Outlets Firestore sync
  useEffect(() => {
    const q = query(collection(db, "outlets"), orderBy("createdAt"));
    const unsub = onSnapshot(q, (snapshot) => {
      const outletDocs = snapshot.docs.map((doc) => doc.data().name);
      if (outletDocs.length > 0) {
        setOutlets(outletDocs);
        // If current selectedOutlet is missing, reset to first
        if (!outletDocs.includes(selectedOutlet)) {
          setSelectedOutlet(outletDocs[0]);
        }
      } else {
        // If no outlets in db, add 'Main' as default
        addDoc(collection(db, "outlets"), {
          name: "Main",
          createdAt: Date.now(),
        });
      }
    });
    return () => unsub();
  }, []);

  // Delete material
  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, "materials", id));
  };

  // Start editing
  const handleEdit = (material: Material) => {
    setEditMaterial(material);
    setTab("form");
  };

  // Save edit (called from Form)
  const handleSaveEdit = async (
    id: string,
    data: { name: string; expense: number; sales: number },
  ) => {
    await updateDoc(doc(db, "materials", id), data);
    setEditMaterial(null);
  };

  // Add outlet to Firestore
  const handleAddOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newOutlet.trim();
    if (!name) return;
    const exists = (await getDocs(collection(db, "outlets"))).docs.some(
      (doc) => doc.data().name === name,
    );
    if (!exists) {
      await addDoc(collection(db, "outlets"), { name, createdAt: Date.now() });
    }
    setNewOutlet("");
    setAddingOutlet(false);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <div className="w-full max-w-2xl px-4 py-8 space-y-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-extrabold text-center text-green-500 dark:text-green-300 drop-shadow-sm tracking-tight">
            Material Dashboard
          </h1>
        </div>
        {/* Outlet grid full-screen selector */}
        {!outletChosen ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h2 className="text-2xl font-bold mb-8 text-green-700 dark:text-green-200">
              Select an Outlet
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 w-full max-w-lg mb-6">
              {outlets.map((o, idx) => (
                <button
                  key={o}
                  onClick={() => {
                    setSelectedOutlet(o);
                    setOutletChosen(true);
                  }}
                  className={`flex flex-col items-center justify-center aspect-square rounded-2xl shadow-2xl bg-white dark:bg-gray-800 text-green-700 dark:text-green-200 border-2 border-green-200 dark:border-green-700 font-bold text-xl transition-all duration-200 cursor-pointer focus:outline-none hover:scale-105 hover:shadow-green-200 dark:hover:shadow-green-900
                    ${selectedOutlet === o ? "ring-4 ring-green-400 dark:ring-green-600 scale-105" : ""}`}
                  aria-label={`Select ${o}`}
                  style={{
                    minHeight: "120px",
                    minWidth: "120px",
                    maxWidth: "160px",
                    maxHeight: "160px",
                  }}
                >
                  <span className="text-4xl mb-2">{idx + 1}</span>
                  <span className="text-lg font-medium">{o}</span>
                </button>
              ))}
              {/* Add Outlet Button */}
              <button
                onClick={() => setAddingOutlet(true)}
                className="flex flex-col items-center justify-center aspect-square rounded-2xl shadow-2xl bg-white dark:bg-gray-800 text-green-400 dark:text-green-500 border-2 border-dashed border-green-300 dark:border-green-700 font-bold text-5xl transition-all duration-200 cursor-pointer focus:outline-none hover:scale-105 hover:shadow-green-200 dark:hover:shadow-green-900"
                aria-label="Add Outlet"
                style={{
                  minHeight: "120px",
                  minWidth: "120px",
                  maxWidth: "160px",
                  maxHeight: "160px",
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
                    className="bg-green-500 text-white px-4 py-2 rounded font-semibold hover:bg-green-600 transition-colors"
                  >
                    Add
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
            {/* Tab Buttons with sliding background highlight */}
            <div className="flex justify-center mb-6 border-b border-green-200 dark:border-gray-700 relative h-12">
              {/* Sliding background highlight */}
              <span
                className="absolute top-1 left-0 h-10 w-1/2 rounded-lg bg-green-100 dark:bg-green-900 transition-transform duration-300 z-0"
                style={{
                  transform:
                    tab === "add-material"
                      ? "translateX(0%)"
                      : "translateX(100%)",
                }}
                aria-hidden="true"
              />
              <button
                className={`relative z-10 w-1/2 px-4 py-2 font-semibold focus:outline-none transition-colors duration-200 ${tab === "add-material" ? "text-green-700 dark:text-green-200" : "text-gray-400 dark:text-gray-500"}`}
                onClick={() => setTab("add-material")}
              >
                Add Material
              </button>
              <button
                className={`relative z-10 w-1/2 px-4 py-2 font-semibold focus:outline-none transition-colors duration-200 ${tab === "list" ? "text-green-700 dark:text-green-200" : "text-gray-400 dark:text-gray-500"}`}
                onClick={() => setTab("list")}
              >
                Material List
              </button>
            </div>
            {/* Only Add Material and Material List sections */}
            <div className="relative w-full min-h-[350px]">
              <div style={{ minHeight: "350px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <section
                  className={`w-full absolute top-0 left-0 transition-all duration-500 ${tab === "add-material" ? "opacity-100 z-10 translate-x-0 pointer-events-auto" : "opacity-0 -translate-x-4 z-0 pointer-events-none"}`}
                  aria-hidden={tab !== "add-material"}
                >
                  <h2 className="text-xl font-bold mb-4 text-green-500 dark:text-green-200">
                    Add Material
                  </h2>
                  <Form
                    lang={lang}
                    setLang={setLang}
                    editMaterial={editMaterial}
                    setEditMaterial={setEditMaterial}
                    onSaveEdit={handleSaveEdit}
                    onlyNameAndExpense={true}
                    outlets={outlets}
                    selectedOutlet={selectedOutlet}
                  />
                </section>
                <section
                  className={`w-full absolute top-0 left-0 transition-all duration-500 ${tab === "list" ? "opacity-100 z-10 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 z-0 pointer-events-none"}`}
                  aria-hidden={tab !== "list"}
                >
                  <h2 className="text-xl font-bold mb-4 text-green-500 dark:text-green-200">
                    Material List
                  </h2>
                  <div className="overflow-x-auto rounded shadow bg-white dark:bg-gray-900">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-green-100 dark:bg-gray-800">
                          <th className="px-4 py-2 text-left">Outlet</th>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Expense</th>
                          <th className="px-4 py-2 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-center text-gray-400 py-4 animate-pulse"
                            >
                              Loading...
                            </td>
                          </tr>
                        ) : materials.filter(
                            (mat) => mat.outlet === selectedOutlet,
                          ).length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-center text-gray-400 py-4"
                            >
                              No materials yet.
                            </td>
                          </tr>
                        ) : (
                          materials
                            .filter((mat) => mat.outlet === selectedOutlet)
                            .map((mat) => (
                              <tr
                                key={mat.id}
                                className="border-b border-gray-100 dark:border-gray-800"
                              >
                                <td className="px-4 py-2 font-medium">
                                  {mat.outlet}
                                </td>
                                <td className="px-4 py-2 font-medium">
                                  {mat.name}
                                </td>
                                <td className="px-4 py-2">
                                  {mat.expense !== undefined
                                    ? mat.expense
                                    : "-"}
                                </td>
                                <td className="px-4 py-2">
                                  {mat.sales !== undefined ? mat.sales : "-"}
                                </td>
                                <td className="px-4 py-2">
                                  {mat.sales !== undefined &&
                                  mat.expense !== undefined
                                    ? mat.sales - mat.expense
                                    : "-"}
                                </td>
                                <td className="px-4 py-2">
                                  {mat.sales !== undefined
                                    ? (mat.sales * 0.05).toFixed(2)
                                    : "-"}
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => handleEdit(mat)}
                                    className="text-green-600 hover:underline mr-2"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(mat.id)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
              {/* Option to change outlet */}
              <div className="flex justify-center mt-16">
                <button
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-400 to-green-600 text-white font-bold shadow-lg hover:from-green-500 hover:to-green-700 transition-all text-lg tracking-wide border-2 border-green-700 dark:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-300 mt-12"
                  onClick={() => setOutletChosen(false)}
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
            </div>
          </>
        )}
      </div>
    </main>
  );
}
// NOTE: Make sure your tailwind.config.js has darkMode: 'class'
