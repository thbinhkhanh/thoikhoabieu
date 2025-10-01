import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Select,
  MenuItem,
  IconButton,
  Button,
  Card,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItemButton,
  ListItemText
} from '@mui/material';

import { getDocs, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ScheduleContext } from '../contexts/ScheduleContext'; // cập nhật đường dẫn nếu cần

import DeleteIcon from '@mui/icons-material/Delete';
//import SaveIcon from '@mui/icons-material/Save';
//import SaveAsIcon from "@mui/icons-material/SaveAs";
//import FolderOpenIcon from "@mui/icons-material/FolderOpen";
//import SwapHorizIcon from "@mui/icons-material/SwapHoriz"; // icon chuyển đổi
import { useOpenFile } from "../contexts/OpenFileContext"; // đường dẫn tùy bạn

import { useGVCN } from "../contexts/ContextGVCN"; // đường dẫn tùy theo bạn

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

//export default function XepTKBToanTruong({ onOpenFile, setThuCongSaveHandler }) {
export default function XepTKBToanTruong({ onOpenFile, setThuCongSaveHandler, setThuCongSaveAsHandler }) {

  const [teachers, setTeachers] = useState([]);
  const [tkb, setTkb] = useState({}); // { morning: {period: [...]}, afternoon: {...} }
  const [inlineConflicts, setInlineConflicts] = useState({});
  const [changedCells, setChangedCells] = useState([]);
  const [vietTatMonMapAll, setVietTatMonMapAll] = useState({});

  // --- Thanh tiến trình tải dữ liệu ---
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadingProgressData, setLoadingProgressData] = useState(0);

  // --- Thanh tiến trình lưu dữ liệu ---
  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);
  const tkbRef = useRef({});
  const totalPeriodsRef = useRef({});

  // Document hiện tại
//const [currentDocId, setCurrentDocId] = useState(null);

// Modal Save / SaveAs
const [saveModalOpen, setSaveModalOpen] = useState(false);
const [saveMode, setSaveMode] = useState(""); // "save" | "saveAs"
const [newDocName, setNewDocName] = useState("");

// Thanh tiến trình save/load
const [saving, setSaving] = useState(false);
const [saveProgress, setSaveProgress] = useState(0);
const [loadingProgress, setLoadingProgress] = useState(0);

const [openFileHandler, setOpenFileHandler] = useState(null);
const { setOpenFileName } = useOpenFile(); // 🔹 lấy setter từ context

const [teacherStatsList, setTeacherStatsList] = useState([]);
const { contextSchedule, setContextSchedule, contextRows } = useGVCN();

// lock để chống double-add trong StrictMode/dev
const addLockRef = useRef({});

  // ✅ Lấy dữ liệu từ context
const {
  tkbAllTeachers,
  setTkbAllTeachers,
  selectedDay,
  setSelectedDay,
  totalPeriodsPerTeacher,
  setTotalPeriodsPerTeacher,
  currentDocId,
  setCurrentDocId
} = useContext(ScheduleContext);

