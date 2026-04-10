"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { auth, db } from "../../lib/firebase";
import { logHistory } from "@/lib/history";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, setDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [outletId, setOutletId] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "outlets"), orderBy("createdAt"));
    const unsub = onSnapshot(q, (snap) => {
      setOutlets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const u = cred.user;
      if (displayName) {
        try {
          await updateProfile(u, { displayName });
        } catch (err) {
          // ignore
        }
      }
      await setDoc(doc(db, "users", u.uid), {
        email,
        displayName: displayName || "",
        role: "user",
        outletId: outletId || null,
        createdAt: Date.now(),
      });
      try {
        await logHistory("is creating account", email);
      } catch (_) {}
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg border"
      >
        <h2 className="text-2xl font-bold mb-4 text-center">Create account</h2>
        {error && (
          <div className="bg-red-100 text-red-700 px-3 py-2 rounded mb-3">{error}</div>
        )}

        <label className="block mb-2">
          <span className="text-sm font-medium">Name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 block w-full rounded px-3 py-2 border bg-transparent"
            placeholder="Full name (optional)"
          />
        </label>

        <label className="block mb-2">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded px-3 py-2 border bg-transparent"
          />
        </label>

        <label className="block mb-2">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded px-3 py-2 border bg-transparent"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium">Assign to outlet</span>
          <select
            value={outletId || ""}
            onChange={(e) => setOutletId(e.target.value || null)}
            className="mt-1 block w-full rounded px-3 py-2 border bg-transparent"
          >
            <option value="">Select outlet (optional)</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <div className="text-center mt-4">
          <Link href="/" className="text-green-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
