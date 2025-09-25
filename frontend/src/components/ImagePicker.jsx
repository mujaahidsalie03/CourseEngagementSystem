import { useRef, useState } from "react";
import { uploadImage } from "../api/appApi";

export default function ImagePicker({ image, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const meta = await uploadImage(file); // { url, width, height, name, size, type }
      onChange(meta);
    } catch (e) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="uploader">
      {!image ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "Uploading..." : "Choose Image"}
          </button>
          {err && <div className="small" style={{ color:"#b91c1c", marginTop:6 }}>{err}</div>}
        </>
      ) : (
        <div className="uploader-preview">
          <img src={image.url} alt={image.name || "image"} className="uploader-img" />
          <div className="small muted">
            {image.name || "uploaded"} {image.size ? `• ${Math.round(image.size/1024)} KB` : ""} {image.width && image.height ? `• ${image.width}×${image.height}px` : ""}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? "Uploading..." : "Replace"}
            </button>
            <button type="button" className="btn" onClick={() => onChange(null)} disabled={busy}>
              Remove
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      )}
    </div>
  );
}
