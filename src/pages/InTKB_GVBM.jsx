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
  IconButton,
  Tooltip
} from "@mui/material";
import { db } from "../firebase";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import PrintIcon from "@mui/icons-material/Print";
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { printTeachersTKB } from "../utils/printTKB_GVBM";
import { exportAllTeachersToExcel } from "../utils/exportAllToExcel_GVBM.js";
import { useGVBM } from "../contexts/ContextGVBM";
import { useSchedule } from "../contexts/ScheduleContext";

const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
const periodsBySession = { SÁNG: [1, 2, 3, 4, 5], CHIỀU: [1, 2, 3, 4] };

//export default function InKB_GVBM() {
export default function InTKB_GVBM({ setPrintHandler, setExportHandler }) {
  const { contextRows, setContextRows, allSchedules, setAllSchedules } = useGVBM();
  const [selectedGV, setSelectedGV] = useState("");
  const [selectedMon, setSelectedMon] = useState("");
  const [ngayApDung, setNgayApDung] = useState(dayjs());
  const [scheduleGVBM, setScheduleGVBM] = useState({
    SÁNG: { "Thứ 2": [], "Thứ 3": [], "Thứ 4": [], "Thứ 5": [], "Thứ 6": [] },
    CHIỀU: { "Thứ 2": [], "Thứ 3": [], "Thứ 4": [], "Thứ 5": [], "Thứ 6": [] },
  });
  const [teachersList, setTeachersList] = useState([]);

  const { teachers, tkbAllTeachers, selectedFileId, currentDocId, assignments, phanCongGVs } = useSchedule();

  //const [gvSummary, setGvSummary] = useState({});

  const normalizeName = (name) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "_");

  // useEffect chỉ để load danh sách GV
  useEffect(() => { 
    const fetchTeachers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "GVBM_2025-2026"));
        const gvList = snapshot.docs.map((doc) => ({
          id: doc.id,
          hoTen: doc.data().hoTen,
          monDay: doc.data().monDay || [],
        }));
        setContextRows(gvList);

        // sort theo tên cuối
        const sortedNames = gvList
          .map((d) => d.hoTen)
          .sort((a, b) => {
            const getLastName = (fullName) =>
              fullName.trim().split(" ").slice(-1)[0].toLowerCase();
            return getLastName(a).localeCompare(getLastName(b));
          });

        setTeachersList(sortedNames);

        // chọn GV đầu tiên trong danh sách đã sort
        if (sortedNames.length > 0) {
          setSelectedGV(sortedNames[0]);
        }

        //console.log("✅ GV từ Firestore:", gvList);
      } catch (err) {
        console.error("❌ Lỗi lấy GV:", err);
      }
    };

    fetchTeachers();
  }, []);

  // --- Khi chọn GV ---
  useEffect(() => {
    if (!selectedGV || !currentDocId) return;

    // tìm thông tin GV theo tên
    const gv = contextRows.find((g) => g.hoTen === selectedGV);
    setSelectedMon(gv ? (gv.monDay || []).join(", ") : "");

    // normalize tên GV thành key
    const key = normalizeName(selectedGV);
    const raw = tkbAllTeachers?.[currentDocId]?.[key];

    if (raw) {
      // chuẩn hóa format thành {SÁNG: {...}, CHIỀU: {...}}
      const fixed = { SÁNG: {}, CHIỀU: {} };

      Object.keys(raw).forEach((day) => {
        fixed.SÁNG[day] = raw[day].morning || [];
        fixed.CHIỀU[day] = raw[day].afternoon || [];
      });

      setScheduleGVBM(fixed);
      //console.log("📅 TKB chuẩn hóa (context) của GV", selectedGV, ":", fixed);
    } else {
      console.warn("⚠️ Không tìm thấy TKB trong context cho GV:", selectedGV);
      setScheduleGVBM({
        SÁNG: { "Thứ 2": [], "Thứ 3": [], "Thứ 4": [], "Thứ 5": [], "Thứ 6": [] },
        CHIỀU: { "Thứ 2": [], "Thứ 3": [], "Thứ 4": [], "Thứ 5": [], "Thứ 6": [] },
      });
    }
  }, [selectedGV, contextRows, tkbAllTeachers, currentDocId]);

  // --- Lấy ngày áp dụng ---
  useEffect(() => {
    const fetchNgayApDung = async () => {
      try {
        const docRef = doc(db, "THONGTIN", "INFO");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const ngay = docSnap.data().ngayApDung
            ? dayjs(docSnap.data().ngayApDung, "YYYY/MM/DD")
            : null;
          setNgayApDung(ngay);
        }
      } catch (err) {
        console.error("❌ Lỗi fetch ngày áp dụng:", err);
      }
    };
    fetchNgayApDung();
  }, []);

  const tinhTongTiet = () => {
    let total = 0;
    ["SÁNG", "CHIỀU"].forEach((session) => {
      days.forEach((day) => {
        const arr = scheduleGVBM[session]?.[day];
        if (Array.isArray(arr)) {
          total += arr.filter(
            (t) => t && ((t.class && t.class.trim() !== "") || (t.subject && t.subject.trim() !== ""))
          ).length;
        }
      });
    });
    return total;
  };

  const convertScheduleToTKBFormat = (schedule) => {
    const result = {};
    days.forEach((day) => {
      result[day] = { SÁNG: [], CHIỀU: [] };
      ["SÁNG", "CHIỀU"].forEach((session) => {
        result[day][session] = (schedule?.[session]?.[day] || []).map((str) => {
          if (!str) return null;
          const match = str.match(/^(.+?)\s*(?:\((.+?)\))?$/);
          return {
            class: (match?.[1] || "").trim(),
            subject: (match?.[2] || "").trim(),
          };
        });
      });
    });
    return result;
  };


  // --- In toàn bộ GV ---
  const handlePrint = () => {
  const gvList = contextRows.map((gvData) => {
    const key = normalizeName(gvData.hoTen);
    const raw = tkbAllTeachers?.[currentDocId]?.[key];
    const monList = gvData.monDay || [];
    const isMulti = monList.length > 1;

    const tkbForPrint = {};

    if (raw) {
      Object.keys(raw).forEach((day) => {
        tkbForPrint[day] = {
          SÁNG: (raw[day]?.morning || []).filter(Boolean).map((item) => {
            const lop = item?.class || item?.lop || item?.className || "";
            const subject = item?.subject || "";

            let displaySubject = "";
            if (isMulti && subject.toLowerCase() !== "tin học") {
              const lower = subject.toLowerCase();
              if (lower.includes("công nghệ")) displaySubject = "CN";
              else if (lower.includes("âm nhạc")) displaySubject = "AN";
              else if (lower.includes("mĩ thuật") || lower.includes("mỹ thuật")) displaySubject = "MT";
              else if (lower.includes("đạo đức")) displaySubject = "ĐĐ";
              else if (lower.includes("thể dục")) displaySubject = "TD";
              else displaySubject = subject;
            }

            return {
              class: lop,
              subject: displaySubject,
              tiet: item?.period || item?.tiet || "",
              gio: item?.gio || "",
            };
          }),
          CHIỀU: (raw[day]?.afternoon || []).filter(Boolean).map((item) => {
            const lop = item?.class || item?.lop || item?.className || "";
            const subject = item?.subject || "";

            let displaySubject = "";
            if (isMulti && subject.toLowerCase() !== "tin học") {
              const lower = subject.toLowerCase();
              if (lower.includes("công nghệ")) displaySubject = "CN";
              else if (lower.includes("âm nhạc")) displaySubject = "AN";
              else if (lower.includes("mĩ thuật") || lower.includes("mỹ thuật")) displaySubject = "MT";
              else if (lower.includes("đạo đức")) displaySubject = "ĐĐ";
              else if (lower.includes("thể dục")) displaySubject = "TD";
              else displaySubject = subject;
            }

            return {
              class: lop,
              subject: displaySubject,
              tiet: item?.period || item?.tiet || "",
              gio: item?.gio || "",
            };
          }),
        };
      });
    } else {
      ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"].forEach((day) => {
        tkbForPrint[day] = { SÁNG: [], CHIỀU: [] };
      });
    }

    return {
      name: gvData.hoTen,
      tenMon: monList.join(", "),
      tkbData: tkbForPrint,
    };
  });

  // Giữ cùng quy tắc sắp xếp như Excel
  gvList.sort((a, b) => {
    const subjA = (a.tenMon.split(",")[0] || "").trim();
    const subjB = (b.tenMon.split(",")[0] || "").trim();
    const cmpSubj = subjA.localeCompare(subjB, "vi", { sensitivity: "base" });
    if (cmpSubj !== 0) return cmpSubj;

    const lastName = (full) => {
      const parts = full.trim().split(" ");
      return parts[parts.length - 1];
    };
    return lastName(a.name).localeCompare(lastName(b.name), "vi", { sensitivity: "base" });
  });

  printTeachersTKB(gvList);
};