useEffect(() => {
  const fetchAllData = async () => {
    //console.log("🚀 useEffect gọi fetchAllData với selectedDay =", selectedDay);
    //console.log("📂 currentDocId =", currentDocId);
    //console.log("📦 tkbAllTeachers =", tkbAllTeachers);
    //console.log("🔍 cached =", tkbAllTeachers[currentDocId]?.[selectedDay]);

    setIsLoadingData(true);
    setLoadingProgressData(0);

    // 🔄 Luôn lấy thông tin giáo viên từ PHANCONG
    const snapshot = await getDocs(collection(db, "PHANCONG_2025-2026"));
    const newTeachers = [];
    const vietTatMonMapAll = {};
    const teacherInfoMap = {};

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data() || {};
      const id = docSnap.id;
      const hoTen = data.hoTen || '';
      const monDay = Array.isArray(data.monDay) ? data.monDay : [];
      const phanCong = typeof data.phanCong === 'object' ? data.phanCong : {};
      const vietTatMonMap = typeof data.vietTatMon === 'object' ? data.vietTatMon : {};
      vietTatMonMapAll[id] = vietTatMonMap;

      const classToSubjects = {};
      Object.entries(phanCong).forEach(([mon, value]) => {
        const abbr = vietTatMonMap[mon] || mon;
        const pushToClass = (lop) => {
          if (!classToSubjects[lop]) classToSubjects[lop] = [];
          if (!classToSubjects[lop].some(s => s.mon === mon)) {
            classToSubjects[lop].push({ mon, vietTatMon: abbr });
          }
        };

        if (Array.isArray(value)) {
          value.forEach(pushToClass);
        } else if (value && typeof value === "object") {
          Object.values(value).forEach(arr => {
            if (Array.isArray(arr)) arr.forEach(pushToClass);
          });
        }
      });

      const lopDay = Object.keys(classToSubjects);
      const teacher = { id, name: hoTen, monDay, lopDay, classToSubjects };
      newTeachers.push(teacher);
      teacherInfoMap[id] = teacher;
    });

    const fileData = tkbAllTeachers[currentDocId];
    if (fileData) {
      const tkbByPeriod = { morning: {}, afternoon: {} };
      const totalPeriods = {};

      Object.entries(fileData).forEach(([gvId, scheduleByDay]) => {
        const daySchedule = scheduleByDay[selectedDay];
        if (!daySchedule) return;

        const teacherInfo = teacherInfoMap[gvId];
        const teacherName = teacherInfo?.name || '';
        const monDay = teacherInfo?.monDay || [];

        ['morning', 'afternoon'].forEach(session => {
          const periods = daySchedule[session] || [];
          periods.forEach((value, idx) => {
            if (!value) return;
            const period = idx + 1;
            if (!tkbByPeriod[session][period]) tkbByPeriod[session][period] = [];
            tkbByPeriod[session][period].push({
              ...value,
              gvId,
              name: teacherName,
              class: value.class,
              subject: value.subject,
              monDay
            });
          });
        });

        totalPeriods[gvId] = [...daySchedule.morning, ...daySchedule.afternoon].filter(Boolean).length;
      });

      //console.log("✅ Dựng lại tkbByPeriod từ context:", tkbByPeriod);

      setTeachers(newTeachers);
      setTkb(tkbByPeriod);
      setTotalPeriodsPerTeacher(totalPeriods);
      setIsLoadingData(false);
      return;
    }

    // ❌ Không có cached → tạo lịch rỗng
    const teacherSchedules = {};
    newTeachers.forEach(t => {
      teacherSchedules[t.id] = {};
    });

    const totalPeriods = {};
    const tkbByPeriod = { morning: {}, afternoon: {} };

    Object.entries(teacherSchedules).forEach(([gvId, schedule]) => {
      const daySchedule = schedule[selectedDay];
      if (!daySchedule) return;

      const teacherInfo = teacherInfoMap[gvId];
      const teacherName = teacherInfo?.name || '';
      const monDay = teacherInfo?.monDay || [];

      ['morning', 'afternoon'].forEach(session => {
        const periods = daySchedule[session] || {};
        Object.entries(periods).forEach(([period, arr]) => {
          if (!tkbByPeriod[session][period]) tkbByPeriod[session][period] = [];
          arr.forEach(item => {
            tkbByPeriod[session][period].push({
              ...item,
              name: teacherName,
              monDay
            });
          });
        });
      });

      let total = 0;
      Object.values(daySchedule).forEach(sessionData => {
        Object.values(sessionData || {}).forEach(arr => {
          total += Array.isArray(arr) ? arr.length : 0;
        });
      });
      totalPeriods[gvId] = total;
    });

    setTeachers(newTeachers);
    setTkb(tkbByPeriod);
    setTotalPeriodsPerTeacher(totalPeriods);
    setIsLoadingData(false);

    setTkbAllTeachers(prev => ({
      ...prev,
      [currentDocId]: {
        ...prev[currentDocId],
        [selectedDay]: {
          teachers: newTeachers,
          tkbByPeriod,
          totalPeriods
        }
      }
    }));
  };

  fetchAllData();
}, [selectedDay, currentDocId]);

const getTenCuoi = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/);
  return parts[parts.length - 1] || '';
};

const handleAddRow = (session, period) => {
  const key = `${session}:${period}`;
  if (addLockRef.current[key]) return;
  addLockRef.current[key] = true;

  let addedRow = null;

  setTkb(prev => {
    const prevSession = prev[session] || {};
    const rows = prevSession[period] || [];
    const last = rows[rows.length - 1];
    if (last && !last.gvId && !last.class && !last.subject) {
      addLockRef.current[key] = false;
      return prev;
    }

    addedRow = { gvId: '', class: '', subject: '' };
    const nextRows = rows.concat(addedRow);

    const updated = {
      ...prev,
      [session]: {
        ...prevSession,
        [period]: nextRows
      }
    };
    tkbRef.current = updated;
    return updated;
  });

  setTimeout(() => {
    addLockRef.current[key] = false;

    if (addedRow?.gvId) {
      setTotalPeriodsPerTeacher(prev => {
        const updated = {
          ...prev,
          [addedRow.gvId]: (prev[addedRow.gvId] || 0) + 1
        };
        totalPeriodsRef.current = updated;
        return updated;
      });
    }

    setTkbAllTeachers(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        tkbByPeriod: tkbRef.current,
        totalPeriods: totalPeriodsRef.current
      }
    }));
  }, 0);
};

const updateTeacherStats = (gvId) => {
  const scheduleByDay = tkbAllTeachers[currentDocId]?.[gvId];
  if (!scheduleByDay) return;

  const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
  const weeklyData = {};
  let total = 0;

  daysOfWeek.forEach(day => {
    const daySchedule = scheduleByDay?.[day];
    if (!daySchedule) {
      weeklyData[day] = 0;
      return;
    }

    const morning = daySchedule.morning || [];
    const afternoon = daySchedule.afternoon || [];
    const count = [...morning, ...afternoon].filter(Boolean).length;

    weeklyData[day] = count;
    total += count;
  });

  // ✅ Cập nhật lại thống kê cho giáo viên đó
  setTeacherStatsList(prev =>
    prev.map(t =>
      t.id === gvId
        ? {
            ...t,
            total,
            weeklyBreakdown: weeklyData
          }
        : t
    )
  );
};

