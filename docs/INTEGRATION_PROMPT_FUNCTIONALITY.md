# JAIL VISITOR MANAGEMENT SYSTEM - Functionality Integration Prompt

## Use this prompt to integrate Kin Dalaw, Visitor Enrollment, Facial Biometrics, and Visitation Workflow into another Lovable project.

---

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
  conjugal_relationships: RelationshipType[];  // Relationships eligible for conjugal visits
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

### Visit Session Creation
```typescript
const handleTimeIn = () => {
  const session = createVisitSession({
    visitor_id: foundVisitor.id,
    pdl_id: selectedLink.pdl_id,
    pdl_visitor_link_id: selectedLink.id,
    visit_type: visitType,  // 'regular' or 'conjugal'
    time_in: new Date().toISOString(),
    time_in_method: idMethod,  // 'face_scan', 'qr_scan', 'manual_id'
    operator_id: user.id,
  });
};
```

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

## ✅ IMPLEMENTATION CHECKLIST

- [ ] Create type definitions
- [ ] Implement data storage layer (localStorage or Supabase)
- [ ] Build useFaceDetection hook
- [ ] Create CameraContext provider
- [ ] Build Visitor Enrollment page with 4-step flow
- [ ] Build Kin Dalaw management page
- [ ] Build Visitation page with 3 identification methods
- [ ] Implement liveness detection in face scanner
- [ ] Add QR code generation for visitor cards
- [ ] Add hardware barcode scanner support
- [ ] Implement audit logging
- [ ] Add system settings management
