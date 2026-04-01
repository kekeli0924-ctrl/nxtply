import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

const CONFIDENCE_COLORS = {
  high: 'text-green-600 bg-green-50',
  medium: 'text-amber-600 bg-amber-50',
  low: 'text-red-500 bg-red-50',
};

export function VideoUpload({ onAnalysisComplete }) {
  const [capabilities, setCapabilities] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [status, setStatus] = useState(null); // 'uploading' | 'extracting' | 'analyzing' | 'complete' | 'error'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // Check capabilities on mount
  useEffect(() => {
    fetch('/api/video/capabilities')
      .then(r => r.ok ? r.json() : null)
      .then(setCapabilities)
      .catch(() => {});
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!droppedFile) return;

    const ext = droppedFile.name.split('.').pop().toLowerCase();
    if (!['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) {
      setError('Unsupported file type. Use MP4, MOV, AVI, or WebM.');
      return;
    }
    if (droppedFile.size > 500 * 1024 * 1024) {
      setError('File too large (max 500MB).');
      return;
    }

    setFile(droppedFile);
    setError(null);
  }, []);

  const handleUploadAndAnalyze = async () => {
    if (!file) return;

    setUploading(true);
    setStatus('uploading');
    setError(null);

    try {
      // Upload
      const formData = new FormData();
      formData.append('video', file);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };

      const uploadResult = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error)); }
            catch { reject(new Error('Upload failed')); }
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('POST', '/api/video/upload');
        xhr.send(formData);
      });

      setVideoId(uploadResult.videoId);
      setUploadProgress(100);

      // Trigger analysis
      const analyzeRes = await fetch(`/api/video/${uploadResult.videoId}/analyze`, { method: 'POST' });
      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        setStatus('error');
        setError(analyzeData.error);
        setUploading(false);
        return;
      }

      setStatus('extracting');

      // Poll for status
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/video/${uploadResult.videoId}/status`);
          const statusData = await statusRes.json();

          setStatus(statusData.status);

          if (statusData.status === 'complete') {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            setResult(statusData.result);
            setUploading(false);
          } else if (statusData.status === 'error') {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            setError(statusData.error || 'Analysis failed');
            setUploading(false);
          }
        } catch {
          // Keep polling
        }
      }, 2000);
    } catch (err) {
      setError(err.message);
      setStatus('error');
      setUploading(false);
    }
  };

  const handleUseResults = () => {
    if (result && onAnalysisComplete) {
      onAnalysisComplete(result);
    }
  };

  const reset = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setFile(null);
    setVideoId(null);
    setStatus(null);
    setResult(null);
    setError(null);
    setUploadProgress(0);
    setUploading(false);
  };

  const formatSize = (bytes) => {
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  // Not configured state
  if (capabilities && !capabilities.aiConfigured) {
    return (
      <Card>
        <div className="text-center py-6">
          <div className="text-3xl mb-3">🎥</div>
          <p className="text-sm font-medium text-gray-700">AI Video Analysis</p>
          <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">
            To auto-analyze training videos, add your Gemini API key to the <code className="bg-gray-100 px-1 rounded">.env</code> file:
          </p>
          <code className="block text-xs bg-gray-50 rounded-lg p-3 mt-3 text-gray-600">
            GEMINI_API_KEY=your-key-here
          </code>
          <p className="text-xs text-gray-400 mt-3">
            Get a free key at <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">ai.google.dev</a>
          </p>
        </div>
      </Card>
    );
  }

  // Analysis complete — show results
  if (result) {
    return (
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="text-sm font-semibold text-gray-900">Analysis Complete</span>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CONFIDENCE_COLORS[result.overallConfidence] || CONFIDENCE_COLORS.medium}`}>
              {result.overallConfidence} confidence
            </span>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {result.shooting && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-400">Shots</p>
                <p className="text-sm font-semibold">{result.shooting.goals}/{result.shooting.shotsTaken}</p>
                <span className={`text-[9px] px-1 rounded ${CONFIDENCE_COLORS[result.shooting.confidence] || ''}`}>
                  {result.shooting.confidence}
                </span>
              </div>
            )}
            {result.passing && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-400">Passes</p>
                <p className="text-sm font-semibold">{result.passing.completed}/{result.passing.attempts}</p>
                <span className={`text-[9px] px-1 rounded ${CONFIDENCE_COLORS[result.passing.confidence] || ''}`}>
                  {result.passing.confidence}
                </span>
              </div>
            )}
            {result.fitness && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-400">RPE</p>
                <p className="text-sm font-semibold">{result.fitness.rpe}/10</p>
                <span className={`text-[9px] px-1 rounded ${CONFIDENCE_COLORS[result.fitness.confidence] || ''}`}>
                  {result.fitness.confidence}
                </span>
              </div>
            )}
          </div>

          {result.drills?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Detected Drills</p>
              <div className="flex flex-wrap gap-1">
                {result.drills.map(d => (
                  <span key={d} className="bg-accent/10 text-accent text-[10px] px-2 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
            </div>
          )}

          {result.notes && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{result.notes}</p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleUseResults} className="flex-1">Use These Stats</Button>
            <Button variant="secondary" onClick={reset}>Start Over</Button>
          </div>
        </div>
      </Card>
    );
  }

  // Upload/analyzing state
  return (
    <Card>
      <div className="space-y-4">
        {!file ? (
          // Drop zone
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-accent/50 transition-colors"
          >
            <div className="text-3xl mb-2">🎥</div>
            <p className="text-sm font-medium text-gray-700">Drop your training video here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse • MP4, MOV, AVI, WebM • Max 500MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm,.mkv"
              onChange={handleFileDrop}
              className="hidden"
            />
          </div>
        ) : (
          // File selected / uploading / analyzing
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🎬</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>
              {!uploading && (
                <button onClick={reset} className="text-gray-300 hover:text-gray-500 text-lg">&times;</button>
              )}
            </div>

            {/* Progress / Status */}
            {status && status !== 'error' && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">
                    {status === 'uploading' && 'Uploading...'}
                    {status === 'uploaded' && 'Upload complete'}
                    {status === 'extracting' && 'Extracting frames...'}
                    {status === 'analyzing' && 'AI analyzing footage...'}
                  </span>
                  {status === 'uploading' && <span className="font-medium">{uploadProgress}%</span>}
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{
                      width: status === 'uploading' ? `${uploadProgress}%`
                        : status === 'extracting' ? '50%'
                        : status === 'analyzing' ? '75%'
                        : '100%'
                    }}
                  />
                </div>
                {(status === 'extracting' || status === 'analyzing') && (
                  <p className="text-[10px] text-gray-400 mt-1 text-center">This may take 30-60 seconds</p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 text-red-600 text-xs rounded-lg p-3 mb-3">
                {error}
              </div>
            )}

            {/* Action buttons */}
            {!uploading && !status && (
              <Button onClick={handleUploadAndAnalyze} className="w-full">
                Upload & Analyze
              </Button>
            )}
            {error && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={reset} className="flex-1">Try Again</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
