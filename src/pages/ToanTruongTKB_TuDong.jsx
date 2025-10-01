
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Select,
  Typography,
  Paper,
  IconButton,
  LinearProgress,
  Checkbox, 
  FormControlLabel
} from '@mui/material';

//import { doc, setDoc, getDoc, getDocs, collection, addDoc, writeBatch } from "firebase/firestore";
import { doc, setDoc, getDocs, collection } from "firebase/firestore";
import { db } from "../firebase";

import { scheduleTinHoc, optimizeTinHocSchedule } from '../utils/scheduleTinHoc';
import { scheduleCongNghe } from '../utils/scheduleCongNghe';
import { useSchedule } from "../contexts/ScheduleContext";
import { useOpenFile } from "../contexts/OpenFileContext"; 
import { useGVCN } from "../contexts/ContextGVCN";

import { scheduleTiengAnh, optimizeFullTiengAnhSchedule, resolveMissingTiengAnh, finalFillMissingPeriods } from '../utils/scheduleTiengAnh';
import { scheduleTiengAnh_TG } from '../utils/scheduleTiengAnh_TG';
import { scheduleMiThuat, resolveMissingMiThuat, optimizeFullMiThuatSchedule, finalFillMissingPeriods_MiThuat } from '../utils/scheduleMiThuat';
import { scheduleAmNhac, resolveMissingAmNhac, finalFillMissingPeriods_AmNhac } from '../utils/scheduleAmNhac';
import { scheduleGDTC, resolveMissingGDTC, finalFillMissingPeriods_GDTC } from '../utils/scheduleGDTC';
import { scheduleGDTC2 } from '../utils/scheduleGDTC2';
import { scheduleDaoDuc } from '../utils/scheduleDaoDuc';
import { scheduleAmNhac_BGH } from '../utils/scheduleAmNhac_BGH';
import { scheduleDocSach  } from '../utils/scheduleDocSach';
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import {
  //initTKB,
  initAssignments,
  getAvailableSlotsCustom,
  getAvailableSlotsLight,
  //checkClassLimit,
  assignToSlot,
  generateSwapCandidates,
  isValidSwap,
  applySwap,
  //violatesConstraints,
  //shouldUseDoublePeriod,
  resolveConflicts
} from '../utils/autoScheduleUtils';

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

