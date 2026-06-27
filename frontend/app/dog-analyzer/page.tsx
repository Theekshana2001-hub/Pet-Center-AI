"use client";
import { useState, ChangeEvent, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface ScanItem {
  id: string;
  image_base64: string;
  analysis_result: string;
  language: string;
  scanned_at: string;
}

export default function DogAnalyzer() {
  const [image, setImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showVets, setShowVets] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>("English");
  const [history, setHistory] = useState<ScanItem[]>([]);

  // 🔑 LOGIN AND SESSION STATES
  const [email, setEmail] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/scan-history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Could not fetch history");
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchHistory();
    }
  }, [isLoggedIn]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setBase64Image(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!base64Image) return alert("Please select or take a photo first!");
    setLoading(true);
    setResult("");

    try {
      const res = await fetch('http://localhost:8000/api/analyze-dog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image_base64: base64Image,
          language: language
        })
      });
      const data = await res.json();
      setResult(data.analysis);
      fetchHistory(); 
    } catch (error) {
      alert("Error processing image via AI");
    }
    setLoading(false);
  };

  // 📥 PDF Download Function (Fixed Large Gap/Empty Space Issue)
  const downloadPDF = async () => {
    const element = document.getElementById('pdf-report-content');
    if (!element) return;
    
    const html2pdf = (await import('html2pdf.js')).default;
    
    const opt = {
      margin:       [12, 15, 12, 15], 
      filename:     `PetCenter_AI_Health_Report_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2,
        useCORS: true,
        logging: false,
        imageTimeout: 0,
        onclone: (clonedDoc: Document) => {
          try {
            const sheets = Array.from(clonedDoc.styleSheets) as CSSStyleSheet[];
            for (const sheet of sheets) {
              try {
                const rules = Array.from(sheet.cssRules || []) as CSSRule[];
                for (let i = rules.length - 1; i >= 0; i--) {
                  if (rules[i] && rules[i].cssText && rules[i].cssText.includes('lab(')) {
                    sheet.deleteRule(i);
                  }
                }
              } catch (e) {
                // Ignore cross-origin errors
              }
            }
          } catch (err) {
            console.error("Error cleaning lab() styles", err);
          }
        }
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      // 🛠️ manual CSS rules vitharak check කරන්න damma hidas thiyena eka hadenna:
      pagebreak:    { mode: 'css' } 
    } as any;
    
    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("Something went wrong while generating the PDF.");
    }
  };

  const loadFromHistory = (item: ScanItem) => {
    setImage(`data:image/jpeg;base64,${item.image_base64}`);
    setBase64Image(item.image_base64);
    setResult(item.analysis_result);
    setLanguage(item.language);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return alert("Please enter your email address!");
    
    setLoginLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/customer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setIsLoggedIn(true); 
        alert(`Welcome! Login alert email sent to ${email}`);
      } else {
        alert(data.detail || "Login failed");
      }
    } catch (error) {
      alert("Server connection error during login");
    } finally {
      setLoginLoading(false);
    }
  };

  // --- LOGIN VIEW ---
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 shadow-2xl font-sans">
        <div className="w-full bg-white p-8 rounded-3xl shadow-xl border border-emerald-50 text-center space-y-6">
          <div className="space-y-2">
            <span className="text-6xl block">🐕</span>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
              PetCenter-AI
            </h2>
            <p className="text-xs text-slate-400 font-medium">Dog Vision Health Analyzer Portal</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 px-1">Customer Email Address</label>
              <input 
                type="email" 
                required
                placeholder="enter your email (e.g. name@gmail.com)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <button 
              type="submit" 
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-md hover:shadow-xl transition-all disabled:opacity-70 flex justify-center items-center gap-2"
            >
              {loginLoading ? "Sending Login Alert..." : "Secure Login with Email 🔑"}
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4 text-[10px] text-slate-400">
            Developed by O.W.T.D.B.O. Jayathilaka • BTech IT 2026
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP DASHBOARD ---
  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-12 shadow-2xl font-sans relative">
      
      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white p-5 rounded-b-3xl shadow-lg flex justify-between items-center px-5">
        <span className="font-extrabold text-lg tracking-wide flex items-center gap-2">
          🐕 PetCenter-AI
        </span>
        <div className="flex items-end gap-3">
          <button onClick={() => setIsLoggedIn(false)} className="flex flex-col items-center justify-center gap-0.5">
            <div className="w-10 h-10 bg-white/15 hover:bg-red-500 text-white font-bold rounded-full flex items-center justify-center text-lg transition-colors">
              🚪
            </div>
            <span className="text-[9px] font-bold text-white/90 uppercase mt-0.5">LogOut</span>
          </button>
          <button onClick={() => setShowVets(true)} className="flex flex-col items-center justify-center gap-0.5">
            <div className="w-10 h-10 bg-white text-emerald-600 rounded-full flex items-center justify-center text-base">
              📞
            </div>
            <span className="text-[9px] font-bold text-white/90 uppercase mt-0.5">Call Vet</span>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        
        {/* Language Selector */}
        <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-emerald-100">
          <span className="text-sm font-semibold text-slate-700">📋 Select Report Language:</span>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-emerald-50 text-emerald-800 font-bold text-sm py-1.5 px-3 rounded-lg border border-emerald-200"
          >
            <option value="English">English</option>
            <option value="Sinhala">සිංහල (Sinhala)</option>
          </select>
        </div>

        {/* Image Uploader */}
        <div className="border-2 border-dashed border-emerald-300 rounded-2xl p-4 bg-emerald-50/50 text-center cursor-pointer relative overflow-hidden h-52 flex flex-col justify-center items-center">
          {image ? (
            <img src={image} alt="Preview" className="w-full h-full object-cover absolute top-0 left-0 rounded-2xl" />
          ) : (
            <div className="space-y-2">
              <span className="text-4xl block">📸</span>
              <p className="text-sm font-semibold text-emerald-800">Take a Photo or Upload Dog Image</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleImageChange} className="opacity-0 absolute inset-0 cursor-pointer" />
        </div>

        {/* Analyze Button */}
        <button 
          onClick={handleUploadAndAnalyze} 
          disabled={loading} 
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-4 rounded-2xl font-bold text-lg shadow-md disabled:opacity-70 flex justify-center items-center gap-2"
        >
          {loading ? "AI Analyzing Image..." : "Scan & Analyze Dog 🔎"}
        </button>

        {/* AI Report Output Section */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            
            {/* SCREEN VIEW */}
            <div className="bg-white p-5 rounded-2xl shadow-md border border-emerald-100 space-y-3">
              <h3 className="font-bold text-emerald-700 text-lg border-b border-emerald-100 pb-2 mb-3 flex items-center gap-2">
                📋 AI Health Analysis Report
              </h3>
              <div className="text-slate-800 text-sm leading-relaxed prose max-w-none 
                [&>h3]:text-emerald-600 [&>h3]:font-bold [&>h3]:text-base [&>h3]:mt-4 [&>h3]:mb-2
                [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>strong]:text-slate-950 font-medium">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </div>

            {/* HIDDEN TARGET CONTAINER FOR EXPORT (Fixed White Space Gap) */}
            <div className="hidden">
              <div 
                id="pdf-report-content" 
                style={{ 
                  fontFamily: 'Arial, sans-serif', 
                  color: '#0f172a', 
                  backgroundColor: '#ffffff', 
                  padding: '15px',
                  lineHeight: '1.5'
                }}
              >
                {/* PDF Header */}
                <div style={{ borderBottom: '2px solid #059669', paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                  <div>
                    <h1 style={{ color: '#059669', margin: '0 0 4px 0', fontSize: '22px', fontWeight: 'bold' }}>🐕 PetCenter-AI Report</h1>
                    <p style={{ color: '#64748b', margin: '0', fontSize: '11px', fontWeight: 'bold' }}>Automated Dog Vision Health Analysis</p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
                    <b>Date:</b> {new Date().toLocaleDateString()}<br/>
                    <b>Language:</b> {language}
                  </div>
                </div>

                {/* Scanned Dog Image Inside PDF (Reduced Height to save space) */}
                {image && (
                  <div style={{ marginBottom: '15px', textAlign: 'center', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '12px', border: '1px solid #e2e8f0', pageBreakInside: 'avoid' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Scanned Dog Specimen Image</p>
                    <img 
                      src={image} 
                      alt="Scanned Dog" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '150px', // Lassanata idala thiyaganna 150px kala
                        objectFit: 'contain', 
                        borderRadius: '8px',
                        border: '2px solid #cbd5e1'
                      }} 
                    />
                  </div>
                )}

                {/* PDF Text Content */}
                <div style={{ fontSize: '13.5px', color: '#1e293b' }}>
                  <h2 style={{ color: '#047857', fontSize: '15px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', pageBreakAfter: 'avoid' }}>
                    📋 Analysis & Recommendations
                  </h2>
                  
                  <div className="prose max-w-none 
                    [&>h1]:text-slate-900 [&>h1]:font-bold [&>h1]:text-base [&>h1]:mt-3 [&>h1]:mb-1.5 [&>h1]:break-after-avoid
                    [&>h2]:text-slate-900 [&>h2]:font-bold [&>h2]:text-sm [&>h2]:mt-3 [&>h2]:mb-1.5 [&>h2]:break-after-avoid
                    [&>h3]:text-slate-900 [&>h3]:font-bold [&>h3]:text-xs [&>h3]:mt-2 [&>h3]:mb-1 [&>h3]:break-after-avoid
                    [&>p]:text-slate-950 [&>p]:mb-2 [&>p]:break-inside-avoid
                    [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-2 [&>ul]:text-slate-950
                    [&>li]:text-slate-950 [&>li]:mb-1.5 [&>li]:break-inside-avoid
                    [&>strong]:text-black [&>strong]:font-extrabold"
                  >
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                </div>

                {/* PDF Footer */}
                <div style={{ marginTop: '30px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '10px', color: '#94a3b8', textAlign: 'center', pageBreakInside: 'avoid' }}>
                  This is an AI-generated analytical preview report. Developed by O.W.T.D.B.O. Jayathilaka (BTech IT 2026).
                </div>
              </div>
            </div>
            
            <button 
              onClick={downloadPDF}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white p-3 rounded-xl font-bold text-sm shadow flex justify-center items-center gap-2 transition"
            >
              📥 Download PDF Report
            </button>

            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-xs text-red-700 font-medium shadow-sm">
              ⚠️ <b>Disclaimer:</b> This analysis is an automated AI prediction. If your dog is in critical condition, click the 📞 icon above to call a veterinary specialist immediately.
            </div>
          </div>
        )}

        {/* Recent Scans History */}
        <div className="pt-4 border-t border-slate-200">
          <h4 className="font-bold text-slate-800 text-sm mb-3">📜 Recent Scans ({history.length})</h4>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-2">No history records found yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => loadFromHistory(item)}
                  className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 hover:border-emerald-300 shadow-sm cursor-pointer transition hover:bg-emerald-50/20 group"
                >
                  <img src={`data:image/jpeg;base64,${item.image_base64}`} alt="Past scan" className="w-12 h-12 object-cover rounded-lg border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate group-hover:text-emerald-800">
                      {item.analysis_result.replace(/[#*`]/g, '').substring(0, 45)}...
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {item.scanned_at ? new Date(item.scanned_at).toLocaleString() : "Date Unknown"} • <span className="text-emerald-600 font-medium">{item.language}</span>
                    </p>
                  </div>
                  <span className="text-slate-300 group-hover:text-emerald-500 text-xs font-bold px-2">👁️</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Emergency Vet Contacts Modal */}
      {showVets && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 border-b border-slate-100 pb-3">
              🚨 Emergency Vet Contacts
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <a href="tel:+94112582155" className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-emerald-50 rounded-xl transition border border-slate-100 group">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 text-sm group-hover:text-emerald-900">Government Vet Hospital</span>
                  <span className="text-xs text-slate-500">Colombo (011 258 2155)</span>
                </div>
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-xs">Call</span>
              </a>
              <a href="tel:+94117545545" className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-emerald-50 rounded-xl transition border border-slate-100 group">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 text-sm group-hover:text-emerald-900">Pet Vet Clinic</span>
                  <span className="text-xs text-slate-500">24/7 Emergency (011 754 5545)</span>
                </div>
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-xs">Call</span>
              </a>
            </div>
            <button onClick={() => setShowVets(false)} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-sm">
              Close Window
            </button>
          </div>
        </div>
      )}

    </div>
  );
}