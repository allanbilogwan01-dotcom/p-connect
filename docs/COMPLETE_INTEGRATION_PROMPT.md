# JAIL VISITOR MANAGEMENT SYSTEM - Complete Integration Prompt

## 📥 Download this file and use it to integrate the full system into another Lovable project

---

# PART 1: FUNCTIONALITY INTEGRATION

## 🎯 SYSTEM OVERVIEW

Build a **Jail Visitor Management System** with the following core modules:
1. **Visitor Enrollment** - Register visitors with photo capture and biometric enrollment
2. **Kin Dalaw (PDL-Visitor Links)** - Create and approve relationships between PDLs and visitors
3. **Facial Biometrics** - Enroll and match visitor faces using face-api.js
4. **Visitation Workflow** - Time-in/time-out with multiple identification methods

---

## 📊 DATA TYPES & STRUCTURES

### Core Types (create in `src/types/index.ts`)

```typescript
// Visitor status and identification
export interface Visitor {
  id: string;
  visitor_code: string;           // 10-digit unique code for QR/manual lookup
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  contact_number: string;
  address: string;
  valid_id_type?: string;
  valid_id_number?: string;
  photo_url?: string;             // Base64 captured photo
  qr_code_path?: string;
  id_card_path?: string;
  status: 'active' | 'blacklisted' | 'inactive';
  created_at: string;
  updated_at: string;
}

// PDL (Person Deprived of Liberty)
export type PDLStatus = 'detained' | 'released' | 'transferred' | 'deceased';

export interface PDL {
  id: string;
  pdl_code: string;               // Format: PDL-YYYY-NNN
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  date_of_commit: string;
  photo_url?: string;
  crimes: CrimeEntry[];
  status: PDLStatus;
  created_at: string;
  updated_at: string;
}

export interface CrimeEntry {
  offense: string;
  case_number: string;
}

// Relationship types for Kin Dalaw
export type RelationshipType = 
  | 'spouse' | 'wife' | 'husband'
  | 'live_in_partner' | 'common_law_partner'
  | 'parent' | 'child' | 'sibling'
  | 'grandparent' | 'grandchild'
  | 'aunt_uncle' | 'cousin' | 'niece_nephew'
  | 'legal_guardian' | 'close_friend' | 'other';

export type VisitorCategory = 'immediate_family' | 'legal_guardian' | 'close_friend';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// PDL-Visitor Link (Kin Dalaw)
export interface PDLVisitorLink {
  id: string;
  pdl_id: string;
  visitor_id: string;
  relationship: RelationshipType;
  category: VisitorCategory;
  approval_status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

// Visit Sessions
export type VisitType = 'regular' | 'conjugal';
export type TimeMethod = 'face_scan' | 'qr_scan' | 'manual_id';

export interface VisitSession {
  id: string;
  visitor_id: string;
  pdl_id: string;
  pdl_visitor_link_id: string;
  visit_type: VisitType;
  time_in: string;
  time_in_method: TimeMethod;
  time_out?: string;
  time_out_method?: TimeMethod;
  operator_id: string;
  notes?: string;
  created_at: string;
}

// Biometric Data Storage
export interface BiometricData {
  id: string;
  visitor_id: string;
  embeddings: number[][];         // Array of 128-dimensional face descriptors
  quality_scores: number[];
  created_at: string;
  updated_at: string;
}

// System Settings
export interface SystemSettings {
  facility_name: string;
  immediate_family_limit: number;  // -1 for unlimited
  legal_guardian_limit: number;
  close_friend_limit: number;
  face_recognition_threshold: number;  // Default: 0.7
  face_recognition_margin: number;     // Default: 0.1
  allow_guest_enrollment: boolean;
  data_retention_days: number;
  conjugal_relationships: RelationshipType[];
}

// Relationship labels for display
export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  spouse: 'Spouse',
  wife: 'Wife',
  husband: 'Husband',
  live_in_partner: 'Live-in Partner',
  common_law_partner: 'Common Law Partner',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  grandparent: 'Grandparent',
  grandchild: 'Grandchild',
  aunt_uncle: 'Aunt/Uncle',
  cousin: 'Cousin',
  niece_nephew: 'Niece/Nephew',
  legal_guardian: 'Legal Guardian',
  close_friend: 'Close Friend',
  other: 'Other',
};

export const CONJUGAL_RELATIONSHIPS: RelationshipType[] = [
  'wife', 'husband', 'spouse', 'live_in_partner', 'common_law_partner'
];
```

---

## 🔧 FACIAL BIOMETRICS IMPLEMENTATION

### Dependencies Required
```
face-api.js ^0.22.2
```

### Face Detection Hook (`src/hooks/useFaceDetection.ts`)