// CSS cho modal
const modalStyles = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.3);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .modal-content {
    background: white;
    padding: 20px;
    border-radius: 8px;
    min-width: 300px;
  }
  `;

  // Thêm style vào document
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = modalStyles;
  document.head.appendChild(styleSheet);

//export default function ToanTruongTKB_TuDong({ setOpenFileHandler, setTuDongSaveHandler }) {
export default function ToanTruongTKB_TuDong({ setOpenFileHandler, setTuDongSaveHandler, setTuDongSaveAsHandler }) {


  const [teachers, setTeachers] = useState([]);
  //const [tkb, setTkb] = useState({});
  const [assignments, setAssignments] = useState({});
  const [vietTatMon, setVietTatMon] = useState({});
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [autoScheduleProgress, setAutoScheduleProgress] = useState(0);
  const [selectedMon, setSelectedMon] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [phanCongGVs, setPhanCongGVs] = useState({});
  const [gvSummary, setGvSummary] = useState({});
  const [thinhGiangMap, setThinhGiangMap] = useState({});
  const [rows, setRows] = useState([]);
  const [scheduleErrors, setScheduleErrors] = useState({});
  const [visibleErrors, setVisibleErrors] = useState({});

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [saveMode, setSaveMode] = useState("save"); // "save" hoặc "saveAs"
  const [isNewTkb, setIsNewTkb] = useState(false);  
  const [showStats, setShowStats] = React.useState(true);
 
  const CELL_HEIGHT = 30;
  
  const [tkb, setTkb] = useState({});
  const [isEditing, setIsEditing] = useState(true);
  const [tkbState, setTkbState] = useState(tkb); // bản sao có thể chỉnh sửa
  const { tkbAllTeachers, setTkbAllTeachers, currentDocId, setCurrentDocId, isFileOpen, setIsFileOpen } = useSchedule();
  const { allSchedules, setAllSchedules, contextSchedule, setContextSchedule } = useGVCN();

  const { setOpenFileName } = useOpenFile(); // 🔹 lấy setter từ context
  const [conflicts, setConflicts] = useState([]);
  const [showConflicts, setShowConflicts] = useState(false);

  
  useEffect(() => {
    setTkbState(tkb);
  }, [tkb]);

  useEffect(() => {
    if (currentDocId && tkbAllTeachers?.[currentDocId]) {
      setTkb(tkbAllTeachers[currentDocId]);
    }
  }, [currentDocId, tkbAllTeachers]);

  const handleChangeTiet = (gvId, day, session, index, newClassObj) => {
    const tempState = structuredClone(tkbState);

    // Khởi tạo nếu chưa có
    if (!tempState[gvId]) tempState[gvId] = {};
    if (!tempState[gvId][day]) tempState[gvId][day] = {};
    if (!Array.isArray(tempState[gvId][day][session])) {
      const length = session === 'morning' ? 4 : 3;
      tempState[gvId][day][session] = Array.from({ length }, () => null);
    }

    // Cập nhật hoặc xóa tiết
    if (!newClassObj || !newClassObj.class || !newClassObj.subject) {
      tempState[gvId][day][session][index] = null;
    } else {
      tempState[gvId][day][session][index] = {
        class: newClassObj.class,
        subject: newClassObj.subject
      };
    }

    // Kiểm tra xung đột
    const errors = checkScheduleConflicts(tempState, gvSummary);

    if (errors.length > 0) {
      setScheduleErrors(prev => ({ ...prev, [gvId]: errors }));
      setVisibleErrors(prev => ({ ...prev, [gvId]: true }));

      setTimeout(() => {
        setVisibleErrors(prev => ({ ...prev, [gvId]: false }));
      }, 5000);

      return; // Không cập nhật state nếu có lỗi
    }

    // Không có xung đột → cập nhật tkbState và context
    setScheduleErrors(prev => ({ ...prev, [gvId]: [] }));
    setVisibleErrors(prev => ({ ...prev, [gvId]: false }));
    setTkbState(tempState);

    // ✅ Cập nhật luôn context
    {/*setTkbAllTeachers(prev => ({
      ...prev,
      [currentDocId]: tempState  // hoặc dùng docId tương ứng nếu muốn
    }));*/}
    setTkbAllTeachers(prev => {
      const updated = structuredClone(prev);

      if (!updated[currentDocId]) updated[currentDocId] = {};
      if (!updated[currentDocId][gvId]) updated[currentDocId][gvId] = {};
      if (!updated[currentDocId][gvId][day]) updated[currentDocId][gvId][day] = {};
      if (!Array.isArray(updated[currentDocId][gvId][day][session])) {
        const length = session === 'morning' ? 4 : 3;
        updated[currentDocId][gvId][day][session] = Array.from({ length }, () => null);
      }

      updated[currentDocId][gvId][day][session][index] = {
        class: newClassObj?.class || "",
        subject: newClassObj?.subject || "",
        tiet: index + 1, // nếu bạn cần số tiết
        gio: "",         // nếu có giờ học, bạn có thể thêm
      };

      return updated;
    });
  };

  const parsePhanCongFromFirestore = (rawArray) => {
    const result = {};
    if (!Array.isArray(rawArray)) {
      console.warn("⚠️ classPeriods không phải mảng:", rawArray);
      return result;
    }
    for (const entry of rawArray) {
      const [lopMon, soTietStr] = entry.split(":");
      const [lop, mon] = lopMon.split("|").map(s => s.trim());
      const soTiet = parseInt(soTietStr.trim());
      if (!result[mon]) result[mon] = {};
      if (!result[mon][lop]) result[mon][lop] = 0;
      result[mon][lop] += soTiet;
    }
    return result;
  };

  const parseClassPeriodsMap = (classPeriodsMap) => {
    const result = {};
    if (!classPeriodsMap || typeof classPeriodsMap !== 'object') return result;
    for (const key in classPeriodsMap) {
      const value = classPeriodsMap[key];
      if (typeof value !== 'number') continue;
      const [lop, mon] = key.split("|").map(s => s.trim());
      if (!lop || !mon) continue;
      if (!result[mon]) result[mon] = {};
      if (!result[mon][lop]) result[mon][lop] = 0;
      result[mon][lop] += value;
    }
    return result;
  };

  useEffect(() => {
    setIsEditing(false);
    const fetchAllData = async () => {
      setIsLoading(true);
      setLoadingProgress(0);

      const snapshot = await getDocs(collection(db, "PHANCONG_2025-2026"));

      const newSummary = {};
      const newAssignments = {};
      const newTeachers = [];
      const vtMon = {};
      const defaultMon = {};
      const newTkb = {};
      const newPhanCongGVs = {};
      const newThinhGiang = {};
      let loaded = 0;

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const hoTen = data.hoTen || '';
        const monDay = data.monDay || [];
        const phanCong = data.phanCong || {};
        const classPeriodsMap = data.classPeriods || {};
        const offTimes = data.offTimes || {};
        const thinhGiang = data.thinhGiang || false;

        // Lưu dữ liệu gốc
        newAssignments[id] = phanCong;
        if (!newTeachers.some(t => t.name === hoTen)) {
          newTeachers.push({ id, name: hoTen, monDay, offTimes, thinhGiang });
        }

        newPhanCongGVs[id] = parseClassPeriodsMap(classPeriodsMap);
        monDay.forEach(mon => {
          vtMon[mon] = mon.split(' ').map(t => t[0]).join('').toUpperCase();
        });
        defaultMon[id] = monDay[0] || '';
        newTkb[id] = {};
        newThinhGiang[id] = thinhGiang;

        // Tính danh sách lớp từ phanCong
        const assignedLopsSet = new Set();
        Object.values(phanCong).forEach((lopList) => {
          lopList.forEach((lop) => assignedLopsSet.add(lop));
        });
        const assignedLops = Array.from(assignedLopsSet).sort();

        // ✅ Reset assigned và total = 0 để cột “Đã xếp” & “Chưa xếp” trống
        newSummary[id] = {
          assignedLops,
          assigned: 0,
          total: 0
        };

        loaded += 1;
        setLoadingProgress(Math.round((loaded / snapshot.docs.length) * 100));
      });

      // ✅ Cập nhật state vào context + local state
      setGvSummary(newSummary);
      setAssignments(newAssignments);
      setTeachers(newTeachers);
      setVietTatMon(vtMon);
      setSelectedMon(defaultMon);

      // 🔹 Chỉ khởi tạo context TKB nếu chưa có (tránh ghi đè file đã load trước đó)
      if ((!tkbAllTeachers || Object.keys(tkbAllTeachers).length === 0) && !currentDocId) {
        setTkbAllTeachers(newTkb);
        setTkb(newTkb); // đồng bộ local state lần đầu
      }

      setPhanCongGVs(newPhanCongGVs);
      setThinhGiangMap(newThinhGiang);
      setIsLoading(false);
    };

    fetchAllData();
    setIsEditing(true);
  }, []);

  // 🔹 Thống kê khi mở file
  useEffect(() => {
    if (!currentDocId || !tkbAllTeachers[currentDocId]) return;

    const loadedTkb = tkbAllTeachers[currentDocId];
    const newSummary = {};

    for (const gv of teachers) {
      const gvId = gv.id;
      const gvTkb = loadedTkb[gvId] || {};
      const assignedPerClass = {};

      // Đếm số tiết đã xếp cho từng lớp
      Object.values(gvTkb).forEach(daySchedule => {
        ["morning", "afternoon"].forEach(session => {
          daySchedule[session]?.forEach(period => {
            if (period?.class) {
              assignedPerClass[period.class] = (assignedPerClass[period.class] || 0) + 1;
            }
          });
        });
      });

      const planned = assignments[gvId] || {}; // dữ liệu gốc từ Firestore
      const failedLops = [];

      for (const mon of gv.monDay) {
        const lopList = planned[mon] || [];
        for (const lop of lopList) {
          const totalNeeded = phanCongGVs[gvId]?.[mon]?.[lop] || 0;
          const assigned = assignedPerClass[lop] || 0;
          if (assigned < totalNeeded) {
            failedLops.push(`${lop}`); // hoặc `${lop} (${totalNeeded - assigned})`
          }
        }
      }

      const total = Object.values(phanCongGVs[gvId] || {}).reduce(
        (sum, monMap) => sum + Object.values(monMap).reduce((a, b) => a + b, 0),
        0
      );
      const assigned = Object.values(assignedPerClass).reduce((a, b) => a + b, 0);

      newSummary[gvId] = {
        assignedLops: gvSummary[gvId]?.assignedLops || [],
        total,
        assigned,
        failedLops
      };
    }

    setGvSummary(newSummary);
    //console.log("📂 Thống kê khi mở file:", newSummary);
    // Bật bảng thống kê
    setShowStats(true);
  }, [currentDocId, tkbAllTeachers, teachers, assignments, phanCongGVs]);


const autoFillMissingLessons = (newTkb, gvSummary, teachers, assignments, phanCongGVs) => {
  for (const gv of teachers) {
    const gvId = gv.id;
    const subjectMap = phanCongGVs[gvId] || {};

    for (const subject in subjectMap) {
      const lopMap = subjectMap[subject];

      for (const lop in lopMap) {
        const totalNeeded = lopMap[lop];
        const assigned = countAssigned(newTkb, gvId, lop, subject);
        const missing = totalNeeded - assigned;

        for (let i = 0; i < missing; i++) {
          const bestSlot = findBestSlot(newTkb, gvId, lop, subject);
          if (bestSlot) {
            const { day, session, index } = bestSlot;

            // Khởi tạo nếu chưa có
            if (!newTkb[gvId]) newTkb[gvId] = {};
            if (!newTkb[gvId][day]) newTkb[gvId][day] = {};
            if (!newTkb[gvId][day][session]) newTkb[gvId][day][session] = [];

            newTkb[gvId][day][session][index] = { class: lop, subject };

            // Cập nhật lại số tiết đã xếp nếu cần
            if (gvSummary[gvId]) {
              gvSummary[gvId].assigned = (gvSummary[gvId].assigned || 0) + 1;
            }
          }
        }
      }
    }
  }
};

const findBestSlot = (tkbData, gvId, lop, subject) => {
  const gvTkb = tkbData[gvId];
  const dayScores = {};

  // Tính số tiết đã có trong từng buổi
  for (const day in gvTkb) {
    for (const session of ["morning", "afternoon"]) {
      const periods = gvTkb[day][session];
      if (!periods) continue;
      const filled = periods.filter(p => p && p.class).length;
      dayScores[`${day}|${session}`] = filled;
    }
  }

  // Ưu tiên buổi có nhiều tiết
  const sortedSessions = Object.entries(dayScores)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key.split("|"));

  for (const [day, session] of sortedSessions) {
    const periods = gvTkb[day][session];
    for (let i = 0; i < periods.length; i++) {
      if (!periods[i] || !periods[i].class) {
        // Kiểm tra ràng buộc: không trùng tiết, không vượt giới hạn môn/ngày
        const tempTkb = JSON.parse(JSON.stringify(tkbData));
        tempTkb[gvId][day][session][i] = { class: lop, subject };

        const tempErrors = checkScheduleConflicts(tempTkb, { [gvId]: { name: gvId } });
        if (tempErrors.length === 0) {
          return { day, session, index: i };
        }
      }
    }
  }

  return null;
};

const countAssigned = (tkb, gvId, lop, subject) => {
  let count = 0;
  const tkbGv = tkb[gvId];
  for (const day in tkbGv) {
    for (const session of ["morning", "afternoon"]) {
      tkbGv[day][session]?.forEach(period => {
        if (period?.class === lop && period?.subject === subject) {
          count++;
        }
      });
    }
  }
  return count;
};

const handleAutoSchedule = async () => {
  //console.log("🚀 Bắt đầu xếp thời khóa biểu...");
  setIsEditing(false);
  // Reset trạng thái
  setTkb({});
  setGvSummary({});
  setAutoScheduleProgress(0);

  // Khởi tạo dữ liệu
  const newTkb = {};
  const globalSchedule = {};
  const totalPeriodsMap = {};
  const gvSummary = {};
  const tinHocSlots = new Set();

  const fakeProgress = async (from, to) => {
    for (let i = from; i < to; i += 5) {
      setAutoScheduleProgress(i);
      await new Promise(res => setTimeout(res, 80));
    }
    setAutoScheduleProgress(to);
  };

  const countAssigned = (tkb, gvId, dayFilter, mon, lop) => {
    if (!tkb?.[gvId]) return 0;
    return days
      .filter(dayFilter)
      .flatMap(day => ["morning", "afternoon"].flatMap(session => tkb[gvId]?.[day]?.[session] || []))
      .filter(tiet => tiet?.subject === mon && tiet?.class === lop).length;
  };

  // Khởi tạo TKB rỗng
  for (const gv of teachers) {
    newTkb[gv.id] = {};
    for (const day of days) {
      newTkb[gv.id][day] = {
        morning: Array(4).fill(null),
        afternoon: Array(3).fill(null)
      };
    }
  }

  // Tính tổng số tiết cần dạy mỗi GV
  for (const gv of teachers) {
    let total = 0;
    for (const mon of gv.monDay) {
      const lopList = assignments[gv.id]?.[mon] || [];
      for (const lop of lopList) {
        total += phanCongGVs[gv.id]?.[mon]?.[lop] || 0;
      }
    }
    totalPeriodsMap[gv.id] = total;
    gvSummary[gv.id] = { name: gv.name, total, assigned: 0, failedLops: [] };
  }

  const highLoadGVs = teachers.filter(gv => totalPeriodsMap[gv.id] > 10);
  const lowLoadGVs = teachers.filter(gv => totalPeriodsMap[gv.id] <= 10);

  // 🚀 Giai đoạn 1: Xếp các môn chính (Tin học, Công nghệ, Tiếng Anh)
  await fakeProgress(0, 40);


  // 🚀 Xếp lịch theo các hàm đã tách

  // GV thỉnh giảng
  const gvThinhGiang = teachers.filter(gv => gv.thinhGiang);
  scheduleTiengAnh_TG({
    gvList: gvThinhGiang,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    days
  });

  await scheduleCongNghe({
    gvList: highLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    tinHocSlots,
    days
    
  });

  await scheduleTinHoc({
    gvList: highLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    tinHocSlots,
    days
  });

  // 🔧 Tối ưu tiết Tin học sau khi xếp xong
  optimizeTinHocSchedule({
    gvList: teachers,
    newTkb,
    tinHocSlots,
    days
  });

  await scheduleTiengAnh({
    gvList: highLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    days
  });

  // ✅ Gộp danh sách giáo viên để tối ưu
  const gvList = [...highLoadGVs, ...lowLoadGVs];

  // 🔧 Bổ sung tiết còn thiếu sau cùng
  finalFillMissingPeriods({
    gvList,
    newTkb,
    globalSchedule,
    assignments,
    gvSummary,
    days
  });

  // 🧠 Các bước tối ưu tiếp theo (nếu cần)
  resolveMissingTiengAnh({
    newTkb,
    gvList,
    gvSummary,
    assignments,
    globalSchedule,
    days
  });

  optimizeFullTiengAnhSchedule({
    newTkb,
    gvList,
    assignments,
    days
  });

  // 🚀 Giai đoạn 2: Xử lý các môn nhẹ tải (Âm nhạc, Mĩ thuật, GDTC, Đạo đức, Đọc sách)
  await fakeProgress(41, 70);

    // 🔁 Xếp cho nhóm giáo viên tải cao trước
  await scheduleMiThuat({
    gvList: highLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    days
  });

  // 🔧 Bổ sung tiết còn thiếu sau cùng
  finalFillMissingPeriods_MiThuat({
    gvList,
    newTkb,
    globalSchedule,
    assignments,
    gvSummary,
    days
  });

  // 🧠 Các bước tối ưu tiếp theo
  resolveMissingMiThuat({
    newTkb,
    gvList,
    gvSummary,
    assignments,
    globalSchedule,
    days
  });

  optimizeFullMiThuatSchedule({
    newTkb,
    gvList,
    assignments,
    days,
    gvSummary,
    globalSchedule
  });

    await scheduleAmNhac({
      gvList: highLoadGVs,
      newTkb,
      globalSchedule,
      phanCongGVs,
      assignments,
      gvSummary,
      days
    });

  // 🔧 Bổ sung tiết còn thiếu sau cùng
  finalFillMissingPeriods_AmNhac({
    gvList,
    newTkb,
    globalSchedule,
    assignments,
    gvSummary,
    days
  });

  // 🧠 Các bước tối ưu tiếp theo
  resolveMissingAmNhac({
    newTkb,
    gvList,
    gvSummary,
    assignments,
    globalSchedule,
    days
  });

  finalFillMissingPeriods_AmNhac({
    newTkb,
    gvList,
    assignments,
    days,
    gvSummary,
    globalSchedule
  });

  await scheduleGDTC({
    gvList: highLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    days
  });

  finalFillMissingPeriods_GDTC({
    gvList,
    newTkb,
    globalSchedule,
    assignments,
    gvSummary,
    days
  });

  // 🧠 Các bước tối ưu tiếp theo
  resolveMissingGDTC({
    newTkb,
    gvList,
    gvSummary,
    assignments,
    globalSchedule,
    days
  });

  finalFillMissingPeriods_GDTC({
    newTkb,
    gvList,
    assignments,
    days,
    gvSummary,
    globalSchedule
  });

  await scheduleGDTC2({
    gvList: lowLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    days
  })

  await scheduleDaoDuc({
    gvList: lowLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    days
  })

  await scheduleAmNhac_BGH({
    gvList: lowLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    days
  })

  await scheduleDocSach({
    gvList: lowLoadGVs,
    newTkb,
    globalSchedule,
    phanCongGVs,
    assignments,
    gvSummary,
    days
  })

  // 🚀 Giai đoạn 3: Tối ưu hoán đổi & xử lý xung đột
  await fakeProgress(71, 90);

  // 🔄 Tối ưu hoán đổi
  const swaps = generateSwapCandidates(newTkb);
  for (const swap of swaps) {
    if (isValidSwap(swap, globalSchedule, newTkb, teachers, assignments)) {
      applySwap(newTkb, swap);
    }
  }

  // 🔥 Giải quyết xung đột và tính lại số tiết
  resolveConflicts(newTkb, teachers, globalSchedule);

  for (const gv of teachers) {
    let count = 0;
    for (const day of days) {
      for (const session of ["morning", "afternoon"]) {
        count += newTkb[gv.id][day][session].filter(t => t !== null).length;
      }
    }
    gvSummary[gv.id].assigned = count;

    // 🔹 Bước tính lớp còn thiếu sau khi xếp xong
    for (const gv of teachers) {
      const gvId = gv.id;
      const assignedPerClass = {}; // số tiết đã xếp cho từng lớp

      const gvTkb = newTkb[gvId]; // tkb của giáo viên
      Object.values(gvTkb).forEach(daySchedule => {
        ["morning", "afternoon"].forEach(session => {
          daySchedule[session]?.forEach(period => {
            if (period?.class) {
              assignedPerClass[period.class] = (assignedPerClass[period.class] || 0) + 1;
            }
          });
        });
      });

      const planned = assignments[gvId] || {}; // dữ liệu gốc từ Firestore
      const failedLops = [];

      for (const mon of gv.monDay) {
        const lopList = planned[mon] || [];
        for (const lop of lopList) {
          const totalNeeded = phanCongGVs[gvId]?.[mon]?.[lop] || 0;
          const assigned = assignedPerClass[lop] || 0;
          if (assigned < totalNeeded) {
            failedLops.push(`${lop}`); // hoặc `${lop} (${totalNeeded - assigned})` nếu muốn hiển thị số tiết thiếu
          }
        }
      }

      gvSummary[gvId].failedLops = failedLops;
    }
  }

  setGvSummary({ ...gvSummary });
  setTkb(prev => ({ ...prev, ...newTkb }));
  autoFillMissingLessons(newTkb, gvSummary, teachers, assignments, phanCongGVs);

  // 1️⃣ Cập nhật TKB vào ScheduleContext
  const tempDocId = "TKB chưa lưu";

  setTkbAllTeachers((prev) => {
    const updated = {
      ...prev,
      [tempDocId]: newTkb
    };
    //console.log("🟢 ScheduleContext - tkbAllTeachers sau khi cập nhật:", updated);
    return updated;
  });

  // 2️⃣ Gắn currentDocId để các trang khác biết đang làm việc với TKB tạm
  setCurrentDocId(tempDocId);
  
  // ✅ Chuyển newTkb (theo gvId) → theo lớp trước khi lưu vào context
  const tkbByClass = {}; // lưu theo lớp

  Object.keys(newTkb).forEach(gvId => {
    const gvSchedule = newTkb[gvId]; // { Thứ2: {morning, afternoon}, ... }
    Object.entries(assignments[gvId] || {}).forEach(([mon, lopList]) => {
      lopList.forEach(lop => {
        if (!tkbByClass[lop]) {
          tkbByClass[lop] = { SÁNG: {}, CHIỀU: {} };
          days.forEach(day => {
            tkbByClass[lop].SÁNG[day] = Array(5).fill("");
            tkbByClass[lop].CHIỀU[day] = Array(4).fill("");
          });
        }

        // Điền tiết của gv vào lớp tương ứng
        days.forEach(day => {
          ["morning", "afternoon"].forEach(session => {
            const sessionKey = session === "morning" ? "SÁNG" : "CHIỀU";
            const periodList = gvSchedule[day]?.[session] || [];

            periodList.forEach((period, idx) => {
              if (period?.class === lop) {
                // Chỉ lưu tên môn, "" nếu null
                tkbByClass[lop][sessionKey][day][idx] = period.subject || "";
              }
            });
          });
        });
      });
    });
  });

  // ✅ Cập nhật context theo lớp
  setAllSchedules(prev => ({ ...prev, ...tkbByClass }));
  setContextSchedule(prev => ({ ...prev, ...tkbByClass }));
  //console.log("🟢 Context sau khi cập nhật:", tkbByClass);

  // 3️⃣ Cập nhật tên file hiển thị
  setOpenFileName("TKB chưa lưu");
  await fakeProgress(91, 100);
  setIsNewTkb(true);
  // Bật bảng thống kê
  setShowStats(true);

  // 👉 Sau khi xếp xong thì bật lại chế độ chỉnh sửa
  setIsEditing(true);
  

  //console.log("📋 Tổng kết xếp TKB:");
  Object.values(gvSummary).forEach(gv => {
    //console.log(`${gv.name}: ${gv.total} tiết | Đã xếp: ${gv.assigned} | Chưa xếp: ${gv.failedLops.join(", ") || "Không"}`);
  });
};

  const handleAddPeriod = (gvId, day, session) => {
    setTkb(prev => {
      const updated = { ...prev };

      // Khởi tạo cấu trúc nếu chưa có
      if (!updated[gvId]) updated[gvId] = {};
      if (!updated[gvId][day]) updated[gvId][day] = { morning: [], afternoon: [] };
      if (!updated[gvId][day][session]) updated[gvId][day][session] = [];

      const current = updated[gvId][day][session];
      const last = current[current.length - 1];

      // Nếu tiết cuối chưa điền đủ thông tin thì không thêm mới
      if (last && (!last.period || !last.class)) return updated;

      // Gán môn mặc định: ưu tiên selectedMon, nếu không có thì lấy môn đầu tiên của GV
      const defaultSubject = selectedMon[gvId] || (teachers.find(t => t.id === gvId)?.monDay?.[0] || '');

      // Thêm tiết mới
      updated[gvId][day][session] = [
        ...current,
        {
          period: '',
          class: '',
          subject: defaultSubject
        }
      ];

      return updated;
    });
  };

  const handleRemovePeriod = (gvId, day, session, index) => {
    setTkb(prev => {
      const updated = { ...prev };
      updated[gvId][day][session] = updated[gvId][day][session].filter((_, i) => i !== index);
      return updated;
    });
  };

  const handleChange = (gvId, day, session, index, field, value) => {
    setTkb(prev => {
      const updated = { ...prev };
      updated[gvId][day][session][index][field] = value;
      return updated;
    });
  };

  const getPeriodOptions = session => session === 'morning' ? [1, 2, 3, 4] : [1, 2, 3];

const sortTeachersBySubject = (teachers, gvSummary) => {
  const getLastName = (fullName) => {
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1];
  };

  const sortByName = (arr) =>
    arr.sort((a, b) =>
      getLastName(a.name).localeCompare(getLastName(b.name), "vi", {
        sensitivity: "base"
      })
    );

  const groups = {
    "Tiếng Anh": [],
    "Tin học": [],
    "Mĩ thuật (>10 tiết)": [],
    "Âm nhạc (>10 tiết)": [],
    "GDTC (>10 tiết)": [],
    "Khác": []
  };

  for (const gv of teachers) {
    const monList = gv.monDay || [];
    const total = gvSummary[gv.id]?.total || 0;

    if (monList.includes("Tiếng Anh")) {
      groups["Tiếng Anh"].push(gv);
    } else if (monList.includes("Tin học")) {
      groups["Tin học"].push(gv);
    } else if (monList.includes("Mĩ thuật") && total > 10) {
      groups["Mĩ thuật (>10 tiết)"].push(gv);
    } else if (monList.includes("Âm nhạc") && total > 10) {
      groups["Âm nhạc (>10 tiết)"].push(gv);
    } else if (monList.includes("GDTC") && total > 10) {
      groups["GDTC (>10 tiết)"].push(gv);
    } else {
      groups["Khác"].push(gv);
    }
  }

  // Sắp xếp từng nhóm theo tên
  for (const key in groups) {
    groups[key] = sortByName(groups[key]);
  }

  return groups;
};

const countAssignedPeriods = (tkbGV) => {
  if (!tkbGV) return 0;
  let count = 0;
  for (const day of days) {
    for (const session of ['morning', 'afternoon']) {
      const periods = tkbGV[day]?.[session] || [];
      count += periods.filter(p =>
        p &&
        p.period != null &&
        p.class != null &&
        p.subject != null
      ).length;
    }
  }
  return count;
};

// ✅ Hàm format hiển thị tên lớp theo quy tắc
const formatTietDisplay = (gvId, tiet, assignments, vietTatMon) => {
  if (!tiet || !tiet.class) return "";

  const monList = assignments[gvId] ? Object.keys(assignments[gvId]) : [];
  const monHoc = tiet.subject;

  // 1️⃣ GV chỉ dạy 1 môn
  if (monList.length === 1) {
    return tiet.class;
  }

  // 2️⃣ GV nhiều môn
  if (monList.length > 1) {
    if (monHoc === "Tin học") {
      return tiet.class;
    }
    return `${tiet.class} (${vietTatMon[monHoc] || monHoc})`;
  }

  return tiet.class;
};

const formatOptionDisplay = (gvId, lop, assignments, vietTatMon) => {
  const monMap = assignments[gvId] || {};
  const monList = Object.keys(monMap);

  // Tìm môn học tương ứng với lớp
  let monHoc = "";
  for (const m of Object.keys(monMap)) {
    if (monMap[m].includes(lop)) {
      monHoc = m;
      break;
    }
  }

  if (monList.length === 1) return lop;
  if (monHoc === "Tin học") return lop;

  const vietTat = vietTatMon[monHoc] || monHoc;
  return `${lop} (${vietTat})`;
};

const formatGVName = (gvId) => {
  const gv = teachers.find(t => t.id === gvId);
  if (!gv) return `GV#${gvId}`;

  return gv.name; // ✅ chỉ trả về tên đầy đủ
};

