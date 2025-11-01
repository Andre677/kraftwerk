const APP_VERSION = "1.3.2";               // <– hier später einfach hochzählen
const APP_VERSION_KEY = "kraftwerk_version";
import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  Check,
  Plus,
  Trash2,
  Upload,
  Download,
  Dumbbell,
  Play,
  ClipboardList,
  Target,
  Settings,
  Activity,
  HardDriveDownload,
} from "lucide-react";

/**
 * KraftWerk – Offline / lokal
 * - untere Tabbar: Dashboard, Training, Übungen, Pläne, Ziele, Backups
 * - feste Übungen (Kraft, Cardio, Outdoor)
 * - Trainingspläne anlegen/ändern
 * - Eingabemasken mit "abschließen" → wird grün
 * - Dashboard mit KW-Achsen (Training, Cardio, Outdoor, 1RM)
 * - Backups (localStorage, max. 5)
 * - festes Icon (rotes K, weißer Blitz, schwarzer Hintergrund)
 */

const APP_NAME = "KraftWerk";
const BRAND = { primary: "#E53935", dark: "#000000", success: "#22c55e" };

// festes Icon wie besprochen
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

function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
}
function getISOWeekYear(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7));
  return d.getUTCFullYear();
}
function startOfISOWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getUTCDay() + 6) % 7;
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() - day);
  return s;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function oneRM(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  return Math.round(weight * (1 + reps / 30));
}

type ExerciseType = "kraft" | "cardio" | "outdoor";
type Exercise = { id: string; name: string; type: ExerciseType };
type Plan = { id: string; name: string; exerciseIds: string[] };
type SetEntry = { reps: number; weight: number };
type LogEntry = {
  id: string;
  date: string;
  exerciseId: string;
  planId?: string | null;
  sets?: SetEntry[];
  minutes?: number;
  distanceKm?: number;
  elevationM?: number;
  avgSpeedKmh?: number;
  heartRate?: number;
  note?: string;
  completed: boolean;
};
type Goals = {
  weeklyTrainingDaysTarget: number;
  weeklyCardioMinutesTarget: number;
  weeklyOutdoorDaysTarget: number;
  weeklyOutdoorKmTarget: number;
};

const STORAGE_KEYS = {
  EXERCISES: "tp_exercises",
  PLANS: "tp_plans",
  LOGS: "tp_logs",
  GOALS: "tp_goals",
  UI: "tp_ui",
  BACKUPS: "tp_backups_meta_v1",
  SEEDED: "tp_seed_v3",
};

const seedExercises: Exercise[] = [
  // Kraft
  "Brustpresse",
  "Schulterpresse",
  "Beinstrecker",
  "Beinbeuger",
  "Trizeps",
  "Bizeps",
  "Butterfly",
  "Butterfly Reverse",
  "Adduktion",
  "Abduktion",
  "Beinpresse horizontal",
  "Latzug",
  "Ruderzug",
  "Rückenstrecker",
  "Bauchpresse",
].map((n) => ({ id: uuid(), name: n, type: "kraft" as const }))
  .concat([
    // Cardio
    { id: uuid(), name: "Crosstrainer", type: "cardio" },
    { id: uuid(), name: "Fahrrad sitzend", type: "cardio" },
    { id: uuid(), name: "Fahrrad liegend", type: "cardio" },
    { id: uuid(), name: "Laufband", type: "cardio" },
    // Outdoor
    { id: uuid(), name: "Wandern", type: "outdoor" },
    { id: uuid(), name: "Joggen", type: "outdoor" },
    { id: uuid(), name: "Spazieren", type: "outdoor" },
    { id: uuid(), name: "Mountainbike", type: "outdoor" },
    { id: uuid(), name: "Gravel-Bike", type: "outdoor" },
    { id: uuid(), name: "Rennrad", type: "outdoor" },
  ]);

const defaultGoals: Goals = {
  weeklyTrainingDaysTarget: 3,
  weeklyCardioMinutesTarget: 90,
  weeklyOutdoorDaysTarget: 2,
  weeklyOutdoorKmTarget: 30,
};

function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : initial;
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

function Toast() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const h = (e: any) => {
      setMsg(String(e.detail || ""));
      setTimeout(() => setMsg(""), 1400);
    };
    window.addEventListener("tp_toast", h);
    return () => window.removeEventListener("tp_toast", h);
  }, []);
  if (!msg) return null;
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm shadow">
      {msg}
    </div>
  );
}

function UpdateBanner({ onReload }: { onReload: () => void }) {
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-4 py-2 rounded-xl shadow flex items-center gap-3">
      <span>Neue Version verfügbar</span>
      <button
        onClick={onReload}
        className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-lg text-sm"
      >
        Jetzt neu laden
      </button>
    </div>
  );
}