const handleChangeRow = (session, period, index, field, value) => {
  let oldRow = null;
  let newRow = null;

  setTkb(prev => {
    const prevSession = prev[session] || {};
    const rows = (prevSession[period] || []).slice();
    if (!rows[index]) rows[index] = { gvId: '', class: '', subject: '' };

    oldRow = { ...rows[index] };

    if (field === 'gvId') {
      rows[index] = { ...rows[index], gvId: value || '', class: '', subject: '' };
    } else if (field === 'class') {
      if (!value) {
        rows[index] = { ...rows[index], class: '', subject: '' };
      } else if (String(value).includes('|')) {
        const [lop, mon] = String(value).split('|');
        rows[index] = { ...rows[index], class: lop || '', subject: mon || '' };
      } else {
        rows[index] = { ...rows[index], class: value, subject: '' };
      }
    } else {
      rows[index] = { ...rows[index], [field]: value };
    }

    newRow = rows[index];

    checkInlineConflict(session, period, index, newRow);

    if (newRow.gvId && newRow.class) {
      setChangedCells(prev => {
        const index = prev.findIndex(c =>
          c.gvId === newRow.gvId &&
          c.day === selectedDay &&
          c.session === session &&
          c.period === period
        );

        const newEntry = {
          gvId: newRow.gvId,
          day: selectedDay,
          session,
          period,
          className: `${newRow.class} (${newRow.subject})`
        };

        if (index !== -1) {
          const updated = [...prev];
          updated[index] = newEntry;
          return updated;
        }

        return [...prev, newEntry];
      });
    }

    const updated = {
      ...prev,
      [session]: {
        ...prevSession,
        [period]: rows
      }
    };
    tkbRef.current = updated;
    return updated;
  });

  setTimeout(() => {
    const oldId = oldRow?.gvId;
    const newId = newRow?.gvId;

    if (oldId !== newId) {
      setTotalPeriodsPerTeacher(prev => {
        const updated = { ...prev };
        if (oldId && updated[oldId]) updated[oldId] = Math.max(updated[oldId] - 1, 0);
        if (newId) updated[newId] = (updated[newId] || 0) + 1;
        totalPeriodsRef.current = updated;
        return updated;
      });
    }

    // ✅ Cập nhật lại dữ liệu vào đúng vị trí trong tkbAllTeachers
    setTkbAllTeachers(prev => ({
      ...prev,
      [currentDocId]: {
        ...prev[currentDocId],
        [selectedDay]: {
          ...prev[currentDocId]?.[selectedDay],
          tkbByPeriod: tkbRef.current,
          totalPeriods: totalPeriodsRef.current
        }
      }
    }));

    // ✅ Gọi cập nhật thống kê cho giáo viên vừa thay đổi
    if (newId) {
      updateTeacherStats(newId);
    }
    if (oldId && oldId !== newId) {
      updateTeacherStats(oldId);
    }
  }, 0);
};

const handleRemoveRow = (session, period, index) => {
  const row = tkb[session]?.[period]?.[index];
  if (!row) return;

  if (row.gvId || row.class || row.subject) {
    const confirmDelete = window.confirm('Bạn có chắc muốn xóa tiết này không?');
    if (!confirmDelete) return;
  }

  const gvIdToRemove = row.gvId;

  // --- 1️⃣ Cập nhật UI ---
  setTkb(prev => {
    const prevSession = prev[session] || {};
    const rows = (prevSession[period] || []).slice();
    rows.splice(index, 1);
    const updated = {
      ...prev,
      [session]: {
        ...prevSession,
        [period]: rows
      }
    };
    tkbRef.current = updated;
    return updated;
  });

  setTotalPeriodsPerTeacher(prev => {
    const updated = { ...prev };
    if (gvIdToRemove && updated[gvIdToRemove]) {
      updated[gvIdToRemove] = Math.max(updated[gvIdToRemove] - 1, 0);
    }
    totalPeriodsRef.current = updated;
    return updated;
  });

  // --- 2️⃣ Ghi nhận thay đổi để lưu sau ---
  if (gvIdToRemove) {
    setChangedCells(prev => [
      ...prev,
      {
        gvId: gvIdToRemove,
        day: selectedDay,
        session,
        period,
        className: null // đánh dấu là tiết bị xóa
      }
    ]);
  }
};

const checkInlineConflict = (session, period, index, newRow) => {
  const conflicts = {};
  const { gvId, class: lop } = newRow;
  if (!gvId || !lop) return; // nếu chưa chọn GV/lớp -> không kiểm tra

  Object.entries(tkb[session] || {}).forEach(([p, rows]) => {
    rows.forEach((row, i) => {
      if (i === index && p === String(period)) return; // bỏ chính ô hiện tại

      const samePeriod = p === String(period);

      // Nếu cùng tiết và cùng giáo viên nhưng khác lớp
      if (samePeriod && row.gvId === gvId && row.class !== lop) {
        const lopKhac = row.class;
        conflicts[index] = `GV ${getTenCuoi(teachers.find(t => t.id === gvId)?.name || gvId)} đã dạy lớp ${lopKhac} tại tiết ${period}`;
      }

      // Nếu cùng tiết và cùng lớp nhưng khác giáo viên
      if (samePeriod && row.class === lop && row.gvId !== gvId) {
        const gvName = teachers.find(t => t.id === row.gvId)?.name || row.gvId;
        const tenCuoi = getTenCuoi(gvName);
        conflicts[index] = `Trùng tiết với ${tenCuoi} (${lop} - tiết ${period})`;
      }
    });
  });

  setInlineConflicts(prev => ({
    ...prev,
    [session]: {
      ...(prev[session] || {}),
      [period]: conflicts
    }
  }));
};

const monToAbbr = {
  "Tin học": "TH",
  "Công nghệ": "CN",
  // thêm các môn khác nếu cần
};

