import { useState, useEffect, useMemo } from 'react';

// ==========================================
// 1. BUILT-IN PRE-SEEDED FOOD DATABASE
// ==========================================
const PRE_SEEDED_FOOD_DB = [
  { id: 'egg-whole', name: 'Egg (Whole)', calories: 70, protein: 6.0, carbs: 0.6, fat: 5.0, fiber: 0.0, defaultUnit: 'piece', defaultQty: 1 },
  { id: 'egg-white', name: 'Egg White', calories: 17, protein: 3.6, carbs: 0.2, fat: 0.1, fiber: 0.0, defaultUnit: 'piece', defaultQty: 1 },
  { id: 'soya-chunks', name: 'Soya Chunks', calories: 345, protein: 52.0, carbs: 33.0, fat: 0.5, fiber: 13.0, defaultUnit: 'g', defaultQty: 100 },
  { id: 'oats', name: 'Oats', calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, defaultUnit: 'g', defaultQty: 100 },
  { id: 'basmati-rice-raw', name: 'Basmati Rice (Raw)', calories: 350, protein: 8.0, carbs: 78.0, fat: 0.5, fiber: 1.0, defaultUnit: 'g', defaultQty: 100 },
  { id: 'basmati-rice-cooked', name: 'Basmati Rice (Cooked)', calories: 130, protein: 2.7, carbs: 28.0, fat: 0.3, fiber: 0.4, defaultUnit: 'g', defaultQty: 100 },
  { id: 'chapati', name: 'Chapati', calories: 104, protein: 3.0, carbs: 22.0, fat: 0.4, fiber: 3.2, defaultUnit: 'piece', defaultQty: 1 },
  { id: 'banana', name: 'Banana', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, defaultUnit: 'piece', defaultQty: 1 },
  { id: 'curd-whole', name: 'Curd (Whole Milk)', calories: 98, protein: 3.0, carbs: 3.4, fat: 4.3, fiber: 0.0, defaultUnit: 'g', defaultQty: 100 },
  { id: 'greek-yogurt', name: 'Greek Yogurt (Plain)', calories: 59, protein: 10.0, carbs: 3.6, fat: 0.4, fiber: 0.0, defaultUnit: 'g', defaultQty: 100 },
  { id: 'whey-protein', name: 'Whey Protein', calories: 120, protein: 24.0, carbs: 3.0, fat: 1.5, fiber: 0.0, defaultUnit: 'scoop', defaultQty: 1 },
  { id: 'paneer', name: 'Paneer', calories: 265, protein: 18.0, carbs: 1.2, fat: 20.8, fiber: 0.0, defaultUnit: 'g', defaultQty: 100 },
  { id: 'dal-cooked', name: 'Dal (Cooked)', calories: 116, protein: 9.0, carbs: 20.0, fat: 0.4, fiber: 8.0, defaultUnit: 'g', defaultQty: 100 },
  { id: 'mixed-vegetables', name: 'Mixed Vegetables', calories: 65, protein: 2.0, carbs: 11.0, fat: 0.2, fiber: 3.5, defaultUnit: 'g', defaultQty: 100 },
  { id: 'chicken-breast', name: 'Chicken Breast (Raw)', calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6, fiber: 0.0, defaultUnit: 'g', defaultQty: 100 },
  { id: 'fish-generic', name: 'Fish (Generic Raw)', calories: 105, protein: 20.0, carbs: 0.0, fat: 2.5, fiber: 0.0, defaultUnit: 'g', defaultQty: 100 },
];

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'preWorkout', label: 'Pre-Workout' },
  { key: 'postWorkout', label: 'Post-Workout' },
  { key: 'dinner', label: 'Dinner' }
];

// Helper to format date in YYYY-MM-DD
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format date for headers
function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).toUpperCase();
}

