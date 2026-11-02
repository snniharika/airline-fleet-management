
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  let connection;

  try {
    const username = (await rl.question("Username: ")).trim();
    const email = (await rl.question("Email: ")).trim().toLowerCase();
    const role = (await rl.question("Role (ADMIN/STAFF): ")).trim().toUpperCase();
    const password = await rl.question("Password: ");

    if (!username || !email || !password) {
      throw new Error("All fields are required.");
    }

    if (!["ADMIN", "STAFF"].includes(role)) {
      throw new Error("Role must be ADMIN or STAFF.");
    }

    if (password.length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE || "airline_management",
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD,
    });

    await connection.execute(
      `INSERT INTO \`USER\`
       (username, email, password_hash, role, account_status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [username, email, passwordHash, role]
    );

    console.log(`Successfully created ${role} account for ${email}.`);
  } catch (error) {
    console.error("Account creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
    rl.close();
  }
}

main();
