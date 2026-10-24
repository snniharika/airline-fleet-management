USE airline_management;

CREATE INDEX idx_flight_aircraft_schedule
ON FLIGHT (aircraft_id, scheduled_departure, scheduled_arrival);

CREATE INDEX idx_flight_departure_schedule
ON FLIGHT (departure_airport_id, scheduled_departure);

CREATE INDEX idx_flight_arrival_schedule
ON FLIGHT (arrival_airport_id, scheduled_arrival);

CREATE INDEX idx_aircraft_status
ON AIRCRAFT (aircraft_status);

CREATE INDEX idx_aircraft_model
ON AIRCRAFT (model_id);
