import React, { createContext, useContext, useState, useMemo } from "react";

const SaveContext = createContext({});

export const SaveProvider = ({ children }) => {
  const [saveMap, setSaveMap] = useState({});

  const registerSave = (key, fn) => {
    setSaveMap(prev => ({ ...prev, [key]: fn }));
  };

  const unregisterSave = (key) => {
    setSaveMap(prev => {
      const newMap = { ...prev };
      delete newMap[key];
      return newMap;
    });
  };

  const triggerSave = async (key) => {
    if (saveMap[key]) {
      try {
        await saveMap[key]();
      } catch (err) {
        console.error("❌ Lỗi khi gọi hàm lưu:", err);
      }
    } else {
      console.warn("Chưa đăng ký hàm lưu cho key:", key);
    }
  };

  // Memoize value để giữ tham chiếu ổn định
  const value = useMemo(() => ({
    registerSave,
    unregisterSave,
    triggerSave
  }), [saveMap]);

  return (
    <SaveContext.Provider value={value}>
      {children}
    </SaveContext.Provider>
  );
};

// Hook tiện lợi
export const useSave = () => {
  const context = useContext(SaveContext);
  // Trả về giá trị mặc định tránh undefined
  return context || {
    registerSave: () => {},
    unregisterSave: () => {},
    triggerSave: async () => {}
  };
};
