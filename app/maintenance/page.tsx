
"use client";

import { useCallback, useEffect, useState } from "react";

type MaintenanceRecord = {
  maintenance_id: number;
  aircraft_id: number;
  maintenance_type_id: number;
  type_name?: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  maintenance_status: string;
  remarks?: string | null;
  cost: number;
};

type AircraftOption = {
  aircraft_id: number;
  registration_id: string;
};

type MaintenanceTypeOption = {
  maintenance_type_id: number;
  type_name: string;
};

type FormData = {
  aircraft_id: string;
  maintenance_type_id: string;
  scheduled_start: string;
  scheduled_end: string;
  remarks: string;
};

const initialForm: FormData = {
  aircraft_id: "",
  maintenance_type_id: "",
  scheduled_start: "",
  scheduled_end: "",
  remarks: "",
};

export default function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [aircraft, setAircraft] = useState<AircraftOption[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<
    MaintenanceTypeOption[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);

  const fetchMaintenance = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/maintenance");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to fetch maintenance records"
        );
      }

      setRecords(Array.isArray(data) ? data : data.records || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      setOptionsLoading(true);

      const response = await fetch("/api/maintenance/options");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load form options");
      }

      setAircraft(data.aircraft || []);
      setMaintenanceTypes(data.maintenanceTypes || []);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to load form options"
      );
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaintenance();
    fetchOptions();
  }, [fetchMaintenance, fetchOptions]);

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFormError("");
    setSuccess("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFormError("");
    setSuccess("");

    if (
      !form.aircraft_id ||
      !form.maintenance_type_id ||
      !form.scheduled_start ||
      !form.scheduled_end
    ) {
      setFormError("Please fill in all required fields.");
      return;
    }

    if (
      new Date(form.scheduled_end) <=
      new Date(form.scheduled_start)
    ) {
      setFormError("Scheduled end must be later than scheduled start.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to schedule maintenance"
        );
      }

      setSuccess("Maintenance scheduled successfully!");
      setForm(initialForm);
      setShowForm(false);

      await fetchMaintenance();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Something went wrong while scheduling maintenance"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords =
    filter === "ALL"
      ? records
      : records.filter(
          (record) => record.maintenance_status === filter
        );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700";
      case "CANCELLED":
        return "bg-red-100 text-red-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const formatDate = (value: string) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-IN");
  };

  const totalCost = records.reduce(
    (sum, record) =>
      sum + Number(record.cost || 0),
    0
  );

  const inProgressCount = records.filter(
    (record) => record.maintenance_status === "IN_PROGRESS"
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Page heading */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Maintenance Management
            </h1>

            <p className="mt-2 text-gray-500">
              Schedule and monitor aircraft maintenance activities.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchMaintenance}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-100"
            >
              Refresh
            </button>

            <button
              onClick={() => {
                setShowForm(!showForm);
                setFormError("");
                setSuccess("");
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              {showForm ? "Close Form" : "+ Add Maintenance"}
            </button>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}

        {/* Add maintenance form */}
        {showForm && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Schedule New Maintenance
            </h2>

            {optionsLoading ? (
              <p className="py-6 text-gray-500">
                Loading aircraft and maintenance types...
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="aircraft_id"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Aircraft *
                    </label>

                    <select
                      id="aircraft_id"
                      name="aircraft_id"
                      value={form.aircraft_id}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800"
                    >
                      <option value="">Select aircraft</option>

                      {aircraft.map((item) => (
                        <option
                          key={item.aircraft_id}
                          value={item.aircraft_id}
                        >
                          {item.registration_id} (ID: {item.aircraft_id})
                        </option>
                      ))}
                    </select>

                    {aircraft.length === 0 && (
                      <p className="mt-1 text-sm text-red-600">
                        No aircraft found in the database.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="maintenance_type_id"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Maintenance Type *
                    </label>

                    <select
                      id="maintenance_type_id"
                      name="maintenance_type_id"
                      value={form.maintenance_type_id}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800"
                    >
                      <option value="">Select maintenance type</option>

                      {maintenanceTypes.map((item) => (
                        <option
                          key={item.maintenance_type_id}
                          value={item.maintenance_type_id}
                        >
                          {item.type_name}
                        </option>
                      ))}
                    </select>

                    {maintenanceTypes.length === 0 && (
                      <p className="mt-1 text-sm text-red-600">
                        No maintenance types found in the database.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="scheduled_start"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Scheduled Start *
                    </label>

                    <input
                      id="scheduled_start"
                      type="datetime-local"
                      name="scheduled_start"
                      value={form.scheduled_start}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="scheduled_end"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Scheduled End *
                    </label>

                    <input
                      id="scheduled_end"
                      type="datetime-local"
                      name="scheduled_end"
                      value={form.scheduled_end}
                      onChange={handleInputChange}
                      min={form.scheduled_start || undefined}
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="remarks"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Description
                  </label>

                  <textarea
                    id="remarks"
                    name="remarks"
                    value={form.remarks}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Enter maintenance details..."
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800"
                  />
                </div>

                {formError && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      optionsLoading ||
                      aircraft.length === 0 ||
                      maintenanceTypes.length === 0
                    }
                    className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? "Scheduling..."
                      : "Schedule Maintenance"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setForm(initialForm);
                      setFormError("");
                    }}
                    className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {!optionsLoading && formError && (
              <p className="mt-4 text-sm text-red-600">{formError}</p>
            )}
          </section>
        )}

        {/* Dashboard summary */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Total Records</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {records.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">In Progress</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">
              {inProgressCount}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Maintenance Cost
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              ₹{totalCost.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Maintenance records */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Maintenance Records
            </h2>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700"
            >
              <option value="ALL">All statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-gray-500">
              Loading maintenance records...
            </p>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-red-600">{error}</p>

              <button
                onClick={fetchMaintenance}
                className="mt-3 text-blue-600 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            <p className="py-10 text-center text-gray-500">
              No maintenance records found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600">
                    <th className="p-3">ID</th>
                    <th className="p-3">Aircraft ID</th>
                    <th className="p-3">Maintenance Type</th>
                    <th className="p-3">Scheduled Start</th>
                    <th className="p-3">Scheduled End</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Cost</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.maintenance_id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="p-3 font-medium">
                        {record.maintenance_id}
                      </td>

                      <td className="p-3">{record.aircraft_id}</td>

                      <td className="p-3">
                        {record.type_name ||
                          `Type ${record.maintenance_type_id}`}
                      </td>

                      <td className="p-3">
                        {formatDate(record.scheduled_start)}
                      </td>

                      <td className="p-3">
                        {formatDate(record.scheduled_end)}
                      </td>

                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                            record.maintenance_status
                          )}`}
                        >
                          {record.maintenance_status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="p-3">
                        ₹
                        {Number(record.cost || 0).toLocaleString(
                          "en-IN"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
