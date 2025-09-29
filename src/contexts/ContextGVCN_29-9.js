import { createContext, useContext, useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // Đường dẫn tới cấu hình Firebase

export const ContextGVCN = createContext();

export const useGVCN = () => useContext(ContextGVCN);

export const GVCNProvider = ({ children }) => {
  // Lưu danh sách GVCN: { hoTen, lop }
  const [contextRows, setContextRows] = useState(() => {
    const saved = localStorage.getItem("gvcn_contextRows");
    return saved ? JSON.parse(saved) : [];
  });

  // Lưu toàn bộ TKB: { [lop]: { schedule, ngayApDung } }
  const [allSchedules, setAllSchedules] = useState(() => {
    const saved = localStorage.getItem("gvcn_allSchedules");
    return saved ? JSON.parse(saved) : {};
  });

  // Cache thời khóa biểu từng lớp để tăng tốc hiển thị
  const [contextSchedule, setContextSchedule] = useState(() => {
    const saved = localStorage.getItem("gvcn_contextSchedule");
    return saved ? JSON.parse(saved) : {};
  });

  // Cache danh sách môn học từng lớp
  const [contextMonHoc, setContextMonHoc] = useState(() => {
    const saved = localStorage.getItem("gvcn_contextMonHoc");
    return saved ? JSON.parse(saved) : {};
  });

  // 📝 Tự động lưu vào localStorage khi dữ liệu thay đổi
  useEffect(() => {
    localStorage.setItem("gvcn_contextRows", JSON.stringify(contextRows));
  }, [contextRows]);

  useEffect(() => {
    localStorage.setItem("gvcn_allSchedules", JSON.stringify(allSchedules));
  }, [allSchedules]);

  useEffect(() => {
    localStorage.setItem("gvcn_contextSchedule", JSON.stringify(contextSchedule));
  }, [contextSchedule]);

  useEffect(() => {
    localStorage.setItem("gvcn_contextMonHoc", JSON.stringify(contextMonHoc));
  }, [contextMonHoc]);

  // 🚀 Tải dữ liệu TKB từ Firestore nếu chưa có trong context
  useEffect(() => {
    const preloadTKB = async () => {
      if (Object.keys(contextSchedule).length === 0) {
        try {
          const snapshot = await getDocs(collection(db, "TKB_LOP_2025-2026"));
          const newSchedule = {};

          snapshot.forEach(doc => {
            const data = doc.data();
            const lop = doc.id;
            newSchedule[lop] = data.schedule || { SÁNG: {}, CHIỀU: {} };
          });

          setContextSchedule(newSchedule);
          //console.log("✅ TKB đã được tải vào contextSchedule");
        } catch (err) {
          console.error("❌ Lỗi khi tải TKB từ Firestore:", err);
        }
      }
    };

    preloadTKB();
  }, []);

  return (
    <ContextGVCN.Provider
      value={{
        contextRows,
        setContextRows,
        allSchedules,
        setAllSchedules,
        contextSchedule,
        setContextSchedule,
        contextMonHoc,         // ✅ thêm vào context
        setContextMonHoc       // ✅ thêm vào context
      }}
    >
      {children}
    </ContextGVCN.Provider>
  );
};