```typescript
import { useState, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

export function useFaceDetection() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (loadedRef.current || isLoading) return;
    setIsLoading(true);
    
    try {
      const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
      
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      ]);
      
      loadedRef.current = true;
      setIsLoaded(true);
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const detectFace = useCallback(async (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
    if (!isLoaded) return null;

    try {
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 });
      let detection = await faceapi
        .detectSingleFace(input, options)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      // Fallback to TinyFaceDetector
      if (!detection) {
        const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.6 });
        detection = await faceapi
          .detectSingleFace(input, tinyOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();
      }
      
      return detection || null;
    } catch (err) {
      console.error('Detection error:', err);
      return null;
    }
  }, [isLoaded]);

  const getMatchScore = useCallback((distance: number): number => {
    if (distance <= 0.3) return 1.0;
    if (distance >= 0.6) return 0.0;
    return Math.max(0, 1 - (distance / 0.5));
  }, []);

  return { isLoaded, isLoading, loadModels, detectFace, getMatchScore };
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

export function arrayToDescriptor(array: number[]): Float32Array {
  return new Float32Array(array);
}
```

### Biometric Enrollment Process

1. **Capture 5 face samples** from different angles
2. **Extract 128-dimensional descriptors** for each sample
3. **Store embeddings array** in database linked to visitor_id
4. **Quality scoring** based on detection confidence

```typescript
const runEnrollmentCapture = async (visitorId: string) => {
  const detection = await detectFace(videoRef.current);
  
  if (detection) {
    const embedding = descriptorToArray(detection.descriptor);
    
    setCapturedEmbeddings(prev => {
      const newEmbeddings = [...prev, embedding];
      
      if (newEmbeddings.length >= 5) {
        // Save to database
        saveBiometric(visitorId, newEmbeddings, newEmbeddings.map(() => 0.9));
        return newEmbeddings;
      }
      
      // Continue capturing
      setTimeout(() => runEnrollmentCapture(visitorId), 500);
      return newEmbeddings;
    });
  } else {
    // Retry if no face detected
    setTimeout(() => runEnrollmentCapture(visitorId), 200);
  }
};
```

### Face Recognition Matching

```typescript
const performFaceMatch = async (liveDescriptor: Float32Array) => {
  const biometrics = getBiometrics();
  let bestMatch: { visitorId: string; score: number } | null = null;
  let secondBest = 0;
  
  for (const bio of biometrics) {
    for (const storedEmb of bio.embeddings) {
      const storedDescriptor = arrayToDescriptor(storedEmb);
      const distance = Math.sqrt(
        liveDescriptor.reduce((sum, val, i) => 
          sum + Math.pow(val - storedDescriptor[i], 2), 0
        )
      );
      const score = getMatchScore(distance);
      
      if (!bestMatch || score > bestMatch.score) {
        secondBest = bestMatch?.score || 0;
        bestMatch = { visitorId: bio.visitor_id, score };
      } else if (score > secondBest) {
        secondBest = score;
      }
    }
  }
  
  // Thresholds from settings
  const threshold = settings.face_recognition_threshold; // 0.7
  const margin = settings.face_recognition_margin;       // 0.1
  
  // Match conditions: score >= threshold AND margin between best/second >= margin
  if (bestMatch && bestMatch.score >= threshold && (bestMatch.score - secondBest) >= margin) {
    return { visitor: getVisitorById(bestMatch.visitorId), confidence: bestMatch.score };
  }
  
  return null;
};
```

---

## 👤 VISITOR ENROLLMENT WORKFLOW

### Step 1: Information Collection
- First name, middle name, last name, suffix
- Date of birth, gender
- Contact number, address
- Valid ID type and number
- **All text fields converted to UPPERCASE**

### Step 2: Photo Capture
- Access webcam using `navigator.mediaDevices.getUserMedia()`
- Capture photo to canvas, convert to base64 data URL
- Support camera selection for multiple devices

### Step 3: Biometric Enrollment
- Load face-api.js models
- Capture 5 face samples with progress indicator
- Store embeddings array
- Option to skip biometrics

### Step 4: PDL Linking
- Select one or more PDLs to link
- Choose relationship type and category
- Create PDLVisitorLink with `approval_status: 'pending'`
- Option to skip and finish

### Visitor Code Generation
```typescript
function generateVisitorCode(): string {
  let code: string;
  do {
    code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  } while (visitors.some(v => v.visitor_code === code));
  return code;  // 10-digit unique code
}
```

---

## 🔗 KIN DALAW (PDL-VISITOR LINK) WORKFLOW

### Link Creation
- Created during visitor enrollment or as standalone
- Requires: pdl_id, visitor_id, relationship, category
- Initial status: `pending`

### Approval Workflow
1. **Staff** creates link (status: pending)
2. **Admin/Super Admin** reviews request
3. Approves → `approved` OR Rejects → `rejected` with reason
4. Only `approved` links allow visitation

