import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { createPortal } from 'react-dom';
import { 
  BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate, useParams 
} from 'react-router-dom';
import { 
  Mail, Lock, Plus, Trash2, Edit2, LogOut, ChevronLeft, ChevronRight, ChevronDown, 
  Calendar, X, Loader2, Check, LayoutDashboard, ClipboardList, BarChart2, User as UserIcon,
  Search, Sparkles, Eye, EyeOff, Flame, Target, TrendingUp
} from 'lucide-react';
import { 
  motion, AnimatePresence, useReducedMotion, useMotionValue, useMotionValueEvent, 
  useScroll, useTransform, useSpring, animate, MotionConfig 
} from 'framer-motion';

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'pre_workout', label: 'Pre-Workout' },
  { key: 'post_workout', label: 'Post-Workout' },
  { key: 'dinner', label: 'Dinner' }
];

// Helper to get YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Extract csrfToken from cookies
function getCsrfToken() {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; csrfToken=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

// Base API URL configuration
// Uses VITE_API_URL if defined in environment, defaults to empty string for relative proxying in dev
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Get stored Auth Token
function getAuthToken() {
  return localStorage.getItem('nutritrack_token') || '';
}

// Store Auth Token
function setAuthToken(token) {
  if (token) {
    localStorage.setItem('nutritrack_token', token);
  } else {
    localStorage.removeItem('nutritrack_token');
  }
}

// Unified API fetch helper supporting environment API_BASE_URL, bearer token, and CSRF token
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const csrf = getCsrfToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...(options.headers || {})
  };

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers
  });
}

// Calculate password strength score (0 to 4)
function getPasswordStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[@$!%*?&#.]/.test(pwd)) score++;
  return score;
}

// Helper to get valid units for a food item
function getValidUnits(food) {
  if (!food) return ['g'];
  const units = ['g'];
  const name = (food.name || '').toLowerCase();

  if (food.servingUnit === 'piece' || food.pieceWeight) {
    units.unshift('piece');
  }

  if (food.servingUnit === 'ml' || name.includes('milk') || name.includes('juice') || name.includes('oil') || name.includes('buttermilk') || name.includes('tea') || name.includes('coffee') || name.includes('curd') || name.includes('yogurt')) {
    if (!units.includes('ml')) {
      units.unshift('ml');
    }
  }

  if (name.includes('rice') || name.includes('dal') || name.includes('curry') || name.includes('upma') || name.includes('poha') || name.includes('sambar') || name.includes('biryani') || name.includes('pasta') || name.includes('oats')) {
    units.push('cup');
    units.push('bowl');
  }

  return [...new Set(units)];
}

// Helper to convert selectable units to standard gram weight
function resolveGrams(quantity, unit, pieceWeight) {
  const qty = parseFloat(quantity) || 0;
  if (unit === 'g' || unit === 'ml') {
    return qty;
  }
  if (unit === 'piece') {
    return qty * (pieceWeight || 50);
  }
  if (unit === 'cup') {
    return qty * 200;
  }
  if (unit === 'bowl') {
    return qty * 150;
  }
  return qty;
}

// Web Audio API Haptic Sound Synthesizer (Zero external assets required)
function playHapticSound(type = 'click') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.015);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.015);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch {}
}

// ============================================================================
// SIGNATURE MOTION TOKENS & COMPONENTS
// ============================================================================

const EASINGS = {
  apple: [0.16, 1, 0.3, 1],
  decelerate: [0.22, 1, 0.36, 1],
  inertia: [0.34, 1.56, 0.64, 1]
};

const SPRINGS = {
  hero: { type: "spring", stiffness: 220, damping: 20, mass: 0.8 },
  card: { type: "spring", stiffness: 320, damping: 24, mass: 0.6 },
  button: { type: "spring", stiffness: 450, damping: 22 },
  glider: { type: "spring", stiffness: 400, damping: 28 },
  toast: { type: "spring", stiffness: 500, damping: 30 }
};

// Mouse cursor spotlight follower
function CursorSpotlight() {
  const mouseX = useMotionValue(-500);
  const mouseY = useMotionValue(-500);

  const smoothX = useSpring(mouseX, { stiffness: 180, damping: 24 });
  const smoothY = useSpring(mouseY, { stiffness: 180, damping: 24 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: smoothX,
        top: smoothY,
        translateX: '-50%',
        translateY: '-50%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 5
      }}
    />
  );
}

// Animated ambient floating particles
function FloatingParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 12 + 10,
      delay: Math.random() * 5
    }));
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: 0, opacity: 0.2 }}
          animate={{ 
            y: [-20, 20, -20], 
            x: [-15, 15, -15],
            opacity: [0.15, 0.45, 0.15] 
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay
          }}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
            filter: 'blur(1px)'
          }}
        />
      ))}
    </div>
  );
}

