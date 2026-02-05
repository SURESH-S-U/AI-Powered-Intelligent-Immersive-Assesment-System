const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// 1. DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🚀 MongoDB Connected"))
    .catch(err => console.log("DB Error:", err));

// 2. DATA MODELS
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model("User", UserSchema);

const AssessmentSchema = new mongoose.Schema({
    username: String,
    mode: String,
    questionNumber: Number,
    scenario: String,
    answer: String,
    score: Number,
    logic: Number,      // Added to match UI
    tone: Number,       // Added to match UI
    feedback: String,
    timestamp: { type: Date, default: Date.now }
});
const Assessment = mongoose.model("Assessment", AssessmentSchema);

// 3. AI INITIALIZATION
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to clean AI JSON response
const parseAIResponse = (text) => {
    try {
        const cleanText = text.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parsing Error:", text);
        throw new Error("Invalid AI Response format");
    }
};

// 4. AUTHENTICATION ROUTES
app.post("/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "User Registered" });
    } catch (err) {
        res.status(400).json({ error: "Email already exists or registration failed" });
    }
});

app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user._id, name: user.name }, "secret_key", { expiresIn: "1h" });
            res.json({ token, name: user.name });
        } else {
            res.status(401).json({ error: "Invalid Credentials" });
        }
    } catch (e) {
        res.status(500).json({ error: "Login error" });
    }
});

// 5. INTELLIGENT ASSESSMENT ROUTES
app.post("/generate-assessment", async (req, res) => {
    try {
        const { mode, questionCount } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        let modeContext = "";
        if (mode === 1) modeContext = "Enigma Mode: Visual logic riddles and 'Find the Imposter' scenarios.";
        if (mode === 2) modeContext = "Nexus Mode: Real-world behavioral crises and ethical dilemmas.";
        if (mode === 3) modeContext = "Omega Mode: A hybrid of logical traps and high-pressure situational choices.";

        const prompt = `
            Task: Act as an Intelligent Simulation Master.
            Current Mode: ${modeContext}
            Question: ${questionCount} of 10.

            Instructions:
            1. Create a compelling challenge for the user. 
            2. Provide 3 descriptive keywords for an AI Image Generator based on the scene.

            RETURN ONLY RAW JSON:
            {
                "challenge": "The text of the riddle or situation",
                "imagePrompt": "3 detailed keywords",
                "hint": "A subtle clue"
            }
        `;

        const result = await model.generateContent(prompt);
        const data = parseAIResponse(result.response.text());
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "AI failed to generate challenge" });
    }
});

app.post("/evaluate", async (req, res) => {
    try {
        const { username, mode, challenge, answer } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
            Evaluate the user's intelligence based on this challenge: "${challenge}"
            User's Answer: "${answer}"

            Task:
            1. Rate Score (1-10).
            2. Assess Logic level (1-100).
            3. Assess Tone/Professionalism (1-100).
            4. Provide 1 sentence of constructive feedback.

            RETURN ONLY RAW JSON:
            {"score": 8, "logic": 85, "tone": 70, "feedback": "Example feedback."}
        `;

        const result = await model.generateContent(prompt);
        const data = parseAIResponse(result.response.text());

        // Map mode number to Name for the DB
        const modeNames = { 1: "Enigma", 2: "Nexus", 3: "Omega" };

        // Save session to MongoDB
        const record = new Assessment({
            username,
            mode: modeNames[mode] || "Unknown",
            scenario: challenge,
            answer: answer,
            score: data.score,
            logic: data.logic,
            tone: data.tone,
            feedback: data.feedback
        });
        await record.save();

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Evaluation failed" });
    }
});

// 6. DASHBOARD HISTORY ROUTE
app.get("/history/:username", async (req, res) => {
    try {
        const data = await Assessment.find({ username: req.params.username })
            .sort({ timestamp: -1 })
            .limit(10); // Keep it clean for the UI
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "History retrieval failed" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Intelligent API running on port ${PORT}`));