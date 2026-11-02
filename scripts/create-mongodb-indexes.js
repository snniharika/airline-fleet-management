async function createIndexes() {
  const { MongoClient } = await import("mongodb");

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured in .env.local");
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(
      process.env.MONGODB_DATABASE || "airline_management"
    );

    const reports = db.collection("maintenance_reports");

    await reports.createIndex(
      { maintenance_id: 1, created_at: -1 },
      { name: "idx_reports_maintenance_created" }
    );

    await reports.createIndex(
      { maintenance_id: 1, "findings.severity": 1 },
      { name: "idx_reports_maintenance_severity" }
    );

    console.log("MongoDB maintenance report indexes created successfully.");
  } finally {
    await client.close();
  }
}

createIndexes().catch((error) => {
  console.error("MongoDB index setup failed:", error.message);
  process.exitCode = 1;
});