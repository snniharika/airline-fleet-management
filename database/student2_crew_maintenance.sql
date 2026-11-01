
-- ============================================================
-- AIRLINE FLEET MANAGEMENT SYSTEM
-- STUDENT 2: CREW AND MAINTENANCE MODULE
-- Database: airline_management
-- ============================================================

USE airline_management;

-- ============================================================
-- 1. MAINTENANCE TYPE
-- ============================================================

CREATE TABLE IF NOT EXISTS MAINTENANCE_TYPE (
    maintenance_type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    interval_hours DECIMAL(10,2) NOT NULL,
    estimated_duration_hours DECIMAL(10,2) NOT NULL,
    severity_level VARCHAR(20) NOT NULL,

    CONSTRAINT chk_mt_interval
        CHECK (interval_hours > 0),

    CONSTRAINT chk_mt_duration
        CHECK (estimated_duration_hours > 0),

    CONSTRAINT chk_mt_severity
        CHECK (severity_level IN
            ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- ============================================================
-- 2. CREW LICENSE
-- ============================================================

CREATE TABLE IF NOT EXISTS CREW_LICENSE (
    license_id INT AUTO_INCREMENT PRIMARY KEY,
    crew_id INT NOT NULL,
    license_type VARCHAR(50) NOT NULL,
    license_number VARCHAR(50) NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    issuing_authority VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'VALID',

    CONSTRAINT fk_license_crew
        FOREIGN KEY (crew_id)
        REFERENCES CREW_MEMBER(crew_id),

    CONSTRAINT chk_license_dates
        CHECK (expiry_date >= issue_date),

    CONSTRAINT chk_license_status
        CHECK (status IN
            ('VALID', 'EXPIRED', 'SUSPENDED', 'REVOKED'))
);

-- ============================================================
-- 3. CREW ASSIGNMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS CREW_ASSIGNMENT (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    flight_id INT NOT NULL,
    crew_id INT NOT NULL,
    assigned_role VARCHAR(30) NOT NULL,
    assignment_status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hours_at_flight DECIMAL(10,2) NOT NULL DEFAULT 0,
    remarks TEXT NULL,

    CONSTRAINT fk_assignment_crew
        FOREIGN KEY (crew_id)
        REFERENCES CREW_MEMBER(crew_id),

    CONSTRAINT fk_assignment_flight
        FOREIGN KEY (flight_id)
        REFERENCES FLIGHT(flight_id),

    CONSTRAINT uq_crew_flight_role
        UNIQUE (crew_id, flight_id, assigned_role),

    CONSTRAINT chk_assignment_role
        CHECK (assigned_role IN
            ('CAPTAIN', 'FIRST_OFFICER', 'CABIN_CREW')),

    CONSTRAINT chk_assignment_status
        CHECK (assignment_status IN
            ('ASSIGNED', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),

    CONSTRAINT chk_assignment_hours
        CHECK (hours_at_flight >= 0)
);

-- ============================================================
-- 4. MAINTENANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS MAINTENANCE (
    maintenance_id INT AUTO_INCREMENT PRIMARY KEY,
    aircraft_id INT NOT NULL,
    maintenance_type_id INT NOT NULL,
    scheduled_start DATETIME NOT NULL,
    scheduled_end DATETIME,
    actual_start DATETIME,
    actual_end DATETIME,
    flight_hours_at_service DECIMAL(10,2) NOT NULL DEFAULT 0,
    maintenance_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    technician_name VARCHAR(100),
    cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    remarks TEXT,

    CONSTRAINT fk_maintenance_aircraft
        FOREIGN KEY (aircraft_id)
        REFERENCES AIRCRAFT(aircraft_id),

    CONSTRAINT fk_maintenance_type
        FOREIGN KEY (maintenance_type_id)
        REFERENCES MAINTENANCE_TYPE(maintenance_type_id),

    CONSTRAINT chk_maintenance_status
        CHECK (maintenance_status IN
            ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED',
             'CANCELLED', 'ON_HOLD')),

    CONSTRAINT chk_maintenance_priority
        CHECK (priority IN
            ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    CONSTRAINT chk_maintenance_cost
        CHECK (cost >= 0),

    CONSTRAINT chk_maintenance_flight_hours
        CHECK (flight_hours_at_service >= 0)
);

-- ============================================================
-- 5. MAINTENANCE PARTS INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS MAINTENANCE_PART (
    part_id INT AUTO_INCREMENT PRIMARY KEY,
    part_number VARCHAR(50) NOT NULL UNIQUE,
    part_name VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 5,
    part_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT chk_part_stock
        CHECK (stock_quantity >= 0),

    CONSTRAINT chk_part_cost
        CHECK (unit_cost >= 0),

    CONSTRAINT chk_part_reorder
        CHECK (reorder_level >= 0)
);

-- ============================================================
-- 6. MAINTENANCE PART USAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS MAINTENANCE_PART_USAGE (
    usage_id INT AUTO_INCREMENT PRIMARY KEY,
    maintenance_id INT NOT NULL,
    part_id INT NOT NULL,
    quantity_used INT NOT NULL,
    unit_cost_at_usage DECIMAL(10,2) NOT NULL,
    replacement_reason TEXT NOT NULL,

    CONSTRAINT fk_part_usage_maintenance
        FOREIGN KEY (maintenance_id)
        REFERENCES MAINTENANCE(maintenance_id),

    CONSTRAINT fk_part_usage_part
        FOREIGN KEY (part_id)
        REFERENCES MAINTENANCE_PART(part_id),

    CONSTRAINT chk_usage_quantity
        CHECK (quantity_used > 0),

    CONSTRAINT chk_usage_cost
        CHECK (unit_cost_at_usage >= 0)
);

-- ============================================================
-- 7. MAINTENANCE STATUS AUDIT
-- Supplementary table; not part of the 12 submitted relations.
-- ============================================================

CREATE TABLE IF NOT EXISTS MAINTENANCE_STATUS_AUDIT (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    maintenance_id INT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(100) DEFAULT 'SYSTEM',

    CONSTRAINT fk_audit_maintenance
        FOREIGN KEY (maintenance_id)
        REFERENCES MAINTENANCE(maintenance_id)
);

-- ============================================================
-- 8. INDEXES
-- Run after creating the Student 1 and Student 2 tables.
-- MySQL 8.0 does not support CREATE INDEX IF NOT EXISTS.
-- ============================================================

CREATE INDEX idx_crew_assignment_flight
    ON CREW_ASSIGNMENT (flight_id);

CREATE INDEX idx_crew_license_expiry
    ON CREW_LICENSE (crew_id, expiry_date);

CREATE INDEX idx_maintenance_aircraft_schedule
    ON MAINTENANCE (aircraft_id, scheduled_start, scheduled_end);

CREATE INDEX idx_maintenance_status
    ON MAINTENANCE (maintenance_status);

CREATE INDEX idx_maintenance_part_usage_maintenance
    ON MAINTENANCE_PART_USAGE (maintenance_id);

CREATE INDEX idx_maintenance_part_usage_part
    ON MAINTENANCE_PART_USAGE (part_id);

-- ============================================================
-- 9. AUDIT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_maintenance_status_audit;

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
-- 10. MAINTENANCE OVERVIEW VIEW
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
-- 11. CREW ASSIGNMENT VIEW
-- ============================================================

CREATE OR REPLACE VIEW crew_assignment_view AS
SELECT
    ca.assignment_id,
    cm.crew_id,
    cm.employee_code,
    cm.first_name,
    cm.last_name,
    ca.flight_id,
    f.flight_number,
    ca.assigned_role,
    ca.assignment_status,
    ca.assigned_at,
    ca.hours_at_flight,
    ca.remarks
FROM CREW_ASSIGNMENT ca
JOIN CREW_MEMBER cm
    ON ca.crew_id = cm.crew_id
JOIN FLIGHT f
    ON ca.flight_id = f.flight_id;

-- ============================================================
-- 12. STORED PROCEDURE:
-- AIRCRAFT MAINTENANCE STATUS
-- ============================================================

DROP PROCEDURE IF EXISTS GetAircraftMaintenanceStatus;

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
-- 13. USEFUL CREW QUERIES
-- ============================================================

-- View all crew members and their availability

SELECT
    crew_id,
    employee_code,
    first_name,
    last_name,
    crew_role,
    availability_status
FROM CREW_MEMBER;

-- View assignments for a particular flight

SELECT *
FROM crew_assignment_view
WHERE flight_id = 1;

-- Find expired or soon-to-expire licenses

SELECT
    cm.employee_code,
    cm.first_name,
    cm.last_name,
    cl.license_type,
    cl.license_number,
    cl.expiry_date,
    cl.status
FROM CREW_LICENSE cl
JOIN CREW_MEMBER cm
    ON cl.crew_id = cm.crew_id
WHERE cl.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
   OR cl.status <> 'VALID'
ORDER BY cl.expiry_date;

-- ============================================================
-- 14. USEFUL MAINTENANCE QUERIES
-- ============================================================

-- View all scheduled and active maintenance

SELECT *
FROM maintenance_overview_view
WHERE maintenance_status IN ('SCHEDULED', 'IN_PROGRESS');

-- Find parts that need reordering

SELECT
    part_id,
    part_name,
    part_number,
    manufacturer,
    stock_quantity,
    reorder_level,
    part_status
FROM MAINTENANCE_PART
WHERE stock_quantity <= reorder_level;

-- Calculate parts cost for each maintenance record

SELECT
    m.maintenance_id,
    COALESCE(
        SUM(mpu.quantity_used * mpu.unit_cost_at_usage), 0
    ) AS total_parts_cost
FROM MAINTENANCE m
LEFT JOIN MAINTENANCE_PART_USAGE mpu
    ON m.maintenance_id = mpu.maintenance_id
GROUP BY m.maintenance_id;

-- View maintenance status changes

SELECT *
FROM MAINTENANCE_STATUS_AUDIT
ORDER BY changed_at DESC;

-- Call the procedure for aircraft ID 1

CALL GetAircraftMaintenanceStatus(1);

-- ============================================================
-- END OF STUDENT 2 SQL SCRIPT
-- ============================================================
