import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  CircularProgress,
  Button,
  LinearProgress,
  Card,
  IconButton, 
  Tooltip
} from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useGVBM } from "../contexts/ContextGVBM";

import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
//import SaveIcon from "@mui/icons-material/Save";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";

import { useSchedule } from "../contexts/ScheduleContext";
import { useOpenFile } from "../contexts/OpenFileContext";
import { useGVCN } from "../contexts/ContextGVCN";

const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
const periodsBySession = {
  SÁNG: [1, 2, 3, 4, 5],
  CHIỀU: [1, 2, 3, 4],
};

const defaultSchedule = {
  SÁNG: { "Thứ 2": ["", "", "", "", ""], "Thứ 3": ["", "", "", "", ""], "Thứ 4": ["", "", "", "", ""], "Thứ 5": ["", "", "", "", ""], "Thứ 6": ["", "", "", "", ""] },
  CHIỀU: { "Thứ 2": ["", "", "", "", ""], "Thứ 3": ["", "", "", "", ""], "Thứ 4": ["", "", "", "", ""], "Thứ 5": ["", "", "", "", ""], "Thứ 6": ["", "", "", "", ""] },
};

export default function XepTKB_GVBM({ setSaveHandler }) {
  const { contextRows, setContextRows } = useGVBM();
  //const { tkbAllTeachers, currentDocId, selectedFileId } = useSchedule(); // 🔹 thêm dòng này
  const { tkbAllTeachers, currentDocId, selectedFileId, setTkbAllTeachers } = useSchedule();

  const [rows, setRows] = useState([]);
  const [monOptions, setMonOptions] = useState([]);
  const [selectedGV, setSelectedGV] = useState("");
  const [selectedMon, setSelectedMon] = useState("");
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [loading, setLoading] = useState(false);
  const [lopOptions, setLopOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);  
  const [updateDone, setUpdateDone] = useState(false);
  const [inlineConflicts, setInlineConflicts] = useState([]);
  const [lopCache, setLopCache] = useState({});
  const { openFileName } = useOpenFile(); 
  const { contextSchedule, setContextSchedule } = useGVCN();
  
  
  
  // Hàm fetch dữ liệu từ Firestore nếu context chưa có
const fetchGVList = async () => {
  setLoading(true);
  try {
      if (contextRows && contextRows.length > 0) {
      setRows(contextRows);

      const firstGV = (() => {
        // kết hợp 2 nguồn dữ liệu
        const combined = contextRows.length > 0 ? contextRows : gvbmData;

        if (!combined || combined.length === 0) return null;

        // sort theo tên cuối tiếng Việt
        const sorted = [...combined].sort((a, b) => {
          const getLastName = (fullName) => {
            const parts = fullName.trim().split(" ");
            return parts[parts.length - 1].toLowerCase();
          };
          return getLastName(a.hoTen).localeCompare(getLastName(b.hoTen), "vi"); // 'vi' để sort tiếng Việt đúng
        });

        return sorted[0];
      })();

      if (firstGV) {
        setSelectedGV(firstGV.hoTen);

        // ngay lập tức cập nhật schedule
        const initialSchedule = getGVSchedule(firstGV.hoTen, currentDocId, tkbAllTeachers);
        setSchedule(initialSchedule);

        // lấy phân công lớp
        fetchPhanCongLop(firstGV.hoTen);
      }

      const allMon = contextRows.flatMap(item => item.monHoc || []);
      setMonOptions(Array.from(new Set(allMon)));

      setLoading(false);
      return;
      }

      const gvbmSnapshot = await getDocs(collection(db, "GVBM_2025-2026"));
      const gvbmData = gvbmSnapshot.docs.map((docSnap, index) => {
      const { hoTen, monDay } = docSnap.data();
      return {
          stt: index + 1,
          hoTen,
          monHoc: monDay || [],
          monDay: monDay || [],
      };
      });

      gvbmData.sort((a, b) => {
      const getLastName = (fullName) =>
          fullName.trim().split(" ").slice(-1)[0].toLowerCase();
      return getLastName(a.hoTen).localeCompare(getLastName(b.hoTen));
      });

      setRows(gvbmData);
      setContextRows(gvbmData);

      const firstGV = gvbmData[0];
      if (firstGV) setSelectedGV(firstGV.hoTen);

      const allMon = gvbmData.flatMap(item => item.monHoc);
      setMonOptions(Array.from(new Set(allMon)));

  } catch (err) {
      console.error("❌ Lỗi khi tải dữ liệu:", err);
  }

  setLoading(false);
  };

  const normalizeName = (name) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "_");

  // lấy TKB từ context, thay cho getDoc