const handleCheckSchedule = () => {
  const errorsMap = {}; // key: day|session|period|class -> mảng { gvName, subject }

  for (const gvId in tkb) {
    for (const day of Object.keys(tkb[gvId])) {
      for (const session of ["morning", "afternoon"]) {
        const periods = tkb[gvId][day][session];
        if (!periods) continue;

        periods.forEach((tiet, idx) => {
          if (!tiet) return;

          const lop = tiet.class;
          const mon = tiet.subject;
          const key = `${day}|${session}|${idx}|${lop}`;

          if (!errorsMap[key]) errorsMap[key] = [];
          errorsMap[key].push({ gvName: formatGVName(gvId), subject: mon });
        });
      }
    }
  }

  const errorMessages = [];
  for (const key in errorsMap) {
    const arr = errorsMap[key];
    if (arr.length <= 1) continue;

    const [day, session, idx, lop] = key.split("|");
    const periodNumber = Number(idx) + 1;
    const sessionLabel = session === "morning" ? "sáng" : "chiều";

    let msg = `Lớp ${lop} (${sessionLabel} ${day}, tiết ${periodNumber}) có ${arr.length} GV cùng dạy:\n`;
    arr.forEach((gv) => {
      msg += `    - ${gv.gvName} (${gv.subject})\n`; // thụt 4 dấu cách
    });

    errorMessages.push(msg.trim());
  }

  setConflicts(errorMessages.length > 0 ? errorMessages : ["✅ Không phát hiện trùng tiết trong TKB"]);
};

