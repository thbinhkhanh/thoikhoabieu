import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import XungDotTKB from "../XungDotTKB";

export default function TrangXungDot() {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConflicts = async () => {
      setLoading(true);

      const querySnapshot = await getDocs(collection(db, "TKB_GVBM_2025-2026"));
      const scheduleMap = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const gv = data.hoTen;
        const schedule = data.schedule || {};

        for (const buoi in schedule) {
          if (!scheduleMap[buoi]) scheduleMap[buoi] = {};
          for (const ngay in schedule[buoi]) {
            if (!scheduleMap[buoi][ngay]) scheduleMap[buoi][ngay] = {};
            const tietData = schedule[buoi][ngay];
            for (const tiet in tietData) {
              const value = tietData[tiet];
              if (value && value.trim() !== "") {
                if (!scheduleMap[buoi][ngay][tiet]) scheduleMap[buoi][ngay][tiet] = [];
                scheduleMap[buoi][ngay][tiet].push({ gv, value });
              }
            }
          }
        }
      });

      const conflictsArr = [];

      // Kiểm tra xung đột (giống hàm kiemTraTKB)
      for (const buoi in scheduleMap) {
        for (const ngay in scheduleMap[buoi]) {
          for (const tiet in scheduleMap[buoi][ngay]) {
            const arr = scheduleMap[buoi][ngay][tiet];
            if (arr.length > 1) {
              conflictsArr.push(
                `⚠️ ${buoi} ${ngay} tiết ${parseInt(tiet)+1}: Lớp/GV xung đột`
              );
            }
          }
        }
      }

      setConflicts(conflictsArr);
      setLoading(false);
    };

    fetchConflicts();
  }, []);

  if (loading) return <p>Đang tải xung đột...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Trang tổng hợp xung đột</h2>
      <XungDotTKB conflicts={conflicts} />
    </div>
  );
}