const getGVSchedule = (hoTen, selectedFileId, tkbAllTeachers) => {
  const checkFileName = selectedFileId; // biến tạm chỉ để log
  //console.log("📁 Tên file đang mở:", checkFileName);

  if (!hoTen || !selectedFileId || !tkbAllTeachers) {
    console.warn("⚠️ Thiếu dữ liệu đầu vào:", { hoTen, selectedFileId, tkbAllTeachers });
    return JSON.parse(JSON.stringify(defaultSchedule));
  }

  const key = normalizeName(hoTen);
  //console.log("🔑 Normalized key:", key);

  const raw = tkbAllTeachers[selectedFileId]?.[key];
  //console.log("📂 Raw TKB từ context:", raw);

  if (!raw) {
    console.warn(`⚠️ Không tìm thấy TKB trong context cho GV: ${hoTen}`);
    return JSON.parse(JSON.stringify(defaultSchedule));
  }

  const fixed = { SÁNG: {}, CHIỀU: {} };
  Object.keys(raw).forEach(day => {
    fixed.SÁNG[day] = Array.isArray(raw[day]?.morning) ? raw[day].morning : [];
    fixed.CHIỀU[day] = Array.isArray(raw[day]?.afternoon) ? raw[day].afternoon : [];
  });

  days.forEach(day => {
    if (!fixed.SÁNG[day]) fixed.SÁNG[day] = [];
    if (!fixed.CHIỀU[day]) fixed.CHIỀU[day] = [];
  });

  //console.log("✅ Fixed schedule:", fixed);
  return fixed;
};

  // Cập nhật schedule cho giáo viên trong contextRows
  const updateScheduleInContext = (gvName, newSchedule) => {
    setContextRows(prev => {
      return prev.map(gv => 
        gv.hoTen === gvName ? { ...gv, tkb: newSchedule } : gv
      );
    });
  };

  useEffect(() => {
    fetchGVList();
  }, []);

  // Khi GV thay đổi, cập nhật môn học

  useEffect(() => {
    if (!selectedGV || !currentDocId || !tkbAllTeachers) return;

    const scheduleGVBM = getGVSchedule(selectedGV, currentDocId, tkbAllTeachers);
    setSchedule(scheduleGVBM);

    const gv = rows.find(row => row.hoTen === selectedGV);
    setSelectedMon(gv ? (gv.monHoc || []).join(", ") : "");
  }, [selectedGV, rows, tkbAllTeachers, currentDocId]);

  const convertHoTenToId = (hoTen) => {
    return hoTen
      .normalize("NFD") // tách dấu tiếng Việt
      .replace(/[\u0300-\u036f]/g, "") // xóa dấu
      .toLowerCase()
      .replace(/\s+/g, "_"); // thay khoảng trắng bằng _
  };

  const fetchPhanCongLop = async (hoTen) => {
    try {
      const docId = convertHoTenToId(hoTen); // chuyển tên thành ID
      const snapshot = await getDoc(doc(db, "PHANCONG_2025-2026", docId));
      const data = snapshot.data();

      if (!data || !data.phanCong) {
        setLopOptions([]);
        return;
      }

      const monHoc = data.monDay || [];
      const vietTatMon = data.vietTatMon || {}; // lấy từ điển viết tắt đã lưu
      setSelectedMon(monHoc.join(", "));

      let allLop = [];

      if (monHoc.length > 1) {
        // Nếu giáo viên dạy nhiều môn → gắn viết tắt từ dữ liệu đã lưu
        allLop = monHoc.flatMap(mon => {
          const vietTat = vietTatMon[mon] || ""; // dùng từ điển thay vì tự sinh
          const dsLop = data.phanCong[mon] || [];
          return dsLop.map(lop => `${lop} (${vietTat})`);
        });
      } else {
        // Nếu chỉ dạy 1 môn → giữ nguyên tên lớp
        const onlyMon = monHoc[0];
        allLop = data.phanCong[onlyMon] || [];
      }

      const uniqueLop = Array.from(new Set(allLop));
      setLopOptions(uniqueLop);
    } catch (err) {
      console.error("Lỗi khi lấy phân công lớp:", err);
      setLopOptions([]);
    }
  };

  const tinhTongTiet = () => {
    if (!schedule) return 0;

    let total = 0;

    ["SÁNG", "CHIỀU"].forEach(session => {
      const buoi = schedule[session];
      if (!buoi) return;

      days.forEach(day => {
        const tietArr = buoi[day];
        if (Array.isArray(tietArr)) {
          total += tietArr.filter(t => String(t || "").trim() !== "").length;
        }
      });
    });

    return total;
  };

  const saveTKB_GVBM = async () => {
    if (!currentDocId) {
      alert("⚠️ Chưa mở file nào để lưu!");
      return;
    }

    const start = performance.now();
    setSaving(true);
    setProgress(10);

    try {
      const gvId = convertHoTenToId(selectedGV);

      // === Helper: tạo bảng rỗng cho 1 lớp ===
      const buildEmptySchedule = () => ({
        SÁNG: Object.fromEntries(days.map(d => [d, Array(periodsBySession["SÁNG"].length).fill("")])),
        CHIỀU: Object.fromEntries(days.map(d => [d, Array(periodsBySession["CHIỀU"].length).fill("")])),
      });

      // === Helper: so sánh slot nhanh ===
      const isEqualSlot = (a, b) =>
        (a?.class || "") === (b?.class || "") &&
        (a?.subject || "") === (b?.subject || "") &&
        (a?.period || null) === (b?.period || null);

      // === Lấy danh sách môn của GV ===
      let monDay = rows.find(r => r.hoTen === selectedGV)?.monDay || [];
      if (monDay.length === 0) {
        try {
          const gvDoc = await getDoc(doc(db, "GVBM_2025-2026", gvId));
          if (gvDoc.exists()) monDay = gvDoc.data().monDay || [];
        } catch (e) {
          console.warn("⚠️ Không lấy được monDay từ GVBM:", e);
        }
      }

      // Bảng viết tắt → môn
      const vietTatToMon = Object.fromEntries(
        monDay
          .map(mon => {
            const vt = mon.split(" ").map(t => t[0] || "").join("").toUpperCase();
            return [vt, mon];
          })
          .filter(([vt]) => vt)
      );
      const normalize = s =>
        String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const hasTin = monDay.map(normalize).includes("tin hoc");

      const inferSubject = (provided, lop) => {
        if (provided?.trim()) return vietTatToMon[provided.trim().toUpperCase()] || provided;
        if (monDay.length === 1) return monDay[0];
        if (hasTin) return monDay.find(m => normalize(m) === "tin hoc") || "Tin học";
        return monDay[0] || "";
      };

      // === Lấy dữ liệu cũ GV ===
      const fileRefGVBM = doc(db, "TKB_GVBM", currentDocId);
      const snapGVBM = await getDoc(fileRefGVBM);
      const oldDataGVBM = snapGVBM.exists() ? snapGVBM.data() : { tkb: {} };
      const oldTkbGV = oldDataGVBM.tkb?.[gvId] || {};

      let updatedContextGVCN = { ...(contextSchedule || {}) };
      const batch = writeBatch(db);
      const changedClasses = new Map();
      let anyChange = false;

      // === Duyệt tất cả buổi/ngày/tiết ===
      for (const sessionLabel of ["SÁNG", "CHIỀU"]) {
        const sessionKey = sessionLabel === "SÁNG" ? "morning" : "afternoon";
        const numPeriods = periodsBySession[sessionLabel].length;

        for (const day of days) {
          const newArr = (schedule[sessionLabel]?.[day] || Array(numPeriods).fill(null)).map(
            (val, idx) => {
              if (!val) return null;
              if (typeof val === "object") {
                const cls = (val.class || "").trim();
                if (!cls) return null;
                const subj = val.subject?.trim()
                  ? inferSubject(val.subject, cls)
                  : inferSubject("", cls);
                return { class: cls, subject: subj, period: idx + 1 };
              }
              if (typeof val === "string") {
                const raw = val.trim();
                if (!raw) return null;
                const m = raw.match(/^(.+?)\s*\((.+?)\)$/);
                if (m) {
                  const lop = m[1].trim();
                  const vt = m[2].trim().toUpperCase();
                  return { class: lop, subject: vietTatToMon[vt] || inferSubject("", lop), period: idx + 1 };
                }
                return { class: raw, subject: inferSubject("", raw), period: idx + 1 };
              }
              return null;
            }
          );

          const oldArr = oldTkbGV?.[day]?.[sessionKey] || Array(numPeriods).fill(null);

          newArr.forEach((newSlot, idx) => {
            const oldSlot = oldArr[idx] || null;
            if (!isEqualSlot(oldSlot, newSlot)) {
              if (!oldTkbGV[day]) oldTkbGV[day] = {};
              if (!oldTkbGV[day][sessionKey]) oldTkbGV[day][sessionKey] = [...oldArr];
              oldTkbGV[day][sessionKey][idx] = newSlot;
              anyChange = true;

              const cls = newSlot?.class || oldSlot?.class;
              if (cls) {
                if (!updatedContextGVCN[cls]) updatedContextGVCN[cls] = buildEmptySchedule();
                updatedContextGVCN[cls][sessionLabel][day][idx] = newSlot?.subject || "";
                changedClasses.set(cls, updatedContextGVCN[cls]);
              }
            }
          });
        }
      }

      // === Nếu có thay đổi → commit ===
      if (anyChange) {
        batch.set(
          fileRefGVBM,
          {
            ...oldDataGVBM,
            tkb: { ...(oldDataGVBM.tkb || {}), [gvId]: oldTkbGV },
            updatedAt: new Date(),
          },
          { merge: true }
        );

        const fileRefGVCN = doc(db, "TKB_GVCN", currentDocId);
        const snapGVCN = await getDoc(fileRefGVCN);

        if (snapGVCN.exists()) {
          batch.set(fileRefGVCN, Object.fromEntries(changedClasses), { merge: true });
        } else {
          const fullEmpty = Object.fromEntries(
            Object.keys(contextSchedule || {}).map(c => [c, buildEmptySchedule()])
          );
          batch.set(fileRefGVCN, { ...fullEmpty, ...updatedContextGVCN });
        }

        await batch.commit();
      }

      // === Update state React ===
      setTkbAllTeachers?.(prev => ({
        ...(prev || {}),
        [currentDocId]: { ...(prev?.[currentDocId] || {}), [gvId]: oldTkbGV },
      }));
      setContextSchedule?.(updatedContextGVCN);

      setProgress(100);
      console.log(`⏱️ Thời gian lưu: ${(performance.now() - start).toFixed(1)}ms`);
    } catch (err) {
      console.error("❌ Lỗi lưu GV:", err);
      alert("❌ Lưu thất bại. Xem console để biết chi tiết.");
    } finally {
      setSaving(false);
    }
  };

