require("dotenv").config(); // Load environment variables
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const db = require("./db");
const { Server } = require("socket.io");
const http = require("http");
const axios = require("axios");

const aboutRoutes = require("./routes/aboutRoutes");
const stockRoutes = require("./routes/stockRoutes"); // Ensure this route is imported

const app = express(); // Initialize app first
const server = http.createServer(app); // Create HTTP server
const io = new Server(server);

// Use environment variables for secrets
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; 
const API_KEY = process.env.API_KEY; // Stock API key from .env

// Middleware
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

// Authentication Middleware
function isAuthenticated(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.redirect("/login");
    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch {
        res.redirect("/login");
    }
}

// Routes
app.use(aboutRoutes);
app.use("/stock", stockRoutes); // Define the stock route here

app.get("/", (req, res) => {
    res.redirect("/login");
});

app.get("/home", isAuthenticated, (req, res) => {
    res.render("home", { user: req.user });
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.render("error", { message: "All fields are required" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPassword],
        (err) => {
            if (err) return res.render("error", { message: "User registration failed" });
            res.redirect("/login");
        }
    );
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
        if (err || results.length === 0 || !(await bcrypt.compare(password, results[0].password))) {
            return res.render("error", { message: "Invalid credentials" });
        }
        const token = jwt.sign(
            { id: results[0].id, username: results[0].username },
            JWT_SECRET,
            { expiresIn: "1h" }
        );
        res.cookie("token", token);
        res.redirect("/home");
    });
});

app.get("/dashboard", isAuthenticated, (req, res) => {
    db.query("SELECT id, username FROM users", (err, results) => {
        if (err) {
            return res.render("dashboard", { user: req.user, users: [] });
        }
        res.render("dashboard", { user: req.user, users: results || [] });
    });
});

app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

// Stock Data API Route
app.get("/api/stock/:symbol", async (req, res) => {
    const symbol = req.params.symbol;
    try {
        const response = await axios.get(
            `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&apikey=${API_KEY}`
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stock data" });
    }
});

// WebSocket Connection for Real-Time Updates
io.on("connection", (socket) => {
    console.log("New client connected");
    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

// Start the Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
