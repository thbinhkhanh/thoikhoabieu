// PrintTKBContext.js
import React, { createContext, useContext } from "react";
import { printTeachersTKB } from "../utils/printTKB_GVBM"; // hoặc đổi tùy loại
import { exportAllTeachersToExcel as exportGVBMExcel } from "../utils/exportAllToExcel_GVBM.js";
import { printTeachersTKB as printGVCN_TKB } from "../utils/printTKB_GVCN";
import { exportAllTeachersToExcel as exportGVCNExcel } from "../utils/exportAllToExcel_GVCN.js";

// Tạo context
const PrintTKBContext = createContext({
  printGVBM: () => {},
  exportGVBM: () => {},
  printGVCN: () => {},
  exportGVCN: () => {},
});

// Provider
export const PrintTKBProvider = ({
  children,
  gvbmData = {},  // { contextRows, allSchedules, currentDocId, tkbAllTeachers }
  gvcndata = {},   // { contextRows, allSchedules, currentDocId, tkbAllTeachers }
}) => {
  
  // --- In GVBM ---
  const handlePrintGVBM = () => {
    const { contextRows, allSchedules, currentDocId, tkbAllTeachers } = gvbmData;
    if (!contextRows || !currentDocId) return;

    const gvList = contextRows.map((gvData) => {
      const key = gvData.hoTen.toLowerCase().replace(/\s+/g, "_");
      const raw = tkbAllTeachers?.[currentDocId]?.[key];
      const tkbForPrint = {};
      const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
      ["SÁNG", "CHIỀU"].forEach((session) => {
        tkbForPrint[session] = {};
        days.forEach((day) => {
          tkbForPrint[session][day] = raw?.[day]?.[session.toLowerCase()]?.map(item => ({
            class: item?.class || item?.lop || item?.className || "",
            subject: item?.subject || "",
            tiet: item?.period || item?.tiet || "",
            gio: item?.gio || ""
          })) || [];
        });
      });
      return { name: gvData.hoTen, tenMon: (gvData.monDay || []).join(", "), tkbData: tkbForPrint };
    });

    printTeachersTKB(gvList);
  };

  // --- Xuất Excel GVBM ---
  const handleExportGVBM = () => {
    const { contextRows, allSchedules, currentDocId, tkbAllTeachers } = gvbmData;
    if (!contextRows || !currentDocId) return;

    const gvList = contextRows.map((gvData) => {
      const key = gvData.hoTen.toLowerCase().replace(/\s+/g, "_");
      const raw = tkbAllTeachers?.[currentDocId]?.[key];
      const tkbForExcel = {};
      const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
      ["SÁNG", "CHIỀU"].forEach(session => {
        tkbForExcel[session] = {};
        days.forEach(day => {
          tkbForExcel[session][day] = raw?.[day]?.[session.toLowerCase()]?.map(item => ({
            class: item?.class || item?.lop || item?.className || "",
            subject: item?.subject || "",
            tiet: item?.period || item?.tiet || "",
            gio: item?.gio || ""
          })) || [];
        });
      });

      return { name: gvData.hoTen, tenMon: (gvData.monDay || []).join(", "), tkbData: tkbForExcel };
    });

    exportGVBMExcel(gvList);
  };

  // --- In GVCN ---
  const handlePrintGVCN = () => {
    const { contextRows, allSchedules, currentDocId, tkbAllTeachers } = gvcndata;
    if (!contextRows || !currentDocId) return;

    const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
    const periodsBySession = { SÁNG: [1, 2, 3, 4, 5], CHIỀU: [1, 2, 3, 4] };

    const gvList = contextRows.map((gvData) => {
      const lopName = gvData.lop;
      const finalSchedule = allSchedules?.[lopName]?.schedule || { SÁNG: {}, CHIỀU: {} };
      const tkbForPrint = {};
      ["SÁNG", "CHIỀU"].forEach(session => {
        tkbForPrint[session] = {};
        days.forEach(day => {
          tkbForPrint[session][day] = (finalSchedule[session][day] || []).map(subj => ({ subject: subj || "" }));
        });
      });
      return { name: gvData.hoTen, tenLop: lopName, tkbData: tkbForPrint };
    });

    printGVCN_TKB(gvList);
  };

  // --- Xuất Excel GVCN ---
  const handleExportGVCN = () => {
    const { contextRows, allSchedules, currentDocId, tkbAllTeachers } = gvcndata;
    if (!contextRows || !currentDocId) return;

    const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
    const periodsBySession = { SÁNG: [1, 2, 3, 4, 5], CHIỀU: [1, 2, 3, 4] };

    const gvList = contextRows.map((gvData) => {
      const lopName = gvData.lop;
      const finalSchedule = allSchedules?.[lopName]?.schedule || { SÁNG: {}, CHIỀU: {} };
      const tkbForExcel = {};
      ["SÁNG", "CHIỀU"].forEach(session => {
        tkbForExcel[session] = {};
        days.forEach(day => {
          tkbForExcel[session][day] = (finalSchedule[session][day] || []).map(subj => ({ subject: subj || "" }));
        });
      });
      return { name: gvData.hoTen, tenLop: lopName, tkbData: tkbForExcel };
    });

    exportGVCNExcel(gvList);
  };

  return (
    <PrintTKBContext.Provider
      value={{
        printGVBM: handlePrintGVBM,
        exportGVBM: handleExportGVBM,
        printGVCN: handlePrintGVCN,
        exportGVCN: handleExportGVCN
      }}
    >
      {children}
    </PrintTKBContext.Provider>
  );
};

// Hook tiện lợi
export const usePrintTKB = () => useContext(PrintTKBContext);
