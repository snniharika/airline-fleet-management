-- =========================================================
-- STUDENT 1: SAMPLE AIRPORT DATA
-- =========================================================

INSERT INTO AIRPORT
    (airport_code, airport_name, city, country, timezone, terminal_count)
VALUES
    ('BLR', 'Kempegowda International Airport', 'Bengaluru', 'India', 'Asia/Kolkata', 2),
    ('DEL', 'Indira Gandhi International Airport', 'Delhi', 'India', 'Asia/Kolkata', 3),
    ('BOM', 'Chhatrapati Shivaji Maharaj International Airport', 'Mumbai', 'India', 'Asia/Kolkata', 2),
    ('MAA', 'Chennai International Airport', 'Chennai', 'India', 'Asia/Kolkata', 4)
ON DUPLICATE KEY UPDATE
    airport_name = VALUES(airport_name),
    city = VALUES(city),
    country = VALUES(country),
    timezone = VALUES(timezone),
    terminal_count = VALUES(terminal_count);


-- =========================================================
-- STUDENT 1: SAMPLE AIRCRAFT MODEL DATA
-- =========================================================

INSERT INTO AIRCRAFT_MODEL
    (
        model_name,
        manufacturer,
        seat_capacity,
        max_flight_hours,
        maintenance_interval_hours,
        minimum_crew_required
    )
VALUES
    ('A320neo', 'Airbus', 180, 60000.00, 500.00, 4),
    ('B737-800', 'Boeing', 189, 65000.00, 500.00, 4),
    ('A321neo', 'Airbus', 220, 60000.00, 600.00, 5)
ON DUPLICATE KEY UPDATE
    seat_capacity = VALUES(seat_capacity),
    max_flight_hours = VALUES(max_flight_hours),
    maintenance_interval_hours = VALUES(maintenance_interval_hours),
    minimum_crew_required = VALUES(minimum_crew_required);


-- =========================================================
-- STUDENT 1: SAMPLE AIRCRAFT DATA
-- =========================================================

INSERT INTO AIRCRAFT
    (
        registration_no,
        model_id,
        current_airport_id,
        manufacture_date,
        purchase_date,
        total_flight_hours,
        total_flight_cycles,
        aircraft_status,
        last_maintenance_date,
        next_maintenance_due_hours
    )
SELECT
    'VT-ABC',
    am.model_id,
    a.airport_id,
    '2020-01-15',
    '2020-03-01',
    1200.00,
    650,
    'ACTIVE',
    '2026-08-01',
    1500.00
FROM AIRCRAFT_MODEL am
JOIN AIRPORT a ON a.airport_code = 'BLR'
WHERE am.manufacturer = 'Airbus'
  AND am.model_name = 'A320neo'
ON DUPLICATE KEY UPDATE
    model_id = VALUES(model_id),
    current_airport_id = VALUES(current_airport_id),
    total_flight_hours = VALUES(total_flight_hours),
    total_flight_cycles = VALUES(total_flight_cycles),
    aircraft_status = VALUES(aircraft_status),
    next_maintenance_due_hours = VALUES(next_maintenance_due_hours);


INSERT INTO AIRCRAFT
    (
        registration_no,
        model_id,
        current_airport_id,
        manufacture_date,
        purchase_date,
        total_flight_hours,
        total_flight_cycles,
        aircraft_status,
        last_maintenance_date,
        next_maintenance_due_hours
    )
SELECT
    'VT-DEF',
    am.model_id,
    a.airport_id,
    '2021-05-10',
    '2021-07-01',
    800.00,
    420,
    'ACTIVE',
    '2026-07-15',
    1000.00
FROM AIRCRAFT_MODEL am
JOIN AIRPORT a ON a.airport_code = 'DEL'
WHERE am.manufacturer = 'Boeing'
  AND am.model_name = 'B737-800'
ON DUPLICATE KEY UPDATE
    model_id = VALUES(model_id),
    current_airport_id = VALUES(current_airport_id),
    total_flight_hours = VALUES(total_flight_hours),
    total_flight_cycles = VALUES(total_flight_cycles),
    aircraft_status = VALUES(aircraft_status),
    next_maintenance_due_hours = VALUES(next_maintenance_due_hours);


