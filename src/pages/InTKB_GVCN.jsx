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
import { useGVCN } from "../contexts/ContextGVCN";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PrintIcon from "@mui/icons-material/Print";
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { printTeachersTKB } from '../utils/printTKB_GVCN';
import { exportAllTeachersToExcel } from "../utils/exportAllToExcel_GVCN.js";
import { useSchedule } from "../contexts/ScheduleContext";   // ✅ thêm dòng này


const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
const periodsBySession = { SÁNG: [1, 2, 3, 4, 5], CHIỀU: [1, 2, 3, 4] };
const khoiLopData = {
  1: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"],
  2: ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"],
  3: ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"],
  4: ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"],
  5: ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"],
};

export default function InTKB_GVCN({ setPrintHandler, setExportHandler }) {
  const [khoi, setKhoi] = useState("1");
  const [lop, setLop] = useState(khoiLopData["1"][0]);
  const [schedule, setSchedule] = useState({ SÁNG: {}, CHIỀU: {} });
  const { contextRows, setContextRows, allSchedules, setAllSchedules } = useGVCN(); // ✅ thêm allSchedules
  const { currentDocId, tkbAllTeachers } = useSchedule();
  const { contextSchedule, setContextSchedule } = useGVCN();


  const [ngayApDung, setNgayApDung] = useState(dayjs());
  const [teachersList, setTeachersList] = useState([]);
  
  const vietTatMon = {
    "ÂN": "Âm nhạc",
    "MT": "Mĩ thuật",
    "ĐĐ": "Đạo đức",
    // thêm các môn khác...
  };

  const getGVBMFromContext = (baseSchedule, lopName, currentDocId, tkbAllTeachers) => {
    try {
      const gvbmData = tkbAllTeachers?.[currentDocId];
      if (!gvbmData) {
        console.warn(`[getGVBMFromContext] Không tìm thấy dữ liệu GVBM cho file ${currentDocId}`);
        return baseSchedule;
      }

      // Clone để tránh mutate
      const mergedSchedule = JSON.parse(JSON.stringify(baseSchedule));

      // Chuẩn hoá cấu trúc
      ["SÁNG", "CHIỀU"].forEach(session => {
        mergedSchedule[session] ||= {};
        days.forEach(day => {
          mergedSchedule[session][day] ||= [];
        });
      });

      // Thu thập môn GVBM
      const gvbmSubjects = new Set();
      Object.values(gvbmData).forEach(gvSchedule => {
        days.forEach(day => {
          const dayData = gvSchedule[day];
          if (!dayData) return;

          [...(dayData.morning || []), ...(dayData.afternoon || [])].forEach(slot => {
            if (slot?.subject) gvbmSubjects.add(slot.subject);
          });
        });
      });

      // Xoá slot cũ nếu trùng môn GVBM
      ["SÁNG", "CHIỀU"].forEach(session => {
        days.forEach(day => {
          mergedSchedule[session][day] = (mergedSchedule[session][day] || []).map(
            subj => gvbmSubjects.has(subj) ? "" : subj
          );
        });
      });

      // Merge slot GVBM vào lớp
      Object.values(gvbmData).forEach(gvSchedule => {
        days.forEach(day => {
          const dayData = gvSchedule[day];
          if (!dayData) return;

          (dayData.morning || []).forEach((slot, idx) => {
            if (slot?.class === lopName && slot.subject?.trim()) {
              const fullName = vietTatMon[slot.subject] || slot.subject; // ✅ map viết tắt → đầy đủ
              mergedSchedule.SÁNG[day][idx] = fullName;
            }
          });

          (dayData.afternoon || []).forEach((slot, idx) => {
            if (slot?.class === lopName && slot.subject?.trim()) {
              const fullName = vietTatMon[slot.subject] || slot.subject; // ✅ map viết tắt → đầy đủ
              mergedSchedule.CHIỀU[day][idx] = fullName;
            }
          });
        });
      });

      return mergedSchedule;

    } catch (error) {
      console.error(`[Error] Lỗi merge GVBM cho lớp ${lopName}:`, error);
      return baseSchedule;
    }
  };

  const fetchScheduleForLop = async (lopName) => {
  try {
    // --- 1. Nếu currentDocId chưa có → chỉ set schedule rỗng
    if (!currentDocId) {
      const emptySchedule = {
        SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
        CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {})
      };
      setSchedule(emptySchedule);
      return;
    }

    let finalSchedule;

    // --- 2. Nếu lớp đã có trong contextSchedule → dùng luôn
    if (contextSchedule?.[lopName]) {
      finalSchedule = contextSchedule[lopName];
    } else {
      // --- 3. Lớp chưa có trong context → lấy từ TKB_GVCN/file đang mở
      const docRef = doc(db, "TKB_GVCN", currentDocId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const scheduleData = data.tkb || data; // nếu file không có field 'tkb', dùng toàn bộ document

        // Chuyển Map → Object nếu cần
        const scheduleObj = { SÁNG: {}, CHIỀU: {} };
        ['SÁNG', 'CHIỀU'].forEach(session => {
          const sessionMap = scheduleData[lopName]?.[session];
          if (sessionMap instanceof Map) {
            scheduleObj[session] = Object.fromEntries(sessionMap);
          } else {
            scheduleObj[session] = sessionMap || {};
          }
        });

        finalSchedule = scheduleObj;

        // --- Cập nhật contextSchedule để lần sau lấy nhanh
        setContextSchedule(prev => ({ ...prev, [lopName]: scheduleObj }));
      } else {
        console.warn(`⚠️ File TKB_GVCN "${currentDocId}" không tồn tại hoặc không có lớp "${lopName}"`);
        // fallback schedule rỗng
        finalSchedule = {
          SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
          CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {})
        };
      }
    }

    // --- 4. Cập nhật state để render UI
    setSchedule(finalSchedule);

  } catch (error) {
    console.error(`[Error] Lỗi khi lấy TKB lớp ${lopName}:`, error);

    // fallback schedule rỗng
    const fallbackSchedule = {
      SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
      CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {})
    };
    setSchedule(fallbackSchedule);
  }
};

