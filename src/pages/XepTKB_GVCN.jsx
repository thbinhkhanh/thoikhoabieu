import React, { useState, useEffect } from "react";
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
  Select, 
  LinearProgress,
  IconButton,
  Tooltip
} from "@mui/material";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useGVCN } from "../contexts/ContextGVCN";
//import SaveIcon from "@mui/icons-material/Save";
import { monHocContext } from "../contexts/monHocContext";
import { useSchedule } from "../contexts/ScheduleContext";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ExcelJS from "exceljs"; // nếu chưa import

const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
const periodsBySession = {
  SÁNG: [1, 2, 3, 4, 5],
  CHIỀU: [1, 2, 3, 4],
};

const defaultSchedule = {
  SÁNG: { "Thứ 2": ["", "", "", "", ""], "Thứ 3": ["", "", "", "", ""], "Thứ 4": ["", "", "", "", ""], "Thứ 5": ["", "", "", "", ""], "Thứ 6": ["", "", "", "", ""] },
  CHIỀU: { "Thứ 2": ["", "", "", "", ""], "Thứ 3": ["", "", "", "", ""], "Thứ 4": ["", "", "", "", ""], "Thứ 5": ["", "", "", "", ""], "Thứ 6": ["", "", "", "", ""] },
};

// Dữ liệu lớp theo khối
const khoiLopData = {
  1: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"],
  2: ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"],
  3: ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"],
  4: ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"],
  5: ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"],
};

const scheduleContext = {}; 

export default function XepTKB_GVCN({ setSaveHandler }) {
  const [rows, setRows] = useState([]);
  const [khoi, setKhoi] = useState("1");
  const [lop, setLop] = useState(khoiLopData["1"][0]);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [loading, setLoading] = useState(false);
  const [danhSachMonHoc, setDanhSachMonHoc] = useState([]);
  
  const { 
    contextRows, 
    setContextRows, 
    contextSchedule, 
    setContextSchedule,
    allSchedules,
    setAllSchedules,
    contextMonHoc,
    setContextMonHoc
  } = useGVCN();

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tenLop, setTenLop] = useState("");
  const [giaoVienId, setGiaoVienId] = useState("");
  const { tkbAllTeachers, currentDocId, selectedFileId, setTkbAllTeachers } = useSchedule();

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importClass, setImportClass] = useState("");

  const handleChange = (session, day, idx, value) => {
    const newSchedule = { ...schedule };
    newSchedule[session] = { ...newSchedule[session] };
    newSchedule[session][day] = [...newSchedule[session][day]];
    newSchedule[session][day][idx] = value;
    setSchedule(newSchedule);
  };

const fetchMonHocTheoLop = async (tenLopRaw, db, setDanhSachMonHoc) => {
  // Chuẩn hóa tên lớp
  const tenLop = typeof tenLopRaw === "string"
    ? tenLopRaw.trim()
    : tenLopRaw?.value?.trim() || "";

  if (!tenLop) {
    setDanhSachMonHoc([]);
    return;
  }

  const khoi = `K${tenLop.split(".")[0]}`;

  try {
    // Lấy môn học từ context nếu có
    let monHocGoc = monHocContext[khoi];
    if (monHocGoc && monHocGoc.length > 0) {
      //console.log(`📦 Lấy môn học cho lớp ${tenLop} từ context`);
    } else {
      // Nếu chưa có trong context → fetch từ Firestore
      const monHocRef = doc(db, "MONHOC_2025-2026", khoi);
      const monHocSnap = await getDoc(monHocRef);
      monHocGoc = monHocSnap.exists() ? monHocSnap.data().monHoc || [] : [];

      // Cập nhật context
      monHocContext[khoi] = monHocGoc;

      //console.log(`📦 Lấy môn học cho lớp ${tenLop} từ Firestore`);
    }

    // Lấy danh sách môn đã phân công
    const phanCongCollection = collection(db, "PHANCONG_2025-2026");
    const phanCongDocs = await getDocs(phanCongCollection);
    const monDaPhanCong = [];

    phanCongDocs.forEach(docSnap => {
      const data = docSnap.data();
      const phanCong = data.phanCong || {};
      Object.entries(phanCong).forEach(([mon, dsLop]) => {
        if (Array.isArray(dsLop) && dsLop.includes(tenLop)) {
          monDaPhanCong.push(mon);
        }
      });
    });

    // Lọc môn học chưa phân công
    const monHocLoc = monHocGoc.filter(mon => !monDaPhanCong.includes(mon));

    setDanhSachMonHoc(monHocLoc);

  } catch (err) {
    setDanhSachMonHoc([]);
  }
};