const teacherColors = {
  'Bình':   '#fff79f',
  'Cang':   '#cceacc',
  'Đào':    '#f9c6d8',
  'Giang':  '#a3dffc',
  'Hồng':   '#f698bd',
  'Lam':    '#a6d4fc',
  'Lê':     '#d6c7e4',
  'Mai':    '#ffe68c',
  'Phong':  '#b7e3b9',
  'Phúc':   '#f1aaaa',
  'Phương': '#d6a7e1',
  'Thái':   '#ffd9b3',
  'Thảo':   '#d8edb7',
  'Thắm':   '#f698bd',
  'Thi':    '#7fbaf8',
  'Trí':    '#ac97d6',
};

const teacherStats = teachers
  .filter(t => t.id && tkbAllTeachers[currentDocId]?.[t.id]) // loại bỏ giáo viên lỗi hoặc không có TKB
  .map(t => {
    const scheduleByDay = tkbAllTeachers[currentDocId][t.id];
    const weeklyData = {};
    const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
    let total = 0;

    daysOfWeek.forEach(day => {
      const daySchedule = scheduleByDay?.[day];
      //console.log(`🔍 ${day} của ${t.id}:`, daySchedule);

      if (!daySchedule) {
        weeklyData[day] = 0;
        return;
      }

      const morning = daySchedule.morning || [];
      const afternoon = daySchedule.afternoon || [];
      const count = [...morning, ...afternoon].filter(Boolean).length;

      weeklyData[day] = count;
      total += count;
    });

    const subjects = t.monDay.join(', ');

    return {
      id: t.id,
      name: getTenCuoi(t.name),
      subjects,
      total,
      weeklyBreakdown: weeklyData
    };
  });

// 🔹 Chuẩn hóa dữ liệu trước khi lưu
// 🔹 Chuyển đổi dữ liệu thô từ Firestore sang cấu trúc chuẩn
// 🔹 State bổ sung
const [pendingTkb, setPendingTkb] = useState(null);

// 🔹 Chuẩn hóa dữ liệu
const transformTkbForSave = (allTeachersRaw) => {
  const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
  const result = {};

  Object.entries(allTeachersRaw || {}).forEach(([gvId, gvData]) => {
    const { monDay = [], vietTatMon = {}, schedule = {} } = gvData || {};
    result[gvId] = {};

    days.forEach((day) => {
      result[gvId][day] = { morning: [], afternoon: [] };

      [
        { key: "SÁNG", timeKey: "morning", maxPeriods: 5 },
        { key: "CHIỀU", timeKey: "afternoon", maxPeriods: 4 },
      ].forEach(({ key, timeKey, maxPeriods }) => {
        const periodsArray = Array.isArray(schedule[key]?.[day])
          ? schedule[key][day]
          : [];

        for (let i = 0; i < maxPeriods; i++) {
          const val = periodsArray[i] || "";
          if (!val || String(val).trim() === "") {
            result[gvId][day][timeKey].push(null);
            continue;
          }

          // "1.4 (TH)" => class="1.4", abbr="TH"
          const s = String(val);
          const match = s.match(/^(.+?)\s*\(([^)]+)\)$/);
          const cls = match ? match[1].trim() : s.trim();
          const abbr = match ? match[2] : null;

          // map abbr -> môn học
          let subject = "";
          if (abbr && Object.keys(vietTatMon).length > 0) {
            subject =
              Object.entries(vietTatMon).find(([mon, a]) => a === abbr)?.[0] ||
              abbr;
          } else {
            subject = monDay.length === 1 ? monDay[0] : "";
          }

          result[gvId][day][timeKey].push({
            class: cls,
            period: i + 1,
            subject,
          });
        }
      });
    });
  });

  return result;
};

// 🔹 Xử lý nút Save (icon)
const handleSave = async () => {
  if (!changedCells.length) return;

  try {
    setIsSaving(true);

    const allGVs = [...new Set(changedCells.map(c => c.gvId))];
    const updatedGVs = {};

    for (const gvId of allGVs) {
      const docRef = doc(db, "TKB_GVBM", currentDocId);
      const docSnap = await getDoc(docRef);
      const oldData = docSnap.exists() ? docSnap.data() : { tkb: {} };
      const oldTkbGV = oldData.tkb?.[gvId] || {};
      const newTkbGV = { ...oldTkbGV };

      const gvChanges = changedCells.filter(c => c.gvId === gvId);

      gvChanges.forEach(change => {
        const { day, session, period, className } = change;
        const sessionKey = session === "morning" ? "morning" : "afternoon";

        if (!newTkbGV[day]) {
          newTkbGV[day] = {
            morning: Array(5).fill(null),
            afternoon: Array(4).fill(null)
          };
        }

        const maxPeriods = sessionKey === "morning" ? 5 : 4;
        if (!newTkbGV[day][sessionKey] || newTkbGV[day][sessionKey].length !== maxPeriods) {
          newTkbGV[day][sessionKey] = Array(maxPeriods)
            .fill(null)
            .map((_, i) => oldTkbGV[day]?.[sessionKey]?.[i] || null);
        }

        let cls = "", subject = "";
        if (className) {
          if (className.includes("|")) {
            const [lop, mon] = className.split("|").map(s => s.trim());
            cls = lop;
            subject = mon;
          } else {
            const match = className.match(/^(.+?)\s*\(([^)]+)\)$/);
            if (match) {
              cls = match[1].trim();
              subject = match[2].trim();
            } else {
              cls = className.trim();
              subject = "";
            }
          }
        }

        newTkbGV[day][sessionKey][period - 1] = cls ? { class: cls, period, subject } : null;
      });

      await setDoc(
        docRef,
        {
          tkb: {
            ...(oldData.tkb || {}),
            [gvId]: newTkbGV
          },
          updatedAt: new Date()
        },
        { merge: true }
      );

      updatedGVs[gvId] = newTkbGV;
    }

    setChangedCells([]);

    setTkbAllTeachers(prev => ({
      ...(prev || {}),
      [currentDocId]: {
        ...(prev?.[currentDocId] || {}),
        ...updatedGVs
      }
    }));

    setContextSchedule(prev => {
      const updated = { ...prev };
      if (!updated[currentDocId]) updated[currentDocId] = {};

      for (const gvId in updatedGVs) {
        const lop = contextRows.find(r => r.hoTen === gvId)?.lop;
        if (!lop) continue;

        updated[currentDocId][lop] ??= { SÁNG: {}, CHIỀU: {} };

        for (const day in updatedGVs[gvId]) {
          const { morning, afternoon } = updatedGVs[gvId][day];
          updated[currentDocId][lop]["SÁNG"][day] = morning;
          updated[currentDocId][lop]["CHIỀU"][day] = afternoon;
        }
      }

      return updated;
    });

    //alert("✅ Lưu thủ công thành công!");
  } catch (err) {
    console.error("❌ Lưu thất bại!", err);
    alert("Lưu thất bại! Xem console để biết chi tiết.");
  } finally {
    setIsSaving(false);
  }
};