const handleCheckScheduleClick = () => {
  handleCheckSchedule(); // giả sử hàm này cập nhật mảng conflicts
  setShowConflicts(true);
};

const handleCheckSchedule1 = () => {
  const errors = [];

  // Map để phát hiện trùng
  const classSlots = {};  // key: day|session|period|class -> gvId
  const teacherSlots = {}; // key: day|session|period|gvId -> class

  for (const gvId in tkb) {
    for (const day of Object.keys(tkb[gvId])) {
      for (const session of ["morning", "afternoon"]) {
        const periods = tkb[gvId][day][session];
        if (!periods) continue;

        periods.forEach((tiet, idx) => {
          if (!tiet) return;

          const { class: lop, subject } = tiet;

          // --- Kiểm tra 1 lớp có nhiều GV ---
          const classKey = `${day}|${session}|${idx}|${lop}`;
          if (classSlots[classKey] && classSlots[classKey] !== gvId) {
            errors.push(
              `❌ Xung đột: Lớp ${lop} có 2 GV (${classSlots[classKey]} và ${gvId}) dạy ${subject} cùng lúc (${day}, ${session}, tiết ${idx + 1})`
            );
          } else {
            classSlots[classKey] = gvId;
          }

          // --- Kiểm tra 1 GV dạy nhiều lớp ---
          const teacherKey = `${day}|${session}|${idx}|${gvId}`;
          if (teacherSlots[teacherKey] && teacherSlots[teacherKey] !== lop) {
            errors.push(
              `❌ Xung đột: GV ${gvId} dạy 2 lớp (${teacherSlots[teacherKey]} và ${lop}) cùng lúc (${day}, ${session}, tiết ${idx + 1})`
            );
          } else {
            teacherSlots[teacherKey] = lop;
          }
        });
      }
    }
  }

  if (errors.length === 0) {
    alert("✅ Không có xung đột trong TKB!");
  } else {
    alert("Phát hiện xung đột:\n\n" + errors.join("\n"));
  }
};

// ✅ Hàm format tên giáo viên từ gvId

