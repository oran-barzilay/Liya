import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

export default function Setup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [householdName, setHouseholdName] = useState("Our Home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      // Create household
      const { data: household, error: hErr } = await supabase
        .from("households")
        .insert({ name: householdName })
        .select()
        .single();
      if (hErr) throw hErr;

      // Create user profile
      const { error: uErr } = await supabase.from("users").insert({
        id: user.id,
        household_id: household.id,
        display_name: displayName || user.email?.split("@")[0] || "User",
        role: "owner",
      });
      if (uErr) throw uErr;

      // Seed default finance categories
      const categories = [
        { household_id: household.id, transaction_type: "income", name: "Salary", is_system: true },
        { household_id: household.id, transaction_type: "income", name: "Freelance", is_system: true },
        { household_id: household.id, transaction_type: "expense", name: "Groceries", is_system: true },
        { household_id: household.id, transaction_type: "expense", name: "Rent / Mortgage", is_system: true },
        { household_id: household.id, transaction_type: "expense", name: "Baby & Kids", is_system: true },
        { household_id: household.id, transaction_type: "expense", name: "Health", is_system: true },
        { household_id: household.id, transaction_type: "expense", name: "Transport", is_system: true },
        { household_id: household.id, transaction_type: "expense", name: "Entertainment", is_system: true },
        { household_id: household.id, transaction_type: "expense", name: "Other", is_system: true },
      ];
      await supabase.from("categories").insert(categories);

      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-400">Welcome 👋</h1>
          <p className="text-slate-400 mt-2 text-sm">Let's set up your family household</p>
        </div>
        <form
          onSubmit={handleSetup}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Your name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Oran"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Household name</label>
            <input
              type="text"
              required
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Our Home"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "Creating…" : "Create household"}
          </button>
        </form>
      </div>
    </div>
  );
}