const fetchScheduleForLop1 = async (lopName) => {
  try {

     // Nếu currentDocId là null → không fetch, chỉ đặt schedule rỗng
    if (currentDocId === null) {
      const emptySchedule = {
        SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
        CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {})
      };
      setSchedule(emptySchedule);
      return; // thoát hàm, không fetch context hay Firestore
    }
    
    let finalSchedule;

    // --- 1. Kiểm tra cache contextSchedule trước ---
    if (contextSchedule?.[lopName]) {
      finalSchedule = contextSchedule[lopName];
    } else {
      // --- 2. Nếu lớp chưa có trong context → fetch Firestore ---
      const tkbSnapshot = await getDocs(collection(db, "TKB_LOP_2025-2026"));
      const tmpSchedule = {};

      tkbSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const lopId = docSnap.id;

        const baseSchedule = data.schedule || {
          SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
          CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {}),
        };

        tmpSchedule[lopId] = baseSchedule;
      });

      // --- Cập nhật contextSchedule với toàn bộ lớp mới lấy ---
      setContextSchedule(prev => ({ ...prev, ...tmpSchedule }));

      finalSchedule = tmpSchedule[lopName] || {
        SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
        CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {}),
      };
    }

    // --- 3. Merge GVBM nếu có ---
    if (currentDocId && tkbAllTeachers?.[currentDocId]) {
      finalSchedule = getGVBMFromContext(finalSchedule, lopName, currentDocId, tkbAllTeachers);
    }

    // --- 4. Cập nhật state để UI render ---
    setSchedule(finalSchedule);

  } catch (error) {
    console.error(`[Error] Lỗi khi lấy TKB lớp ${lopName}:`, error);

    const fallbackSchedule = {
      SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
      CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {}),
    };

    setSchedule(fallbackSchedule);
  }
};