{/*const saveTKB_GVBM_OK = async () => {
  if (!currentDocId) {
    alert("⚠️ Chưa mở file nào để lưu!");
    return;
  }

  const startTime = performance.now();
  setSaving(true);
  setProgress(10);

  try {
    const gvId = convertHoTenToId(selectedGV);

    //console.log("👉 GV đang lưu:", selectedGV, "→ id:", gvId);
    //console.log("👉 contextSchedule ban đầu:", contextSchedule);

    let monDay = rows.find(row => row.hoTen === selectedGV)?.monDay || [];
    if (monDay.length === 0) {
      try {
        const gvDoc = await getDoc(doc(db, "GVBM_2025-2026", gvId));
        if (gvDoc.exists()) monDay = gvDoc.data().monDay || [];
      } catch (e) {
        console.warn("⚠️ Không lấy được monDay từ GVBM:", e);
      }
    }
    //console.log("👉 Danh sách môn (monDay):", monDay);

    const vietTatToMon = Object.fromEntries(
      monDay.map(mon => {
        const vt = mon.split(" ").map(tu => tu[0] || "").join("").toUpperCase();
        return [vt, mon];
      }).filter(([vt]) => vt)
    );

    const normalize = s =>
      String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const normalizedSubjects = monDay.map(normalize);
    const hasTin = normalizedSubjects.includes("tin hoc");

    const inferSubject = (providedSubject, baseClass) => {
      if (providedSubject?.trim()) {
        const vt = providedSubject.trim().toUpperCase();
        return vietTatToMon[vt] || providedSubject;
      }
      if (monDay.length === 0) return "";
      if (monDay.length === 1) return monDay[0];
      if (hasTin) {
        const realTin = monDay.find(m => normalize(m) === "tin hoc");
        return realTin || "Tin học";
      }
      return "";
    };

    const fileRefGVBM = doc(db, "TKB_GVBM", currentDocId);
    const snapGVBM = await getDoc(fileRefGVBM);
    const oldDataGVBM = snapGVBM.exists() ? snapGVBM.data() : { tkb: {} };
    const oldTkbGV = oldDataGVBM.tkb?.[gvId] || {};

    let updatedContextGVCN = { ...(contextSchedule || {}) };
    const batch = writeBatch(db);
    let anyChange = false;
    const changedClassesMap = new Map();

    const emptyPeriodsBySession = {
      SÁNG: Array(periodsBySession["SÁNG"].length).fill(null),
      CHIỀU: Array(periodsBySession["CHIỀU"].length).fill(null),
    };

    const emptySubjectsBySession = {
      SÁNG: Array(periodsBySession["SÁNG"].length).fill(""),
      CHIỀU: Array(periodsBySession["CHIỀU"].length).fill(""),
    };

    const normalizedSchedule = { morning: {}, afternoon: {} };
    ["SÁNG", "CHIỀU"].forEach(session => {
      const sessionKey = session === "SÁNG" ? "morning" : "afternoon";
      days.forEach(day => {
        const tiets = Array.isArray(schedule[session]?.[day])
          ? schedule[session][day]
          : [...emptyPeriodsBySession[session]];

        normalizedSchedule[sessionKey][day] = tiets.map((val, idx) => {
          if (val == null) return null;
          if (typeof val === "object") {
            const cls = String(val.class || "").trim();
            const subj = val.subject?.trim()
              ? inferSubject(val.subject, cls)
              : inferSubject("", cls);
            return cls ? { class: cls, subject: subj, period: idx + 1 } : null;
          }
          if (typeof val === "string") {
            const raw = val.trim();
            if (!raw) return null;
            const m = raw.match(/^(.+?)\s*\((.+?)\)$/);
            if (m) {
              const lop = m[1].trim();
              const vt = m[2].trim().toUpperCase();
              const monHoc = vietTatToMon[vt] || inferSubject("", lop);
              return { class: lop, subject: monHoc, period: idx + 1 };
            }
            return { class: raw, subject: inferSubject("", raw), period: idx + 1 };
          }
          return null;
        });
      });
    });

    days.forEach(day => {
      ["morning", "afternoon"].forEach(sessionKey => {
        const sessionLabel = sessionKey === "morning" ? "SÁNG" : "CHIỀU";
        const oldArr = oldTkbGV?.[day]?.[sessionKey] || [...emptyPeriodsBySession[sessionLabel]];
        const newArr = normalizedSchedule[sessionKey][day];

        newArr.forEach((newSlot, idx) => {
          const oldSlot = oldArr[idx] || null;
          const slotClass = newSlot?.class || oldSlot?.class;
          const slotSubject = newSlot?.subject || "";

          const isChanged = JSON.stringify(oldSlot ?? null) !== JSON.stringify(newSlot ?? null);

          if (isChanged) {
            if (!oldTkbGV[day]) oldTkbGV[day] = {};
            if (!oldTkbGV[day][sessionKey]) oldTkbGV[day][sessionKey] = [...oldArr];
            oldTkbGV[day][sessionKey][idx] = newSlot;
            anyChange = true;

            if (slotClass) {
              if (!updatedContextGVCN[slotClass]) updatedContextGVCN[slotClass] = { SÁNG: {}, CHIỀU: {} };
              if (!updatedContextGVCN[slotClass][sessionLabel][day]) {
                updatedContextGVCN[slotClass][sessionLabel][day] = [...emptySubjectsBySession[sessionLabel]];
              }
              updatedContextGVCN[slotClass][sessionLabel][day][idx] = slotSubject;
              changedClassesMap.set(slotClass, updatedContextGVCN[slotClass]);
            }
          }
        });
      });
    });

    //console.log("📌 Danh sách lớp trong updatedContextGVCN:", Object.keys(updatedContextGVCN));

    if (anyChange) {
      batch.set(fileRefGVBM, {
        ...oldDataGVBM,
        tkb: { ...(oldDataGVBM.tkb || {}), [gvId]: oldTkbGV },
        updatedAt: new Date(),
      }, { merge: true });

      const fileRefGVCN = doc(db, "TKB_GVCN", currentDocId);
      const snapGVCN = await getDoc(fileRefGVCN);

      if (snapGVCN.exists()) {
        const gvcnsToUpdate = Object.fromEntries(changedClassesMap);
        //console.log("♻️ Cập nhật vào file TKB_GVCN:", currentDocId, "→ lớp thay đổi:", Object.keys(gvcnsToUpdate));
        batch.set(fileRefGVCN, gvcnsToUpdate, { merge: true });
      } else {
        // 🆕 Khởi tạo đầy đủ khung TKB từ context
        const allClasses = Object.keys(contextSchedule || {});
        const fullEmptySchedule = {};
        allClasses.forEach(cls => {
          fullEmptySchedule[cls] = { SÁNG: {}, CHIỀU: {} };
          days.forEach(day => {
            fullEmptySchedule[cls]["SÁNG"][day] = [...emptySubjectsBySession["SÁNG"]];
            fullEmptySchedule[cls]["CHIỀU"][day] = [...emptySubjectsBySession["CHIỀU"]];
          });
        });

        const mergedInit = { ...fullEmptySchedule, ...updatedContextGVCN };
        //console.log("🆕 Tạo file mới TKB_GVCN:", currentDocId, "→ gồm các lớp:", Object.keys(mergedInit));
        batch.set(fileRefGVCN, mergedInit);
      }

      await batch.commit();
      //console.log("✅ Đã lưu thay đổi vào GVBM & GVCN");
    } else {
      //console.log("ℹ️ Không có slot nào thay đổi, không cần lưu");
    }

    if (typeof setTkbAllTeachers === "function") {
      setTkbAllTeachers(prev => ({
        ...(prev || {}),
        [currentDocId]: {
          ...(prev?.[currentDocId] || {}),
          [gvId]: oldTkbGV,
        },
      }));
    }

    if (typeof setContextSchedule === "function") {
      setContextSchedule(updatedContextGVCN);
    }

    setProgress(100);
    const endTime = performance.now();
    console.log(`⏱️ Thời gian lưu: ${(endTime - startTime).toFixed(1)}ms`);
  } catch (err) {
    console.error("❌ Lỗi lưu GV:", err);
    alert("❌ Lưu thất bại. Xem console để biết chi tiết.");
  } finally {
    setSaving(false);
  }
};*/}

