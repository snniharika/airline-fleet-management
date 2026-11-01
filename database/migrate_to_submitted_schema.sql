
-- ============================================================
-- AIRLINE FLEET MANAGEMENT SYSTEM
-- MIGRATION TO SUBMITTED 12-RELATION SCHEMA
-- Date: 2026-11-01
-- Database: airline_management
--
-- IMPORTANT:
-- 1. A full database backup must exist before execution.
-- 2. This migration preserves existing primary keys and records.
-- 3. Removed column data is archived in migration_archive_20261101.
-- 4. Review this script before executing it.
-- ============================================================

USE airline_management;

-- ============================================================
-- 1. REMOVE OBJECTS THAT DEPEND ON COLUMNS BEING RENAMED
-- ============================================================

DROP VIEW IF EXISTS maintenance_overview_view;
DROP VIEW IF EXISTS crew_assignment_view;

DROP TRIGGER IF EXISTS trg_maintenance_status_audit;

DROP PROCEDURE IF EXISTS GetAircraftMaintenanceStatus;

-- ============================================================
-- 2. ARCHIVE DATA FROM COLUMNS THAT WILL BE REMOVED
-- ============================================================

CREATE TABLE migration_archive_20261101 (
    archive_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_table VARCHAR(100) NOT NULL,
    source_record_id INT NOT NULL,
    archived_column VARCHAR(100) NOT NULL,
    archived_value LONGTEXT,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Preserve maintenance creation timestamps.

INSERT INTO migration_archive_20261101
    (source_table, source_record_id, archived_column, archived_value)
SELECT
    'MAINTENANCE',
    maintenance_id,
    'created_at',
    CAST(created_at AS CHAR)
FROM MAINTENANCE;

-- Preserve parts descriptions before removing that column.

INSERT INTO migration_archive_20261101
    (source_table, source_record_id, archived_column, archived_value)
SELECT
    'MAINTENANCE_PART',
    part_id,
    'description',
    description
FROM MAINTENANCE_PART
WHERE description IS NOT NULL;

-- Preserve part usage timestamps before removing that column.

INSERT INTO migration_archive_20261101
    (source_table, source_record_id, archived_column, archived_value)
SELECT
    'MAINTENANCE_PART_USAGE',
    usage_id,
    'used_at',
    CAST(used_at AS CHAR)
FROM MAINTENANCE_PART_USAGE;

-- ============================================================
-- 3. AIRCRAFT
-- registration_no -> registration_id
-- ============================================================

ALTER TABLE AIRCRAFT
    CHANGE COLUMN registration_no registration_id
    VARCHAR(20) NOT NULL;

-- ============================================================
-- 4. CREW_ASSIGNMENT
-- Add missing attributes and update role values.
-- ============================================================

ALTER TABLE CREW_ASSIGNMENT
    DROP CHECK chk_assignment_role;

UPDATE CREW_ASSIGNMENT
SET assigned_role = CASE
    WHEN assigned_role = 'PILOT' THEN 'CAPTAIN'
    WHEN assigned_role = 'CO_PILOT' THEN 'FIRST_OFFICER'
    ELSE assigned_role
END;

ALTER TABLE CREW_ASSIGNMENT
    ADD COLUMN hours_at_flight DECIMAL(10,2)
        NOT NULL DEFAULT 0,
    ADD COLUMN remarks TEXT NULL;

ALTER TABLE CREW_ASSIGNMENT
    ADD CONSTRAINT chk_assignment_role
    CHECK (assigned_role IN
        ('CAPTAIN', 'FIRST_OFFICER', 'CABIN_CREW'));

ALTER TABLE CREW_ASSIGNMENT
    ADD CONSTRAINT chk_assignment_hours
    CHECK (hours_at_flight >= 0);

-- ============================================================
-- 5. MAINTENANCE
-- Rename old columns and add missing attributes.
-- ============================================================

ALTER TABLE MAINTENANCE
    DROP CHECK chk_maintenance_cost;

ALTER TABLE MAINTENANCE
    CHANGE COLUMN description remarks TEXT NULL,
    CHANGE COLUMN maintenance_cost cost DECIMAL(12,2)
        NOT NULL DEFAULT 0,
    DROP COLUMN created_at,
    ADD COLUMN flight_hours_at_service DECIMAL(10,2)
        NOT NULL DEFAULT 0,
    ADD COLUMN priority VARCHAR(20)
        NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN technician_name VARCHAR(100) NULL;

ALTER TABLE MAINTENANCE
    ADD CONSTRAINT chk_maintenance_cost
        CHECK (cost >= 0),
    ADD CONSTRAINT chk_maintenance_priority
        CHECK (priority IN
            ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    ADD CONSTRAINT chk_maintenance_flight_hours
        CHECK (flight_hours_at_service >= 0);

-- ============================================================
-- 6. MAINTENANCE_PART
-- Rename stock column and add missing attributes.
-- ============================================================

ALTER TABLE MAINTENANCE_PART
    DROP CHECK chk_part_stock;

ALTER TABLE MAINTENANCE_PART
    CHANGE COLUMN quantity_in_stock stock_quantity
        INT NOT NULL DEFAULT 0,
    ADD COLUMN manufacturer VARCHAR(100)
        NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN part_status VARCHAR(30)
        NOT NULL DEFAULT 'AVAILABLE';

-- Derive an initial status from the existing stock values.

UPDATE MAINTENANCE_PART
SET part_status = CASE
    WHEN stock_quantity = 0 THEN 'OUT_OF_STOCK'
    WHEN stock_quantity <= reorder_level THEN 'LOW_STOCK'
    ELSE 'AVAILABLE'
END;
ALTER TABLE MAINTENANCE_PART
    DROP COLUMN description;

ALTER TABLE MAINTENANCE_PART
    ADD CONSTRAINT chk_part_stock
        CHECK (stock_quantity >= 0);

-- ============================================================
-- 7. MAINTENANCE_PART_USAGE
-- Add replacement_reason and remove used_at.
-- ============================================================

ALTER TABLE MAINTENANCE_PART_USAGE
    ADD COLUMN replacement_reason TEXT NULL;

UPDATE MAINTENANCE_PART_USAGE
SET replacement_reason = 'Not recorded (legacy record)'
WHERE replacement_reason IS NULL;

ALTER TABLE MAINTENANCE_PART_USAGE
    MODIFY COLUMN replacement_reason TEXT NOT NULL,
    DROP COLUMN used_at;

-- ============================================================
-- 8. USER
-- Create the missing submitted relation.
-- ============================================================

CREATE TABLE IF NOT EXISTS `USER` (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL,

    CONSTRAINT uq_user_username UNIQUE (username),
    CONSTRAINT uq_user_email UNIQUE (email)
);

-- ============================================================
-- 9. RECREATE MAINTENANCE OVERVIEW VIEW
-- ============================================================

CREATE OR REPLACE VIEW maintenance_overview_view AS
SELECT
    m.maintenance_id,
    a.registration_id,
    mt.type_name AS maintenance_type,
    m.scheduled_start,
    m.scheduled_end,
    m.maintenance_status,
    m.priority,
    m.technician_name,
    m.flight_hours_at_service,
    m.cost,
    m.remarks
FROM MAINTENANCE m
JOIN AIRCRAFT a
    ON m.aircraft_id = a.aircraft_id
JOIN MAINTENANCE_TYPE mt
    ON m.maintenance_type_id = mt.maintenance_type_id;

-- ============================================================
-- 10. RECREATE CREW ASSIGNMENT VIEW
-- ============================================================

CREATE OR REPLACE VIEW crew_assignment_view AS
SELECT
    ca.assignment_id,
    cm.crew_id,
    cm.employee_code,
    cm.first_name,
    cm.last_name,
    ca.flight_id,
    ca.assigned_role,
    ca.assignment_status,
    ca.assigned_at,
    ca.hours_at_flight,
    ca.remarks
FROM CREW_ASSIGNMENT ca
JOIN CREW_MEMBER cm
    ON ca.crew_id = cm.crew_id;

-- ============================================================
-- 11. RECREATE MAINTENANCE AUDIT TRIGGER
-- ============================================================

DELIMITER $$

CREATE TRIGGER trg_maintenance_status_audit
AFTER UPDATE ON MAINTENANCE
FOR EACH ROW
BEGIN
    IF OLD.maintenance_status <> NEW.maintenance_status THEN
        INSERT INTO MAINTENANCE_STATUS_AUDIT (
            maintenance_id,
            old_status,
            new_status,
            changed_by
        )
        VALUES (
            NEW.maintenance_id,
            OLD.maintenance_status,
            NEW.maintenance_status,
            CURRENT_USER()
        );
    END IF;
END$$

DELIMITER ;

-- ============================================================
-- 12. RECREATE STORED PROCEDURE
-- ============================================================

DELIMITER $$

CREATE PROCEDURE GetAircraftMaintenanceStatus(
    IN p_aircraft_id INT
)
BEGIN
    DECLARE v_aircraft_count INT DEFAULT 0;

    SELECT COUNT(*)
    INTO v_aircraft_count
    FROM AIRCRAFT
    WHERE aircraft_id = p_aircraft_id;

    IF v_aircraft_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Aircraft not found.';
    END IF;

    SELECT
        a.aircraft_id,
        a.registration_id,
        a.total_flight_hours,
        am.maintenance_interval_hours,
        CASE
            WHEN COALESCE(am.maintenance_interval_hours, 0) <= 0
                THEN NULL
            WHEN a.next_maintenance_due_hours IS NOT NULL
                THEN GREATEST(
                    a.next_maintenance_due_hours - a.total_flight_hours,
                    0
                )
            ELSE
                CASE
                    WHEN a.total_flight_hours > 0
                         AND MOD(
                             a.total_flight_hours,
                             am.maintenance_interval_hours
                         ) = 0
                        THEN 0
                    ELSE GREATEST(
                        am.maintenance_interval_hours
                            - MOD(
                                a.total_flight_hours,
                                am.maintenance_interval_hours
                            ),
                        0
                    )
                END
        END AS hours_remaining,
        a.aircraft_status
    FROM AIRCRAFT a
    JOIN AIRCRAFT_MODEL am
        ON am.model_id = a.model_id
    WHERE a.aircraft_id = p_aircraft_id;
END$$

DELIMITER ;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