const printHandler = () => {
  const isClassName = (s) => /^\d+\.\d+$/.test(String(s || "").trim());

  const gvList = (contextRows || [])
    .filter(r => isClassName(r.lop))
    .map(gvData => {
      const lopName = String(gvData.lop || "").trim();

      const schedule = allSchedules?.[lopName]?.schedule || {
        SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
        CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {}),
      };

      const tkbForPrint = {};
      days.forEach(day => {
        tkbForPrint[day] = {
          SÁNG: schedule.SÁNG[day].map(s => ({ subject: s || "" })),
          CHIỀU: schedule.CHIỀU[day].map(s => ({ subject: s || "" })),
        };
      });

      return {
        name: gvData.hoTen,
        tenLop: lopName,
        tkbData: tkbForPrint,
      };
    });

  printTeachersTKB(gvList);
};

// Gán nút In
useEffect(() => {
  if (setPrintHandler) {
    setPrintHandler(() => handlePrint);
  }
}, [setPrintHandler]);

// Gán nút Tải về
useEffect(() => {
  if (setExportHandler) {
    setExportHandler(() => handleToExcel);
  }
}, [setExportHandler]);


const formatClassSubject = (cell, selectedMon) => {
  if (!cell) return "";
  const { class: lop, subject } = cell;
  if (!lop) return "";

  const monList = selectedMon.split(",").map((s) => s.trim());
  const isMulti = monList.length > 1;

  if (!isMulti) return lop; // GV chỉ dạy 1 môn → không thêm hậu tố
  if (subject?.toLowerCase().includes("tin học")) return lop; // Tin học → bỏ hậu tố

  const lower = subject.toLowerCase();
  if (lower.includes("công nghệ")) return `${lop} (CN)`;
  if (lower.includes("âm nhạc")) return `${lop} (AN)`;
  if (lower.includes("mĩ thuật") || lower.includes("mỹ thuật")) return `${lop} (MT)`;
  if (lower.includes("đạo đức")) return `${lop} (ĐĐ)`;
  if (lower.includes("thể dục")) return `${lop} (TD)`;

  return `${lop} (${subject})`; // fallback giữ nguyên
};