useEffect(() => {
  if (
    setSaveHandler &&
    selectedGV &&
    currentDocId &&
    rows.length > 0 &&
    schedule &&
    Object.keys(schedule).length > 0
  ) {
    setSaveHandler(() => saveTKB_GVBM);
  }
}, [setSaveHandler, selectedGV, currentDocId, rows, schedule]);

function tachLop(value) {
  if (!value) return null;
  const m = value.match(/^([^( -]+)/);
  return m ? m[1].trim() : value.trim();
}

// Hàm kiểm tra GV có dạy block ≥ 2 tiết liên tiếp trong lớp đó
function laBlockLienTiep(buoi, ngay, lop, gv, scheduleMap) {
  const tietKeys = Object.keys(scheduleMap[buoi][ngay]).map(Number).sort((a,b)=>a-b);
  for (let i = 0; i < tietKeys.length - 1; i++) {
    const t1 = tietKeys[i], t2 = tietKeys[i+1];
    const arr1 = scheduleMap[buoi][ngay][t1] || [];
    const arr2 = scheduleMap[buoi][ngay][t2] || [];
    const d1 = arr1.some(a => a.gv === gv && tachLop(a.value) === lop);
    const d2 = arr2.some(a => a.gv === gv && tachLop(a.value) === lop);
    if (d1 && d2) return true; // có block ≥ 2 tiết
  }
  return false;
}

// Hàm đề xuất tiết trống cho GV và lớp (có chấm điểm & giữ chỗ)
function deXuatChoTrong(gv, lop, scheduleMap) {
  const BUOIS = ["SÁNG", "CHIỀU"];
  const NGAYS  = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];

  const maxTiet = (buoi) => (buoi.toUpperCase() === "SÁNG" ? 4 : 3);
  const getArr = (buoi, ngay, tiet) =>
    (scheduleMap[buoi] && scheduleMap[buoi][ngay] && scheduleMap[buoi][ngay][tiet]) || [];

  const slotsGV = [];
  for (const buoi of BUOIS) {
    for (const ngay of NGAYS) {
      for (let tiet = 0; tiet < maxTiet(buoi); tiet++) {
        const arr = getArr(buoi, ngay, tiet);
        if (arr.some(a => a.gv === gv)) {
          slotsGV.push({ buoi, ngay, tiet });
        }
      }
    }
  }

  const buoiUuTien = slotsGV[0]?.buoi || null;
  const ngayUuTien = slotsGV[0]?.ngay || null;

  function slotHopLe(buoi, ngay, tiet) {
    if (buoi === "SÁNG" && ngay === "Thứ 2" && tiet === 0) return false;
    const arr = getArr(buoi, ngay, tiet);
    const hasGV    = arr.some(a => a.gv === gv);
    const hasClass = arr.some(a => tachLop(a.value) === lop);
    return !hasGV && !hasClass;
  }

  function scoreSlot(buoi, ngay, tiet) {
    let score = 0;
    if (buoiUuTien && buoi === buoiUuTien) score += 3;
    if (ngayUuTien && ngay === ngayUuTien) score += 2;

    const sameDaySameBuoi = slotsGV.filter(s => s.buoi === buoi && s.ngay === ngay);
    if (sameDaySameBuoi.length) {
      const minDist = Math.min(...sameDaySameBuoi.map(s => Math.abs(s.tiet - tiet)));
      if (minDist === 1) score += 2;
      else if (minDist === 2) score += 1;
    }
    return score;
  }

  const candidates = [];
  for (const buoi of BUOIS) {
    for (const ngay of NGAYS) {
      for (let tiet = 0; tiet < maxTiet(buoi); tiet++) {
        if (slotHopLe(buoi, ngay, tiet)) {
          candidates.push({ buoi, ngay, tiet, score: scoreSlot(buoi, ngay, tiet) });
        }
      }
    }
  }

  if (candidates.length === 0) return "❌ Không còn slot trống phù hợp";

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.buoi !== b.buoi) return a.buoi === "SÁNG" ? -1 : 1;
    if (a.ngay !== b.ngay) return NGAYS.indexOf(a.ngay) - NGAYS.indexOf(b.ngay);
    return a.tiet - b.tiet;
  });

  const chosen = candidates[0];

  // ✅ Bỏ giữ chỗ trong scheduleMap, chỉ trả kết quả
  return `${chosen.buoi} ${chosen.ngay} tiết ${chosen.tiet + 1}`;
}