useEffect(() => {
  if (lop?.trim()) {
    //console.log("📦 useEffect gọi fetchMonHocTheoLop với:", lop);
    fetchMonHocTheoLop(lop.trim(), db, setDanhSachMonHoc);
  } else {
    console.warn("⚠️ Chưa đủ dữ liệu để gọi fetchMonHocTheoLop:", { lop });
  }
}, [lop]);


  // Fetch tên GVCN và lớp dạy từ Firestore nếu context rỗng
  const fetchData = async () => {
    if (contextRows && contextRows.length > 0) {
      setRows(contextRows);
      return;
    }

    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "GVCN_2025-2026"));
      let data = querySnapshot.docs
        .map(doc => {
          const { hoTen, lop } = doc.data();
          return { hoTen, lop };
        })
        .filter(item => item.hoTen && item.lop);

      // Sắp xếp theo lớp
      data.sort((a, b) => a.lop.localeCompare(b.lop, "vi", { sensitivity: "base" }));

      // Đánh lại STT
      data = data.map((item, index) => ({ ...item, stt: index + 1 }));

      setRows(data);
      setContextRows(data);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu GVCN từ Firestore:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  
{/*const getGVBMFromContext = async (baseSchedule, lopName, currentDocId, tkbAllTeachers) => {
  try {
    // --- 1. Lấy dữ liệu GVBM ---
    const gvbmData = tkbAllTeachers?.[currentDocId];
    if (!gvbmData) {
      console.warn(`[getGVBMFromContext] Không tìm thấy dữ liệu GVBM cho file ${currentDocId}`);
      return baseSchedule;
    }

    // --- 2. Clone baseSchedule ---
    const mergedSchedule = JSON.parse(JSON.stringify(baseSchedule));

    // --- 3. Thu thập tất cả môn học GVBM ---
    const gvbmSubjects = new Set();
    Object.values(gvbmData).forEach(gvSchedule => {
      days.forEach(day => {
        const dayData = gvSchedule[day];
        if (!dayData) return;
        (dayData.morning || []).forEach(slot => slot?.subject && gvbmSubjects.add(slot.subject));
        (dayData.afternoon || []).forEach(slot => slot?.subject && gvbmSubjects.add(slot.subject));
      });
    });

    // --- 4. Xoá slot trùng môn ---
    ["SÁNG", "CHIỀU"].forEach(session => {
      days.forEach(day => {
        mergedSchedule[session][day] = mergedSchedule[session][day].map(subj =>
          gvbmSubjects.has(subj) ? "" : subj
        );
      });
    });

    // --- 5. Merge GVBM vào lớp ---
    Object.entries(gvbmData).forEach(([gvId, gvSchedule]) => {
      days.forEach(day => {
        const dayData = gvSchedule[day];
        if (!dayData) return;

        (dayData.morning || []).forEach((slot, idx) => {
          if (slot && slot.class === lopName && slot.subject?.trim()) {
            mergedSchedule.SÁNG[day][idx] = slot.subject;
          }
        });

        (dayData.afternoon || []).forEach((slot, idx) => {
          if (slot && slot.class === lopName && slot.subject?.trim()) {
            mergedSchedule.CHIỀU[day][idx] = slot.subject;
          }
        });
      });
    });

    //console.log(`[Merge] Đã xoá và merge TKB GVBM lớp ${lopName} từ file ${currentDocId}`);

    // --- 6. Ghi schedule vào Firestore ---
    await setDoc(doc(db, "TKB_LOP_2025-2026", lopName), { schedule: mergedSchedule }, { merge: true });
    //console.log(`[Firestore] Đã cập nhật TKB lớp ${lopName} vào Firestore`);

    return mergedSchedule;

  } catch (error) {
    console.error(`[Error] Lỗi merge và lưu TKB GVBM cho lớp ${lopName}:`, error);
    return baseSchedule;
  }
};*/}