useEffect(() => {
  if (!lop) return;                  // Nếu chưa có lớp, không làm gì
  fetchScheduleForLop(lop);          // Gọi hàm fetchScheduleForLop cho lớp hiện tại
}, [lop, currentDocId]);             // Chạy lại khi lớp hoặc file GVBM hiện tại thay đổi

  // --- GV chủ nhiệm hiện tại theo lớp ---
  const gvChuNhiem = 
    contextRows.find((row) => row.lop.trim() === lop.trim())?.hoTen || "";

    // --- Lấy ngày áp dụng chung ---
  useEffect(() => {
    const fetchNgayApDung = async () => {
      try {
        const docRef = doc(db, "THONGTIN", "INFO");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().ngayApDung) {
          setNgayApDung(dayjs(docSnap.data().ngayApDung, "YYYY/MM/DD"));
        }
      } catch (err) {
        console.error("❌ Lỗi khi fetch ngày áp dụng:", err);
      }
    };
    fetchNgayApDung();
  }, []);

  const handleKhoiChange = (event) => {
    const newKhoi = event.target.value;
    setKhoi(newKhoi);
    setLop(khoiLopData[newKhoi][0]);
  };

  {/*const handlePrint = async () => {
    try {
      const isClassName = (s) => /^\d+\.\d+$/.test(String(s || "").trim());

      const gvList = (contextRows || [])
        .filter(r => isClassName(r.lop))
        .map(gvData => {
          const lopName = String(gvData.lop || "").trim();

          // ✅ Lấy schedule từ cache hoặc trống
          let finalSchedule = allSchedules?.[lopName]?.schedule || {
            SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
            CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {}),
          };

          // ✅ Merge GVBM lớp này từ file hiện tại
          if (currentDocId && tkbAllTeachers?.[currentDocId]) {
            finalSchedule = getGVBMFromContext(finalSchedule, lopName, currentDocId, tkbAllTeachers);
          }

          // Chuyển sang tkbData để in
          const tkbForPrint = {};
          days.forEach(day => {
            tkbForPrint[day] = {
              SÁNG: finalSchedule.SÁNG[day].map(s => ({ subject: s || "" })),
              CHIỀU: finalSchedule.CHIỀU[day].map(s => ({ subject: s || "" })),
            };
          });

          return {
            name: gvData.hoTen,
            tenLop: lopName,
            tkbData: tkbForPrint,
          };
        });

      printTeachersTKB(gvList);

    } catch (error) {
      console.error("[handlePrint] Lỗi:", error);
    }
  };*/}

  const handlePrint = async () => {
  try {
    const isClassName = (s) => /^\d+\.\d+$/.test(String(s || "").trim());

    const gvList = (contextRows || [])
      .filter(r => isClassName(r.lop))
      .map(gvData => {
        const lopName = String(gvData.lop || "").trim();

        // ✅ Lấy schedule từ contextSchedule
        let finalSchedule = contextSchedule?.[lopName] || {
          SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
          CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {}),
        };

        // ✅ Merge GVBM nếu có
        if (currentDocId && tkbAllTeachers?.[currentDocId]) {
          finalSchedule = getGVBMFromContext(finalSchedule, lopName, currentDocId, tkbAllTeachers);
        }

        const tkbForPrint = {};
        days.forEach(day => {
          tkbForPrint[day] = {
            SÁNG: finalSchedule.SÁNG[day].map(s => ({ subject: s || "" })),
            CHIỀU: finalSchedule.CHIỀU[day].map(s => ({ subject: s || "" })),
          };
        });

        return {
          name: gvData.hoTen,
          tenLop: lopName,
          tkbData: tkbForPrint,
        };
      });

    printTeachersTKB(gvList);

  } catch (error) {
    console.error("[handlePrint] Lỗi:", error);
  }
};


{/*const handleExportExcel = async () => {
  try {
    const isClassName = (s) => /^\d+\.\d+$/.test(String(s || "").trim());

    const validRows = (contextRows || []).filter(r => isClassName(r.lop));

    const gvList = validRows.map(gvData => {
      const lopName = String(gvData.lop || "").trim();

      // ✅ Lấy schedule lớp hiện tại từ cache hoặc trống
      let finalSchedule = allSchedules?.[lopName]?.schedule || {
        SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
        CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {}),
      };

      // ✅ Merge GVBM lớp này từ file hiện tại
      if (currentDocId && tkbAllTeachers?.[currentDocId]) {
        finalSchedule = getGVBMFromContext(finalSchedule, lopName, currentDocId, tkbAllTeachers);
      }

      // Chuyển sang tkbData giống bản in
      const tkbData = {};
      days.forEach(day => {
        tkbData[day] = {
          SÁNG: finalSchedule.SÁNG[day].map(s => ({ subject: typeof s === "string" ? s.trim() : "" })),
          CHIỀU: finalSchedule.CHIỀU[day].map(s => ({ subject: typeof s === "string" ? s.trim() : "" })),
        };
      });

      return {
        name: gvData.hoTen,
        tenLop: lopName,
        tkbData,
        tenMon: (gvData.monDay || []).join(", "),
      };
    });

    await exportAllTeachersToExcel(gvList);

  } catch (error) {
    console.error("[handleExportExcel] Lỗi:", error);
  }
};*/}