//Kiểm tra trung tiêt - GV - kiểm tra vượt số tiết/môn trong ngày
const checkScheduleConflicts_OK = (tkbData, gvSummary) => {
  const errors = [];
  if (!tkbData) return [];

  const prevState = typeof tkb !== "undefined" ? tkb : {};
  const existingDoc =
    typeof tkbAllTeachers !== "undefined" && currentDocId && tkbAllTeachers[currentDocId]
      ? tkbAllTeachers[currentDocId]
      : {};

  const allGvIds = new Set([
    ...Object.keys(prevState || {}),
    ...Object.keys(tkbData || {}),
    ...Object.keys(existingDoc || {})
  ]);

  const getSlot = (gvId, day, session, idx) => {
    const fromNew = tkbData?.[gvId]?.[day]?.[session]?.[idx];
    if (fromNew) return fromNew;
    const fromPrev = prevState?.[gvId]?.[day]?.[session]?.[idx];
    if (fromPrev) return fromPrev;
    const fromExisting = existingDoc?.[gvId]?.[day]?.[session]?.[idx];
    if (fromExisting) return fromExisting;
    return null;
  };

  const getAllDaySlotsForGV = (gvId, day) => {
    const slots = [];
    for (const session of ["morning", "afternoon"]) {
      const maxPeriods = Math.max(
        tkbData?.[gvId]?.[day]?.[session]?.length || 0,
        prevState?.[gvId]?.[day]?.[session]?.length || 0,
        existingDoc?.[gvId]?.[day]?.[session]?.length || 0
      );
      for (let idx = 0; idx < maxPeriods; idx++) {
        const slot = getSlot(gvId, day, session, idx);
        if (slot && slot.class && slot.subject) {
          slots.push({
            class: String(slot.class).trim(),
            subject: String(slot.subject).trim()
          });
        }
      }
    }
    return slots;
  };

  for (const gvId in tkbData) {
    if (!gvSummary?.[gvId]) continue;
    const schedule = tkbData[gvId] || {};

    for (const day of Object.keys(schedule)) {
      for (const session of ["morning", "afternoon"]) {
        const periods = schedule[day]?.[session];
        if (!Array.isArray(periods)) continue;

        for (let idx = 0; idx < periods.length; idx++) {
          const newSlot = periods[idx];
          if (!newSlot || !newSlot.class || !newSlot.subject) continue;

          const prevSlot = prevState?.[gvId]?.[day]?.[session]?.[idx];
          const prevClass = prevSlot?.class ? String(prevSlot.class).trim() : null;
          const newClass = String(newSlot.class).trim();
          const prevSubject = prevSlot?.subject ? String(prevSlot.subject).trim() : null;
          const newSubject = newSlot?.subject ? String(newSlot.subject).trim() : null;

          if (prevClass === newClass && prevSubject === newSubject) continue;

          const periodNumber = idx + 1;

          // 🔍 Trùng tiết
          for (const otherGvId of allGvIds) {
            if (otherGvId === gvId) continue;
            const otherSlot = getSlot(otherGvId, day, session, idx);
            if (!otherSlot || !otherSlot.class) continue;

            if (String(otherSlot.class).trim() === newClass) {
              errors.push(
                `⚠️ Trùng tiết với ${formatGVName(otherGvId)} (${newClass} - tiết ${periodNumber})`
              );
            }
          }

          // 📚 Số tiết trong ngày
          const allDaySlots = getAllDaySlotsForGV(gvId, day);
          const sameClassSubject = allDaySlots.filter(
            s => s.class === newClass && s.subject.toLowerCase() === newSubject.toLowerCase()
          );

          const maxPerDay = newSubject.toLowerCase() === "tiếng anh" ? 2 : 1;
          if (sameClassSubject.length > maxPerDay) {
            errors.push(
              `⚠️ Lớp ${newClass} học ${sameClassSubject.length} tiết ${newSubject} trong ngày ${day}`
            );
          }
        }
      }
    }
  }

  // ❗ Chỉ trả về cảnh báo đầu tiên và chuẩn hóa emoji
  return errors.length > 0 ? [errors[0]] : [];
};

const checkScheduleConflicts = (tkbData, gvSummary) => {
  const errors = [];
  const classSlots = {};   // key: day|session|period|class -> gvId
  const teacherSlots = {}; // key: day|session|period|gvId -> class

  for (const gvId in tkbData) {
    if (!gvSummary[gvId]) continue;

    const dailySubjectCount = {}; // key: day|class|subject -> count
    const gvName = gvSummary[gvId].name?.trim() || gvId;

    for (const day of Object.keys(tkbData[gvId])) {
      for (const session of ["morning", "afternoon"]) {
        const periods = tkbData[gvId][day][session];
        if (!Array.isArray(periods)) continue;

        periods.forEach((tiet, idx) => {
          if (
            !tiet ||
            typeof tiet !== "object" ||
            !tiet.class ||
            !tiet.subject ||
            typeof tiet.class !== "string" ||
            typeof tiet.subject !== "string"
          ) return;

          const lop = tiet.class.trim();
          const mon = tiet.subject.trim();
          const period = idx + 1;
          const classKey = `${day}|${session}|${idx}|${lop}`;
          const teacherKey = `${day}|${session}|${idx}|${gvId}`;

          // Lớp bị trùng GV
          if (classSlots[classKey] && classSlots[classKey] !== gvId) {
            const otherId = classSlots[classKey];
            errors.push(
              `⚠️ Trùng tiết với ${formatGVName(otherId)} (${lop} - tiết ${period})`
            );
          } else {
            classSlots[classKey] = gvId;
          }

          // GV dạy trùng lớp
          if (teacherSlots[teacherKey] && teacherSlots[teacherKey] !== lop) {
            const lopCu = teacherSlots[teacherKey];
            errors.push(
              `⚠️ Trùng tiết với ${formatGVName(gvId)} (${lopCu} - tiết ${period})`
            );
          } else {
            teacherSlots[teacherKey] = lop;
          }

          // Tính số tiết theo môn/lớp/ngày
          const countKey = `${day}|${lop}|${mon.toLowerCase()}`;
          dailySubjectCount[countKey] = (dailySubjectCount[countKey] || 0) + 1;
        });
      }
    }

    // Kiểm tra giới hạn số tiết/ngày
    for (const key in dailySubjectCount) {
      const [day, lop, mon] = key.split("|");
      const count = dailySubjectCount[key];
      const maxPerDay = mon === "tiếng anh" ? 2 : 1;

      if (count > maxPerDay) {
        // Chuẩn hóa tên môn
        let monFormatted;
        if (mon.toLowerCase() === "tiếng anh") {
          monFormatted = "Tiếng Anh";
        } else {
          monFormatted = mon.charAt(0).toUpperCase() + mon.slice(1);
        }

        errors.push(
          `⚠️ Lớp ${lop} học ${count} tiết ${monFormatted} trong ngày ${day}`
        );
      }

    }
  }

  // Chỉ trả về cảnh báo đầu tiên và chuẩn hóa emoji
  return errors.length > 0 ? ["⚠️ " + errors[0].replace(/^⚠️+/, "").trim()] : [];
};

const checkScheduleConflicts_gốc = (tkbData, gvSummary) => {
  const errors = [];
  const classSlots = {};     // key: day|session|period|class -> gvId
  const teacherSlots = {};   // key: day|session|period|gvId -> class

  for (const gvId in tkbData) {
    if (!gvSummary[gvId]) continue;

    const dailySubjectCount = {}; // key: day|class|subject -> count
    const gvName = gvSummary[gvId].name?.trim() || gvId;

    for (const day of Object.keys(tkbData[gvId])) {
      for (const session of ["morning", "afternoon"]) {
        const periods = tkbData[gvId][day][session];
        if (!Array.isArray(periods)) continue;

        periods.forEach((tiet, idx) => {
          // ✅ Bỏ qua slot null hoặc thiếu dữ liệu
          if (
            !tiet ||
            typeof tiet !== "object" ||
            !tiet.class ||
            !tiet.subject ||
            typeof tiet.class !== "string" ||
            typeof tiet.subject !== "string"
          ) return;

          const lop = tiet.class.trim();
          const mon = tiet.subject.trim();
          const period = idx + 1;
          const classKey = `${day}|${session}|${idx}|${lop}`;
          const teacherKey = `${day}|${session}|${idx}|${gvId}`;

          // ✅ Kiểm tra lớp bị trùng GV
          if (classSlots[classKey] && classSlots[classKey] !== gvId) {
            const otherId = classSlots[classKey];
            const otherName = gvSummary[otherId]?.name?.trim() || otherId;
            errors.push(
              `Trùng tiết với ${formatGVName(otherId)} (${lop} - tiết ${period})`
            );

          } else {
            classSlots[classKey] = gvId;
          }

          // ✅ Kiểm tra GV dạy trùng lớp
          if (teacherSlots[teacherKey] && teacherSlots[teacherKey] !== lop) {
            const lopCu = teacherSlots[teacherKey];
            //errors.push(`Trùng tiết với ${gvName} (${lopCu} - tiết ${period})`);
            errors.push(
              `⚠️ Trùng tiết với ${formatGVName(gvId)} (${lopCu} - tiết ${period})`
            );

          } else {
            teacherSlots[teacherKey] = lop;
          }

          // ✅ Tính số tiết theo môn/lớp/ngày
          const countKey = `${day}|${lop}|${mon.toLowerCase()}`;
          if (!dailySubjectCount[countKey]) dailySubjectCount[countKey] = 0;
          dailySubjectCount[countKey]++;
        });
      }
    }

    // ✅ Kiểm tra giới hạn tiết học theo môn/lớp/ngày
    for (const key in dailySubjectCount) {
      const [day, lop, mon] = key.split("|");
      const count = dailySubjectCount[key];
      const maxPerDay = mon === "tiếng anh" ? 2 : 1;

      if (count > maxPerDay) {
        errors.push(`Lớp ${lop} học môn ${mon} quá ${maxPerDay} tiết trong ngày ${day}`);
      }
    }
  }

  return errors;
};