const handleSaveAs = async (newDocId) => {
  try {
    setIsSaving(true);

    let updatedGVs = {};
    //console.log("✍️ Đang cập nhật dữ liệu từ changedCells...");

    const allGVs = [...new Set(changedCells.map(c => c.gvId))];

    for (const gvId of allGVs) {
      const oldTkbGV = tkbAllTeachers[currentDocId]?.[gvId] || {};
      const newTkbGV = {};

      // Clone sâu dữ liệu cũ
      for (const day in oldTkbGV) {
        const { morning, afternoon } = oldTkbGV[day] || {};
        newTkbGV[day] = {
          morning: Array.isArray(morning) ? [...morning] : Array(5).fill(null),
          afternoon: Array.isArray(afternoon) ? [...afternoon] : Array(4).fill(null)
        };
      }

      const gvChanges = changedCells.filter(c => c.gvId === gvId);

      gvChanges.forEach(change => {
        const { day, session, period, className } = change;
        const sessionKey = session === "morning" ? "morning" : "afternoon";
        const maxPeriods = sessionKey === "morning" ? 5 : 4;
        const periodIndex = typeof period === "number" && period >= 1 ? period - 1 : null;

        if (!newTkbGV[day]) {
          newTkbGV[day] = {
            morning: Array(5).fill(null),
            afternoon: Array(4).fill(null)
          };
        }

        if (
          periodIndex !== null &&
          periodIndex < maxPeriods &&
          Array.isArray(newTkbGV[day][sessionKey])
        ) {
          let cls = "", subject = "";
          if (className) {
            if (className.includes("|")) {
              const [lop, mon] = className.split("|").map(s => s.trim());
              cls = lop;
              subject = mon;
            } else {
              const match = className.match(/^(.+?)\s*\(([^)]+)\)$/);
              if (match) {
                cls = match[1].trim();
                subject = match[2].trim();
              } else {
                cls = className.trim();
                subject = "";
              }
            }
          }

          newTkbGV[day][sessionKey][periodIndex] = cls
            ? { class: cls, period, subject }
            : null;
        } else {
          console.warn("⛔ Period không hợp lệ hoặc vượt giới hạn:", period, change);
        }
      });

      updatedGVs[gvId] = newTkbGV;
    }

    // ✅ Cập nhật context tkbAllTeachers
    setTkbAllTeachers(prev => ({
      ...(prev || {}),
      [currentDocId]: {
        ...(prev?.[currentDocId] || {}),
        ...updatedGVs
      }
    }));

    // ✅ Cập nhật contextSchedule
    setContextSchedule(prev => {
      const updated = { ...prev };
      if (!updated[currentDocId]) updated[currentDocId] = {};

      for (const gvId in updatedGVs) {
        const lop = contextRows.find(r => r.hoTen === gvId)?.lop;
        if (!lop) continue;

        updated[currentDocId][lop] ??= { SÁNG: {}, CHIỀU: {} };

        for (const day in updatedGVs[gvId]) {
          const { morning, afternoon } = updatedGVs[gvId][day];
          updated[currentDocId][lop]["SÁNG"][day] = morning;
          updated[currentDocId][lop]["CHIỀU"][day] = afternoon;
        }
      }

      return updated;
    });

    setChangedCells([]); // ✅ reset sau khi cập nhật

    // ✅ Dùng dữ liệu vừa cập nhật để sao chép
    const sourceData = {
      tkb: {
        ...(tkbAllTeachers[currentDocId] || {}),
        ...updatedGVs
      }
    };

    const validGVs = Object.keys(sourceData.tkb || {}).filter(gvId => {
      const value = sourceData.tkb[gvId];
      const isValid =
        typeof value === "object" &&
        !gvId.startsWith("Thứ") &&
        !value?.tkbByPeriod &&
        !value?.totalPeriods;

      if (!isValid) {
        console.warn("⛔ Bỏ qua dữ liệu sai cấu trúc:", gvId, value);
      }

      return isValid;
    });

    const newTkb = {};

    for (const gvId of validGVs) {
      const oldTkbGV = sourceData.tkb[gvId];
      const copiedTkbGV = {};

      for (const day in oldTkbGV) {
        const { morning, afternoon } = oldTkbGV[day] || {};
        copiedTkbGV[day] = {
          morning: Array.isArray(morning) ? [...morning] : Array(5).fill(null),
          afternoon: Array.isArray(afternoon) ? [...afternoon] : Array(4).fill(null)
        };
      }

      newTkb[gvId] = copiedTkbGV;
    }

    const targetRef = doc(db, "TKB_GVBM", newDocId);
    await setDoc(targetRef, {
      tkb: newTkb,
      updatedAt: new Date()
    });

    setTkbAllTeachers(prev => ({
      ...(prev || {}),
      [newDocId]: newTkb
    }));

    setCurrentDocId(newDocId);
    setOpenFileName(newDocId);

    //console.log("📄 Đã chuyển sang file mới:", newDocId);
    // alert(`✅ Đã sao chép TKB sang "${newDocId}" và mở file mới thành công!`);
  } catch (err) {
    console.error("❌ Sao chép thất bại!", err);
    alert("Sao chép thất bại! Xem console để biết chi tiết.");
  } finally {
    setIsSaving(false);
  }
};

