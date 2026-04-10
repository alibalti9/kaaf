"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { logHistory } from "@/lib/history";

interface OutletDetailsProps {
  outlet: any;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  onUpdate: () => void;
  isAdmin: boolean;
}

export default function OutletDetails({
  outlet,
  isEditing,
  setIsEditing,
  onUpdate,
  isAdmin
}: OutletDetailsProps) {
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    city: "",
    country: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (outlet) {
      setFormData({
        name: outlet.name || "",
        location: outlet.location || "",
        city: outlet.city || "",
        country: outlet.country || "",
        description: outlet.description || "",
      });
    }
  }, [outlet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.name.trim()) {
      setError("Outlet name is required");
      return;
    }

    try {
      setLoading(true);
      await updateDoc(doc(db, "outlets", outlet.id), {
        name: formData.name,
        location: formData.location,
        city: formData.city,
        country: formData.country,
        description: formData.description,
      });
      setSuccess("Outlet updated successfully!");
      try {
        await logHistory(`is updating outlet ${formData.name || outlet.id}`);
      } catch (_) {}
      setIsEditing(false);
      onUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to update outlet");
    } finally {
      setLoading(false);
    }
  };

  if (!(isEditing && isAdmin)) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-green-200 dark:border-green-700">
        <h3 className="text-xl font-bold mb-4 text-green-600 dark:text-green-300">
          Outlet Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Name</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {outlet?.name}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Location</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {outlet?.location || "-"}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">City</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {outlet?.city || "-"}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Country</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {outlet?.country || "-"}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Description
            </p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {outlet?.description || "-"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsEditing(true)}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 transition-colors"
          >
            Edit Details
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-green-200 dark:border-green-700 space-y-4"
    >
      <h3 className="text-xl font-bold text-green-600 dark:text-green-300">
        Edit Outlet Details
      </h3>

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

      <div>
        <label className="block text-sm font-medium mb-1">Outlet Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
          placeholder="Outlet name"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
            placeholder="Location"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) =>
              setFormData({ ...formData, city: e.target.value })
            }
            className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
            placeholder="City"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Country</label>
        <input
          type="text"
          value={formData.country}
          onChange={(e) =>
            setFormData({ ...formData, country: e.target.value })
          }
          className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
          placeholder="Country"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full border rounded px-3 py-2 bg-transparent focus:outline-none focus:ring focus:ring-green-300"
          placeholder="Description"
          rows={4}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 transition-colors disabled:bg-gray-400"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="px-4 py-2 bg-gray-400 text-white rounded font-semibold hover:bg-gray-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