const handleChangeLop = (rowId, newLop) => {
  setRows((prev) =>
    prev.map((r) => (r.id === rowId ? { ...r, lop: newLop } : r))
  );
};

function getSortedUniqueClasses(gv, assignments, vietTatMon) {
  const seen = new Set();
  const simple = [];
  const withSuffix = [];

  Object.entries(assignments[gv.id] || {})
    .sort(([a], [b]) => a.localeCompare(b, "vi", { numeric: true }))
    .forEach(([mon, lops]) => {
      lops.forEach((lop) => {
        const key = `${lop}|${mon}`;
        if (seen.has(key)) return;
        seen.add(key);

        const showSuffix = (gv.monDay || []).length > 1 && mon !== "Tin học";
        if (showSuffix) {
          withSuffix.push({ lop, mon, vtMon: vietTatMon[mon] || mon });
        } else {
          simple.push({ lop, mon });
        }
      });
    });

  // Sắp xếp theo lớp, numeric
  simple.sort((a, b) => a.lop.localeCompare(b.lop, "vi", { numeric: true }));
  withSuffix.sort((a, b) => a.lop.localeCompare(b.lop, "vi", { numeric: true }));

  return [...simple, ...withSuffix];
}

const [saving, setSaving] = useState(false);
const [saveProgress, setSaveProgress] = useState(0);

// helper: chuẩn hóa dữ liệu thành đúng cấu trúc bạn mô tả
const normalizeTkbForSave = (rawTkb = {}) => {
  const normalized = {};
  for (const gv of teachers || []) {
    const gvId = gv.id;
    normalized[gvId] = {};
    for (const day of days) {
      const daySchedule = rawTkb?.[gvId]?.[day] || {};
      const morningRaw = Array.isArray(daySchedule.morning) ? daySchedule.morning : [];
      const afternoonRaw = Array.isArray(daySchedule.afternoon) ? daySchedule.afternoon : [];

      // Morning luôn 4 phần tử
      const morning = Array.from({ length: 4 }, (_, i) => {
        const item = morningRaw[i];
        if (item && item.class) {
          return {
            class: String(item.class),
            period: Number(item.period) || (i + 1),
            subject: String(item.subject)
          };
        }
        return null;
      });

      // Afternoon đảm bảo 3 phần tử (theo cấu trúc bạn gửi). Nếu bạn muốn giữ chiều dài động, đổi logic này.
      const afternoon = Array.from({ length: 3 }, (_, i) => {
        const item = afternoonRaw[i];
        if (item && item.class) {
          return {
            class: String(item.class),
            period: Number(item.period) || (i + 1),
            subject: String(item.subject)
          };
        }
        return null;
      });

      normalized[gvId][day] = { morning, afternoon };
    }
  }
  return normalized;
};

const saveToFirestore = async (docId, newDocName = null) => {
  if (!docId || typeof docId !== "string") {
    alert("⚠️ Tên tệp không hợp lệ!");
    return;
  }

  try {
    setSaving(true);
    setSaveProgress(0);

    // ưu tiên tkbState (bản đang chỉnh), nếu rỗng thì dùng tkb
    const sourceTkb = (tkbState && Object.keys(tkbState).length) ? tkbState : tkb || {};
    const normalizedTkb = normalizeTkbForSave(sourceTkb);

    // mô phỏng tiến trình lưu
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      await new Promise(res => setTimeout(res, 150));
      setSaveProgress(Math.round((i / steps) * 100));
    }

    // Lưu lên Firestore: dùng doc(db, collection, id) cho rõ ràng; merge:true để không xóa các field khác
    const docRef = doc(db, "TKB_GVBM", docId);
    const payload = {
      tkb: normalizedTkb,
      updatedAt: new Date()
    };
    //if (newDocName) payload.fileName = newDocName;

    await setDoc(docRef, payload, { merge: true });

    // cập nhật context/state local
    setTkbAllTeachers(prev => ({
      ...(prev || {}),
      [docId]: normalizedTkb
    }));

    // tính lại summary
    const newSummary = calculateGvSummaryFromTkb(
      normalizedTkb,
      teachers,
      assignments,
      phanCongGVs
    );
    setGvSummary(newSummary);

    setCurrentDocId(docId);
    setSaveModalOpen(false);
    setIsNewTkb(false);

    // cập nhật tkbFiles (safe khi prev có thể không phải mảng)
    setTkbFiles(prev => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const exists = prevArr.some(f => f.id === docId);
      const updated = exists
        ? prevArr.map(f =>
            f.id === docId
              ? { ...f, fileName: newDocName || f.fileName || `Document ${docId}`, tkb: structuredClone(normalizedTkb) }
              : f
          )
        : [
            ...prevArr,
            { id: docId, fileName: newDocName || `Document ${docId}`, tkb: structuredClone(normalizedTkb) }
          ];

      localStorage.setItem("tkbFiles", JSON.stringify(updated));
      return updated;
    });

    // thông báo thành công
    //alert(`✅ Lưu thành công TKB vào document "${docId}"`);
  } catch (error) {
    console.error("Lỗi khi lưu TKB:", error);
    alert("❌ Toàn trường - Lưu thất bại. Xem console để biết chi tiết.");
  } finally {
    setSaving(false);
    setSaveProgress(0);
  }
};

const handleSave = async () => {
  try {
    if (!currentDocId) {
      console.warn("⚠️ Không có file đang mở để lưu.");
      return;
    }

    // Ghi đè vào file hiện tại
    await saveToFirestore(currentDocId, tkbState);
    //console.log("💾 Đã gọi saveToFirestore với docId:", currentDocId);

    // Cập nhật lại context sau khi lưu
    setTkbAllTeachers(prev => {
      const updated = {
        ...prev,
        [currentDocId]: tkbState,
      };
      //console.log("🔄 Context tkbAllTeachers sau khi cập nhật:", updated);
      return updated;
    });

    //console.log("✅ Save - Tự động thành công!)");
  } catch (err) {
    console.error("❌ Lỗi khi lưu TKB:", err);
  }
};


const handleSaveAs = async (newDocId) => {
  try {
    if (!newDocId) {
      console.warn("⚠️ Không có tên file mới để lưu.");
      return;
    }

    // Ghi dữ liệu sang file mới
    //await saveToFirestore(newDocId, { tkb: tkbState });
    await saveToFirestore(newDocId, tkbState);

    //console.log("📄 Đã gọi saveToFirestore với newDocId:", newDocId);

    // Cập nhật lại context với file mới
    setTkbAllTeachers(prev => {
      const updated = {
        ...prev,
        [newDocId]: tkbState,
      };
      //console.log("🔄 Context tkbAllTeachers sau khi sao chép:", updated);
      return updated;
    });

    // Chuyển trạng thái sang file mới
    setCurrentDocId(newDocId);
    setOpenFileName(newDocId);

    //console.log("✅ SaveAs - Đã sao chép và mở file mới thành công!");
  } catch (err) {
    console.error("❌ Lỗi khi sao chép TKB:", err);
    alert("Sao chép thất bại! Xem console để biết chi tiết.");
  }
};

//Truyền sang App.jsx

useEffect(() => {
  if (setTuDongSaveHandler) {
    setTuDongSaveHandler(() => handleSave); // ✅ dùng arrow để giữ đúng scope
  }
}, [setTuDongSaveHandler, currentDocId, tkbState, tkb]);

useEffect(() => {
  if (setTuDongSaveAsHandler) {
    setTuDongSaveAsHandler(() => handleSaveAs);
  }
}, [setTuDongSaveAsHandler, tkbState]);

const [openFileDialog, setOpenFileDialog] = useState(false);
const [tkbFiles, setTkbFiles] = useState([]);
const [loadingFiles, setLoadingFiles] = useState(false);
const [fileLoadProgress, setFileLoadProgress] = useState(0); // thêm
const [selectedFileId, setSelectedFileId] = useState(null);

// 🔹 Reset ô nhập khi mở hộp thoại
useEffect(() => {
  if (saveModalOpen) {
    setNewDocName("");
  }
}, [saveModalOpen]);