//Truyền qua App.jsx

useEffect(() => {
  if (setThuCongSaveHandler) {
    ////console.log("🔗 Gán thuCongSaveHandler = handleSave ở trang Toàn trường (thủ công)");
    setThuCongSaveHandler(() => handleSave); // ✅ arrow để luôn lấy state mới nhất
  }
}, [setThuCongSaveHandler, changedCells]);

useEffect(() => {
  if (setThuCongSaveAsHandler) {
    setThuCongSaveAsHandler(() => handleSaveAs);
  }
}, [setThuCongSaveAsHandler, tkb]);

// 🔹 Hàm ghi vào Firestore
const saveToFirestore = async (docId, data) => {
  //console.log("👉 saveToFirestore nhận:", { docId, data });

  if (!docId || typeof docId !== "string") {
    alert("⚠️ Tên tệp không hợp lệ!");
    return;
  }

  if (!data || Object.keys(data).length === 0) {
    console.error("❌ Data rỗng trong saveToFirestore:", data);
    throw new Error("❌ Không có dữ liệu để lưu!");
  }

  try {
    setSaving(true);
    setSaveProgress(0);

    const tkbToSave = structuredClone(data);
    //console.log("✅ tkbToSave sau clone:", tkbToSave);

    // mô phỏng tiến trình lưu
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      await new Promise((res) => setTimeout(res, 200));
      setSaveProgress(Math.round((i / steps) * 100));
    }

    const docRef = doc(collection(db, "TKB_GVBM"), docId);
    await setDoc(docRef, { tkb: tkbToSave, updatedAt: new Date() });

    setCurrentDocId(docId);
    setSaveModalOpen(false);
    //console.log(`✅ Đã lưu TKB vào TKB_GVBM/${docId}`);
  } catch (error) {
    console.error("Lỗi khi lưu TKB:", error);
    alert("❌ Toàn trường - Lưu thất bại. Xem console để biết chi tiết.");
  } finally {
    setSaving(false);
    setSaveProgress(0);
  }
};

const [openFileDialog, setOpenFileDialog] = useState(false);
const [tkbFiles, setTkbFiles] = useState([]);
const [loadingFiles, setLoadingFiles] = useState(false);
const [fileLoadProgress, setFileLoadProgress] = useState(0); // thêm
const [selectedFileId, setSelectedFileId] = useState(null);

//===========================
function normalizeTeacherName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseClassInfo(item, subjects, period) {
  if (!item || item.trim() === "") return null;

  const cleaned = item.trim();

  // Cho phép các định dạng: "4.1 (TH)", "4.1 TH", "4.1"
  const match = cleaned.match(/^(\d+\.\d+)(?:\s*\(?([^\(\)]+)\)?)?$/);
  if (!match) return null;

  const [, classCode, subjectHintRaw] = match;
  const subjectHint = subjectHintRaw?.trim();

  const subjectMap = {
    "TH": "Tin học",
    "CN": "Công nghệ",
    "GDTC": "GDTC",
    "DD": "Đạo đức"
  };

  let subject = subjectHint ? subjectMap[subjectHint] : null;
  if (!subject) {
    subject = subjectHint
      ? subjects.find(s => s.toLowerCase().includes(subjectHint.toLowerCase())) || subjectHint
      : subjects[0] || "Không rõ";
  }

  return { class: classCode, period, subject };
}