function App() {
  // ==========================================
  // STATE DEFINITIONS
  // ==========================================
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateString());
  
  // Targets: defaults to 2350 kcal and 150g protein
  const [targets, setTargets] = useState(() => {
    const saved = localStorage.getItem('nutrition_tracker_targets');
    return saved ? JSON.parse(saved) : { calories: 2350, protein: 150 };
  });

  // Food Database state (seeds merged with any user edits / custom foods)
  const [foodDb, setFoodDb] = useState(() => {
    const saved = localStorage.getItem('nutrition_tracker_food_db');
    return saved ? JSON.parse(saved) : PRE_SEEDED_FOOD_DB;
  });

  // Logs state: { [date]: { breakfast: [], lunch: [], ... } }
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('nutrition_tracker_logs');
    return saved ? JSON.parse(saved) : {};
  });

  // Modals state
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null); // breakfast, lunch, etc.
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDbManagerModalOpen, setIsDbManagerModalOpen] = useState(false);

  // Add Food form states
  const [addFoodTab, setAddFoodTab] = useState('database'); // 'database' | 'quick-add'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  
  // Quick Add form states
  const [quickName, setQuickName] = useState('');
  const [quickQty, setQuickQty] = useState('');
  const [quickUnit, setQuickUnit] = useState('g');
  const [quickCals, setQuickCals] = useState('');
  const [quickProtein, setQuickProtein] = useState('');
  const [quickCarbs, setQuickCarbs] = useState('');
  const [quickFat, setQuickFat] = useState('');
  const [quickFiber, setQuickFiber] = useState('');

  // Editing Entry state
  const [editingEntry, setEditingEntry] = useState(null); // { date, slot, entryId, ... }

  // Database item editor state (within Db Manager)
  const [editingDbItem, setEditingDbItem] = useState(null);
  const [newDbItem, setNewDbItem] = useState({
    name: '',
    defaultUnit: 'g',
    defaultQty: 100,
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: ''
  });

  // ==========================================
  // EFFECTS (LOCALSTORAGE SYNC)
  // ==========================================
  useEffect(() => {
    localStorage.setItem('nutrition_tracker_targets', JSON.stringify(targets));
  }, [targets]);

  useEffect(() => {
    localStorage.setItem('nutrition_tracker_food_db', JSON.stringify(foodDb));
  }, [foodDb]);

  useEffect(() => {
    localStorage.setItem('nutrition_tracker_logs', JSON.stringify(logs));
  }, [logs]);

  // ==========================================
  // COMPUTED PROPERTIES
  // ==========================================
  const currentDayLog = useMemo(() => {
    return logs[selectedDate] || {
      breakfast: [],
      lunch: [],
      preWorkout: [],
      postWorkout: [],
      dinner: []
    };
  }, [logs, selectedDate]);

  // Helper to calculate totals for a set of entries
  const calculateEntriesSubtotal = (entries) => {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    if (!entries) return totals;
    entries.forEach(item => {
      const q = parseFloat(item.quantity) || 0;
      const refQty = parseFloat(item.defaultQty) || 1;
      const factor = q / refQty;
      totals.calories += (parseFloat(item.calories) || 0) * factor;
      totals.protein += (parseFloat(item.protein) || 0) * factor;
      totals.carbs += (parseFloat(item.carbs) || 0) * factor;
      totals.fat += (parseFloat(item.fat) || 0) * factor;
      totals.fiber += (parseFloat(item.fiber) || 0) * factor;
    });
    return totals;
  };

  // Calculate subtotals for each slot for the current day
  const subtotalsBySlot = useMemo(() => {
    const res = {};
    MEAL_SLOTS.forEach(slot => {
      res[slot.key] = calculateEntriesSubtotal(currentDayLog[slot.key]);
    });
    return res;
  }, [currentDayLog]);

  // Full day totals
  const dailyTotals = useMemo(() => {
    const res = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    Object.values(subtotalsBySlot).forEach(sub => {
      res.calories += sub.calories;
      res.protein += sub.protein;
      res.carbs += sub.carbs;
      res.fat += sub.fat;
      res.fiber += sub.fiber;
    });
    return res;
  }, [subtotalsBySlot]);

  const caloriesRemaining = Math.max(0, targets.calories - dailyTotals.calories);
  const proteinRemaining = Math.max(0, targets.protein - dailyTotals.protein);

  const caloriesPercent = targets.calories > 0 ? (dailyTotals.calories / targets.calories) * 100 : 0;
  const proteinPercent = targets.protein > 0 ? (dailyTotals.protein / targets.protein) * 100 : 0;

  // Selected food from DB (for modal preview)
  const selectedFoodItem = useMemo(() => {
    return foodDb.find(f => f.id === selectedFoodId) || null;
  }, [foodDb, selectedFoodId]);

  // Filtered DB items based on search query
  const filteredFoodDb = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return foodDb;
    return foodDb.filter(f => f.name.toLowerCase().includes(q));
  }, [foodDb, searchQuery]);

  // ==========================================
  // HANDLERS & ACTIONS
  // ==========================================
  const handlePrevDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const prev = new Date(year, month - 1, day - 1);
    const yString = prev.getFullYear();
    const mString = String(prev.getMonth() + 1).padStart(2, '0');
    const dString = String(prev.getDate()).padStart(2, '0');
    setSelectedDate(`${yString}-${mString}-${dString}`);
  };

  const handleNextDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const next = new Date(year, month - 1, day + 1);
    const yString = next.getFullYear();
    const mString = String(next.getMonth() + 1).padStart(2, '0');
    const dString = String(next.getDate()).padStart(2, '0');
    setSelectedDate(`${yString}-${mString}-${dString}`);
  };

  const handleJumpToToday = () => {
    setSelectedDate(getTodayDateString());
  };

  const openAddFoodModal = (slotKey) => {
    setActiveSlot(slotKey);
    setSelectedFoodId(foodDb[0]?.id || '');
    setQuantityInput(foodDb[0]?.defaultQty.toString() || '100');
    setSearchQuery('');
    setAddFoodTab('database');
    // reset quick add
    setQuickName('');
    setQuickQty('100');
    setQuickUnit('g');
    setQuickCals('150');
    setQuickProtein('10');
    setQuickCarbs('20');
    setQuickFat('2');
    setQuickFiber('1');
    setIsAddFoodModalOpen(true);
  };

  const closeAddFoodModal = () => {
    setIsAddFoodModalOpen(false);
    setActiveSlot(null);
  };

  const handleAddFoodEntry = (e) => {
    e.preventDefault();
    if (!activeSlot) return;

    let newEntry = null;

    if (addFoodTab === 'database') {
      if (!selectedFoodItem) return;
      const qty = parseFloat(quantityInput) || 0;
      if (qty <= 0) return;

      newEntry = {
        id: 'entry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: selectedFoodItem.name,
        quantity: qty,
        defaultUnit: selectedFoodItem.defaultUnit,
        defaultQty: selectedFoodItem.defaultQty,
        calories: selectedFoodItem.calories,
        protein: selectedFoodItem.protein,
        carbs: selectedFoodItem.carbs,
        fat: selectedFoodItem.fat,
        fiber: selectedFoodItem.fiber
      };
    } else {
      // Quick add
      const name = quickName.trim() || 'Quick Entry';
      const qty = parseFloat(quickQty) || 1;
      const cals = parseFloat(quickCals) || 0;
      const prot = parseFloat(quickProtein) || 0;
      const carb = parseFloat(quickCarbs) || 0;
      const fat = parseFloat(quickFat) || 0;
      const fib = parseFloat(quickFiber) || 0;

      newEntry = {
        id: 'entry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: name,
        quantity: qty,
        defaultUnit: quickUnit,
        defaultQty: qty, // reference matches input qty, so scale factor is 1
        calories: cals,
        protein: prot,
        carbs: carb,
        fat: fat,
        fiber: fib
      };
    }

    if (newEntry) {
      setLogs(prev => {
        const dayLogs = prev[selectedDate] ? { ...prev[selectedDate] } : {
          breakfast: [],
          lunch: [],
          preWorkout: [],
          postWorkout: [],
          dinner: []
        };
        dayLogs[activeSlot] = [...(dayLogs[activeSlot] || []), newEntry];
        return { ...prev, [selectedDate]: dayLogs };
      });
    }

    closeAddFoodModal();
  };

  const handleDeleteEntry = (slotKey, entryId) => {
    setLogs(prev => {
      const dayLogs = prev[selectedDate] ? { ...prev[selectedDate] } : null;
      if (!dayLogs) return prev;
      dayLogs[slotKey] = (dayLogs[slotKey] || []).filter(e => e.id !== entryId);
      return { ...prev, [selectedDate]: dayLogs };
    });
  };

  const handleClearSlot = (slotKey) => {
    if (window.confirm(`CLEAR ALL ENTRIES FOR ${slotKey.toUpperCase()}?`)) {
      setLogs(prev => {
        const dayLogs = prev[selectedDate] ? { ...prev[selectedDate] } : null;
        if (!dayLogs) return prev;
        dayLogs[slotKey] = [];
        return { ...prev, [selectedDate]: dayLogs };
      });
    }
  };

  const handleClearDay = () => {
    if (window.confirm(`CLEAR ALL ENTRIES FOR THE ENTIRE DAY (${selectedDate})?`)) {
      setLogs(prev => {
        const updated = { ...prev };
        delete updated[selectedDate];
        return updated;
      });
    }
  };

  // Editing Logged Entry
  const openEditEntryModal = (slotKey, entry) => {
    setEditingEntry({
      slot: slotKey,
      ...entry,
      editQty: entry.quantity.toString()
    });
  };

  const handleSaveEditEntry = (e) => {
    e.preventDefault();
    if (!editingEntry) return;
    const newQty = parseFloat(editingEntry.editQty) || 0;
    if (newQty <= 0) return;

    setLogs(prev => {
      const dayLogs = prev[selectedDate] ? { ...prev[selectedDate] } : null;
      if (!dayLogs) return prev;
      dayLogs[editingEntry.slot] = (dayLogs[editingEntry.slot] || []).map(e => {
        if (e.id === editingEntry.id) {
          return { ...e, quantity: newQty };
        }
        return e;
      });
      return { ...prev, [selectedDate]: dayLogs };
    });
    setEditingEntry(null);
  };

  // Targets Editor
  const handleSaveTargets = (e) => {
    e.preventDefault();
    const cals = parseInt(e.target.calories.value) || 2350;
    const prot = parseInt(e.target.protein.value) || 150;
    setTargets({ calories: cals, protein: prot });
    setIsSettingsModalOpen(false);
  };

  // Database Manager Actions
  const handleCreateDbItem = (e) => {
    e.preventDefault();
    const name = newDbItem.name.trim();
    if (!name) return;

    const item = {
      id: 'db-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name: name,
      defaultUnit: newDbItem.defaultUnit,
      defaultQty: parseFloat(newDbItem.defaultQty) || 100,
      calories: parseFloat(newDbItem.calories) || 0,
      protein: parseFloat(newDbItem.protein) || 0,
      carbs: parseFloat(newDbItem.carbs) || 0,
      fat: parseFloat(newDbItem.fat) || 0,
      fiber: parseFloat(newDbItem.fiber) || 0
    };

    setFoodDb(prev => [...prev, item]);
    setNewDbItem({
      name: '',
      defaultUnit: 'g',
      defaultQty: 100,
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      fiber: ''
    });
  };

  const handleSaveDbItemEdit = (e) => {
    e.preventDefault();
    if (!editingDbItem) return;

    setFoodDb(prev => prev.map(item => {
      if (item.id === editingDbItem.id) {
        return {
          ...item,
          name: editingDbItem.name.trim(),
          defaultUnit: editingDbItem.defaultUnit,
          defaultQty: parseFloat(editingDbItem.defaultQty) || 100,
          calories: parseFloat(editingDbItem.calories) || 0,
          protein: parseFloat(editingDbItem.protein) || 0,
          carbs: parseFloat(editingDbItem.carbs) || 0,
          fat: parseFloat(editingDbItem.fat) || 0,
          fiber: parseFloat(editingDbItem.fiber) || 0
        };
      }
      return item;
    }));
    setEditingDbItem(null);
  };

  const handleDeleteDbItem = (id) => {
    if (window.confirm('REMOVE THIS FOOD ITEM FROM THE DATABASE?')) {
      setFoodDb(prev => prev.filter(item => item.id !== id));
      if (selectedFoodId === id) {
        setSelectedFoodId('');
      }
    }
  };

  const handleResetDbToDefaults = () => {
    if (window.confirm('RESET THE FOOD DATABASE TO DEFAULT PRE-SEEDED ITEMS? THIS WILL REMOVE CUSTOM FOOD ENTRIES AND CHANGES.')) {
      setFoodDb(PRE_SEEDED_FOOD_DB);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 min-h-screen flex flex-col justify-between selection:bg-black selection:text-white">
      {/* ==========================================
          HEADER SECTION
         ========================================== */}
      <header className="border-b-2 border-black pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter leading-none select-none">
            NUTRITION TRACKER
          </h1>
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-medium mt-1">
            STRICT GRAYSCALE METRIC LOG
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsDbManagerModalOpen(true)}
            className="px-3 py-1.5 border border-black hover:bg-black hover:text-white text-xs font-bold uppercase transition"
          >
            Manage Food DB
          </button>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="px-3 py-1.5 border border-black hover:bg-black hover:text-white text-xs font-bold uppercase transition"
          >
            Edit Targets
          </button>
          <button
            onClick={handleClearDay}
            className="px-3 py-1.5 border border-zinc-300 hover:border-black text-zinc-500 hover:text-black text-xs font-bold uppercase transition"
          >
            Clear Day
          </button>
        </div>
      </header>

      {/* ==========================================
          DATE NAVIGATION BAR
         ========================================== */}
      <div className="border border-black p-2 mb-6 flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevDay}
            className="p-2 border border-black hover:bg-black hover:text-white transition text-sm font-bold w-10 h-10 flex items-center justify-center"
            title="Previous Day"
          >
            ←
          </button>
          <button
            onClick={handleJumpToToday}
            className="px-3 py-2 border border-black hover:bg-black hover:text-white transition text-xs font-bold uppercase h-10 flex items-center"
          >
            Today
          </button>
          <button
            onClick={handleNextDay}
            className="p-2 border border-black hover:bg-black hover:text-white transition text-sm font-bold w-10 h-10 flex items-center justify-center"
            title="Next Day"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-sm font-bold uppercase tracking-wider mono-font">
            {formatDateLabel(selectedDate)}
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-black px-2 py-1.5 text-xs font-semibold mono-font focus:outline-none focus:bg-black focus:text-white transition h-10 cursor-pointer"
          />
        </div>
      </div>

      {/* ==========================================
          DASHBOARD SUMMARY (STICKY COMPONENT)
         ========================================== */}
      <section className="border-double border-4 border-black p-6 mb-8 bg-white md:sticky md:top-4 z-20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-xs font-black tracking-widest uppercase mb-4 text-zinc-400">
          DAILY METRIC DASHBOARD
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Calories remaining summary */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider">CALORIES</span>
              <span className="text-2xl font-black mono-font tracking-tight">
                {Math.round(caloriesRemaining)} <span className="text-xs font-normal">KCAL REMAINING</span>
              </span>
            </div>
            
            {/* Minimal linear progress bar */}
            <div className="border border-black h-4 p-[1px] bg-white mb-2 relative">
              <div
                className="bg-black h-full transition-all duration-500"
                style={{ width: `${Math.min(caloriesPercent, 100)}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs mono-font text-zinc-500">
              <span>CONSUMED: {Math.round(dailyTotals.calories)} KCAL</span>
              <span>TARGET: {targets.calories} KCAL ({Math.round(caloriesPercent)}%)</span>
            </div>
            {caloriesPercent > 100 && (
              <p className="text-[10px] font-black uppercase text-black tracking-wider mt-1 text-right">
                ⚠️ TARGET EXCEEDED BY +{Math.round(dailyTotals.calories - targets.calories)} KCAL
              </p>
            )}
          </div>

          {/* Protein remaining summary */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider">PROTEIN</span>
              <span className="text-2xl font-black mono-font tracking-tight">
                {Math.round(proteinRemaining)} <span className="text-xs font-normal">G REMAINING</span>
              </span>
            </div>

            {/* Minimal linear progress bar */}
            <div className="border border-black h-4 p-[1px] bg-white mb-2 relative">
              <div
                className="bg-black h-full transition-all duration-500"
                style={{ width: `${Math.min(proteinPercent, 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-xs mono-font text-zinc-500">
              <span>CONSUMED: {Math.round(dailyTotals.protein)} G</span>
              <span>TARGET: {targets.protein} G ({Math.round(proteinPercent)}%)</span>
            </div>
            {proteinPercent > 100 && (
              <p className="text-[10px] font-black uppercase text-black tracking-wider mt-1 text-right">
                ⚠️ TARGET EXCEEDED BY +{Math.round(dailyTotals.protein - targets.protein)} G
              </p>
            )}
          </div>
        </div>

        {/* Secondary macros rollup */}
        <div className="border-t border-zinc-200 pt-4 grid grid-cols-3 gap-2 text-center">
          <div className="border-r border-zinc-200">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">CARBS</span>
            <span className="text-base font-bold mono-font">{dailyTotals.carbs.toFixed(1)}g</span>
          </div>
          <div className="border-r border-zinc-200">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">FAT</span>
            <span className="text-base font-bold mono-font">{dailyTotals.fat.toFixed(1)}g</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">FIBER</span>
            <span className="text-base font-bold mono-font">{dailyTotals.fiber.toFixed(1)}g</span>
          </div>
        </div>
      </section>

      {/* ==========================================
          MEAL CARDS LISTING
         ========================================== */}
      <main className="flex-grow space-y-6">
        {MEAL_SLOTS.map((slot) => {
          const slotEntries = currentDayLog[slot.key] || [];
          const sub = subtotalsBySlot[slot.key];

          return (
            <section
              key={slot.key}
              className="border border-black p-4 md:p-6 bg-white hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-black pb-3 mb-4 gap-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-lg font-black uppercase tracking-tight">{slot.label}</h3>
                  <span className="text-xs font-semibold mono-font text-zinc-500">
                    ({Math.round(sub.calories)} kcal • {sub.protein.toFixed(1)}g P)
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAddFoodModal(slot.key)}
                    className="px-2.5 py-1 border border-black bg-black text-white hover:bg-white hover:text-black text-xs font-black uppercase tracking-wider transition"
                  >
                    + Add Entry
                  </button>
                  {slotEntries.length > 0 && (
                    <button
                      onClick={() => handleClearSlot(slot.key)}
                      className="px-2.5 py-1 border border-zinc-200 hover:border-black text-zinc-400 hover:text-black text-xs font-bold uppercase tracking-wider transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Entries Table / List */}
              {slotEntries.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-zinc-300">
                  <span className="text-xs uppercase tracking-widest text-zinc-400 font-medium">
                    NO ENTRIES RECORDED FOR THIS SLOT
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Desktop Table View */}
                  <table className="w-full text-left hidden md:table">
                    <thead>
                      <tr className="border-b border-zinc-200 text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                        <th className="pb-2 w-1/3">Food Name</th>
                        <th className="pb-2 text-right">Quantity</th>
                        <th className="pb-2 text-right">Cals</th>
                        <th className="pb-2 text-right">Protein</th>
                        <th className="pb-2 text-right">Carbs</th>
                        <th className="pb-2 text-right">Fat</th>
                        <th className="pb-2 text-right">Fiber</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-sm mono-font">
                      {slotEntries.map((item) => {
                        const factor = item.quantity / item.defaultQty;
                        return (
                          <tr key={item.id} className="hover:bg-zinc-50 group">
                            <td className="py-2.5 font-sans font-bold text-black">{item.name}</td>
                            <td className="py-2.5 text-right">{item.quantity} {item.defaultUnit}</td>
                            <td className="py-2.5 text-right">{Math.round(item.calories * factor)}</td>
                            <td className="py-2.5 text-right">{(item.protein * factor).toFixed(1)}g</td>
                            <td className="py-2.5 text-right">{(item.carbs * factor).toFixed(1)}g</td>
                            <td className="py-2.5 text-right">{(item.fat * factor).toFixed(1)}g</td>
                            <td className="py-2.5 text-right">{(item.fiber * factor).toFixed(1)}g</td>
                            <td className="py-2.5 text-right space-x-1.5">
                              <button
                                onClick={() => openEditEntryModal(slot.key, item)}
                                className="text-[10px] uppercase font-bold tracking-wider hover:underline text-black"
                              >
                                Edit
                              </button>
                              <span className="text-zinc-300">/</span>
                              <button
                                onClick={() => handleDeleteEntry(slot.key, item.id)}
                                className="text-[10px] uppercase font-bold tracking-wider hover:underline text-zinc-500 hover:text-black"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Mobile Stacked View */}
                  <div className="md:hidden space-y-2">
                    {slotEntries.map((item) => {
                      const factor = item.quantity / item.defaultQty;
                      return (
                        <div
                          key={item.id}
                          className="border border-zinc-200 p-3 flex flex-col justify-between gap-2"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-sm block">{item.name}</span>
                              <span className="text-xs text-zinc-500 mono-font">
                                {item.quantity} {item.defaultUnit}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEditEntryModal(slot.key, item)}
                                className="px-2 py-1 border border-black text-[10px] uppercase font-extrabold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(slot.key, item.id)}
                                className="px-2 py-1 border border-zinc-300 text-[10px] uppercase font-bold text-zinc-500"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-5 text-center text-xs border-t border-dashed border-zinc-200 pt-2 mono-font">
                            <div>
                              <span className="block text-[8px] text-zinc-400">CAL</span>
                              <span className="font-semibold">{Math.round(item.calories * factor)}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-zinc-400">PRO</span>
                              <span className="font-semibold">{(item.protein * factor).toFixed(1)}g</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-zinc-400">CARB</span>
                              <span className="font-semibold">{(item.carbs * factor).toFixed(1)}g</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-zinc-400">FAT</span>
                              <span className="font-semibold">{(item.fat * factor).toFixed(1)}g</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-zinc-400">FIB</span>
                              <span className="font-semibold">{(item.fiber * factor).toFixed(1)}g</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Slot Macro Breakdown rolls up */}
              {slotEntries.length > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-zinc-200 flex flex-wrap justify-between text-xs mono-font text-zinc-500">
                  <span className="uppercase font-bold text-black">Meal Subtotal:</span>
                  <div className="space-x-3">
                    <span>{Math.round(sub.calories)} kcal</span>
                    <span>P: {sub.protein.toFixed(1)}g</span>
                    <span>C: {sub.carbs.toFixed(1)}g</span>
                    <span>F: {sub.fat.toFixed(1)}g</span>
                    <span>Fi: {sub.fiber.toFixed(1)}g</span>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </main>

      {/* ==========================================
          FOOTER / COMPLIANCE NOTE
         ========================================== */}
      <footer className="border-t border-zinc-200 mt-12 pt-6 text-[10px] mono-font text-zinc-400 uppercase tracking-widest text-center">
        NO BACKEND • LOCALSTORAGE PERSISTED • BUILT WITH REACT + TAILWIND CSS
      </footer>

      {/* ==========================================
          MODAL: ADD ENTRY (DATABASE / QUICK ADD)
         ========================================== */}
      {isAddFoodModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border-2 border-black p-6 max-w-lg w-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] my-8">
            <div className="flex justify-between items-start border-b border-black pb-3 mb-4">
              <div>
                <h3 className="font-black text-lg uppercase">ADD ENTRY TO {activeSlot?.toUpperCase()}</h3>
                <p className="text-[10px] text-zinc-400 mono-font">DATE: {selectedDate}</p>
              </div>
              <button
                onClick={closeAddFoodModal}
                className="text-lg font-black hover:bg-black hover:text-white w-6 h-6 flex items-center justify-center border border-black"
              >
                ×
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-black mb-4">
              <button
                onClick={() => setAddFoodTab('database')}
                className={`flex-1 py-2 text-xs font-black uppercase border-r border-black tracking-wider transition ${
                  addFoodTab === 'database' ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
                }`}
              >
                Food Database
              </button>
              <button
                onClick={() => setAddFoodTab('quick-add')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider transition ${
                  addFoodTab === 'quick-add' ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
                }`}
              >
                Quick Add Custom
              </button>
            </div>

            <form onSubmit={handleAddFoodEntry} className="space-y-4">
              {addFoodTab === 'database' ? (
                // TAB 1: DATABASE SEARCH
                <>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1">
                      Search / Select Food
                    </label>
                    <input
                      type="text"
                      placeholder="Type to filter database..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full border border-black p-2 text-sm mono-font focus:bg-zinc-50 focus:outline-none mb-2"
                    />
                    
                    <select
                      value={selectedFoodId}
                      onChange={(e) => {
                        const fid = e.target.value;
                        setSelectedFoodId(fid);
                        const match = foodDb.find(f => f.id === fid);
                        if (match) {
                          setQuantityInput(match.defaultQty.toString());
                        }
                      }}
                      className="w-full border border-black p-2 text-sm mono-font focus:outline-none h-32"
                      size={5}
                      required
                    >
                      {filteredFoodDb.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.calories} kcal per {f.defaultQty}{f.defaultUnit})
                        </option>
                      ))}
                      {filteredFoodDb.length === 0 && (
                        <option disabled>No items matched search</option>
                      )}
                    </select>
                  </div>

                  {selectedFoodItem && (
                    <>
                      {/* Quantity input */}
                      <div className="grid grid-cols-2 gap-4 items-end">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-wider mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={quantityInput}
                            onChange={(e) => setQuantityInput(e.target.value)}
                            className="w-full border border-black p-2 text-sm mono-font focus:outline-none"
                            required
                          />
                        </div>
                        <div className="pb-2.5 text-sm font-bold uppercase">
                          {selectedFoodItem.defaultUnit}
                        </div>
                      </div>

                      {/* Scaled Macro Preview */}
                      <div className="border border-zinc-200 p-3 bg-zinc-50">
                        <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                          SCALED MACRO PREVIEW
                        </span>
                        {(() => {
                          const q = parseFloat(quantityInput) || 0;
                          const factor = q / selectedFoodItem.defaultQty;
                          return (
                            <div className="grid grid-cols-5 text-center text-xs mono-font">
                              <div>
                                <span className="block text-[8px] text-zinc-400 uppercase">CAL</span>
                                <span className="font-bold">{Math.round(selectedFoodItem.calories * factor)}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-zinc-400 uppercase">PRO</span>
                                <span className="font-bold">{(selectedFoodItem.protein * factor).toFixed(1)}g</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-zinc-400 uppercase">CARB</span>
                                <span className="font-bold">{(selectedFoodItem.carbs * factor).toFixed(1)}g</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-zinc-400 uppercase">FAT</span>
                                <span className="font-bold">{(selectedFoodItem.fat * factor).toFixed(1)}g</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-zinc-400 uppercase">FIB</span>
                                <span className="font-bold">{(selectedFoodItem.fiber * factor).toFixed(1)}g</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </>
              ) : (
                // TAB 2: QUICK ADD FORM
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1">
                      Food Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Protein Bar"
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                      className="w-full border border-black p-2 text-sm focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="e.g. 1"
                        value={quickQty}
                        onChange={(e) => setQuickQty(e.target.value)}
                        className="w-full border border-black p-2 text-sm mono-font focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1">
                        Unit
                      </label>
                      <select
                        value={quickUnit}
                        onChange={(e) => setQuickUnit(e.target.value)}
                        className="w-full border border-black p-2 text-sm mono-font focus:outline-none"
                      >
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="piece">piece</option>
                        <option value="scoop">scoop</option>
                        <option value="cup">cup</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[8px] font-black uppercase tracking-wider text-center mb-1">
                        Cals (kcal)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={quickCals}
                        onChange={(e) => setQuickCals(e.target.value)}
                        className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase tracking-wider text-center mb-1">
                        Protein (g)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quickProtein}
                        onChange={(e) => setQuickProtein(e.target.value)}
                        className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase tracking-wider text-center mb-1">
                        Carbs (g)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quickCarbs}
                        onChange={(e) => setQuickCarbs(e.target.value)}
                        className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase tracking-wider text-center mb-1">
                        Fat (g)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quickFat}
                        onChange={(e) => setQuickFat(e.target.value)}
                        className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase tracking-wider text-center mb-1">
                        Fiber (g)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quickFiber}
                        onChange={(e) => setQuickFiber(e.target.value)}
                        className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 border border-black bg-black text-white hover:bg-white hover:text-black font-black uppercase text-xs tracking-wider transition"
                >
                  Confirm Entry
                </button>
                <button
                  type="button"
                  onClick={closeAddFoodModal}
                  className="px-4 py-2 border border-black bg-white text-black hover:bg-black hover:text-white font-bold uppercase text-xs tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: EDIT ENTRY QUANTITY
         ========================================== */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border-2 border-black p-6 max-w-sm w-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-start border-b border-black pb-3 mb-4">
              <h3 className="font-black text-base uppercase">EDIT ENTRY QUANTITY</h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-lg font-black hover:bg-black hover:text-white w-6 h-6 flex items-center justify-center border border-black"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEditEntry} className="space-y-4">
              <div className="text-sm mb-2">
                Editing <span className="font-bold">{editingEntry.name}</span> in{' '}
                <span className="font-bold uppercase">{editingEntry.slot}</span>.
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    New Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={editingEntry.editQty}
                    onChange={(e) => setEditingEntry(prev => ({ ...prev, editQty: e.target.value }))}
                    className="w-full border border-black p-2 text-sm mono-font focus:outline-none"
                    required
                    autoFocus
                  />
                </div>
                <div className="pb-2.5 text-sm font-bold uppercase">
                  {editingEntry.defaultUnit}
                </div>
              </div>

              <div className="border border-zinc-200 p-3 bg-zinc-50 text-xs mono-font">
                <span className="block text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                  ESTIMATED MACROS
                </span>
                {(() => {
                  const q = parseFloat(editingEntry.editQty) || 0;
                  const factor = q / editingEntry.defaultQty;
                  return (
                    <div className="grid grid-cols-5 text-center">
                      <div>
                        <span className="block text-[8px] text-zinc-400">CAL</span>
                        <span className="font-bold">{Math.round(editingEntry.calories * factor)}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-zinc-400">PRO</span>
                        <span className="font-bold">{(editingEntry.protein * factor).toFixed(1)}g</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-zinc-400">CARB</span>
                        <span className="font-bold">{(editingEntry.carbs * factor).toFixed(1)}g</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-zinc-400">FAT</span>
                        <span className="font-bold">{(editingEntry.fat * factor).toFixed(1)}g</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-zinc-400">FIB</span>
                        <span className="font-bold">{(editingEntry.fiber * factor).toFixed(1)}g</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 border border-black bg-black text-white hover:bg-white hover:text-black font-black uppercase text-xs tracking-wider transition"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 border border-black bg-white text-black hover:bg-black hover:text-white font-bold uppercase text-xs tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: EDIT DAILY TARGETS
         ========================================== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border-2 border-black p-6 max-w-sm w-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-start border-b border-black pb-3 mb-4">
              <h3 className="font-black text-lg uppercase">EDIT DAILY TARGETS</h3>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-lg font-black hover:bg-black hover:text-white w-6 h-6 flex items-center justify-center border border-black"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveTargets} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Daily Calorie Target (kcal)
                </label>
                <input
                  type="number"
                  name="calories"
                  defaultValue={targets.calories}
                  min="500"
                  max="10000"
                  className="w-full border border-black p-2 text-sm mono-font focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Daily Protein Target (g)
                </label>
                <input
                  type="number"
                  name="protein"
                  defaultValue={targets.protein}
                  min="10"
                  max="500"
                  className="w-full border border-black p-2 text-sm mono-font focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 border border-black bg-black text-white hover:bg-white hover:text-black font-black uppercase text-xs tracking-wider transition"
                >
                  Save Targets
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 border border-black bg-white text-black hover:bg-black hover:text-white font-bold uppercase text-xs tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: FOOD DATABASE MANAGER (VIEW/EDIT/CREATE)
         ========================================== */}
      {isDbManagerModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border-2 border-black p-6 max-w-4xl w-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] my-8">
            <div className="flex justify-between items-start border-b border-black pb-3 mb-4">
              <div>
                <h3 className="font-black text-lg uppercase">FOOD DATABASE MANAGER</h3>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                  Create custom items or edit database nutrition values
                </p>
              </div>
              <button
                onClick={() => {
                  setIsDbManagerModalOpen(false);
                  setEditingDbItem(null);
                }}
                className="text-lg font-black hover:bg-black hover:text-white w-6 h-6 flex items-center justify-center border border-black"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Form to Create/Edit items */}
              <div className="lg:col-span-5 space-y-4 border-b lg:border-b-0 lg:border-r border-zinc-200 pb-6 lg:pb-0 lg:pr-6">
                <h4 className="font-bold text-xs uppercase tracking-wider border-b border-zinc-200 pb-1 text-zinc-500">
                  {editingDbItem ? 'EDIT FOOD ITEM' : 'ADD NEW FOOD TO DB'}
                </h4>

                {editingDbItem ? (
                  // EDIT FORM
                  <form onSubmit={handleSaveDbItemEdit} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                        Food Name
                      </label>
                      <input
                        type="text"
                        value={editingDbItem.name}
                        onChange={(e) => setEditingDbItem(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full border border-black p-2 text-xs focus:outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                          Ref Quantity
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={editingDbItem.defaultQty}
                          onChange={(e) => setEditingDbItem(prev => ({ ...prev, defaultQty: e.target.value }))}
                          className="w-full border border-black p-2 text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                          Ref Unit
                        </label>
                        <select
                          value={editingDbItem.defaultUnit}
                          onChange={(e) => setEditingDbItem(prev => ({ ...prev, defaultUnit: e.target.value }))}
                          className="w-full border border-black p-2 text-xs mono-font focus:outline-none"
                        >
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="piece">piece</option>
                          <option value="scoop">scoop</option>
                          <option value="cup">cup</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                          Cals (kcal)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editingDbItem.calories}
                          onChange={(e) => setEditingDbItem(prev => ({ ...prev, calories: e.target.value }))}
                          className="w-full border border-black p-2 text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                          Protein (g)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editingDbItem.protein}
                          onChange={(e) => setEditingDbItem(prev => ({ ...prev, protein: e.target.value }))}
                          className="w-full border border-black p-2 text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[8px] font-black uppercase tracking-wider mb-1 text-center">
                          Carbs (g)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editingDbItem.carbs}
                          onChange={(e) => setEditingDbItem(prev => ({ ...prev, carbs: e.target.value }))}
                          className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black uppercase tracking-wider mb-1 text-center">
                          Fat (g)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editingDbItem.fat}
                          onChange={(e) => setEditingDbItem(prev => ({ ...prev, fat: e.target.value }))}
                          className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black uppercase tracking-wider mb-1 text-center">
                          Fiber (g)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editingDbItem.fiber}
                          onChange={(e) => setEditingDbItem(prev => ({ ...prev, fiber: e.target.value }))}
                          className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 px-3 py-1.5 border border-black bg-black text-white hover:bg-white hover:text-black font-black uppercase text-xs tracking-wider transition"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDbItem(null)}
                        className="px-3 py-1.5 border border-black bg-white text-black hover:bg-black hover:text-white font-bold uppercase text-xs tracking-wider transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  // CREATE FORM
                  <form onSubmit={handleCreateDbItem} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                        Food Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Peanut Butter"
                        value={newDbItem.name}
                        onChange={(e) => setNewDbItem(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full border border-black p-2 text-xs focus:outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                          Ref Quantity
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="100"
                          value={newDbItem.defaultQty}
                          onChange={(e) => setNewDbItem(prev => ({ ...prev, defaultQty: e.target.value }))}
                          className="w-full border border-black p-2 text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                          Ref Unit
                        </label>
                        <select
                          value={newDbItem.defaultUnit}
                          onChange={(e) => setNewDbItem(prev => ({ ...prev, defaultUnit: e.target.value }))}
                          className="w-full border border-black p-2 text-xs mono-font focus:outline-none"
                        >
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="piece">piece</option>
                          <option value="scoop">scoop</option>
                          <option value="cup">cup</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                          Cals (kcal)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 588"
                          value={newDbItem.calories}
                          onChange={(e) => setNewDbItem(prev => ({ ...prev, calories: e.target.value }))}
                          className="w-full border border-black p-2 text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                          Protein (g)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="e.g. 25"
                          value={newDbItem.protein}
                          onChange={(e) => setNewDbItem(prev => ({ ...prev, protein: e.target.value }))}
                          className="w-full border border-black p-2 text-xs mono-font focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[8px] font-black uppercase tracking-wider mb-1 text-center">
                          Carbs (g)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="20"
                          value={newDbItem.carbs}
                          onChange={(e) => setNewDbItem(prev => ({ ...prev, carbs: e.target.value }))}
                          className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black uppercase tracking-wider mb-1 text-center">
                          Fat (g)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="50"
                          value={newDbItem.fat}
                          onChange={(e) => setNewDbItem(prev => ({ ...prev, fat: e.target.value }))}
                          className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black uppercase tracking-wider mb-1 text-center">
                          Fiber (g)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="6"
                          value={newDbItem.fiber}
                          onChange={(e) => setNewDbItem(prev => ({ ...prev, fiber: e.target.value }))}
                          className="w-full border border-black p-1 text-center text-xs mono-font focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2 px-3 py-2 border border-black bg-black text-white hover:bg-white hover:text-black font-black uppercase text-xs tracking-wider transition"
                    >
                      Create Database Food
                    </button>
                  </form>
                )}

                <div className="pt-4 border-t border-zinc-200">
                  <button
                    onClick={handleResetDbToDefaults}
                    className="w-full px-2 py-1.5 border border-zinc-300 hover:border-black text-zinc-500 hover:text-black text-[10px] font-bold uppercase tracking-wider transition"
                  >
                    Reset DB to Seed Defaults
                  </button>
                </div>
              </div>

              {/* Right Column: Database list */}
              <div className="lg:col-span-7 flex flex-col h-[400px]">
                <h4 className="font-bold text-xs uppercase tracking-wider border-b border-zinc-200 pb-1 mb-2 text-zinc-500">
                  DATABASED FOODS LIST ({foodDb.length})
                </h4>

                <div className="overflow-y-auto flex-grow border border-black divide-y divide-zinc-200 p-2">
                  {foodDb.map(f => (
                    <div key={f.id} className="py-2 flex justify-between items-start gap-4 text-xs">
                      <div>
                        <span className="font-bold text-black text-sm block">{f.name}</span>
                        <span className="mono-font text-zinc-500">
                          {f.calories} kcal / {f.defaultQty}{f.defaultUnit} • P: {f.protein}g • C: {f.carbs}g • F: {f.fat}g • Fi: {f.fiber}g
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setEditingDbItem(f)}
                          className="px-2 py-1 border border-black text-[10px] uppercase font-bold hover:bg-black hover:text-white transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDbItem(f.id)}
                          className="px-2 py-1 border border-zinc-300 hover:border-black text-[10px] uppercase text-zinc-500 hover:text-black transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
