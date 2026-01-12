# JAIL VISITOR MANAGEMENT SYSTEM - UI/UX Design Integration Prompt

## Use this prompt to integrate the visual design system, themes, typography, layout patterns, and animations into another Lovable project.

---

## 🎨 DESIGN PHILOSOPHY

A **professional, secure, and authoritative** visual identity for a jail visitor management system. The design balances government-grade professionalism with modern usability.

**Key Principles:**
- Dark theme default for low-light security environments
- Gold accent colors for authority and premium feel
- Glass morphism for modern depth
- Uppercase text for official/government aesthetic
- Smooth animations for professional polish

---

## 🎭 THEME SYSTEM

### Theme Structure (3 Themes)

Add to `src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* ============ DARK THEME (Default) ============ */
  :root,
  .dark {
    --background: 222 47% 6%;           /* #0d1117 - Deep navy black */
    --foreground: 210 40% 96%;          /* #f0f4f8 - Off-white */

    --card: 222 47% 8%;                 /* #111827 - Slightly lighter */
    --card-foreground: 210 40% 96%;

    --popover: 222 47% 10%;
    --popover-foreground: 210 40% 96%;

    --primary: 45 93% 58%;              /* #f4c430 - Gold */
    --primary-foreground: 222 47% 6%;

    --secondary: 217 33% 17%;           /* #1e293b - Slate */
    --secondary-foreground: 210 40% 96%;

    --muted: 217 33% 14%;               /* #172033 */
    --muted-foreground: 215 20% 55%;

    --accent: 217 33% 20%;              /* #253550 */
    --accent-foreground: 210 40% 96%;

    --destructive: 0 72% 51%;           /* #dc2626 - Red */
    --destructive-foreground: 210 40% 98%;

    --success: 142 76% 36%;             /* #16a34a - Green */
    --success-foreground: 210 40% 98%;

    --warning: 38 92% 50%;              /* #f59e0b - Amber */
    --warning-foreground: 222 47% 6%;

    --info: 199 89% 48%;                /* #0ea5e9 - Sky blue */
    --info-foreground: 210 40% 98%;

    --border: 217 33% 20%;
    --input: 217 33% 17%;
    --ring: 45 93% 58%;

    --radius: 0.75rem;

    /* Sidebar specific */
    --sidebar-background: 222 47% 5%;
    --sidebar-foreground: 210 40% 96%;
    --sidebar-primary: 45 93% 58%;
    --sidebar-primary-foreground: 222 47% 6%;
    --sidebar-accent: 217 33% 12%;
    --sidebar-accent-foreground: 210 40% 96%;
    --sidebar-border: 217 33% 15%;
    --sidebar-ring: 45 93% 58%;

    /* Custom shadows */
    --gold-glow: 0 0 20px hsl(45 93% 58% / 0.3);
    --card-glow: 0 4px 20px hsl(222 47% 0% / 0.5);
  }

  /* ============ ROYAL THEME (Premium) ============ */
  .royal {
    --background: 240 15% 6%;           /* Deep purple-black */
    --foreground: 0 0% 95%;

    --card: 240 15% 9%;
    --card-foreground: 0 0% 95%;

    --popover: 240 15% 11%;
    --popover-foreground: 0 0% 95%;

    --primary: 45 100% 50%;             /* Bright gold */
    --primary-foreground: 240 15% 6%;

    --secondary: 240 15% 16%;
    --secondary-foreground: 0 0% 95%;

    --muted: 240 15% 13%;
    --muted-foreground: 240 10% 55%;

    --accent: 280 60% 45%;              /* Purple accent */
    --accent-foreground: 0 0% 100%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;

    --success: 142 76% 36%;
    --success-foreground: 0 0% 98%;

    --warning: 38 92% 50%;
    --warning-foreground: 240 15% 6%;

    --info: 220 20% 70%;                /* Silver */
    --info-foreground: 240 15% 10%;

    --border: 45 30% 20%;
    --input: 240 15% 16%;
    --ring: 45 100% 50%;

    --sidebar-background: 240 15% 5%;
    --sidebar-foreground: 0 0% 95%;
    --sidebar-primary: 45 100% 50%;
    --sidebar-primary-foreground: 240 15% 6%;
    --sidebar-accent: 280 40% 25%;
    --sidebar-accent-foreground: 0 0% 95%;
    --sidebar-border: 45 20% 18%;
    --sidebar-ring: 45 100% 50%;

    --gold-glow: 0 0 25px hsl(45 100% 50% / 0.35);
    --card-glow: 0 4px 20px hsl(280 60% 30% / 0.2);
  }

  /* ============ LIGHT THEME (Government) ============ */
  .light {
    --background: 210 40% 98%;          /* Off-white */
    --foreground: 217 50% 15%;          /* Dark navy */

    --card: 0 0% 100%;
    --card-foreground: 217 50% 15%;

    --popover: 0 0% 100%;
    --popover-foreground: 217 50% 15%;

    --primary: 217 80% 35%;             /* Navy blue */
    --primary-foreground: 0 0% 100%;

    --secondary: 210 40% 94%;
    --secondary-foreground: 217 50% 15%;

    --muted: 210 40% 90%;
    --muted-foreground: 217 30% 40%;

    --accent: 217 70% 92%;
    --accent-foreground: 217 50% 15%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;

    --success: 142 76% 36%;
    --success-foreground: 0 0% 98%;

    --warning: 38 92% 50%;
    --warning-foreground: 217 50% 15%;

    --info: 199 89% 48%;
    --info-foreground: 0 0% 98%;

    --border: 217 30% 80%;
    --input: 217 30% 90%;
    --ring: 217 80% 35%;

    --sidebar-background: 217 80% 25%;  /* Dark navy sidebar */
    --sidebar-foreground: 0 0% 100%;
    --sidebar-primary: 0 0% 100%;
    --sidebar-primary-foreground: 217 80% 25%;
    --sidebar-accent: 217 70% 35%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 217 60% 40%;
    --sidebar-ring: 0 0% 100%;

    --gold-glow: 0 0 20px hsl(217 80% 35% / 0.2);
    --card-glow: 0 4px 15px hsl(217 50% 15% / 0.08);
  }
}
```

