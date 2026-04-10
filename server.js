const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

const app = express();

// =======================
// CREATE UPLOADS FOLDER (IMPORTANT)
// =======================
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// =======================
// DATABASE SETUP
// =======================
const db = new Database(path.join(__dirname, "database.db"));

db.prepare(`
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    version INTEGER,
    path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

// =======================
// MIDDLEWARE
// =======================
app.use(express.static(__dirname));
app.use(express.json());

// =======================
// FILE STORAGE (FIXED)
// =======================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // absolute safe path
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// =======================
// UPLOAD ROUTE (FIXED)
// =======================
app.post("/upload", upload.single("file"), (req, res) => {
    try {
        if (!req.file) return res.send("No file uploaded");

        const name = req.file.originalname;

        const row = db
            .prepare("SELECT MAX(version) as version FROM files WHERE name = ?")
            .get(name);

        let message = "";
        let version;

        if (row && row.version) {
            version = row.version + 1;
            message = "duplicate";  // 🔥 key change
        } else {
            version = 1;
            message = "new";
        }

        const filePath = path.join("uploads", req.file.filename);

        db.prepare(
            "INSERT INTO files (name, version, path) VALUES (?, ?, ?)"
        ).run(name, version, filePath);

        // 🔥 redirect with message
        res.redirect(`/?status=${message}&file=${name}&version=${version}`);

    } catch (err) {
        console.error("UPLOAD ERROR:", err);
        res.status(500).send("Upload failed");
    }
});
// =======================
// GET ALL FILES
// =======================
app.get("/files", (req, res) => {
    try {
        const rows = db
            .prepare("SELECT DISTINCT name FROM files")
            .all();

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.json([]);
    }
});

// =======================
// GET HISTORY
// =======================
app.get("/history/:name", (req, res) => {
    try {
        const rows = db
            .prepare("SELECT * FROM files WHERE name = ?")
            .all(req.params.name);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.json([]);
    }
});

// =======================
// RESTORE FILE (FIXED)
// =======================
app.get("/restore/:name/:version", (req, res) => {
    try {
        const row = db
            .prepare("SELECT * FROM files WHERE name = ? AND version = ?")
            .get(req.params.name, req.params.version);

        if (!row) return res.send("File not found");

        const fullPath = path.join(__dirname, row.path);

        res.download(fullPath);
    } catch (err) {
        console.error("RESTORE ERROR:", err);
        res.status(500).send("Restore failed");
    }
});

// =======================
// SERVER START (RENDER FIX)
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});