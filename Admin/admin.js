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
      saveUninitialized: true,
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

app.post("/admin/register", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
  
    try {
      const checkResult = await db.query("SELECT * FROM admin WHERE name = $1", [
        username,
      ]);
  
      if (checkResult.rows.length > 0) {
        req.redirect("/admin");
      } else {
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          if (err) {
            console.error("Error Storing Information:", err);
          } else {
            const result = await db.query(
              "INSERT INTO admin (name, password) VALUES ($1, $2) RETURNING *",
              [username, hash]
            );
            const user = result.rows[0];
            req.login(user, (err) => {
              console.log("success");
              res.redirect("/admin/uploads");
            });
          }
        });
      }
    } catch (err) {
      console.log(err);
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

  const responseData = {
    message: "Data added successfully!",
    formData: {
      Title: req.body.title,
      Article: req.body.article,
      Status: req.body.status,
      imageurl: req.body.imageurl,
      Main: req.body.check === "on",
      Date: formattedDate
    }
  };
  
  let result = await db.query("INSERT INTO blogs (title, article, status, imageurl, main, datetime) VALUES ($1, $2, $3, $4, $5, $6)", [
    responseData.formData.Title, responseData.formData.Article, responseData.formData.Status, responseData.formData.imageurl, responseData.formData.Main, responseData.formData.Date
  ]);

  res.status(200).json(responseData);
});

passport.serializeUser((user, cb) => {
    cb(null, user);
});
passport.deserializeUser((user, cb) => {
    cb(null, user);
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(port, () => console.log(`App listening on Port ${port}`))

export default app;