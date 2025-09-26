import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from 'bcryptjs';
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import axios from "axios";

const app = express();
const saltRounds = 10;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
env.config();

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

const port = process.env.PORT || 5000;

const db = new pg.Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: String(process.env.PGPASSWORD),
  port: process.env.PGPORT,
  ssl: { rejectUnauthorized: false }
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    })
  );
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.use(passport.initialize());
app.use(passport.session());


app.get("/", (req, res) => {
    res.render("Login.ejs");
});

app.get("/admin/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/admin/revalidate", async (req, res) => {
    if (req.isAuthenticated()) {
      const response = await axios.get(process.env.NEXTAUTH_URL + "/api/revalidate", {
        params: {
          secret: process.env.REVALIDATE_SECRET
        }
      });
      if (response.status === 200) {
        console.log("Revalidation successful");
      }
      res.redirect("/admin/uploads");
    } else {
      res.redirect("/");
    }
});

app.get("/admin/uploads", (req, res) => {
    if (req.isAuthenticated()) {
      res.render("adminSection.ejs");
    } else {
      res.redirect("/");
    }
});

app.get("/admin/register", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("register.ejs");
  } else {
    res.redirect("/");
  }
});

app.post("/admin/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/admin/uploads",
    failureRedirect: "/",
  })(req, res, next);
});

app.post("/admin/register", async (req, res, next) => {
  const { username, password } = req.body;

  try {
    const checkResult = await db.query(
      "SELECT * FROM admin WHERE name = $1",
      [username]
    );
    if (checkResult.rows.length) {
      return res.redirect("/");  
    }

    const hash = await bcrypt.hash(password, saltRounds);
    const result = await db.query(
      "INSERT INTO admin (name, password) VALUES ($1, $2) RETURNING *",
      [username, hash]
    );
    const user = result.rows[0];

    req.login(user, (err) => {
      if (err) return next(err);
      return res.redirect("/admin/uploads");
    });
  } catch (err) {
    next(err);
  }
});

passport.use("local", new Strategy({
  usernameField: 'username',
  passwordField: 'password'
}, async (username, password, cb) => {
  try {
    const result = await db.query("SELECT * FROM admin WHERE name = $1", [username]);
    
    if (result.rows.length === 0) {
      return cb(null, false, { message: 'Incorrect username or password' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return cb(null, false, { message: 'Incorrect username or password' });
    }
    
    return cb(null, user);
    
  } catch (err) {
    console.error('Authentication error:', err);
    return cb(err);
  }
}));

app.post("/admin/data", async (req, res) => {
  const date = new Date(); 
  const formattedDate = `${date.getDate()}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  
  if (!req.body.title || !req.body.article || !req.body.status || !req.body.imageurl) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const formattedSlug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const responseData = {
    message: "Data added successfully!",
    formData: {
      Title: req.body.title,
      Article: req.body.article,
      Status: req.body.status,
      imageurl: req.body.imageurl,
      Main: req.body.check === "on",
      Date: formattedDate,
      slug: formattedSlug
    }
  };

  let result = await db.query("INSERT INTO blogs (title, article, status, imageurl, main, datetime, slug) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
    responseData.formData.Title, responseData.formData.Article, responseData.formData.Status, responseData.formData.imageurl, responseData.formData.Main, responseData.formData.Date, responseData.formData.slug
  ]);

  res.status(200).json(responseData);
});

app.get("/admin/allblog", async (req, res) => {
  console.log("r")
  console.log("User:", req.user);

  if (req.isAuthenticated()) {
    console.log("reached")
    try {
      let response = await db.query(`SELECT * FROM blogs ORDER BY id DESC`);
      const blogs = response.rows;
      res.render("blogs.ejs", { blogs })
    } catch(err) {
      console.error("Error Fetching Articles ", err);
    }
  }
})

app.delete("/admin/delete/:id", async (req, res) => {
  if(req.isAuthenticated()) {
    const id = req.params.id;
    try {
      let result = await db.query(`DELETE FROM blogs where id = $1`, [id]);
      res.json({ success: true})
    } catch (err) {
      console.error("Error deleting Article ", err);
      res.status(500).json({ success : false})
    }
  }
});

passport.serializeUser((user, cb) => {
  cb(null, user.id);  
});

passport.deserializeUser(async (id, cb) => {
  try {
    const result = await db.query('SELECT * FROM admin WHERE id = $1', [id]);
    cb(null, result.rows[0]);
  } catch (err) {
    cb(err);
  }
});


app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(port, () => console.log(`App listening on Port ${port}`));

export default app;

// Get the frontend from github repository now!