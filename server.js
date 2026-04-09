const express = require("express");
const multer = require("multer");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");

const app = express();

// =======================
// DATABASE SETUP
// =======================
const db = new sqlite3.Database(path.join(__dirname, "database.db"), (err) => {
    if (err) console.error(err);
    else console.log("✅ SQLite Connected");
});

db.run(`
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    version INTEGER,
    path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// =======================
// MIDDLEWARE
// =======================
app.use(express.static(__dirname));
app.use(express.json());

// =======================
// FILE STORAGE
// =======================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) =>
        cb(null, uuidv4() + "-" + file.originalname)
});

const upload = multer({ storage });

// =======================
// UPLOAD WITH VERSIONING
// =======================
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.send("No file uploaded");

    const name = req.file.originalname;

    db.get(
        "SELECT MAX(version) as version FROM files WHERE name = ?",
        [name],
        (err, row) => {
            const version = row && row.version ? row.version + 1 : 1;

            db.run(
                "INSERT INTO files (name, version, path) VALUES (?, ?, ?)",
                [name, version, req.file.path]
            );

            res.redirect("/");
        }
    );
});

// =======================
// GET ALL FILES
// =======================
app.get("/files", (req, res) => {
    db.all(
        "SELECT DISTINCT name FROM files",
        [],
        (err, rows) => {
            res.json(rows);
        }
    );
});

// =======================
// GET HISTORY
// =======================
app.get("/history/:name", (req, res) => {
    db.all(
        "SELECT * FROM files WHERE name = ?",
        [req.params.name],
        (err, rows) => {
            res.json(rows);
        }
    );
});

// =======================
// RESTORE
// =======================
app.get("/restore/:name/:version", (req, res) => {
    db.get(
        "SELECT * FROM files WHERE name = ? AND version = ?",
        [req.params.name, req.params.version],
        (err, row) => {
            if (!row) return res.send("File not found");
            res.download(row.path);
        }
    );
});

// =======================
app.listen(3000, () => {
    console.log("🚀 Server running on port 3000");
});