const fetchAllSchedules = async () => { 
  if (!currentDocId) return;

  try {
    const gvcnDocRef = doc(db, "TKB_GVCN", currentDocId);
    const gvcnSnap = await getDoc(gvcnDocRef);

    if (gvcnSnap.exists()) {
      const gvcnData = gvcnSnap.data();

      // Lấy trực tiếp từ Firestore, giữ nguyên cấu trúc
      const loadedData = {};
      Object.entries(gvcnData).forEach(([lopName, scheduleData]) => {
        loadedData[lopName] = scheduleData;
      });

      setContextSchedule(loadedData);
      //console.log("✅ Đã load toàn bộ TKB vào context:", loadedData);

      // Nếu lớp hiện tại đang chọn, set luôn state schedule
      if (lop && loadedData[lop]) {
        setSchedule(loadedData[lop]);
      }
    } else {
      console.warn("⚠️ Không tìm thấy document TKB_GVCN", currentDocId);
    }
  } catch (error) {
    console.error("❌ Lỗi load toàn bộ TKB_GVCN:", error);
  }
};

useEffect(() => {
  if (!currentDocId) return;
  fetchAllSchedules();
}, [currentDocId]);

const fetchScheduleForLop = async (lopName) => {
  if (!lopName) return;

  // 1️⃣ Kiểm tra context trước
  if (contextSchedule?.[lopName]) {
    //console.log("✅ Lấy schedule từ context:", lopName, contextSchedule[lopName]);
    setSchedule(contextSchedule[lopName]);
    return;
  }

  // 2️⃣ Nếu context chưa có, fetch Firestore
  try {
    if (!currentDocId) {
      console.warn("⚠️ currentDocId chưa có, dùng schedule rỗng");
      const emptySchedule = { SÁNG: {}, CHIỀU: {} };
      days.forEach(day => {
        emptySchedule.SÁNG[day] = Array(5).fill(null);
        emptySchedule.CHIỀU[day] = Array(4).fill(null);
      });
      setSchedule(emptySchedule);
      return;
    }

    const gvcnDocRef = doc(db, "TKB_GVCN", currentDocId);
    const gvcnSnap = await getDoc(gvcnDocRef);

    let finalSchedule;
    if (gvcnSnap.exists()) {
      const gvcnData = gvcnSnap.data();
      // Lấy trực tiếp schedule lớp
      finalSchedule = gvcnData[lopName] || { SÁNG: {}, CHIỀU: {} };
      // Đảm bảo đầy đủ số tiết
      ["SÁNG", "CHIỀU"].forEach(session => {
        const numPeriods = session === "SÁNG" ? 5 : 4;
        days.forEach(day => {
          finalSchedule[session][day] = finalSchedule[session][day] || Array(numPeriods).fill(null);
        });
      });
      //console.log("📦 Lấy schedule từ Firestore:", lopName, finalSchedule);
    } else {
      console.warn("⚠️ Không tìm thấy document TKB_GVCN", currentDocId);
      finalSchedule = { SÁNG: {}, CHIỀU: {} };
      days.forEach(day => {
        finalSchedule.SÁNG[day] = Array(5).fill(null);
        finalSchedule.CHIỀU[day] = Array(4).fill(null);
      });
    }

    setSchedule(finalSchedule);

  } catch (error) {
    console.error("❌ Lỗi fetchScheduleForLop:", error);
    const emptySchedule = { SÁNG: {}, CHIỀU: {} };
    days.forEach(day => {
      emptySchedule.SÁNG[day] = Array(5).fill(null);
      emptySchedule.CHIỀU[day] = Array(4).fill(null);
    });
    setSchedule(emptySchedule);
  }
};