---

## 📝 TYPOGRAPHY

### Font Families

```css
/* Primary: DM Sans - Modern, professional sans-serif */
font-family: 'DM Sans', system-ui, sans-serif;

/* Monospace: JetBrains Mono - For codes, IDs, timestamps */
font-family: 'JetBrains Mono', monospace;
```

### Tailwind Config

```typescript
// tailwind.config.ts
fontFamily: {
  sans: ['DM Sans', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
},
```

### Type Scale Usage

| Size | Class | Usage |
|------|-------|-------|
| 12px | `text-xs` | Labels, badges, timestamps |
| 14px | `text-sm` | Body small, table cells |
| 16px | `text-base` | Body text |
| 18px | `text-lg` | Subheadings |
| 20px | `text-xl` | Card titles |
| 24px | `text-2xl` | Section headers |
| 30px | `text-3xl` | Page titles |

### Font Weights

| Weight | Usage |
|--------|-------|
| 400 | Body text |
| 500 | Labels, buttons |
| 600 | Subheadings |
| 700 | Headings, emphasis |

---

## 🧩 COMPONENT STYLES

Add to `src/index.css` in `@layer components`:

```css
@layer components {
  /* Glass Card - Primary card style */
  .glass-card {
    @apply bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg;
  }

  /* Gold Gradient - For CTAs and emphasis */
  .gold-gradient {
    @apply bg-gradient-to-r from-primary via-yellow-400 to-primary;
  }

  /* Gold Text - Gradient text effect */
  .gold-text {
    @apply text-transparent bg-clip-text bg-gradient-to-r from-primary via-yellow-300 to-primary;
  }

  /* Status Badges */
  .status-pending {
    @apply bg-warning/20 text-warning border border-warning/30;
  }

  .status-approved {
    @apply bg-success/20 text-success border border-success/30;
  }

  .status-rejected {
    @apply bg-destructive/20 text-destructive border border-destructive/30;
  }

  .status-active {
    @apply bg-info/20 text-info border border-info/30;
  }

  .status-detained {
    @apply bg-muted/50 text-muted-foreground border border-muted-foreground/30;
  }

  /* Navigation Links */
  .nav-link {
    @apply flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground 
           transition-all duration-200 hover:bg-accent hover:text-foreground;
  }

  .nav-link.active {
    @apply bg-primary/10 text-primary border-l-2 border-primary;
  }

  /* Scanner Frame */
  .scanner-frame {
    @apply relative border-4 border-primary rounded-2xl overflow-hidden;
    box-shadow: var(--gold-glow);
  }

  /* Data Table */
  .data-table {
    @apply w-full text-sm;
  }

  .data-table th {
    @apply px-4 py-3 text-left text-xs font-semibold text-muted-foreground 
           uppercase tracking-wider bg-muted/30;
  }

  .data-table td {
    @apply px-4 py-4 border-t border-border/50;
  }

  .data-table tr:hover td {
    @apply bg-accent/30;
  }

  /* Stat Card */
  .stat-card {
    @apply glass-card rounded-xl p-6 transition-all duration-200;
  }

  .stat-card:hover {
    @apply border-primary/30;
    box-shadow: var(--gold-glow);
  }

  /* Input Field */
  .input-field {
    @apply bg-muted/50 border-border/50 focus:border-primary 
           focus:ring-1 focus:ring-primary/50 transition-all duration-200;
  }

  /* Scanner Button */
  .btn-scanner {
    @apply bg-gradient-to-r from-primary to-yellow-500 text-primary-foreground 
           font-semibold shadow-lg transition-all duration-200;
  }

  .btn-scanner:hover {
    @apply shadow-xl;
    box-shadow: var(--gold-glow);
  }
}
```

