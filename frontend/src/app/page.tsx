'use client';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  loading?: boolean;
  error?: boolean;
}

interface ChatResponse {
  my_response: {
    summary: string;
    full_explanation: string;
    relevant_sources: string[];
  }
}

export default function Home() {
  const [state, setState] = useState({
    message: '',
    response: null as ChatResponse | null,
    loading: false,
    linkPreviews: [] as LinkPreview[],
    loadingDots: '',
    submittedMessage: ''
  });

  useEffect(() => {
    if (!state.loading) return;
    
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        loadingDots: prev.loadingDots.length >= 3 ? '' : prev.loadingDots + '.'
      }));
    }, 500);
    
    return () => clearInterval(interval);
  }, [state.loading]);

  const fetchLinkPreviews = async (urls: string[]) => {
    setState(prev => ({ ...prev, linkPreviews: urls.map(url => ({ url, loading: true })) }));

    const previews = await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(`${process.env.BACKEND_URL}/preview?url=${encodeURIComponent(url)}`);
          const data = await res.json();
          return { url, title: data.title, description: data.description, loading: false };
        } catch (error) {
          console.error(`Error fetching preview for ${url}:`, error);
          return { url, error: true, loading: false };
        }
      })
    );

    setState(prev => ({ ...prev, linkPreviews: previews }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      linkPreviews: [], 
      submittedMessage: prev.message,
      message: ''
    }));

    try {
      const res = await fetch(`${process.env.BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_message: state.message }),
      });

      const data = await res.json();
      setState(prev => ({ ...prev, response: data }));
      
      if (data.my_response.relevant_sources.length > 0) {
        fetchLinkPreviews(data.my_response.relevant_sources);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <main className="min-h-screen bg-[#1a1b1e] flex flex-col items-center pt-32 p-4">
      {!state.response && !state.loading && (
        <> {/* fragments instead of divs */}
          <h1 className="text-6xl font-light text-white font-mono font-bold mb-16">ask away 💭</h1>
          
          <div className="w-full max-w-3xl">
            <form onSubmit={handleSubmit} className="relative mb-8">
              <input
                type="text"
                value={state.message}
                onChange={(submission) => setState(prev => ({ ...prev, message: submission.target.value }))}
                className="w-full bg-[#25262b] text-gray-200 rounded-xl p-4 pl-5 pr-32 border border-gray-700 focus:border-gray-500 focus:outline-none font-mono text-lg"
                placeholder="let's search the internet ... "
              />
              <button
                type="submit"
                disabled={state.loading || !state.message.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 mr-2 py-2 bg-blue-300 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {state.loading ? '⭐️' : 'go'}
              </button>
            </form>

            <div className="grid grid-cols-2 gap-4 font-mono">
              {['what is the meaning of life?', 'top travel spots', 
                'what is an llm?', 'what is the techx societyat unc?'].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setState(prev => ({ ...prev, message: suggestion }))}
                  className="text-left bg-[#25262b] text-gray-200 p-4 rounded-xl hover:bg-[#2c2d32] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl">
                      {index === 0 && '🧘‍♀️'}
                      {index === 1 && '🚀'}
                      {index === 2 && '🤖'}
                      {index === 3 && '💻'}
                    </span>
                    {suggestion}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {state.loading ? (
        <div className="mt-4 w-full max-w-3xl">
          <h2 className="text-2xl text-gray-200 font-semibold mb-4">{state.submittedMessage}</h2>
          <div className="bg-[#25262b] rounded-lg p-6">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-300 rounded-full animate-pulse"/>
              <p className="text-gray-300">just a sec ..{state.loadingDots}</p>
            </div>
            <div className="mt-4 space-y-3">
              <div className="h-4 bg-gray-700 rounded w-3/4 animate-pulse"/>
              <div className="h-4 bg-gray-700 rounded w-1/2 animate-pulse"/>
              <div className="h-4 bg-gray-700 rounded w-5/6 animate-pulse"/>
            </div>
          </div>
        </div>
      ) : state.response && (
        <div className="mt-4 w-full max-w-4xl mx-auto">
          <h2 className="text-3xl text-blue-200 justify-center font-semibold font-mono mb-8">{state.submittedMessage}</h2>
          <div className="text-center mb-8">
            <h2 className="text-2xl text-gray-200 font-semibold flex items-center justify-left font-mono gap-2">
            🔗 sources
            </h2>
          </div>

          <div className="flex overflow-x-auto gap-4 mb-12 pb-4">
            {state.linkPreviews.map((preview, index) => (
              <a 
                key={index} 
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer" 
                className="bg-[#25262b] rounded-xl p-4 hover:bg-[#2c2d32] transition-all hover:shadow-lg hover:-translate-y-1 min-w-[300px] max-w-[300px]"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-300/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-base">🔗</span>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-200 text-base line-clamp-2 mb-1">
                        {preview.loading ? (
                          <div className="h-4 bg-gray-700 animate-pulse rounded w-2/3" />
                        ) : (
                          preview.title || preview.url
                        )}
                      </h3>
                      
                      <div className="flex items-center text-xs text-gray-400">
                        <span className="line-clamp-1">
                          {new URL(preview.url).hostname.replace('www.', '')}
                        </span>
                        <span className="mx-2">·</span>
                        <span>{index + 1}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl text-gray-200 font-semibold flex items-center justify-left font-mono gap-2">
            📓 answer
            </h2>
          </div>
          <div className="bg-[#25262b] rounded-xl p-8 shadow-lg">
            <p className="text-gray-300 text-lg leading-relaxed">{state.response.my_response.summary}</p>
            <h3 className="text-xl text-gray-200 font-semibold mt-8 mb-4">explanation</h3>
            <div className="text-gray-300 text-lg leading-relaxed"><Markdown>{state.response.my_response.full_explanation}</Markdown></div>
          </div>

          <div className="mt-8 pt-3">
            <h2 className="text-2xl text-gray-200 font-semibold font-mono mb-4">ask again? 🤨</h2>
            <form onSubmit={handleSubmit} className="relative mb-8">
              <input
                type="text"
                value={state.message}
                onChange={(submission) => setState(prev => ({ ...prev, message: submission.target.value }))}
                className="w-full bg-[#25262b] text-gray-200 rounded-xl p-4 pl-5 pr-32 border border-gray-700 focus:border-gray-500 focus:outline-none text-lg font-mono"
                placeholder="ask another question..."
              />
              <button
                type="submit"
                disabled={state.loading || !state.message.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 mr-2 py-2 bg-blue-300 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {state.loading ? '⭐️' : 'go'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
} 