const handleExportExcel = async () => {
  try {
    const isClassName = (s) => /^\d+\.\d+$/.test(String(s || "").trim());

    const validRows = (contextRows || []).filter(r => isClassName(r.lop));

    const gvList = validRows.map(gvData => {
      const lopName = String(gvData.lop || "").trim();

      // ✅ Lấy schedule từ contextSchedule
      let finalSchedule = contextSchedule?.[lopName] || {
        SÁNG: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.SÁNG.length).fill("") }), {}),
        CHIỀU: days.reduce((acc, d) => ({ ...acc, [d]: Array(periodsBySession.CHIỀU.length).fill("") }), {}),
      };

      // ✅ Merge GVBM nếu có
      if (currentDocId && tkbAllTeachers?.[currentDocId]) {
        finalSchedule = getGVBMFromContext(finalSchedule, lopName, currentDocId, tkbAllTeachers);
      }

      const tkbData = {};
      days.forEach(day => {
        tkbData[day] = {
          SÁNG: finalSchedule.SÁNG[day].map(s => ({ subject: typeof s === "string" ? s.trim() : "" })),
          CHIỀU: finalSchedule.CHIỀU[day].map(s => ({ subject: typeof s === "string" ? s.trim() : "" })),
        };
      });

      return {
        name: gvData.hoTen,
        tenLop: lopName,
        tkbData,
        tenMon: (gvData.monDay || []).join(", "),
      };
    });

    await exportAllTeachersToExcel(gvList);

  } catch (error) {
    console.error("[handleExportExcel] Lỗi:", error);
  }
};


// Gán handler ra ngoài cho App.jsx dùng
useEffect(() => {
  if (setPrintHandler) setPrintHandler(() => handlePrint);
}, [setPrintHandler]);

useEffect(() => {
  if (setExportHandler) setExportHandler(() => handleExportExcel);
}, [setExportHandler]);


  const renderScheduleTable = (session) => {
    const removeTHSuffix = (str) => String(str || "").replace(/\s*\(?TH\)?\s*$/i, "");
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
          {session}
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ height: 36 }}>
                <TableCell align="center" sx={{ fontWeight: "bold", padding: "4px", bgcolor: "#1976d2", color: "#fff" }}>
                  Tiết
                </TableCell>
                {days.map(day => (
                  <TableCell key={day} align="center" sx={{ fontWeight: "bold", padding: "4px", bgcolor: "#1976d2", color: "#fff" }}>
                    {day}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {periodsBySession[session].map((period, idx) => (
                <TableRow key={period} sx={{ height: 36 }}>
                  <TableCell align="center" sx={{ padding: "4px" }}>
                    {removeTHSuffix(period)}
                  </TableCell>
                  {days.map(day => (
                    <TableCell key={day} align="center" sx={{ padding: "4px" }}>
                      {removeTHSuffix(schedule[session][day]?.[idx])}
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

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: 4, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
      <Paper elevation={4} sx={{ maxWidth: 750, mx: "auto", p: 3, borderRadius: 3 }}>
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
              onClick={handleExportExcel}
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
            THỜI KHÓA BIỂU GVCN
          </Typography>
        </Box>

        <Grid container alignItems="center" sx={{ mt: 4, mb: 4 }} justifyContent="flex-start" spacing={2}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              select
              label="Khối lớp"
              value={khoi}
              size="small"
              onChange={handleKhoiChange}
            >
              {Object.keys(khoiLopData).map(k => (
                <MenuItem key={k} value={k}>
                  Khối {k}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Lớp"
              value={lop}
              size="small"
              onChange={e => setLop(e.target.value)}
            >
              {khoiLopData[khoi].map(l => (
                <MenuItem key={l} value={l}>
                  {l}
                </MenuItem>
              ))}
            </TextField>

            <TextField
  label="GV chủ nhiệm"
  value={gvChuNhiem}
  size="small"
  InputProps={{ readOnly: true }}
  sx={{
    width: { xs: "fit-content", sm: 250 }, // mobile tự co giãn, desktop cố định 250px
    minWidth: { xs: 120, sm: 250 },        // mobile tối thiểu 120px
    textAlign: "center",
  }}
/>

          </Box>
        </Grid>


        {renderScheduleTable("SÁNG")}
        {renderScheduleTable("CHIỀU")}

        <Box sx={{ mt: 2, mb: 2, display: "flex", justifyContent: "flex-start" }}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
            <DatePicker
              label="Ngày áp dụng"
              value={ngayApDung}
              onChange={async newValue => {
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
