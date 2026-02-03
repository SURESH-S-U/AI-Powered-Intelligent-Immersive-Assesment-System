const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// This is our "Intelligent Evaluation" Route
app.post("/evaluate", async (req, res) => {
    try {
        const { scenario, userAnswer } = req.body;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
        You are an AI Assessor. 
        Scenario: ${scenario}
        User Answer: ${userAnswer}
        Evaluate the answer. Provide a score out of 10 and 1 sentence of feedback.
        Return ONLY a JSON like this: {"score": 8, "feedback": "Good job, but be more polite."}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Convert AI text to JSON
        const data = JSON.parse(text);

        // DECISION TREE LOGIC: Tell the frontend what question to show next
        let nextLevel = "easy";
        if (data.score >= 7) {
            nextLevel = "hard";
        }

        res.json({ ...data, nextLevel });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "AI is tired. Try again." });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));