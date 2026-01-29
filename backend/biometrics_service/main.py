"""
WatchGuard Biometrics Service
FastAPI server for ArcFace/ONNX face recognition pipeline

Models required:
- YuNet detector: models/yunet_n_640_640.onnx
- ArcFace embedder: models/w600k_r50.onnx

Download from InsightFace model zoo or use provided scripts.
"""

import os
import base64
import io
import logging
from typing import List, Optional
from contextlib import asynccontextmanager

import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import onnxruntime as ort
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================
# Configuration
# ============================================================

DETECTOR_MODEL = os.getenv("DETECTOR_MODEL", "models/yunet_n_640_640.onnx")
EMBEDDER_MODEL = os.getenv("EMBEDDER_MODEL", "models/w600k_r50.onnx")
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.45"))
DETECTION_CONFIDENCE = float(os.getenv("DETECTION_CONFIDENCE", "0.7"))
QUALITY_MIN_FACE_SIZE = int(os.getenv("QUALITY_MIN_FACE_SIZE", "80"))

# ============================================================
# Models (loaded on startup)
# ============================================================

detector_session: Optional[ort.InferenceSession] = None
embedder_session: Optional[ort.InferenceSession] = None
embeddings_store: dict = {}  # In-memory store; production uses PostgreSQL

# ============================================================
# Pydantic Models
# ============================================================

class QualityRequest(BaseModel):
    imageBase64: str

class QualityMetrics(BaseModel):
    num_faces: int
    det_score: float
    blur: float
    brightness: float
    face_size: int

class QualityResponse(BaseModel):
    ok: bool
    reason: Optional[str] = None
    metrics: QualityMetrics
    overall_score: float
    face_confidence: float

class EnrollRequest(BaseModel):
    subject_type: str
    subject_id: str
    samples: List[str]

class EnrollResponse(BaseModel):
    ok: bool
    message: str
    samples_enrolled: int = 0

class VerifyRequest(BaseModel):
    subject_type: str
    subject_id: str
    imageBase64: str

class VerifyResponse(BaseModel):
    match: bool
    score: float
    threshold: float

class MatchCandidate(BaseModel):
    visitor_id: str
    score: float
    decision: str

class MatchRequest(BaseModel):
    subject_type: str
    imageBase64: str
    top_k: int = 5

class MatchResponse(BaseModel):
    ok: bool
    candidates: List[MatchCandidate]
    best_match: Optional[MatchCandidate] = None

class LivenessRequest(BaseModel):
    frames: List[str]

class LivenessResponse(BaseModel):
    is_live: bool
    score: float
    reason: Optional[str] = None

class HealthResponse(BaseModel):
    ok: bool
    version: str
    models_loaded: bool
    detector: str
    embedder: str

# ============================================================
# Helper Functions
# ============================================================

def decode_image(base64_str: str) -> np.ndarray:
    """Decode base64 image to OpenCV format"""
    try:
        # Remove data URL prefix if present
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        
        img_bytes = base64.b64decode(base64_str)
        img = Image.open(io.BytesIO(img_bytes))
        img_array = np.array(img.convert("RGB"))
        return cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    except Exception as e:
        raise ValueError(f"Failed to decode image: {e}")


def detect_faces(img: np.ndarray) -> List[dict]:
    """Detect faces using YuNet ONNX model"""
    if detector_session is None:
        raise RuntimeError("Detector not loaded")
    
    # Prepare input
    h, w = img.shape[:2]
    input_size = (640, 640)
    img_resized = cv2.resize(img, input_size)
    img_blob = cv2.dnn.blobFromImage(img_resized, 1.0, input_size, (0, 0, 0), swapRB=True)
    
    # Run inference
    input_name = detector_session.get_inputs()[0].name
    outputs = detector_session.run(None, {input_name: img_blob})
    
    faces = []
    if len(outputs) > 0 and outputs[0] is not None:
        detections = outputs[0]
        scale_x, scale_y = w / input_size[0], h / input_size[1]
        
        for det in detections:
            if len(det) >= 5:
                confidence = float(det[4]) if len(det) > 4 else float(det[-1])
                if confidence >= DETECTION_CONFIDENCE:
                    x1 = int(det[0] * scale_x)
                    y1 = int(det[1] * scale_y)
                    x2 = int(det[2] * scale_x)
                    y2 = int(det[3] * scale_y)
                    
                    faces.append({
                        "bbox": [x1, y1, x2, y2],
                        "confidence": confidence,
                    })
    
    return faces


