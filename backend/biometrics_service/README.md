# Biometrics Service Specification

## Overview

The WatchGuard Biometrics Service is a FastAPI-based microservice that handles all facial biometric operations using ArcFace/ONNX models. This service runs on the local network and stores biometric templates in the PostgreSQL database.

## Technology Stack

- **Python 3.10+**
- **FastAPI** - Web framework
- **OpenCV** - Image processing
- **ONNX Runtime** - Model inference
- **NumPy** - Numerical operations
- **psycopg2** - PostgreSQL driver

## Models

### YuNet Face Detector

- **File**: `yunet_2023mar.onnx`
- **Source**: OpenCV Zoo
- **Purpose**: Fast and accurate face detection
- **Output**: Bounding boxes, landmarks, confidence scores

### ArcFace Face Recognizer

- **File**: `w600k_r50.onnx`
- **Source**: InsightFace
- **Purpose**: 512-dimensional face embedding
- **Accuracy**: 99.5%+ on LFW benchmark

## API Endpoints

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "models_loaded": true,
  "detector": "yunet_2023mar",
  "recognizer": "arcface_w600k_r50",
  "uptime_seconds": 3600
}
```

### Quality Check

Analyzes image quality for biometric enrollment.

```http
POST /quality
Content-Type: application/json

{
  "imageBase64": "base64_encoded_jpeg_or_png"
}
```

Response:
```json
{
  "ok": true,
  "reason": "",
  "metrics": {
    "num_faces": 1,
    "det_score": 0.95,
    "blur": 0.12,
    "brightness": 0.78,
    "face_size": 0.25
  },
  "overall_score": 0.92,
  "face_confidence": 0.95
}
```

Quality Checks:
- **num_faces**: Must be exactly 1
- **det_score**: Face detection confidence (>0.8 required)
- **blur**: Laplacian variance (<0.3 is too blurry)
- **brightness**: Mean pixel value (0.3-0.85 is acceptable)
- **face_size**: Face area ratio (>0.1 required)

### Enrollment

Enrolls a visitor with multiple face samples.

```http
POST /enroll
Content-Type: application/json

{
  "subjectType": "visitor",
  "subjectId": "uuid-of-visitor",
  "samples": [
    "base64_image_1",
    "base64_image_2",
    "base64_image_3",
    "base64_image_4",
    "base64_image_5"
  ]
}
```

Response:
```json
{
  "ok": true,
  "subject_id": "uuid-of-visitor",
  "samples_processed": 5,
  "template_id": "uuid-of-template",
  "message": "Enrollment successful"
}
```

Requirements:
- Minimum 3 samples, recommended 5
- Include different angles (front, left, right, up, down)
- Each sample must pass quality check
- Embeddings are averaged for robust template

### Verification (1:1)

Verifies a face against a specific enrolled visitor.

```http
POST /verify
Content-Type: application/json

{
  "subjectType": "visitor",
  "subjectId": "uuid-of-visitor",
  "imageBase64": "base64_encoded_image"
}
```

Response:
```json
{
  "ok": true,
  "match": true,
  "score": 0.85,
  "decision": "pass",
  "message": "Identity verified"
}
```

Thresholds:
- **pass**: score >= 0.6
- **fail**: score < 0.6

### Matching (1:N)

Matches a face against all enrolled visitors.

```http
POST /match
Content-Type: application/json

{
  "subjectType": "visitor",
  "imageBase64": "base64_encoded_image",
  "topK": 5
}
```

Response:
```json
{
  "ok": true,
  "candidates": [
    {
      "subject_id": "uuid",
      "visitor_id": "uuid",
      "score": 0.92,
      "decision": "match"
    },
    {
      "subject_id": "uuid",
      "visitor_id": "uuid",
      "score": 0.45,
      "decision": "no_match"
    }
  ],
  "best_match": {
    "subject_id": "uuid",
    "visitor_id": "uuid",
    "score": 0.92,
    "decision": "match"
  },
  "message": "Match found"
}
```

### Liveness Detection

Detects if the face is from a live person (not a photo/video).

```http
POST /liveness
Content-Type: application/json