---

## 🎬 ANIMATION SYSTEM

### Tailwind Keyframes & Animations

```typescript
// tailwind.config.ts
keyframes: {
  "accordion-down": {
    from: { height: "0" },
    to: { height: "var(--radix-accordion-content-height)" },
  },
  "accordion-up": {
    from: { height: "var(--radix-accordion-content-height)" },
    to: { height: "0" },
  },
  "fade-in": {
    from: { opacity: "0", transform: "translateY(8px)" },
    to: { opacity: "1", transform: "translateY(0)" },
  },
  "fade-out": {
    from: { opacity: "1", transform: "translateY(0)" },
    to: { opacity: "0", transform: "translateY(8px)" },
  },
  "slide-in-left": {
    from: { opacity: "0", transform: "translateX(-16px)" },
    to: { opacity: "1", transform: "translateX(0)" },
  },
  "slide-in-right": {
    from: { opacity: "0", transform: "translateX(16px)" },
    to: { opacity: "1", transform: "translateX(0)" },
  },
  "scale-in": {
    from: { opacity: "0", transform: "scale(0.96)" },
    to: { opacity: "1", transform: "scale(1)" },
  },
  "scale-out": {
    from: { opacity: "1", transform: "scale(1)" },
    to: { opacity: "0", transform: "scale(0.96)" },
  },
  "shimmer": {
    "0%": { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" },
  },
  "check-bounce": {
    "0%": { transform: "scale(0)" },
    "50%": { transform: "scale(1.2)" },
    "100%": { transform: "scale(1)" },
  },
  "card-hover": {
    "0%": { transform: "translateY(0)" },
    "100%": { transform: "translateY(-2px)" },
  },
},
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
  "fade-in": "fade-in 0.25s ease-out",
  "fade-out": "fade-out 0.2s ease-out",
  "slide-in-left": "slide-in-left 0.25s ease-out",
  "slide-in-right": "slide-in-right 0.25s ease-out",
  "scale-in": "scale-in 0.2s ease-out",
  "scale-out": "scale-out 0.15s ease-out",
  "shimmer": "shimmer 2s linear infinite",
  "check-bounce": "check-bounce 0.3s ease-out",
  "card-hover": "card-hover 0.15s ease-out forwards",
},
```

### Custom Utility Animations

```css
@layer utilities {
  .animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .animate-glow {
    animation: glow 2s ease-in-out infinite alternate;
  }

  @keyframes glow {
    from { box-shadow: 0 0 10px hsl(45 93% 58% / 0.3); }
    to { box-shadow: 0 0 25px hsl(45 93% 58% / 0.5); }
  }
}
```

### Framer Motion Patterns

