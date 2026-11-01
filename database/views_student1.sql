USE airline_management;

CREATE OR REPLACE VIEW flight_schedule_view AS
SELECT
    f.flight_id,
    f.flight_number,
    a.registration_id,
    am.model_name,
    dep.airport_code AS departure_airport,
    arr.airport_code AS arrival_airport,
    f.scheduled_departure,
    f.scheduled_arrival,
    f.flight_status
FROM flight f
JOIN aircraft a
    ON f.aircraft_id = a.aircraft_id
JOIN aircraft_model am
    ON a.model_id = am.model_id
JOIN airport dep
    ON f.departure_airport_id = dep.airport_id
JOIN airport arr
    ON f.arrival_airport_id = arr.airport_id;
