# WATCHGUARD UI/UX Design System

## Design Philosophy
A **professional, secure, and authoritative** visual identity for a jail visitor management system. The design balances government-grade professionalism with modern usability.

---

## 🎨 Themes

### 1. Dark Theme (Default)
**Use Case:** Low-light environments, security monitoring stations

| Token | HSL Value | Hex Approximation | Usage |
|-------|-----------|-------------------|-------|
| `--background` | `222 47% 6%` | #0d1117 | Main background |
| `--foreground` | `210 40% 96%` | #f0f4f8 | Primary text |
| `--card` | `222 47% 8%` | #111827 | Card backgrounds |
| `--primary` | `45 93% 58%` | #f4c430 | Gold accents, CTAs |
| `--secondary` | `217 33% 17%` | #1e293b | Secondary surfaces |
| `--muted` | `217 33% 14%` | #172033 | Muted backgrounds |
| `--accent` | `217 33% 20%` | #253550 | Hover states |
| `--destructive` | `0 72% 51%` | #dc2626 | Errors, danger |
| `--success` | `142 76% 36%` | #16a34a | Success states |
| `--warning` | `38 92% 50%` | #f59e0b | Warnings |
| `--info` | `199 89% 48%` | #0ea5e9 | Information |

### 2. Light Theme (Government)
**Use Case:** Official documents, daytime use, accessibility compliance

| Token | HSL Value | Hex Approximation | Usage |
|-------|-----------|-------------------|-------|
| `--background` | `210 40% 98%` | #f8fafc | Main background |
| `--foreground` | `217 50% 15%` | #1e3a5f | Primary text |
| `--primary` | `217 80% 35%` | #1e40af | Navy blue accent |
| `--card` | `0 0% 100%` | #ffffff | Card backgrounds |
| `--sidebar-background` | `217 80% 25%` | #1e3a8a | Dark navy sidebar |

### 3. Royal Theme (Premium)
**Use Case:** Executive dashboards, VIP areas

| Token | HSL Value | Hex Approximation | Usage |
|-------|-----------|-------------------|-------|
| `--background` | `240 15% 6%` | #0f0f14 | Deep purple-black |
| `--primary` | `45 100% 50%` | #ffc107 | Bright gold |
| `--accent` | `280 60% 45%` | #9333ea | Purple accent |
| `--info` | `220 20% 70%` | #a8b3c4 | Silver info |

---

## 📝 Typography

### Font Families
```css
--font-sans: 'DM Sans', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### Font Weights
| Weight | Usage |
|--------|-------|
| 400 | Body text |
| 500 | Labels, buttons |
| 600 | Subheadings |
| 700 | Headings, emphasis |

### Type Scale
| Class | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 12px | 16px | Labels, badges |
| `text-sm` | 14px | 20px | Body small |
| `text-base` | 16px | 24px | Body |
| `text-lg` | 18px | 28px | Subheadings |
| `text-xl` | 20px | 28px | Card titles |
| `text-2xl` | 24px | 32px | Section headers |
| `text-3xl` | 30px | 36px | Page titles |
| `text-4xl` | 36px | 40px | Hero text |

---

## 🎭 Animation System

### Keyframe Animations
```typescript
// tailwind.config.ts keyframes
"fade-in": { from: opacity 0, translateY 8px → to: opacity 1, translateY 0 }
"fade-out": { reverse of fade-in }
"slide-in-left": { from: translateX -16px → to: translateX 0 }
"slide-in-right": { from: translateX 16px → to: translateX 0 }
"scale-in": { from: scale 0.96 → to: scale 1 }
"scale-out": { from: scale 1 → to: scale 0.96 }
"shimmer": { backgroundPosition -200% → 200% }
"check-bounce": { scale 0 → 1.2 → 1 }
"card-hover": { translateY 0 → -2px }
```

### Animation Classes
| Class | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `animate-fade-in` | 250ms | ease-out | Page transitions |
| `animate-slide-in-left` | 250ms | ease-out | Sidebar items |
| `animate-scale-in` | 200ms | ease-out | Modals, dialogs |
| `animate-shimmer` | 2s | linear infinite | Loading states |
| `animate-check-bounce` | 300ms | ease-out | Success checkmarks |

### Framer Motion Patterns
```tsx
// Page transitions
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -10 }}
transition={{ duration: 0.3 }}

// Stagger children
variants={{
  show: { transition: { staggerChildren: 0.1 } }
}}

// Hover effects
whileHover={{ scale: 1.02 }}
whileTap={{ scale: 0.98 }}
```

---

## 🧩 Component Patterns

### Glass Cards
```css
.glass-card {
  background: hsl(var(--card) / 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid hsl(var(--border) / 0.5);
  box-shadow: var(--card-glow);
}
```

### Status Badges
| Status | Background | Border | Text |
|--------|------------|--------|------|
| Pending | `warning/20` | `warning/30` | `warning` |
| Approved | `success/20` | `success/30` | `success` |
| Rejected | `destructive/20` | `destructive/30` | `destructive` |
| Active | `info/20` | `info/30` | `info` |

### Navigation Links
```css
.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  color: hsl(var(--muted-foreground));
  transition: all 200ms;
}

.nav-link:hover {
  background: hsl(var(--accent));
  color: hsl(var(--foreground));
}

.nav-link.active {
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  border-left: 2px solid hsl(var(--primary));
}
```

### Gold Gradients
```css
.gold-gradient {
  background: linear-gradient(to right, 
    hsl(var(--primary)), 
    hsl(45 100% 65%), 
    hsl(var(--primary))
  );
}

.gold-text {
  background: linear-gradient(to right, 
    hsl(var(--primary)), 
    hsl(45 100% 75%), 
    hsl(var(--primary))
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 📐 Spacing System

Based on 4px grid with Tailwind defaults:

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` | 4px | Tight inline spacing |
| `gap-2` | 8px | Related elements |
| `gap-3` | 12px | Form fields |
| `gap-4` | 16px | Card padding |
| `gap-6` | 24px | Section spacing |
| `gap-8` | 32px | Component groups |

---

## 🔲 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Small elements |
| `rounded-md` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards (default) |
| `rounded-xl` | 12px | Modals, panels |
| `rounded-2xl` | 16px | Feature cards |
| `rounded-full` | 50% | Avatars, badges |

---

## 🌟 Shadow System

```css
/* Card glow (dark theme) */
--card-glow: 0 4px 20px hsl(222 47% 0% / 0.5);

/* Gold glow for primary actions */
--gold-glow: 0 0 20px hsl(45 93% 58% / 0.3);

/* Elevated elements */
shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
```

---

## 📱 Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1400px | Wide screens |

---

## ♿ Accessibility

- All interactive elements have visible focus states
- Color contrast meets WCAG 2.1 AA standards
- Motion respects `prefers-reduced-motion`
- Form inputs have associated labels
- Error states include both color and icons

---

## 📁 File Structure

```
src/
├── index.css           # Theme variables, base styles
├── tailwind.config.ts  # Extended theme config
├── components/
│   └── ui/             # Shadcn components with variants
└── contexts/
    └── ThemeContext.tsx # Theme switching logic
```