function Section({ title, icon, children, right }: { title: string; icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {right}
      </div>
      <div className="bg-white rounded-2xl shadow p-4">{children}</div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  logs,
  onLog,
  planId,
}: {
  exercise: Exercise;
  logs: LogEntry[];
  onLog: (entry: LogEntry) => void;
  planId?: string | null;
}) {
  const [sets, setSets] = useState<SetEntry[]>([{ reps: 10, weight: 0 }]);
  const [minutes, setMinutes] = useState(30);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elevationM, setElevationM] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [note, setNote] = useState("");
  const [completed, setCompleted] = useState(false);

  const last = useMemo(() => {
    return [...logs]
      .filter((l) => l.exerciseId === exercise.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [logs, exercise.id]);

  useEffect(() => {
    if (!last) return;
    if (exercise.type === "kraft" && last.sets && last.sets.length) {
      setSets(last.sets.map((s) => ({ reps: s.reps || 0, weight: s.weight || 0 })));
    }
    if (exercise.type === "cardio" || exercise.type === "outdoor") {
      if (typeof last.minutes === "number") setMinutes(last.minutes);
    }
    if (exercise.type === "outdoor") {
      if (typeof last.distanceKm === "number") setDistanceKm(last.distanceKm);
      if (typeof last.elevationM === "number") setElevationM(last.elevationM);
      if (typeof last.heartRate === "number") setHeartRate(last.heartRate);
    }
    if (last.note) setNote(last.note);
  }, [last, exercise.type]);

  const avgSpeed =
    exercise.type === "outdoor" && minutes > 0 ? Number((distanceKm / (minutes / 60)).toFixed(2)) : 0;

  const colorCls = completed
    ? "bg-emerald-50 border-emerald-300"
    : "bg-rose-50 border-rose-300";

  return (
    <div className={`rounded-2xl p-4 border-2 ${colorCls}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold flex items-center gap-2">
          <Dumbbell className="w-4 h-4" />
          {exercise.name}{" "}
          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
            {exercise.type === "kraft"
              ? "Kraft"
              : exercise.type === "cardio"
              ? "Cardio"
              : "Outdoor"}
          </span>
        </div>
        <button
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm shadow ${
            completed ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
          onClick={() => {
            const nowCompleted = !completed;
            setCompleted(nowCompleted);
            if (nowCompleted) {
              const entry: LogEntry = {
                id: uuid(),
                date: todayISO(),
                exerciseId: exercise.id,
                planId: planId || null,
                sets: exercise.type === "kraft" ? sets : [],
                minutes: exercise.type !== "kraft" ? minutes : 0,
                distanceKm: exercise.type === "outdoor" ? distanceKm : undefined,
                elevationM: exercise.type === "outdoor" ? elevationM : undefined,
                avgSpeedKmh: exercise.type === "outdoor" ? avgSpeed : undefined,
                heartRate: exercise.type === "outdoor" ? (heartRate || undefined) : undefined,
                note: note?.trim() || "",
                completed: true,
              };
              onLog(entry);
              window.dispatchEvent(
                new CustomEvent("tp_toast", { detail: exercise.name + " abgeschlossen" })
              );
            }
          }}
        >
          <Check className="w-4 h-4" />
          {completed ? "abgeschlossen" : "abschließen"}
        </button>
      </div>

      {last && (
        <div className="mb-3 text-xs text-slate-600">
          <div className="font-medium">Letztes Ergebnis am {last.date}:</div>
          {exercise.type === "kraft" ? (
            <div>
              {(last.sets || []).length === 0
                ? "-"
                : (last.sets || []).map((s, i) => (
                    <span key={i} className="mr-2">
                      Satz {i + 1}: {s.reps}×{s.weight}kg
                    </span>
                  ))}
            </div>
          ) : exercise.type === "outdoor" ? (
            <div>
              {(last.minutes || 0) + " Min · " + (last.distanceKm || 0) + " km"}
              {typeof last.avgSpeedKmh === "number" ? ` · Ø ${last.avgSpeedKmh} km/h` : ""}
              {typeof last.elevationM === "number" ? ` · ${last.elevationM} hm` : ""}
              {typeof last.heartRate === "number" ? ` · ${last.heartRate} bpm` : ""}
            </div>
          ) : (
            <div>{last.minutes || 0} Min</div>
          )}
          {last.note && <div className="italic">Notiz: {last.note}</div>}
        </div>
      )}

      {exercise.type === "kraft" ? (
        <div className="space-y-3">
          {sets.map((s, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-slate-600">Satz {idx + 1} – Wdh.</span>
                <input
                  type="number"
                  value={s.reps}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const ns = [...sets];
                    ns[idx] = { ...ns[idx], reps: v };
                    setSets(ns);
                  }}
                  className="w-full rounded-xl border px-3 py-2"
                  min={0}
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-600">Satz {idx + 1} – kg</span>
                <input
                  type="number"
                  value={s.weight}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const ns = [...sets];
                    ns[idx] = { ...ns[idx], weight: v };
                    setSets(ns);
                  }}
                  className="w-full rounded-xl border px-3 py-2"
                  min={0}
                />
              </label>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 rounded-xl bg-slate-100"
              onClick={() => setSets([...sets, { reps: 10, weight: 0 }])}
            >
              <Plus className="w-4 h-4 inline" /> Satz
            </button>
            {sets.length > 1 && (
              <button
                className="px-3 py-1.5 rounded-xl bg-slate-100"
                onClick={() => setSets(sets.slice(0, -1))}
              >
                <Trash2 className="w-4 h-4 inline" /> entfernen
              </button>
            )}
          </div>
        </div>
      ) : exercise.type === "outdoor" ? (
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm text-slate-600">Dauer (Min)</span>
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Distanz (km)</span>
            <input
              type="number"
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Höhenmeter</span>
            <input
              type="number"
              value={elevationM}
              onChange={(e) => setElevationM(Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Ø km/h</span>
            <input
              type="number"
              value={avgSpeed}
              readOnly
              className="w-full rounded-xl border px-3 py-2 bg-slate-50"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Puls (optional)</span>
            <input
              type="number"
              value={heartRate}
              onChange={(e) => setHeartRate(Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2"
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-600">Cardio-Minuten</span>
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2"
            />
          </label>
        </div>
      )}

      <div className="mt-3">
        <label className="block">
          <span className="text-sm text-slate-600">Notiz (optional)</span>
          <textarea
            className="w-full rounded-xl border px-3 py-2"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Technik, Gefühl, RPE, Hinweise..."
          />
        </label>
      </div>
    </div>
  );
}

function TrainingView({
  exercises,
  plans,
  logs,
  onAddLog,
  onDonePlan,
}: {
  exercises: Exercise[];
  plans: Plan[];
  logs: LogEntry[];
  onAddLog: (entry: LogEntry) => void;
  onDonePlan: () => void;
}) {
  const [mode, setMode] = useState<"plan" | "einzel">("plan");
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id || "");
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]?.id || "");

  const plan = plans.find((p) => p.id === selectedPlan);
  const exercise = exercises.find((e) => e.id === selectedExercise);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
        <button
          className={`px-3 py-1.5 rounded-lg ${
            mode === "plan" ? "bg-white shadow" : ""
          }`}
          onClick={() => setMode("plan")}
        >
          <ClipboardList className="w-4 h-4 inline mr-1" /> Plan
        </button>
        <button
          className={`px-3 py-1.5 rounded-lg ${
            mode === "einzel" ? "bg-white shadow" : ""
          }`}
          onClick={() => setMode("einzel")}
        >
          <Dumbbell className="w-4 h-4 inline mr-1" /> Einzel
        </button>
      </div>

      {mode === "plan" ? (
        <>
          <label className="block">
            <span className="text-sm text-slate-600">Trainingsplan</span>
            <select
              className="w-full mt-1 px-3 py-2 rounded-xl border"
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {plan ? (
            <div className="space-y-4">
              {plan.exerciseIds.map((eid) => {
                const ex = exercises.find((e) => e.id === eid);
                if (!ex) return null;
                return (
                  <ExerciseCard
                    key={eid}
                    exercise={ex}
                    logs={logs}
                    onLog={(entry) => onAddLog({ ...entry, planId: plan.id })}
                    planId={plan.id}
                  />
                );
              })}
              <button
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 text-white inline-flex items-center gap-2"
                onClick={onDonePlan}
              >
                <Check className="w-4 h-4" /> Trainingsplan abschließen
              </button>
            </div>
          ) : (
            <div className="text-slate-500">Kein Plan ausgewählt.</div>
          )}
        </>
      ) : (
        <>
          <label className="block">
            <span className="text-sm text-slate-600">Übung</span>
            <select
              className="w-full mt-1 px-3 py-2 rounded-xl border"
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
            >
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          {exercise ? (
            <ExerciseCard exercise={exercise} logs={logs} onLog={onAddLog} />
          ) : (
            <div className="text-slate-500">Keine Übung ausgewählt.</div>
          )}
        </>
      )}
    </div>
  );
}

function ExercisesView({
  exercises,
  setExercises,
}: {
  exercises: Exercise[];
  setExercises: (v: Exercise[]) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ExerciseType>("kraft");

  const OUTDOOR_SEED = [
    "Wandern",
    "Joggen",
    "Spazieren",
    "Mountainbike",
    "Gravel-Bike",
    "Rennrad",
  ];
  const missingOutdoor = OUTDOOR_SEED.filter((n) => !exercises.some((e) => e.name === n));

  function ensureOutdoor() {
    if (missingOutdoor.length === 0) return;
    const next = [...exercises];
    OUTDOOR_SEED.forEach((n) => {
      if (!next.some((e) => e.name === n)) next.push({ id: uuid(), name: n, type: "outdoor" });
    });
    setExercises(next);
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 items-end gap-3">
        <label className="block">
          <span className="text-sm text-slate-600 mb-1 block">Name der Übung</span>
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Kniebeuge"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600 mb-1 block">Typ</span>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={type}
            onChange={(e) => setType(e.target.value as ExerciseType)}
          >
            <option value="kraft">Kraft</option>
            <option value="cardio">Cardio</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </label>
        <button
          className="px-4 py-2 rounded-xl text-white inline-flex items-center gap-2 h-[42px] justify-center"
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
        {exercises.map((e) => (
          <div key={e.id} className="flex items-center justify-between border rounded-xl p-3">
            <div>
              <div className="font-medium">{e.name}</div>
              <div className="text-xs text-slate-500">
                {e.type === "kraft" ? "Kraft" : e.type === "cardio" ? "Cardio" : "Outdoor"}
              </div>
            </div>
            <button
              className="p-2 rounded-lg bg-slate-100"
              onClick={() => setExercises(exercises.filter((x) => x.id !== e.id))}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlansView({
  exercises,
  plans,
  setPlans,
}: {
  exercises: Exercise[];
  plans: Plan[];
  setPlans: (v: Plan[]) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  function updatePlan(id: string, patch: Partial<Plan>) {
    setPlans(plans.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm text-slate-600 mb-1 block">Name des Plans</span>
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. GK A"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600 mb-1 block">Übungen wählen</span>
          <select
            multiple
            className="w-full rounded-xl border px-3 py-2 min-h-32"
            value={selected}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
              setSelected(opts);
            }}
          >
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            className="px-4 py-2 rounded-xl text-white inline-flex items-center gap-2"
            style={{ background: BRAND.primary }}
            onClick={() => {
              if (!name.trim()) return;
              setPlans([...plans, { id: uuid(), name: name.trim(), exerciseIds: selected }]);
              setName("");
              setSelected([]);
            }}
          >
            <Plus className="w-4 h-4" /> Plan hinzufügen
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="border rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <input
                className="font-medium bg-transparent outline-none px-2 py-1 border rounded-lg"
                value={p.name}
                onChange={(e) => updatePlan(p.id, { name: e.target.value })}
              />
              <button
                className="p-2 rounded-lg bg-slate-100"
                onClick={() => setPlans(plans.filter((x) => x.id !== p.id))}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <span className="text-sm text-slate-600">Übungen im Plan</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.exerciseIds.map((id) => {
                  const ex = exercises.find((e) => e.id === id);
                  if (!ex) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-full text-sm"
                    >
                      {ex.name}
                      <button
                        className="p-1"
                        onClick={() =>
                          updatePlan(p.id, {
                            exerciseIds: p.exerciseIds.filter((x) => x !== id),
                          })
                        }
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="mt-2">
                <select
                  className="w-full rounded-xl border px-3 py-2"
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    if (!p.exerciseIds.includes(id))
                      updatePlan(p.id, { exerciseIds: [...p.exerciseIds, id] });
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Übung hinzufügen…
                  </option>
                  {exercises
                    .filter((e) => !p.exerciseIds.includes(e.id))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsView({ goals, setGoals }: { goals: Goals; setGoals: (v: Goals) => void }) {
  const [days, setDays] = useState(goals.weeklyTrainingDaysTarget);
  const [cardio, setCardio] = useState(goals.weeklyCardioMinutesTarget);
  const [outDays, setOutDays] = useState(goals.weeklyOutdoorDaysTarget);
  const [outKm, setOutKm] = useState(goals.weeklyOutdoorKmTarget);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <label className="block">
        <span className="text-sm text-slate-600">Ziel: Trainingstage/Woche</span>
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-full rounded-xl border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-600">Ziel: Cardio-Minuten/Woche</span>
        <input
          type="number"
          value={cardio}
          onChange={(e) => setCardio(Number(e.target.value))}
          className="w-full rounded-xl border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-600">Ziel: Outdoor-Tage/Woche</span>
        <input
          type="number"
          value={outDays}
          onChange={(e) => setOutDays(Number(e.target.value))}
          className="w-full rounded-xl border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-600">Ziel: Outdoor-Kilometer/Woche</span>
        <input
          type="number"
          value={outKm}
          onChange={(e) => setOutKm(Number(e.target.value))}
          className="w-full rounded-xl border px-3 py-2"
        />
      </label>
      <div className="md:col-span-2">
        <button
          className="px-4 py-2 rounded-xl text-white inline-flex items-center gap-2"
          style={{ background: BRAND.primary }}
          onClick={() =>
            setGoals({
              weeklyTrainingDaysTarget: days,
              weeklyCardioMinutesTarget: cardio,
              weeklyOutdoorDaysTarget: outDays,
              weeklyOutdoorKmTarget: outKm,
            })
          }
        >
          <Check className="w-4 h-4" /> Ziele speichern
        </button>
      </div>
    </div>
  );
}

function BackupsView({
  data,
  onRestore,
  onCreate,
  backups,
  onDelete,
  onDownload,
  lastBackupAt,
}: {
  data: any;
  onRestore: (name: string) => void;
  onCreate: () => void;
  backups: any[];
  onDelete: (name: string) => void;
  onDownload: (name: string) => void;
  lastBackupAt: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Automatische Sicherung</div>
          <div className="text-sm text-slate-600">
            Max. 5 Backups. Älteste wird ersetzt. Daten bleiben lokal.
          </div>
        </div>
        <button className="px-3 py-2 rounded-xl bg-slate-100" onClick={onCreate}>
          Backup jetzt anlegen
        </button>
      </div>
      <div className="border rounded-xl divide-y">
        {backups.length === 0 ? (
          <div className="p-3 text-slate-500 text-sm">Noch keine Sicherungen vorhanden.</div>
        ) : (
          backups.map((b) => (
            <div key={b.name} className="p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-slate-500">
                  {Math.round((b.content?.length || 0) / 1024)} KB
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-slate-100" onClick={() => onDownload(b.name)}>
                  Download
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-slate-100" onClick={() => onRestore(b.name)}>
                  Wiederherstellen
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-slate-100" onClick={() => onDelete(b.name)}>
                  Löschen
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="text-xs text-slate-500">
        Zuletzt gesichert: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "–"}
      </div>
    </div>
  );
}

function Dashboard({
  exercises,
  logs,
  goals,
}: {
  exercises: Exercise[];
  logs: LogEntry[];
  goals: Goals;
}) {
  const weeks = useMemo(() => {
    const now = new Date();
    const start = startOfISOWeek(now);
    const arr: any[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(start);
      ws.setUTCDate(ws.getUTCDate() - i * 7);
      const we = addDays(ws, 7);
      const wk = getISOWeek(ws);
      const yr = getISOWeekYear(ws);
      const label = `KW ${String(wk).padStart(2, "0")}/${yr}`;

      const wlogs = logs.filter((l) => {
        const d = new Date(l.date + "T00:00:00Z");
        return d >= ws && d < we;
      });

      const trainingDays = new Set(wlogs.map((l) => l.date)).size;
      const cardioMinutes = wlogs.reduce((s, l) => s + (l.minutes || 0), 0);

      const outLogs = wlogs.filter(
        (l) => exercises.find((e) => e.id === l.exerciseId)?.type === "outdoor"
      );
      const outdoorKm = outLogs.reduce((s, l) => s + (l.distanceKm || 0), 0);
      const outdoorMinutes = outLogs.reduce((s, l) => s + (l.minutes || 0), 0);
      const outdoorAvgSpeed = outLogs.length
        ? Number(
            (outLogs.reduce((s, l) => s + (l.avgSpeedKmh || 0), 0) / outLogs.length).toFixed(2)
          )
        : 0;

      arr.push({
        key: `${yr}-W${wk}`,
        label,
        trainingDays,
        cardioMinutes,
        outdoorKm,
        outdoorMinutes,
        outdoorAvgSpeed,
      });
    }
    return arr;
  }, [logs, exercises]);

  const top1RM = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((l) =>
      (l.sets || []).forEach((s) => {
        const est = oneRM(s.weight, s.reps);
        map[l.exerciseId] = Math.max(map[l.exerciseId] || 0, est);
      })
    );
    return Object.entries(map)
      .map(([eid, max]) => ({
        exercise: exercises.find((e) => e.id === eid)?.name || "?",
        max,
      }))
      .sort((a, b) => b.max - a.max);
  }, [logs, exercises]);

  const currentWeek = useMemo(() => {
    const now = new Date();
    const ws = startOfISOWeek(now);
    const we = addDays(ws, 7);
    const wlogs = logs.filter((l) => {
      const d = new Date(l.date + "T00:00:00Z");
      return d >= ws && d < we;
    });
    const trainingDays = new Set(wlogs.map((l) => l.date)).size;
    const cardioMinutes = wlogs.reduce((s, l) => s + (l.minutes || 0), 0);

    const outLogs = wlogs.filter(
      (l) => exercises.find((e) => e.id === l.exerciseId)?.type === "outdoor"
    );
    const outdoorDays = new Set(outLogs.map((l) => l.date)).size;
    const outdoorKm = outLogs.reduce((s, l) => s + (l.distanceKm || 0), 0);

    const daysPct = goals.weeklyTrainingDaysTarget
      ? Math.min(100, Math.round((trainingDays / goals.weeklyTrainingDaysTarget) * 100))
      : 0;
    const cardioPct = goals.weeklyCardioMinutesTarget
      ? Math.min(100, Math.round((cardioMinutes / goals.weeklyCardioMinutesTarget) * 100))
      : 0;
    const outDaysPct = goals.weeklyOutdoorDaysTarget
      ? Math.min(100, Math.round((outdoorDays / goals.weeklyOutdoorDaysTarget) * 100))
      : 0;
    const outKmPct = goals.weeklyOutdoorKmTarget
      ? Math.min(100, Math.round((outdoorKm / goals.weeklyOutdoorKmTarget) * 100))
      : 0;

    return {
      trainingDays,
      cardioMinutes,
      outdoorDays,
      outdoorKm,
      daysPct,
      cardioPct,
      outDaysPct,
      outKmPct,
    };
  }, [logs, goals, exercises]);

  const [selExercise, setSelExercise] = useState(
    () => exercises.find((e) => e.type === "kraft")?.id || ""
  );

  const oneRMSeries = useMemo(() => {
    if (!selExercise) return [];
    const map = new Map<string, { label: string; oneRM: number }>();
    logs
      .filter((l) => l.exerciseId === selExercise)
      .forEach((l) => {
        const best = Math.max(0, ...(l.sets || []).map((s) => oneRM(s.weight, s.reps)));
        const d = new Date(l.date + "T00:00:00Z");
        const wk = getISOWeek(d);
        const yr = getISOWeekYear(d);
        const key = `${yr}-W${String(wk).padStart(2, "0")}`;
        const label = `KW ${String(wk).padStart(2, "0")}/${yr}`;
        const prev = map.get(key)?.oneRM || 0;
        if (best > prev) map.set(key, { label, oneRM: best });
      });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v);
  }, [selExercise, logs]);

  return (
    <div className="space-y-6">
      <Section title="Wochen-Trends – Training & Cardio" icon={<Play className="w-5 h-5" />}>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeks}>
                <CartesianGrid strokeDasharray="2 2" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="trainingDays" name="Trainingstage" stroke="#ef4444" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeks}>
                <CartesianGrid strokeDasharray="2 2" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cardioMinutes" name="Cardio-Minuten" stroke="#0ea5e9" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="Outdoor-Trends" icon={<Activity className="w-5 h-5" />}>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeks}>
                <CartesianGrid strokeDasharray="2 2" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="outdoorKm" name="Distanz (km)" stroke="#6366f1" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks}>
                <CartesianGrid strokeDasharray="2 2" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="outdoorMinutes" name="Outdoor-Minuten" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeks}>
                <CartesianGrid strokeDasharray="2 2" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="outdoorAvgSpeed" name="Ø km/h" stroke="#22c55e" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="1RM-Verlauf pro Übung (KW-aggregiert)" icon={<Dumbbell className="w-5 h-5" />}>
        <label className="block mb-2">
          <span className="text-sm text-slate-600">Übung auswählen</span>
          <select
            className="w-full rounded-xl border px-3 py-2 mt-1"
            value={selExercise}
            onChange={(e) => setSelExercise(e.target.value)}
          >
            <option value="">– Bitte wählen –</option>
            {exercises
              .filter((e) => e.type === "kraft")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </label>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={oneRMSeries}>
              <CartesianGrid strokeDasharray="2 2" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="oneRM" name="1RM (kg)" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Bestes 1RM je Übung" icon={<Dumbbell className="w-5 h-5" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2">Übung</th>
                <th className="py-2">1RM (geschätzt)</th>
              </tr>
            </thead>
            <tbody>
              {top1RM.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-4 text-slate-500">
                    Noch keine Kraftdaten erfasst.
                  </td>
                </tr>
              ) : (
                top1RM.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2">{r.exercise}</td>
                    <td className="py-2">{r.max} kg</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Zielerreichung (aktuelle Woche)" icon={<Target className="w-5 h-5" />}>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4">
            <div className="text-sm text-slate-600">Trainingstage</div>
            <div className="text-2xl font-semibold">
              {currentWeek.trainingDays} / {goals.weeklyTrainingDaysTarget} ({currentWeek.daysPct}%)
            </div>
            <div className="h-2 bg-slate-100 rounded-full mt-2">
              <div
                className="h-2 bg-emerald-500 rounded-full"
                style={{ width: `${currentWeek.daysPct}%` }}
              />
            </div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="text-sm text-slate-600">Cardio-Minuten</div>
            <div className="text-2xl font-semibold">
              {currentWeek.cardioMinutes} / {goals.weeklyCardioMinutesTarget} ({currentWeek.cardioPct}
              %)
            </div>
            <div className="h-2 bg-slate-100 rounded-full mt-2">
              <div
                className="h-2 bg-emerald-500 rounded-full"
                style={{ width: `${currentWeek.cardioPct}%` }}
              />
            </div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="text-sm text-slate-600">Outdoor-Tage</div>
            <div className="text-2xl font-semibold">
              {currentWeek.outdoorDays} / {goals.weeklyOutdoorDaysTarget} ({currentWeek.outDaysPct}
              %)
            </div>
            <div className="h-2 bg-slate-100 rounded-full mt-2">
              <div
                className="h-2 bg-emerald-500 rounded-full"
                style={{ width: `${currentWeek.outDaysPct}%` }}
              />
            </div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="text-sm text-slate-600">Outdoor-Kilometer</div>
            <div className="text-2xl font-semibold">
              {currentWeek.outdoorKm} / {goals.weeklyOutdoorKmTarget} ({currentWeek.outKmPct}%)
            </div>
            <div className="h-2 bg-slate-100 rounded-full mt-2">
              <div
                className="h-2 bg-emerald-500 rounded-full"
                style={{ width: `${currentWeek.outKmPct}%` }}
              />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function VersionBanner({
  version,
  latestVersion,
  onReload,
}: {
  version: string;
  latestVersion: string;
  onReload: () => void;
}) {
  const isUpToDate = version === latestVersion;

  return (
    <div
      className={`${
        isUpToDate
          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
          : "bg-amber-50 border-amber-300 text-amber-800"
      } border px-4 py-2 rounded-xl mb-4 flex items-center justify-between shadow-sm`}
    >
      <span className="font-medium">
        {isUpToDate ? (
          <>✅ KraftWerk v{latestVersion} – Aktuellste Version installiert</>
        ) : (
          <>⚠️ Neue Version verfügbar (v{latestVersion})</>
        )}
      </span>

      {isUpToDate ? (
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("tp_toast", { detail: "App ist aktuell" })
            )
          }
          className="text-sm font-semibold text-emerald-700 hover:underline"
        >
          Neu prüfen
        </button>
      ) : (
        <button
          onClick={onReload}
          className="text-sm font-semibold text-amber-700 hover:underline"
        >
          Jetzt aktualisieren
        </button>
      )}
    </div>
  );
}

export default function App() {
  useFixedBranding();

  // Version aus localStorage holen (oder "0.0.0", falls noch nie gespeichert)
  const [storedVersion, setStoredVersion] = React.useState<string>(
    localStorage.getItem(APP_VERSION_KEY) || "0.0.0"
  );

  // beim ersten Mount: wenn nichts da → aktuelle Version speichern
  React.useEffect(() => {
    if (!localStorage.getItem(APP_VERSION_KEY)) {
      localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
      setStoredVersion(APP_VERSION);
    }
  }, []);

  const [showUpdate, setShowUpdate] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem(APP_VERSION_KEY);
    if (!saved) {
      // erstes Mal → aktuelle Version merken
      localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
    } else if (saved !== APP_VERSION) {
      // es gibt eine neuere Version im Code → Hinweis anzeigen
      setShowUpdate(true);
      // aber NICHT sofort überschreiben – erst nach Reload
    }
  }, []);

  // ... dein bisheriger Code

  // Seed beim ersten Mal
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEYS.SEEDED)) {
      localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(seedExercises));
      localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(defaultGoals));
      localStorage.setItem(STORAGE_KEYS.SEEDED, "1");
    }
  }, []);

  const [exercises, setExercises] = useLocalStorage<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
  const [plans, setPlans] = useLocalStorage<Plan[]>(STORAGE_KEYS.PLANS, []);
  const [logs, setLogs] = useLocalStorage<LogEntry[]>(STORAGE_KEYS.LOGS, []);
  const [goals, setGoals] = useLocalStorage<Goals>(STORAGE_KEYS.GOALS, defaultGoals);
  const [tab, setTab] = useLocalStorage(STORAGE_KEYS.UI, { tab: "dashboard" });

  // Backups
  const [lastBackupAt, setLastBackupAt] = useState(
    () => localStorage.getItem("tp_last_backup_at") || ""
  );
  const backups = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BACKUPS) || "[]");
    } catch {
      return [];
    }
  }, [tab.tab]); // einfache Aktualisierung

  async function createBackup() {
    const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.BACKUPS) || "[]");
    const content = JSON.stringify({ exercises, plans, logs, goals });
    const name = `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    meta.push({ name, content });
    while (meta.length > 5) meta.shift();
    localStorage.setItem(STORAGE_KEYS.BACKUPS, JSON.stringify(meta));
    const now = new Date().toISOString();
    localStorage.setItem("tp_last_backup_at", now);
    setLastBackupAt(now);
    window.dispatchEvent(new CustomEvent("tp_toast", { detail: "Backup angelegt" }));
  }

  function restoreBackup(name: string) {
    const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.BACKUPS) || "[]");
    const entry = meta.find((m: any) => m.name === name);
    if (!entry) {
      alert("Backup nicht gefunden");
      return;
    }
    try {
      const obj = JSON.parse(entry.content);
      setExercises(obj.exercises || []);
      setPlans(obj.plans || []);
      setLogs(obj.logs || []);
      setGoals(obj.goals || defaultGoals);
      window.dispatchEvent(new CustomEvent("tp_toast", { detail: "Backup wiederhergestellt" }));
    } catch {
      alert("Backup konnte nicht gelesen werden");
    }
  }

  function deleteBackup(name: string) {
    const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.BACKUPS) || "[]").filter(
      (m: any) => m.name !== name
    );
    localStorage.setItem(STORAGE_KEYS.BACKUPS, JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent("tp_toast", { detail: "Backup gelöscht" }));
  }

  function downloadBackup(name: string) {
    const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.BACKUPS) || "[]");
    const entry = meta.find((m: any) => m.name === name);
    if (!entry) return;
    const blob = new Blob([entry.content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function addLog(entry: LogEntry) {
    setLogs([entry, ...logs]);
  }

  function exportJSON() {
    const data = { exercises, plans, logs, goals };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kraftwerk_export_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (obj.exercises && obj.plans && obj.logs && obj.goals) {
          setExercises(obj.exercises);
          setPlans(obj.plans);
          setLogs(obj.logs);
          setGoals(obj.goals);
          window.dispatchEvent(
            new CustomEvent("tp_toast", { detail: "Daten erfolgreich importiert" })
          );
        } else {
          alert("Ungültige Datei");
        }
      } catch {
        alert("Konnte Datei nicht lesen");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  }

  return (
  <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
    {/* Versions-Info / Update-Hinweis */}
    <VersionBanner
      version={storedVersion}
      latestVersion={APP_VERSION}
      onReload={() => {
        // wenn Nutzer auf "Jetzt aktualisieren" klickt:
        localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
        location.reload();
      }}
    />
            {APP_NAME}
          </h1>
          {/* Desktop-Navigation (optional) */}
          <div className="hidden sm:flex gap-2">
            <button
              onClick={() => setTab({ tab: "dashboard" })}
              className={`px-3 py-2 rounded-xl ${
                tab.tab === "dashboard" ? "bg-white shadow" : "bg-slate-100"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setTab({ tab: "training" })}
              className={`px-3 py-2 rounded-xl ${
                tab.tab === "training" ? "bg-white shadow" : "bg-slate-100"
              }`}
            >
              Training
            </button>
            <button
              onClick={() => setTab({ tab: "exercises" })}
              className={`px-3 py-2 rounded-xl ${
                tab.tab === "exercises" ? "bg-white shadow" : "bg-slate-100"
              }`}
            >
              Übungen
            </button>
            <button
              onClick={() => setTab({ tab: "plans" })}
              className={`px-3 py-2 rounded-xl ${
                tab.tab === "plans" ? "bg-white shadow" : "bg-slate-100"
              }`}
            >
              Pläne
            </button>
            <button
              onClick={() => setTab({ tab: "goals" })}
              className={`px-3 py-2 rounded-xl ${
                tab.tab === "goals" ? "bg-white shadow" : "bg-slate-100"
              }`}
            >
              Ziele
            </button>
            <button
              onClick={() => setTab({ tab: "backups" })}
              className={`px-3 py-2 rounded-xl ${
                tab.tab === "backups" ? "bg-white shadow" : "bg-slate-100"
              }`}
            >
              Backups
            </button>
          </div>
        </header>

        {showUpdate && (
  <UpdateBanner
    onReload={() => {
      localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
      location.reload();
    }}
  />
)}
        
        {tab.tab === "dashboard" && (
          <Dashboard exercises={exercises} logs={logs} goals={goals} />
        )}

        {tab.tab === "training" && (
          <Section
            title="Training"
            icon={<Play className="w-5 h-5" />}
            right={
              <div className="flex items-center gap-2">
                <label className="px-3 py-2 rounded-xl bg-slate-100 cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Import
                  <input className="hidden" type="file" accept="application/json" onChange={importJSON} />
                </label>
                <button
                  className="px-3 py-2 rounded-xl bg-slate-100 inline-flex items-center gap-2"
                  onClick={exportJSON}
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
            }
          >
            <TrainingView
              exercises={exercises}
              plans={plans}
              logs={logs}
              onAddLog={(entry) => setLogs([entry, ...logs])}
              onDonePlan={() => {
                window.dispatchEvent(
                  new CustomEvent("tp_toast", { detail: "Trainingsplan abgeschlossen" })
                );
                setTab({ tab: "dashboard" });
              }}
            />
          </Section>
        )}

        {tab.tab === "exercises" && (
          <Section title="Übungen" icon={<Dumbbell className="w-5 h-5" />}>
            <ExercisesView exercises={exercises} setExercises={setExercises} />
          </Section>
        )}

        {tab.tab === "plans" && (
          <Section title="Trainingspläne" icon={<ClipboardList className="w-5 h-5" />}>
            <PlansView exercises={exercises} plans={plans} setPlans={setPlans} />
          </Section>
        )}

        {tab.tab === "goals" && (
          <Section title="Ziele" icon={<Settings className="w-5 h-5" />}>
            <GoalsView goals={goals} setGoals={setGoals} />
          </Section>
        )}

        {tab.tab === "backups" && (
          <Section title="Sicherungen" icon={<HardDriveDownload className="w-5 h-5" />}>
            <BackupsView
              data={{ exercises, plans, logs, goals }}
              onRestore={restoreBackup}
              onCreate={createBackup}
              backups={JSON.parse(localStorage.getItem(STORAGE_KEYS.BACKUPS) || "[]")}
              onDelete={deleteBackup}
              onDownload={downloadBackup}
              lastBackupAt={lastBackupAt}
            />
          </Section>
        )}

        <Toast />
      </div>

      {/* untere Tabbar für mobile Ansicht */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md flex justify-around py-2 sm:hidden">
        <button
          onClick={() => setTab({ tab: "dashboard" })}
          className={tab.tab === "dashboard" ? "text-rose-600" : "text-slate-500"}
        >
          <Play className="w-5 h-5 mx-auto" />
          <div className="text-xs">Dashboard</div>
        </button>
        <button
          onClick={() => setTab({ tab: "training" })}
          className={tab.tab === "training" ? "text-rose-600" : "text-slate-500"}
        >
          <Dumbbell className="w-5 h-5 mx-auto" />
          <div className="text-xs">Training</div>
        </button>
        <button
          onClick={() => setTab({ tab: "exercises" })}
          className={tab.tab === "exercises" ? "text-rose-600" : "text-slate-500"}
        >
          <ClipboardList className="w-5 h-5 mx-auto" />
          <div className="text-xs">Übungen</div>
        </button>
        <button
          onClick={() => setTab({ tab: "plans" })}
          className={tab.tab === "plans" ? "text-rose-600" : "text-slate-500"}
        >
          <Activity className="w-5 h-5 mx-auto" />
          <div className="text-xs">Pläne</div>
        </button>
        <button
          onClick={() => setTab({ tab: "goals" })}
          className={tab.tab === "goals" ? "text-rose-600" : "text-slate-500"}
        >
          <Target className="w-5 h-5 mx-auto" />
          <div className="text-xs">Ziele</div>
        </button>
        <button
          onClick={() => setTab({ tab: "backups" })}
          className={tab.tab === "backups" ? "text-rose-600" : "text-slate-500"}
        >
          <HardDriveDownload className="w-5 h-5 mx-auto" />
          <div className="text-xs">Backups</div>
        </button>
      </nav>
    </div>
  );
}


