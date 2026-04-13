"use client";
import { useState, useEffect, memo } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { logHistory } from "../lib/history";

// Move StandardInput outside Form and memoize it
const StandardInput = memo(function StandardInput({ value, onChange, label, type = "text", min }) {
  return (
    <input
      className="border rounded px-3 py-2 focus:outline-none focus:ring w-full bg-transparent transition-all duration-200"
      placeholder={label}
      type={type}
      min={min}
      value={value}
      onChange={onChange}
    />
  );
});

export default function Form({ lang, setLang, theme, setTheme, editMaterial, setEditMaterial, onSaveEdit, onlyNameAndExpense, outlets = ["Outlet 1", "Outlet 2"], selectedOutlet, onNext, draft }) {
  const [name, setName] = useState(draft?.name || "");
  const [expense, setExpense] = useState(draft?.expense || "");
  const [sales, setSales] = useState("");
  const [outlet, setOutlet] = useState(draft?.outlet || selectedOutlet || outlets[0] || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const labels = {
    en: {
      materialName: "Material Name",
      expense: "Expense",
      sales: "Sales",
      add: "Add",
      adding: "Adding...",
      addMaterial: "Add Material",
      language: "Language",
      english: "English",
      urdu: "Urdu",
      required: "All fields are required.",
      invalid: "Please enter valid numbers for expense and sales.",
      success: "Material added successfully!"
    },
    ur: {
      materialName: "مواد کا نام",
      expense: "خرچ",
      sales: "فروخت",
      add: "شامل کریں",
      adding: "شامل کیا جا رہا ہے...",
      addMaterial: "مواد شامل کریں",
      language: "زبان",
      english: "انگریزی",
      urdu: "اردو",
      required: "تمام فیلڈز لازمی ہیں۔",
      invalid: "براہ کرم خرچ اور فروخت کے لیے درست نمبر درج کریں۔",
      success: "مواد کامیابی سے شامل ہو گیا!"
    }
  };
  const t = labels[lang];

  useEffect(() => {
    if (editMaterial) {
      setName(editMaterial.name || "");
      setExpense(editMaterial.expense !== undefined ? String(editMaterial.expense) : "");
      setSales(editMaterial.sales !== undefined ? String(editMaterial.sales) : "");
      setOutlet(editMaterial.outlet || selectedOutlet || outlets[0] || "");
      setError("");
      setSuccess("");
    } else if (draft) {
      setName(draft.name || "");
      setExpense(draft.expense || "");
      setOutlet(draft.outlet || selectedOutlet || outlets[0] || "");
      setSales("");
      setError("");
      setSuccess("");
    } else {
      setName("");
      setExpense("");
      setSales("");
      setOutlet(selectedOutlet || outlets[0] || "");
      setError("");
      setSuccess("");
    }
  }, [editMaterial, outlets, selectedOutlet, draft]);

  useEffect(() => {
    if (!editMaterial) {
      setOutlet(selectedOutlet || outlets[0] || "");
    }
  }, [selectedOutlet, outlets, editMaterial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim() || !expense.trim() || !outlet.trim() || (!onlyNameAndExpense && !sales.trim())) {
      setError(t.required);
      return;
    }
    if (isNaN(Number(expense)) || (!onlyNameAndExpense && isNaN(Number(sales)))) {
      setError(t.invalid);
      return;
    }
    setLoading(true);
    try {
      if (editMaterial) {
        await onSaveEdit(editMaterial.id, {
          name: name.trim(),
          expense: parseFloat(expense),
          outlet: outlet.trim(),
          ...(onlyNameAndExpense ? {} : { sales: parseFloat(sales) })
        });
        setSuccess("Material updated successfully!");
        try {
          await logHistory("is updating material", undefined, name.trim());
        } catch (_) {}
        setEditMaterial(null);
      } else {
        await addDoc(collection(db, "materials"), {
          name: name.trim(),
          expense: parseFloat(expense),
          outlet: outlet.trim(),
          ...(onlyNameAndExpense ? {} : { sales: parseFloat(sales) })
        });
        setSuccess(t.success);
        try {
          await logHistory("is adding material", undefined, name.trim());
        } catch (_) {}
      }
      setName("");
      setExpense("");
      setSales("");
      setOutlet(outlets[0] || "");
    } catch (err) {
      setError(err.message || (editMaterial ? "Error updating material" : "Error adding material"));
    }
    setLoading(false);
  };

  const handleNext = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim() || !expense.trim() || !outlet.trim()) {
      setError(t.required);
      return;
    }
    if (isNaN(Number(expense))) {
      setError(t.invalid);
      return;
    }
    if (onNext) {
      onNext({ name: name.trim(), expense: expense.trim(), outlet: outlet.trim() });
    }
  };

  return (
    <div className={
      `max-w-md mx-auto p-4 rounded shadow transition-colors duration-300 ` +
      (theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900")
    }>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <label className="font-medium">{t.language}:</label>
          <select
            className="border rounded px-2 py-1 bg-inherit"
            value={lang}
            onChange={e => setLang(e.target.value)}
          >
            <option value="en">{t.english}</option>
            <option value="ur">{t.urdu}</option>
          </select>
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-2 border-b pb-1">{editMaterial ? "Edit Material" : t.addMaterial}</h1>
      <form onSubmit={onNext ? handleNext : handleSubmit} className="flex flex-col gap-4 mb-6">
        <div>
          <label className="block mb-1 font-medium">Outlet</label>
          <select
            className="border rounded px-3 py-2 w-full bg-transparent"
            value={outlet}
            onChange={e => setOutlet(e.target.value)}
            disabled={!!selectedOutlet}
          >
            {outlets.map((o, idx) => <option key={idx} value={o}>{o}</option>)}
          </select>
        </div>
        <StandardInput
          value={name}
          onChange={e => setName(e.target.value)}
          label={t.materialName}
        />
        <StandardInput
          value={expense}
          onChange={e => setExpense(e.target.value)}
          label={t.expense}
          type="text"
        />
        {/* Only show sales input if not onlyNameAndExpense */}
        {!onlyNameAndExpense && (
          <StandardInput
            value={sales}
            onChange={e => setSales(e.target.value)}
            label={t.sales}
            type="text"
          />
        )}
        {error && <div className="text-red-500 text-sm font-medium">{error}</div>}
        {success && <div className="text-green-600 text-sm font-medium">{success}</div>}
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-green-600 transition-colors"
            disabled={loading}
          >
            {onNext ? "Next" : (loading ? (editMaterial ? "Updating..." : t.adding) : (editMaterial ? "Update" : t.add))}
          </button>
          {editMaterial && (
            <button
              type="button"
              className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 transition-colors"
              onClick={() => setEditMaterial(null)}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}