useEffect(() => {
  if (!lop) return;
  fetchScheduleForLop(lop);
}, [lop, currentDocId]);

  const handleKhoiChange = (event) => {
    const newKhoi = event.target.value;
    setKhoi(newKhoi);
    setLop(khoiLopData[newKhoi][0]);
  };

  //Lưu theo cấu trúc render
  const saveTKB_GVCN = async () => {
    if (!currentDocId) return; 
    setSaving(true);
    setProgress(0);

    try {
      const colRef = collection(db, "TKB_LOP_2025-2026");
      const colSnap = await getDocs(colRef);
      const allDocs = colSnap.docs;
      const totalDocs = allDocs.length;

      const gvcnDocRef = doc(db, "TKB_GVCN", currentDocId);
      const gvcnSnap = await getDoc(gvcnDocRef);
      const gvcnData = gvcnSnap.exists() ? gvcnSnap.data() : {};

      let progressCounter = 0;

      for (const docSnap of allDocs) {
        const lopName = docSnap.id;
        const oldData = docSnap.exists() ? docSnap.data() : { schedule: defaultSchedule };

        // Merge dữ liệu cũ với dữ liệu state
        const mergedSchedule = { SÁNG: {}, CHIỀU: {} };
        ["SÁNG", "CHIỀU"].forEach(session => {
          const numPeriods = session === "SÁNG" ? 5 : 4;
          days.forEach(day => {
            // Dữ liệu cũ
            const oldPeriods = oldData.schedule?.[session]?.[day] || Array(numPeriods).fill(null);
            mergedSchedule[session][day] = [...oldPeriods];

            // Nếu lớp hiện tại là lớp đang chọn trong state, merge dữ liệu mới
            if (lopName === lop) {
              const newPeriods = schedule[session]?.[day] || [];
              newPeriods.forEach((val, idx) => {
                if (idx < numPeriods) {
                  mergedSchedule[session][day][idx] = val !== "" ? val : null;
                }
              });
            }
          });
        });

        // Ghi trực tiếp mergedSchedule vào gvcnData theo cấu trúc chuẩn
        gvcnData[lopName] = mergedSchedule;

        // Cập nhật tiến trình
        progressCounter++;
        setProgress(Math.floor((progressCounter / totalDocs) * 100));
      }

      // Lưu tất cả lớp vào Firestore
      await setDoc(gvcnDocRef, gvcnData, { merge: true });
      setProgress(100);

    } catch (error) {
      console.error("Lỗi khi lưu thời khóa biểu:", error);
      alert("Lưu thời khóa biểu thất bại. Xem console để biết chi tiết.");
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  //Lưu theo cấu trúc render
  const saveTKB_GVCN1 = async () => {
    if (!lop || !currentDocId) return; // lop: tên lớp, currentDocId: tên file mở
    setSaving(true);
    setProgress(0);

    try {
      const gvcnDocRef = doc(db, "TKB_GVCN", currentDocId);
      setProgress(10);

      const gvcnSnap = await getDoc(gvcnDocRef);
      const gvcnData = gvcnSnap.exists() ? gvcnSnap.data() : {};
      setProgress(30);

      // Lấy dữ liệu cũ của lớp từ gvcnData
      const oldClassSchedule = gvcnData[lop] || {};

      // Merge dữ liệu mới với cũ theo cấu trúc SÁNG/CHIỀU → ngày → [array]
      const mergedSchedule = { SÁNG: {}, CHIỀU: {} };
      ["SÁNG", "CHIỀU"].forEach(session => {
        const numPeriods = session === "SÁNG" ? 5 : 4;
        days.forEach(day => {
          const oldPeriods =
            oldClassSchedule[session]?.[day] || Array(numPeriods).fill(null);
          const newPeriods = schedule[session]?.[day] || [];
          const mergedPeriods = [...oldPeriods];

          newPeriods.forEach((val, idx) => {
            if (idx < numPeriods) {
              mergedPeriods[idx] = val !== "" ? val : null;
            }
          });

          mergedSchedule[session][day] = mergedPeriods;
        });
      });

      setProgress(60);

      // Ghi trực tiếp mergedSchedule vào Firestore theo cấu trúc đúng
      gvcnData[lop] = mergedSchedule;
      await setDoc(gvcnDocRef, gvcnData, { merge: true });
      setProgress(100);

      // --- Cập nhật cache / state ---
      scheduleContext[lop] = mergedSchedule;             // cache trực tiếp
      setSchedule(mergedSchedule);                       // cập nhật state component
      setContextSchedule(prev => ({ ...prev, [lop]: mergedSchedule })); // cập nhật context state

    } catch (error) {
      console.error("Lỗi khi lưu thời khóa biểu:", error);
      alert("Lưu thời khóa biểu thất bại. Xem console để biết chi tiết.");
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (
      setSaveHandler &&
      lop &&
      schedule &&
      Object.keys(schedule).length > 0 &&
      days &&
      days.length > 0
    ) {
      setSaveHandler(() => saveTKB_GVCN);
    }
  }, [setSaveHandler, lop, schedule, days]);

  //Lưu firestore
  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!currentDocId) {
      alert("Chưa chọn document để lưu!");
      return;
    }

    try {
      setImporting(true);
      setImportProgress(0);
      setImportClass("");

      // --- Load Excel ---
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const ws = workbook.getWorksheet("TKB Toàn Trường") || workbook.worksheets[0];
      if (!ws) throw new Error("Không tìm thấy worksheet trong file Excel");

      const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
      const blockHeight = 47;
      const tietSang = 5;
      const tietChieu = 4;

      // --- Đếm tổng số lớp ---
      let totalBlocks = 0;
      let tmpOffset = 0;
      while (true) {
        const cell = ws.getCell(`E${7 + tmpOffset}`);
        if (!cell || !cell.value) break;
        totalBlocks++;
        tmpOffset += blockHeight;
      }

      const rowHasRaChoi = (row) => {
        if (!row) return false;
        for (let c = 1; c <= 30; c++) {
          const cv = row.getCell(c).value;
          if (!cv) continue;
          let text = "";
          if (typeof cv === "object" && cv.richText) text = cv.richText.map(t => t.text).join("");
          else text = String(cv);
          if (text && text.toUpperCase().includes("RA CHƠI")) return true;
        }
        return false;
      };

      // --- Import từng lớp ---
      const newSchedules = { ...allSchedules }; // <-- copy context hiện tại
      let offset = 0;
      let processed = 0;

      while (true) {
        const lopCell = ws.getCell(`E${7 + offset}`);
        if (!lopCell || !lopCell.value) break;

        const lopText = String(lopCell.value || "").trim();
        const match = lopText.match(/(\d+\.\d+)$/);
        if (!match) { offset += blockHeight; continue; }
        const lopName = match[1];

        const scheduleFromExcel = { SÁNG: {}, CHIỀU: {} };
        weekdays.forEach(day => {
          scheduleFromExcel.SÁNG[day] = [];
          scheduleFromExcel.CHIỀU[day] = [];
        });

        // --- Lấy Sáng ---
        let scanRow = 10 + offset, collected = 0;
        while (collected < tietSang && scanRow <= offset + blockHeight) {
          const row = ws.getRow(scanRow);
          if (rowHasRaChoi(row)) { scanRow++; continue; }
          const marker = String(row.getCell(4).value || "").trim().toUpperCase();
          if (marker === "TRUY BÀI") { scanRow++; continue; }

          weekdays.forEach((day, idx) => {
            let cell = row.getCell(4 + idx).value;
            if (cell && typeof cell === "object" && cell.richText) cell = cell.richText.map(t => t.text).join("");
            scheduleFromExcel.SÁNG[day].push((cell || "").toString().trim().replace(/\s*\d+$/, ""));
          });
          collected++; scanRow++;
        }

        // --- Lấy Chiều ---
        while (scanRow <= offset + blockHeight) {
          const row = ws.getRow(scanRow);
          const marker = String(row.getCell(4).value || "").trim().toUpperCase();
          if (marker !== "TRUY BÀI" && !rowHasRaChoi(row)) break;
          scanRow++;
        }

        let collectedAf = 0;
        while (collectedAf < tietChieu && scanRow <= offset + blockHeight) {
          const row = ws.getRow(scanRow);
          if (rowHasRaChoi(row)) { scanRow++; continue; }
          const marker = String(row.getCell(4).value || "").trim().toUpperCase();
          if (marker === "TRUY BÀI") { scanRow++; continue; }

          weekdays.forEach((day, idx) => {
            let cell = row.getCell(4 + idx).value;
            if (cell && typeof cell === "object" && cell.richText) cell = cell.richText.map(t => t.text).join("");
            scheduleFromExcel.CHIỀU[day].push((cell || "").toString().trim().replace(/\s*\d+$/, ""));
          });
          collectedAf++; scanRow++;
        }

        // --- Pad đủ độ dài ---
        weekdays.forEach(day => {
          while (scheduleFromExcel.SÁNG[day].length < tietSang) scheduleFromExcel.SÁNG[day].push("");
          while (scheduleFromExcel.CHIỀU[day].length < tietChieu) scheduleFromExcel.CHIỀU[day].push("");
        });

        processed++;
        setImportProgress(Math.round((processed / totalBlocks) * 100));
        setImportClass(lopName);

        newSchedules[lopName] = scheduleFromExcel;
        offset += blockHeight;
      }

      // --- Cập nhật context trước ---
      setAllSchedules(newSchedules);

      // --- Sau đó mới lưu vào Firestore ---
      const gvcnDocRef = doc(db, "TKB_GVCN", currentDocId);
      await setDoc(gvcnDocRef, newSchedules, { merge: true });
      //console.log("✅ Đã cập nhật context và lưu tất cả lớp vào Firestore");

      setImportProgress(100);

    } catch (err) {
      console.error("❌ Lỗi import Excel:", err);
      alert("Import thất bại. Xem console để biết chi tiết.");
    } finally {
      try { e.target.value = null; } catch {}
      setTimeout(() => {
        setImporting(false);
        setImportProgress(0);
        setImportClass("");
      }, 1000);
    }
  };

  {/*useEffect(() => {
    if (lop && allSchedules?.[lop]) {
      setSchedule(allSchedules[lop]);
      //console.log("📥 Cập nhật schedule từ context cho lớp:", lop);
    }
  }, [lop, allSchedules]);*/}

  useEffect(() => {
    if (!lop) return;

    // Kiểm tra contextSchedule cho lớp hiện tại
    if (contextSchedule?.[lop]) {
      setSchedule(contextSchedule[lop]); // cập nhật state component từ context
      //console.log("📥 Cập nhật schedule từ context cho lớp:", lop);
    }
  }, [lop, contextSchedule]);



  //Không lưu firestore
  const handleImportExcel1 = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportProgress(0);
      setImportClass("");

      // load workbook
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const ws = workbook.getWorksheet("TKB Toàn Trường") || workbook.worksheets[0];
      if (!ws) throw new Error("Không tìm thấy worksheet trong file Excel");

      const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
      const blockHeight = 47;
      const tietSang = 5;
      const tietChieu = 4;

      let totalBlocks = 0;
      let tmpOffset = 0;
      while (true) {
        const cell = ws.getCell(`E${7 + tmpOffset}`);
        if (!cell || !cell.value) break;
        totalBlocks++;
        tmpOffset += blockHeight;
      }

      const rowHasRaChoi = (row) => {
        if (!row) return false;
        for (let c = 1; c <= 30; c++) {
          const cv = row.getCell(c).value;
          if (!cv) continue;
          let text = "";
          if (typeof cv === "object" && cv.richText) {
            text = cv.richText.map(t => t.text).join("");
          } else {
            text = String(cv);
          }
          if (text && text.toUpperCase().includes("RA CHƠI")) return true;
        }
        return false;
      };

      let offset = 0;
      let processed = 0;

      while (true) {
        const lopCell = ws.getCell(`E${7 + offset}`);
        if (!lopCell || !lopCell.value) break;

        const lopText = String(lopCell.value || "").trim();
        const match = lopText.match(/(\d+\.\d+)$/);
        if (!match) {
          offset += blockHeight;
          continue;
        }
        const lopName = match[1];
        //console.log(`🔹 Bắt đầu import lớp: ${lopName}`);

        // Khởi tạo schedule
        const scheduleFromExcel = { SÁNG: {}, CHIỀU: {} };
        weekdays.forEach(day => {
          scheduleFromExcel.SÁNG[day] = [];
          scheduleFromExcel.CHIỀU[day] = [];
        });

        // --- Lấy Sáng ---
        let scanRow = 10 + offset;
        let collected = 0;
        while (collected < tietSang && scanRow <= offset + blockHeight) {
          const row = ws.getRow(scanRow);
          if (rowHasRaChoi(row)) { scanRow++; continue; }

          const marker = String(row.getCell(4).value || "").trim().toUpperCase();
          if (marker === "TRUY BÀI") { scanRow++; continue; }

          weekdays.forEach((day, idx) => {
            let cell = row.getCell(4 + idx).value;
            if (cell && typeof cell === "object" && cell.richText) {
              cell = cell.richText.map(t => t.text).join("");
            }
            scheduleFromExcel.SÁNG[day].push((cell || "").toString().trim().replace(/\s*\d+$/, ""));
          });

          collected++;
          scanRow++;
        }

        // --- Lấy Chiều ---
        while (scanRow <= offset + blockHeight) {
          const row = ws.getRow(scanRow);
          const marker = String(row.getCell(4).value || "").trim().toUpperCase();
          if (marker !== "TRUY BÀI" && !rowHasRaChoi(row)) break;
          scanRow++;
        }

        let collectedAf = 0;
        while (collectedAf < tietChieu && scanRow <= offset + blockHeight) {
          const row = ws.getRow(scanRow);
          if (rowHasRaChoi(row)) { scanRow++; continue; }
          const marker = String(row.getCell(4).value || "").trim().toUpperCase();
          if (marker === "TRUY BÀI") { scanRow++; continue; }

          weekdays.forEach((day, idx) => {
            let cell = row.getCell(4 + idx).value;
            if (cell && typeof cell === "object" && cell.richText) {
              cell = cell.richText.map(t => t.text).join("");
            }
            scheduleFromExcel.CHIỀU[day].push((cell || "").toString().trim().replace(/\s*\d+$/, ""));
          });

          collectedAf++;
          scanRow++;
        }

        // Pad đủ độ dài
        weekdays.forEach(day => {
          while (scheduleFromExcel.SÁNG[day].length < tietSang) scheduleFromExcel.SÁNG[day].push("");
          while (scheduleFromExcel.CHIỀU[day].length < tietChieu) scheduleFromExcel.CHIỀU[day].push("");
        });

        processed++;
        setImportProgress(Math.round((processed / totalBlocks) * 100));
        setImportClass(lopName);

        // --- Cập nhật context trực tiếp theo cấu trúc render ---
        setContextSchedule(prev => {
          const updated = { 
            ...prev,
            [lopName]: { 
              SÁNG: { ...scheduleFromExcel.SÁNG },
              CHIỀU: { ...scheduleFromExcel.CHIỀU }
            }
          };
          //console.log(`📥 Context schedule updated cho lớp ${lopName}:`, updated[lopName]);
          return updated;
        });

        // Nếu lớp đang hiển thị, cập nhật state UI
        if (lopName === lop) {
          setSchedule({
            SÁNG: { ...scheduleFromExcel.SÁNG },
            CHIỀU: { ...scheduleFromExcel.CHIỀU }
          });
        }

        offset += blockHeight;
      }

      setImportProgress(100);

    } catch (err) {
      console.error("❌ Lỗi import Excel:", err);
      alert("Import thất bại. Xem console để biết chi tiết.");
    } finally {
      try { e.target.value = null; } catch {}
      setTimeout(() => {
        setImporting(false);
        setImportProgress(0);
        setImportClass("");
      }, 1000);
    }
  };

  const getTotalSelectedPeriods = () => {
    let total = 0;
    ["SÁNG", "CHIỀU"].forEach(session => {
      days.forEach(day => {
        const row = schedule[session][day] || [];
        row.forEach(val => {
          // Chỉ tính ô mà val thuộc danhSachMonHoc hoặc ô trống (có select)
          if (danhSachMonHoc.includes(val) || val === "") {
            if (val && val.trim() !== "") total += 1;
          }
        });
      });
    });
    return total;
  };

  // Hàm render 1 ô trong TKB
  const renderCell = (session, day, idx) => {
  let cellData = schedule[session]?.[day]?.[idx] ?? "";

  // Nếu cellData là object (ví dụ {subject, class, period, double}), lấy subject
  const currentSubject = typeof cellData === "object" && cellData !== null ? cellData.subject || "" : cellData;

  // Nếu môn thuộc danh sách GVCN => Select (giữ style)
  if (danhSachMonHoc.includes(currentSubject) || currentSubject === "") {
    return (
      <Select
        size="small"
        value={currentSubject}
        onChange={(e) => handleChange(session, day, idx, e.target.value)}
        sx={{
          width: "100%",
          "& .MuiSelect-icon": { display: "none" },
          "&:hover .MuiSelect-icon, &:focus .MuiSelect-icon": {
            display: "block",
            color: "black",
          },
        }}
      >
        <MenuItem value="">---</MenuItem>
        {danhSachMonHoc.map((mon, i) => (
          <MenuItem key={i} value={mon}>
            {mon}
          </MenuItem>
        ))}
      </Select>
    );
  }

  // Nếu môn không thuộc danh sách GVCN => Box (hiển thị giống Select)
  return (
    <Box
      sx={{
        width: "100%",
        boxSizing: "border-box",
        height: "40px",
        border: "1px solid rgba(0, 0, 0, 0.23)",
        borderRadius: "4px",
        padding: "6px",
        fontSize: "0.875rem",
        textAlign: "center",
        lineHeight: "24px",
        bgcolor: "#f9f9f9",
      }}
    >
      {currentSubject}
    </Box>
  );
};

  const gvChuNhiem = rows.find((row) => row.lop.trim() === lop.trim())?.hoTen || "";

  // Hàm render bảng TKB cho 1 buổi (SÁNG / CHIỀU)
  const renderScheduleTable = (session) => {
    const cellWidthTiet = 60;
    const cellWidthDay = 140;

    return (
      <Box sx={{ mt: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 2 }}>
          {session}
        </Typography>
        

        {/* Thanh tiến trình Import Excel*/}
        {importing && session === "SÁNG" && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: -5, mb: 1 }}>
            <Box sx={{ width: 260, textAlign: "center" }}>
              <LinearProgress
                variant="determinate"
                value={importProgress}
                sx={{ mb: 0.5, height: 3, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                Đang cập nhật TKB... {importProgress}% {importClass && `(Lớp ${importClass})`}
              </Typography>
            </Box>
          </Box>
        )}
        
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ height: 36 }}>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: "bold",
                    padding: "4px",
                    bgcolor: "#1976d2",
                    color: "#fff",
                    width: cellWidthTiet,
                  }}
                >
                  Tiết
                </TableCell>
                {days.map((day) => (
                  <TableCell
                    key={day}
                    align="center"
                    sx={{
                      fontWeight: "bold",
                      padding: "4px",
                      bgcolor: "#1976d2",
                      color: "#fff",
                      width: cellWidthDay,
                    }}
                  >
                    {day}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {periodsBySession[session].map((period, idx) => (
                <TableRow key={period} sx={{ height: 36 }}>
                  {/* Cột Tiết */}
                  <TableCell
                    align="center"
                    sx={{
                      padding: "4px",
                      width: cellWidthTiet,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {period}
                  </TableCell>

                  {/* Các cột ngày */}
                  {days.map((day) => (
                    <TableCell
                      key={day}
                      align="center"
                      sx={{
                        padding: "4px",
                        width: cellWidthDay, // cố định width
                        minWidth: cellWidthDay,
                        maxWidth: cellWidthDay,
                        whiteSpace: "nowrap", // không xuống dòng
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {renderCell(session, day, idx)}
                    </TableCell>
                  ))}
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
    <Paper elevation={4} sx={{ maxWidth: 800, mx: "auto", p: 3, borderRadius: 3, position: "relative" }}>
      {/* Nút Import Excel */}
        <input
          type="file"
          accept=".xlsx"
          id="import-excel-input"
          style={{ display: "none" }}
          onChange={handleImportExcel}
        />

        <Tooltip title="Nhập TKB GVCN từ Excel">
          <IconButton
            component="label"
            htmlFor="import-excel-input"
            sx={{ position: "absolute", top: 8, left: 8, color: "#388e3c" }}
            size="small"
          >
            <UploadFileIcon sx={{ color: "#388e3c" }} />
          </IconButton>
        </Tooltip>

        {/* Tiêu đề trang */}
        <Typography
          variant="h5"
          align="center"
          fontWeight="bold"
          color="primary"
          gutterBottom
          sx={{ mt: 1, mb: 4 }}
        >
          XẾP THỜI KHÓA BIỂU GVCN
        </Typography>

      <Grid
        container
        sx={{
          mt: 4,
          mb: 4,
          flexDirection: { xs: "row", sm: "row" }, // Mobile: cùng hàng
          alignItems: { xs: "center", sm: "center" },
          gap: 2, // khoảng cách giữa các item
        }}
      >
        {/* Ô Khối */}
        <Grid item sx={{ width: { xs: "47%", sm: "auto" } }}>
          <TextField
            select
            label="Khối lớp"
            value={khoi}
            size="small"
            onChange={handleKhoiChange}
            sx={{ width: "100%" }}
          >
            {Object.keys(khoiLopData).map(k => (
              <MenuItem key={k} value={k}>
                Khối {k}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* Ô Lớp (cùng hàng với Khối) */}
        <Grid item sx={{ width: { xs: "47%", sm: "auto" } }}>
          <TextField
            select
            label="Lớp"
            value={lop}
            size="small"
            onChange={e => setLop(e.target.value)}
            sx={{ width: "100%" }}
          >
            {khoiLopData[khoi].map(l => (
              <MenuItem key={l} value={l}>
                {l}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* Ô GV chủ nhiệm */}
        <Grid item sx={{ width: { xs: "100%", sm: 250 }, mt: { xs: 1, sm: 0 } }}>
          <TextField
            label="GV chủ nhiệm"
            value={gvChuNhiem}
            size="small"
            InputProps={{ readOnly: true }}
            sx={{
              width: "100%", // mobile full width, desktop cố định 250px
              textAlign: "center",
            }}
          />
        </Grid>
      </Grid>

      {renderScheduleTable("SÁNG")}
      {renderScheduleTable("CHIỀU")}

      {/* Bỏ nút Lưu ở dưới cùng */}

      {/* Thanh tiến trình dưới */}
      {saving && (
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
      )}

    </Paper>
  </Box>
);

}