INSERT INTO AIRCRAFT
    (
        registration_no,
        model_id,
        current_airport_id,
        manufacture_date,
        purchase_date,
        total_flight_hours,
        total_flight_cycles,
        aircraft_status,
        last_maintenance_date,
        next_maintenance_due_hours
    )
SELECT
    'VT-GHI',
    am.model_id,
    a.airport_id,
    '2022-02-20',
    '2022-04-01',
    400.00,
    210,
    'ACTIVE',
    '2026-09-01',
    900.00
FROM AIRCRAFT_MODEL am
JOIN AIRPORT a ON a.airport_code = 'BOM'
WHERE am.manufacturer = 'Airbus'
  AND am.model_name = 'A321neo'
ON DUPLICATE KEY UPDATE
    model_id = VALUES(model_id),
    current_airport_id = VALUES(current_airport_id),
    total_flight_hours = VALUES(total_flight_hours),
    total_flight_cycles = VALUES(total_flight_cycles),
    aircraft_status = VALUES(aircraft_status),
    next_maintenance_due_hours = VALUES(next_maintenance_due_hours);


-- =========================================================
-- STUDENT 1: SAMPLE FLIGHT SCHEDULE DATA
-- =========================================================

INSERT INTO FLIGHT
    (
        flight_number,
        aircraft_id,
        departure_airport_id,
        arrival_airport_id,
        scheduled_departure,
        scheduled_arrival,
        flight_status
    )
SELECT
    'AI101',
    ac.aircraft_id,
    dep.airport_id,
    arr.airport_id,
    '2026-11-01 08:00:00',
    '2026-11-01 10:30:00',
    'SCHEDULED'
FROM AIRCRAFT ac
JOIN AIRPORT dep ON dep.airport_code = 'BLR'
JOIN AIRPORT arr ON arr.airport_code = 'DEL'
WHERE ac.registration_no = 'VT-ABC'
  AND NOT EXISTS (
      SELECT 1
      FROM FLIGHT f
      WHERE f.flight_number = 'AI101'
  );


INSERT INTO FLIGHT
    (
        flight_number,
        aircraft_id,
        departure_airport_id,
        arrival_airport_id,
        scheduled_departure,
        scheduled_arrival,
        flight_status
    )
SELECT
    'AI202',
    ac.aircraft_id,
    dep.airport_id,
    arr.airport_id,
    '2026-11-01 12:00:00',
    '2026-11-01 14:00:00',
    'SCHEDULED'
FROM AIRCRAFT ac
JOIN AIRPORT dep ON dep.airport_code = 'DEL'
JOIN AIRPORT arr ON arr.airport_code = 'BOM'
WHERE ac.registration_no = 'VT-DEF'
  AND NOT EXISTS (
      SELECT 1
      FROM FLIGHT f
      WHERE f.flight_number = 'AI202'
  );


INSERT INTO FLIGHT
    (
        flight_number,
        aircraft_id,
        departure_airport_id,
        arrival_airport_id,
        scheduled_departure,
        scheduled_arrival,
        flight_status
    )
SELECT
    'AI303',
    ac.aircraft_id,
    dep.airport_id,
    arr.airport_id,
    '2026-11-02 09:00:00',
    '2026-11-02 11:00:00',
    'SCHEDULED'
FROM AIRCRAFT ac
JOIN AIRPORT dep ON dep.airport_code = 'BOM'
JOIN AIRPORT arr ON arr.airport_code = 'MAA'
WHERE ac.registration_no = 'VT-GHI'
  AND NOT EXISTS (
      SELECT 1
      FROM FLIGHT f
      WHERE f.flight_number = 'AI303'
  );


INSERT INTO FLIGHT
    (
        flight_number,
        aircraft_id,
        departure_airport_id,
        arrival_airport_id,
        scheduled_departure,
        scheduled_arrival,
        flight_status
    )
SELECT
    'AI404',
    ac.aircraft_id,
    dep.airport_id,
    arr.airport_id,
    '2026-11-02 13:00:00',
    '2026-11-02 15:30:00',
    'SCHEDULED'
FROM AIRCRAFT ac
JOIN AIRPORT dep ON dep.airport_code = 'BLR'
JOIN AIRPORT arr ON arr.airport_code = 'MAA'
WHERE ac.registration_no = 'VT-ABC'
  AND NOT EXISTS (
      SELECT 1
      FROM FLIGHT f
      WHERE f.flight_number = 'AI404'
  );
