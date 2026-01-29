-- ============================================================
-- WATCHGUARD DATABASE SCHEMA
-- PostgreSQL Migration v001 - Initial Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1) APP SETTINGS (SSOT for all configuration)
-- ============================================================
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default settings
INSERT INTO app_settings (key, value) VALUES
    ('jail_name', 'City Jail Facility'),
    ('jail_region', ''),
    ('jail_address', ''),
    ('jail_email', ''),
    ('jail_contact', ''),
    ('logo1_path', ''),
    ('logo2_path', ''),
    ('logo3_path', ''),
    ('logo4_path', ''),
    ('immediate_family_limit', '-1'),
    ('legal_guardian_limit', '2'),
    ('close_friend_limit', '3'),
    ('face_recognition_threshold', '0.6'),
    ('allow_guest_enrollment', 'true'),
    ('data_retention_days', '365'),
    ('conjugal_relationships', '["wife","husband","spouse","live_in_partner","common_law_partner"]');

-- ============================================================
-- 2) USER ROLES (Enum + Table for RBAC)
-- ============================================================
CREATE TYPE app_role AS ENUM ('super_admin', 'admin', 'staff', 'guest');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'disabled');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(200) NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    status user_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================
-- 3) PDL (Person Deprived of Liberty)
-- NOTE: NO face photos, NO case numbers per privacy requirements
-- ============================================================
CREATE TYPE pdl_status AS ENUM ('detained', 'released', 'transferred', 'deceased');

CREATE TABLE pdl (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pdl_code VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(20),
    sex VARCHAR(10) NOT NULL CHECK (sex IN ('male', 'female')),
    date_of_birth DATE,
    housing_cell VARCHAR(50),
    housing_block VARCHAR(50),
    status pdl_status NOT NULL DEFAULT 'detained',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pdl_code ON pdl(pdl_code);
CREATE INDEX idx_pdl_status ON pdl(status);
CREATE INDEX idx_pdl_name ON pdl(last_name, first_name);

-- Sequence for PDL codes
CREATE SEQUENCE pdl_code_seq START 1;

-- Function to generate PDL code
CREATE OR REPLACE FUNCTION generate_pdl_code() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pdl_code IS NULL OR NEW.pdl_code = '' THEN
        NEW.pdl_code := 'PDL-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(nextval('pdl_code_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pdl_code_trigger
    BEFORE INSERT ON pdl
    FOR EACH ROW
    EXECUTE FUNCTION generate_pdl_code();

-- ============================================================
-- 4) VISITORS
-- ============================================================
CREATE TYPE visitor_status AS ENUM ('active', 'blacklisted', 'inactive');

CREATE TABLE visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_code VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(20),
    sex VARCHAR(10) NOT NULL CHECK (sex IN ('male', 'female')),
    date_of_birth DATE,
    contact_number VARCHAR(30),
    address TEXT,
    status visitor_status NOT NULL DEFAULT 'active',
    has_biometrics BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_visitor_code ON visitors(visitor_code);
CREATE INDEX idx_visitor_status ON visitors(status);
CREATE INDEX idx_visitor_name ON visitors(last_name, first_name);

-- Function to generate 10-digit visitor code
CREATE OR REPLACE FUNCTION generate_visitor_code() RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    IF NEW.visitor_code IS NULL OR NEW.visitor_code = '' THEN
        LOOP
            new_code := LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
            SELECT EXISTS(SELECT 1 FROM visitors WHERE visitor_code = new_code) INTO code_exists;
            EXIT WHEN NOT code_exists;
        END LOOP;
        NEW.visitor_code := new_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER visitor_code_trigger
    BEFORE INSERT ON visitors
    FOR EACH ROW
    EXECUTE FUNCTION generate_visitor_code();

-- ============================================================
-- 5) BIOMETRIC TEMPLATES (Server-side only)
-- Embeddings NEVER exposed to frontend
-- ============================================================
CREATE TYPE subject_type AS ENUM ('visitor');

