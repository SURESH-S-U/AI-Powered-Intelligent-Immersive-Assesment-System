const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// 1. MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Database Connected Successfully"))
  .catch(err => console.log("DB Connection Error:", err));

// 2. Database Schema (Stores the user's intelligence journey)
const AssessmentSchema = new mongoose.Schema({
  username: String,
  scenario: String,
  answer: String,
  score: Number,
  tone: Number,
  logic: Number,
  feedback: String,
  timestamp: { type: Date, default: Date.now }
});
const Assessment = mongoose.model("Assessment", AssessmentSchema);

// 3. AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/evaluate-and-generate", async (req, res) => {
  try {
    const { username, currentScenario, userAnswer } = req.body;

   const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // THE MASTER PROMPT: Grades the old one AND creates the new one in 1 hit!
    const prompt = `
      You are an Intelligent Assessment System.
      
      Part 1: Evaluate this response:
      Scenario: "${currentScenario}"
      User Answer: "${userAnswer}"
      Give a score (1-10), Tone score (1-10), and Logic score (1-10). Provide 1 sentence feedback.

      Part 2: Generate the NEXT Scenario:
      If the score is > 7, make the next scenario MUCH harder.
      If the score is < 4, make the next scenario easier and supportive.
      Otherwise, keep it professional and balanced.

      RETURN ONLY RAW JSON:
      {
        "score": number,
        "tone": number,
        "logic": number,
        "feedback": "string",
        "nextScenario": "string"
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json|```/g, "").trim();
    const data = JSON.parse(responseText);

    // Save this session to MongoDB
    const record = new Assessment({ 
      username, 
      scenario: currentScenario, 
      answer: userAnswer, 
      ...data 
    });
    await record.save();

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI Processing Failed" });
  }
});

// Route to get User History for the Dashboard
app.get("/history/:username", async (req, res) => {
  const history = await Assessment.find({ username: req.params.username }).sort({ timestamp: -1 });
  res.json(history);
});

app.listen(5000, () => console.log("Intelligent System running on Port 5000"));