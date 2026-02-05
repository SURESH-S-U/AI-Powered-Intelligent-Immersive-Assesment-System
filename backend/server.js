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
mongoose.connect(process.env.MONGO_URI).then(() => console.log("🚀 MongoDB Connected"));

// 2. DATA MODELS
const User = mongoose.model("User", new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }
}));

const Assessment = mongoose.model("Assessment", new mongoose.Schema({
    username: String, mode: String, scenario: String, answer: String, score: Number, logic: Number, tone: Number, feedback: String, timestamp: { type: Date, default: Date.now }
}));

// 3. AI INITIALIZATION
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const parseAIResponse = (text) => {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) { return null; }
};

// 4. AUTH ROUTES
app.post("/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "Registered" });
    } catch (err) { res.status(400).json({ error: "Email exists" }); }
});

app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user._id, name: user.name }, "secret_key");
            res.json({ token, name: user.name });
        } else { res.status(401).json({ error: "Invalid Credentials" }); }
    } catch (e) { res.status(500).json({ error: "Login error" }); }
});

// 5. ASSESSMENT ROUTES (Strictly gemini-flash-latest)
app.post("/generate-assessment", async (req, res) => {
    try {
        const { mode, questionCount } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const modeMap = { 1: "Visual", 2: "Logical", 3: "Intelligence" };
        const modeTitle = modeMap[mode];

        const prompt = `
            Task: Create a 1-sentence real-life situational challenge.
            Mode: ${modeTitle} Protocol.
            Rule: The challenge must be exactly ONE sentence, maximum 20 words.
            Example: "You find a lost wallet on a park bench with money inside. What do you do?"

            RETURN ONLY RAW JSON:
            {
                "challenge": "One sentence challenge here?",
                "imagePrompt": "vivid, 3 simple keywords",
                "hint": "Social clue"
            }
        `;

        const result = await model.generateContent(prompt);
        let data = parseAIResponse(result.response.text());
        
        if (!data) data = { challenge: "A stranger drops their wallet. What is your action?", imagePrompt: "street, wallet", hint: "Honesty." };
        res.json(data);
    } catch (err) { res.status(500).json({ error: "AI Error" }); }
});

app.post("/evaluate", async (req, res) => {
    try {
        const { username, mode, challenge, answer } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `Evaluate response: "${answer}" for situation: "${challenge}". 
        Return ONLY JSON: {"score": 1-10, "logic": 1-100, "tone": 1-100, "feedback": "One short sentence."}`;

        const result = await model.generateContent(prompt);
        const data = parseAIResponse(result.response.text());

        const modeNames = { 1: "Visual", 2: "Logical", 3: "Intelligence" };
        const record = new Assessment({ username, mode: modeNames[mode], scenario: challenge, answer, ...data });
        await record.save();
        res.json(data);
    } catch (err) { res.json({ score: 5, logic: 50, tone: 50, feedback: "Error." }); }
});

app.get("/history/:username", async (req, res) => {
    try {
        const data = await Assessment.find({ username: req.params.username }).sort({ timestamp: -1 });
        res.json(data);
    } catch (err) { res.status(500).json({ error: "History retrieval failed" }); }
});

app.listen(5000, () => console.log(`🚀 API Running on 5000`));