```tsx
// Page transitions
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.3 }}
>

// Stagger children
<motion.div
  variants={{
    hidden: { opacity: 0 },
    show: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }}
  initial="hidden"
  animate="show"
>

// Hover effects
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>

// Scanner line animation
<motion.div
  className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
  initial={{ top: '20%' }}
  animate={{ top: ['20%', '80%', '20%'] }}
  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
/>

// Success checkmark bounce
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ type: 'spring', stiffness: 200 }}
>
```

---

## 📐 LAYOUT PATTERNS

### Page Structure

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="space-y-6"
>
  {/* Header */}
  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div>
      <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
        <Icon className="w-8 h-8 text-primary" />
        PAGE TITLE
      </h1>
      <p className="text-muted-foreground mt-1">
        Page description
      </p>
    </div>
    <div className="flex gap-2">
      {/* Action buttons */}
    </div>
  </div>

  {/* Stats Grid */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <Card className="stat-card">...</Card>
  </div>

  {/* Main Content */}
  <Card className="glass-card">
    <CardContent>...</CardContent>
  </Card>
</motion.div>
```

### Responsive Grid

```tsx
// 1-2-3 column responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Sidebar + Main
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">Main</div>
  <div>Sidebar</div>
</div>
```

### Stat Card Pattern

```tsx
<Card className="stat-card">
  <CardContent className="p-4 flex items-center gap-4">
    <div className="p-3 rounded-xl bg-warning/10">
      <Clock className="w-6 h-6 text-warning" />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{count}</p>
      <p className="text-sm text-muted-foreground uppercase">LABEL</p>
    </div>
  </CardContent>
</Card>
```

---

## 🎯 SPACING SYSTEM

Based on 4px grid:

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` | 4px | Tight inline spacing |
| `gap-2` | 8px | Related elements |
| `gap-3` | 12px | Form fields |
| `gap-4` | 16px | Card padding |
| `gap-6` | 24px | Section spacing |
| `gap-8` | 32px | Component groups |

---

## 🔲 BORDER RADIUS

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Small elements |
| `rounded-md` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards (default) |
| `rounded-xl` | 12px | Modals, panels |
| `rounded-2xl` | 16px | Feature cards, scanner |
| `rounded-full` | 50% | Avatars, badges |

---

## 📱 RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1400px | Wide screens |

---

## 📜 SCROLLBAR STYLING

```css
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: hsl(217 33% 20%) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: hsl(217 33% 25%);
  border-radius: 3px;
}
```

---

## 🎨 COLOR SEMANTIC USAGE

### Status Colors

| Status | Background | Border | Text |
|--------|------------|--------|------|
| Pending | `warning/20` | `warning/30` | `warning` |
| Approved | `success/20` | `success/30` | `success` |
| Rejected | `destructive/20` | `destructive/30` | `destructive` |
| Active | `info/20` | `info/30` | `info` |

### Icon Colors

| Context | Color |
|---------|-------|
| Primary actions | `text-primary` |
| Success/Complete | `text-success` |
| Warning/Pending | `text-warning` |
| Error/Danger | `text-destructive` |
| Info/Neutral | `text-info` |
| Muted/Disabled | `text-muted-foreground` |

---

## ♿ ACCESSIBILITY

- All interactive elements have visible focus states (`focus:ring-1 focus:ring-primary/50`)
- Color contrast meets WCAG 2.1 AA standards
- Motion respects `prefers-reduced-motion`
- Form inputs have associated labels
- Error states include both color and icons

---

## 📦 REQUIRED DEPENDENCIES

```json
{
  "framer-motion": "^12.x",
  "lucide-react": "^0.462.0",
  "tailwindcss-animate": "^1.0.7",
  "@radix-ui/react-*": "latest"
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

- [ ] Add Google Fonts import for DM Sans and JetBrains Mono
- [ ] Configure theme CSS variables in index.css
- [ ] Set up Tailwind config with custom colors, animations, fonts
- [ ] Create ThemeContext for theme switching
- [ ] Add component utility classes (glass-card, status badges, etc.)
- [ ] Configure scrollbar styling
- [ ] Add Framer Motion for page transitions
- [ ] Test all three themes (dark, royal, light)
