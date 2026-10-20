import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** A real, scannable QR code for check-in and payment codes. */
export function QR({ value, size = 132, label }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#120D24', light: '#FFFFFF' } })
      .then((url) => live && setSrc(url))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [value, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={label || `QR code for ${value}`} /> : <span className="qr" style={{ display: 'inline-block', width: size, height: size }} />;
}