CREATE TABLE biometric_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_type subject_type NOT NULL DEFAULT 'visitor',
    subject_id UUID NOT NULL,
    template_version VARCHAR(50) DEFAULT 'arcface_w600k_r50',
    embedding BYTEA NOT NULL, -- ArcFace 512-dim embedding stored as binary
    quality_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_visitor FOREIGN KEY (subject_id) REFERENCES visitors(id) ON DELETE CASCADE
);

-- Index for fast matching
CREATE INDEX idx_biometric_subject ON biometric_templates(subject_type, subject_id);

-- ============================================================
-- 6) PDL-VISITOR LINKS (Kin Dalaw)
-- ============================================================
CREATE TYPE relationship_type AS ENUM (
    'spouse', 'wife', 'husband',
    'live_in_partner', 'common_law_partner',
    'parent', 'child', 'sibling',
    'grandparent', 'grandchild',
    'aunt_uncle', 'cousin', 'niece_nephew',
    'legal_guardian', 'close_friend', 'other'
);

CREATE TYPE visitor_category AS ENUM ('immediate_family', 'legal_guardian', 'close_friend');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE pdl_visitor_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pdl_id UUID NOT NULL REFERENCES pdl(id) ON DELETE CASCADE,
    visitor_id UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
    relationship relationship_type NOT NULL,
    category visitor_category NOT NULL,
    approval_status approval_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pdl_id, visitor_id)
);

-- Indexes
CREATE INDEX idx_link_pdl ON pdl_visitor_links(pdl_id);
CREATE INDEX idx_link_visitor ON pdl_visitor_links(visitor_id);
CREATE INDEX idx_link_status ON pdl_visitor_links(approval_status);

-- ============================================================
-- 7) VISITATION SESSIONS
-- ============================================================
CREATE TYPE visit_type AS ENUM ('regular', 'conjugal', 'legal');
CREATE TYPE verification_method AS ENUM ('qr', 'manual', 'face');
CREATE TYPE verification_result AS ENUM ('pass', 'fail', 'skipped');

CREATE TABLE visitation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id UUID NOT NULL REFERENCES visitors(id),
    pdl_id UUID NOT NULL REFERENCES pdl(id),
    link_id UUID REFERENCES pdl_visitor_links(id),
    visit_type visit_type NOT NULL DEFAULT 'regular',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    check_in_at TIMESTAMP WITH TIME ZONE,
    check_out_at TIMESTAMP WITH TIME ZONE,
    check_in_method verification_method,
    check_in_result verification_result,
    check_out_method verification_method,
    check_out_result verification_result,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_visit_visitor ON visitation_sessions(visitor_id);
CREATE INDEX idx_visit_pdl ON visitation_sessions(pdl_id);
CREATE INDEX idx_visit_date ON visitation_sessions(check_in_at);
CREATE INDEX idx_visit_active ON visitation_sessions(check_in_at) WHERE check_out_at IS NULL;

-- ============================================================
-- 8) AUDIT LOGS
-- Server authoritative with enriched details
-- ============================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    subject_type VARCHAR(50) NOT NULL,
    subject_id UUID,
    related_activity_id UUID,
    detail_json JSONB DEFAULT '{}',
    detail_text TEXT, -- Human-readable WH summary
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_action ON audit_logs(action_type);
CREATE INDEX idx_audit_subject ON audit_logs(subject_type, subject_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pdl_updated_at BEFORE UPDATE ON pdl
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_biometric_templates_updated_at BEFORE UPDATE ON biometric_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pdl_visitor_links_updated_at BEFORE UPDATE ON pdl_visitor_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INITIAL SUPER ADMIN (password: Freediver26m)
-- In production, use proper password hashing (bcrypt)
-- ============================================================
INSERT INTO users (username, password_hash, full_name, role, status) VALUES
    ('JO1 Guiral', crypt('Freediver26m', gen_salt('bf')), 'JO1 Guiral MPT', 'super_admin', 'active');
