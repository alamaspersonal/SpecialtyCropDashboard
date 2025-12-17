import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'http://127.0.0.1:8000'

function App() {
  const [filters, setFilters] = useState(null)
  const [selectedFilters, setSelectedFilters] = useState({
    commodity: '',
    variety: '',
    category: '',
    district: '',
    organic: '',
    date: '',
  })
  const [priceData, setPriceData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [marketNotes, setMarketNotes] = useState('')

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/filters`)
        setFilters(response.data)
        // Set default date to most recent
        if (response.data.dates && response.data.dates.length > 0) {
          setSelectedFilters(prev => ({ ...prev, date: response.data.dates[0] }))
        }
      } catch (err) {
        console.error("Error fetching filters:", err)
        setError("Failed to load filters.")
      }
    }
    fetchFilters()
  }, [])

  // Fetch price data when filters change
  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        Object.entries(selectedFilters).forEach(([key, value]) => {
          if (value) params.append(key, value)
        })
        params.append('limit', '50')

        const response = await axios.get(`${API_URL}/api/prices?${params}`)
        setPriceData(response.data)

        // Extract market notes from first result
        if (response.data.length > 0 && response.data[0].market_tone_comments) {
          setMarketNotes(response.data[0].market_tone_comments)
        } else {
          setMarketNotes('')
        }

        setLoading(false)
      } catch (err) {
        console.error("Error fetching prices:", err)
        setError("Failed to load price data.")
        setLoading(false)
      }
    }

    if (selectedFilters.date) {
      fetchPrices()
    }
  }, [selectedFilters])

  const handleFilterChange = (filterName, value) => {
    setSelectedFilters(prev => ({ ...prev, [filterName]: value }))
  }

  // Calculate average prices for display
  const avgLowPrice = priceData.length > 0
    ? (priceData.reduce((sum, p) => sum + (p.low_price || 0), 0) / priceData.filter(p => p.low_price).length).toFixed(2)
    : '—'
  const avgHighPrice = priceData.length > 0
    ? (priceData.reduce((sum, p) => sum + (p.high_price || 0), 0) / priceData.filter(p => p.high_price).length).toFixed(2)
    : '—'

  return (
    <div className="min-h-screen bg-slate-100 text-gray-900 font-sans">
      <header className="bg-teal-700 text-white shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold tracking-tight">Specialty Crop Dashboard</h1>
          <p className="text-teal-200 text-sm">USDA Market Pricing Data</p>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar - Filters */}
        <aside className="w-64 bg-white shadow-md p-4 min-h-screen border-r border-gray-200">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Filters</h2>

          {filters ? (
            <div className="space-y-4">
              <FilterDropdown
                label="Date"
                options={filters.dates}
                value={selectedFilters.date}
                onChange={(v) => handleFilterChange('date', v)}
                color="bg-blue-600"
              />
              <FilterDropdown
                label="Category"
                options={filters.categories}
                value={selectedFilters.category}
                onChange={(v) => handleFilterChange('category', v)}
                color="bg-pink-600"
              />
              <FilterDropdown
                label="Commodity"
                options={filters.commodities}
                value={selectedFilters.commodity}
                onChange={(v) => handleFilterChange('commodity', v)}
                color="bg-teal-600"
              />
              <FilterDropdown
                label="Variety"
                options={filters.varieties}
                value={selectedFilters.variety}
                onChange={(v) => handleFilterChange('variety', v)}
                color="bg-yellow-500"
              />
              <FilterDropdown
                label="District"
                options={filters.districts}
                value={selectedFilters.district}
                onChange={(v) => handleFilterChange('district', v)}
                color="bg-teal-600"
              />
              <FilterDropdown
                label="Organic"
                options={filters.organics}
                value={selectedFilters.organic}
                onChange={(v) => handleFilterChange('organic', v)}
                color="bg-green-600"
              />
            </div>
          ) : (
            <div className="text-gray-400 text-sm">Loading filters...</div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Price Display Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Price Cards */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Terminal Market Price — {selectedFilters.date || 'Select Date'}
                </h3>

                {loading ? (
                  <div className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-600"></div>
                  </div>
                ) : priceData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Price Summary Bar */}
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg text-white">
                      <div className="flex-1">
                        <p className="text-sm opacity-80">Avg. Low Price</p>
                        <p className="text-3xl font-bold">${avgLowPrice}</p>
                      </div>
                      <div className="h-12 w-px bg-white/30"></div>
                      <div className="flex-1">
                        <p className="text-sm opacity-80">Avg. High Price</p>
                        <p className="text-3xl font-bold">${avgHighPrice}</p>
                      </div>
                      <div className="h-12 w-px bg-white/30"></div>
                      <div className="flex-1">
                        <p className="text-sm opacity-80">Records</p>
                        <p className="text-3xl font-bold">{priceData.length}</p>
                      </div>
                    </div>

                    {/* Data Table */}
                    <div className="overflow-x-auto max-h-96">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Commodity</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Variety</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Package</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Low</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">High</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {priceData.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-900">{item.commodity}</td>
                              <td className="px-3 py-2 text-gray-600">{item.variety || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{item.package || '—'}</td>
                              <td className="px-3 py-2 text-right text-green-600 font-semibold">
                                {item.low_price ? `$${item.low_price.toFixed(2)}` : '—'}
                              </td>
                              <td className="px-3 py-2 text-right text-green-600 font-semibold">
                                {item.high_price ? `$${item.high_price.toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    No data found for the selected filters.
                  </div>
                )}
              </div>
            </div>

            {/* Market Notes Panel */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Market Notes</h3>
                <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {marketNotes || 'No market notes available for the current selection.'}
                </div>
              </div>

              {/* Placeholder for Production Costs CTA */}
              <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl p-6 text-center">
                <p className="text-yellow-800 font-semibold">Click here to compare with your production costs</p>
                <button className="mt-3 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition">
                  Compare Costs
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// Filter Dropdown Component
function FilterDropdown({ label, options, value, onChange, color }) {
  return (
    <div>
      <label className={`block text-xs font-semibold text-white px-2 py-1 rounded-t ${color}`}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-b px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="">All</option>
        {options && options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

export default App
