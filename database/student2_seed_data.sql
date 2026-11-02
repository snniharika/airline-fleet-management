-- ============================================================
-- STUDENT 2: SAMPLE SEED DATA
-- Airline Fleet Management System
-- ============================================================
-- Prerequisites:
--   1. Create the Student 1 and Student 2 tables first.
--   2. Run Student 1's airport/aircraft/flight seed script first.
--   3. Run this file once the tables and Student 1 sample rows exist.
--
-- This script uses natural keys (airport_code, employee_code,
-- registration_id, flight_number, type_name, part_number) instead
-- of assuming that auto-increment IDs are the same on every system.
-- Existing matching sample rows are left unchanged.
-- ============================================================

-- ----------------------------
-- 1. MAINTENANCE TYPES
-- ----------------------------
INSERT INTO MAINTENANCE_TYPE
    (type_name, description, interval_hours, estimated_duration_hours, severity_level)
SELECT seed.type_name, seed.description, seed.interval_hours,
       seed.estimated_duration_hours, seed.severity_level
FROM (
    SELECT 'Routine Inspection' AS type_name,
           'Scheduled general aircraft inspection' AS description,
           500.00 AS interval_hours, 4.00 AS estimated_duration_hours,
           'LOW' AS severity_level
    UNION ALL
    SELECT 'Engine Inspection',
           'Inspection of engine components and operating condition',
           1000.00, 8.00, 'HIGH'
    UNION ALL
    SELECT 'Landing Gear Inspection',
           'Inspection of landing gear, wheels and braking components',
           600.00, 6.00, 'MEDIUM'
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM MAINTENANCE_TYPE mt WHERE mt.type_name = seed.type_name
);

-- ----------------------------
-- 2. CREW MEMBERS
-- ----------------------------
INSERT INTO CREW_MEMBER
    (employee_code, first_name, last_name, date_of_birth, phone, email,
     crew_role, hire_date, total_flight_hours, monthly_flight_hours,
     availability_status, base_airport_id)
SELECT seed.employee_code, seed.first_name, seed.last_name,
       seed.date_of_birth, seed.phone, seed.email, seed.crew_role,
       seed.hire_date, seed.total_flight_hours, seed.monthly_flight_hours,
       'AVAILABLE', a.airport_id
FROM (
    SELECT 'C1001' AS employee_code, 'Aarav' AS first_name, 'Sharma' AS last_name,
           '1985-04-12' AS date_of_birth, '+919800000101' AS phone,
           'aarav.sharma@example.com' AS email, 'PILOT' AS crew_role,
           '2012-06-01' AS hire_date, 4200.00 AS total_flight_hours,
           42.00 AS monthly_flight_hours, 'BLR' AS base_code
    UNION ALL SELECT 'C1002','Ishita','Rao','1988-09-21','+919800000102','ishita.rao@example.com','PILOT','2015-02-15',2800.00,36.00,'BLR'
    UNION ALL SELECT 'C1003','Rohan','Mehta','1990-01-08','+919800000103','rohan.mehta@example.com','CABIN_CREW','2017-07-10',1500.00,28.00,'DEL'
    UNION ALL SELECT 'C1004','Ananya','Iyer','1992-11-17','+919800000104','ananya.iyer@example.com','CABIN_CREW','2018-03-12',1200.00,24.00,'DEL'
    UNION ALL SELECT 'C1005','Kabir','Nair','1984-06-25','+919800000105','kabir.nair@example.com','PILOT','2011-08-20',5100.00,40.00,'BOM'
    UNION ALL SELECT 'C1006','Diya','Kapoor','1989-02-14','+919800000106','diya.kapoor@example.com','PILOT','2014-11-05',3100.00,32.00,'BOM'
    UNION ALL SELECT 'C1007','Vihaan','Reddy','1991-07-30','+919800000107','vihaan.reddy@example.com','CABIN_CREW','2016-04-18',1800.00,26.00,'MAA'
    UNION ALL SELECT 'C1008','Meera','Das','1993-12-03','+919800000108','meera.das@example.com','CABIN_CREW','2019-01-07',950.00,20.00,'MAA'
) AS seed
JOIN AIRPORT a ON a.airport_code = seed.base_code
WHERE NOT EXISTS (
    SELECT 1 FROM CREW_MEMBER cm WHERE cm.employee_code = seed.employee_code
);

