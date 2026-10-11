import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, LineChart, Line, Legend, ResponsiveContainer } from 'recharts';
import { Dumbbell, Utensils, LayoutDashboard } from 'lucide-react';

const API_BASE = '/api';

const WORKOUT_SPLIT = {
  1: { name: "Push Day", exercises: [{ main: "Incline Dumbbell Press", alt: "Low-Incline Smith Machine Press", sets: "4x10-12" }, { main: "Cable Lateral Raises", alt: "Dumbbell Lateral Raises", sets: "4x15-20" }, { main: "Overhead Cable Tricep Extensions", alt: "Skullcrushers", sets: "3x12-15" }] },
  2: { name: "Pull Day", exercises: [{ main: "Wide-Grip Pull-Ups", alt: "Wide-Grip Lat Pulldowns", sets: "4x Failure" }, { main: "Seated Cable Rows", alt: "Chest-Supported T-Bar Row", sets: "4x12-15" }, { main: "Incline Dumbbell Curls", alt: "Cable Preacher Curls", sets: "3x12-15" }] },
  3: { name: "Legs & Core", exercises: [{ main: "Bulgarian Split Squats", alt: "Dumbbell Walking Lunges", sets: "4x10-12" }, { main: "Hanging Leg Raises", alt: "Lying Leg Raises", sets: "4x15-20" }, { main: "Stomach Vacuums", alt: "Plank Holds", sets: "3x 60 sec" }] },
  4: { name: "Push Day", exercises: [{ main: "Incline Dumbbell Press", alt: "Low-Incline Smith Machine Press", sets: "4x10-12" }, { main: "Cable Lateral Raises", alt: "Dumbbell Lateral Raises", sets: "4x15-20" }, { main: "Overhead Cable Tricep Extensions", alt: "Skullcrushers", sets: "3x12-15" }] },
  5: { name: "Pull Day", exercises: [{ main: "Wide-Grip Pull-Ups", alt: "Wide-Grip Lat Pulldowns", sets: "4x Failure" }, { main: "Seated Cable Rows", alt: "Chest-Supported T-Bar Row", sets: "4x12-15" }, { main: "Incline Dumbbell Curls", alt: "Cable Preacher Curls", sets: "3x12-15" }] },
  6: { name: "Legs & Core", exercises: [{ main: "Bulgarian Split Squats", alt: "Dumbbell Walking Lunges", sets: "4x10-12" }, { main: "Hanging Leg Raises", alt: "Lying Leg Raises", sets: "4x15-20" }, { main: "Stomach Vacuums", alt: "Plank Holds", sets: "3x 60 sec" }] },
  0: { name: "Rest Day", exercises: [] }
};