const normalizeTkb = (loadedTkb, teachers, days) => {
  const normalized = {};

  for (const gv of teachers) {
    const gvId = gv.id;
    normalized[gvId] = {};
    for (const day of days) {
      const daySchedule = loadedTkb?.[gvId]?.[day] || {};
      normalized[gvId][day] = {
        morning: Array(4).fill(null).map((_, i) => daySchedule.morning?.[i] || null),
        afternoon: Array(3).fill(null).map((_, i) => daySchedule.afternoon?.[i] || null),
      };
    }
  }

  return normalized;
};

function calculateGvSummaryFromTkb(tkbData, teachersList, assignmentsMap, phanCongMap) {
  const result = {};

  const normalize = str => (String(str || "").trim().toLowerCase());

  for (const gv of teachersList) {
    const gvId = gv.id;
    const planned = assignmentsMap[gvId] || {};       // { mon: [lop,...], ... }
    const phan = phanCongMap[gvId] || {};             // { mon: { lop: requiredCount } }

    let totalNeeded = 0;
    let assignedCount = 0;
    const assignedPerPair = {}; // key: "lop|mon_norm" -> count

    // 1) tính tổng số tiết cần (dựa trên phanCongGVs)
    for (const mon of Object.keys(planned)) {
      for (const lop of planned[mon]) {
        const need = Number(phan[mon]?.[lop] || 0);
        totalNeeded += need;
      }
    }

    // 2) đếm số tiết thực tế đã xếp trong tkbData (dùng dữ liệu vừa load)
    const gvTkb = tkbData?.[gvId] || {};
    for (const day of Object.keys(gvTkb)) {
      for (const session of ["morning", "afternoon"]) {
        const arr = gvTkb[day]?.[session] || [];
        if (!Array.isArray(arr)) continue;
        arr.forEach(period => {
          if (!period || !period.class || !period.subject) return;
          const lop = String(period.class).trim();
          const mon = normalize(period.subject);
          const key = `${lop}|${mon}`;
          assignedPerPair[key] = (assignedPerPair[key] || 0) + 1;
          assignedCount += 1;
        });
      }
    }

    // 3) phát hiện các lớp còn thiếu (failedLops)
    const failedLops = [];
    for (const mon of Object.keys(planned)) {
      const monNorm = normalize(mon);
      for (const lop of planned[mon]) {
        const need = Number(phan[mon]?.[lop] || 0);
        const got = assignedPerPair[`${lop}|${monNorm}`] || 0;
        if (got < need) {
          const missing = need - got;
          // Ghi tên lớp (nếu muốn hiển thị số tiết thiếu, đổi chuỗi bên dưới)
          failedLops.push(missing === 1 ? lop : `${lop} x${missing}`);
        }
      }
    }

    result[gvId] = {
      name: gv.name || gvId,
      total: totalNeeded,
      assigned: assignedCount,
      failedLops
    };
  }

  return result;
}

const ROW_HEIGHT = 26; // chiều cao hàng (px)

