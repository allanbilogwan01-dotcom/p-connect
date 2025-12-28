# WatchGuard Offline Biometrics Guide

## Overview

WatchGuard uses offline facial recognition for visitor verification. The biometrics service runs locally on the server using InsightFace/ArcFace models.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│  React PWA  │────▶│   PHP API    │────▶│ Python Biometrics │
│  (Browser)  │     │  (Laragon)   │     │    (localhost)    │
└─────────────┘     └──────────────┘     └───────────────────┘
                           │                      │
                           ▼                      ▼
                    ┌──────────────┐      ┌──────────────┐
                    │    MySQL     │      │ ONNX Models  │
                    │   Database   │      │   (Local)    │
                    └──────────────┘      └──────────────┘
```

## Requirements

- Python 3.9+
- ONNX Runtime
- InsightFace models (included locally)
- No internet required at runtime

## Installation

### 1. Create Python Environment

```bash
cd biometrics_service
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Model Files

Models are stored locally in `/biometrics_service/models/`:

```
models/
├── buffalo_l/
│   ├── det_10g.onnx         # Face detection
│   └── w600k_r50.onnx       # Face recognition (ArcFace)
└── antelope/
    └── glintr100.onnx       # Alternative model
```

### 3. Start Service

```bash
python main.py
# Runs on http://127.0.0.1:9001
```

## API Endpoints

### POST /enroll
Enroll a new face with multiple images.

**Request:**
```json
{
  "visitor_id": "uuid",
  "images": ["base64_image_1", "base64_image_2", ...]
}
```

**Response:**
```json
{
  "success": true,
  "profile_id": "uuid",
  "quality_scores": [0.95, 0.92, 0.88, 0.91, 0.94]
}
```

### POST /verify
Verify a face against enrolled profiles.

**Request:**
```json
{
  "image": "base64_image",
  "liveness_frames": ["frame1", "frame2", "frame3"]
}
```

**Response:**
```json
{
  "success": true,
  "matched": true,
  "visitor_id": "uuid",
  "confidence": 0.89,
  "liveness_passed": true
}
```

## Quality Gates

### Enrollment Requirements
- Minimum 5 images required
- Face must be detected in each image
- Quality score > 0.7 for each image
- No blur (Laplacian variance > 100)
- Proper lighting (brightness 40-200)
- Face size > 80x80 pixels

### Verification Requirements
- Single face detected
- Liveness check passed (blink/head movement)
- Confidence score > threshold (default 0.75)

## Liveness Detection

Anti-spoofing measures:

1. **Blink Detection** - User must blink during capture
2. **Head Movement** - Slight head turn required
3. **Motion Consistency** - Frames must show natural motion

## Configuration

Edit `biometrics_service/config.py`:

```python
SETTINGS = {
    "threshold": 0.75,           # Match threshold
    "min_face_size": 80,         # Minimum face pixels
    "blur_threshold": 100,       # Laplacian variance
    "brightness_min": 40,        # Minimum brightness
    "brightness_max": 200,       # Maximum brightness
    "enrollment_images": 5,      # Required enrollment images
    "liveness_frames": 3,        # Frames for liveness check
}
```

## Accuracy Tips

1. **Enrollment Lighting** - Use consistent, front-facing light
2. **Multiple Angles** - Capture front, slight left, slight right
3. **No Glasses** - Remove glasses for enrollment if possible
4. **Clean Camera** - Keep camera lens clean
5. **Threshold Tuning** - Adjust based on security requirements

## Troubleshooting

### Model Not Loading
- Verify ONNX files exist in models folder
- Check file permissions
- Ensure ONNX Runtime installed

### Low Accuracy
- Re-enroll with better quality images
- Increase enrollment image count
- Adjust threshold in settings

### Slow Performance
- Use GPU if available (onnxruntime-gpu)
- Reduce input image size
- Optimize model batch size

## Security Considerations

- Biometric data stored as encrypted embeddings
- Raw images not stored after processing
- All processing done locally (no cloud)
- Access logs maintained for all verifications
- Only ADMIN+ can view biometric audit logs
