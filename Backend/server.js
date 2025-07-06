import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pg from "pg";
import env from "dotenv";

env.config();
const app = express();
const port = process.env.PORT || 4000;

const db = new pg.Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: String(process.env.PGPASSWORD),
  port: process.env.PGPORT,
  ssl: { rejectUnauthorized: false }
});


db.connect()
  // .then(() => console.log("Connected to database"))
  // .catch(err => console.error("Database connection error", err));

const corsOptions = {
  origin: [
    'https://khatreez-server.vercel.app',
    'https://khatreez-*.vercel.app',
    'https://khatreez.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json("This is Khatreez Server.");
});

app.get("/data/blogdisplay/:limit", async (req, res) => {
  const limit = parseInt(req.params.limit, 10) || 10;
  try {
    const response = await db.query('SELECT * FROM blogs ORDER BY id DESC LIMIT $1', [limit]);
    res.json(response.rows);
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/data/blogmain", async (req, res) => {
  try {
    const response = await db.query('SELECT * FROM blogs WHERE main = true ORDER BY id DESC');
    res.json(response.rows);
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/data/blogcomponent", async (req, res) => {
  try {
    const response = await db.query('SELECT * FROM blogs ORDER BY id DESC LIMIT 4');
    res.json(response.rows);
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/data/article/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid article ID" });

  try {
    const response = await db.query("SELECT * FROM blogs WHERE id = $1", [id]);
    if (response.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json(response.rows);
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/articles/filter/:type/:limit", async (req, res) => {
  const type = req.params.type;
  const limit = parseInt(req.params.limit) || 10;
  
  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: "Invalid type parameter" });
  }

  try {
    const response = await db.query(
      "SELECT * FROM blogs WHERE status = $1::text ORDER BY id DESC LIMIT $2", 
      [type.trim(), limit]
    );
    
    if (response.rows.length === 0) {
      return res.status(404).json({ message: "No articles found with this status" });
    }
    
    res.json(response.rows);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ 
      error: "Internal Server Error",
      details: err.message  
    });
  }
});

app.get("/search/article/:title", async (req, res) => {
  const title = req.params.title;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ 
      error: "Valid title search parameter is required" 
    });
  }

  try {
    const response = await db.query(
      "SELECT * FROM blogs WHERE title ILIKE $1 ORDER BY id DESC LIMIT 5", 
      [`%${title.trim()}%`]
    );
    res.json(response.rows);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(port, () => {
  console.log(`Server running at port ${port}`);
});

export default app;