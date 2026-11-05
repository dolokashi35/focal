import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Info,
  LayoutDashboard,
  Microscope,
  Pill,
  Shield,
  ShieldAlert,
  ShoppingBag,
  User,
} from "lucide-react";

const ONBOARDING_STEPS = ["splash", "welcome", "profile", "goals", "lifestyle", "ready"] as const;

const MOCK_DB = [
  { id: "d3", name: "Vitamin D3", brand: "Nature Made", dose: "5000 IU", category: "Immunity", time: "morning" },
  { id: "mg", name: "Magnesium Glycinate", brand: "Pure Encapsulations", dose: "400mg", category: "Sleep", time: "night" },
  { id: "o3", name: "Omega-3", brand: "Nordic Naturals", dose: "1200mg", category: "Heart", time: "morning" },
  { id: "zn", name: "Zinc", brand: "Thorne", dose: "30mg", category: "Immunity", time: "night" },
];

type Tab = "today" | "stack" | "scan" | "insights" | "profile";
type Step = (typeof ONBOARDING_STEPS)[number];

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>("splash");
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [stack, setStack] = useState(MOCK_DB.slice(0, 3));
  const [takenToday, setTakenToday] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<boolean>(false);

  useEffect(() => {
    if (currentStep === "splash") {
      const timer = setTimeout(() => setCurrentStep("welcome"), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const toggleTaken = (id: string) => {
    setTakenToday((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const ProgressBar = ({ progress }: { progress: number }) => (
    <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
      <div className="h-full bg-black transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
    </div>
  );

  if (currentStep === "splash") {
		return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-2 border-white rounded-full flex items-center justify-center mb-6 animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
        <h1 className="text-2xl font-bold tracking-[0.3em] uppercase">Vitamax</h1>
        <div className="mt-8 w-32 h-[1px] bg-zinc-800 overflow-hidden">
          <div className="h-full bg-white w-1/3 animate-[loading_1.5s_infinite]" />
        </div>
        <style dangerouslySetInnerHTML={{ __html: "@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }" }} />
			</div>
		);
	}

  if (ONBOARDING_STEPS.includes(currentStep) && currentStep !== "ready") {
    return (
      <div className="min-h-screen bg-white flex flex-col animate-in fade-in duration-700 overflow-hidden">
        {currentStep === "welcome" && (
          <div className="flex-1 flex flex-col relative">
            <div className="absolute top-0 right-[-10%] w-[40%] h-full opacity-[0.03] pointer-events-none rotate-12">
              <div className="flex flex-col gap-8 animate-marquee">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="w-full aspect-[1/2] border-4 border-black rounded-full" />
                ))}
              </div>
            </div>

            <div className="p-8 pt-20 flex-1 flex flex-col space-y-12 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Protocol v.2.5</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-[72px] font-bold tracking-tighter leading-[0.85] text-black">
                  Elite <br />Stacks.
                </h1>
                <p className="text-xl text-zinc-400 font-medium max-w-[280px] leading-snug">
                  Track vitamins. Avoid overlaps. Optimize biology.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-8 pt-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 border border-zinc-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold uppercase tracking-widest">Stack Safety</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">Real-time interaction and toxic overlap detection.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 border border-zinc-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Microscope className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold uppercase tracking-widest">Bio-Analytics</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">Data-driven correlations between supplements and outcomes.</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-4 pb-4">
                <button
                  onClick={() => setCurrentStep("profile")}
                  className="group w-full py-6 bg-black text-white rounded-full font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all active:scale-[0.98]">
                  Initiate Protocol
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
                <p className="text-[9px] text-center font-bold text-zinc-300 uppercase tracking-widest">Secure Cloud Sync Enabled</p>
              </div>
            </div>
          </div>
        )}

        {currentStep !== "welcome" && (
          <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-12">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Section {ONBOARDING_STEPS.indexOf(currentStep)} of 5</span>
              <button onClick={() => setCurrentStep("ready")} className="text-[10px] font-bold uppercase tracking-widest opacity-30">Skip</button>
            </div>

            {currentStep === "profile" && (
              <div className="flex-1 space-y-12">
                <h2 className="text-4xl font-bold tracking-tight">Identity.</h2>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 ml-1">Biological Sex</label>
                  <div className="grid grid-cols-1 gap-2">
                    {["Male", "Female", "Non-Binary"].map((s) => (
                      <button key={s} className="w-full py-6 border border-zinc-100 rounded-2xl font-bold text-left px-6 hover:border-black transition-all flex justify-between items-center group">
                        {s} <ChevronRight className="w-4 h-4 text-zinc-200 group-hover:text-black transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setCurrentStep("goals")} className="w-full py-6 bg-black text-white rounded-full font-bold uppercase tracking-[0.2em] text-[10px] mt-auto">Continue</button>
              </div>
            )}

            {currentStep === "goals" && (
              <div className="flex-1 space-y-12">
                <h2 className="text-4xl font-bold tracking-tight">Focus.</h2>
                <div className="grid grid-cols-1 gap-2">
                  {["Longevity", "Deep Sleep", "Cognitive Focus", "Immune Support", "Metabolic Health"].map((g) => (
                    <button key={g} className="w-full py-6 border border-zinc-100 rounded-2xl font-bold text-left px-6 hover:bg-black hover:text-white transition-all text-sm tracking-tight">
                      {g}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrentStep("ready")} className="w-full py-6 bg-black text-white rounded-full font-bold uppercase tracking-[0.2em] text-[10px] mt-auto">Set Protocol</button>
              </div>
            )}
          </div>
        )}
        <style dangerouslySetInnerHTML={{ __html: "@keyframes marquee { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } } .animate-marquee { animation: marquee 30s linear infinite; }" }} />
      </div>
    );
  }

	return (
    <div className="min-h-screen bg-white text-black pb-28 font-sans selection:bg-zinc-200">
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 h-20 px-8 flex items-center justify-between border-b border-zinc-100">
        <div className="flex flex-col">
          <h1 className="font-bold text-lg tracking-[0.2em] uppercase leading-none">Vitamax</h1>
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Status: Optimized</span>
        </div>
        <div className="flex items-center gap-6">
          <button className="relative">
            <Bell className="w-5 h-5 stroke-[1.5]" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-black rounded-full" />
          </button>
          <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden">
            <div className="w-full h-full bg-black flex items-center justify-center text-[10px] text-white font-bold">K</div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-8 py-10">
        {activeTab === "today" && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <section className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold tracking-tighter">Day 06</h2>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Consistency Streak</p>
                </div>
                <p className="text-xs font-bold">{takenToday.length}/{stack.length} Complete</p>
              </div>
              <ProgressBar progress={(takenToday.length / stack.length) * 100} />
            </section>

            <div className="space-y-12">
              {["morning", "night"].map((time) => (
                <section key={time} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">{time}</h3>
                  </div>

                  <div className="space-y-2">
                    {stack.filter((s) => s.time === time).map((item) => (
                      <div key={item.id} onClick={() => toggleTaken(item.id)} className="group flex items-center justify-between py-6 transition-all cursor-pointer border-b border-zinc-50 last:border-0">
                        <div className="flex items-center gap-6">
                          <div className={`w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center transition-all ${takenToday.includes(item.id) ? "bg-black border-black text-white" : "bg-white text-black"}`}>
                            {takenToday.includes(item.id) ? <CheckCircle2 className="w-5 h-5" /> : <Pill className="w-5 h-5 stroke-[1.5]" />}
                          </div>
                          <div>
                            <h4 className={`text-lg font-bold tracking-tight transition-all ${takenToday.includes(item.id) ? "text-zinc-300" : "text-black"}`}>{item.name}</h4>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{item.dose} • {item.brand}</p>
                          </div>
                        </div>
                        <ArrowUpRight className={`w-4 h-4 transition-all ${takenToday.includes(item.id) ? "opacity-0" : "opacity-20 group-hover:opacity-100"}`} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="bg-zinc-50 p-8 rounded-3xl border border-zinc-100 flex items-start gap-4">
              <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-1" />
              <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                Analysis: Your B12 consistency is 100% this week. Cognitive baseline suggests a 4% lift in morning focus tasks.
              </p>
            </div>
          </div>
        )}

        {activeTab === "stack" && (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="flex items-end justify-between">
              <h2 className="text-4xl font-bold tracking-tighter">Stack.</h2>
              <button className="text-xs font-bold uppercase border-b border-black pb-1 flex items-center gap-2">
                <span className="text-base">+</span> Add Product
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {stack.map((item) => (
                <div key={item.id} className="group border border-zinc-100 rounded-3xl p-8 hover:border-black transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-xl font-bold tracking-tight">{item.name}</h4>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{item.brand}</p>
                    </div>
                    <span className="text-[10px] font-bold border border-zinc-200 px-3 py-1 rounded-full uppercase">{item.time}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest pt-6 border-t border-zinc-50">
                    <span className="text-zinc-400">{item.dose} / Serving</span>
                    <div className="flex gap-4">
                      <button className="hover:text-black text-zinc-300 transition-colors">Edit</button>
                      <button className="hover:text-red-500 text-zinc-300 transition-colors">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "scan" && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="bg-black rounded-[3rem] aspect-[3/4] relative overflow-hidden shadow-2xl">
              {isScanning ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-12">
                  <div className="w-full aspect-[4/5] border border-white/20 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-white shadow-[0_0_20px_white] animate-scan-mono" />
                  </div>
                  <div className="mt-8 text-center">
                    <p className="text-white font-bold text-xs tracking-[0.4em] uppercase animate-pulse">Analyzing</p>
                  </div>
                </div>
              ) : scanResult ? (
                <div className="absolute inset-0 bg-white p-10 flex flex-col animate-in slide-in-from-bottom-8">
                  <div className="flex-1 space-y-12">
                    <div className="space-y-4">
                      <h3 className="text-4xl font-bold tracking-tighter">Review.</h3>
                      <div>
                        <p className="text-xl font-bold">Zinc Picolinate</p>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Thorne Research • 30mg</p>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="flex gap-4 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest mb-1">Safety Check</p>
                          <p className="text-xs text-zinc-500 leading-relaxed">Overlap detected. Current multivitamin provides 15mg. Total would be 45mg/day.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setStack([...stack, MOCK_DB[3]]);
                        setScanResult(false);
                        setActiveTab("stack");
                      }}
                      className="w-full py-6 bg-black text-white rounded-full font-bold uppercase tracking-widest text-[10px]">
                      Approve & Add
                    </button>
                    <button onClick={() => setScanResult(false)} className="w-full py-4 text-zinc-400 font-bold uppercase tracking-widest text-[10px]">
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white space-y-8">
                  <div className="w-20 h-20 border border-white/20 rounded-full flex items-center justify-center">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold uppercase tracking-[0.3em]">Optical Scan</h2>
                    <p className="text-zinc-500 text-xs leading-relaxed px-6">Align the supplement facts label within the viewfinder.</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsScanning(true);
                      setTimeout(() => {
                        setIsScanning(false);
                        setScanResult(true);
                      }, 2500);
                    }}
                    className="px-10 py-5 bg-white text-black rounded-full font-bold uppercase tracking-widest text-[10px] hover:scale-105 transition-transform">
                    Open Lens
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <h2 className="text-4xl font-bold tracking-tighter">Metrics.</h2>
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stack Efficiency</p>
                <p className="text-3xl font-bold">82%</p>
              </div>
              <ProgressBar progress={82} />
              <div className="grid grid-cols-1 gap-1 pt-6">
                {[
                  { label: "Absorption Timing", score: "Optimized" },
                  { label: "Pill Burden", score: "Moderate" },
                  { label: "Conflict Risk", score: "Low" },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between py-4 border-b border-zinc-100 last:border-0">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{s.label}</span>
                    <span className="text-xs font-bold uppercase tracking-widest">{s.score}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="bg-black text-white p-8 rounded-[2.5rem] space-y-4">
              <ShieldAlert className="w-6 h-6 text-white" />
              <h3 className="text-lg font-bold tracking-tight">Active Warning.</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Zinc and Magnesium compete for the same absorption pathways. We recommend separating your intake by 2+ hours for maximum efficacy.
              </p>
            </section>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center text-black border border-zinc-200">
                <User className="w-10 h-10 stroke-[1]" />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tighter">Kashish.</h2>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Tier: Protocol Elite</p>
              </div>
            </div>
            <div className="space-y-1">
              {[
                { label: "Personalization", sub: "Goals, Diet, Meds" },
                { label: "Notifications", sub: "Protocols & Streaks" },
                { label: "Health Data", sub: "Biometric Sync" },
                { label: "Security", sub: "Encryption & Privacy" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-6 border-b border-zinc-100 last:border-0 hover:px-2 transition-all cursor-pointer">
                  <div>
                    <p className="font-bold text-xs uppercase tracking-widest">{item.label}</p>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{item.sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/95 backdrop-blur-xl border-t border-zinc-100 z-50 px-10 flex items-center justify-between pb-safe">
        <NavIcon active={activeTab === "today"} onClick={() => setActiveTab("today")} icon={<LayoutDashboard />} />
        <NavIcon active={activeTab === "stack"} onClick={() => setActiveTab("stack")} icon={<ShoppingBag />} />
        <button
          onClick={() => setActiveTab("scan")}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${activeTab === "scan" ? "bg-black text-white scale-110" : "bg-zinc-100 text-black hover:bg-black hover:text-white"}`}>
          <Camera className="w-6 h-6" />
        </button>
        <NavIcon active={activeTab === "insights"} onClick={() => setActiveTab("insights")} icon={<BarChart3 />} />
        <NavIcon active={activeTab === "profile"} onClick={() => setActiveTab("profile")} icon={<User />} />
      </nav>

      <style dangerouslySetInnerHTML={{ __html: "@keyframes scan-mono { 0%, 100% { top: 0; } 50% { top: 100%; } } .animate-scan-mono { animation: scan-mono 2.5s ease-in-out infinite; } .pb-safe { padding-bottom: env(safe-area-inset-bottom); }" }} />
    </div>
  );
}

function NavIcon({
  active,
  onClick,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactElement;
}) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? "text-black opacity-100" : "text-zinc-300 opacity-60"}`}>
      <div className={`transition-transform duration-500 ${active ? "scale-110" : "scale-100"}`}>
        {React.cloneElement(icon, { size: 20, strokeWidth: active ? 2.5 : 1.5 })}
      </div>
      {active && <div className="w-1 h-1 bg-black rounded-full animate-in zoom-in" />}
    </button>
  );
}
