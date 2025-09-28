import React from "react";

export default function XungDotTKB({ conflicts }) {
  if (!conflicts || conflicts.length === 0) return <p>Không có xung đột</p>;

  return (
    <div style={{ border: "1px solid #f39c12", padding: "16px", borderRadius: "8px", backgroundColor: "#fff3e0" }}>
      <h3>Phát hiện xung đột:</h3>
      {conflicts.map((c, index) => (
        <div key={index} style={{ marginBottom: "12px" }}>
          <p>{c}</p>
        </div>
      ))}
    </div>
  );
}
