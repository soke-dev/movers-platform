import { useEffect, useRef, useState } from 'react';

/**
 * Reads QR codes with the camera and calls onCode with the text. Uses the browser's own
 * detector where there is one (Chrome, Android) and jsQR elsewhere (Safari, iPad).
 */
export function Scanner({ onCode, paused = false }) {
  const video = useRef(null);
  const [err, setErr] = useState('');
  const latest = useRef({ onCode, paused });
  latest.current = { onCode, paused };

  useEffect(() => {
    let stream;
    let timer;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (e) {
        setErr(e?.name === 'NotAllowedError' ? 'Camera access is blocked. Allow the camera for this site in the browser settings, or type the code instead.' : 'No camera found. Type the code instead, or use a handheld scanner.');
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      let detector = null;
      if ('BarcodeDetector' in window) {
        try {
          if ((await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch { /* fall back to jsQR */ }
      }
      const jsQR = detector ? null : (await import('jsqr')).default;
      const scan = async () => {
        if (stopped) return;
        if (!latest.current.paused && v.readyState >= 2) {
          let text = null;
          if (detector) {
            text = (await detector.detect(v).catch(() => []))[0]?.rawValue || null;
          } else {
            const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
          }
          if (text) latest.current.onCode(text);
        }
        timer = setTimeout(scan, 250);
      };
      scan();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (err) return <p className="err">{err}</p>;
  return <video ref={video} className="scanner" playsInline muted aria-label="Camera view for scanning check-in codes" />;
}

/** For typing a code, or for a handheld scanner, which types the code and presses Enter. */
export function CodeInput({ onCode, autoFocus }) {
  const [v, setV] = useState('');
  return (
    <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (v.trim()) onCode(v.trim()); setV(''); }}>
      <label className="search" style={{ flex: 1, maxWidth: 'none' }}><input value={v} onChange={(e) => setV(e.target.value)} placeholder="Or type their code, e.g. ADA-7K2Q" aria-label="Check-in code" autoFocus={autoFocus} autoComplete="off" /></label>
      <button className="btn ink">Go</button>
    </form>
  );
}