### Category Limits (Configurable)
- **Immediate Family**: Unlimited (-1)
- **Legal Guardian**: 2 per PDL
- **Close Friend**: 3 per PDL

---

## ⏰ VISITATION WORKFLOW

### Identification Methods
1. **Manual ID Entry**: 10-digit visitor code
2. **QR Code Scan**: Webcam-based using html5-qrcode
3. **Face Scan**: Biometric matching with liveness detection

### Hardware Scanner Support
```typescript
const useHardwareScanner = ({ onScan, enabled, minLength, maxLength, timeout }) => {
  // Listens for barcode scanner input (fast keystrokes)
  // Triggers onScan callback when complete code detected
};
```

### Time-In Conditions
- Visitor must have `approved` Kin Dalaw link
- No existing open session for the visitor today
- PDL must have `detained` status
- Visitor must have `active` status

### Time-Out Conditions
- Must have existing open session
- Can use any identification method
- Records time_out and time_out_method

### Conjugal Visit Eligibility
- Only relationships in `conjugal_relationships` setting
- Default: wife, husband, spouse, live_in_partner, common_law_partner

---

## 🎭 LIVENESS DETECTION (Anti-Spoofing)

### States
1. `idle` - Camera starting
2. `look_center` - Face detection (3 detections required)
3. `blink` - Blink detection using Eye Aspect Ratio (EAR)
4. `verifying` - Face matching against database
5. `success` - Match found
6. `failed` - No match or liveness failed

### Blink Detection
```typescript
const calculateEAR = (landmarks) => {
  // Eye Aspect Ratio = (vertical1 + vertical2) / (2 * horizontal)
  // Left eye: landmarks 36-41
  // Right eye: landmarks 42-47
  // Blink detected when EAR drops below 0.18 from above 0.2
};
```

---

## 📱 CAMERA CONTEXT MANAGEMENT

```typescript
// Global camera state for favicon indicator
const CameraContext = createContext({
  isActive: false,
  selectedDeviceId: '',
  setActive: (active: boolean) => {},
  setSelectedDeviceId: (id: string) => {},
});

// Favicon changes to camera icon when active
useEffect(() => {
  const link = document.querySelector("link[rel~='icon']");
  link.href = isActive ? '/camera-active.svg' : '/watchguard-icon.svg';
}, [isActive]);
```

---

## 🔊 AUDIO FEEDBACK

```typescript
const useAudioFeedback = () => ({
  playQRSuccessBeep: () => playTone(880, 0.15),    // A5 - QR scanned
  playFaceMatchBeep: () => playTone(1047, 0.2),   // C6 - Face matched
  playErrorBeep: () => playTone(220, 0.3),        // A3 - Error
});
```

---

## 📦 REQUIRED DEPENDENCIES

```json
{
  "face-api.js": "^0.22.2",
  "html5-qrcode": "^2.3.8",
  "qrcode.react": "^4.2.0",
  "framer-motion": "^12.x",
  "lucide-react": "^0.462.0"
}
```

---

## 🗄️ DATA STORAGE FUNCTIONS

```typescript
// Visitor
getVisitors(): Visitor[]
getVisitorById(id): Visitor | undefined
getVisitorByCode(code): Visitor | undefined
createVisitor(data): Visitor
updateVisitor(id, updates): Visitor | undefined

// PDL-Visitor Links
getPDLVisitorLinks(): PDLVisitorLink[]
createPDLVisitorLink(data): PDLVisitorLink
updatePDLVisitorLink(id, updates): PDLVisitorLink | undefined
getLinksForVisitor(visitorId): PDLVisitorLink[]

// Visit Sessions
getVisitSessions(): VisitSession[]
createVisitSession(data): VisitSession
updateVisitSession(id, updates): VisitSession | undefined
getOpenSession(visitorId): VisitSession | undefined
getActiveSessions(): VisitSession[]
getCompletedTodaySessions(): VisitSession[]

// Biometrics
getBiometrics(): BiometricData[]
getBiometricByVisitorId(visitorId): BiometricData | undefined
saveBiometric(visitorId, embeddings, qualityScores): BiometricData
```

---

# PART 2: UI/UX DESIGN INTEGRATION

## 🎨 DESIGN PHILOSOPHY

A **professional, secure, and authoritative** visual identity for a jail visitor management system.

**Key Principles:**
- Dark theme default for low-light security environments
- Gold accent colors for authority and premium feel
- Glass morphism for modern depth
- Uppercase text for official/government aesthetic
- Smooth animations for professional polish

---

