import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar,
  ChevronDown,
  Menu,
  Download,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import PriceWaterfall from './components/PriceWaterfall';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [
    selectedCommodity,
    setSelectedCommodity
  ] = useState("Strawberries");
  const [commodities, setCommodities] = useState([]); // Dynamic list

  // Filter State
  const [selectedDate, setSelectedDate] = useState("");

  // Cost Config
  const [costs, setCosts] = useState({
    packing: 2.50,
    cooling: 0.80,
    inspection: 0.15,
    commission: 0.50
  });

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]); // Fix missing state if needed, though replaced by waterfall? 
  // actually chartData was used in previous code but I see 'setChartData' in fetchDashboardData but where is state declared? 
  // In the file view it was missing line 32 in the previous view output looked like:
  /*
  31:   const [stats, setStats] = useState(null);
  32:   const [loading, setLoading] = useState(false);
  33: 
  34:   // Initial Fetch
  */
  // Wait, looking at the previous file view of App.jsx (Step 834):
  // Line 49 says `setChartData(pricesRes.data);`
  // But I don't see `const [chartData, setChartData] = useState(...)` in lines 1-32.
  // Ah, looking closely at Step 834...
  // Line 31-32:
  // 31:   const [stats, setStats] = useState(null);
  // 32:   const [loading, setLoading] = useState(false);
  // It seems I missed declaring chartData in the previous edit or it was lost?
  // I will re-add it to be safe, although PriceWaterfall might not use it? 
  // App.jsx uses MarketChart (line 142) which uses chartData.

  useEffect(() => {
    fetchCommodities();
  }, []);

  const fetchCommodities = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/filters');
      if (res.data.commodities) {
        setCommodities(res.data.commodities);
      }
    } catch (err) {
      console.error("Error fetching filters:", err);
    }
  };

  // Initial Fetch
  useEffect(() => {
    fetchDashboardData();
  }, [selectedCommodity]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Parallel Fetch
      const [statsRes, pricesRes] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/api/v2/stats?commodity=${selectedCommodity}`),
        axios.get(`http://127.0.0.1:8000/api/v2/prices?commodity=${selectedCommodity}`)
      ]);

      setStats(statsRes.data);
      setChartData(pricesRes.data);  // Make sure chartData state exists

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">

      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} 
        bg-white border-r border-gray-200 transition-all duration-300 flex flex-col fixed md:relative z-20 h-full`}
      >
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">
            Ag
          </div>
          {sidebarOpen && <span className="font-bold text-xl tracking-tight text-emerald-950">MarketIntel</span>}
        </div>

        <div className="p-4 space-y-2 flex-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-lg font-medium">
            <LayoutDashboard size={20} />
            {sidebarOpen && <span>Dashboard</span>}
          </button>
          {/* Add more nav items later */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              <Menu size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Market Intelligence</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Commodity Search / Selector */}
            <div className="relative">
              <select
                className="appearance-none bg-gray-100 pl-4 pr-10 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                value={selectedCommodity}
                onChange={(e) => setSelectedCommodity(e.target.value)}
              >
                {commodities.length > 0 ? (
                  commodities.map(c => <option key={c} value={c}>{c}</option>)
                ) : (
                  <option>Loading...</option>
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
            </div>

            <div className="h-8 w-px bg-gray-300 mx-2"></div>

            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Calendar size={16} />
              <span>Last 12 Months</span>
            </button>

            <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 shadow-sm">
              <Download size={16} />
              <span>Export</span>
            </button>
          </div>
        </header>

        {/* Scrollable Dashboard Area */}
        <div className="flex-1 overflow-y-auto p-8">

          {loading && (
            <div className="mb-4 text-emerald-600 font-medium animate-pulse">Updating Real-time Market Data...</div>
          )}

          {/* KPI Cards */}
          <KPIScorecard stats={stats} />

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Col: Main Chart (Span 2) */}
            <div className="lg:col-span-2 space-y-8">
              <MarketChart data={chartData} />

              {/* Secondary Chart Placeholder */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-64 flex items-center justify-center text-gray-400">
                Additional Volume Analysis (Coming Phase 3)
              </div>
            </div>

            {/* Right Col: Filters & Details */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">Drill Down</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Variety</label>
                    <div className="space-y-2">
                      {/* Mock Filters */}
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-500" defaultChecked />
                        All Varieties
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Package Size</label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-md py-2 px-3 text-sm">
                      <option>All Packages</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-900 mb-2">Market Insight</h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  Spread for <span className="font-bold">{selectedCommodity}</span> is currently
                  <span className="font-bold"> ${stats?.spread || '0.00'}</span>.
                  Historical trends suggest a tightening of margins in Q4 due to increased shipping volume from Mexico.
                </p>
              </div>

            </div>

          </div>

        </div>

      </main>
    </div>
  );
}

export default App;
