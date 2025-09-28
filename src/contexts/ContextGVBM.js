import { createContext, useContext, useState, useEffect } from "react";

// 1. Đặt tên rõ ràng hơn cho context
const GVBMContext = createContext();

// 2. Custom hook để dùng context
export const useGVBM = () => {
  const context = useContext(GVBMContext);
  if (!context) {
    throw new Error("useGVBM must be used within a GVBMProvider");
  }
  return context;
};

// 3. Provider component
export const GVBMProvider = ({ children }) => {
  const [contextRows, setContextRows] = useState(() => {
    const saved = localStorage.getItem("contextRows");
    return saved ? JSON.parse(saved) : [];
  });

  const [allSchedules, setAllSchedules] = useState(() => {
    const saved = localStorage.getItem("allSchedules");
    return saved ? JSON.parse(saved) : {};
  });

  // Tự động lưu vào localStorage khi dữ liệu thay đổi
  useEffect(() => {
    localStorage.setItem("contextRows", JSON.stringify(contextRows));
  }, [contextRows]);

  useEffect(() => {
    localStorage.setItem("allSchedules", JSON.stringify(allSchedules));
  }, [allSchedules]);

  const value = {
    contextRows,
    setContextRows,
    allSchedules,
    setAllSchedules,
  };

  return (
    <GVBMContext.Provider value={value}>
      {children}
    </GVBMContext.Provider>
  );
};