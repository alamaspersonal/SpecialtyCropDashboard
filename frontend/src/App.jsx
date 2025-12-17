import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [crops, setCrops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-green-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Specialty Crop Dashboard</h1>
          <p className="mt-2 text-green-100 text-sm">Real-time pricing data for specialty crops</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
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
                {crops.map((crop) => (
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
            {crops.length === 0 && !loading && !error && (
              <div className="p-6 text-center text-gray-500">
                No data available. Run the seed script inside backend/ to generate data.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
