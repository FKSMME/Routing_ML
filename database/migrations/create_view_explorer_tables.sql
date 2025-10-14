-- SQL View Explorer 테이블 생성
-- 실행 전 적절한 데이터베이스를 선택하세요

USE [your_database_name];
GO

-- 1. 뷰 설정 테이블
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'view_configs')
BEGIN
    CREATE TABLE view_configs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        view_name NVARCHAR(256) NOT NULL UNIQUE,
        display_name NVARCHAR(256) NOT NULL,
        columns_config NVARCHAR(MAX) NOT NULL,  -- JSON 형식
        enable_checklist BIT NOT NULL DEFAULT 0,
        checklist_column_name NVARCHAR(100) NOT NULL DEFAULT N'체크',
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        created_by NVARCHAR(100) NOT NULL,
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_by NVARCHAR(100) NOT NULL,
        CONSTRAINT CK_view_configs_columns_json CHECK (ISJSON(columns_config) = 1)
    );

    CREATE INDEX IX_view_configs_updated_at ON view_configs(updated_at DESC);

    PRINT '✓ view_configs 테이블 생성 완료';
END
ELSE
BEGIN
    PRINT '! view_configs 테이블이 이미 존재합니다';
END
GO

-- 2. 체크리스트 테이블
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'view_checklists')
BEGIN
    CREATE TABLE view_checklists (
        id INT IDENTITY(1,1) PRIMARY KEY,
        view_name NVARCHAR(256) NOT NULL,
        row_id NVARCHAR(500) NOT NULL,  -- 행 식별자 (첫 번째 컬럼 값)
        username NVARCHAR(100) NOT NULL,
        checked_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_view_checklists_unique UNIQUE (view_name, row_id, username)
    );

    CREATE INDEX IX_view_checklists_view_name ON view_checklists(view_name);
    CREATE INDEX IX_view_checklists_username ON view_checklists(username);
    CREATE INDEX IX_view_checklists_checked_at ON view_checklists(checked_at DESC);

    PRINT '✓ view_checklists 테이블 생성 완료';
END
ELSE
BEGIN
    PRINT '! view_checklists 테이블이 이미 존재합니다';
END
GO

-- 3. 샘플 데이터 (테스트용)
-- 실제 운영 환경에서는 제거하세요
/*
-- 샘플 뷰 생성 (테스트용)
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_sample_dashboard')
BEGIN
    EXEC('
    CREATE VIEW dbo.vw_sample_dashboard AS
    SELECT
        CAST(1 AS INT) AS id,
        CAST(''Task A'' AS NVARCHAR(100)) AS task_name,
        CAST(''진행중'' AS NVARCHAR(50)) AS status,
        CAST(''홍길동'' AS NVARCHAR(50)) AS assignee,
        CAST(''2025-01-15'' AS DATE) AS due_date
    UNION ALL
    SELECT 2, ''Task B'', ''완료'', ''김철수'', ''2025-01-20''
    UNION ALL
    SELECT 3, ''Task C'', ''대기'', ''이영희'', ''2025-01-25''
    ');

    PRINT '✓ vw_sample_dashboard 뷰 생성 완료';
END
GO

-- 샘플 설정 데이터
IF NOT EXISTS (SELECT * FROM view_configs WHERE view_name = 'dbo.vw_sample_dashboard')
BEGIN
    INSERT INTO view_configs
    (view_name, display_name, columns_config, enable_checklist, checklist_column_name, created_by, updated_by)
    VALUES (
        'dbo.vw_sample_dashboard',
        '대시보드 샘플',
        '[
            {"name":"id","display_name":"ID","visible":true,"order":0,"width":80},
            {"name":"task_name","display_name":"작업명","visible":true,"order":1,"width":200},
            {"name":"status","display_name":"상태","visible":true,"order":2,"width":100},
            {"name":"assignee","display_name":"담당자","visible":true,"order":3,"width":120},
            {"name":"due_date","display_name":"마감일","visible":true,"order":4,"width":120}
        ]',
        1,
        '확인',
        'system',
        'system'
    );

    PRINT '✓ 샘플 설정 데이터 추가 완료';
END
GO
*/

PRINT '';
PRINT '========================================';
PRINT 'SQL View Explorer 테이블 생성 완료';
PRINT '========================================';
PRINT '';
PRINT '다음 단계:';
PRINT '1. view_configs 테이블에 뷰 설정 저장';
PRINT '2. 프런트엔드에서 뷰 탐색기 사용';
PRINT '3. 체크리스트 기능 활성화';
GO