-- ----------------------------
-- 3. CREW LICENSES
-- ----------------------------
INSERT INTO CREW_LICENSE
    (crew_id, license_type, license_number, issue_date, expiry_date,
     issuing_authority, status)
SELECT cm.crew_id, seed.license_type, seed.license_number,
       seed.issue_date, seed.expiry_date, seed.issuing_authority, 'VALID'
FROM (
    SELECT 'C1001' AS employee_code, 'PILOT_LICENSE' AS license_type,
           'LIC-C1001-01' AS license_number, '2022-01-01' AS issue_date,
           '2028-01-01' AS expiry_date, 'DGCA' AS issuing_authority
    UNION ALL SELECT 'C1002','PILOT_LICENSE','LIC-C1002-01','2022-02-01','2028-02-01','DGCA'
    UNION ALL SELECT 'C1003','CABIN_CREW','LIC-C1003-01','2023-03-01','2027-03-01','DGCA'
    UNION ALL SELECT 'C1004','CABIN_CREW','LIC-C1004-01','2023-04-01','2027-04-01','DGCA'
    UNION ALL SELECT 'C1005','PILOT_LICENSE','LIC-C1005-01','2021-05-01','2027-05-01','DGCA'
    UNION ALL SELECT 'C1006','PILOT_LICENSE','LIC-C1006-01','2022-06-01','2028-06-01','DGCA'
    UNION ALL SELECT 'C1007','CABIN_CREW','LIC-C1007-01','2023-07-01','2027-07-01','DGCA'
    UNION ALL SELECT 'C1008','CABIN_CREW','LIC-C1008-01','2023-08-01','2027-08-01','DGCA'
) AS seed
JOIN CREW_MEMBER cm ON cm.employee_code = seed.employee_code
WHERE NOT EXISTS (
    SELECT 1 FROM CREW_LICENSE cl WHERE cl.license_number = seed.license_number
);

-- ----------------------------
-- 4. CREW ASSIGNMENTS FOR AI101
--    Four distinct crew members; IDs are looked up dynamically.
-- ----------------------------
INSERT INTO CREW_ASSIGNMENT
    (flight_id, crew_id, assigned_role, assignment_status,
     assigned_at, hours_at_flight, remarks)
SELECT f.flight_id, cm.crew_id, seed.assigned_role, 'ASSIGNED',
       CURRENT_TIMESTAMP, cm.total_flight_hours,
       'Sample Student 2 seed assignment'
FROM (
    SELECT 'C1001' AS employee_code, 'CAPTAIN' AS assigned_role
    UNION ALL SELECT 'C1002','FIRST_OFFICER'
    UNION ALL SELECT 'C1003','CABIN_CREW'
    UNION ALL SELECT 'C1004','CABIN_CREW'
) AS seed
JOIN CREW_MEMBER cm ON cm.employee_code = seed.employee_code
JOIN FLIGHT f ON f.flight_number = 'AI101'
WHERE NOT EXISTS (
    SELECT 1 FROM CREW_ASSIGNMENT ca
    WHERE ca.flight_id = f.flight_id
      AND ca.crew_id = cm.crew_id
      AND ca.assigned_role = seed.assigned_role
);

-- ----------------------------
-- 5. MAINTENANCE RECORDS
--    Scheduled after the sample flights to avoid flight overlap.
-- ----------------------------
INSERT INTO MAINTENANCE
    (aircraft_id, maintenance_type_id, scheduled_start, scheduled_end,
     flight_hours_at_service, maintenance_status, priority,
     technician_name, cost, remarks)
SELECT ac.aircraft_id, mt.maintenance_type_id,
       seed.scheduled_start, seed.scheduled_end,
       ac.total_flight_hours, 'SCHEDULED', seed.priority,
       seed.technician_name, seed.cost, seed.remarks
FROM (
    SELECT 'VT-ABC' AS registration_id, 'Routine Inspection' AS type_name,
           '2026-11-03 09:00:00' AS scheduled_start,
           '2026-11-03 13:00:00' AS scheduled_end,
           'MEDIUM' AS priority, 'Technician A' AS technician_name,
           25000.00 AS cost, 'Sample routine inspection' AS remarks
    UNION ALL
    SELECT 'VT-DEF','Engine Inspection','2026-11-04 08:00:00',
           '2026-11-04 16:00:00','HIGH','Technician B',65000.00,
           'Sample engine inspection'
    UNION ALL
    SELECT 'VT-GHI','Landing Gear Inspection','2026-11-05 10:00:00',
           '2026-11-05 16:00:00','MEDIUM','Technician C',40000.00,
           'Sample landing gear inspection'
) AS seed
JOIN AIRCRAFT ac ON ac.registration_id = seed.registration_id
JOIN MAINTENANCE_TYPE mt ON mt.type_name = seed.type_name
WHERE NOT EXISTS (
    SELECT 1 FROM MAINTENANCE m
    WHERE m.aircraft_id = ac.aircraft_id
      AND m.scheduled_start = seed.scheduled_start
);

