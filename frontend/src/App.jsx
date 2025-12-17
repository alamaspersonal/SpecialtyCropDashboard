import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [crops, setCrops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const fetchCrops = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/crops')
        setCrops(response.data)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to fetch data from backend. Ensure backend is running.")
        setLoading(false)
      }
    }

    fetchCrops()
  }, [])

  // Optimized Search Logic
  useEffect(() => {
    if (searchQuery.length > 0) {
      const query = searchQuery.toLowerCase()
      const matches = new Set()

      crops.forEach(crop => {
        if (crop.commodity && crop.commodity.toLowerCase().includes(query)) matches.add(crop.commodity)
        if (crop.variety && crop.variety.toLowerCase().includes(query)) matches.add(crop.variety)
        if (crop.location && crop.location.toLowerCase().includes(query)) matches.add(crop.location)
      })

      setSuggestions(Array.from(matches).slice(0, 5)) // Limit to top 5
    } else {
      setSuggestions([])
    }
  }, [searchQuery, crops])

  // Filter crops based on search
  const filteredCrops = crops.filter(crop => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      (crop.commodity && crop.commodity.toLowerCase().includes(query)) ||
      (crop.variety && crop.variety.toLowerCase().includes(query)) ||
      (crop.location && crop.location.toLowerCase().includes(query))
    )
  })

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-green-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Specialty Crop Dashboard</h1>
          <p className="mt-2 text-green-100 text-sm">Real-time pricing data for specialty crops</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">

        {/* Search Bar Section */}
        <div className="max-w-xl mx-auto mb-8 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by commodity, variety, or location..."
              className="w-full px-5 py-3 border-2 border-green-500 rounded-full shadow-sm focus:outline-none focus:ring-4 focus:ring-green-500/30 text-lg transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)} // Delay to allow click
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isFocused && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <ul>
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onClick={() => setSearchQuery(suggestion)}
                    className="px-5 py-3 hover:bg-green-50 cursor-pointer text-gray-700 font-medium border-b border-gray-100 last:border-0 transition-colors"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white shadow-md rounded-lg mx-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Commodity
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Variety
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Price (Min)
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Price (Max)
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCrops.map((crop) => (
                  <tr key={crop.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                    <td className="px-5 py-4 border-b border-gray-200 text-sm">
                      <div className="flex items-center">
                        <div className="ml-3">
                          <p className="text-gray-900 whitespace-no-wrap font-medium">
                            {crop.commodity}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">{crop.variety}</p>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">
                        {crop.location}
                      </p>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">
                        {new Date(crop.date).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-right">
                      <p className="text-gray-900 whitespace-no-wrap font-bold text-green-600">
                        ${crop.price_min?.toFixed(2)}
                      </p>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-right">
                      <p className="text-gray-900 whitespace-no-wrap font-bold text-green-600">
                        ${crop.price_max?.toFixed(2)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCrops.length === 0 && !loading && !error && (
              <div className="p-12 text-center text-gray-500 bg-gray-50">
                <p className="text-lg font-medium">No results found for "{searchQuery}"</p>
                <p className="text-sm mt-2">Try searching for a different commodity, variety, or location.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