def extract_embedding(img: np.ndarray, face: dict) -> np.ndarray:
    """Extract face embedding using ArcFace ONNX model"""
    if embedder_session is None:
        raise RuntimeError("Embedder not loaded")
    
    # Crop and align face
    x1, y1, x2, y2 = face["bbox"]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(img.shape[1], x2), min(img.shape[0], y2)
    
    face_img = img[y1:y2, x1:x2]
    if face_img.size == 0:
        raise ValueError("Empty face crop")
    
    # Resize to model input size (112x112 for ArcFace)
    face_img = cv2.resize(face_img, (112, 112))
    face_img = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
    face_img = (face_img.astype(np.float32) - 127.5) / 128.0
    face_img = face_img.transpose(2, 0, 1)
    face_img = np.expand_dims(face_img, axis=0)
    
    # Run inference
    input_name = embedder_session.get_inputs()[0].name
    outputs = embedder_session.run(None, {input_name: face_img})
    
    embedding = outputs[0][0]
    # Normalize
    embedding = embedding / np.linalg.norm(embedding)
    return embedding


def compute_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """Compute cosine similarity between embeddings"""
    return float(np.dot(emb1, emb2))


def calculate_blur(img: np.ndarray) -> float:
    """Calculate image blur using Laplacian variance"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def calculate_brightness(img: np.ndarray) -> float:
    """Calculate average brightness"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(np.mean(gray))


# ============================================================
# Startup/Shutdown
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector_session, embedder_session
    
    logger.info("Loading biometric models...")
    
    try:
        if os.path.exists(DETECTOR_MODEL):
            detector_session = ort.InferenceSession(DETECTOR_MODEL)
            logger.info(f"Loaded detector: {DETECTOR_MODEL}")
        else:
            logger.warning(f"Detector model not found: {DETECTOR_MODEL}")
        
        if os.path.exists(EMBEDDER_MODEL):
            embedder_session = ort.InferenceSession(EMBEDDER_MODEL)
            logger.info(f"Loaded embedder: {EMBEDDER_MODEL}")
        else:
            logger.warning(f"Embedder model not found: {EMBEDDER_MODEL}")
        
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
    
    yield
    
    logger.info("Shutting down biometrics service")


# ============================================================
# FastAPI App
# ============================================================

