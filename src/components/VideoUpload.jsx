import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { processVideoForAnalysis, checkVideoProcessingSupport, terminateFFmpeg, formatFileSize } from '../utils/ffmpeg';

const CONFIDENCE_COLORS = {
  high: 'text-green-600 bg-green-50',
  medium: 'text-amber-600 bg-amber-50',
  low: 'text-red-500 bg-red-50',
};

const STAGE_ICONS = { done: '\u2705', active: '\u23f3', pending: '\u2b1c' };
const SKIP_THRESHOLD = 20 * 1024 * 1024; // 20MB — skip compression for small files

export function VideoUpload({ onAnalysisComplete, onQuickSave }) {
  const [capabilities, setCapabilities] = useState(null);
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState(null);
  const [processedResult, setProcessedResult] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cancelled, setCancelled] = useState(false);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);
  const abortRef = useRef(false);

  useEffect(() => {
    fetch('/api/video/capabilities')
      .then(r => r.ok ? r.json() : null)
      .then(setCapabilities)
      .catch(() => {});
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      terminateFFmpeg();
    };
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

  const handleCancel = () => {
    abortRef.current = true;
    setCancelled(true);
    terminateFFmpeg();
    if (pollingRef.current) clearInterval(pollingRef.current);
    reset();
  };

  // ── Raw upload (files <20MB or fallback) ──────
  const uploadRaw = async () => {
    setProcessing(true);
    setStatus('uploading');
    setError(null);
    setPipelineProgress({ stage: 'uploading', stageNumber: 4, totalStages: 4, message: 'Uploading video...', percentage: 0 });

    try {
      const formData = new FormData();
      formData.append('video', file);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setPipelineProgress(prev => ({ ...prev, percentage: pct, detail: `${formatFileSize(e.loaded)} / ${formatFileSize(e.total)}` }));
        }
      };

      const uploadResult = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else { try { reject(new Error(JSON.parse(xhr.responseText).error)); } catch { reject(new Error('Upload failed')); } }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('POST', '/api/video/upload');
        xhr.send(formData);
      });

      setVideoId(uploadResult.videoId);
      triggerAnalysis(uploadResult.videoId);
    } catch (err) {
      setError(err.message);
      setStatus('error');
      setProcessing(false);
    }
  };

  // ── Processed upload (compressed + frames) ──────
  const uploadProcessed = async (processed) => {
    const { compressedVideo, frames } = processed;

    setPipelineProgress({ stage: 'uploading', stageNumber: 4, totalStages: 4, message: 'Uploading frames...', percentage: 0 });

    try {
      // 1. Upload frames
      const frameFormData = new FormData();
      frames.forEach((frame, i) => {
        frameFormData.append('frames', frame.blob, `frame_${String(i + 1).padStart(4, '0')}.jpg`);
      });
      frameFormData.append('frameCount', String(frames.length));
      frameFormData.append('originalSize', String(processed.originalSize));
      frameFormData.append('compressedSize', String(processed.compressedSize));

      const framesRes = await fetch('/api/video/upload-frames', { method: 'POST', body: frameFormData });
      if (!framesRes.ok) throw new Error('Frame upload failed');
      const { videoId: vid } = await framesRes.json();
      setVideoId(vid);

      // 2. Upload compressed video in chunks
      const CHUNK_SIZE = 2 * 1024 * 1024;
      const totalChunks = Math.ceil(compressedVideo.size / CHUNK_SIZE);
      let uploaded = 0;

      for (let i = 0; i < totalChunks; i++) {
        if (abortRef.current) return;
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, compressedVideo.size);
        const chunk = compressedVideo.slice(start, end);

        const chunkForm = new FormData();
        chunkForm.append('chunk', chunk);
        chunkForm.append('chunkIndex', String(i));
        chunkForm.append('totalChunks', String(totalChunks));

        const res = await fetch(`/api/video/upload-chunk/${vid}`, { method: 'POST', body: chunkForm });
        if (!res.ok) throw new Error(`Chunk ${i + 1} failed`);

        uploaded += (end - start);
        const pct = Math.round((uploaded / compressedVideo.size) * 100);
        setPipelineProgress(prev => ({
          ...prev, message: `Uploading video... ${pct}%`, percentage: pct,
          detail: `${formatFileSize(uploaded)} / ${formatFileSize(compressedVideo.size)}`,
        }));
      }

      // 3. Signal complete
      const completeRes = await fetch(`/api/video/upload-complete/${vid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalChunks, frameCount: frames.length, preprocessed: true }),
      });
      if (!completeRes.ok) throw new Error('Upload finalization failed');

      triggerAnalysis(vid);
    } catch (err) {
      setError(err.message);
      setStatus('error');
      setProcessing(false);
    }
  };

  // ── Trigger Gemini analysis + poll ──────
  const triggerAnalysis = async (vid) => {
    setPipelineProgress(null);
    setStatus('analyzing');

    const analyzeRes = await fetch(`/api/video/${vid}/analyze`, { method: 'POST' });
    if (!analyzeRes.ok) {
      const data = await analyzeRes.json();
      setError(data.error || 'Analysis failed');
      setStatus('error');
      setProcessing(false);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/${vid}/status`);
        const data = await res.json();
        setStatus(data.status);
        if (data.status === 'complete') {
          clearInterval(pollingRef.current);
          setResult(data.result);
          setProcessing(false);
        } else if (data.status === 'error') {
          clearInterval(pollingRef.current);
          setError(data.error || 'Analysis failed');
          setProcessing(false);
        }
      } catch { /* keep polling */ }
    }, 2000);
  };

  // ── Main handler ──────
  const handleStart = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    abortRef.current = false;
    setCancelled(false);

    // Small files: skip compression
    if (file.size < SKIP_THRESHOLD) {
      return uploadRaw();
    }

    // Check browser support
    const support = checkVideoProcessingSupport();
    if (!support.supported) {
      // Fallback: upload raw
      return uploadRaw();
    }

    // Run client-side pipeline
    try {
      const processed = await processVideoForAnalysis(file, setPipelineProgress);
      if (abortRef.current) return;
      setProcessedResult(processed);
      await uploadProcessed(processed);
    } catch (err) {
      if (abortRef.current) return;
      console.warn('Client-side processing failed, falling back to raw upload:', err);
      setError(null);
      setPipelineProgress(null);
      await uploadRaw();
    } finally {
      terminateFFmpeg();
    }
  };

  const handleUseResults = () => {
    if (result && onAnalysisComplete) onAnalysisComplete(result);
  };

  const reset = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setFile(null); setVideoId(null); setStatus(null); setResult(null);
    setError(null); setProcessing(false); setPipelineProgress(null);
    setProcessedResult(null); setCancelled(false);
  };

  // ── Not configured ──────
  if (capabilities && !capabilities.aiConfigured) {
    return (
      <Card>
        <div className="text-center py-6">
          <div className="text-3xl mb-3">🎥</div>
          <p className="text-sm font-medium text-gray-700">AI Video Analysis</p>
          <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">
            Add your Gemini API key to <code className="bg-gray-100 px-1 rounded">.env</code>
          </p>
          <code className="block text-xs bg-gray-50 rounded-lg p-3 mt-3 text-gray-600">GEMINI_API_KEY=your-key-here</code>
        </div>
      </Card>
    );
  }

  // ── Results — Confirm Card ──────
  if (result) {
    const shotPct = result.shooting?.shotsTaken > 0
      ? Math.round((result.shooting.goals / result.shooting.shotsTaken) * 100) : null;
    const passPct = result.passing?.attempts > 0
      ? Math.round((result.passing.completed / result.passing.attempts) * 100) : null;

    return (
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{STAGE_ICONS.done}</span>
              <span className="text-sm font-semibold text-gray-900">Session Analyzed</span>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CONFIDENCE_COLORS[result.overallConfidence] || CONFIDENCE_COLORS.medium}`}>
              {result.overallConfidence}
            </span>
          </div>

          {/* Quick stats summary */}
          <div className="flex items-center gap-4 text-sm">
            {result.duration && <span className="text-gray-600">⏱ {result.duration} min</span>}
            {shotPct != null && <span className="text-accent font-semibold">🎯 {shotPct}% shots</span>}
            {passPct != null && <span className="text-accent font-semibold">📊 {passPct}% passes</span>}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            {result.drills?.length > 0 && <span>{result.drills.length} drills detected</span>}
            {result.fitness?.rpe && <span>RPE {result.fitness.rpe}/10</span>}
          </div>

          {result.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{result.notes}</p>}

          {/* Primary: Save directly */}
          <Button onClick={() => {
            if (onQuickSave) {
              onQuickSave(result);
            } else {
              handleUseResults();
            }
          }} className="w-full py-3">
            Save Session ✓
          </Button>

          {/* Secondary: Edit details (full form) */}
          <button onClick={handleUseResults} className="w-full text-center text-xs text-gray-400 hover:text-accent">
            Edit details →
          </button>

          <button onClick={reset} className="w-full text-center text-[10px] text-gray-300 hover:text-gray-500">
            Start over
          </button>
        </div>
      </Card>
    );
  }

  // ── Main UI ──────
  return (
    <Card>
      <div className="space-y-4">
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-accent/50 transition-colors"
          >
            <div className="text-3xl mb-2">🎥</div>
            <p className="text-sm font-medium text-gray-700">Drop your training video here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse &bull; MP4, MOV, AVI, WebM &bull; Max 500MB</p>
            <input ref={fileInputRef} type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm,.mkv"
              onChange={handleFileDrop} className="hidden" />
          </div>
        ) : (
          <div>
            {/* File info */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🎬</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              {!processing && <button onClick={reset} className="text-gray-300 hover:text-gray-500 text-lg">&times;</button>}
            </div>

            {/* Pipeline progress */}
            {processing && pipelineProgress && (
              <div className="space-y-3 mb-4">
                {/* Stage checklist */}
                <div className="space-y-1.5">
                  {[
                    { num: 1, label: 'Video processor loaded', stage: 'loading' },
                    { num: 2, label: 'Compressing video', stage: 'compressing' },
                    { num: 3, label: 'Extracting key frames', stage: 'extracting' },
                    { num: 4, label: 'Uploading to server', stage: 'uploading' },
                  ].map(s => {
                    const current = pipelineProgress.stageNumber;
                    const isDone = s.num < current || (s.num === current && pipelineProgress.percentage >= 100);
                    const isActive = s.num === current && pipelineProgress.percentage < 100;
                    const icon = isDone ? STAGE_ICONS.done : isActive ? STAGE_ICONS.active : STAGE_ICONS.pending;
                    return (
                      <div key={s.num} className={`flex items-center gap-2 text-xs ${isDone ? 'text-gray-400' : isActive ? 'text-gray-700' : 'text-gray-300'}`}>
                        <span>{icon}</span>
                        <span>{s.label}</span>
                        {isActive && pipelineProgress.percentage > 0 && (
                          <span className="ml-auto font-medium text-accent">{pipelineProgress.percentage}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Overall progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(((pipelineProgress.stageNumber - 1) * 25) + (pipelineProgress.percentage * 0.25))}%` }}
                  />
                </div>

                {/* Detail text */}
                {pipelineProgress.detail && (
                  <p className="text-[10px] text-gray-400 text-center">{pipelineProgress.detail}</p>
                )}

                {/* Size reduction */}
                {processedResult && (
                  <p className="text-xs text-center text-accent font-medium">
                    {formatFileSize(processedResult.originalSize)} → {formatFileSize(processedResult.compressedSize)} ({processedResult.compressionRatio}x smaller)
                  </p>
                )}

                <button onClick={handleCancel} className="w-full text-xs text-gray-400 hover:text-red-500 py-1">
                  Cancel
                </button>
              </div>
            )}

            {/* Analyzing status (post-upload) */}
            {processing && !pipelineProgress && status === 'analyzing' && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">AI analyzing footage...</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full w-3/4 animate-pulse" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-center">This may take 30-60 seconds</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 text-red-600 text-xs rounded-lg p-3 mb-3">{error}</div>
            )}

            {/* Action buttons */}
            {!processing && !status && (
              <Button onClick={handleStart} className="w-full">
                {file.size >= SKIP_THRESHOLD ? 'Compress & Analyze' : 'Upload & Analyze'}
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
