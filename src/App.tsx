import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, BarChart, Bar
} from "recharts";
import {
  Check, Plus, Trash2, Upload, Download, Dumbbell, Play, ClipboardList, Target, Settings, Activity
} from "lucide-react";

const APP_NAME = "KraftWerk";
const BRAND = { primary: "#E53935", dark: "#000000", success: "#43A047" };
const FIXED_FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1024 1024'>
  <rect width='1024' height='1024' fill='#000000'/>
  <path d='M180 180 L340 180 L340 470 L560 180 L760 180 L520 460 L770 820 L560 820 L380 550 L340 600 L340 820 L180 820 Z' fill='#E53935'/>
  <path d='M560 160 L420 500 L540 500 L460 860 L700 420 L580 420 Z' fill='#FFFFFF'/>
</svg>`;

function useFixedBranding() {
  useEffect(() => {
    document.title = APP_NAME;
    const theme = document.querySelector("meta[name='theme-color']") || document.createElement("meta");
    theme.setAttribute("name", "theme-color");
    theme.setAttribute("content", BRAND.dark);
    document.head.appendChild(theme);
    const fav = document.querySelector("link[rel='icon']") || document.createElement("link");
    fav.setAttribute("rel", "icon");
    fav.setAttribute("type", "image/svg+xml");
    fav.setAttribute("href", "data:image/svg+xml;utf8," + encodeURIComponent(FIXED_FAVICON_SVG));
    document.head.appendChild(fav);
  }, []);
}

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayISO = () => new Date().toISOString().slice(0, 10);
const oneRM = (w, r) => (w && r ? Math.round(w * (1 + r / 30)) : 0);

function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState];
}

const seedExercises = [
  "Brustpresse", "Schulterpresse", "Beinstrecker", "Beinbeuger", "Trizeps", "Bizeps", "Butterfly", "Butterfly Reverse", "Adduktion", "Abduktion", "Beinpresse horizontal", "Latzug", "Ruderzug", "Rückenstrecker", "Bauchpresse"
].map(n => ({ id: uuid(), name: n, type: "kraft" }))
.concat([
  { id: uuid(), name: "Crosstrainer", type: "cardio" },
  { id: uuid(), name: "Laufband", type: "cardio" },
  { id: uuid(), name: "Fahrrad sitzend", type: "cardio" },
  { id: uuid(), name: "Fahrrad liegend", type: "cardio" },
  { id: uuid(), name: "Wandern", type: "outdoor" },
  { id: uuid(), name: "Joggen", type: "outdoor" },
  { id: uuid(), name: "Spazieren", type: "outdoor" },
  { id: uuid(), name: "Mountainbike", type: "outdoor" },
  { id: uuid(), name: "Gravel-Bike", type: "outdoor" },
  { id: uuid(), name: "Rennrad", type: "outdoor" }
]);

const defaultGoals = {
  weeklyTrainingDaysTarget: 3,
  weeklyCardioMinutesTarget: 90,
  weeklyOutdoorDaysTarget: 2,
  weeklyOutdoorKmTarget: 30
};

function NumberInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block w-full">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-300"
      />
    </label>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="bg-white rounded-2xl shadow p-4">{children}</div>
    </div>
  );
}

function Toast() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const h = e => {
      setMsg(String(e.detail || ""));
      setTimeout(() => setMsg(""), 1400);
    };
    window.addEventListener("tp_toast", h);
    return () => window.removeEventListener("tp_toast", h);
  }, []);
  if (!msg) return null;
  return <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm shadow">{msg}</div>;
}

function ExercisesView({ exercises, setExercises }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("kraft");
  const OUTDOOR_SEED = ["Wandern", "Joggen", "Spazieren", "Mountainbike", "Gravel-Bike", "Rennrad"];
  const missingOutdoor = OUTDOOR_SEED.filter(n => !exercises.some(e => e.name === n));
  function ensureOutdoor() {
    if (missingOutdoor.length === 0) return;
    const next = [...exercises];
    OUTDOOR_SEED.forEach(n => {
      if (!next.some(e => e.name === n)) next.push({ id: uuid(), name: n, type: "outdoor" });
    });
    setExercises(next);
  }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 items-end gap-3">
        <label className="block">
          <span className="text-sm text-slate-600 mb-1 block">Name</span>
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z. B. Kniebeuge"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600 mb-1 block">Typ</span>
          <select className="w-full rounded-xl border px-3 py-2" value={type} onChange={e => setType(e.target.value)}>
            <option value="kraft">Kraft</option>
            <option value="cardio">Cardio</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </label>
        <button
          className="px-4 py-2 rounded-xl text-white flex items-center gap-2 justify-center h-[42px]"
          style={{ background: BRAND.primary }}
          onClick={() => {
            if (!name.trim()) return;
            setExercises([...exercises, { id: uuid(), name: name.trim(), type }]);
            setName("");
          }}
        >
          <Plus className="w-4 h-4" /> Übung hinzufügen
        </button>
      </div>
      {missingOutdoor.length > 0 && (
        <button className="px-4 py-2 rounded-xl bg-slate-100" onClick={ensureOutdoor}>
          Fehlende Outdoor-Übungen ergänzen ({missingOutdoor.length})
        </button>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {exercises.map(e => (
          <div key={e.id} className="flex items-center justify-between border rounded-xl p-3">
            <div>
              <div className="font-medium">{e.name}</div>
              <div className="text-xs text-slate-500">{e.type}</div>
            </div>
            <button className="p-2 rounded-lg bg-slate-100" onClick={() => setExercises(exercises.filter(x => x.id !== e.id))}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  useFixedBranding();
  const [exercises, setExercises] = useLocalStorage("tp_exercises", seedExercises);
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span dangerouslySetInnerHTML={{ __html: FIXED_FAVICON_SVG.replace("<svg", "<svg width='28' height='28'") }} />
            {APP_NAME}
          </h1>
        </header>

        {tab === "dashboard" && <Section title="Dashboard" icon={<Play className="w-5 h-5" />}><p>Übersicht folgt.</p></Section>}
        {tab === "exercises" && <Section title="Übungen" icon={<Dumbbell className="w-5 h-5" />}><ExercisesView exercises={exercises} setExercises={setExercises} /></Section>}

        <Toast />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md flex justify-around py-2">
        <button onClick={() => setTab("dashboard")} className={`${tab === "dashboard" ? "text-rose-600" : "text-slate-500"}`}>
          <Play className="w-5 h-5 mx-auto" />
          <div className="text-xs">Dashboard</div>
        </button>
        <button onClick={() => setTab("exercises")} className={`${tab === "exercises" ? "text-rose-600" : "text-slate-500"}`}>
          <Dumbbell className="w-5 h-5 mx-auto" />
          <div className="text-xs">Übungen</div>
        </button>
      </nav>
    </div>
  );
}