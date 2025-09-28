// src/contexts/ContextTKB_GVCN.js
import React, { createContext, useContext, useState } from "react";

const TKBGVCNContext = createContext(null);

export const useTKB_GVCN = () => useContext(TKBGVCNContext);

export const TKBGVCNProvider = ({ children }) => {
  // context lưu schedule của tất cả lớp: { [lopName]: { SÁNG: {...}, CHIỀU: {...} } }
  const [contextSchedule, setContextSchedule] = useState({});

  // Hàm lấy schedule của 1 lớp
  const getSchedule = (lopName) => {
    return contextSchedule[lopName] ?? { SÁNG: {}, CHIỀU: {} };
  };

  // Hàm cập nhật schedule của 1 lớp
  const setScheduleForLop = (lopName, schedule) => {
    setContextSchedule((prev) => ({
      ...prev,
      [lopName]: {
        SÁNG: { ...(schedule.SÁNG || {}) },
        CHIỀU: { ...(schedule.CHIỀU || {}) },
      },
    }));
  };

  // Hàm cập nhật nhiều lớp cùng lúc
  const setMultipleSchedules = (newSchedules) => {
    setContextSchedule((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(newSchedules).map(([lopName, sched]) => [
          lopName,
          {
            SÁNG: { ...(sched.SÁNG || {}) },
            CHIỀU: { ...(sched.CHIỀU || {}) },
          },
        ])
      ),
    }));
  };

  return (
    <TKBGVCNContext.Provider
      value={{
        contextSchedule,
        getSchedule,
        setScheduleForLop,
        setMultipleSchedules,
      }}
    >
      {children}
    </TKBGVCNContext.Provider>
  );
};
