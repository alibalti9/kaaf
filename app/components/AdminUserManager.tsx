"use client";

import React, { useEffect, useState } from "react";
import { db, firebaseConfig } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, where, setDoc, doc } from "firebase/firestore";
import { logHistory } from "@/lib/history";
import { useAuth } from "./AuthProvider";

export default function AdminUserManager({selectedOutletId}: {selectedOutletId: string | null}) {
  const { userDoc } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newOutletId, setNewOutletId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedOutlets, setSelectedOutlets] = useState<Record<string, string>>({});
  const [pendingChange, setPendingChange] = useState<
    | { uid: string; newOutletId: string | null; prevOutletId: string | null; name?: string }
    | null
  >(null);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "user"),
      where("outletId", "==", selectedOutletId || null)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      const map: Record<string, string> = {};
      snap.docs.forEach((d) => {
        const data: any = d.data();
        map[d.id] = data?.outletId ?? "";
      });
      setUsers(docs);
      setSelectedOutlets(map);
    });
    return () => unsub();
  }, [selectedOutletId]);

  useEffect(() => {
    const q = query(collection(db, "outlets"), orderBy("createdAt"));
    const unsub = onSnapshot(q, (snap) => {
      setOutlets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // When opening the add-user form, default the outlet to the currently selected outlet
  useEffect(() => {
    if (showForm) {
      const defaultOutlet = selectedOutletId ?? (outlets && outlets.length > 0 ? outlets[0].id : null);
      if (defaultOutlet) setNewOutletId(defaultOutlet);
    }
  }, [showForm, selectedOutletId, outlets]);

  const callCreateUser = async () => {
    if (!newEmail || !newPassword) {
      alert("Missing email or password");
      return;
    }
    if (!newOutletId) {
      if (!outlets || outlets.length === 0) {
        alert("No outlets available. Create an outlet first.");
        return;
      }
      alert("Please assign an outlet to the new user.");
      return;
    }
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: newEmail, password: newPassword, returnSecureToken: true }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || JSON.stringify(data));
      const uid = data.localId;
      await setDoc(doc(db, "users", uid), {
        email: newEmail,
        displayName: "",
        role: "user",
        outletId: String(newOutletId),
        createdAt: Date.now(),
      });
      try {
        await logHistory(`is adding user ${newEmail}`);
      } catch (_) {}
      setNewEmail("");
      setNewPassword("");
      // keep default outlet for subsequent creations
      const defaultOutlet = selectedOutletId ?? (outlets && outlets.length > 0 ? outlets[0].id : null);
      setNewOutletId(defaultOutlet);
    } catch (err: any) {
      alert(err?.message || String(err));
    }
  };

  const callUpdateUser = async (uid: string, updates: any) => {
    try {
      await setDoc(doc(db, "users", uid), updates, { merge: true });
      try {
        await logHistory(`is updating user ${uid}`);
      } catch (_) {}
    } catch (err: any) {
      alert(err?.message || String(err));
    }
  };

  if (!userDoc || userDoc.role !== "admin") return null;

  const handleOutletSelectChange = (uid: string, newVal: string) => {
    const prev = selectedOutlets[uid] ?? "";
    // optimistically update UI
    setSelectedOutlets((m) => ({ ...m, [uid]: newVal }));
    setPendingChange({ uid, newOutletId: newVal === "" ? null : newVal, prevOutletId: prev === "" ? null : prev });
  };

  const confirmPendingChange = async (confirm: boolean) => {
    if (!pendingChange) return;
    const { uid, newOutletId, prevOutletId } = pendingChange;
    if (confirm) {
      await callUpdateUser(uid, { outletId: newOutletId });
    } else {
      // revert selection
      setSelectedOutlets((m) => ({ ...m, [uid]: prevOutletId ?? "" }));
    }
    setPendingChange(null);
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold">Users</h3>
        <div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className={`px-3 py-2 rounded ${showForm ? "bg-gray-300" : "bg-green-600 text-white"}`}
          >
            {showForm ? "Cancel" : "Add User"}
          </button>
        </div>
      </div>

      {showForm && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <input
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="px-3 py-2 border rounded bg-transparent"
            />
            <input
              placeholder="Temporary password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="px-3 py-2 border rounded bg-transparent"
            />
          </div>

          <div className="mb-4">
            <select
              value={newOutletId || ""}
              onChange={(e) => setNewOutletId(e.target.value)}
              className="px-3 py-2 border rounded bg-transparent w-full md:w-64"
              required
            >
              <option value="" disabled>
                Select outlet
              </option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 mb-6">
            <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={callCreateUser}>
              Create User
            </button>
          </div>
        </>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.uid} className="flex items-center justify-between gap-3 p-2 border rounded">
            <div>
              <div className="font-medium">{u.displayName || u.email}</div>
              <div className="text-sm text-gray-500">{u.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedOutlets[u.uid] ?? u.outletId ?? ""}
                onChange={(e) => handleOutletSelectChange(u.uid, e.target.value)}
                className="px-2 py-1 border rounded bg-transparent"
              >
                <option value="">No outlet</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {pendingChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded shadow max-w-md w-full">
            <p className="mb-4">
              Are you sure you want to change this user's outlet?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => confirmPendingChange(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                No
              </button>
              <button
                onClick={() => confirmPendingChange(true)}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