app = FastAPI(
    title="WatchGuard Biometrics Service",
    description="ArcFace/ONNX face recognition pipeline",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check service health and model status"""
    models_loaded = detector_session is not None and embedder_session is not None
    return HealthResponse(
        ok=models_loaded,
        version="1.0.0",
        models_loaded=models_loaded,
        detector="loaded" if detector_session else "not loaded",
        embedder="loaded" if embedder_session else "not loaded",
    )


@app.post("/quality", response_model=QualityResponse)
async def check_quality(request: QualityRequest):
    """Analyze image quality for enrollment suitability"""
    try:
        img = decode_image(request.imageBase64)
        faces = detect_faces(img)
        
        num_faces = len(faces)
        blur = calculate_blur(img)
        brightness = calculate_brightness(img)
        
        if num_faces == 0:
            return QualityResponse(
                ok=False,
                reason="No face detected",
                metrics=QualityMetrics(
                    num_faces=0,
                    det_score=0.0,
                    blur=blur,
                    brightness=brightness,
                    face_size=0,
                ),
                overall_score=0.0,
                face_confidence=0.0,
            )
        
        if num_faces > 1:
            return QualityResponse(
                ok=False,
                reason="Multiple faces detected",
                metrics=QualityMetrics(
                    num_faces=num_faces,
                    det_score=faces[0]["confidence"],
                    blur=blur,
                    brightness=brightness,
                    face_size=0,
                ),
                overall_score=0.0,
                face_confidence=faces[0]["confidence"],
            )
        
        face = faces[0]
        x1, y1, x2, y2 = face["bbox"]
        face_size = max(x2 - x1, y2 - y1)
        
        # Quality checks
        issues = []
        if face_size < QUALITY_MIN_FACE_SIZE:
            issues.append("Face too small")
        if brightness < 40:
            issues.append("Too dark")
        if brightness > 220:
            issues.append("Too bright")
        if blur < 50:
            issues.append("Too blurry")
        
        overall_score = min(1.0, (
            (face["confidence"] * 0.4) +
            (min(1.0, face_size / 200) * 0.3) +
            (min(1.0, blur / 200) * 0.15) +
            (1.0 - abs(brightness - 128) / 128) * 0.15
        ))
        
        return QualityResponse(
            ok=len(issues) == 0,
            reason="; ".join(issues) if issues else None,
            metrics=QualityMetrics(
                num_faces=1,
                det_score=face["confidence"],
                blur=blur,
                brightness=brightness,
                face_size=face_size,
            ),
            overall_score=overall_score,
            face_confidence=face["confidence"],
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/enroll", response_model=EnrollResponse)
async def enroll_subject(request: EnrollRequest):
    """Enroll biometric samples for a subject"""
    try:
        embeddings = []
        
        for sample in request.samples:
            img = decode_image(sample)
            faces = detect_faces(img)
            
            if len(faces) != 1:
                continue
            
            embedding = extract_embedding(img, faces[0])
            embeddings.append(embedding)
        
        if len(embeddings) < 3:
            return EnrollResponse(
                ok=False,
                message=f"Only {len(embeddings)} valid samples extracted. Minimum 3 required.",
                samples_enrolled=len(embeddings),
            )
        
        # Average embeddings
        avg_embedding = np.mean(embeddings, axis=0)
        avg_embedding = avg_embedding / np.linalg.norm(avg_embedding)
        
        # Store in memory (production: PostgreSQL)
        key = f"{request.subject_type}:{request.subject_id}"
        embeddings_store[key] = avg_embedding
        
        return EnrollResponse(
            ok=True,
            message=f"Enrolled {len(embeddings)} samples successfully",
            samples_enrolled=len(embeddings),
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/verify", response_model=VerifyResponse)
async def verify_subject(request: VerifyRequest):
    """Verify a face against an enrolled subject (1:1)"""
    try:
        key = f"{request.subject_type}:{request.subject_id}"
        
        if key not in embeddings_store:
            raise HTTPException(status_code=404, detail="Subject not enrolled")
        
        img = decode_image(request.imageBase64)
        faces = detect_faces(img)
        
        if len(faces) != 1:
            return VerifyResponse(
                match=False,
                score=0.0,
                threshold=MATCH_THRESHOLD,
            )
        
        probe_embedding = extract_embedding(img, faces[0])
        gallery_embedding = embeddings_store[key]
        
        score = compute_similarity(probe_embedding, gallery_embedding)
        
        return VerifyResponse(
            match=score >= MATCH_THRESHOLD,
            score=score,
            threshold=MATCH_THRESHOLD,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/match", response_model=MatchResponse)
async def match_subject(request: MatchRequest):
    """Match a face against all enrolled subjects (1:N)"""
    try:
        img = decode_image(request.imageBase64)
        faces = detect_faces(img)
        
        if len(faces) != 1:
            return MatchResponse(ok=False, candidates=[], best_match=None)
        
        probe_embedding = extract_embedding(img, faces[0])
        
        # Search all enrolled subjects of this type
        prefix = f"{request.subject_type}:"
        candidates = []
        
        for key, embedding in embeddings_store.items():
            if key.startswith(prefix):
                score = compute_similarity(probe_embedding, embedding)
                subject_id = key.replace(prefix, "")
                candidates.append(MatchCandidate(
                    visitor_id=subject_id,
                    score=score,
                    decision="match" if score >= MATCH_THRESHOLD else "no_match",
                ))
        
        # Sort by score
        candidates.sort(key=lambda x: x.score, reverse=True)
        candidates = candidates[:request.top_k]
        
        best_match = candidates[0] if candidates and candidates[0].score >= MATCH_THRESHOLD else None
        
        return MatchResponse(
            ok=True,
            candidates=candidates,
            best_match=best_match,
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/liveness", response_model=LivenessResponse)
async def check_liveness(request: LivenessRequest):
    """Check liveness using multiple frames (basic motion detection)"""
    try:
        if len(request.frames) < 5:
            return LivenessResponse(
                is_live=False,
                score=0.0,
                reason="Insufficient frames (minimum 5)",
            )
        
        # Decode frames and detect faces
        face_positions = []
        
        for frame_b64 in request.frames[:10]:  # Limit to 10 frames
            img = decode_image(frame_b64)
            faces = detect_faces(img)
            
            if len(faces) == 1:
                x1, y1, x2, y2 = faces[0]["bbox"]
                center = ((x1 + x2) / 2, (y1 + y2) / 2)
                face_positions.append(center)
        
        if len(face_positions) < 3:
            return LivenessResponse(
                is_live=False,
                score=0.0,
                reason="Insufficient face detections",
            )
        
        # Check for motion (head movement)
        total_motion = 0.0
        for i in range(1, len(face_positions)):
            dx = face_positions[i][0] - face_positions[i-1][0]
            dy = face_positions[i][1] - face_positions[i-1][1]
            total_motion += np.sqrt(dx*dx + dy*dy)
        
        avg_motion = total_motion / (len(face_positions) - 1)
        
        # Threshold for "alive" movement
        is_live = avg_motion > 5.0  # Pixels of movement
        score = min(1.0, avg_motion / 20.0)
        
        return LivenessResponse(
            is_live=is_live,
            score=score,
            reason=None if is_live else "Insufficient motion detected",
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/enrollment/{subject_id}")
async def get_enrollment(subject_id: str, subject_type: str = "visitor"):
    """Check if a subject is enrolled"""
    key = f"{subject_type}:{subject_id}"
    enrolled = key in embeddings_store
    return {"enrolled": enrolled, "subject_id": subject_id}


@app.post("/delete")
async def delete_enrollment(subject_type: str, subject_id: str):
    """Delete enrollment for a subject"""
    key = f"{subject_type}:{subject_id}"
    if key in embeddings_store:
        del embeddings_store[key]
        return {"ok": True, "message": "Enrollment deleted"}
    return {"ok": False, "message": "Subject not found"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("DEBUG", "false").lower() == "true",
    )
