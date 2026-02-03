import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Radar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  RadialLinearScale, 
  PointElement, 
  LineElement, 
  Filler, 
  Tooltip, 
  Legend 
} from 'chart.js';

// Register the chart components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function App() {
  const [username, setUsername] = useState("");
  const [step, setStep] = useState(1); // 1: Login, 2: Test, 3: Dashboard
  const [scenario, setScenario] = useState("A high-value client is threatening to leave because of a small technical glitch. How do you handle this?");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // FIXED NAME: Changed to handleEvaluate to match the button
  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/evaluate-and-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, currentScenario: scenario, userAnswer: answer })
      });
      const data = await responseOk(res);
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Make sure your backend is running!");
    }
    setLoading(false);
  };

  const responseOk = async (res) => {
    if (!res.ok) throw new Error("Server Error");
    return await res.json();
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(`http://localhost:5000/history/${username}`);
      const data = await res.json();
      setHistory(data);
      setStep(3);
    } catch (err) {
      alert("Could not fetch history.");
    }
  };

  const startNext = () => {
    setScenario(result.nextScenario);
    setAnswer("");
    setResult(null);
  };

  const chartData = {
    labels: ['Overall Score', 'Tone', 'Logic'],
    datasets: [{
      label: 'Behavioral Analysis',
      data: result ? [result.score, result.tone, result.logic] : [0, 0, 0],
      backgroundColor: 'rgba(13, 110, 253, 0.2)',
      borderColor: 'rgb(13, 110, 253)',
      borderWidth: 2,
    }]
  };

  return (
    <div className="container-fluid min-vh-100 bg-light py-5">
      <div className="container">
        
        {step === 1 && (
          <div className="card shadow-lg p-5 mx-auto text-center" style={{maxWidth: '500px'}}>
            <h1 className="display-6 fw-bold text-primary mb-4">AI Assessment System</h1>
            <p className="text-muted">Enter your name to begin.</p>
            <input className="form-control form-control-lg mb-3" placeholder="Full Name" onChange={e => setUsername(e.target.value)} />
            <button className="btn btn-primary btn-lg w-100" onClick={() => setStep(2)} disabled={!username}>Start Test</button>
          </div>
        )}

        {step === 2 && (
          <div className="row g-4">
            <div className="col-lg-7">
              <div className="card shadow border-0 p-4 h-100">
                <h5 className="text-uppercase text-primary small fw-bold">Active Scenario</h5>
                <p className="fs-4 italic my-4 text-dark italic">"{scenario}"</p>
                
                {!result ? (
                  <>
                    <textarea className="form-control mb-3 shadow-sm" rows="6" placeholder="Your response..." value={answer} onChange={e => setAnswer(e.target.value)} />
                    <button className="btn btn-primary btn-lg" onClick={handleEvaluate} disabled={loading || !answer}>
                      {loading ? "AI is Analyzing..." : "Submit Answer"}
                    </button>
                  </>
                ) : (
                  <div className="alert alert-success py-4 shadow-sm">
                    <h5 className="fw-bold">Feedback:</h5>
                    <p>{result.feedback}</p>
                    <button className="btn btn-dark mt-2 me-2" onClick={startNext}>Next Scenario</button>
                    <button className="btn btn-outline-primary mt-2" onClick={fetchHistory}>View Dashboard</button>
                  </div>
                )}
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card shadow border-0 p-4 h-100 text-center">
                <h5 className="text-uppercase text-muted small fw-bold mb-4">Intelligence Radar</h5>
                <div style={{height: '300px'}}><Radar data={chartData} /></div>
                {result && <h2 className="display-4 fw-bold text-primary mt-3">{result.score}/10</h2>}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card shadow border-0 p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2>Performance: {username}</h2>
              <button className="btn btn-outline-primary" onClick={() => setStep(2)}>Take More Tests</button>
            </div>
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>Score</th>
                    <th>Logic</th>
                    <th>Tone</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, i) => (
                    <tr key={i}>
                      <td className="fw-bold">{item.score}/10</td>
                      <td>{item.logic}</td>
                      <td>{item.tone}</td>
                      <td className="small">{item.feedback}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;