# Airline Fleet Management System

A web-based application built using Next.js, TypeScript, MySQL and MongoDB.

## Technology Stack
- Frontend: Next.js, React, TypeScript
- Backend: Next.js API routes
- Database: MySQL 8.0+ and MongoDB
- Runtime: Node.js 22+

## Prerequisites
- Node.js 22+
- npm
- MySQL 8.0+
- MongoDB connection for maintenance reports

## Installation
```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Database Setup
1. Create the `airline_management` database.
2. Obtain the Student 1 base-table creation SQL from the Student 1 module owner. It is missing from this repository.
3. Create the Student 1 base tables first.
4. Execute `database/student2_crew_maintenance.sql` once.
5. Execute `database/seed_student1.sql`.
6. Execute `database/views_student1.sql`.
7. Verify using `database/verify_schema.sql`.

The Student 2 SQL creates the crew and maintenance tables, indexes, trigger, stored procedure and maintenance overview view. Its index statements are not safe to rerun.

## Environment Variables
Create `.env.local` in the project root:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=airline_management
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MONGODB_URI=your_mongodb_connection_string
MONGODB_DATABASE=airline_management
```
Never commit credentials.

## MongoDB Indexes
After configuring MongoDB, run `npm run mongodb:indexes` once.

## Other Commands
- `npm run build` - production build
- `npm start` - production server
- `npm run lint` - lint checks

## Migration Warning
`database/migrate_to_submitted_schema.sql` is for an existing legacy database. Back up and review the database before using it. Do not use it for fresh installation.