{
  "frames": [
    "base64_frame_1",
    "base64_frame_2",
    "base64_frame_3",
    "base64_frame_4",
    "base64_frame_5"
  ]
}
```

Response:
```json
{
  "ok": true,
  "live": true,
  "score": 0.9,
  "checks": {
    "blink_detected": true,
    "head_movement": true,
    "texture_analysis": true
  },
  "message": "Liveness confirmed"
}
```

Liveness Checks:
- **blink_detected**: Eye aspect ratio changes detected
- **head_movement**: Face position variance across frames
- **texture_analysis**: LBP texture patterns (anti-photo attack)

### Check Enrollment

Check if a visitor has biometric enrollment.

```http
POST /check
Content-Type: application/json

{
  "subjectType": "visitor",
  "subjectId": "uuid-of-visitor"
}
```

Response:
```json
{
  "enrolled": true,
  "template_id": "uuid",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Delete Enrollment

Remove biometric enrollment for a visitor.

```http
POST /delete
Content-Type: application/json

{
  "subjectType": "visitor",
  "subjectId": "uuid-of-visitor"
}
```

Response:
```json
{
  "ok": true,
  "message": "Enrollment deleted"
}
```

## Embedding Storage

Embeddings are stored in the `biometric_templates` table:

```sql
CREATE TABLE biometric_templates (
    id UUID PRIMARY KEY,
    subject_type subject_type NOT NULL DEFAULT 'visitor',
    subject_id UUID NOT NULL,
    template_version VARCHAR(50) DEFAULT 'arcface_w600k_r50',
    embedding BYTEA NOT NULL,  -- 512 floats = 2048 bytes
    quality_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Embedding Format

- 512-dimensional float32 vector
- Stored as BYTEA (binary)
- ~2KB per template
- L2 normalized for cosine similarity

## Distance Metrics

### Cosine Similarity

```python
def cosine_similarity(emb1, emb2):
    return np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
```

For normalized embeddings:
```python
score = np.dot(emb1, emb2)  # Already L2 normalized
```

### Decision Thresholds

| Score Range | Decision |
|------------|----------|
| >= 0.6 | Match |
| 0.45 - 0.6 | Uncertain (manual review) |
| < 0.45 | No Match |

## Performance

- **Detection**: ~15ms per image (GPU), ~50ms (CPU)
- **Embedding**: ~10ms per face (GPU), ~30ms (CPU)
- **Matching**: O(n) linear search, ~1ms per 1000 templates
- **Recommended**: NVIDIA GPU with CUDA for production

## Directory Structure

```
biometrics_service/
├── main.py              # FastAPI application
├── config.py            # Configuration
├── models/
│   ├── detector.py      # YuNet wrapper
│   └── recognizer.py    # ArcFace wrapper
├── services/
│   ├── quality.py       # Quality assessment
│   ├── enrollment.py    # Enrollment logic
│   ├── matching.py      # 1:1 and 1:N matching
│   └── liveness.py      # Liveness detection
├── database/
│   └── templates.py     # Template storage
├── utils/
│   ├── image.py         # Image processing
│   └── encoding.py      # Base64 handling
├── models_onnx/
│   ├── yunet_2023mar.onnx
│   └── w600k_r50.onnx
├── requirements.txt
└── Dockerfile
```

## Environment Variables

```env
# Server
HOST=0.0.0.0
PORT=8000
WORKERS=4

# Models
MODEL_DIR=./models_onnx
DETECTOR_MODEL=yunet_2023mar.onnx
RECOGNIZER_MODEL=w600k_r50.onnx
USE_GPU=true

# Database
DATABASE_URL=postgresql://watchguard:password@localhost:5432/watchguard

# Thresholds
MATCH_THRESHOLD=0.6
QUALITY_MIN_SCORE=0.7
MIN_FACE_SIZE=100
MAX_FACE_SIZE=800

# Liveness
LIVENESS_ENABLED=true
LIVENESS_MIN_FRAMES=5
BLINK_THRESHOLD=0.25
MOVEMENT_THRESHOLD=0.05
```

## Dockerfile

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Download models (or mount as volume)
# RUN python download_models.py

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

## Requirements

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6
numpy==1.26.3
opencv-python-headless==4.9.0.80
onnxruntime==1.16.3
# onnxruntime-gpu==1.16.3  # For GPU support
psycopg2-binary==2.9.9
python-dotenv==1.0.0
pydantic==2.5.3
```

## Security

1. **No raw images stored** - Only embeddings
2. **Embeddings not reversible** - Cannot reconstruct face
3. **API authentication** - Bearer token required
4. **Rate limiting** - Prevent brute force attacks
5. **Input validation** - Size and format checks
