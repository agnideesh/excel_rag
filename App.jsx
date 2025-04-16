import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [responseData, setResponseData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [tableName, setTableName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [dataSummary, setDataSummary] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    await processFile(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const processFile = async (file) => {
    // Check if file is an Excel file
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setLoading(true);
    setError('');
    setUploadStatus(null);
    setResponseData(null);
    setDataSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        setUploadStatus(`File ${file.name} uploaded and converted to database`);
        setSessionId(result.session_id);
        setTableName(result.table_name);
        // After successful upload, get basic data summary
        analyzeData(result.session_id);
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
    setLoading(false);
  };

  const analyzeData = async (sid) => {
    setAnalyzing(true);
    try {
      // Get basic data stats
      const summaryPrompt = "Provide a brief summary of this data with count of rows, list of columns, and data types";
      const res = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: summaryPrompt, session_id: sid })
      });
      const result = await res.json();
      if (!result.error) {
        setDataSummary(result);
      }
    } catch (err) {
      console.error("Error analyzing data:", err);
    }
    setAnalyzing(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // Update sample prompts to better demonstrate how to get both columns
  const samplePrompts = [
    "Show me the top 5 products by revenue with their revenue values",
    "List customers with the highest total spending and show the spending amount",
    "What are the 3 best performing categories by profit margin and what are their margins?", 
    "Find months with sales below average and show their sales figures"
  ];

  const useSamplePrompt = (prompt) => {
    setPrompt(prompt);
  };

  // Add a hint for better SQL generation
  const enhancePrompt = (userPrompt) => {
    // If the prompt mentions ordering or sorting by a specific column, make sure to select that column too
    if (userPrompt.toLowerCase().includes('based on') || 
        userPrompt.toLowerCase().includes('order by') || 
        userPrompt.toLowerCase().includes('sort by')) {
      return prompt;
    }
    return prompt;
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt before submitting.');
      return;
    }

    if (!sessionId) {
      setError('Please upload an Excel file first.');
      return;
    }

    setLoading(true);
    setError('');
    setResponseData(null);

    try {
      const res = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enhancePrompt(prompt), session_id: sessionId })
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setResponseData(result);
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [responseData]);

  const handleClear = () => {
    setPrompt('');
    setResponseData(null);
    setError('');
    // Don't clear session to allow multiple queries on the same file
  };

  const handleReset = async () => {
    if (sessionId) {
      try {
        await fetch(`http://localhost:8000/session/${sessionId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    }
    
    setPrompt('');
    setResponseData(null);
    setError('');
    setUploadStatus(null);
    setSessionId('');
    setTableName('');
    setDataSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <header className="bg-black bg-opacity-30 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Talk To Excel
            </h1>
            <div className="text-sm text-gray-400">
              Powered by <span className="text-emerald-400">Gemini AI</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left sidebar for upload and data summary */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden mb-8">
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-4 text-blue-400 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    Upload Excel File
                  </h2>
                  
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ease-in-out ${dragActive ? 'border-blue-400 bg-blue-400/10' : 'border-gray-600 hover:border-gray-500'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p className="mb-2 text-gray-300">Drag and drop your file, or</p>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg cursor-pointer transition-colors duration-200 inline-block">
                      Browse Files
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        ref={fileInputRef}
                        className="hidden"
                      />
                    </label>
                    <p className="mt-2 text-xs text-gray-500">Excel files only (.xlsx, .xls)</p>
                  </div>
                </div>

                {uploadStatus && (
                  <div className="px-6 pb-6">
                    <div className="bg-blue-900/30 border border-blue-800 text-blue-400 p-4 rounded-lg flex items-start">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div>
                        <p className="font-medium">{uploadStatus}</p>
                        {tableName && <p className="text-sm text-gray-300 mt-1">Table name: <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded">{tableName}</span></p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Summary Section */}
              {sessionId && (
                <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden">
                  <div className="p-6">
                    <h2 className="text-xl font-bold mb-4 text-emerald-400 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                      </svg>
                      Data Overview
                    </h2>
                    
                    {analyzing ? (
                      <div className="text-center py-4">
                        <svg className="animate-spin h-6 w-6 mx-auto text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="mt-2 text-sm text-gray-400">Analyzing your data...</p>
                      </div>
                    ) : dataSummary ? (
                      <div className="text-sm text-gray-300">
                        <div className="bg-gray-900 p-3 rounded-lg overflow-auto max-h-64">
                          <pre className="whitespace-pre-wrap">{dataSummary.sql}</pre>
                          {dataSummary.data && dataSummary.data.length > 0 && (
                            <div className="mt-2 border-t border-gray-700 pt-2">
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(dataSummary.data[0]).map(([key, value]) => (
                                  <div key={key} className="overflow-hidden">
                                    <div className="text-xs text-gray-500">{key}:</div>
                                    <div className="font-mono text-xs truncate">{value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Upload a file to see data summary</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Main content area */}
            <div className="lg:col-span-3">
              <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden">
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-4 text-purple-400 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                    </svg>
                    Ask About Your Data
                  </h2>
                  
                  <div className="bg-gray-900 rounded-lg p-4">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full h-[120px] p-4 text-white bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none rounded-lg transition-all duration-200 resize-none placeholder-gray-400"
                      placeholder="Example: Show me the top 5 products by revenue and include their revenue values..."
                      disabled={!sessionId}
                    ></textarea>
                    
                    {/* Prompt tip */}
                    <div className="mt-2 text-xs text-purple-400 flex items-start">
                      <svg className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <p>Tip: For ranking questions, be sure to ask for both the items AND the values they're ranked by.</p>
                    </div>
                    
                    {/* Sample prompts */}
                    {sessionId && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-400 mb-2">Try one of these sample prompts:</p>
                        <div className="flex flex-wrap gap-2">
                          {samplePrompts.map((samplePrompt, index) => (
                            <button
                              key={index}
                              onClick={() => useSamplePrompt(samplePrompt)}
                              className="text-xs bg-gray-700 hover:bg-gray-600 py-1.5 px-3 rounded-full transition-colors duration-200"
                            >
                              {samplePrompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !sessionId}
                      className={`flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${(!sessionId && !loading) 
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50' 
                        : loading 
                          ? 'bg-purple-600 text-white cursor-wait' 
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'}`}
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                          </svg>
                          Run Query
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleClear}
                      disabled={!prompt}
                      className={`flex items-center px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors duration-200 ${!prompt ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      Clear Query
                    </button>
                    
                    <button
                      onClick={handleReset}
                      disabled={!sessionId}
                      className={`flex items-center px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200 ${!sessionId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      Reset All
                    </button>
                  </div>
                  
                  {/* Error Message */}
                  {error && (
                    <div className="mt-4 bg-red-900/30 border border-red-800 text-red-400 p-3 rounded-lg flex items-start text-sm">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <p>{error}</p>
                    </div>
                  )}
                  
                  {/* Results */}
                  {responseData && (
                    <div ref={scrollRef} className="mt-6">
                      <div className="border-b border-gray-700 pb-4 mb-4">
                        <h3 className="text-lg font-bold text-emerald-400 mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                          </svg>
                          Generated SQL
                        </h3>
                        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                          <div className="absolute top-0 right-0 m-2">
                            <button
                              onClick={() => copyToClipboard(responseData.sql)}
                              className="text-xs bg-gray-700 hover:bg-gray-600 p-1.5 rounded transition-colors duration-200 relative"
                              aria-label="Copy to clipboard"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                              </svg>
                              {showTooltip && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap">
                                  Copied!
                                </div>
                              )}
                            </button>
                          </div>
                          <pre className="p-4 text-green-400 font-mono text-sm overflow-x-auto">{responseData.sql}</pre>
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-bold text-emerald-400 mb-2 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        Results
                      </h3>
                      
                      {responseData.data && responseData.data.length > 0 ? (
                        <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-700">
                          <table className="min-w-full divide-y divide-gray-800">
                            <thead className="bg-gray-800">
                              <tr>
                                {Object.keys(responseData.data[0] || {}).map((key) => (
                                  <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                              {responseData.data.map((row, rowIndex) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}>
                                  {Object.values(row).map((value, colIndex) => (
                                    <td key={colIndex} className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
                                      {value !== null ? value : <span className="text-gray-500">NULL</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-gray-900 p-4 rounded-lg text-gray-300 border border-gray-700">
                          <p>{responseData.message || "No data returned"}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* FAQ Section for SEO */}
        <div className="max-w-4xl mx-auto mt-16 mb-12">
          <h2 className="text-2xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Frequently Asked Questions
          </h2>
          
          <div className="grid gap-6">
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">How does Talk To Excel work?</h3>
              <p className="text-gray-300">
                Simply upload your Excel file, and then ask questions about your data in plain English. Our AI translates your questions into SQL queries and shows you the results instantly. The process happens entirely in your browser, ensuring your data remains private and secure.
              </p>
            </div>
            
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">Do I need to know SQL to use Talk To Excel?</h3>
              <p className="text-gray-300">
                No! That's the beauty of Talk To Excel. You can query your Excel data with natural language questions without knowing any SQL. Simply ask questions like "Show me the top 5 products by revenue" or "What was the average sales in Q1?" and get immediate answers.
              </p>
            </div>
            
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">Is my data secure when I use Talk To Excel?</h3>
              <p className="text-gray-300">
                Yes, your data is secure. Your Excel files are processed locally in your browser and converted to a temporary database that is deleted when you're done or close the session. We never store your Excel file or data on our servers.
              </p>
            </div>
            
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">What types of Excel files are supported?</h3>
              <p className="text-gray-300">
                Talk To Excel supports both .xlsx and .xls file formats. Your spreadsheet should have headers in the first row that describe your data columns. The tool works best with structured data in a tabular format.
              </p>
            </div>
            
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">Can I see the SQL queries being generated?</h3>
              <p className="text-gray-300">
                Yes! Talk To Excel shows you the exact SQL query that was generated from your natural language question. This is great for learning SQL or understanding how your question was interpreted by our AI.
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer with keyword-rich content */}
        <footer className="border-t border-gray-800 pt-8 pb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Talk To Excel - Natural Language Excel Query Tool
            </h2>
            <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
              The easiest way to query your Excel files using plain English. No SQL knowledge required.
              Talk to your Excel data and get instant insights using AI-powered natural language processing.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-gray-500">
              <span>Talk to Excel</span>
              <span>•</span>
              <span>Excel to SQL Converter</span>
              <span>•</span>
              <span>Natural Language Excel Query</span>
              <span>•</span>
              <span>Chat with Excel Data</span>
              <span>•</span>
              <span>SQL Query Generator</span>
            </div>
            <p className="text-xs text-gray-600">
              © {new Date().getFullYear()} Talk To Excel. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
