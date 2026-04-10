"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err?.message || "Failed to sign in");
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
        <h2 className="text-2xl font-bold mb-4 text-center">Sign in</h2>
        {error && (
          <div className="bg-red-100 text-red-700 px-3 py-2 rounded mb-3">{error}</div>
        )}
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

        <label className="block mb-4">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded px-3 py-2 border bg-transparent"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        {/* Signup is handled by admins only; public signup link removed */}
      </form>
    </div>
  );
}