const TABS = [
  { id: 'nutrition', label: 'Nutrition', icon: Utensils },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

function WorkoutRow({ exercise, onLogged }) {
  const [useAlt, setUseAlt] = useState(false);
  const [weight, setWeight] = useState('');
  const [completed, setCompleted] = useState(false);

  const handleLog = async (isCompleted) => {
    await axios.post(`${API_BASE}/workout`, {
      exercise: useAlt ? exercise.alt : exercise.main,
      weight_kg: parseFloat(weight) || 0,
      completed: isCompleted
    });
    onLogged?.();
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-gray-700">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h3 className="font-bold text-base sm:text-lg leading-snug">{useAlt ? exercise.alt : exercise.main}</h3>
          <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-400">{exercise.sets}</span>
        </div>
        <label className="text-sm text-gray-400 flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={useAlt} onChange={() => setUseAlt(!useAlt)} className="mt-0.5 h-5 w-5 accent-blue-500" />
          <span>Use Alternative ({useAlt ? exercise.main : exercise.alt})</span>
        </label>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="number"
          inputMode="decimal"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-24 min-h-11 bg-gray-900 border border-gray-700 rounded p-2 text-center text-white focus:outline-none focus:border-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => {
              const next = e.target.checked;
              setCompleted(next);
              handleLog(next);
            }}
            className="h-6 w-6 accent-green-500 cursor-pointer"
          />
          Done
        </label>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('nutrition');
  const [mealInput, setMealInput] = useState('');
  const [nutritionData, setNutritionData] = useState({ logs: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 }, targets: { calories: 2435, protein: 100 } });
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyWorkouts, setMonthlyWorkouts] = useState([]);
  const [loadingMeal, setLoadingMeal] = useState(false);

  const dayOfWeek = new Date().getDay();
  const todaysWorkout = WORKOUT_SPLIT[dayOfWeek];

  const fetchNutrition = async () => {
    try {
      const res = await axios.get(`${API_BASE}/nutrition/today`);
      setNutritionData(res.data);
      const weeklyRes = await axios.get(`${API_BASE}/nutrition/weekly`);
      setWeeklyData(weeklyRes.data);
    } catch (e) {
      console.error('fetchNutrition failed:', e.response?.data || e.message);
    }
  };

  const fetchWorkouts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/workout/monthly`);
      setMonthlyWorkouts(res.data);
    } catch (e) {
      console.error('fetchWorkouts failed:', e.response?.data || e.message);
    }
  };

  useEffect(() => {
    fetchNutrition();
    fetchWorkouts();
  }, []);

  const handleMealSubmit = async () => {
    if (!mealInput) return;
    setLoadingMeal(true);
    try {
      await axios.post(`${API_BASE}/nutrition`, { text: mealInput });
      setMealInput('');
      await fetchNutrition();
    } catch (error) {
      const detail = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Failed to parse meal.\n\n${detail}`);
    } finally {
      setLoadingMeal(false);
    }
  };

  const macroColors = ['#3b82f6', '#10b981', '#f59e0b'];
  const macroData = [
    { name: 'Protein', value: nutritionData.totals.protein },
    { name: 'Carbs', value: nutritionData.totals.carbs },
    { name: 'Fats', value: nutritionData.totals.fats },
  ];

  const chartDataWorkouts = monthlyWorkouts.reduce((acc, curr) => {
    const date = curr.date;
    if (!acc[date]) acc[date] = { date };
    acc[date][curr.exercise] = curr.weight_kg;
    return acc;
  }, {});

  const shortDate = (value) => (value ? String(value).slice(5) : '');

  const chartWorkoutExercises = Object.keys(chartDataWorkouts).length
    ? Object.keys(Object.values(chartDataWorkouts)[0]).filter((k) => k !== 'date')
    : [];
  const lineColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4'];

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 pt-5 pb-28 md:p-6 font-sans">
      <header className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:justify-between md:items-end border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">V-Taper Cut</h1>
          <p className="text-gray-400 text-sm mt-1">Aesthetic Phase Optimization</p>
        </div>
        <div className="hidden md:flex gap-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-11 ${activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            >
              <Icon size={18}/> {label}
            </button>
          ))}
        </div>
      </header>

      <main>
        {activeTab === 'nutrition' && (
          <div className="space-y-5">
            <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl">
              <h2 className="text-lg sm:text-xl font-bold mb-4">Log Meal (AI Parsed)</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={mealInput}
                  onChange={(e) => setMealInput(e.target.value)}
                  placeholder='e.g., "1 cup of thick yellow dal, 3 scrambled eggs, and 50g of soya chunks"'
                  className="flex-1 min-h-12 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-base focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleMealSubmit}
                  disabled={loadingMeal}
                  className="bg-blue-600 hover:bg-blue-700 min-h-12 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {loadingMeal ? 'Analyzing...' : 'Log'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl">
                <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Calories Today</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black">{Math.round(nutritionData.totals.calories)}</span>
                  <span className="text-gray-500">/ {nutritionData.targets.calories} kcal</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mt-4">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min((nutritionData.totals.calories / nutritionData.targets.calories) * 100, 100)}%` }}></div>
                  </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl">
                <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Protein Today</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black">{Math.round(nutritionData.totals.protein)}g</span>
                  <span className="text-gray-500">/ {nutritionData.targets.protein}g</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mt-4">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min((nutritionData.totals.protein / nutritionData.targets.protein) * 100, 100)}%` }}></div>
                  </div>
              </div>
            </div>

            {nutritionData.logs.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Logged today</h3>
                {nutritionData.logs.map((log) => (
                  <div key={log.id} className="flex justify-between gap-3 text-sm border-b border-gray-800 last:border-0 pb-2 last:pb-0">
                    <span className="text-gray-200">{log.food_item}</span>
                    <span className="text-gray-400 whitespace-nowrap">{Math.round(log.calories)} kcal · {Math.round(log.protein)}g P</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'training' && (
          <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl">
            <div className="mb-6 border-b border-gray-800 pb-4">
              <h2 className="text-xl sm:text-2xl font-black text-white">{todaysWorkout.name}</h2>
              <p className="text-gray-400 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p>
            </div>
            {todaysWorkout.exercises.length === 0 ? (
              <div className="text-center py-12 text-gray-500 font-medium">Rest Day. Recover well.</div>
            ) : (
              todaysWorkout.exercises.map((ex, i) => <WorkoutRow key={i} exercise={ex} onLogged={fetchWorkouts} />)
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl h-[300px] sm:h-[350px]">
              <h3 className="text-lg font-bold mb-4">Today's Macros</h3>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={macroData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {macroData.map((entry, index) => <Cell key={`cell-${index}`} fill={macroColors[index % macroColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}/>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl h-[300px] sm:h-[350px]">
              <h3 className="text-lg font-bold mb-4">Weekly Calories</h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickFormatter={shortDate} />
                  <YAxis stroke="#9ca3af" fontSize={11} domain={[0, 3000]} width={36} />
                  <Tooltip cursor={{fill: '#374151'}} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}/>
                  <ReferenceLine y={nutritionData.targets.calories} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Target', fill: '#ef4444', fontSize: 12 }} />
                  <Bar dataKey="calories" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl md:col-span-2 h-[320px] sm:h-[400px]">
              <h3 className="text-lg font-bold mb-4">Progressive Overload (Last 4 Weeks)</h3>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={Object.values(chartDataWorkouts)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickFormatter={shortDate} />
                  <YAxis stroke="#9ca3af" fontSize={11} width={36} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  {chartWorkoutExercises.map((ex, i) => (
                    <Line key={ex} type="monotone" connectNulls dataKey={ex} stroke={lineColors[i % lineColors.length]} strokeWidth={3} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-800 bg-gray-950/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-3 max-w-5xl mx-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center gap-1 py-3 min-h-14 text-xs font-semibold ${activeTab === id ? 'text-blue-400' : 'text-gray-500'}`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
