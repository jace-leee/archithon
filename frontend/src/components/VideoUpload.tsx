import { useState, useRef, useCallback } from 'react';

interface VideoUploadProps {
  onUpload: (file: File) => void;
  step: 1 | 2;
  isLoading?: boolean;
}

export default function VideoUpload({ onUpload, step, isLoading = false }: VideoUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = step === 1 ? '공간 스캔 영상' : '가구 스캔 영상';
  const hint = step === 1
    ? '방 전체를 천천히 촬영한 영상을 업로드하세요'
    : '가구를 360도 촬영한 영상을 업로드하세요';

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'video/mp4' || file.type === 'video/quicktime')) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <h3 className="text-lg font-semibold text-white mb-2">{label}</h3>
      <p className="text-sm text-gray-400 mb-4">{hint}</p>

      <div
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer
          ${dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'}
        `}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="hidden"
          onChange={handleFileChange}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.898L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">{selectedFile.name}</p>
              <p className="text-gray-400 text-sm">{formatSize(selectedFile.size)}</p>
            </div>
            <p className="text-gray-500 text-xs">클릭하여 다른 파일 선택</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">드래그 앤 드롭 또는 클릭</p>
              <p className="text-gray-400 text-sm">MP4, MOV 형식 지원</p>
            </div>
          </div>
        )}
      </div>

      <button
        className={`mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
          ${selectedFile && !isLoading
            ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
        disabled={!selectedFile || isLoading}
        onClick={() => selectedFile && onUpload(selectedFile)}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            업로드 중...
          </span>
        ) : '업로드 시작'}
      </button>
    </div>
  );
}
