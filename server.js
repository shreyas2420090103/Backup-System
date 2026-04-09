const express = require("express");
const multer = require("multer");
const path = require("path");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

const app = express();

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

    const row = db
        .prepare("SELECT MAX(version) as version FROM files WHERE name = ?")
        .get(name);

    const version = row && row.version ? row.version + 1 : 1;

    db.prepare(
        "INSERT INTO files (name, version, path) VALUES (?, ?, ?)"
    ).run(name, version, req.file.path);

    res.redirect("/");
});

// =======================
// GET ALL FILES
// =======================
app.get("/files", (req, res) => {
    const rows = db
        .prepare("SELECT DISTINCT name FROM files")
        .all();

    res.json(rows);
});

// =======================
// GET HISTORY
// =======================
app.get("/history/:name", (req, res) => {
    const rows = db
        .prepare("SELECT * FROM files WHERE name = ?")
        .all(req.params.name);

    res.json(rows);
});

// =======================
// RESTORE
// =======================
app.get("/restore/:name/:version", (req, res) => {
    const row = db
        .prepare("SELECT * FROM files WHERE name = ? AND version = ?")
        .get(req.params.name, req.params.version);

    if (!row) return res.send("File not found");

    res.download(row.path);
});

// =======================
// SERVER START (IMPORTANT FOR RENDER)
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});