interface ProcessingStatusProps {
  progress: number; // 0-100
  status: string;
  track?: 'A' | 'B' | null;
  error?: string | null;
}

export default function ProcessingStatus({ progress, status, track, error }: ProcessingStatusProps) {
  if (error) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const displayProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-white font-medium">처리 중...</p>
              <p className="text-gray-400 text-sm">{status}</p>
            </div>
          </div>

          {track && (
            <div className={`px-3 py-1 rounded-full text-xs font-semibold
              ${track === 'A' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}
            `}>
              {track === 'A' ? 'Track A (COLMAP)' : 'Track B (AI 비전)'}
            </div>
          )}
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">진행률</span>
            <span className="text-blue-400 font-medium">{displayProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        </div>

        <p className="text-gray-500 text-xs mt-3">
          예상 소요 시간: {displayProgress < 30 ? '약 2분' : displayProgress < 70 ? '약 1분' : '곧 완료'}
        </p>
      </div>
    </div>
  );
}
