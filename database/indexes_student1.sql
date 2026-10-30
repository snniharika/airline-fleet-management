USE airline_management;

-- The following indexes already exist in the database schema.
-- They are defined when the AIRCRAFT and FLIGHT tables are created.
-- Do not recreate them, as MySQL will report duplicate key names.

-- FLIGHT:
-- idx_flight_aircraft_schedule
-- (aircraft_id, scheduled_departure, scheduled_arrival)

-- idx_flight_departure_schedule
-- (departure_airport_id, scheduled_departure)

-- idx_flight_arrival_schedule
-- (arrival_airport_id, scheduled_arrival)

-- AIRCRAFT:
-- idx_aircraft_status
-- (aircraft_status)

-- idx_aircraft_model
-- (model_id)
