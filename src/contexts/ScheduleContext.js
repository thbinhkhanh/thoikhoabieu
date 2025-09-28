import React, { createContext, useState, useEffect, useContext } from 'react';

// Tạo context
export const ScheduleContext = createContext();

// Provider
export const ScheduleProvider = ({ children }) => {
  const [tkbAllTeachers, setTkbAllTeachers] = useState(() => {
    const saved = localStorage.getItem('tkbAllTeachers');
    return saved ? JSON.parse(saved) : {};
  });

  const [currentDocId, setCurrentDocId] = useState(() => {
    return localStorage.getItem('currentDocId') || null;
  });

  useEffect(() => {
    localStorage.setItem('tkbAllTeachers', JSON.stringify(tkbAllTeachers));
  }, [tkbAllTeachers]);

  useEffect(() => {
    if (currentDocId) {
      localStorage.setItem('currentDocId', currentDocId);
    }
  }, [currentDocId]);

  const [selectedDay, setSelectedDay] = useState('Thứ 2');
  const [totalPeriodsPerTeacher, setTotalPeriodsPerTeacher] = useState({});

  // 🔹 Hàm reset context
  const resetSchedule = () => {
    setTkbAllTeachers({});
    setCurrentDocId(null);
    setSelectedDay('Thứ 2');
    setTotalPeriodsPerTeacher({});
    localStorage.removeItem('tkbAllTeachers');
    localStorage.removeItem('currentDocId');
  };

  const [isFileOpen, setIsFileOpen] = useState(false);

  return (
    <ScheduleContext.Provider value={{
      tkbAllTeachers, setTkbAllTeachers,
      currentDocId, setCurrentDocId,
      selectedDay, setSelectedDay,
      totalPeriodsPerTeacher, setTotalPeriodsPerTeacher, 
      isFileOpen, setIsFileOpen,
      resetSchedule  // 🔹 thêm vào context
    }}>
      {children}
    </ScheduleContext.Provider>
  );
};

// ✅ Custom hook
export const useSchedule = () => useContext(ScheduleContext);