// 3D Perspective Tilt Card with Reflection Sheen
function TiltCard({ children, className = "", onClick, ...props }) {
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [sheenX, setSheenX] = useState(50);
  const [sheenY, setSheenY] = useState(50);

  const handleMouseMove = (e) => {
    if (shouldReduceMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rX = ((y / rect.height) - 0.5) * -12; // rotateX
    const rY = ((x / rect.width) - 0.5) * 12;   // rotateY
    setRotateX(rX);
    setRotateY(rY);
    setSheenX((x / rect.width) * 100);
    setSheenY((y / rect.height) * 100);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div className="perspective-1000">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        animate={{ rotateX, rotateY }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        style={{ transformStyle: 'preserve-3d' }}
        className={`relative overflow-hidden ${className}`}
        {...props}
      >
        {/* Dynamic Sheen Reflection */}
        {!shouldReduceMotion && (
          <div 
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-20 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.4) 0%, transparent 60%)`
            }}
          />
        )}
        {children}
      </motion.div>
    </div>
  );
}

// Typewriter Text Effect
function TypewriterText({ text, speed = 40 }) {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    setDisplayed('');
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < text.length) {
        setDisplayed(text.substring(0, idx + 1));
        idx++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <span>{displayed}</span>;
}

function PageTransition({ children }) {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return <div className="w-full min-h-[calc(100vh-4rem)] pb-20 sm:pb-8">{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -16, scale: 0.985, filter: "blur(8px)" }}
      transition={{ duration: 0.32, ease: EASINGS.apple }}
      className="w-full min-h-[calc(100vh-4rem)] flex flex-col pb-20 sm:pb-8"
    >
      {children}
    </motion.div>
  );
}

// Reusable physical motion button
function PremiumButton({ children, onClick, type = "button", disabled, loading, success, className = "", ...props }) {
  const shouldReduceMotion = useReducedMotion();
  
  const handleClick = (e) => {
    playHapticSound('click');
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      whileHover={shouldReduceMotion ? {} : { y: -2, filter: "brightness(1.08)", boxShadow: "0 10px 30px -10px rgba(255,255,255,0.12)" }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 450, damping: 22 }}
      type={type}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`relative py-3.5 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition-colors duration-200 text-xs font-bold font-sans tracking-wider min-h-[44px] select-none flex items-center justify-center rounded-[14px] overflow-hidden ${className}`}
      {...props}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin text-black" />
            <span>Processing</span>
          </motion.div>
        ) : success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4 text-black" />
            <span>Success</span>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// Reusable physical motion input with error shake
function PremiumInput({ label, type = "text", value, onChange, placeholder, required, error, shake, icon: Icon, className = "", ...props }) {
  const [focused, setFocused] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-2 font-sans font-bold">
          {label}
        </label>
      )}
      <motion.div
        animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.45 }}
        className="relative"
      >
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            boxShadow: focused ? "0 0 16px rgba(255, 255, 255, 0.15)" : "none"
          }}
          className={`w-full bg-black border ${
            error 
              ? 'border-red-800 focus:border-red-500' 
              : focused 
                ? 'border-white' 
                : 'border-zinc-900'
          } px-3.5 py-2.5 text-sm text-white placeholder-zinc-800 transition-colors duration-300 rounded-[14px] font-sans ${className}`}
          {...props}
        />
        {Icon && (
          <div className="absolute right-3.5 top-3.5 text-zinc-800 pointer-events-none">
            <Icon className="h-4 w-4" />
          </div>
        )}
        
        {!shouldReduceMotion && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: focused ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white origin-center rounded-full"
          />
        )}
      </motion.div>
      {error && (
        <span className="text-[9px] uppercase tracking-wider text-red-500 mt-1 block">
          {error}
        </span>
      )}
    </div>
  );
}

const FITNESS_GOAL_OPTIONS = [
  { value: 'fat_loss', label: 'Fat Loss (-20% deficit)' },
  { value: 'body_recomp', label: 'Body Recomposition (-5% deficit)' },
  { value: 'lean_gain', label: 'Lean Muscle Gain (+7.5% surplus)' },
  { value: 'muscle_building', label: 'Muscle Building (+12.5% surplus)' },
  { value: 'clean_bulk', label: 'Clean Bulk (+15% surplus)' },
  { value: 'aggressive_bulk', label: 'Aggressive Bulk (+22.5% surplus)' },
  { value: 'maintenance', label: 'Maintenance (TDEE)' },
  { value: 'athletic', label: 'Athletic Performance (+5% surplus)' },
  { value: 'endurance', label: 'Endurance Training (+5% surplus)' }
];

const ACTIVITY_LEVEL_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary (Little/no exercise)' },
  { value: 'lightly_active', label: 'Lightly Active (1-3 days/wk)' },
  { value: 'moderately_active', label: 'Moderately Active (3-5 days/wk)' },
  { value: 'very_active', label: 'Very Active (6-7 days/wk)' },
  { value: 'extra_active', label: 'Extremely Active (Hard physical work)' }
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' }
];

function calculateTargetsFrontend({ gender, weight, height, age, activityLevel, fitnessGoal }) {
  const w = parseFloat(weight) || 0;
  const h = parseFloat(height) || 0;
  const a = parseInt(age) || 0;
  if (!w || !h || !a) return { calories: 0, protein: 0, carbs: 0, fat: 0, bmr: 0, tdee: 0 };

  const g = (gender || 'male').toLowerCase();

  let bmr = 0;
  if (g === 'male') {
    bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
  } else if (g === 'female') {
    bmr = (10 * w) + (6.25 * h) - (5 * a) - 161;
  } else {
    bmr = (10 * w) + (6.25 * h) - (5 * a) - 78;
  }

  let activityMult = 1.2;
  switch (activityLevel) {
    case 'sedentary': activityMult = 1.2; break;
    case 'lightly_active': activityMult = 1.375; break;
    case 'moderately_active': activityMult = 1.55; break;
    case 'very_active': activityMult = 1.725; break;
    case 'extra_active':
    case 'extremely_active': activityMult = 1.9; break;
    default: activityMult = 1.2;
  }
  const tdee = bmr * activityMult;

  let calorieMult = 1.0;
  let proteinFactor = 1.7;
  let fatRatio = 0.25;

  switch (fitnessGoal) {
    case 'fat_loss': calorieMult = 0.80; proteinFactor = 2.2; fatRatio = 0.25; break;
    case 'body_recomp': calorieMult = 0.95; proteinFactor = 2.2; fatRatio = 0.25; break;
    case 'lean_gain': calorieMult = 1.075; proteinFactor = 2.0; fatRatio = 0.25; break;
    case 'muscle_building': calorieMult = 1.125; proteinFactor = 2.1; fatRatio = 0.25; break;
    case 'clean_bulk': calorieMult = 1.15; proteinFactor = 1.9; fatRatio = 0.25; break;
    case 'aggressive_bulk': calorieMult = 1.225; proteinFactor = 1.8; fatRatio = 0.25; break;
    case 'maintenance': calorieMult = 1.0; proteinFactor = 1.7; fatRatio = 0.25; break;
    case 'athletic': calorieMult = 1.05; proteinFactor = 1.9; fatRatio = 0.25; break;
    case 'endurance': calorieMult = 1.05; proteinFactor = 1.7; fatRatio = 0.20; break;
    default: calorieMult = 1.0; proteinFactor = 1.7; fatRatio = 0.25;
  }

  let calories = Math.max(1200, Math.round(tdee * calorieMult));
  let protein = Math.round(w * proteinFactor);
  let fat = Math.round((calories * fatRatio) / 9);
  let carbs = Math.max(0, Math.round((calories - ((protein * 4) + (fat * 9))) / 4));

  return { calories, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

function CustomSelect({ label, value, onChange, options, placeholder = "Select an option", className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });
  const selectedOption = options.find(o => o.value === value);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = Math.min(220, options.length * 40 + 12);
    const placement = spaceBelow < menuHeight && rect.top > menuHeight ? 'top' : 'bottom';

    setCoords({
      left: rect.left,
      width: rect.width,
      top: placement === 'bottom' ? rect.bottom + 6 : rect.top - menuHeight - 6,
      placement
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => {
        updatePosition();
      };
      const handleClickOutside = (e) => {
        if (triggerRef.current && triggerRef.current.contains(e.target)) return;
        const menuEl = document.getElementById('portal-select-menu');
        if (menuEl && menuEl.contains(e.target)) return;
        setIsOpen(false);
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('mousedown', handleClickOutside);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <div className={`space-y-1.5 w-full relative ${className}`}>
      {label && (
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-2 font-sans font-bold select-none">
          {label}
        </label>
      )}
      <div 
        ref={triggerRef}
        onClick={() => {
          playHapticSound('click');
          setIsOpen(!isOpen);
        }}
        className="w-full bg-black border border-zinc-900 px-3.5 py-2.5 text-xs text-white cursor-pointer select-none rounded-[14px] flex items-center justify-between hover:border-zinc-700 transition-colors"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0 ml-2" />
        </motion.div>
      </div>

      {isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            id="portal-select-menu"
            initial={{ opacity: 0, y: coords.placement === 'bottom' ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: coords.placement === 'bottom' ? -6 : 6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              top: `${coords.top}px`,
              width: `${coords.width}px`,
              zIndex: 99999
            }}
            className="bg-zinc-950/98 border border-zinc-800 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] rounded-[14px] p-1.5 max-h-56 overflow-y-auto select-none font-sans"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    playHapticSound('click');
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2.5 text-xs cursor-pointer select-none rounded-[10px] transition-colors flex justify-between items-center ${
                    isSelected ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-black shrink-0 ml-2" />}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// Confetti micro-particle burst for protein achievement
function CelebrationParticles({ trigger }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (trigger) {
      playHapticSound('success');
      const newParticles = Array.from({ length: 32 }).map((_, idx) => ({
        id: idx + Date.now(),
        destX: (Math.random() - 0.5) * 420,
        destY: (Math.random() - 0.5) * 420 - 60,
        size: Math.random() * 4 + 3,
        color: Math.random() > 0.5 ? '#ffffff' : '#71717a',
        rotate: Math.random() * 360,
        scale: Math.random() * 0.5 + 0.5
      }));
      setParticles(newParticles);
      
      const timer = setTimeout(() => {
        setParticles([]);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-30">
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
            animate={{ 
              x: p.destX, 
              y: p.destY, 
              opacity: [1, 1, 0], 
              scale: p.scale,
              rotate: p.rotate + 180 
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: [0.1, 0.8, 0.2, 1] }}
            style={{
              position: 'absolute',
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: Math.random() > 0.5 ? '0%' : '50%'
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Spring physics-driven metabolic progress ring with counting digits
function ProgressRingWithCountUp({ consumed, target, remaining, label, suffix, radius = 54 }) {
  const shouldReduceMotion = useReducedMotion();
  const circ = 2 * Math.PI * radius;

  const consumedVal = useMotionValue(0);
  const remainingVal = useMotionValue(target);

  const springConsumed = useSpring(consumedVal, shouldReduceMotion ? { duration: 0 } : { stiffness: 55, damping: 14 });
  const springRemaining = useSpring(remainingVal, shouldReduceMotion ? { duration: 0 } : { stiffness: 70, damping: 10, mass: 0.9 });

  const [displayRemaining, setDisplayRemaining] = useState(remaining);
  const [pulseGlow, setPulseGlow] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    const animConsumed = animate(consumedVal, consumed, shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 55, damping: 14 });
    const animRemaining = animate(remainingVal, remaining, shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 10, mass: 0.9 });

    if (suffix.includes('Protein') && consumed >= target && target > 0 && !celebrated) {
      setPulseGlow(true);
      setCelebrated(true);
      setTimeout(() => setPulseGlow(false), 1600);
    } else if (consumed < target) {
      setCelebrated(false);
    }

    return () => {
      animConsumed.stop();
      animRemaining.stop();
    };
  }, [consumed, remaining, target, shouldReduceMotion, suffix]);

  useMotionValueEvent(springRemaining, "change", (latest) => {
    setDisplayRemaining(Math.max(0, Math.round(latest * 10) / 10));
  });

  const strokeDashoffset = useTransform(springConsumed, (val) => {
    const progress = target > 0 ? val / target : 0;
    return circ * (1 - Math.min(1.15, progress));
  });

  return (
    <motion.div 
      animate={pulseGlow ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col items-center gap-4 select-none relative"
    >
      <CelebrationParticles trigger={pulseGlow} />

      <div className="relative flex items-center justify-center">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle cx="80" cy="80" r={radius} stroke="#09090b" strokeWidth="5" fill="transparent" />
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#ffffff"
            strokeWidth="5"
            fill="transparent"
            strokeDasharray={circ}
            style={{ strokeDashoffset }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-[9px] uppercase tracking-wider text-zinc-550 font-sans">{label}</span>
          <span className="text-3xl font-bold font-mono text-white leading-none mt-1">
            {displayRemaining.toLocaleString()}
          </span>
          <span className="text-[9px] text-zinc-555 font-mono mt-1">{suffix}</span>
        </div>
      </div>
      <div className="text-center font-mono text-[10px] text-zinc-400">
        {Math.round(consumed * 10) / 10} / {target} {suffix.includes('Protein') ? 'g' : 'kcal'}
      </div>
    </motion.div>
  );
}

// Stackable Toast Item with Progress Bar timer
function ToastItem({ toast, onRemove }) {
  const shouldReduceMotion = useReducedMotion();
  const duration = 3000;

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <motion.div
      layout
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 30, scale: 0.9, height: 0 }}
      animate={{ opacity: 1, y: 0, scale: 1, height: "auto" }}
      exit={{ opacity: 0, scale: 0.85, height: 0, y: 15 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="bg-zinc-950 border border-zinc-900 px-4 py-3.5 shadow-2xl flex flex-col gap-2 rounded-[16px] min-w-[220px] pointer-events-auto overflow-hidden relative"
    >
      <div className="flex items-center gap-3 text-xs text-white">
        <Check className="h-4 w-4 text-white shrink-0" />
        <span className="tracking-wide font-sans">{toast.text}</span>
      </div>
      
      {!shouldReduceMotion && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 3, ease: "linear" }}
            className="h-full bg-white"
          />
        </div>
      )}
    </motion.div>
  );
}

// Floating Action Button (FAB) for Add Item Explosion
function FloatingActionButton({ onClick }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      whileHover={shouldReduceMotion ? {} : { scale: 1.12, boxShadow: "0 0 30px rgba(255,255,255,0.3)" }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.9 }}
      animate={shouldReduceMotion ? {} : { scale: [1, 1.05, 1], boxShadow: ["0 0 0px rgba(255,255,255,0)", "0 0 20px rgba(255,255,255,0.25)", "0 0 0px rgba(255,255,255,0)"] }}
      transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
      onClick={(e) => {
        playHapticSound('click');
        onClick(e);
      }}
      className="fixed bottom-20 sm:bottom-8 right-6 z-40 bg-white text-black p-4 rounded-full shadow-2xl flex items-center justify-center border border-white"
      aria-label="Add Food Log"
    >
      <Plus className="h-6 w-6 font-bold" />
    </motion.button>
  );
}

// ============================================================================
// PAGE COMPONENTS
// ============================================================================

// Welcome / Landing Screen (entry point for unauthenticated users)
function WelcomePage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const features = [
    { label: 'Calorie Tracking', icon: Flame },
    { label: 'Macro Goals',      icon: Target },
    { label: 'Progress History', icon: TrendingUp },
  ];

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASINGS.apple } }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden bg-black">
      {/* Ambient radial spotlight */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(255,255,255,0.055) 0%, transparent 70%)' }}
      />
      {/* Fine grain noise texture overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '128px' }}
      />
      <FloatingParticles />

      <motion.div
        variants={shouldReduceMotion ? {} : containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center text-center max-w-sm w-full"
      >
        {/* Logo mark */}
        <motion.div variants={shouldReduceMotion ? {} : itemVariants} className="mb-8">
          <div className="relative inline-flex items-center justify-center">
            {/* Outer glow ring */}
            <motion.div
              animate={shouldReduceMotion ? {} : { scale: [1, 1.08, 1], opacity: [0.35, 0.6, 0.35] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute w-20 h-20 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)' }}
            />
            {/* Icon container */}
            <div className="relative w-16 h-16 rounded-[20px] bg-white flex items-center justify-center shadow-2xl">
              <Sparkles className="w-7 h-7 text-black" />
            </div>
          </div>
        </motion.div>

        {/* App name */}
        <motion.h1
          variants={shouldReduceMotion ? {} : itemVariants}
          className="text-4xl font-bold tracking-tight text-white font-sans mb-3"
        >
          NutriTrack Pro
        </motion.h1>

        {/* Tagline */}
        <motion.p
          variants={shouldReduceMotion ? {} : itemVariants}
          className="text-sm text-zinc-400 font-sans leading-relaxed mb-8 px-2"
        >
          Your intelligent nutrition companion.
          <br />
          <span className="text-zinc-600">Track, optimise, and transform.</span>
        </motion.p>

        {/* Feature pills */}
        <motion.div
          variants={shouldReduceMotion ? {} : itemVariants}
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <span
                key={f.label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-950/60 text-[11px] font-sans font-medium text-zinc-400 select-none"
              >
                <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" strokeWidth={1.75} />
                {f.label}
              </span>
            );
          })}
        </motion.div>

        {/* Primary CTA */}
        <motion.div variants={shouldReduceMotion ? {} : itemVariants} className="w-full mb-3">
          <PremiumButton
            id="welcome-get-started"
            className="w-full"
            onClick={() => { playHapticSound('click'); navigate('/register'); }}
          >
            Get Started
          </PremiumButton>
        </motion.div>

        {/* Secondary CTA */}
        <motion.div variants={shouldReduceMotion ? {} : itemVariants}>
          <motion.button
            id="welcome-sign-in"
            type="button"
            onClick={() => { playHapticSound('click'); navigate('/login'); }}
            whileHover={shouldReduceMotion ? {} : { y: -1, color: '#ffffff' }}
            whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="text-sm font-sans text-zinc-500 hover:text-white transition-colors py-2 px-4 select-none"
          >
            Already have an account?{' '}
            <span className="font-bold text-zinc-300">Sign In</span>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Bottom brand mark */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-8 text-[10px] text-zinc-700 font-mono tracking-widest uppercase select-none"
      >
        NutriTrack Pro © 2025
      </motion.p>
    </div>
  );
}

function Navigation({ user, location }) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const tabs = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/log', label: 'Food Log', icon: ClipboardList, activeMatch: '/log' },
    { path: '/history', label: 'History', icon: BarChart2 },
    { path: '/profile', label: 'Profile', icon: UserIcon }
  ];

  const checkActive = (tab) => {
    if (tab.activeMatch) {
      return location.pathname.startsWith(tab.activeMatch);
    }
    return location.pathname === tab.path;
  };

  return (
    <>
      {/* Desktop Top Navbar */}
      <header className="hidden sm:flex justify-between items-center border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-40 px-8 py-4">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => { playHapticSound('click'); navigate('/'); }}>
          <Sparkles className="h-4 w-4 text-white" />
          <h1 className="text-base font-bold tracking-tight text-white font-sans">
            NutriTrack Pro
          </h1>
        </div>

        <nav className="flex relative gap-1">
          {tabs.map((tab) => {
            const isActive = checkActive(tab);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.path}
                to={tab.path}
                onClick={() => playHapticSound('click')}
                className={`relative px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors z-10 select-none group flex items-center gap-2 ${
                  isActive ? 'text-black font-extrabold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <motion.div 
                  whileHover={shouldReduceMotion ? {} : { rotate: -2, scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 450, damping: 22 }}
                  className="relative z-10"
                >
                  <Icon className="h-3.5 w-3.5" />
                </motion.div>
                
                <motion.span 
                  whileHover={shouldReduceMotion ? {} : { x: 2 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  className="relative z-10"
                >
                  {tab.label}
                </motion.span>

                {isActive && (
                  <motion.div
                    layoutId="desktopNavPill"
                    className="absolute inset-0 bg-white rounded-[12px] z-0"
                    transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="text-xs text-zinc-500 font-mono select-none">
          {(user?.name || user?.email || 'USER').split(' ')[0].toUpperCase()}
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-zinc-900 py-1 flex justify-around items-center sm:hidden shadow-2xl backdrop-blur-md">
        {tabs.map((tab) => {
          const isActive = checkActive(tab);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              to={tab.path}
              onClick={() => playHapticSound('click')}
              className="flex-1 py-2 flex flex-col items-center justify-center relative text-center"
            >
              {isActive && (
                <motion.div
                  layoutId="mobileNavPill"
                  className="absolute inset-x-3 top-1 bottom-1 bg-zinc-900 rounded-[12px] -z-10"
                  transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <motion.div
                whileHover={shouldReduceMotion ? {} : { rotate: -2, scale: 1.05 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.88, rotate: -2 }}
                className={`flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-zinc-550 hover:text-zinc-400'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <motion.span 
                  whileHover={shouldReduceMotion ? {} : { x: 1.5 }}
                  className="text-[9px] uppercase tracking-wider font-bold font-sans"
                >
                  {tab.label.split(' ')[0]}
                </motion.span>
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function LoginPage({
  authSubView,
  setAuthSubView,
  logEmail,
  setLogEmail,
  logPassword,
  setLogPassword,
  handleLogin,
  forgotEmail,
  setForgotEmail,
  handleSendOtp,
  handleResendOtp,
  handleVerifyOtp,
  handleResetPasswordWithOtp,
  otpDigits,
  setOtpDigits,
  otpCountdown,
  otpRefs,
  otpSending,
  resetPasswordVal,
  setResetPasswordVal,
  confirmPasswordVal,
  setConfirmPasswordVal,
  showPassword,
  setShowPassword,
  resetPasswordStrength,
  authShake
}) {
  const navigate = useNavigate();

  const handleOtpChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = cleanValue.slice(-1);
    setOtpDigits(newDigits);

    if (cleanValue && index < 5 && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && otpRefs.current[index - 1]) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (pasted.length) {
      const newDigits = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setOtpDigits(newDigits);
      const targetIdx = Math.min(5, pasted.length - 1);
      if (otpRefs.current[targetIdx]) {
        otpRefs.current[targetIdx].focus();
      }
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Dark room spotlight */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_75%)] pointer-events-none"
      />

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="max-w-md w-full relative z-10"
      >
        <TiltCard className="panel-glass p-8 border border-zinc-900 shadow-2xl rounded-[24px]">
          {/* Back to welcome link */}
          <button
            type="button"
            onClick={() => { playHapticSound('click'); navigate('/welcome'); }}
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-white transition-colors mb-6 font-mono uppercase tracking-wide select-none"
          >
            <ChevronLeft className="w-3 h-3" />
            Welcome
          </button>

          <div className="text-center mb-8">
            <motion.h1 
              initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 15, delay: 0.3 }}
              className="text-2xl font-bold tracking-tight text-white font-sans inline-block"
            >
              NutriTrack Pro
            </motion.h1>
            <p className="text-xs text-zinc-550 mt-2 font-sans min-h-[18px]">
              <TypewriterText text="Architecting metabolic perfection." speed={35} />
            </p>
          </div>

          {authSubView === 'default' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: EASINGS.decelerate, delay: 0.4 }}
              >
                <PremiumInput 
                  label="Email"
                  type="email"
                  value={logEmail}
                  onChange={(e) => setLogEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  shake={authShake}
                  icon={Mail}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: EASINGS.decelerate, delay: 0.48 }}
              >
                <PremiumInput 
                  label="Password"
                  type="password"
                  value={logPassword}
                  onChange={(e) => setLogPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  shake={authShake}
                  icon={Lock}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.56 }}
              >
                <PremiumButton type="submit" className="w-full">
                  Log In
                </PremiumButton>
              </motion.div>

              <div className="flex justify-between items-center text-xs mt-6 text-zinc-500 font-sans">
                <button 
                  type="button"
                  onClick={() => {
                    setAuthSubView('forgot');
                    setForgotEmail(logEmail);
                  }}
                  className="hover:text-white transition-colors"
                >
                  Forgot password?
                </button>
                <button 
                  type="button"
                  onClick={() => navigate('/register')} 
                  className="text-white hover:underline font-bold"
                >
                  Sign up
                </button>
              </div>
            </form>
          )}

          {authSubView === 'forgot' && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-2">Forgot Password</h3>
                <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                  Enter your registered email address to receive a 6-digit verification code.
                </p>
                <PremiumInput 
                  label="Email Address"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  shake={authShake}
                  icon={Mail}
                />
              </div>

              <PremiumButton type="submit" disabled={otpSending} className="w-full flex items-center justify-center gap-2">
                {otpSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  'Send OTP'
                )}
              </PremiumButton>

              <div className="text-center text-xs mt-6 font-sans text-zinc-550">
                <button 
                  type="button" 
                  onClick={() => setAuthSubView('default')} 
                  className="hover:text-white transition-colors"
                >
                  Back to login
                </button>
              </div>
            </form>
          )}

          {authSubView === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-2">Verification Code</h3>
                <p className="text-xs text-zinc-500 mb-2 leading-relaxed">
                  Enter the 6-digit code sent to:
                </p>
                <div className="text-xs font-mono font-bold text-white bg-black border border-zinc-900 px-3 py-2 rounded-[12px] truncate mb-4 select-all">
                  {forgotEmail}
                </div>

                <div className="flex gap-2 justify-center my-6">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => otpRefs.current[idx] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      autoFocus={idx === 0}
                      className="w-11 h-13 text-center text-lg font-mono font-bold bg-black border border-zinc-800 rounded-[12px] text-white focus:border-white focus:ring-1 focus:ring-white transition-colors outline-none"
                    />
                  ))}
                </div>
              </div>

              <PremiumButton type="submit" className="w-full">
                Verify Code
              </PremiumButton>

              <div className="flex justify-between items-center text-xs mt-6 font-sans text-zinc-500">
                <button 
                  type="button" 
                  onClick={() => setAuthSubView('forgot')} 
                  className="hover:text-white transition-colors"
                >
                  Back
                </button>

                {otpCountdown > 0 ? (
                  <span className="text-zinc-550 font-mono text-[11px]">
                    Resend code in {otpCountdown}s
                  </span>
                ) : (
                  <button 
                    type="button"
                    onClick={handleResendOtp}
                    className="text-white hover:text-zinc-300 font-bold"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}

          {authSubView === 'reset' && (
            <form onSubmit={handleResetPasswordWithOtp} className="space-y-5">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-2">Set New Password</h3>
                <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                  Enter your new password below to update your account.
                </p>
                
                <div className="space-y-4">
                  <div className="relative">
                    <PremiumInput 
                      label="New Password"
                      type={showPassword ? "text" : "password"}
                      value={resetPasswordVal}
                      onChange={(e) => setResetPasswordVal(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      shake={authShake}
                      icon={Lock}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-9 text-zinc-500 hover:text-white transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <PremiumInput 
                      label="Confirm Password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPasswordVal}
                      onChange={(e) => setConfirmPasswordVal(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      shake={authShake}
                      icon={Lock}
                    />
                  </div>

                  {resetPasswordVal.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1.5 h-1">
                        {[1, 2, 3, 4].map((step) => (
                          <div 
                            key={step} 
                            className={`flex-1 transition-colors rounded-full ${
                              resetPasswordStrength >= step ? 'bg-white' : 'bg-zinc-900 border border-zinc-850'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-zinc-500 mt-1 block">
                        {
                          resetPasswordStrength === 4 ? 'Strength: Strong' :
                          resetPasswordStrength === 3 ? 'Strength: Medium' : 'Requires uppercase, lowercase, number, special character'
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <PremiumButton 
                type="submit" 
                disabled={resetPasswordStrength < 4 || resetPasswordVal !== confirmPasswordVal}
                className="w-full"
              >
                Update Password
              </PremiumButton>

              <div className="text-center text-xs mt-6 font-sans text-zinc-550">
                <button 
                  type="button" 
                  onClick={() => setAuthSubView('default')} 
                  className="hover:text-white transition-colors"
                >
                  Back to login
                </button>
              </div>
            </form>
          )}
        </TiltCard>
      </motion.div>
    </div>
  );
}

function RegisterPage({
  regName,
  setRegName,
  regEmail,
  setRegEmail,
  regPassword,
  setRegPassword,
  regPasswordStrength,
  regHeight,
  setRegHeight,
  regWeight,
  setRegWeight,
  regAge,
  setRegAge,
  regGender,
  setRegGender,
  regGoal,
  setRegGoal,
  regActivity,
  setRegActivity,
  handleRegister,
  authShake
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <TiltCard className="max-w-xl w-full panel-glass p-8 transition-premium border border-zinc-900 rounded-[24px]">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">Create your account</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Enter details to calculate daily target intake</p>
          </div>
          <button 
            type="button"
            onClick={() => navigate('/welcome')} 
            className="text-xs border border-zinc-900 hover:border-zinc-700 px-4 py-2 uppercase font-mono transition-colors text-zinc-400 hover:text-white rounded-[12px]"
          >
            Back
          </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PremiumInput 
              label="Full name"
              type="text"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Alex Mercer"
              required
              shake={authShake}
            />
            <PremiumInput 
              label="Email address"
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="you@example.com"
              required
              shake={authShake}
            />
          </div>

          <div>
            <PremiumInput 
              label="Password"
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="Minimum 8 characters with uppercase, lowercase, number, symbol"
              required
              shake={authShake}
            />
            
            {regPassword.length > 0 && (
              <div className="mt-2.5">
                <div className="flex gap-1.5 h-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div 
                      key={step} 
                      className={`flex-1 transition-colors rounded-full ${
                        regPasswordStrength >= step ? 'bg-white' : 'bg-zinc-900 border border-zinc-850'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 mt-1 block">
                  {
                    regPasswordStrength === 4 ? 'Strength: Strong' :
                    regPasswordStrength === 3 ? 'Strength: Medium' : 'Password must contain uppercase, lowercase, number, special character'
                  }
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-b border-zinc-900 py-6">
            <PremiumInput 
              label="Height (cm)"
              type="number"
              value={regHeight}
              onChange={(e) => setRegHeight(e.target.value)}
              placeholder="e.g. 178"
              required
            />
            <PremiumInput 
              label="Weight (kg)"
              type="number"
              value={regWeight}
              onChange={(e) => setRegWeight(e.target.value)}
              placeholder="e.g. 74"
              required
            />
            <PremiumInput 
              label="Age (years)"
              type="number"
              value={regAge}
              onChange={(e) => setRegAge(e.target.value)}
              placeholder="e.g. 29"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CustomSelect 
              label="Sex"
              value={regGender}
              onChange={setRegGender}
              options={GENDER_OPTIONS}
            />
            <CustomSelect 
              label="Goal"
              value={regGoal}
              onChange={setRegGoal}
              options={FITNESS_GOAL_OPTIONS}
            />
            <CustomSelect 
              label="Activity level"
              value={regActivity}
              onChange={setRegActivity}
              options={ACTIVITY_LEVEL_OPTIONS}
            />
          </div>

          <PremiumButton 
            type="submit" 
            disabled={regPasswordStrength < 4}
            className="w-full"
          >
            Create Account
          </PremiumButton>
        </form>
      </TiltCard>
    </div>
  );
}

function DashboardPage({ user, totals, targetsRemaining, logs, MEAL_SLOTS, selectedDate }) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();

  const heroScale = useTransform(scrollY, [0, 250], [1, 0.96]);
  const heroOpacity = useTransform(scrollY, [0, 250], [1, 0.35]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-12">
      {/* Target Progress Rings Card with 3D Tilt & Parallax Scroll */}
      <TiltCard 
        style={{ scale: shouldReduceMotion ? 1 : heroScale, opacity: shouldReduceMotion ? 1 : heroOpacity }}
        className="panel-glass p-8 border border-zinc-900 shadow-2xl rounded-[20px]"
      >
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-8 text-center font-sans">
          Today's Metabolic Targets
        </h3>

        <div className="flex flex-col md:flex-row gap-12 justify-around items-center">
          <ProgressRingWithCountUp 
            consumed={totals.calories}
            target={user.dailyCalorieTarget}
            remaining={targetsRemaining.calories}
            label="Remaining"
            suffix="kcal"
          />

          <ProgressRingWithCountUp 
            consumed={totals.protein}
            target={user.dailyProteinTarget}
            remaining={targetsRemaining.protein}
            label="Remaining"
            suffix="g Protein"
          />
        </div>
      </TiltCard>

      {/* Condensend Meal Summary List with Staggered 3D Cards */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans font-bold">
            Today's Meals
          </h3>
          <button 
            onClick={() => { playHapticSound('click'); navigate(`/log/${selectedDate}`); }}
            className="text-[10px] font-bold text-white hover:underline uppercase tracking-wider font-sans"
          >
            Manage Detailed Log
          </button>
        </div>

        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {MEAL_SLOTS.map((slot) => {
            const slotLogs = logs.filter(log => log.mealSlot === slot.key);
            const slotCalories = Math.round(slotLogs.reduce((sum, log) => sum + (log.calories || 0), 0) * 10) / 10;
            const slotProtein = Math.round(slotLogs.reduce((sum, log) => sum + (log.protein || 0), 0) * 10) / 10;

            return (
              <motion.div
                key={slot.key}
                variants={{
                  hidden: { opacity: 0, y: 20, scale: 0.96 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: SPRINGS.card }
                }}
              >
                <TiltCard
                  whileHover={shouldReduceMotion ? {} : { y: -3, filter: "brightness(1.08)" }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { playHapticSound('click'); navigate(`/log/${selectedDate}`); }}
                  className="panel-glass p-5 border border-zinc-900 cursor-pointer flex flex-col justify-between h-32 select-none rounded-[18px]"
                >
                  <div>
                    <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider font-sans mb-1">
                      {slot.label}
                    </h4>
                    <div className="text-[10px] text-zinc-600 font-mono">
                      {slotLogs.length} {slotLogs.length === 1 ? 'item' : 'items'} logged
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline text-xs font-mono text-white mb-2">
                      <span>{slotCalories} kcal</span>
                      <span className="text-[10px] text-zinc-500">{slotProtein}g P</span>
                    </div>
                    <div className="w-full h-[3px] bg-zinc-950 rounded-full overflow-hidden border border-zinc-900/30">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (slotCalories / 800) * 100)}%` }}
                        transition={{ type: "spring", stiffness: 60, damping: 15 }}
                        className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)] rounded-full"
                      />
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

function LogPage({ 
  selectedDate, 
  setSelectedDate, 
  logs, 
  logsLoading, 
  MEAL_SLOTS, 
  handleClearSlot, 
  setActiveSlot, 
  setIsAddOpen, 
  startEdit, 
  handleDeleteLog, 
  formattedHeaderDate 
}) {
  const { date } = useParams();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (date && date !== selectedDate) {
      setSelectedDate(date);
    }
  }, [date, selectedDate]);

  const onAdjustDate = (days) => {
    playHapticSound('click');
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const newDateStr = `${year}-${month}-${day}`;
    navigate(`/log/${newDateStr}`);
  };

  const [openSlot, setOpenSlot] = useState('breakfast');

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      
      {/* Date Header Picker */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-zinc-900 pb-6 mb-8 gap-4">
        <div>
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-sans font-bold">
            Daily Intake Log
          </h2>
          <h3 className="text-lg font-bold font-sans text-white mt-1 uppercase">
            {formattedHeaderDate}
          </h3>
        </div>

        <div className="flex items-center border border-zinc-900 bg-black p-0.5 self-start sm:self-auto rounded-[14px]">
          <motion.button 
            whileTap={{ scale: 0.92 }}
            onClick={() => onAdjustDate(-1)} 
            className="p-2 hover:bg-zinc-950 transition-colors rounded-[12px]"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4 text-zinc-500" />
          </motion.button>
          
          <div className="relative flex items-center px-3 font-mono text-xs tracking-wider">
            <span className="font-bold mr-1.5 text-white">{selectedDate}</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => { playHapticSound('click'); navigate(`/log/${e.target.value}`); }}
              className="absolute inset-0 opacity-0 cursor-pointer"
              title="Choose Date"
            />
            <Calendar className="h-3.5 w-3.5 text-zinc-700" />
          </div>

          <motion.button 
            whileTap={{ scale: 0.92 }}
            onClick={() => onAdjustDate(1)} 
            className="p-2 hover:bg-zinc-950 transition-colors rounded-[12px]"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          </motion.button>
        </div>
      </div>

      {/* Accordion List of Meal Slots */}
      <div className="space-y-6">
        {logsLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="pb-6 border-b border-zinc-900/40">
                <div className="h-4 w-32 skeleton-pulse mb-3" />
                <div className="h-3 w-48 skeleton-pulse" />
              </div>
            ))}
          </div>
        ) : (
          MEAL_SLOTS.map((slot) => {
            const slotLogs = logs.filter(log => log.mealSlot === slot.key);
            const slotCalories = Math.round(slotLogs.reduce((sum, log) => sum + (log.calories || 0), 0) * 10) / 10;
            const slotProtein = Math.round(slotLogs.reduce((sum, log) => sum + (log.protein || 0), 0) * 10) / 10;
            const isOpen = openSlot === slot.key;

            return (
              <div key={slot.key} className="panel-glass overflow-hidden border border-zinc-900 rounded-[18px]">
                <div 
                  onClick={() => { playHapticSound('click'); setOpenSlot(isOpen ? null : slot.key); }}
                  className="flex justify-between items-center p-4 bg-zinc-950/20 cursor-pointer hover:bg-zinc-950/50 transition-colors select-none"
                >
                  <div className="flex items-baseline gap-3">
                    <h4 className="text-xs uppercase font-bold text-white tracking-wider font-sans">
                      {slot.label}
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {slotCalories} kcal / {slotProtein}g P
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-zinc-650 text-[10px] uppercase font-bold tracking-wider font-sans select-none">
                    <span>{isOpen ? 'Close' : 'Expand'}</span>
                  </div>
                </div>

                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="p-4 border-t border-zinc-900 bg-black/20 space-y-4">
                    <div className="flex justify-end gap-3 text-[10px] uppercase font-bold tracking-wider">
                      {slotLogs.length > 0 && (
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { playHapticSound('click'); handleClearSlot(slot.key); }}
                          className="text-zinc-500 hover:text-white py-2 px-3 border border-zinc-900 hover:border-zinc-700 transition-colors min-h-[38px] flex items-center rounded-[12px]"
                        >
                          Clear Slot
                        </motion.button>
                      )}
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          playHapticSound('click');
                          setActiveSlot(slot.key);
                          setIsAddOpen(true);
                        }}
                        className="bg-white text-black hover:bg-zinc-200 py-2 px-4 transition-colors min-h-[38px] flex items-center rounded-[12px]"
                      >
                        Add Food
                      </motion.button>
                    </div>

                    <div className="divide-y divide-zinc-950">
                      <AnimatePresence initial={false}>
                        {slotLogs.length === 0 ? (
                          <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] text-zinc-600 uppercase tracking-wider font-sans py-3"
                          >
                            No entries logged
                          </motion.p>
                        ) : (
                          slotLogs.map((log) => (
                            <motion.div 
                              layout
                              initial={shouldReduceMotion ? {} : { opacity: 0, height: 0, y: -10 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={shouldReduceMotion ? {} : { opacity: 0, height: 0, y: -10 }}
                              transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 26 }}
                              key={log.id} 
                              className="flex justify-between items-center py-3.5 group/item overflow-hidden gap-4"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-200 truncate leading-snug">
                                  {log.foodName}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-mono mt-1">
                                  {log.quantity} {log.unit} {log.gramEquivalent && log.unit !== 'g' ? `(${log.gramEquivalent}g)` : ''}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4 shrink-0 font-mono text-[10px]">
                                <span className="text-zinc-400">
                                  {Math.round(log.calories * 10) / 10} kcal / {Math.round(log.protein * 10) / 10}g P
                                </span>
                                
                                <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity">
                                  <motion.button 
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => { playHapticSound('click'); startEdit(log); }}
                                    className="p-1.5 text-zinc-500 hover:text-white min-h-[36px] flex items-center justify-center rounded-[10px]"
                                    aria-label="Edit entry"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </motion.button>
                                  <motion.button 
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => { playHapticSound('click'); handleDeleteLog(log.id); }}
                                    className="p-1.5 text-zinc-500 hover:text-white min-h-[36px] flex items-center justify-center rounded-[10px]"
                                    aria-label="Delete entry"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </motion.button>
                                </div>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function HistoryPage({ user }) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    setHistoryLoading(true);
    apiFetch('/api/logs')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setHistoryLogs(data.logs);
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  const historyDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${da}`;

      const dayLogs = historyLogs.filter(log => log.date === dateStr);
      const calories = Math.round(dayLogs.reduce((sum, log) => sum + (log.calories || 0), 0) * 10) / 10;
      const protein = Math.round(dayLogs.reduce((sum, log) => sum + (log.protein || 0), 0) * 10) / 10;

      days.push({
        date: dateStr,
        calories,
        protein,
        logCount: dayLogs.length
      });
    }
    return days;
  }, [historyLogs]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-550 font-sans font-bold">
          Historical Logs
        </h2>
        <h3 className="text-lg font-bold font-sans text-white mt-1">
          Past 14 Days
        </h3>
      </div>

      {historyLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="h-20 skeleton-pulse w-full border border-zinc-900 rounded-[18px]" />
          ))}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } }
          }}
          className="space-y-4"
        >
          {historyDays.map((day) => {
            const calPercent = user.dailyCalorieTarget > 0 ? (day.calories / user.dailyCalorieTarget) * 100 : 0;
            const protPercent = user.dailyProteinTarget > 0 ? (day.protein / user.dailyProteinTarget) * 100 : 0;
            
            const parts = day.date.split('-');
            const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const label = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

            return (
              <motion.div
                key={day.date}
                variants={{
                  hidden: { opacity: 0, y: 16, scale: 0.98 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: SPRINGS.card }
                }}
              >
                <TiltCard
                  whileHover={shouldReduceMotion ? {} : { y: -1, filter: "brightness(1.06)" }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => { playHapticSound('click'); navigate(`/log/${day.date}`); }}
                  className="panel-glass p-4 border border-zinc-900 cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-colors select-none rounded-[18px]"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white font-sans">{label}</h4>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {day.logCount} {day.logCount === 1 ? 'item' : 'items'} logged
                    </span>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 sm:w-1/2">
                    <div className="flex justify-between sm:justify-end gap-6 text-[11px] font-mono text-zinc-400 w-full">
                      <span>{day.calories} / {user.dailyCalorieTarget} kcal</span>
                      <span className="text-white font-bold">{day.protein} / {user.dailyProteinTarget}g P</span>
                    </div>
                    
                    <div className="flex gap-2 w-full">
                      <div className="flex-1 h-[3px] bg-zinc-950 overflow-hidden border border-zinc-900/30 rounded-full">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, calPercent)}%` }}
                          transition={{ type: "spring", stiffness: 50, damping: 15 }}
                          className="h-full bg-gradient-to-r from-zinc-700 via-zinc-400 to-white shadow-[0_0_8px_rgba(255,255,255,0.4)] rounded-full"
                        />
                      </div>
                      <div className="flex-1 h-[3px] bg-zinc-950 overflow-hidden border border-zinc-900/30 rounded-full">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, protPercent)}%` }}
                          transition={{ type: "spring", stiffness: 50, damping: 15 }}
                          className="h-full bg-gradient-to-r from-zinc-700 via-zinc-400 to-white shadow-[0_0_8px_rgba(255,255,255,0.4)] rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function ProfilePage({ user, setUser, handleLogout, showToast }) {
  const shouldReduceMotion = useReducedMotion();
  
  const [height, setHeight] = useState(user?.height || '');
  const [weight, setWeight] = useState(user?.weight || '');
  const [age, setAge] = useState(user?.age || '');
  const [gender, setGender] = useState(user?.gender || 'male');
  const [fitnessGoal, setFitnessGoal] = useState(user?.fitnessGoal || 'maintenance');
  const [activityLevel, setActivityLevel] = useState(user?.activityLevel || 'sedentary');
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const liveTargets = useMemo(() => {
    return calculateTargetsFrontend({ gender, weight, height, age, activityLevel, fitnessGoal });
  }, [gender, weight, height, age, activityLevel, fitnessGoal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!height || !weight || !age) {
      return showToast('Please fill out all fields');
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ height, weight, age, gender, fitnessGoal, activityLevel })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setSuccess(true);
        playHapticSound('success');
        showToast('Profile targets updated');
        setTimeout(() => setSuccess(false), 2000);
      } else {
        showToast(data.error || 'Failed to update profile');
      }
    } catch {
      showToast('Failed to update profile settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-550 font-sans font-bold">
          User Settings
        </h2>
        <h3 className="text-lg font-bold font-sans text-white mt-1">
          Profile & Scientific Targets
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <TiltCard className="panel-glass p-6 space-y-6 border border-zinc-900 rounded-[20px] shadow-2xl">
          <div className="grid grid-cols-3 gap-4">
            <PremiumInput 
              label="Height (cm)"
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              required
            />
            <PremiumInput 
              label="Weight (kg)"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />
            <PremiumInput 
              label="Age (years)"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-zinc-900 pt-6">
            <CustomSelect 
              label="Sex"
              value={gender}
              onChange={setGender}
              options={GENDER_OPTIONS}
            />
            <CustomSelect 
              label="Goal"
              value={fitnessGoal}
              onChange={setFitnessGoal}
              options={FITNESS_GOAL_OPTIONS}
            />
            <CustomSelect 
              label="Activity Level"
              value={activityLevel}
              onChange={setActivityLevel}
              options={ACTIVITY_LEVEL_OPTIONS}
            />
          </div>
        </TiltCard>

        <div className="p-4 border border-zinc-900 bg-black/40 text-zinc-400 font-mono text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-[14px]">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-550 block font-sans">Calories</span>
            <span className="text-sm font-bold text-white">{liveTargets.calories || user.dailyCalorieTarget} kcal</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-550 block font-sans">Protein</span>
            <span className="text-sm font-bold text-white">{liveTargets.protein || user.dailyProteinTarget}g</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-550 block font-sans">Carbs</span>
            <span className="text-sm font-bold text-white">{liveTargets.carbs}g</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-550 block font-sans">Fat</span>
            <span className="text-sm font-bold text-white">{liveTargets.fat}g</span>
          </div>
        </div>

        <div className="space-y-4">
          <PremiumButton
            type="submit"
            loading={saving}
            success={success}
            className="w-full"
          >
            Save Settings
          </PremiumButton>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleLogout}
            className="w-full py-3.5 bg-zinc-950 text-zinc-500 hover:text-white border border-zinc-900 hover:border-zinc-700 transition-colors text-xs font-bold font-sans tracking-wider rounded-[14px]"
          >
            Log Out
          </motion.button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// MAIN APP CONTENT (ROUTER CONSUMER)
// ============================================================================

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  // Auth States
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubView, setAuthSubView] = useState('default');
  const [authShake, setAuthShake] = useState(false);

  const triggerAuthShake = () => {
    setAuthShake(true);
    setTimeout(() => setAuthShake(false), 450);
  };

  // App States
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fetch logs for the selected date from the backend
  const fetchLogs = async (date) => {
    if (!date) return;
    setLogsLoading(true);
    try {
      const res = await apiFetch(`/api/logs?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  // Responsive state helper
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stackable Toast notifications system
  const [toasts, setToasts] = useState([]);
  const showToast = (text, type = 'default') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text, type }]);
  };
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Modals
  const [activeSlot, setActiveSlot] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  // Add / Edit Entry form
  const [formTab, setFormTab] = useState('database');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodSearchResults, setFoodSearchResults] = useState({ foods: [], live: [] });
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [unit, setUnit] = useState('g');
  // Edit-mode: stores nutrition per 1 unit of quantity (for auto-recalculation)
  const [editBaseNutrition, setEditBaseNutrition] = useState(null);

  // Register Form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regHeight, setRegHeight] = useState('');
  const [regWeight, setRegWeight] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState('male');
  const [regGoal, setRegGoal] = useState('maintenance');
  const [regActivity, setRegActivity] = useState('sedentary');

  // Login Form
  const [logEmail, setLogEmail] = useState('');
  const [logPassword, setLogPassword] = useState('');

  // Password reset OTP flow fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [resetSessionToken, setResetSessionToken] = useState('');
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const otpRefs = useRef([]);

  const regPasswordStrength = useMemo(() => getPasswordStrength(regPassword), [regPassword]);
  const resetPasswordStrength = useMemo(() => getPasswordStrength(resetPasswordVal), [resetPasswordVal]);

  // Fetch user profile on mount with 30-second timeout for cloud cold-starts
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    const checkAuthStatus = async () => {
      const authPaths = ['/login', '/register', '/welcome'];

      try {
        const res = await apiFetch('/api/auth/me', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setUser(data.user);
        } else {
          if (isMounted) {
            setUser(null);
            if (!authPaths.includes(location.pathname)) {
              navigate('/welcome');
            }
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (isMounted) {
          setUser(null);
          if (!authPaths.includes(location.pathname)) {
            if (err.name === 'AbortError') {
              showToast('Server connection timeout');
            } else {
              showToast('Could not reach backend server');
            }
            navigate('/welcome');
          }
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    checkAuthStatus();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  // Sync route guard on path changes
  useEffect(() => {
    if (!authLoading) {
      const authPaths = ['/login', '/register', '/welcome'];
      if (!user && !authPaths.includes(location.pathname)) {
        navigate('/welcome');
      } else if (user && authPaths.includes(location.pathname)) {
        navigate('/');
      }
    }
  }, [user, location.pathname, authLoading]);

  // Fetch logs whenever user is authenticated or selected date changes
  useEffect(() => {
    if (user && selectedDate) {
      fetchLogs(selectedDate);
    } else if (!user) {
      setLogs([]);
    }
  }, [user, selectedDate]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (authSubView === 'otp' && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [authSubView, otpCountdown]);

  // Handle Login
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!logEmail || !logPassword) {
      triggerAuthShake();
      return showToast('Please enter your email and password');
    }

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: logEmail, password: logPassword })
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        if (res.status === 502 || res.status === 503) {
          triggerAuthShake();
          return showToast('Backend server is waking up. Please try again in 10 seconds.');
        }
        triggerAuthShake();
        return showToast(`Server response error (${res.status})`);
      }

      if (res.ok) {
        if (data.token) setAuthToken(data.token);
        setUser(data.user);
        setAuthSubView('default');
        playHapticSound('success');
        showToast('Logged in');
        navigate('/');
      } else {
        triggerAuthShake();
        showToast(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login request error:', err);
      triggerAuthShake();
      showToast(err.message === 'Failed to fetch' 
        ? 'Could not connect to backend server. Check VITE_API_URL or server status.' 
        : (err.message || 'Could not reach authentication server'));
    }
  };

  // Handle Register
  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    if (!regName || !regEmail || !regPassword || !regHeight || !regWeight || !regAge) {
      triggerAuthShake();
      return showToast('Please fill out all registration fields');
    }

    if (regPasswordStrength < 4) {
      triggerAuthShake();
      return showToast('Password complexity requirement not met');
    }

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          height: regHeight,
          weight: regWeight,
          age: regAge,
          gender: regGender,
          fitnessGoal: regGoal,
          activityLevel: regActivity
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        if (res.status === 502 || res.status === 503) {
          triggerAuthShake();
          return showToast('Backend server is waking up. Please try again in 10 seconds.');
        }
        triggerAuthShake();
        return showToast(`Server response error (${res.status})`);
      }

      if (res.ok) {
        if (data.token) setAuthToken(data.token);
        setUser(data.user);
        playHapticSound('success');
        showToast('Account created successfully');
        navigate('/');
      } else {
        triggerAuthShake();
        showToast(data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Register request error:', err);
      triggerAuthShake();
      showToast(err.message === 'Failed to fetch' 
        ? 'Could not connect to backend server. Check VITE_API_URL or server status.' 
        : (err.message || 'Could not reach authentication server'));
    }
  };

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!forgotEmail) {
      triggerAuthShake();
      return showToast('Please enter your email address');
    }
    if (otpSending) return; // prevent duplicate requests

    setOtpSending(true);
    try {
      const res = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpDigits(['', '', '', '', '', '']);
        setOtpCountdown(60);
        setAuthSubView('otp');
        showToast(data.message || 'Verification code sent to your email.');
        playHapticSound('click');
      } else {
        triggerAuthShake();
        showToast(data.error || 'Failed to send verification code');
      }
    } catch {
      triggerAuthShake();
      showToast('Authentication server unavailable');
    } finally {
      setOtpSending(false);
    }
  };

  // Step 1.5: Resend OTP
  const handleResendOtp = async () => {
    if (otpCountdown > 0 || otpSending) return;
    setOtpSending(true);
    try {
      const res = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpCountdown(60);
        setOtpDigits(['', '', '', '', '', '']);
        showToast('New verification code sent');
        playHapticSound('click');
      } else {
        showToast(data.error || 'Failed to resend code');
      }
    } catch {
      showToast('Authentication server unavailable');
    } finally {
      setOtpSending(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const otpCode = otpDigits.join('');
    if (otpCode.length < 6) {
      triggerAuthShake();
      return showToast('Please enter the complete 6-digit code');
    }

    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail, otp: otpCode })
      });
      const data = await res.json();
      if (res.ok) {
        setResetSessionToken(data.resetSessionToken);
        setAuthSubView('reset');
        playHapticSound('success');
        showToast('Code verified. Set your new password.');
      } else {
        triggerAuthShake();
        showToast(data.error || 'Invalid verification code');
      }
    } catch {
      triggerAuthShake();
      showToast('Verification service unavailable');
    }
  };

  // Step 3: Reset Password using OTP reset token
  const handleResetPasswordWithOtp = async (e) => {
    if (e) e.preventDefault();
    if (!resetPasswordVal || !confirmPasswordVal) {
      triggerAuthShake();
      return showToast('Please fill out both password fields');
    }

    if (resetPasswordVal !== confirmPasswordVal) {
      triggerAuthShake();
      return showToast('Passwords do not match');
    }

    if (resetPasswordStrength < 4) {
      triggerAuthShake();
      return showToast('Password must contain upper, lower, number, special char');
    }

    try {
      const res = await apiFetch('/api/auth/reset-password-otp', {
        method: 'POST',
        body: JSON.stringify({ resetSessionToken, password: resetPasswordVal })
      });
      const data = await res.json();
      if (res.ok) {
        playHapticSound('success');
        showToast('Password updated successfully.');
        setResetSessionToken('');
        setResetPasswordVal('');
        setConfirmPasswordVal('');
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => {
          setAuthSubView('default');
        }, 2000);
      } else {
        triggerAuthShake();
        showToast(data.error || 'Reset failed');
      }
    } catch {
      triggerAuthShake();
      showToast('Password reset failed');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setAuthToken(null);
    setUser(null);
    setLogPassword('');
    playHapticSound('click');
    showToast('Logged out');
    navigate('/login');
  };

  // Debounced food search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setFoodSearchResults({ foods: [], live: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setFoodSearchLoading(true);
      try {
        const res = await apiFetch(`/api/foods/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setFoodSearchResults(data);
        }
      } catch {
        // silently fail
      } finally {
        setFoodSearchLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectDatabaseFood = async (food) => {
    playHapticSound('click');
    setSelectedFood(food);
    setFoodName(food.displayName || food.name);

    const valid = getValidUnits(food);
    const defaultUnit = valid[0] || 'g';
    setUnit(defaultUnit);

    if (defaultUnit === 'piece') {
      setQuantity('1');
    } else {
      setQuantity('100');
    }

    setCalories(String(Math.round(food.calories * 10) / 10));
    setProtein(String(Math.round(food.protein * 10) / 10));
    setCarbs(String(Math.round(food.carbs * 10) / 10));
    setFat(String(Math.round(food.fat * 10) / 10));

    if (food.live) {
      try {
        await apiFetch('/api/foods/cache', {
          method: 'POST',
          body: JSON.stringify(food)
        });
      } catch {}
    }
  };

  const finalLogValues = useMemo(() => {
    if (formTab === 'custom') {
      const qty = parseFloat(quantity) || 0;

      // When editing with auto-recalculation, compute from base nutrition per unit
      if (editingLog && editBaseNutrition) {
        return {
          foodName,
          quantity: qty,
          unit,
          calories:  Math.round(editBaseNutrition.caloriesPerUnit  * qty),
          protein:   Math.round(editBaseNutrition.proteinPerUnit   * qty * 10) / 10,
          carbs:     Math.round(editBaseNutrition.carbsPerUnit     * qty * 10) / 10,
          fat:       Math.round(editBaseNutrition.fatPerUnit       * qty * 10) / 10,
          gramEquivalent: qty
        };
      }

      // Custom entry (add mode): use raw form field values
      return {
        foodName,
        quantity: qty,
        unit,
        calories: Math.round((parseFloat(calories) || 0) * 10) / 10,
        protein: Math.round((parseFloat(protein) || 0) * 10) / 10,
        carbs: Math.round((parseFloat(carbs) || 0) * 10) / 10,
        fat: Math.round((parseFloat(fat) || 0) * 10) / 10,
        gramEquivalent: qty
      };
    }

    if (!selectedFood) return null;

    const qty = parseFloat(quantity) || 0;
    const grams = resolveGrams(qty, unit, selectedFood.pieceWeight);
    const base = 100;
    const ratio = grams / base;

    return {
      foodName: selectedFood.displayName || selectedFood.name,
      quantity: qty,
      unit,
      calories: Math.round(selectedFood.calories * ratio * 10) / 10,
      protein: Math.round(selectedFood.protein * ratio * 10) / 10,
      carbs: Math.round(selectedFood.carbs * ratio * 10) / 10,
      fat: Math.round(selectedFood.fat * ratio * 10) / 10,
      gramEquivalent: grams
    };
  }, [formTab, selectedFood, quantity, unit, foodName, calories, protein, carbs, fat, editingLog, editBaseNutrition]);

  const resetForm = () => {
    setFormTab('database');
    setSearchQuery('');
    setSelectedFood(null);
    setFoodSearchResults({ foods: [], live: [] });
    setQuantity('');
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setUnit('g');
    setEditingLog(null);
    setEditBaseNutrition(null);
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!finalLogValues || !finalLogValues.foodName || finalLogValues.quantity <= 0) {
      return showToast('Please enter a valid quantity');
    }

    const backupState = [...logs];
    const tempId = -Date.now();
    const optimisticEntry = {
      id: tempId,
      mealSlot: activeSlot,
      createdAt: new Date().toISOString(),
      ...finalLogValues
    };

    setLogs(prev => [...prev, optimisticEntry]);
    setIsAddOpen(false);
    resetForm();
    playHapticSound('success');
    showToast('Entry added');

    try {
      const res = await apiFetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          mealSlot: activeSlot,
          ...finalLogValues
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Replace optimistic entry with real server data, then refetch for full sync
        setLogs(prev => prev.map(l => l.id === tempId ? data.log : l));
        fetchLogs(selectedDate);
      } else {
        setLogs(backupState);
        showToast(data.error || 'Failed to save entry');
      }
    } catch {
      setLogs(backupState);
      showToast('Connection failed, entry discarded');
    }
  };

  const handleEditLog = async (e) => {
    e.preventDefault();
    if (!editingLog || !finalLogValues || finalLogValues.quantity <= 0) return;

    const backupState = [...logs];
    const targetId = editingLog.id;

    setLogs(prev => prev.map(l => l.id === targetId ? { ...l, ...finalLogValues } : l));
    setIsAddOpen(false);
    resetForm();
    playHapticSound('success');
    showToast('Entry updated');

    try {
      const res = await apiFetch(`/api/logs/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...finalLogValues, mealSlot: activeSlot })
      });
      const data = await res.json();
      if (!res.ok) {
        setLogs(backupState);
        showToast(data.error || 'Failed to update entry');
      } else {
        // Refetch after confirmed update to sync any mealSlot date changes
        fetchLogs(selectedDate);
      }
    } catch {
      setLogs(backupState);
      showToast('Connection failed, change reverted');
    }
  };

  const handleDeleteLog = async (id) => {
    const backupState = [...logs];
    setLogs(prev => prev.filter(l => l.id !== id));
    playHapticSound('click');
    showToast('Entry deleted');

    try {
      const res = await apiFetch(`/api/logs/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        setLogs(backupState);
        showToast('Failed to delete entry');
      } else {
        fetchLogs(selectedDate);
      }
    } catch {
      setLogs(backupState);
      showToast('Connection failed, deletion reverted');
    }
  };

  const handleClearSlot = async (slotKey) => {
    const backupState = [...logs];
    setLogs(prev => prev.filter(l => l.mealSlot !== slotKey));
    playHapticSound('click');
    showToast(`${slotKey.replace('_', ' ')} cleared`);

    try {
      const res = await apiFetch(`/api/logs?date=${selectedDate}&mealSlot=${slotKey}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        setLogs(backupState);
        showToast('Failed to clear slot');
      } else {
        fetchLogs(selectedDate);
      }
    } catch {
      setLogs(backupState);
      showToast('Connection failed, clear reverted');
    }
  };

  const startEdit = (log) => {
    setEditingLog(log);
    // Always use 'custom' tab when editing so finalLogValues is computed from form state fields
    setFormTab('custom');
    setFoodName(log.foodName);
    setUnit(log.unit || 'g');
    setQuantity(String(log.quantity));
    setCalories(String(Math.round(log.calories * 10) / 10));
    setProtein(String(Math.round(log.protein * 10) / 10));
    setCarbs(String(Math.round(log.carbs * 10) / 10));
    setFat(String(Math.round(log.fat * 10) / 10));
    setActiveSlot(log.mealSlot);
    // Store per-unit nutrition so quantity changes auto-recalculate macros
    const qty = log.quantity || 1;
    setEditBaseNutrition({
      caloriesPerUnit: (log.calories || 0) / qty,
      proteinPerUnit:  (log.protein  || 0) / qty,
      carbsPerUnit:    (log.carbs    || 0) / qty,
      fatPerUnit:      (log.fat      || 0) / qty,
    });
    setIsAddOpen(true);
  };

  const totals = useMemo(() => {
    return logs.reduce((sum, log) => {
      sum.calories += log.calories || 0;
      sum.protein += log.protein || 0;
      sum.carbs += log.carbs || 0;
      sum.fat += log.fat || 0;
      return sum;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [logs]);

  totals.calories = Math.round(totals.calories * 10) / 10;
  totals.protein = Math.round(totals.protein * 10) / 10;
  totals.carbs = Math.round(totals.carbs * 10) / 10;
  totals.fat = Math.round(totals.fat * 10) / 10;

  const targetsRemaining = useMemo(() => {
    if (!user) return { calories: 0, protein: 0 };
    return {
      calories: Math.max(0, Math.round((user.dailyCalorieTarget - totals.calories) * 10) / 10),
      protein: Math.max(0, Math.round((user.dailyProteinTarget - totals.protein) * 10) / 10)
    };
  }, [totals, user]);

  const formattedHeaderDate = useMemo(() => {
    const parts = selectedDate.split('-');
    if (parts.length !== 3) return selectedDate;
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  }, [selectedDate]);

  const modalVariants = {
    hidden: isMobile ? { y: "100%", opacity: 1 } : { scale: 0.94, opacity: 0 },
    visible: isMobile 
      ? { y: 0, opacity: 1, transition: { type: "spring", damping: 30, stiffness: 340 } }
      : { scale: 1, opacity: 1, transition: { type: "spring", damping: 28, stiffness: 340 } },
    exit: isMobile
      ? { y: "100%", opacity: 1, transition: { duration: 0.2 } }
      : { scale: 0.94, opacity: 0, transition: { duration: 0.18 } }
  };

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="h-6 w-6 text-white animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-550 font-mono animate-pulse">Initializing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ambient-mesh mesh-bg selection:bg-white selection:text-black font-sans pb-16 relative overflow-x-hidden">
      
      {/* Mouse Cursor Spotlight & Ambient Particles */}
      <CursorSpotlight />
      <FloatingParticles />

      {/* Floating Action Button (FAB) */}
      {user && (
        <FloatingActionButton 
          onClick={() => {
            setActiveSlot('breakfast');
            setIsAddOpen(true);
          }} 
        />
      )}

      {/* Stacked Toasts Container */}
      <div className="fixed bottom-6 right-6 z-55 flex flex-col gap-3 pointer-events-none select-none max-w-sm">
        <AnimatePresence>
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>

      {/* Header and Tab navigation */}
      {user && <Navigation user={user} location={location} />}

      {/* Background scaling and depth layer when a modal sheet is active */}
      <motion.div
        animate={isAddOpen ? { scale: 0.985, filter: "brightness(0.6) blur(2px)" } : { scale: 1, filter: "brightness(1) blur(0px)" }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="w-full relative z-10"
      >
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>

            {/* Welcome / Landing Screen */}
            <Route path="/welcome" element={
              !user ? (
                <PageTransition>
                  <WelcomePage />
                </PageTransition>
              ) : (
                <Navigate to="/" replace />
              )
            } />

            {/* Auth Gateways */}
            <Route path="/login" element={
              !user ? (
                <PageTransition>
                  <LoginPage 
                    authSubView={authSubView}
                    setAuthSubView={setAuthSubView}
                    logEmail={logEmail}
                    setLogEmail={setLogEmail}
                    logPassword={logPassword}
                    setLogPassword={setLogPassword}
                    handleLogin={handleLogin}
                    forgotEmail={forgotEmail}
                    setForgotEmail={setForgotEmail}
                    handleSendOtp={handleSendOtp}
                    handleResendOtp={handleResendOtp}
                    handleVerifyOtp={handleVerifyOtp}
                    handleResetPasswordWithOtp={handleResetPasswordWithOtp}
                    otpDigits={otpDigits}
                    setOtpDigits={setOtpDigits}
                    otpCountdown={otpCountdown}
                    otpRefs={otpRefs}
                    otpSending={otpSending}
                    resetPasswordVal={resetPasswordVal}
                    setResetPasswordVal={setResetPasswordVal}
                    confirmPasswordVal={confirmPasswordVal}
                    setConfirmPasswordVal={setConfirmPasswordVal}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    resetPasswordStrength={resetPasswordStrength}
                    authShake={authShake}
                  />
                </PageTransition>
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/register" element={
              !user ? (
                <PageTransition>
                  <RegisterPage 
                    regName={regName}
                    setRegName={setRegName}
                    regEmail={regEmail}
                    setRegEmail={setRegEmail}
                    regPassword={regPassword}
                    setRegPassword={setRegPassword}
                    regPasswordStrength={regPasswordStrength}
                    regHeight={regHeight}
                    setRegHeight={setRegHeight}
                    regWeight={regWeight}
                    setRegWeight={setRegWeight}
                    regAge={regAge}
                    setRegAge={setRegAge}
                    regGender={regGender}
                    setRegGender={setRegGender}
                    regGoal={regGoal}
                    setRegGoal={setRegGoal}
                    regActivity={regActivity}
                    setRegActivity={setRegActivity}
                    handleRegister={handleRegister}
                    authShake={authShake}
                  />
                </PageTransition>
              ) : (
                <Navigate to="/" replace />
              )
            } />

            {/* Dashboard / Overview Page */}
            <Route path="/" element={
              user ? (
                <PageTransition>
                  <DashboardPage 
                    user={user}
                    totals={totals}
                    targetsRemaining={targetsRemaining}
                    logs={logs}
                    MEAL_SLOTS={MEAL_SLOTS}
                    selectedDate={selectedDate}
                  />
                </PageTransition>
              ) : (
                <Navigate to="/welcome" replace />
              )
            } />

            {/* Daily Logging Page */}
            <Route path="/log" element={<Navigate to={`/log/${selectedDate}`} replace />} />
            <Route path="/log/:date" element={
              user ? (
                <PageTransition>
                  <LogPage 
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    logs={logs}
                    logsLoading={logsLoading}
                    MEAL_SLOTS={MEAL_SLOTS}
                    handleClearSlot={handleClearSlot}
                    setActiveSlot={setActiveSlot}
                    setIsAddOpen={setIsAddOpen}
                    startEdit={startEdit}
                    handleDeleteLog={handleDeleteLog}
                    formattedHeaderDate={formattedHeaderDate}
                  />
                </PageTransition>
              ) : (
                <Navigate to="/welcome" replace />
              )
            } />

            {/* History Trends Page */}
            <Route path="/history" element={
              user ? (
                <PageTransition>
                  <HistoryPage user={user} />
                </PageTransition>
              ) : (
                <Navigate to="/welcome" replace />
              )
            } />

            {/* Profile Settings Page */}
            <Route path="/profile" element={
              user ? (
                <PageTransition>
                  <ProfilePage 
                    user={user}
                    setUser={setUser}
                    handleLogout={handleLogout}
                    showToast={showToast}
                  />
                </PageTransition>
              ) : (
                <Navigate to="/welcome" replace />
              )
            } />

            {/* Default redirect to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </AnimatePresence>
      </motion.div>

      {/* Add / Edit Food Modal Sheet (Universal layout overlay) */}
      <AnimatePresence>
        {isAddOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
          >
            <motion.div 
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full sm:max-w-md bg-neutral-950 border-t sm:border border-neutral-800 rounded-t-[24px] sm:rounded-[24px] p-6 relative shadow-2xl transition-premium max-h-[92vh] overflow-y-auto pb-10 sm:pb-6"
            >
              
              <button 
                onClick={() => {
                  playHapticSound('click');
                  setIsAddOpen(false);
                  resetForm();
                }}
                className="absolute right-4 top-4 text-neutral-500 hover:text-white p-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
              
              <h3 className="text-xs font-bold uppercase tracking-wider mb-6 font-sans">
                {editingLog ? 'Edit food entry' : `Add item to ${activeSlot?.replace('_', ' ')}`}
              </h3>

              {!editingLog && (
                <div className="flex border-b border-zinc-900 mb-6 font-sans p-1 bg-black rounded-[14px]">
                  <button 
                    type="button"
                    onClick={() => { playHapticSound('click'); setFormTab('database'); }}
                    className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold transition-colors rounded-[12px] ${
                      formTab === 'database' 
                        ? 'bg-zinc-900 text-white shadow-sm' 
                        : 'text-zinc-550 hover:text-zinc-400'
                    }`}
                  >
                    Database Search
                  </button>
                  <button 
                    type="button"
                    onClick={() => { playHapticSound('click'); setFormTab('custom'); }}
                    className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold transition-colors rounded-[12px] ${
                      formTab === 'custom' 
                        ? 'bg-zinc-900 text-white shadow-sm' 
                        : 'text-zinc-550 hover:text-zinc-400'
                    }`}
                  >
                    Custom Entry
                  </button>
                </div>
              )}

              <form onSubmit={editingLog ? handleEditLog : handleAddLog} className="space-y-4 font-sans">
                {formTab === 'database' && !editingLog && (
                  <div className="space-y-4">
                    <PremiumInput 
                      label="Search database"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for foods (e.g. egg, banana, rice)..."
                      autoFocus
                      aria-label="Search food database"
                      icon={Search}
                    />

                    {(foodSearchResults.foods.length > 0 || foodSearchResults.live.length > 0) && (
                      <div className="max-h-48 overflow-y-auto border border-zinc-900 divide-y divide-zinc-950 bg-black rounded-[14px] p-1">
                        {foodSearchResults.foods.map(food => {
                          const isEst = food.dataQuality === 'COMPOSITE_ESTIMATED';
                          const qualityLabel = isEst ? 'Est' : (food.sourceType || 'DB');
                          const displayNameVal = food.displayName || food.name;
                          return (
                            <button
                              key={`db-${food.id}`}
                              type="button"
                              onClick={() => selectDatabaseFood(food)}
                              className={`w-full text-left px-3 py-3 text-xs font-mono transition-colors flex justify-between items-center gap-2 rounded-[10px] ${
                                selectedFood?.id === food.id ? 'bg-white text-black font-bold' : 'hover:bg-zinc-900 text-white'
                              }`}
                            >
                              <div className="flex flex-col min-w-0 font-sans">
                                <div className="flex items-center gap-2 uppercase truncate text-[11px]">
                                  <span className={`text-[8px] border px-1.5 py-0.5 shrink-0 font-bold rounded-[6px] ${
                                    selectedFood?.id === food.id ? 'border-black text-black' : 'border-zinc-800 text-zinc-500'
                                  }`}>
                                    {qualityLabel}
                                  </span>
                                  {food.cuisineRegion && (
                                    <span className={`text-[8px] tracking-wide shrink-0 ${
                                      selectedFood?.id === food.id ? 'text-black font-normal' : 'text-zinc-650'
                                    }`}>
                                      [{food.cuisineRegion.toUpperCase()}]
                                    </span>
                                  )}
                                  <span className="truncate normal-case">{displayNameVal}</span>
                                </div>
                              </div>
                              <span className="opacity-60 shrink-0 text-right text-[10px]">
                                {Math.round(food.calories * 10) / 10} kcal · {Math.round(food.protein * 10) / 10}g P
                              </span>
                            </button>
                          );
                        })}
                        
                        {foodSearchResults.live.map((food, idx) => {
                          const displayNameVal = food.displayName || food.name;
                          return (
                            <button
                              key={`live-${food.sourceId}-${idx}`}
                              type="button"
                              onClick={() => selectDatabaseFood(food)}
                              className={`w-full text-left px-3 py-3 text-xs font-mono transition-colors flex justify-between items-center gap-2 rounded-[10px] ${
                                selectedFood?.sourceId === food.sourceId ? 'bg-white text-black font-bold' : 'hover:bg-zinc-900 text-white'
                              }`}
                            >
                              <div className="flex flex-col min-w-0 font-sans">
                                <div className="flex items-center gap-2 uppercase truncate text-[11px]">
                                  <span className={`text-[8px] border px-1.5 py-0.5 shrink-0 font-bold rounded-[6px] ${
                                    selectedFood?.sourceId === food.sourceId ? 'border-black text-black' : 'border-zinc-800 text-zinc-500'
                                  }`}>
                                    Live
                                  </span>
                                  <span className="truncate normal-case">{displayNameVal}</span>
                                </div>
                              </div>
                              <span className="opacity-60 shrink-0 text-right text-[10px]">
                                {Math.round(food.calories * 10) / 10} kcal · {Math.round(food.protein * 10) / 10}g P
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {!foodSearchLoading && searchQuery.length >= 2 && 
                     foodSearchResults.foods.length === 0 && foodSearchResults.live.length === 0 && (
                      <p className="text-[10px] text-zinc-650 uppercase tracking-wider font-sans leading-relaxed">
                        No matches found. Switch to Custom Entry to add this item manually.
                      </p>
                    )}

                    {selectedFood && (
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <PremiumInput 
                              label="Quantity"
                              type="number"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              placeholder="e.g. 1"
                              required
                            />
                          </div>
                          
                          <div className="w-32">
                            {getValidUnits(selectedFood).length > 1 ? (
                              <CustomSelect 
                                label="Unit"
                                value={unit}
                                onChange={setUnit}
                                options={getValidUnits(selectedFood).map((u) => ({ value: u, label: u }))}
                              />
                            ) : (
                              <div>
                                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-2 font-sans font-bold select-none">Unit</label>
                                <div className="px-4 py-2.5 bg-black border border-zinc-900 text-xs text-zinc-400 min-w-[70px] text-center select-none min-h-[42px] flex items-center justify-center rounded-[14px]">
                                  {unit}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-[10px] text-zinc-600 font-sans leading-relaxed">
                          {unit === 'piece' && `1 piece ≈ ${selectedFood.pieceWeight || 50}g.`}
                          {unit === 'cup' && '1 cup ≈ 200g cooked.'}
                          {unit === 'bowl' && '1 bowl ≈ 150g cooked.'}
                          {unit === 'g' && 'Weighed in grams.'}
                          {unit === 'ml' && 'Volume measured in ml.'}
                        </p>
                      </div>
                    )}

                  </div>
                )}

                {formTab === 'custom' && (
                  <div className="space-y-4">
                    {/* Food name — editable only in add mode; read-only when editing */}
                    <PremiumInput
                      label="Food Name"
                      type="text"
                      value={foodName}
                      onChange={(e) => setFoodName(e.target.value)}
                      placeholder="e.g. Roasted Chickpeas"
                      required
                      readOnly={!!editingLog}
                      className={editingLog ? 'opacity-60 cursor-default' : ''}
                    />

                    {/* Quantity + Unit row */}
                    <div className="grid grid-cols-2 gap-4">
                      <PremiumInput
                        label="Quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="e.g. 150"
                        required
                        autoFocus={!!editingLog}
                      />
                      <PremiumInput
                        label="Unit"
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="e.g. g, ml, piece"
                        required
                        readOnly={!!editingLog}
                        className={editingLog ? 'opacity-60 cursor-default' : ''}
                      />
                    </div>

                    {/* Nutrition section — smart auto-calc when editing, manual when adding */}
                    {editingLog ? (
                      <div className="space-y-3">
                        {/* Auto-calculated read-only display */}
                        {finalLogValues && (
                          <div className="rounded-[16px] border border-zinc-800 bg-zinc-950 overflow-hidden">
                            <div className="px-4 pt-3 pb-1">
                              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold font-sans">Calculated Nutrition</p>
                            </div>
                            <div className="grid grid-cols-4 divide-x divide-zinc-900">
                              {[
                                { label: 'Calories', value: Math.round(finalLogValues.calories), unit: 'kcal' },
                                { label: 'Protein',  value: (Math.round((finalLogValues.protein || 0) * 10) / 10).toFixed(1), unit: 'g' },
                                { label: 'Carbs',    value: (Math.round((finalLogValues.carbs   || 0) * 10) / 10).toFixed(1), unit: 'g' },
                                { label: 'Fat',      value: (Math.round((finalLogValues.fat     || 0) * 10) / 10).toFixed(1), unit: 'g' },
                              ].map((n) => (
                                <div key={n.label} className="flex flex-col items-center justify-center py-3 px-1">
                                  <span className="text-base font-bold text-white font-sans leading-none">{n.value}</span>
                                  <span className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1 font-sans">{n.unit}</span>
                                  <span className="text-[9px] text-zinc-700 uppercase tracking-wider font-sans">{n.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Add mode — full manual entry */
                      <div className="grid grid-cols-4 gap-2">
                        <PremiumInput label="Calories" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="kcal" required />
                        <PremiumInput label="Protein"  type="number" value={protein}  onChange={(e) => setProtein(e.target.value)}  placeholder="g"    required />
                        <PremiumInput label="Carbs"    type="number" value={carbs}    onChange={(e) => setCarbs(e.target.value)}    placeholder="g"    required />
                        <PremiumInput label="Fat"      type="number" value={fat}      onChange={(e) => setFat(e.target.value)}      placeholder="g"    required />
                      </div>
                    )}

                    {/* Meal slot selector — only shown when editing an existing entry */}
                    {editingLog && (
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-2 font-sans font-bold select-none">Meal Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {MEAL_SLOTS.map((slot) => (
                            <button
                              key={slot.key}
                              type="button"
                              onClick={() => { playHapticSound('click'); setActiveSlot(slot.key); }}
                              className={`py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide rounded-[12px] border transition-colors select-none ${
                                activeSlot === slot.key
                                  ? 'bg-white text-black border-white'
                                  : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                              }`}
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {finalLogValues && finalLogValues.quantity > 0 && (
                  <div className="border border-zinc-900 p-4 bg-zinc-950 text-xs text-zinc-400 space-y-1.5 font-sans leading-relaxed rounded-[14px]">
                    <div>Preview entry:</div>
                    <div className="text-white font-bold">{finalLogValues.foodName}</div>
                    <div>Quantity: {finalLogValues.quantity} {finalLogValues.unit} {finalLogValues.gramEquivalent && finalLogValues.unit !== 'g' ? `(${finalLogValues.gramEquivalent}g equivalent)` : ''}</div>
                    <div className="font-mono text-[11px] text-zinc-500">
                      {Math.round(finalLogValues.calories * 10) / 10} kcal | {Math.round(finalLogValues.protein * 10) / 10}g protein | {Math.round(finalLogValues.carbs * 10) / 10}g carbs | {Math.round(finalLogValues.fat * 10) / 10}g fat
                    </div>
                  </div>
                )}

                <PremiumButton type="submit" className="w-full">
                  {editingLog ? 'Save changes' : 'Add to log'}
                </PremiumButton>
              </form>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-900 rounded-[24px] p-8 space-y-4 shadow-2xl">
            <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Application Error</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              An unexpected error occurred during rendering.
            </p>
            {this.state.error?.message && (
              <div className="text-[11px] font-mono text-zinc-500 bg-zinc-900/50 p-3 rounded-[12px] border border-zinc-850 truncate max-w-full text-left">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white text-black font-bold text-xs rounded-[14px] hover:bg-zinc-200 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig transition={SPRINGS.card}>
        <Router>
          <AppContent />
        </Router>
      </MotionConfig>
    </ErrorBoundary>
  );
}