// 1. Thêm state để lưu conflicts
const [conflicts, setConflicts] = useState([]); 
const [showConflicts, setShowConflicts] = useState(false); // điều khiển hiển thị card

function parseUpdateSuggestions(conflictStr) {
  const lines = conflictStr.split("\n");
  const classMatch = conflictStr.match(/Lớp (\S+)/); // lấy tên lớp từ dòng đầu
  const lop = classMatch ? classMatch[1] : null;

  const suggestions = [];
  lines.forEach(line => {
    const match = line.match(/- (.+):\s*👉\s*(.+)/);
    if (match && lop) {
      const gv = match[1].trim();
      const target = match[2].trim();
      const targetMatch = target.match(/(SÁNG|CHIỀU)\s+(Thứ \d)\s+tiết (\d+)/);
      if (targetMatch) {
        suggestions.push({
          gv,
          lop,  // ghi lớp chứ không phải GV
          to: {
            session: targetMatch[1],
            day: targetMatch[2],
            period: parseInt(targetMatch[3]) - 1
          }
        });
      }
    }
  });

  return suggestions;
}

function applyConflictUpdates(schedule, conflicts) {
  const newSchedule = JSON.parse(JSON.stringify(schedule));

  conflicts.forEach(conflict => {
    const suggestions = parseUpdateSuggestions(conflict); // { gv, lop, to }

    suggestions.forEach(({ gv, lop, to }) => {
      let oldValue = lop;
      let fromPos = null;

      // 1. Tìm vị trí slot cũ và lấy giá trị đầy đủ
      for (const session of ["SÁNG", "CHIỀU"]) {
        for (const day of days) {
          if (Array.isArray(newSchedule[session][day])) {
            for (let i = 0; i < newSchedule[session][day].length; i++) {
              const slot = newSchedule[session][day][i];
              if (typeof slot === "string" && slot.includes(lop)) {
                oldValue = slot;
                fromPos = { session, day, period: i };
                break;
              }
            }
          }
          if (fromPos) break;
        }
        if (fromPos) break;
      }

      // 2. Xóa slot cũ nếu tìm thấy
      if (fromPos) {
        newSchedule[fromPos.session][fromPos.day][fromPos.period] = "";
      }

      // 3. Khởi tạo slot mới nếu chưa có
      if (!Array.isArray(newSchedule[to.session][to.day])) {
        newSchedule[to.session][to.day] = Array(periodsBySession[to.session].length).fill("");
      }

      // 4. Ghi giá trị đầy đủ vào slot mới
      newSchedule[to.session][to.day][to.period] = oldValue || "";
    });
  });

  // 5. Làm sạch toàn bộ lịch
  ["SÁNG", "CHIỀU"].forEach(session => {
    days.forEach(day => {
      if (!Array.isArray(newSchedule[session][day])) {
        newSchedule[session][day] = Array(periodsBySession[session].length).fill("");
      }
      newSchedule[session][day] = newSchedule[session][day].map(slot => slot || "");
    });
  });

  return newSchedule;
}

const handleUpdateConflicts = async () => {
  if (!window.confirm("⚠️ Bạn có chắc chắn muốn áp dụng các đề xuất trên vào TKB?")) {
    //console.log("Người dùng hủy cập nhật");
    return;
  }

  try {
    setUpdating(true);   // bắt đầu cập nhật
    setProgress(0);      // reset tiến trình

    // 1️⃣ Ghi Firestore cho từng GV trong conflicts
    for (let cIndex = 0; cIndex < conflicts.length; cIndex++) {
      const conflict = conflicts[cIndex];
      const suggestions = parseUpdateSuggestions(conflict);

      for (let sIndex = 0; sIndex < suggestions.length; sIndex++) {
        const { gv, lop, to } = suggestions[sIndex];
        if (!gv || !lop || !to || !to.session || !to.day || typeof to.period !== "number") continue;

        const docIdGV = convertHoTenToId(gv);
        const gvRef = doc(db, "TKB_GVBM_2025-2026", docIdGV);
        const gvSnap = await getDoc(gvRef);

        const gvData = gvSnap.exists()
          ? gvSnap.data()
          : { schedule: JSON.parse(JSON.stringify(defaultSchedule)), hoTen: gv };

        if (!gvData.schedule[to.session]) gvData.schedule[to.session] = {};
        if (!Array.isArray(gvData.schedule[to.session][to.day])) {
          gvData.schedule[to.session][to.day] = Array(periodsBySession[to.session].length).fill("");
        }

        let oldValue = lop;
        let fromPos = null;
        for (const session of ["SÁNG", "CHIỀU"]) {
          for (const day of days) {
            const arr = gvData.schedule[session]?.[day];
            if (Array.isArray(arr)) {
              for (let i = 0; i < arr.length; i++) {
                if (arr[i]?.includes(lop)) {
                  oldValue = arr[i];
                  fromPos = { session, day, period: i };
                  break;
                }
              }
            }
            if (fromPos) break;
          }
          if (fromPos) break;
        }

        gvData.schedule[to.session][to.day][to.period] = oldValue || "";
        if (fromPos) {
          gvData.schedule[fromPos.session][fromPos.day][fromPos.period] = "";
        }

        const totalTiet = Object.values(gvData.schedule).reduce((sumBuoi, buoiObj) => {
          return sumBuoi + Object.values(buoiObj).reduce((sumDay, dayArr) => {
            return sumDay + dayArr.filter(s => s && s.trim() !== "").length;
          }, 0);
        }, 0);

        await setDoc(gvRef, {
          hoTen: gvData.hoTen,
          schedule: gvData.schedule,
          tongTiet: totalTiet
        }, { merge: true });

        // cập nhật tiến trình theo từng suggestion
        const progressValue = Math.round(((cIndex + sIndex / suggestions.length) / conflicts.length) * 50);
        setProgress(progressValue);
        await new Promise(res => setTimeout(res, 10)); // delay nhẹ để UI update
      }
    }

    // 2️⃣ Reload toàn bộ TKB từ Firestore
    setContextRows([]);
    const gvbmSnapshot = await getDocs(collection(db, "GVBM_2025-2026"));
    const gvbmData = gvbmSnapshot.docs.map(docSnap => {
      const { hoTen, monDay } = docSnap.data();
      return { hoTen, monHoc: monDay || [], monDay: monDay || [] };
    });

    const normalizeName = name =>
      name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "_");

    const mergedData = await Promise.all(
      gvbmData.map(async (item, index) => {
        const docId = normalizeName(item.hoTen);
        const tkbDoc = await getDoc(doc(db, "TKB_GVBM_2025-2026", docId));
        const tkbData = tkbDoc.exists() ? tkbDoc.data().schedule || [] : [];
        setProgress(50 + Math.round(((index + 1) / gvbmData.length) * 50)); // tiến trình 50-100%
        await new Promise(res => setTimeout(res, 10)); // delay nhẹ
        return { ...item, stt: index + 1, tkb: tkbData };
      })
    );

    mergedData.sort((a, b) => {
      const monA = Array.isArray(a.monDay) ? a.monDay[0] : a.monDay;
      const monB = Array.isArray(b.monDay) ? b.monDay[0] : b.monDay;
      return monA.localeCompare(monB, "vi", { sensitivity: "base" });
    });

    setContextRows(mergedData);

    const currentGV = mergedData.find(gv => gv.hoTen === selectedGV);
    if (currentGV) setSchedule(currentGV.tkb);

    setProgress(100); // đảm bảo tiến trình full
    setUpdateDone(true);
    //alert("✅ Đã áp dụng các đề xuất xung đột lên Firestore và đồng bộ TKB!");
  } catch (err) {
    console.error("❌ Lỗi khi ghi Firestore:", err);
    alert("❌ Có lỗi khi ghi Firestore. Xem console để kiểm tra chi tiết.");
  } finally {
    setUpdating(false); // tắt trạng thái cập nhật
  }
};