function convertTKB(oldData) {
  const newTKB = {};

  const maxPeriodsMorning = 5;
  const maxPeriodsAfternoon = 4;
  const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];

  Object.entries(oldData).forEach(([teacherDoc, teacherData]) => {
    const teacherName = teacherData?.hoTen || teacherDoc;
    const monDay = teacherData?.monDay || [];
    const schedule = teacherData?.schedule || {};
    const tongTiet = teacherData?.tongTiet || 0;

    const teacherKey = normalizeTeacherName(teacherName);
    newTKB[teacherKey] = {};

    weekdays.forEach((thu) => {
      newTKB[teacherKey][thu] = {
        morning: Array(maxPeriodsMorning).fill(null),
        afternoon: Array(maxPeriodsAfternoon).fill(null)
      };
    });

    [["SÁNG", "morning", maxPeriodsMorning], ["CHIỀU", "afternoon", maxPeriodsAfternoon]].forEach(([oldKey, newKey, maxPeriods]) => {
      const days = schedule[oldKey] || {};
      Object.entries(days).forEach(([thu, tietList]) => {
        tietList.forEach((tiet, idx) => {
          if (idx >= maxPeriods) return;
          const period = idx + 1;
          const parsed = parseClassInfo(tiet, monDay, period);
          newTKB[teacherKey][thu][newKey][idx] = parsed;
        });
      });
    });

    newTKB[teacherKey]._meta = {
      monDay,
      tongTiet
    };
  });

  return { tkb: newTKB };
}

async function handleConvert() {
  try {
    const querySnapshot = await getDocs(collection(db, "TKB_GVBM_2025-2026"));
    let oldData = {};
    querySnapshot.forEach((docSnap) => {
      oldData[docSnap.id] = docSnap.data();
    });

    const newData = convertTKB(oldData);

    //console.log("✅ Dữ liệu sau khi chuyển đổi:", newData);

    await setDoc(doc(db, "TKB_GVBM", "TKB chuyen doi từ ABC"), newData);

    //console.log("🎉 Đã lưu vào Firestore: collection 'TKB_GVBM' / document 'TKB chuyen doi'");
  } catch (error) {
    console.error("❌ Lỗi khi chuyển đổi:", error);
  }
}
//=========================