-- ----------------------------
-- 6. MAINTENANCE PARTS
-- ----------------------------
INSERT INTO MAINTENANCE_PART
    (part_number, part_name, manufacturer, unit_cost,
     stock_quantity, reorder_level, part_status)
SELECT seed.part_number, seed.part_name, seed.manufacturer,
       seed.unit_cost, seed.stock_quantity, seed.reorder_level, 'AVAILABLE'
FROM (
    SELECT 'FLT-OIL-001' AS part_number, 'Engine Oil Filter' AS part_name,
           'AeroParts' AS manufacturer, 850.00 AS unit_cost,
           28 AS stock_quantity, 10 AS reorder_level
    UNION ALL SELECT 'FLT-BRK-002','Brake Assembly Kit','SkyTech',12500.00,12,4
    UNION ALL SELECT 'FLT-SEAL-003','Hydraulic Seal','AeroParts',1450.00,24,8
    UNION ALL SELECT 'FLT-SNS-004','Engine Temperature Sensor','AviaWorks',6200.00,8,3
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM MAINTENANCE_PART p WHERE p.part_number = seed.part_number
);

-- ----------------------------
-- 7. PART USAGE
--    Records sample consumption against the VT-DEF maintenance job.
-- ----------------------------
INSERT INTO MAINTENANCE_PART_USAGE
    (maintenance_id, part_id, quantity_used, unit_cost_at_usage,
     replacement_reason)
SELECT m.maintenance_id, p.part_id, seed.quantity_used,
       p.unit_cost, seed.replacement_reason
FROM (
    SELECT 'VT-DEF' AS registration_id,
           '2026-11-04 08:00:00' AS scheduled_start,
           'FLT-OIL-001' AS part_number, 2 AS quantity_used,
           'Routine replacement during engine inspection' AS replacement_reason
    UNION ALL
    SELECT 'VT-DEF','2026-11-04 08:00:00','FLT-SEAL-003',1,
           'Replacement of worn hydraulic seal'
) AS seed
JOIN AIRCRAFT ac ON ac.registration_id = seed.registration_id
JOIN MAINTENANCE m ON m.aircraft_id = ac.aircraft_id
                  AND m.scheduled_start = seed.scheduled_start
JOIN MAINTENANCE_PART p ON p.part_number = seed.part_number
WHERE NOT EXISTS (
    SELECT 1 FROM MAINTENANCE_PART_USAGE u
    WHERE u.maintenance_id = m.maintenance_id
      AND u.part_id = p.part_id
);

-- ----------------------------
-- 8. VERIFICATION QUERIES
-- ----------------------------
SELECT employee_code, first_name, last_name, crew_role, availability_status
FROM CREW_MEMBER
WHERE employee_code BETWEEN 'C1001' AND 'C1008'
ORDER BY employee_code;

SELECT f.flight_number, cm.employee_code, ca.assigned_role, ca.assignment_status
FROM CREW_ASSIGNMENT ca
JOIN FLIGHT f ON f.flight_id = ca.flight_id
JOIN CREW_MEMBER cm ON cm.crew_id = ca.crew_id
WHERE f.flight_number = 'AI101'
ORDER BY ca.assigned_role;

SELECT ac.registration_id, mt.type_name, m.scheduled_start,
       m.scheduled_end, m.maintenance_status, m.priority
FROM MAINTENANCE m
JOIN AIRCRAFT ac ON ac.aircraft_id = m.aircraft_id
JOIN MAINTENANCE_TYPE mt ON mt.maintenance_type_id = m.maintenance_type_id
WHERE m.scheduled_start >= '2026-11-03 00:00:00'
ORDER BY m.scheduled_start;

SELECT part_number, part_name, stock_quantity, reorder_level, part_status
FROM MAINTENANCE_PART
WHERE part_number LIKE 'FLT-%'
ORDER BY part_number;
