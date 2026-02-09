const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

const User = mongoose.model("User", new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: { type: String }, 
    level: { type: String, default: "Beginner" }
}));

const Assessment = mongoose.model("Assessment", new mongoose.Schema({
    username: String, 
    domain: String, 
    score: Number, 
    feedback: String, 
    challenge: String, 
    answer: String, 
    sessionId: String, 
    type: String, 
    difficulty: { type: String, default: "Beginner" },
    timestamp: { type: Date, default: Date.now }
}));

const callGitHubAI = async (prompt) => {
    try {
        const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: "You are an advanced AI assessment engine. You must ONLY output valid JSON. Ensure 'challenge' is ALWAYS a string." },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
                temperature: 0.7 
            })
        });

        const result = await response.json();
        return result.choices[0].message.content;
    } catch (error) {
        console.error("AI Fetch Failure:", error.message);
        throw error;
    }
};

const cleanJSON = (text) => {
    try {
        const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) { return null; }
};

app.post("/register", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await new User({ ...req.body, password: hashedPassword }).save();
        res.status(201).json({ success: true });
    } catch (e) { res.status(400).json({ error: "Email exists" }); }
});

app.post("/login", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user && await bcrypt.compare(req.body.password, user.password)) {
            const token = jwt.sign({ id: user._id }, "NEXA_SECRET");
            res.json({ token, user: { name: user.username, level: user.level } });
        } else { res.status(401).json({ error: "Invalid Credentials" }); }
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

app.post("/generate-assessment", async (req, res) => {
    const { type, domains, limit, difficulty } = req.body;
    const isMCQ = (type === 'multi' || type === 'general');
    
    let topicDescription = domains.join(", ");
    if (type === 'general') topicDescription = "random high-level trivia, science, and history";

    const count = limit || 3;
    const seed = Date.now(); 

    try {
        let prompt = `Generate ${count} ${isMCQ ? 'Multiple Choice' : 'Scenario-based'} questions. 
        Topic: ${topicDescription}. 
        Difficulty Level: ${difficulty}. 
        Seed: ${seed}.
        
        RULES:
        1. Keep questions VERY SHORT (max 15-20 words) so they can be read quickly within a 30s timer.
        2. If type is 'general' or 'multi', you MUST provide exactly 4 distinct options.
        3. Match the question complexity strictly to the '${difficulty}' level.
        4. Output format: JSON ONLY.
        
        JSON Format: 
        {"questions": [{"challenge": "${!isMCQ ? 'Scenario: [text] Question: [text]' : '[Question text]'} ", "options": ${isMCQ ? '["A", "B", "C", "D"]' : 'null'}}]}`;

        const aiResponse = await callGitHubAI(prompt);
        const data = cleanJSON(aiResponse);
        res.json(data);
    } catch (e) { res.status(500).json({ error: "AI Generation Error" }); }
});

app.post("/evaluate-batch", async (req, res) => {
    const { username, answers, domains, sessionId, type, difficulty } = req.body;
    try {
        const evalPrompt = `Evaluate these answers for a ${type} assessment at ${difficulty} level.
        Data: ${JSON.stringify(answers)}.
        JSON Format: {"results": [{"score": 0-10, "feedback": "Brief description"}]}`;

        const aiResponse = await callGitHubAI(evalPrompt);
        const data = cleanJSON(aiResponse);

        const savePromises = data.results.map((resItem, idx) => {
            return new Assessment({
                username, 
                domain: (type === 'general' ? "General Knowledge" : domains.join(", ")), 
                challenge: answers[idx].challenge, 
                answer: answers[idx].answer, 
                sessionId, type, difficulty,
                score: resItem.score, 
                feedback: resItem.feedback 
            }).save();
        });
        await Promise.all(savePromises);
        res.json(data);
    } catch (e) { res.status(500).json({ error: "Eval Error" }); }
});

app.get("/history/:username", async (req, res) => {
    try {
        const results = await Assessment.find({ username: req.params.username }).sort({ timestamp: -1 });
        res.json(results);
    } catch (e) { res.status(500).json({ error: "History Error" }); }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server active on ${PORT}`));