return (
  <Box sx={{ mt: 2, p: 2, backgroundColor: "#e3f2fd", minHeight: "100vh" }}>
    <Card
      sx={{
        width: 1300, // giữ nguyên kích thước desktop
        mx: "auto",
        p: 3,
        borderRadius: 3,
        boxShadow: 5,
      }}
    >
      {/* ✅ Cụm icon góc trên/trái */}
      <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1 }}>
        {/*<IconButton
          color="primary"
          //onClick={handleSaveSchedule}
          onClick={handleSave}
          title="Lưu"
        >
          <SaveIcon />
        </IconButton>*/}

        {/*<IconButton
          color="primary"
          onClick={handleSaveAs}
          title="Lưu với tên khác"
        >
          <SaveAsIcon />
        </IconButton>*/}

        {/*<IconButton
          color="primary"
          onClick={handleOpenFile}
          title="Mở file"
        >
          <FolderOpenIcon />
        </IconButton>

        {/* Nút mới: Chuyển đổi */}
        {/*<IconButton
          color="primary"
          onClick={handleConvert}
          title="Chuyển đổi dữ liệu"
        >
          <SwapHorizIcon />
        </IconButton>*/}
      </Box>

      <Typography
        variant="h5"
        align="center"
        fontWeight="bold"
        gutterBottom
        sx={{ color: "#1976d2", mt: 0 }}
      >
        XẾP THỜI KHÓA BIỂU TOÀN TRƯỜNG
      </Typography>

      <Box
        sx={{
          mb: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            alignItems: "center",
          }}
        >
          <Typography variant="body1">Chọn ngày:</Typography>

          <Select
            size="small"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            sx={{ minWidth: 100 }}
          >
            {days.map((day) => (
              <MenuItem key={day} value={day}>
                {day}
              </MenuItem>
            ))}
          </Select>

          {/*<Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveSchedule}
          >
            Lưu
          </Button>*/}
        </Box>

        {/* Thanh tiến trình tải dữ liệu */}
        {isLoadingData && (
          <Box sx={{ width: "20%", mt: 1, mx: "auto" }}>
            <LinearProgress
              variant="determinate"
              value={loadingProgressData}
              sx={{ height: 3, borderRadius: 3 }}
            />
            <Typography
              variant="caption"
              align="center"
              sx={{ display: "block", mt: 0.5 }}
            >
              {`Đang tải dữ liệu: ${loadingProgressData}%`}
            </Typography>
          </Box>
        )}

        {/* Thanh tiến trình lưu dữ liệu */}
        {isSaving && (
          <Box sx={{ width: "20%", mt: 1, mx: "auto" }}>
            <LinearProgress
              variant="determinate"
              value={savingProgress}
              sx={{ height: 3, borderRadius: 3 }}
            />
            <Typography
              variant="caption"
              align="center"
              sx={{ display: "block", mt: 0.5 }}
            >
              {`Đang lưu dữ liệu: ${savingProgress}%`}
            </Typography>
          </Box>
        )}
      </Box>

      <Box
        sx={{ borderBottom: "3px solid #1976d2", width: "100%", mt: 1, mb: 1 }}
      />

      {/* Container chính: tiết + bảng thống kê bên phải */}
      <Box sx={{ display: "flex", gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          {!isLoadingData &&
            ["morning", "afternoon"].map((session) => (
              <Box key={session} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, color: "#8B4513" }}>
                  {session === "morning" ? "BUỔI SÁNG" : "BUỔI CHIỀU"}
                </Typography>

                <Box sx={{ display: "flex", gap: 1 }}>
                  {[1, 2, 3, 4, 5]
                    .filter((period) => period !== 5)
                    .map((period) => {
                      const rows = tkb[session]?.[period] || [];
                      return (
                        <Paper key={period} sx={{ p: 1, flex: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: "bold", mb: 1, color: "#1976d2" }}
                          >
                            TIẾT {period}
                          </Typography>

                          {rows.map((row, i) => (
                            <Box
                              key={i}
                              sx={{
                                mb: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.25,
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  gap: 0.5,
                                  alignItems: "center",
                                  position: "relative",
                                  "&:hover .delete-btn": { opacity: 1 },
                                }}
                              >
                                {/* Select GV */}
                                <Select
                                  size="small"
                                  value={row.gvId || ""}
                                  onChange={(e) =>
                                    handleChangeRow(
                                      session,
                                      period,
                                      i,
                                      "gvId",
                                      e.target.value
                                    )
                                  }
                                  sx={{
                                    minWidth: 120,
                                    backgroundColor: row.gvId
                                      ? teacherColors[
                                          getTenCuoi(
                                            teachers.find(
                                              (t) => t.id === row.gvId
                                            )?.name || ""
                                          )
                                        ] || "transparent"
                                      : "transparent",
                                    borderRadius: 1,
                                  }}
                                >
                                  <MenuItem value="">--GV--</MenuItem>
                                  {[...teachers]
                                    .sort((a, b) =>
                                      getTenCuoi(a.name).localeCompare(
                                        getTenCuoi(b.name),
                                        "vi"
                                      )
                                    )
                                    .map((t) => (
                                      <MenuItem key={t.id} value={t.id}>
                                        {getTenCuoi(t.name)}
                                      </MenuItem>
                                    ))}
                                </Select>

                                {/* Select lớp */}
                                <Select
                                  size="small"
                                  value={
                                    row.class
                                      ? `${row.class}|${row.subject || ""}`
                                      : ""
                                  }
                                  onChange={(e) =>
                                    handleChangeRow(
                                      session,
                                      period,
                                      i,
                                      "class",
                                      e.target.value
                                    )
                                  }
                                  sx={{ minWidth: 80 }}
                                  disabled={!row.gvId}
                                >
                                  <MenuItem value="">--Lớp--</MenuItem>
                                  {(() => {
                                    const gv = teachers.find(
                                      (t) => t.id === row.gvId
                                    );
                                    if (!gv) return null;

                                    if ((gv.monDay || []).length <= 1) {
                                      return (gv.lopDay || [])
                                        .slice()
                                        .sort((a, b) =>
                                          a.localeCompare(b, "vi", {
                                            numeric: true,
                                          })
                                        )
                                        .map((lop) => {
                                          const subj =
                                            gv.classToSubjects?.[lop]?.[0]?.mon ||
                                            gv.monDay[0] ||
                                            "";
                                          return (
                                            <MenuItem
                                              key={`${lop}|${subj}`}
                                              value={`${lop}|${subj}`}
                                            >
                                              {lop}
                                            </MenuItem>
                                          );
                                        });
                                    }

                                    const options = [];
                                    Object.entries(gv.classToSubjects || {})
                                      .sort(([lopA], [lopB]) =>
                                        lopA.localeCompare(lopB, "vi", {
                                          numeric: true,
                                        })
                                      )
                                      .forEach(([lop, subs]) => {
                                        subs.forEach((sub) => {
                                          const mon = sub.mon;
                                          const vietTat =
                                            sub.vietTatMon || mon;
                                          const label =
                                            vietTat === "TH"
                                              ? lop
                                              : `${lop} (${vietTat})`;
                                          const value = `${lop}|${mon}`;
                                          options.push(
                                            <MenuItem
                                              key={value}
                                              value={value}
                                            >
                                              {label}
                                            </MenuItem>
                                          );
                                        });
                                      });
                                    return options;
                                  })()}
                                </Select>

                                {/* nút xóa */}
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleRemoveRow(session, period, i)
                                  }
                                  className="delete-btn"
                                  sx={{
                                    color: "red",
                                    opacity: 0,
                                    transition: "opacity 0.2s",
                                    position: "absolute",
                                    right: -5,
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>

                              {/* Hiển thị cảnh báo xung đột */}
                              {inlineConflicts[session]?.[period]?.[i] && (
                                <Typography
                                  variant="caption"
                                  color="error"
                                  sx={{ ml: 1 }}
                                >
                                  {inlineConflicts[session][period][i]}
                                </Typography>
                              )}
                            </Box>
                          ))}

                          {/* nút +GV */}
                          <Box sx={{ mt: 1, textAlign: "left" }}>
                            <button
                              type="button"
                              style={{ fontSize: "0.8rem" }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAddRow(session, period);
                              }}
                            >
                              + GV
                            </button>
                          </Box>
                        </Paper>
                      );
                    })}
                </Box>
              </Box>
            ))}
        </Box>

        {/* Card thống kê duy nhất bên phải */}
        <Card
          sx={{
            mt: 5,
            p: 2,
            width: 160,
            height: 750,
            backgroundColor: "#f5f5f5",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, color: "#1976d2" }}>
            📊 Thống kê
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Tên</TableCell>
                <TableCell sx={{ fontWeight: "bold" }} align="right">
                  Số tiết
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teacherStats
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((stat) => (
                  <TableRow key={stat.id}>
                    <TableCell>{stat.name}</TableCell>
                    <TableCell align="right">{stat.total}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      </Box>
    </Card>      
  </Box>
);

}

// parse "1.1 (4.2)" => { class: '1.1', subject: '4.2' } (giữ nguyên hàm cũ)
function parsePeriod(str){
  const match = str.match(/^(\d+\.\d+)\s+\((.+)\)$/);
  if(!match) return null;
  return { class: match[1], subject: match[2] };
}
