import React, { createContext, useContext, useState, useEffect } from "react";

const TKB_GVBMContext = createContext();

export const TKB_GVBMProvider = ({ children }) => {
  const [tkbRows, setTkbRows] = useState(() => {
    const saved = localStorage.getItem("tkbRows");
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedGV, setSelectedGV] = useState(() => {
    return localStorage.getItem("selectedGV") || "";
  });

  const [schedule, setSchedule] = useState(() => {
    const saved = localStorage.getItem("schedule");
    return saved ? JSON.parse(saved) : {};
  });

  const [lopOptions, setLopOptions] = useState(() => {
    const saved = localStorage.getItem("lopOptions");
    return saved ? JSON.parse(saved) : [];
  });

  // 📝 Tự động lưu vào localStorage khi dữ liệu thay đổi
  useEffect(() => {
    localStorage.setItem("tkbRows", JSON.stringify(tkbRows));
  }, [tkbRows]);

  useEffect(() => {
    localStorage.setItem("selectedGV", selectedGV);
  }, [selectedGV]);

  useEffect(() => {
    localStorage.setItem("schedule", JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    localStorage.setItem("lopOptions", JSON.stringify(lopOptions));
  }, [lopOptions]);

  return (
    <TKB_GVBMContext.Provider
      value={{
        tkbRows,
        setTkbRows,
        selectedGV,
        setSelectedGV,
        schedule,
        setSchedule,
        lopOptions,
        setLopOptions,
      }}
    >
      {children}
    </TKB_GVBMContext.Provider>
  );
};

export const useTKB_GVBM = () => useContext(TKB_GVBMContext);