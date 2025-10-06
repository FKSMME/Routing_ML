-- ============================================================================
-- PostgreSQL Schema Definition for Routing ML v4
-- Migrated from Access DB
-- ============================================================================
-- Author: ML Team
-- Created: 2025-10-06
-- Description: Complete schema migration from Access DB to PostgreSQL 14+
-- ============================================================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS routing;
SET search_path TO routing, public;

-- ============================================================================
-- 1. ITEM MASTER TABLE (품목 마스터)
-- ============================================================================
-- Source: Access VIEW: dbo_BI_ITEM_INFO_VIEW
-- Purpose: 품목 기본 정보 및 특성 저장
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_master (
    -- Primary Key
    item_cd VARCHAR(100) PRIMARY KEY,

    -- Basic Info
    part_type VARCHAR(50),
    part_nm VARCHAR(255),
    item_suffix VARCHAR(50),
    item_spec TEXT,
    item_nm VARCHAR(500),
    additional_spec TEXT,

    -- Material & Account
    item_material VARCHAR(100),
    material_desc VARCHAR(255),
    item_acct VARCHAR(50),
    item_type VARCHAR(50),
    item_unit VARCHAR(20),

    -- Group Classification
    item_grp1 VARCHAR(50),
    item_grp1nm VARCHAR(255),
    item_grp2 VARCHAR(50),
    item_grp2nm VARCHAR(255),
    item_grp3 VARCHAR(50),
    item_grp3nm VARCHAR(255),
    standard_yn CHAR(1),
    group1 VARCHAR(100),
    group2 VARCHAR(100),
    group3 VARCHAR(100),

    -- Drawing Info
    draw_no VARCHAR(100),
    draw_rev VARCHAR(50),
    draw_sheet_no VARCHAR(50),
    draw_use VARCHAR(100),
    item_nm_eng VARCHAR(500),

    -- Dimensions
    outdiameter NUMERIC(18, 4),
    indiameter NUMERIC(18, 4),
    outthickness NUMERIC(18, 4),
    outdiameter_unit VARCHAR(20),

    -- Rotation
    rotate_clockwise INTEGER,
    rotate_ctrclockwise INTEGER,

    -- Seal Specifications
    sealtypegrup VARCHAR(100),
    in_sealtype_cd VARCHAR(50),
    in_sealsize NUMERIC(18, 4),
    in_sealsize_uom VARCHAR(20),
    mid_sealtype_cd VARCHAR(50),
    mid_sealsize NUMERIC(18, 4),
    mid_sealsize_uom VARCHAR(20),
    out_sealtype_cd VARCHAR(50),
    out_sealsize NUMERIC(18, 4),
    out_sealsize_uom VARCHAR(20),

    -- Raw Material
    raw_matl_kind VARCHAR(50),
    raw_matl_kindnm VARCHAR(255),

    -- Audit Fields
    insrt_dt TIMESTAMP,
    modi_dt TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for item_master
CREATE INDEX idx_item_master_part_type ON item_master(part_type);
CREATE INDEX idx_item_master_material ON item_master(item_material);
CREATE INDEX idx_item_master_grp1 ON item_master(item_grp1);
CREATE INDEX idx_item_master_grp2 ON item_master(item_grp2);
CREATE INDEX idx_item_master_insrt_dt ON item_master(insrt_dt);
CREATE INDEX idx_item_master_updated_at ON item_master(updated_at);

-- Full-text search index for item names
CREATE INDEX idx_item_master_item_nm_gin ON item_master USING gin(to_tsvector('korean', item_nm));

COMMENT ON TABLE item_master IS '품목 마스터 테이블 - Access dbo_BI_ITEM_INFO_VIEW 마이그레이션';
COMMENT ON COLUMN item_master.item_cd IS '품목 코드 (Primary Key)';
COMMENT ON COLUMN item_master.item_nm IS '품목명';
COMMENT ON COLUMN item_master.standard_yn IS '표준품 여부 (Y/N)';

-- ============================================================================
-- 2. ROUTING MASTER TABLE (공정 마스터)
-- ============================================================================
-- Source: Access VIEW: dbo_BI_ROUTING_VIEW / dbo_BI_ROUTING_HIS_VIEW
-- Purpose: 품목별 공정 순서 및 작업 정보 저장
-- ============================================================================

CREATE TABLE IF NOT EXISTS routing_master (
    -- Primary Key
    routing_id BIGSERIAL PRIMARY KEY,

    -- Foreign Key
    item_cd VARCHAR(100) NOT NULL REFERENCES item_master(item_cd) ON DELETE CASCADE,

    -- Routing Info
    rout_no VARCHAR(50),
    proc_seq INTEGER NOT NULL,
    inside_flag CHAR(1),

    -- Job & Resource
    job_cd VARCHAR(50),
    job_nm VARCHAR(255),
    res_cd VARCHAR(50),
    res_dis VARCHAR(255),

    -- Time Info
    time_unit VARCHAR(20),
    mfg_lt NUMERIC(18, 4),
    queue_time NUMERIC(18, 4),
    setup_time NUMERIC(18, 4),
    run_time NUMERIC(18, 4),
    run_time_unit VARCHAR(20),
    mach_worked_hours NUMERIC(18, 4),
    act_setup_time NUMERIC(18, 4),
    act_run_time NUMERIC(18, 4),
    wait_time NUMERIC(18, 4),
    move_time NUMERIC(18, 4),
    run_time_qty NUMERIC(18, 4),

    -- Operation Details
    batch_oper CHAR(1),
    bp_cd VARCHAR(50),
    cust_nm VARCHAR(255),
    cur_cd VARCHAR(20),
    subcontract_prc NUMERIC(18, 4),
    tax_type VARCHAR(20),
    milestone_flg CHAR(1),
    insp_flg CHAR(1),
    rout_order INTEGER,

    -- Validity
    valid_from_dt DATE,
    valid_to_dt DATE,
    validity CHAR(1),

    -- Documentation
    remark TEXT,
    rout_doc VARCHAR(500),
    doc_inside VARCHAR(500),
    doc_no VARCHAR(100),

    -- NC Program
    nc_program VARCHAR(500),
    nc_program_writer VARCHAR(50),
    nc_writer_nm VARCHAR(255),
    nc_write_date DATE,
    nc_reviewer VARCHAR(50),
    nc_reviewer_nm VARCHAR(255),
    nc_review_dt DATE,

    -- Additional Info
    raw_matl_size VARCHAR(100),
    jaw_size VARCHAR(100),
    program_remark TEXT,
    op_draw_no VARCHAR(100),
    mtmg_numb VARCHAR(100),

    -- Audit Fields
    insrt_dt TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE (item_cd, rout_no, proc_seq)
);

-- Indexes for routing_master
CREATE INDEX idx_routing_item_cd ON routing_master(item_cd);
CREATE INDEX idx_routing_proc_seq ON routing_master(proc_seq);
CREATE INDEX idx_routing_job_cd ON routing_master(job_cd);
CREATE INDEX idx_routing_res_cd ON routing_master(res_cd);
CREATE INDEX idx_routing_insrt_dt ON routing_master(insrt_dt);
CREATE INDEX idx_routing_valid_dates ON routing_master(valid_from_dt, valid_to_dt);

COMMENT ON TABLE routing_master IS '공정 마스터 테이블 - Access dbo_BI_ROUTING_VIEW 마이그레이션';
COMMENT ON COLUMN routing_master.proc_seq IS '공정 순서';
COMMENT ON COLUMN routing_master.job_cd IS '작업 코드';
COMMENT ON COLUMN routing_master.setup_time IS '세팅 시간';
COMMENT ON COLUMN routing_master.run_time IS '가공 시간';

-- ============================================================================
-- 3. ML PREDICTIONS TABLE (ML 예측 결과)
-- ============================================================================
-- Purpose: ML 모델의 예측 결과 및 유사도 저장
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml_predictions (
    -- Primary Key
    prediction_id BIGSERIAL PRIMARY KEY,

    -- Request Info
    source_item_cd VARCHAR(100) NOT NULL,
    candidate_id INTEGER NOT NULL,

    -- Reference Info
    reference_item_cd VARCHAR(100) REFERENCES item_master(item_cd),
    routing_signature VARCHAR(255),
    priority INTEGER,

    -- Similarity Metrics
    similarity_score NUMERIC(10, 8),
    similarity_tier VARCHAR(20),

    -- ML Explainability
    feature_importance JSONB,
    matched_features TEXT[],

    -- Process Details
    proc_seq INTEGER,
    inside_flag CHAR(1),
    job_cd VARCHAR(50),
    job_nm VARCHAR(255),
    res_cd VARCHAR(50),
    res_dis VARCHAR(255),

    -- Time Estimates
    setup_time NUMERIC(18, 4),
    run_time NUMERIC(18, 4),
    wait_time NUMERIC(18, 4),

    -- Metadata
    model_version VARCHAR(50),
    prediction_metadata JSONB,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Indexes for ml_predictions
CREATE INDEX idx_predictions_source_item ON ml_predictions(source_item_cd);
CREATE INDEX idx_predictions_reference_item ON ml_predictions(reference_item_cd);
CREATE INDEX idx_predictions_similarity ON ml_predictions(similarity_score DESC);
CREATE INDEX idx_predictions_created_at ON ml_predictions(created_at DESC);
CREATE INDEX idx_predictions_feature_importance ON ml_predictions USING gin(feature_importance);

COMMENT ON TABLE ml_predictions IS 'ML 모델 예측 결과 저장';
COMMENT ON COLUMN ml_predictions.similarity_score IS 'Cosine similarity (0~1)';
COMMENT ON COLUMN ml_predictions.feature_importance IS 'SHAP values for explainability';

-- ============================================================================
-- 4. USER ACCOUNTS TABLE (사용자 계정)
-- ============================================================================
-- Purpose: 로컬 인증 사용자 관리
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    -- Primary Key
    user_id BIGSERIAL PRIMARY KEY,

    -- Authentication
    username VARCHAR(150) NOT NULL,
    normalized_username VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile
    display_name VARCHAR(255),
    email VARCHAR(255),
    department VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users
CREATE UNIQUE INDEX idx_users_normalized_username ON users(normalized_username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

COMMENT ON TABLE users IS '사용자 계정 테이블';
COMMENT ON COLUMN users.normalized_username IS 'Lowercase username for case-insensitive login';

-- ============================================================================
-- 5. ROUTING GROUPS TABLE (공정 그룹)
-- ============================================================================
-- Purpose: 사용자 정의 공정 그룹 저장
-- ============================================================================

CREATE TABLE IF NOT EXISTS routing_groups (
    -- Primary Key
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Group Info
    group_name VARCHAR(64) NOT NULL,
    owner VARCHAR(255) NOT NULL,

    -- Group Data
    item_codes JSONB DEFAULT '[]'::jsonb,
    steps JSONB DEFAULT '[]'::jsonb,
    erp_required BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Version Control
    version INTEGER DEFAULT 1,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Constraints
    UNIQUE (owner, group_name)
);

-- Indexes for routing_groups
CREATE INDEX idx_routing_groups_owner ON routing_groups(owner);
CREATE INDEX idx_routing_groups_updated_at ON routing_groups(updated_at DESC);
CREATE INDEX idx_routing_groups_deleted_at ON routing_groups(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON TABLE routing_groups IS '사용자 정의 공정 그룹';
COMMENT ON COLUMN routing_groups.steps IS 'JSON array of routing steps';

-- ============================================================================
-- 6. MODEL REGISTRY TABLE (모델 레지스트리)
-- ============================================================================
-- Purpose: ML 모델 버전 관리
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_registry (
    -- Primary Key
    model_id BIGSERIAL PRIMARY KEY,

    -- Model Info
    model_name VARCHAR(255) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    model_path VARCHAR(500) NOT NULL,

    -- Performance Metrics
    accuracy NUMERIC(10, 8),
    precision_score NUMERIC(10, 8),
    recall_score NUMERIC(10, 8),
    f1_score NUMERIC(10, 8),

    -- Training Info
    training_samples INTEGER,
    training_duration_sec INTEGER,
    hyperparameters JSONB,

    -- Deployment Status
    is_active BOOLEAN DEFAULT FALSE,
    deployed_at TIMESTAMP,
    deprecated_at TIMESTAMP,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),

    -- Constraints
    UNIQUE (model_name, model_version)
);

-- Indexes for model_registry
CREATE INDEX idx_model_registry_active ON model_registry(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_model_registry_created_at ON model_registry(created_at DESC);

COMMENT ON TABLE model_registry IS 'ML 모델 버전 관리 및 성능 추적';

-- ============================================================================
-- 7. CONCEPT DRIFT LOG TABLE (Concept Drift 로그)
-- ============================================================================
-- Purpose: 데이터 분포 변화 감지 로그
-- ============================================================================

CREATE TABLE IF NOT EXISTS concept_drift_log (
    -- Primary Key
    drift_id BIGSERIAL PRIMARY KEY,

    -- Drift Detection
    kl_divergence NUMERIC(18, 8) NOT NULL,
    drift_detected BOOLEAN NOT NULL,
    threshold_value NUMERIC(10, 4) DEFAULT 0.5,

    -- Context
    model_version VARCHAR(50),
    prediction_count INTEGER,

    -- Distribution Stats
    baseline_distribution JSONB,
    current_distribution JSONB,

    -- Actions Taken
    retraining_triggered BOOLEAN DEFAULT FALSE,
    alert_sent BOOLEAN DEFAULT FALSE,

    -- Audit
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for concept_drift_log
CREATE INDEX idx_drift_log_detected_at ON concept_drift_log(detected_at DESC);
CREATE INDEX idx_drift_log_drift_detected ON concept_drift_log(drift_detected) WHERE drift_detected = TRUE;
CREATE INDEX idx_drift_log_kl_divergence ON concept_drift_log(kl_divergence DESC);

COMMENT ON TABLE concept_drift_log IS 'Concept Drift 감지 로그 (KL Divergence)';
COMMENT ON COLUMN concept_drift_log.kl_divergence IS 'KL Divergence 값 (임계값 0.5)';

-- ============================================================================
-- 8. AUDIT LOG TABLE (감사 로그)
-- ============================================================================
-- Purpose: 모든 중요 작업 감사 로그
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    -- Primary Key
    log_id BIGSERIAL PRIMARY KEY,

    -- Event Info
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50),

    -- User Info
    user_id BIGINT REFERENCES users(user_id),
    username VARCHAR(150),
    ip_address INET,

    -- Target Info
    target_type VARCHAR(100),
    target_id VARCHAR(255),

    -- Details
    action VARCHAR(50),
    changes JSONB,
    result VARCHAR(20),
    error_message TEXT,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_log
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_changes ON audit_log USING gin(changes);

-- Partition by month (optional, for large datasets)
-- CREATE TABLE audit_log_2025_10 PARTITION OF audit_log
--     FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

COMMENT ON TABLE audit_log IS '감사 로그 - 모든 중요 작업 추적';

-- ============================================================================
-- 9. TRIGGERS - Auto Update Timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_item_master_updated_at BEFORE UPDATE ON item_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routing_master_updated_at BEFORE UPDATE ON routing_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routing_groups_updated_at BEFORE UPDATE ON routing_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. VIEWS - Commonly Used Queries
-- ============================================================================

-- View: Active Routings (유효한 공정만)
CREATE OR REPLACE VIEW v_active_routings AS
SELECT
    r.*,
    i.item_nm,
    i.part_type,
    i.item_spec
FROM routing_master r
INNER JOIN item_master i ON r.item_cd = i.item_cd
WHERE r.validity = 'Y'
  AND (r.valid_to_dt IS NULL OR r.valid_to_dt >= CURRENT_DATE)
ORDER BY r.item_cd, r.proc_seq;

COMMENT ON VIEW v_active_routings IS '유효한 공정만 조회 (validity=Y, valid_to_dt >= today)';

-- View: ML Prediction Summary (최근 예측 요약)
CREATE OR REPLACE VIEW v_prediction_summary AS
SELECT
    source_item_cd,
    COUNT(*) as prediction_count,
    AVG(similarity_score) as avg_similarity,
    MAX(similarity_score) as max_similarity,
    MAX(created_at) as latest_prediction
FROM ml_predictions
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY source_item_cd;

COMMENT ON VIEW v_prediction_summary IS '최근 30일 ML 예측 요약';

-- ============================================================================
-- 11. GRANTS - Default Permissions
-- ============================================================================

-- Create roles
-- CREATE ROLE routing_readonly;
-- CREATE ROLE routing_readwrite;
-- CREATE ROLE routing_admin;

-- Grant permissions
-- GRANT USAGE ON SCHEMA routing TO routing_readonly, routing_readwrite, routing_admin;
-- GRANT SELECT ON ALL TABLES IN SCHEMA routing TO routing_readonly;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA routing TO routing_readwrite;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA routing TO routing_admin;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA routing TO routing_admin;

-- ============================================================================
-- END OF SCHEMA DEFINITION
-- ============================================================================

-- Analyze tables for query optimization
ANALYZE item_master;
ANALYZE routing_master;
ANALYZE ml_predictions;
ANALYZE users;
ANALYZE routing_groups;
ANALYZE model_registry;
ANALYZE concept_drift_log;
ANALYZE audit_log;