const handleCheckSchedule_Dexuat = () => {
  if (!currentDocId || !tkbAllTeachers) return;

  const tkb = tkbAllTeachers[currentDocId];
  if (!tkb) return;

  const scheduleMap = {}; // buoi -> ngay -> tiet -> [{ gv, value }]
  const errorsMap = {};   // key: day|session|periodIndex|class -> mảng { gvName, subject }

  for (const gvId in tkb) {
    const gvData = tkb[gvId];
    for (const day of Object.keys(gvData)) {
      for (const session of ["morning", "afternoon"]) {
        const periods = gvData[day]?.[session];
        if (!Array.isArray(periods)) continue;

        periods.forEach((tiet, idx) => {
          if (!tiet || !tiet.class) return;

          const lop = tiet.class.trim();
          const mon = (tiet.subject || "?").trim();
          const key = `${day}|${session}|${idx}|${lop}`;

          if (!errorsMap[key]) errorsMap[key] = [];
          errorsMap[key].push({ gvName: formatGVName(gvId), subject: mon });

          // build scheduleMap để dùng cho đề xuất
          if (!scheduleMap[session]) scheduleMap[session] = {};
          if (!scheduleMap[session][day]) scheduleMap[session][day] = {};
          if (!scheduleMap[session][day][idx]) scheduleMap[session][day][idx] = [];
          scheduleMap[session][day][idx].push({
            gv: formatGVName(gvId),
            value: `${lop} ${mon}`,
          });
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

    const gvTrung = arr.map(a => a.gvName);
    const gvCoBlock = gvTrung.find(gvName =>
      laBlockLienTiep(session, day, lop, gvName, scheduleMap)
    );

    let gvGiuNguyen, gvCanChuyen;
    if (gvCoBlock) {
      gvGiuNguyen = gvCoBlock;
      gvCanChuyen = gvTrung.filter(gv => gv !== gvCoBlock);
    } else {
      gvGiuNguyen = gvTrung[0];
      gvCanChuyen = gvTrung.slice(1);
    }

    let msg = `⚠️ Lớp ${lop} (${sessionLabel} ${day}, tiết ${periodNumber}) có ${arr.length} GV cùng dạy: ${gvTrung.join(", ")}\n`;
    msg += `* Đề xuất\n`;
    msg += `- ${gvGiuNguyen}: giữ nguyên\n`;
    msg += gvCanChuyen.map(gv => {
      const deXuat = deXuatChoTrong(gv, lop, scheduleMap);
      return `- ${gv}: 👉 ${deXuat.replace(/tiết (\d+)/g, "(tiết $1)")}`;
    }).join("\n");

    errorMessages.push(msg.trim());
  }

  setConflicts(errorMessages.length > 0 ? errorMessages : ["✅ Không phát hiện trùng tiết trong TKB"]);
  setShowConflicts(true);
};

const handleCheckSchedule = () => {
  if (!currentDocId || !tkbAllTeachers) return;

  const tkb = tkbAllTeachers[currentDocId];
  if (!tkb) return;

  const errorsMap = {}; // key: day|session|periodIndex|class -> mảng { gvName, subject }

  for (const gvId in tkb) {
    const gvData = tkb[gvId];
    for (const day of Object.keys(gvData)) {
      for (const session of ["morning", "afternoon"]) {
        const periods = gvData[day]?.[session];
        if (!Array.isArray(periods)) continue;

        periods.forEach((tiet, idx) => {
          if (!tiet || !tiet.class) return;

          const lop = tiet.class.trim();
          const mon = (tiet.subject || "?").trim();
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
      msg += `    - ${gv.gvName} (${gv.subject})\n`;
    });

    errorMessages.push(msg.trim());
  }

  setConflicts(errorMessages.length > 0 ? errorMessages : ["✅ Không phát hiện trùng tiết trong TKB"]);
  setShowConflicts(true);
};

// Hàm chuyển gvId thành tên có dấu
const formatGVName = gvId => {
  const gv = contextRows?.find(r => convertHoTenToId(r.hoTen) === gvId);
  return gv ? gv.hoTen : gvId;
};

const checkInlineConflict = (sessionLabel, day, period, lopName) => {
  if (!lopName || !currentDocId || !tkbAllTeachers) return [];

  const sessionKey = sessionLabel === "SÁNG" ? "morning" : "afternoon";
  const conflicts = [];

  const data = tkbAllTeachers[currentDocId] || {};

  for (const gvId in data) {
    const schedule = data[gvId];
    if (!schedule) continue;
    const dayData = schedule[day];
    if (!dayData) continue;
    const buoiData = dayData[sessionKey];
    if (!Array.isArray(buoiData)) continue;

    buoiData.forEach(slot => {
      if (!slot) return;
      if (slot.class === lopName && slot.period === period) {
        conflicts.push({
          gvId,
          lop: slot.class,
          period: slot.period,
          day,
          sessionLabel
        });
      }
    });
  }

  return conflicts;
};


const checkInlineConflict_OK = (sessionLabel, day, period, lopName) => {
  if (!lopName || !currentDocId || !tkbAllTeachers) return [];

  const sessionKey = sessionLabel === "SÁNG" ? "morning" : "afternoon";
  const conflictsGV = [];

  // Lấy TKB từ context
  const data = tkbAllTeachers[currentDocId] || {};

  for (const gvId in data) {
    const schedule = data[gvId];
    if (!schedule) continue;
    const dayData = schedule[day];
    if (!dayData) continue;
    const buoiData = dayData[sessionKey];
    if (!Array.isArray(buoiData)) continue;

    buoiData.forEach(slot => {
      if (!slot) return;
      if (slot.class === lopName && slot.period === period) {
        conflictsGV.push(gvId);
      }
    });
  }

  return conflictsGV;
};

// Dùng để hiển thị tên lớp + hậu tố môn
const formatClassSubject = (cell, selectedMon) => {
  if (!cell) return "";

  const lopRaw = typeof cell === "string" ? cell : (cell.class || "");
  const subjectRaw = typeof cell === "string" ? "" : (cell.subject || "").toLowerCase();

  // Nếu lớp đã có hậu tố → giữ nguyên
  if (/\(.+\)$/.test(lopRaw)) return lopRaw;

  const mapping = {
    "công nghệ": "CN",
    "âm nhạc": "AN",
    "mĩ thuật": "MT",
    "mỹ thuật": "MT",
    "đạo đức": "ĐĐ",
    "thể dục": "TD",
    "tin học": ""
  };

  const monList = selectedMon.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const isMulti = monList.length > 1;

  if (!isMulti || subjectRaw === "tin học") return lopRaw;

  const vietTat = mapping[subjectRaw] || subjectRaw.toUpperCase();
  return vietTat ? `${lopRaw} (${vietTat})` : lopRaw;
};

const renderScheduleTable = (session) => {
  const cellWidthTiet = 60;
  const cellWidthDay = 140;

  const headerCellStyle = {
    fontWeight: "bold",
    padding: "4px",
    bgcolor: "#1976d2",
    color: "#fff"
  };

  const optionItems = (lopOptions || [])
    .map(lop => ({ value: lop, label: lop.replace(/\s*\(TH\)$/, "") }))
    .filter((item, i, arr) => arr.findIndex(x => x.value === item.value) === i);

  return (
    <Box sx={{ mt: 2, mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 2 }}>
        {session}
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ height: 36 }}>
              <TableCell align="center" sx={{ ...headerCellStyle, width: cellWidthTiet }}>
                Tiết
              </TableCell>
              {days.map(day => (
                <TableCell key={day} align="center" sx={{ ...headerCellStyle, width: cellWidthDay }}>
                  {day}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {periodsBySession[session].map((period, idx) => (
              <TableRow key={period} sx={{ height: 36 }}>
                <TableCell align="center" sx={{ padding: "4px" }}>{period}</TableCell>

                {days.map(day => {
                  const rawCell = schedule?.[session]?.[day]?.[idx] ?? "";
                  const abbrMap = {
                    "công nghệ": "CN",
                    "âm nhạc": "AN",
                    "mĩ thuật": "MT",
                    "mỹ thuật": "MT",
                    "đạo đức": "ĐĐ",
                    "thể dục": "TD",
                    "tin học": "TH"
                  };

                  const findBestOption = (rc) => {
                    const opts = lopOptions || [];
                    if (!rc) return "";

                    if (typeof rc === "object") {
                      const base = (rc.class || "").trim();
                      const subject = (rc.subject || "").trim();
                      const labelByFn = formatClassSubject({ class: base, subject }, selectedMon);
                      if (labelByFn && opts.includes(labelByFn)) return labelByFn;
                      if (opts.includes(base)) return base;
                      const matches = opts.filter(o => o.startsWith(base + " "));
                      if (matches.length === 1) return matches[0];
                      if (subject) {
                        const abbr = abbrMap[subject.toLowerCase()] || subject;
                        const candidate = matches.find(m => m.includes(`(${abbr})`) || m.toLowerCase().includes(`(${subject.toLowerCase()})`));
                        if (candidate) return candidate;
                      }
                      return matches[0] || base || "";
                    }

                    if (typeof rc === "string") {
                      const m = rc.match(/^(.+?)\s*(?:\((.+?)\))?$/);
                      const base = m ? m[1].trim() : rc.trim();
                      const suffix = m && m[2] ? m[2].trim() : "";
                      if (suffix && opts.includes(rc)) return rc;
                      if (opts.includes(base)) return base;
                      const matches = opts.filter(o => o.startsWith(base + " "));
                      if (matches.length === 1) return matches[0];

                      const mons = (selectedMon || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
                      if (matches.length > 1 && mons.length > 0) {
                        for (const mon of mons) {
                          const abbr = abbrMap[mon] || null;
                          if (abbr) {
                            const cand = matches.find(m => m.includes(`(${abbr})`));
                            if (cand) return cand;
                          }
                          const cand2 = matches.find(m => m.toLowerCase().includes(`(${mon})`));
                          if (cand2) return cand2;
                        }
                      }
                      return matches[0] || "";
                    }
                    return "";
                  };

                  const bestOption = findBestOption(rawCell);

                  const renderLabelFromOption = (opt, rc) => {
                    if (!opt) return "---";
                    if (typeof rc === "object" && rc.class) {
                      return formatClassSubject({ class: rc.class, subject: rc.subject || "" }, selectedMon) || opt.replace(/\s*\(TH\)$/, "");
                    }
                    const mm = opt.match(/^(.+?)\s*(?:\((.+?)\))?$/);
                    const base = mm ? mm[1].trim() : opt;
                    const suffix = mm && mm[2] ? mm[2].trim().toLowerCase() : "";
                    if (suffix === "th") return base;
                    return opt;
                  };

                  return (
                    <TableCell key={day} align="center" sx={{ padding: "4px" }}>
                      <TextField
                        select
                        size="small"
                        value={bestOption}
                        sx={{
                          width: "100%",
                          "& .MuiSelect-icon": { display: "none" },
                          "&:hover .MuiSelect-icon": { display: "block" }
                        }}
                        onChange={async e => {  // ✅ async
                          const newValue = e.target.value;
                          const m = newValue.match(/^(.+?)\s*(?:\((.+?)\))?$/);
                          const base = m ? m[1].trim() : newValue;
                          const suffix = m && m[2] ? m[2].trim() : "";
                          const subjectFromClass = suffix && suffix.toLowerCase() !== "th" ? suffix : "";

                          // ✅ Kiểm tra xung đột trước khi cập nhật
                          const conflictsGV = await checkInlineConflict(session, day, idx + 1, base);
                          
                          {/*if (conflictsGV.length > 0) {
                            setInlineConflicts([
                              `⚠️ Lớp ${base}: trùng tiết (GV: ${conflictsGV.map(gvId => formatGVName(gvId)).join(", ")})`
                            ]);
                            setTimeout(() => setInlineConflicts([]), 4000);
                            return; // ❌ Ngăn ghi trùng tiết
                          }*/}

                          if (conflictsGV.length > 0) {
                            const messages = conflictsGV.map(c => 
                              `⚠️ Trùng tiết với ${formatGVName(c.gvId)} (${c.lop} - tiết ${c.period})`
                            );
                            setInlineConflicts(messages);
                            setTimeout(() => setInlineConflicts([]), 4000);
                            return; // ❌ Ngăn ghi trùng tiết
                          }


                          // Không trùng → cập nhật schedule
                          const updatedSchedule = { ...schedule };
                          if (!updatedSchedule[session]) updatedSchedule[session] = {};
                          if (!Array.isArray(updatedSchedule[session][day])) {
                            updatedSchedule[session][day] = Array(periodsBySession[session].length).fill({ class: "", subject: "" });
                          }

                          updatedSchedule[session][day][idx] = { class: base, subject: subjectFromClass, period: idx + 1 };

                          setSchedule(updatedSchedule);
                          setContextRows(prev => prev.map(gv => gv.hoTen === selectedGV ? { ...gv, tkb: updatedSchedule } : gv));
                        }}
                        renderValue={selected => renderLabelFromOption(selected, rawCell)}
                      >
                        <MenuItem value="">
                          <em>---</em>
                        </MenuItem>
                        {optionItems.map(item => (
                          <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;

return (
  <Box sx={{ px: { xs: 1, sm: 3 }, py: 4, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
  <Paper
    elevation={4}
    sx={{
      maxWidth: 750,
      mx: "auto",
      p: 3,
      borderRadius: 3,
      position: "relative" // 👈 thêm dòng này
    }}
  >
    {/* Nút Lưu (icon) ở góc trên trái */}
      {/*<Tooltip title="Lưu">
        <IconButton
          onClick={saveTKB_GVBM}
          sx={{ position: "absolute", top: 8, left: 8, color: "black" }}
          size="small"
        >
          <SaveIcon />
        </IconButton>
      </Tooltip>*/}

    <Typography
      variant="h5"
      align="center"
      fontWeight="bold"
      color="primary"
      gutterBottom
      sx={{ mt: 1, mb: 4 }}
    >
      XẾP THỜI KHÓA BIỂU GVBM
    </Typography>

    {/* Chọn GV */}
    <Grid container alignItems="center" sx={{ mt: 4, mb: 1 }} justifyContent="space-between">
      <Box sx={{ display: "flex", gap: 2, flexDirection: "column" }}>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            select
            label="GV bộ môn"
            value={selectedGV}
            size="small"
            onChange={async e => {
              const hoTen = e.target.value;
              setSelectedGV(hoTen);

              const newSchedule = getGVSchedule(hoTen, contextRows, tkbAllTeachers, currentDocId);
              setSchedule(newSchedule);

              await fetchPhanCongLop(hoTen);
            }}


            sx={{ width: 270 }}
          >
            {rows
              .slice() // tạo bản sao tránh mutate mảng gốc
              .sort((a, b) => {
                const getLastName = (fullName) => fullName.trim().split(" ").slice(-1)[0].toLowerCase();
                return getLastName(a.hoTen).localeCompare(getLastName(b.hoTen));
              })
              .map(row => (
                <MenuItem key={row.hoTen} value={row.hoTen}>
                  {row.hoTen}
                </MenuItem>
              ))}
          </TextField>
        </Box>
      </Box>
      <Typography variant="body1" sx={{ minWidth: 120, textAlign: "right" }}>
        Tổng số tiết: <strong>{tinhTongTiet()}</strong>
      </Typography>
    </Grid>

    {/* Thông báo check toàn bộ */}
    {showConflicts && conflicts.length > 0 && (
      <Card
        sx={{ bgcolor: "#fff3e0", border: "1px solid #f39c12", p: 2, mb: 3 }}
      >
        {/* Nội dung thông báo */}
        {updateDone ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 2 }}>
            <CheckIcon color="success" sx={{ fontSize: 30 }} />
            <Typography variant="h6" sx={{ color: "success.main", fontWeight: "bold", fontSize: 20 }}>
              Đã chỉnh sửa xong TKB
            </Typography>
          </Box>
        ) : conflicts[0] === "✅ Không phát hiện xung đột TKB" ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 2 }}>
            <CheckIcon color="success" sx={{ fontSize: 30 }} />
            <Typography variant="h6" sx={{ color: "success.main", fontWeight: "bold", fontSize: 20 }}>
              Không phát hiện trùng tiết trong TKB
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="h6" color="warning.main" sx={{ mb: 2 }}>
              Phát hiện trùng tiết:
            </Typography>
            <Box sx={{ maxHeight: 400, overflowY: "auto", mb: 2 }}>
              {conflicts.map((c, i) => (
                <Typography key={i} variant="body2" sx={{ whiteSpace: "pre-line", mb: 1 }}>
                  {c}
                </Typography>
              ))}
            </Box>
          </>
        )}

        {/* Nút xử lý */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 2 }}>
          <Box sx={{ display: "flex", gap: 2 }}>
            {!updateDone && conflicts[0] !== "✅ Không phát hiện xung đột TKB" ? (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleUpdateConflicts}
                  disabled={updating}
                  startIcon={<CheckCircleIcon />}
                >
                  Đồng ý
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => setShowConflicts(false)}
                  disabled={updating}
                  startIcon={<CancelIcon />}
                >
                  Hủy
                </Button>
              </>
            ) : (
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => setShowConflicts(false)}
                disabled={updating}
                startIcon={<CloseIcon />}
              >
                Đóng
              </Button>
            )}
          </Box>

          {updating && (
            <Box sx={{ width: 200, textAlign: "center", mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ mb: 0, height: 3, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                Đang cập nhật TKB... {progress}%
              </Typography>
            </Box>
          )}
        </Box>
      </Card>
    )}

    {/* Bảng TKB */}
    {renderScheduleTable("SÁNG")}
    {renderScheduleTable("CHIỀU")}

    {/* ⚡️ Thông báo cảnh báo inline khi nhập */}
    {inlineConflicts.length > 0 && (
      <Box sx={{ my: 2, p: 2, borderRadius: 2, bgcolor: "#ffebee", border: "1px solid #e57373" }}>
        {inlineConflicts.map((msg, i) => (
          <Typography key={i} variant="body2" color="error" sx={{ mb: 0.5 }}>
            {msg}
          </Typography>
        ))}
      </Box>
    )}

    {/* Nút lưu + kiểm tra */}
    <Grid container justifyContent="center" spacing={2}>
      <Grid item>
        {/*<Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={saveTKB_GVBM}
        >
          Lưu
        </Button>*/}
      </Grid>

      <Grid item>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<CheckIcon />}
          onClick={handleCheckSchedule}
        >
          Kiểm tra
        </Button>
      </Grid>
    </Grid>

    {/* Thanh tiến trình */}
    {/*{saving && (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <Box sx={{ width: 200, textAlign: "center" }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ mb: 0, height: 3, borderRadius: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            Đang lưu... {progress}%
          </Typography>
        </Box>
      </Box>
    )}*/}

    {checking && (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <Box sx={{ width: 200, textAlign: "center" }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ mb: 0, height: 3, borderRadius: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            Đang kiểm tra... {progress}%
          </Typography>
        </Box>
      </Box>
    )}
  </Paper>
</Box>

  );
}
