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

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Database Schemas
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
    timestamp: { type: Date, default: Date.now }
}));

/**
 * AI Helper: Calls GitHub Marketplace Models
 * Model: gpt-4o-mini (Best for rate limits and JSON accuracy)
 */
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
                    { role: "system", content: "You are an AI assessment engine. You must ONLY output valid JSON. Do not include markdown formatting or extra text." },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
                temperature: 0.7
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("--- GITHUB API ERROR ---");
            console.error("Status:", response.status);
            console.error("Details:", JSON.stringify(result, null, 2));
            throw new Error(`GitHub API Error: ${response.status}`);
        }

        return result.choices[0].message.content;
    } catch (error) {
        console.error("AI Fetch Failure:", error.message);
        throw error;
    }
};

/**
 * Helper: Extracts JSON from AI string response
 */
const cleanJSON = (text) => {
    try {
        const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) { 
        console.error("JSON Parse Error on text:", text);
        return null; 
    }
};

// --- AUTHENTICATION ROUTES ---

app.post("/register", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await new User({ ...req.body, password: hashedPassword }).save();
        res.status(201).json({ success: true });
    } catch (e) { 
        res.status(400).json({ error: "Email already exists in neural database" }); 
    }
});

app.post("/login", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user && await bcrypt.compare(req.body.password, user.password)) {
            const token = jwt.sign({ id: user._id }, "NEXA_SECRET");
            res.json({ token, user: { name: user.username, level: user.level } });
        } else {
            res.status(401).json({ error: "Access Denied: Invalid Credentials" });
        }
    } catch (e) {
        res.status(500).json({ error: "Auth Server Error" });
    }
});

// --- ASSESSMENT ROUTES ---

app.post("/generate-assessment", async (req, res) => {
    const { type, domains, limit } = req.body;
    const domainStr = domains?.length > 0 ? domains.join(", ") : "General Knowledge";
    const count = limit || 3;
    
    try {
        console.log(`📡 Requesting ${count} ${type} questions for ${domainStr}...`);

        let prompt = "";
        if (type === 'adaptive') {
            prompt = `Generate ${count} unique, short scenario-based logic questions about ${domainStr}. 
            Format exactly like this: Scenario: [The situation description] Question: [The specific question].
            Return valid JSON only: {"questions": [{"challenge": "Scenario: ... Question: ..."}]}`;
        } else {
            prompt = `Generate ${count} unique multiple choice questions about ${domainStr}. 
            Return valid JSON only: {"questions": [{"challenge": "The question here?", "options": ["Choice A", "Choice B", "Choice C", "Choice D"]}]}`;
        }

        const aiResponse = await callGitHubAI(prompt);
        const data = cleanJSON(aiResponse);

        if (!data || !data.questions) {
            throw new Error("AI failed to provide questions in the correct format.");
        }

        res.json(data);
    } catch (e) {
        console.error("Route Error (/generate-assessment):", e.message);
        res.status(500).json({ error: "AI Generation Failed. Check Server Logs." });
    }
});

app.post("/evaluate-batch", async (req, res) => {
    const { username, answers, domains, sessionId, type } = req.body;
    
    try {
        console.log(`🧠 Evaluating batch responses for ${username}...`);

        const evalPrompt = `Evaluate these ${answers.length} answers for an assessment about ${domains?.join(", ") || 'General'}. 
        Input Answers: ${JSON.stringify(answers)}. 
        For each answer, provide a score from 0 to 10 and constructive feedback. 
        JSON ONLY: {"results": [{"score": 0-10, "feedback": "Brief feedback text"}]}`;

        const aiResponse = await callGitHubAI(evalPrompt);
        const data = cleanJSON(aiResponse);

        if (!data || !data.results) throw new Error("Evaluation parsing failed.");

        // Save each result to DB for User History
        const savePromises = data.results.map((resItem, idx) => {
            return new Assessment({
                username, 
                domain: domains?.join(", ") || "General", 
                challenge: answers[idx].challenge, 
                answer: answers[idx].answer, 
                sessionId, 
                type, 
                score: resItem.score, 
                feedback: resItem.feedback 
            }).save();
        });

        await Promise.all(savePromises);
        res.json(data);
    } catch (e) {
        console.error("Route Error (/evaluate-batch):", e.message);
        res.status(500).json({ error: "Batch Evaluation Failed" });
    }
});

// --- DATA ROUTES ---

app.get("/history/:username", async (req, res) => {
    try {
        const results = await Assessment.find({ username: req.params.username }).sort({ timestamp: -1 });
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: "Failed to retrieve history" });
    }
});

// Server Initialization
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 IntelliTest Server Core active on port ${PORT}`));