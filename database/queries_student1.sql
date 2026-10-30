USE airline_management;

-- Q1: Display all aircraft with their model and current airport.
SELECT
    a.aircraft_id,
    a.registration_no,
    am.model_name,
    am.manufacturer,
    ap.airport_code AS current_airport,
    a.aircraft_status,
    a.total_flight_hours
FROM AIRCRAFT a
JOIN AIRCRAFT_MODEL am
    ON a.model_id = am.model_id
JOIN AIRPORT ap
    ON a.current_airport_id = ap.airport_id;


-- Q2: Display all scheduled flights with aircraft registration.
SELECT
    f.flight_id,
    f.flight_number,
    a.registration_no,
    f.scheduled_departure,
    f.scheduled_arrival,
    f.flight_status
FROM FLIGHT f
JOIN AIRCRAFT a
    ON f.aircraft_id = a.aircraft_id
ORDER BY f.scheduled_departure;


-- Q3: Display flight details with departure and arrival airports.
SELECT
    f.flight_number,
    dep.airport_code AS departure_airport,
    arr.airport_code AS arrival_airport,
    f.scheduled_departure,
    f.scheduled_arrival,
    f.flight_status
FROM FLIGHT f
JOIN AIRPORT dep
    ON f.departure_airport_id = dep.airport_id
JOIN AIRPORT arr
    ON f.arrival_airport_id = arr.airport_id
ORDER BY f.scheduled_departure;


-- Q4: Count the aircraft associated with each model.
SELECT
    am.model_id,
    am.model_name,
    COUNT(a.aircraft_id) AS aircraft_count
FROM AIRCRAFT_MODEL am
LEFT JOIN AIRCRAFT a
    ON am.model_id = a.model_id
GROUP BY am.model_id, am.model_name;


-- Q5: Calculate the number of flights assigned to each aircraft.
SELECT
    a.aircraft_id,
    a.registration_no,
    COUNT(f.flight_id) AS flight_count
FROM AIRCRAFT a
LEFT JOIN FLIGHT f
    ON a.aircraft_id = f.aircraft_id
GROUP BY a.aircraft_id, a.registration_no;


-- Q6: Calculate recorded flight hours for each aircraft.
SELECT
    a.aircraft_id,
    a.registration_no,
    COALESCE(SUM(f.flight_hours_recorded), 0) AS recorded_flight_hours
FROM AIRCRAFT a
LEFT JOIN FLIGHT f
    ON a.aircraft_id = f.aircraft_id
GROUP BY a.aircraft_id, a.registration_no;


-- Q7: Find aircraft that have no scheduled flights.
SELECT
    a.aircraft_id,
    a.registration_no
FROM AIRCRAFT a
WHERE NOT EXISTS (
    SELECT 1
    FROM FLIGHT f
    WHERE f.aircraft_id = a.aircraft_id
);


-- Q8: Find aircraft whose cumulative flight hours have reached
-- or exceeded their next maintenance threshold.
SELECT
    a.aircraft_id,
    a.registration_no,
    a.total_flight_hours,
    a.next_maintenance_due_hours
FROM AIRCRAFT a
WHERE a.next_maintenance_due_hours IS NOT NULL
  AND a.total_flight_hours >= a.next_maintenance_due_hours;


-- Q9: Count flights by status.
SELECT
    flight_status,
    COUNT(*) AS flight_count
FROM FLIGHT
GROUP BY flight_status;


-- Q10: Find flights scheduled to depart from a specified airport.
-- Replace 'BLR' with an airport code that exists in AIRPORT.
SELECT
    f.flight_number,
    dep.airport_code AS departure_airport,
    arr.airport_code AS arrival_airport,
    f.scheduled_departure
FROM FLIGHT f
JOIN AIRPORT dep
    ON f.departure_airport_id = dep.airport_id
JOIN AIRPORT arr
    ON f.arrival_airport_id = arr.airport_id
WHERE dep.airport_code = 'BLR'
ORDER BY f.scheduled_departure;
