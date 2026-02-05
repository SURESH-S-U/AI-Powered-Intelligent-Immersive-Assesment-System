import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Award, Loader2, LogIn, UserPlus, Eye, ShieldCheck, BarChart3 } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';

const App = () => {
    // UI & Auth States
    const [step, setStep] = useState("auth"); // auth, selection, test, report
    const [isLogin, setIsLogin] = useState(true);
    const [user, setUser] = useState({ name: "", email: "", password: "" });
    
    // Assessment States
    const [mode, setMode] = useState(null);
    const [qCount, setQCount] = useState(1);
    const [scenario, setScenario] = useState(null);
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [evaluation, setEvaluation] = useState(null);
    const [scoreHistory, setScoreHistory] = useState([]);

    // --- NAVIGATION LOGIC ---
    const handleAuth = () => {
        if (!user.name || !user.email) return alert("Please fill all fields");
        setStep("selection");
    };

    const startMode = async (mId) => {
        setMode(mId);
        await fetchNewChallenge(mId, 1);
        setStep("test");
    };

    // --- AI LOGIC ---
    const fetchNewChallenge = async (mId, count) => {
        setLoading(true);
        try {
            const res = await fetch("http://localhost:5000/generate-assessment", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: mId, questionCount: count })
            });
            const data = await res.json();
            setScenario(data);
        } catch (e) { alert("AI connection failed. Ensure backend is running!"); }
        setLoading(false);
    };

    const submitAnswer = async () => {
        setLoading(true);
        try {
            const res = await fetch("http://localhost:5000/evaluate", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    username: user.name, 
                    mode, 
                    challenge: scenario.challenge, 
                    answer 
                })
            });
            const result = await res.json();
            setEvaluation(result);
            setScoreHistory([...scoreHistory, result.score]);
        } catch (e) { alert("Evaluation failed."); }
        setLoading(false);
    };

    const proceed = () => {
        if (qCount >= 10) return setStep("report");
        setEvaluation(null);
        setAnswer("");
        setQCount(qCount + 1);
        fetchNewChallenge(mode, qCount + 1);
    };

    // --- RENDER HELPERS ---
    const GlassCard = ({ children, className }) => (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-white bg-opacity-10 backdrop-blur-md border border-white border-opacity-20 rounded-5 shadow-2xl p-4 ${className}`}
        >
            {children}
        </motion.div>
    );

    return (
        <div className="min-vh-100 text-white overflow-hidden" style={{ 
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Background Animated Blobs */}
            <div className="position-fixed w-100 h-100 overflow-hidden" style={{ zIndex: 0 }}>
                <div className="position-absolute bg-primary rounded-circle filter-blur-3xl opacity-25" style={{ width: '400px', height: '400px', top: '-10%', left: '-5%' }}></div>
                <div className="position-absolute bg-purple-600 rounded-circle filter-blur-3xl opacity-20" style={{ width: '500px', height: '500px', bottom: '-10%', right: '-5%' }}></div>
            </div>

            <div className="container position-relative py-5" style={{ zIndex: 1 }}>
                <AnimatePresence mode="wait">
                    
                    {/* STEP 1: AUTHENTICATION */}
                    {step === "auth" && (
                        <div className="row justify-content-center align-items-center min-vh-75">
                            <div className="col-md-5">
                                <GlassCard>
                                    <div className="text-center mb-4">
                                        <div className="bg-primary bg-opacity-20 d-inline-block p-3 rounded-circle mb-3">
                                            <Brain size={40} className="text-primary" />
                                        </div>
                                        <h2 className="fw-bold">{isLogin ? "Welcome Back" : "Create Account"}</h2>
                                        <p className="text-white-50">Join the Nexa Intelligence Assessment</p>
                                    </div>
                                    {!isLogin && (
                                        <div className="mb-3">
                                            <label className="small opacity-75">Full Name</label>
                                            <input className="form-control bg-dark bg-opacity-50 text-white border-secondary" onChange={e => setUser({...user, name: e.target.value})} />
                                        </div>
                                    )}
                                    <div className="mb-3">
                                        <label className="small opacity-75">Email Address</label>
                                        <input className="form-control bg-dark bg-opacity-50 text-white border-secondary" onChange={e => setUser({...user, email: e.target.value})} />
                                    </div>
                                    <div className="mb-4">
                                        <label className="small opacity-75">Password</label>
                                        <input type="password" className="form-control bg-dark bg-opacity-50 text-white border-secondary" />
                                    </div>
                                    <button className="btn btn-primary w-100 rounded-pill py-2 fw-bold" onClick={handleAuth}>
                                        {isLogin ? <LogIn size={18} className="me-2"/> : <UserPlus size={18} className="me-2"/>}
                                        {isLogin ? "Sign In" : "Register Now"}
                                    </button>
                                    <p className="text-center mt-3 small opacity-50 cursor-pointer" onClick={() => setIsLogin(!isLogin)}>
                                        {isLogin ? "New here? Create an account" : "Already have an account? Sign in"}
                                    </p>
                                </GlassCard>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: MODE SELECTION */}
                    {step === "selection" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <h1 className="display-4 fw-black mb-2">Choose Your Pathway</h1>
                            <p className="text-white-50 mb-5">Select a specialized AI-driven intelligence simulation</p>
                            <div className="row g-4">
                                {[
                                    { id: 1, name: "Enigma Mode", icon: <Eye />, color: "text-info", desc: "Visual Puzzles & Imposter Riddles" },
                                    { id: 2, name: "Nexus Mode", icon: <ShieldCheck />, color: "text-success", desc: "Real-world Crisis & Situation Handling" },
                                    { id: 3, name: "Omega Mode", icon: <Zap />, color: "text-warning", desc: "The Hybrid Cognitive Stress Test" }
                                ].map(m => (
                                    <div key={m.id} className="col-md-4">
                                        <GlassCard className="h-100 cursor-pointer hover-lift" onClick={() => startMode(m.id)}>
                                            <div className={`${m.color} mb-3`}>{m.icon}</div>
                                            <h4 className="fw-bold">{m.name}</h4>
                                            <p className="small opacity-75">{m.desc}</p>
                                            <button className="btn btn-sm btn-outline-light rounded-pill mt-3 px-4">Initialize</button>
                                        </GlassCard>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: ASSESSMENT TEST */}
                    {step === "test" && scenario && (
                        <div className="row justify-content-center">
                            <div className="col-lg-11">
                                <div className="d-flex justify-content-between mb-3 small opacity-50">
                                    <span>{user.name} • Mode {mode}</span>
                                    <span>PROGRESS: {qCount}/10</span>
                                </div>
                                <div className="progress bg-dark mb-4" style={{ height: '6px' }}>
                                    <motion.div className="progress-bar bg-primary" initial={{ width: 0 }} animate={{ width: `${qCount*10}%` }}></motion.div>
                                </div>
                                <div className="row g-4">
                                    <div className="col-md-6">
                                        <div className="rounded-5 overflow-hidden border border-white border-opacity-10 shadow-lg position-relative" style={{ height: '450px' }}>
                                            <img 
                                                src={`https://image.pollinations.ai/prompt/${scenario.imagePrompt}?width=800&height=800&nologo=true&seed=${qCount}`} 
                                                className="w-100 h-100 object-fit-cover opacity-75" alt="AI Scene" 
                                            />
                                            <div className="position-absolute top-0 start-0 w-100 h-100 bg-gradient-to-t from-black opacity-40"></div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <GlassCard className="h-100 d-flex flex-column justify-content-between">
                                            <div>
                                                <h3 className="fw-bold mb-4">{scenario.challenge}</h3>
                                                {!evaluation ? (
                                                    <textarea 
                                                        className="form-control bg-white bg-opacity-5 text-white border-secondary rounded-4 p-3" 
                                                        rows="6" placeholder="Your solution..." value={answer} onChange={e => setAnswer(e.target.value)}
                                                    />
                                                ) : (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
                                                        <div className="display-2 fw-black text-primary mb-2">{evaluation.score}/10</div>
                                                        <p className="bg-white bg-opacity-10 p-3 rounded-4 italic">"{evaluation.feedback}"</p>
                                                    </motion.div>
                                                )}
                                            </div>
                                            <div className="mt-4">
                                                {!evaluation ? (
                                                    <button className="btn btn-primary w-100 rounded-pill py-3 fw-bold" onClick={submitAnswer} disabled={loading || !answer}>
                                                        {loading ? <Loader2 className="spinner-border-sm me-2 animate-spin" /> : "Analyze Intelligence"}
                                                    </button>
                                                ) : (
                                                    <button className="btn btn-outline-light w-100 rounded-pill py-3 fw-bold" onClick={proceed}>
                                                        Continue Simulation &rarr;
                                                    </button>
                                                )}
                                            </div>
                                        </GlassCard>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: FINAL REPORT */}
                    {step === "report" && (
                        <div className="text-center py-5">
                            <Award size={100} className="text-warning mb-4" />
                            <h1 className="display-1 fw-black">SIMULATION COMPLETE</h1>
                            <h3 className="text-primary mb-5">{user.name}</h3>
                            <div className="row justify-content-center">
                                <div className="col-md-4">
                                    <GlassCard>
                                        <BarChart3 size={30} className="text-info mb-3" />
                                        <h5>Average Intelligence Score</h5>
                                        <div className="display-2 fw-bold">
                                            {(scoreHistory.reduce((a, b) => a + b, 0) / 10).toFixed(1)}
                                        </div>
                                        <button className="btn btn-primary rounded-pill mt-4 w-100" onClick={() => window.location.reload()}>Re-Enter Nexus</button>
                                    </GlassCard>
                                </div>
                            </div>
                        </div>
                    )}

                </AnimatePresence>
            </div>

            <style>{`
                .filter-blur-3xl { filter: blur(100px); }
                .cursor-pointer { cursor: pointer; }
                .hover-lift { transition: transform 0.3s ease; }
                .hover-lift:hover { transform: translateY(-10px); }
                .fw-black { font-weight: 900; }
                .italic { font-style: italic; }
            `}</style>
        </div>
    );
};

export default App;