## 🎭 THEME SYSTEM (3 Themes)

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
    --background: 222 47% 6%;
    --foreground: 210 40% 96%;
    --card: 222 47% 8%;
    --card-foreground: 210 40% 96%;
    --popover: 222 47% 10%;
    --popover-foreground: 210 40% 96%;
    --primary: 45 93% 58%;
    --primary-foreground: 222 47% 6%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 96%;
    --muted: 217 33% 14%;
    --muted-foreground: 215 20% 55%;
    --accent: 217 33% 20%;
    --accent-foreground: 210 40% 96%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 210 40% 98%;
    --success: 142 76% 36%;
    --success-foreground: 210 40% 98%;
    --warning: 38 92% 50%;
    --warning-foreground: 222 47% 6%;
    --info: 199 89% 48%;
    --info-foreground: 210 40% 98%;
    --border: 217 33% 20%;
    --input: 217 33% 17%;
    --ring: 45 93% 58%;
    --radius: 0.75rem;
    --sidebar-background: 222 47% 5%;
    --sidebar-foreground: 210 40% 96%;
    --sidebar-primary: 45 93% 58%;
    --sidebar-primary-foreground: 222 47% 6%;
    --sidebar-accent: 217 33% 12%;
    --sidebar-accent-foreground: 210 40% 96%;
    --sidebar-border: 217 33% 15%;
    --sidebar-ring: 45 93% 58%;
    --gold-glow: 0 0 20px hsl(45 93% 58% / 0.3);
    --card-glow: 0 4px 20px hsl(222 47% 0% / 0.5);
  }

  /* ============ ROYAL THEME (Premium) ============ */
  .royal {
    --background: 240 15% 6%;
    --foreground: 0 0% 95%;
    --card: 240 15% 9%;
    --card-foreground: 0 0% 95%;
    --popover: 240 15% 11%;
    --popover-foreground: 0 0% 95%;
    --primary: 45 100% 50%;
    --primary-foreground: 240 15% 6%;
    --secondary: 240 15% 16%;
    --secondary-foreground: 0 0% 95%;
    --muted: 240 15% 13%;
    --muted-foreground: 240 10% 55%;
    --accent: 280 60% 45%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --success: 142 76% 36%;
    --success-foreground: 0 0% 98%;
    --warning: 38 92% 50%;
    --warning-foreground: 240 15% 6%;
    --info: 220 20% 70%;
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
    --background: 210 40% 98%;
    --foreground: 217 50% 15%;
    --card: 0 0% 100%;
    --card-foreground: 217 50% 15%;
    --popover: 0 0% 100%;
    --popover-foreground: 217 50% 15%;
    --primary: 217 80% 35%;
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
    --sidebar-background: 217 80% 25%;
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

### Tailwind Keyframes

```typescript
// tailwind.config.ts
keyframes: {
  "accordion-down": {
    from: { height: "0" },
    to: { height: "var(--radix-accordion-content-height)" },
  },
  "fade-in": {
    from: { opacity: "0", transform: "translateY(8px)" },
    to: { opacity: "1", transform: "translateY(0)" },
  },
  "scale-in": {
    from: { opacity: "0", transform: "scale(0.96)" },
    to: { opacity: "1", transform: "scale(1)" },
  },
  "shimmer": {
    "0%": { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" },
  },
},
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "fade-in": "fade-in 0.25s ease-out",
  "scale-in": "scale-in 0.2s ease-out",
  "shimmer": "shimmer 2s linear infinite",
},
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
      <p className="text-muted-foreground mt-1">Page description</p>
    </div>
    <div className="flex gap-2">{/* Action buttons */}</div>
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

---

## 🎯 SPACING SYSTEM (4px grid)

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

## 🎨 COLOR SEMANTIC USAGE

### Status Colors

| Status | Background | Border | Text |
|--------|------------|--------|------|
| Pending | `warning/20` | `warning/30` | `warning` |
| Approved | `success/20` | `success/30` | `success` |
| Rejected | `destructive/20` | `destructive/30` | `destructive` |
| Active | `info/20` | `info/30` | `info` |

---

## ✅ IMPLEMENTATION CHECKLIST

### Functionality
- [ ] Create type definitions
- [ ] Implement data storage layer
- [ ] Build useFaceDetection hook
- [ ] Create CameraContext provider
- [ ] Build Visitor Enrollment page
- [ ] Build Kin Dalaw management page
- [ ] Build Visitation page with 3 identification methods
- [ ] Implement liveness detection
- [ ] Add QR code generation
- [ ] Add hardware barcode scanner support
- [ ] Implement audit logging

### UI/UX
- [ ] Add Google Fonts import
- [ ] Configure theme CSS variables
- [ ] Set up Tailwind config
- [ ] Create ThemeContext
- [ ] Add component utility classes
- [ ] Configure scrollbar styling
- [ ] Add Framer Motion animations
- [ ] Test all three themes