// --- Xuất Excel toàn bộ GV ---
const handleToExcel = () => {
  const gvList = contextRows.map((gvData) => {
    const key = normalizeName(gvData.hoTen);
    const raw = tkbAllTeachers?.[currentDocId]?.[key];
    const monList = gvData.monDay || [];
    const isMulti = monList.length > 1;

    const tkbForExcel = {};
    if (raw) {
      Object.keys(raw).forEach((day) => {
        tkbForExcel[day] = {
          SÁNG: (raw[day]?.morning || []).filter(Boolean).map((item, idx) => {
            const lop = item?.class || item?.lop || item?.className || "";
            const subject = item?.subject || "";
            let displaySubject = "";

            if (isMulti && subject.toLowerCase() !== "tin học") {
              const lower = subject.toLowerCase();
              if (lower.includes("công nghệ")) displaySubject = "CN";
              else if (lower.includes("âm nhạc")) displaySubject = "AN";
              else if (lower.includes("mĩ thuật") || lower.includes("mỹ thuật")) displaySubject = "MT";
              else if (lower.includes("đạo đức")) displaySubject = "ĐĐ";
              else if (lower.includes("thể dục")) displaySubject = "TD";
              else displaySubject = subject;
            }

            return {
              class: lop,
              subject: displaySubject,
              tiet: item?.period || idx + 1,
              gio: item?.gio || "",
            };
          }),
          CHIỀU: (raw[day]?.afternoon || []).filter(Boolean).map((item, idx) => {
            const lop = item?.class || item?.lop || item?.className || "";
            const subject = item?.subject || "";
            let displaySubject = "";

            if (isMulti && subject.toLowerCase() !== "tin học") {
              const lower = subject.toLowerCase();
              if (lower.includes("công nghệ")) displaySubject = "CN";
              else if (lower.includes("âm nhạc")) displaySubject = "AN";
              else if (lower.includes("mĩ thuật") || lower.includes("mỹ thuật")) displaySubject = "MT";
              else if (lower.includes("đạo đức")) displaySubject = "ĐĐ";
              else if (lower.includes("thể dục")) displaySubject = "TD";
              else displaySubject = subject;
            }

            return {
              class: lop,
              subject: displaySubject,
              tiet: item?.period || idx + 1,
              gio: item?.gio || "",
            };
          }),
        };
      });
    } else {
      ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"].forEach((day) => {
        tkbForExcel[day] = { SÁNG: [], CHIỀU: [] };
      });
    }

    return {
      name: gvData.hoTen,
      tenMon: monList.join(", "),
      tkbData: tkbForExcel,
    };
  });

  // 👉 Giữ cùng quy tắc sắp xếp như handlePrint
  gvList.sort((a, b) => {
    const subjA = (a.tenMon.split(",")[0] || "").trim();
    const subjB = (b.tenMon.split(",")[0] || "").trim();
    const cmpSubj = subjA.localeCompare(subjB, "vi", { sensitivity: "base" });
    if (cmpSubj !== 0) return cmpSubj;

    const lastName = (full) => {
      const parts = full.trim().split(" ");
      return parts[parts.length - 1];
    };
    return lastName(a.name).localeCompare(lastName(b.name), "vi", { sensitivity: "base" });
  });

  exportAllTeachersToExcel(
    gvList,
    {}, // vietTatMon
    "2025-2026",
    "…", // ubnd
    "…", // truong
    ngayApDung
  );
};

  const renderScheduleTable = (session) => {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
          {session === "SÁNG" ? "Buổi sáng" : "Buổi chiều"}
        </Typography>
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
                  <TableCell align="center" sx={{ padding: "4px" }}>
                    {period}
                  </TableCell>
                  {days.map((day) => {
                    const cell = scheduleGVBM[session]?.[day]?.[idx];
                    return (
                      <TableCell key={day} align="center" sx={{ padding: "4px" }}>
                        {formatClassSubject(cell, selectedMon)}
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


  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: 4, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
      <Paper elevation={4} sx={{ maxWidth: 750, mx: "auto", p: 3, borderRadius: 3, position: "relative" }}>
        {/* Header */}
        <Box sx={{ position: "relative", mt: 1, mb: 4 }}>
          {/* Nút In ở góc trên trái */}
          {/*<Tooltip title="In">
            <IconButton
              onClick={handlePrint}
              sx={{ position: "absolute", top: -14, left: -8, color: "black" }}
              size="small"
            >
              <PrintIcon />
            </IconButton>
          </Tooltip>*/}

          {/* Nút Xuất Excel ngay cạnh nút In */}
          {/*<Tooltip title="Xuất Excel">
            <IconButton
              onClick={handleToExcel}
              sx={{ position: "absolute", top: -14, left: 32, color: "green" }}
              size="small"
            >
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>*/}

          {/* Tiêu đề căn giữa */}
          <Typography
            variant="h5"
            align="center"
            fontWeight="bold"
            color="primary"
            gutterBottom
            sx={{ mt: 1 }}
          >
            THỜI KHÓA BIỂU GVBM
          </Typography>
        </Box>

        <Grid
          container
          alignItems="center"
          sx={{
            mt: 4,
            mb: 4,
            flexDirection: { xs: "column", sm: "row" }, // mobile cột, desktop hàng
          }}
        >
          {/* Box chứa 2 ô GV và Môn học */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 2,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            <TextField
              select
              label="GV bộ môn"
              value={selectedGV}
              size="small"
              onChange={(e) => setSelectedGV(e.target.value)}
              sx={{ width: { xs: "100%", sm: 270 } }}
            >
              {teachersList.map((hoTen) => (
                <MenuItem key={hoTen} value={hoTen}>
                  {hoTen}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Môn học"
              value={selectedMon}
              size="small"
              InputProps={{ readOnly: true }}
              sx={{ width: { xs: "100%", sm: 170 } }}
            />
          </Box>

          {/* Tổng số tiết */}
          <Box
            sx={{
              mt: { xs: 1, sm: 0 },
              mb: { xs: -3, sm: 0 },
              ml: { xs: 0, sm: "auto" }, // desktop đẩy sang phải
              textAlign: "right",         // luôn căn phải
            }}
          >
            <Typography variant="body1" sx={{ color: "text.primary", fontWeight: "bold" }}>
              Tổng số tiết: {tinhTongTiet()}
            </Typography>
          </Box>
        </Grid>


        {renderScheduleTable("SÁNG")}
        {renderScheduleTable("CHIỀU")}

        <Box sx={{ mt: 2, mb: 2 }}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
            <DatePicker
              label="Ngày áp dụng"
              value={ngayApDung}
              onChange={async (newValue) => {
                setNgayApDung(newValue);
                if (newValue) {
                  const docRef = doc(db, "THONGTIN", "INFO");
                  await updateDoc(docRef, { ngayApDung: dayjs(newValue).format("YYYY/MM/DD") });
                }
              }}
              slotProps={{ textField: { size: "small", sx: { maxWidth: "170px" } } }}
            />
          </LocalizationProvider>
        </Box>
      </Paper>
    </Box>
  );
}