return (
  // Nền xanh toàn trang
  <Box sx={{ minHeight: "100vh", backgroundColor: "#e3f2fd", p: 2, mt: 2 }}>
    {/* Card lớn chứa tất cả */}
    <Paper
    sx={{
      p: 3,
      borderRadius: 3,
      boxShadow: 4,
      width: 1300,  // giữ nguyên kích thước desktop
      mx: "auto",
    }}
  >
      {loadingFiles && (
        <Box sx={{ width: "50%", maxWidth: 120, mt: 1, mb: 1, mx: "auto" }}>
          <LinearProgress
            variant="indeterminate" // hoặc determinate nếu bạn tính % tải
            sx={{ height: 3, borderRadius: 3 }}
          />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, textAlign: "center" }}
          >
            Đang tải danh sách file...
          </Typography>
        </Box>
      )}

      {/* Nội dung gốc */}
      <Box sx={{ p: 2, mt: -1 }}>
        <Typography
          variant="h5"
          align="center"
          fontWeight="bold"
          gutterBottom
          sx={{ color: "#1976d2" }}
        >
          XẾP THỜI KHÓA BIỂU TOÀN TRƯỜNG
        </Typography>

        {/* Nút chức năng chính */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mt: 2,
            mb: 3,
            position: "relative", // dùng position relative để đặt checkbox tuyệt đối
          }}
        >
          {/* Nút Thực hiện vẫn căn giữa */}
          <Box sx={{ mx: "auto" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleAutoSchedule}
              disabled={autoScheduleProgress > 0 && autoScheduleProgress < 100}
            >
              Thực hiện
            </Button>
            <IconButton
              //color="secondary"
              color="primary"
              onClick={handleCheckScheduleClick}
              title="Kiểm tra trùng tiết"
            >
              <CheckCircleIcon />
            </IconButton>
              </Box>

              {/* Checkbox/Toggle căn phải */}
              <Box sx={{ position: "absolute", right: 0, mt: 4 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showStats}
                      onChange={(e) => setShowStats(e.target.checked)}
                    />
                  }
                  label="Hiển thị thống kê"
                />
              </Box>
            </Box>
        {/* Thanh tiến trình */}
        {autoScheduleProgress > 0 && autoScheduleProgress < 100 && (
          <Box sx={{ width: "20%", mx: "auto", mt: 2, mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={autoScheduleProgress}
              sx={{ height: 3, borderRadius: 3 }}
            />
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              {`Đang xếp TKB: ${autoScheduleProgress}%`}
            </Typography>
          </Box>
        )}

        <Box sx={{ borderBottom: "3px solid #1976d2", width: "100%", mt: 1, mb: 1 }} />

        {/* Hiển thị cảnh báo trùng tiết */}
        {showConflicts && (
          <Paper
            sx={{
              maxHeight: 300,
              overflowY: "auto",
              p: 2,
              width: "30%", 
              bgcolor: "#fff3e0",
              mx: "auto",
              mb: 2,
            }}
          >
            {/* Tiêu đề */}
            <Typography
              variant="subtitle2"
              sx={{
                mb: 2,
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: 14,
                color: '#ff9800', // cam
              }}
            >
              KIỂM TRA XUNG ĐỘT
            </Typography>

            {/* Nội dung xung đột */}
            {conflicts.length === 1 && conflicts[0] === "✅ Không phát hiện trùng tiết trong TKB" ? (
              <Typography
                variant="body2"
                sx={{ fontWeight: 'bold', color: 'success.main', textAlign: 'left', mb: 2 }}
              >
                ✅ Không phát hiện trùng tiết trong TKB
              </Typography>
            ) : (
              conflicts.map((c, i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  {/* Dòng lớp + tiết với icon ❌ */}
                  <Typography 
                    variant="body2"
                    sx={{ fontWeight: 'bold', mb: 1, color: 'error.main', textAlign: 'left' }}
                  >
                    ❌ {c.split("\n")[0]}  {/* chỉ hiển thị dòng đầu, không lặp “có … GV cùng dạy” */}
                  </Typography>
                  {/* Danh sách GV */}
                  {c.split("\n").slice(1).map((gvLine, j) => (
                    <Typography
                      key={j}
                      variant="body2"
                      sx={{ ml: 2, mb: 0.5, textAlign: 'left' }}
                    >
                      {gvLine}
                    </Typography>
                  ))}
                </Box>
              ))
            )}

            {/* Nút Đóng dưới cùng */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <Button 
                variant="contained"
                size="small"
                onClick={() => setShowConflicts(false)}
                sx={{
                  backgroundColor: '#f57c00',
                  color: 'white',
                  textTransform: 'none',
                  px: 2,          // padding ngang
                  py: 0.5,        // giảm padding dọc => giảm chiều cao
                  fontSize: '0.8rem', // giảm cỡ chữ
                  '&:hover': {
                    backgroundColor: '#ef6c00'
                  }
                }}
              >
                Đóng
              </Button>
            </Box>
          </Paper>
        )}


        {/* Bố cục chia đôi */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          {/* Cột trái: Danh sách TKB giáo viên */}
          <Box sx={{ flex: 3 }}>
            {Object.values(sortTeachersBySubject(teachers, gvSummary)).flat().map((gv, index) => (
              <Paper key={gv.id} sx={{ mb: 3, p: 2, maxWidth: '800px', mx: 'auto' }}>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1
                  }}>
                    <Typography variant="h6" sx={{
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      fontSize: '16px'
                    }}>
                      {index + 1}. {gv.name}
                    </Typography>

                    {visibleErrors[gv.id] && scheduleErrors[gv.id]?.length > 0 && (
                      <Box sx={{
                        backgroundColor: '#ffe6e6',
                        color: 'red',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: 500,
                        maxWidth: '700px',
                        mx: 'auto',
                        textAlign: 'center'
                      }}>
                        {scheduleErrors[gv.id].join(', ')}
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Bảng TKB */}
                <Box sx={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      maxWidth: '700px',
                      borderCollapse: 'collapse',
                      textAlign: 'center',
                      margin: '0 auto'
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ border: '1px solid #ccc', backgroundColor: '#f5f5f5', height: CELL_HEIGHT }}>
                          Buổi/Tiết
                        </th>
                        {days.map(day => (
                          <th key={day} style={{ border: '1px solid #ccc', backgroundColor: '#e3f2fd', height: CELL_HEIGHT }}>
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Buổi sáng */}
                      {Array.from({ length: 4 }).map((_, i) => {
                        const session = "morning";
                        return (
                          <tr key={`morning-${i}`}>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                backgroundColor: "#fff3e0",
                                height: CELL_HEIGHT,
                              }}
                            >
                              Sáng {i + 1}
                            </td>
                            {days.map((day) => {
                              const tiet = tkbState[gv.id]?.[day]?.[session]?.[i];
                              const options = [];
                              Object.entries(assignments[gv.id] || {})
                                .forEach(([mon, lops]) => {
                                  lops.forEach((lop) => {
                                    const showSuffix = (gv.monDay || []).length > 1 && mon !== "Tin học";
                                    const vtMon = vietTatMon[mon] || mon;
                                    const label = showSuffix ? `${lop} (${vtMon})` : lop;
                                    const value = `${lop}|${mon}`;
                                    if (!options.find((o) => o.value === value)) {
                                      options.push({ value, label });
                                    }
                                  });
                                });

                              options.sort((a, b) => {
                                const [lopA, monA] = a.value.split("|");
                                const [lopB, monB] = b.value.split("|");
                                const cmpLop = lopA.localeCompare(lopB, "vi", { numeric: true });
                                if (cmpLop !== 0) return cmpLop;
                                return monA.localeCompare(monB, "vi");
                              });

                              return (
                                <td
                                  key={`${day}-${session}-${i}`}
                                  style={{ border: "1px solid #ccc", height: CELL_HEIGHT }}
                                >
                                  {isEditing ? (
                                    <select
                                      value={tiet ? `${tiet.class}|${tiet.subject}` : ""}
                                      onChange={(e) => {
                                        const [lop, mon] = e.target.value.split("|");
                                        handleChangeTiet(gv.id, day, session, i, { class: lop, subject: mon });
                                      }}
                                      style={{
                                        width: "100%",
                                        height: CELL_HEIGHT,
                                        border: "none",
                                        background: "transparent",
                                        fontFamily: "'Arial', sans-serif",  // <-- đồng bộ font
                                        fontSize: "14px",                    // <-- đồng bộ cỡ chữ
                                        textAlign: "center",
                                        appearance: "none",
                                        WebkitAppearance: "none",
                                        MozAppearance: "none",
                                        position: "relative",
                                      }}
                                      className="custom-select"
                                    >
                                      <option value=""></option>
                                      {options.map((o) => (
                                        <option key={o.value} value={o.value}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span
                                      style={{
                                        fontFamily: "'Arial', sans-serif",  // <-- cùng font
                                        fontSize: "14px",                    // <-- cùng cỡ chữ
                                        display: "block",
                                        textAlign: "center",
                                        lineHeight: `${CELL_HEIGHT}px`,      // căn giữa theo chiều dọc
                                      }}
                                    >
                                      {formatTietDisplay(gv.id, tiet, assignments, vietTatMon)}
                                    </span>
                                  )}


                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {/* Buổi chiều */}
                      {Array.from({ length: 3 }).map((_, i) => {
                        const session = "afternoon";
                        return (
                          <tr key={`afternoon-${i}`}>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                backgroundColor: "#ede7f6",
                                height: CELL_HEIGHT,
                              }}
                            >
                              Chiều {i + 1}
                            </td>
                            {days.map((day) => {
                              const tiet = tkbState[gv.id]?.[day]?.[session]?.[i];
                              const options = [];
                              Object.entries(assignments[gv.id] || {})
                                .forEach(([mon, lops]) => {
                                  lops.forEach((lop) => {
                                    const showSuffix = (gv.monDay || []).length > 1 && mon !== "Tin học";
                                    const vtMon = vietTatMon[mon] || mon;
                                    const label = showSuffix ? `${lop} (${vtMon})` : lop;
                                    const value = `${lop}|${mon}`;
                                    if (!options.find((o) => o.value === value)) {
                                      options.push({ value, label });
                                    }
                                  });
                                });

                              options.sort((a, b) => {
                                const [lopA, monA] = a.value.split("|");
                                const [lopB, monB] = b.value.split("|");
                                const cmpLop = lopA.localeCompare(lopB, "vi", { numeric: true });
                                if (cmpLop !== 0) return cmpLop;
                                return monA.localeCompare(monB, "vi");
                              });

                              return (
                                <td
                                  key={`${day}-${session}-${i}`}
                                  style={{ border: "1px solid #ccc", height: CELL_HEIGHT }}
                                >
                                  {isEditing ? (
                                    <select
                                      value={tiet ? `${tiet.class}|${tiet.subject}` : ""}
                                      onChange={(e) => {
                                        const [lop, mon] = e.target.value.split("|");
                                        handleChangeTiet(gv.id, day, session, i, { class: lop, subject: mon });
                                      }}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        lineHeight: `${CELL_HEIGHT}px`,
                                        border: "none",
                                        background: "transparent",
                                        fontFamily: "'Arial', sans-serif",  // <--- đặt font giống phần hiển thị
                                        fontSize: "14px",                    // <--- đặt cỡ chữ giống phần hiển thị
                                        textAlign: "center",
                                        appearance: "none",
                                        WebkitAppearance: "none",
                                        MozAppearance: "none",
                                        position: "relative",
                                        backgroundImage: "none",
                                      }}
                                      className="custom-select"
                                    >
                                      <option value=""></option>
                                      {options.map((o) => (
                                        <option key={o.value} value={o.value}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span
                                      style={{
                                        fontFamily: "'Arial', sans-serif",  // cùng font
                                        fontSize: "14px",                    // cùng cỡ chữ
                                        textAlign: "center",
                                        display: "block",
                                        lineHeight: `${CELL_HEIGHT}px`,      // căn giữa theo chiều dọc
                                      }}
                                    >
                                      {formatTietDisplay(gv.id, tiet, assignments, vietTatMon)}
                                    </span>
                                  )}

                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
              </Paper>
            ))}
          </Box>

          {/* Cột phải: Bảng thống kê */}
          {showStats && (
          <Box sx={{ flex: 1.2, maxWidth: 320 }}>
            <Paper sx={{ p: 2, overflowX: 'auto' }}>
              <Typography
                variant="h6"
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 2, 
                  fontSize: '1rem',
                  color: '#e91e63'  // <-- màu hồng
                }}
              >
                Thống kê số tiết
              </Typography>

              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'center',
                  fontSize: '0.9rem'
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        border: '1px solid #ccc',
                        backgroundColor: '#f5f5f5',
                        minWidth: 40,
                        height: ROW_HEIGHT // <-- đặt chiều cao
                      }}
                    >
                      STT
                    </th>
                    <th
                      style={{
                        border: '1px solid #ccc',
                        backgroundColor: '#f5f5f5',
                        minWidth: 80,
                        height: ROW_HEIGHT
                      }}
                    >
                      Tên
                    </th>
                    <th
                      style={{
                        border: '1px solid #ccc',
                        backgroundColor: '#f5f5f5',
                        minWidth: 60,
                        height: ROW_HEIGHT
                      }}
                    >
                      Đã xếp
                    </th>
                    <th
                      style={{
                        border: '1px solid #ccc',
                        backgroundColor: '#f5f5f5',
                        minWidth: 80,
                        height: ROW_HEIGHT
                      }}
                    >
                      Hoàn thành
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(sortTeachersBySubject(teachers, gvSummary))
                    .flat()
                    .map((gv, index) => {
                      const summary = gvSummary[gv.id] || {};
                      const notAssigned = (summary.total || 0) - (summary.assigned || 0);
                      const shortName = gv.name ? gv.name.trim().split(/\s+/).pop() : "";

                      return (
                        <tr key={gv.id}>
                          <td style={{ border: '1px solid #ccc', height: ROW_HEIGHT }}>{index + 1}</td>
                          <td
                            style={{
                              border: '1px solid #ccc',
                              textAlign: 'left',
                              paddingLeft: 6,
                              height: ROW_HEIGHT
                            }}
                          >
                            {shortName}
                          </td>
                          <td style={{ border: '1px solid #ccc', color: 'green', height: ROW_HEIGHT }}>
                            {summary.assigned || ""}
                          </td>
                          <td
                            style={{
                              border: '1px solid #ccc',
                              color: notAssigned > 0 ? 'red' : 'green',
                              height: ROW_HEIGHT
                            }}
                          >
                            {notAssigned > 0
                              ? `${notAssigned} (${summary.failedLops?.join(", ")})`
                              : summary.assigned > 0
                                ? "✔" // hiển thị tick nếu đã xếp đủ và đã xếp ít nhất 1 tiết
                                : ""   // không thêm tick nếu chưa xếp tiết nào
                            }
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Paper>
          </Box>
          )}
        </Box>
      </Box>
    </Paper>
  </Box>
);

}