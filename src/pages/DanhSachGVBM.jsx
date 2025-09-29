import React, { useState, useEffect, useRef } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  TextField,
  Stack,
  Tooltip,
  IconButton,
  LinearProgress,
  Autocomplete,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { db } from "../firebase";
import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useGVBM } from "../contexts/ContextGVBM";
import { useTKB_GVBM } from "../contexts/ContextTKB_GVBM";  // 👈 thêm dòng này

//export default function DanhSachGVBM() {
export default function DanhSachGVBM({ setUploadHandler }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { contextRows, setContextRows } = useGVBM();
  const [selectedRow, setSelectedRow] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [monOptions, setMonOptions] = useState([]);
  const monInputRef = useRef(null);

  const { setTkbRows } = useTKB_GVBM(); 
  const [newRow, setNewRow] = useState({
    hoTen: "",
    monHoc: [],
    gvbmId: "",
  });

    const generateGvbmId = (name) =>
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").trim();

  // Load dữ liệu
  const fetchData = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "GVBM_2025-2026"));

      let data = querySnapshot.docs
        .map((docSnap) => {
          const { hoTen, monDay } = docSnap.data() || {};
          return {
            hoTen: hoTen || "",
            monDay: monDay || [],
            gvbmId: docSnap.id, // 🔹 dùng id Firestore
          };
        })
        .filter((d) => d.hoTen && d.monDay.length > 0);

      // 🔹 Sort + đánh STT
      const finalData = data
        .sort((a, b) => {
          const monA = a.monDay?.[0] || "";
          const monB = b.monDay?.[0] || "";
          const monCompare = monA.localeCompare(monB, "vi");
          if (monCompare !== 0) return monCompare;

          const getLastName = (fullName) =>
            fullName.trim().split(" ").slice(-1)[0].toLowerCase();
          return getLastName(a.hoTen).localeCompare(getLastName(b.hoTen), "vi");
        })
        .map((item, idx) => ({ ...item, stt: idx + 1 }));

      // 🔹 Cập nhật state + context
      setRows(finalData);
      setContextRows(finalData);
      setTkbRows(finalData);
      setMonOptions([...new Set(finalData.flatMap((r) => r.monDay))]);
    } catch (err) {
      console.error("❌ fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddRow = async () => {
    if (!newRow.hoTen) return;
    const gvbmId = generateGvbmId(newRow.hoTen);

    // Lấy text đang gõ trong Autocomplete (nếu có)
    const rawInput = monInputRef.current?.value?.trim();
    const selected = Array.isArray(newRow.monHoc) ? newRow.monHoc : [newRow.monHoc].filter(Boolean);
    const monDayArray = [...new Set([...selected, ...(rawInput ? [rawInput] : [])])];

    const updatedRows = [...rows, { ...newRow, gvbmId, monDay: monDayArray }];
    
    // 🔥 Đánh lại STT cho toàn bộ danh sách
    const rowsWithStt = updatedRows.map((item, idx) => ({ ...item, stt: idx + 1 }));

    setRows(rowsWithStt);
    setContextRows(rowsWithStt);
    setTkbRows(rowsWithStt);
    setNewRow({ hoTen: "", monHoc: [], gvbmId: "" });
    if (monInputRef.current) monInputRef.current.value = "";

    try {
      await setDoc(doc(db, "GVBM_2025-2026", gvbmId), {
        hoTen: newRow.hoTen,
        monDay: monDayArray,
      });

      // 👇 Sau khi thêm thành công, cập nhật lại danh sách môn học
      setMonOptions((prev) => [...new Set([...prev, ...monDayArray])]);
      
    } catch (err) {
      console.error("❌ Lỗi khi ghi Firestore:", err);
    }
  };

  const handleEditRow = (idx) => {
    const row = rows[idx];
    setNewRow({ hoTen: row.hoTen, monHoc: row.monDay, gvbmId: row.gvbmId });
    setIsEditing(true);
    setEditingIndex(idx);
  };

  const handleUpdateRow = async () => {
    if (editingIndex === null) return;

    // ép monHoc luôn thành array
    const monDayArray = Array.isArray(newRow.monHoc)
      ? newRow.monHoc
      : [newRow.monHoc].filter(Boolean);

    // Cập nhật trên state
    const updatedRows = [...rows];
    updatedRows[editingIndex] = {
      ...updatedRows[editingIndex],
      hoTen: newRow.hoTen,
      gvbmId: newRow.gvbmId,
      monDay: monDayArray,  // 👈 đồng bộ key mà bảng đang dùng
    };

    // Đánh lại STT
    const normalizedRows = updatedRows.map((r, i) => ({ ...r, stt: i + 1 }));

    setRows(normalizedRows);
    setContextRows(normalizedRows);
    setTkbRows(normalizedRows);
    setIsEditing(false);
    setEditingIndex(null);
    setNewRow({ hoTen: "", monHoc: [], gvbmId: "" });

    try {
      // Cập nhật Firestore
      await setDoc(doc(db, "GVBM_2025-2026", newRow.gvbmId), {
        hoTen: newRow.hoTen,
        monDay: monDayArray,
      });

      // Cập nhật lại monOptions
      setMonOptions([...new Set(normalizedRows.flatMap(r => r.monDay || []))]);

    } catch (err) {
      console.error("❌ Lỗi khi cập nhật Firestore:", err);
    }
  };

  const handleDeleteRow = async (gvbmId) => {
  const row = rows.find(r => r.gvbmId === gvbmId);
  if (!row) return alert("Không tìm thấy giáo viên.");

  if (!window.confirm(`Bạn có chắc muốn xóa giáo viên ${row.hoTen}?`)) return;

  try {
    // 🔹 Xóa Firestore
    await deleteDoc(doc(db, "GVBM_2025-2026", gvbmId));

    // 🔹 Cập nhật state rows + context
    const getLastName = (fullName = "") =>
      fullName.trim().split(" ").slice(-1)[0].toLowerCase();

    const updatedRows = rows
      .filter(r => r.gvbmId !== gvbmId)
      .sort((a, b) => {
        const monA = a.monDay?.[0] || "";
        const monB = b.monDay?.[0] || "";
        const monCompare = monA.localeCompare(monB, "vi");
        if (monCompare !== 0) return monCompare;
        return getLastName(a.hoTen).localeCompare(getLastName(b.hoTen), "vi");
      })
      .map((item, index) => ({ ...item, stt: index + 1 }));

    setRows(updatedRows);
    setContextRows(updatedRows);
    setTkbRows(updatedRows); 
    // 🔹 Cập nhật monOptions
    const updatedMonOptions = [...new Set(updatedRows.flatMap(r => r.monDay || []))];
    setMonOptions(updatedMonOptions);

  } catch (err) {
    console.error("❌ Lỗi khi xóa Firestore:", err);
    alert(`Xóa không thành công: ${err?.message || "Vui lòng thử lại."}`);
  }
};

  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("GVBoMon");
    worksheet.addRow(["Họ và Tên", "Môn học"]);
    rows.forEach((r) => worksheet.addRow([r.hoTen, (r.monDay || []).join(", ")]));
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "DanhSachGVBoMon.xlsx");
  };

  const handleAssignClasses = (row) => {
    // Điều hướng sang trang PhanCongLopGVBM với param và state
    navigate(`/phan-cong-lop-gvbm/${row.gvbmId}`, { state: { gvbm: row } });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setProgress(0);

    try {
      // 1️⃣ Xóa tất cả dữ liệu hiện có trên Firestore
      const snapshot = await getDocs(collection(db, "GVBM_2025-2026"));
      const deleteBatch = writeBatch(db);
      snapshot.docs.forEach(docSnap => deleteBatch.delete(docSnap.ref));
      await deleteBatch.commit();

      // 2️⃣ Load file Excel
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0];

      const dataMap = new Map(); // gvbmId → { hoTen, monDay }
      const batch = writeBatch(db);
      const totalRows = worksheet.rowCount - 3;

      for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const hoTen = row.getCell(2).value?.toString().trim();
        const monHoc = row.getCell(3).value?.toString().trim();
        if (!hoTen || !monHoc) continue;

        const gvbmId = generateGvbmId(hoTen);

        if (!dataMap.has(gvbmId)) {
          dataMap.set(gvbmId, { hoTen, monDay: [monHoc], gvbmId });
        } else {
          const existing = dataMap.get(gvbmId);
          if (!existing.monDay.includes(monHoc)) {
            existing.monDay.push(monHoc);
          }
        }

        // Cập nhật progress
        setProgress(Math.round(((rowNumber - 3) / totalRows) * 100));
        await new Promise((r) => setTimeout(r, 5));
      }

      // Chuyển Map → Array
      const data = Array.from(dataMap.values());

      // Ghi tất cả vào Firestore
      for (const item of data) {
        const docRef = doc(db, "GVBM_2025-2026", item.gvbmId);
        batch.set(docRef, { hoTen: item.hoTen, monDay: item.monDay });
      }
      await batch.commit();

      // 🔹 Sắp xếp theo môn học → tên cuối
      const sortedData = data.sort((a, b) => {
        // So sánh môn học đầu tiên
        const monA = a.monDay[0] || "";
        const monB = b.monDay[0] || "";
        const monCompare = monA.localeCompare(monB, "vi");
        if (monCompare !== 0) return monCompare;

        // So sánh tên cuối
        const getLastName = (fullName) => fullName.trim().split(" ").slice(-1)[0].toLowerCase();
        const nameA = getLastName(a.hoTen);
        const nameB = getLastName(b.hoTen);
        return nameA.localeCompare(nameB, "vi");
      });

      // Đánh lại STT
      const finalData = sortedData.map((item, index) => ({ ...item, stt: index + 1 }));

      // Cập nhật UI / context
      setRows(finalData);
      setContextRows(finalData);
      setTkbRows(finalData); 
      setMonOptions([...new Set(finalData.flatMap(r => r.monDay))]);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (setUploadHandler) {
      setUploadHandler(() => handleFileUpload);
      return () => setUploadHandler(null);
    }
  }, [setUploadHandler]);


  return (
  <Box sx={{ mt: 1.5, pt: "20px", pb: 6, px: { xs: 1, sm: 2 }, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
    <Card elevation={6} sx={{ maxWidth: 800, mx: "auto", borderRadius: 3, overflow: "hidden" }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        {/* Header với icon upload ở góc trên trái */}
        <Box sx={{ position: "relative", mt: 1, mb: 4 }}>
          {/*<Tooltip title="Nhập danh sách từ Excel">
            <IconButton
              color="primary"
              component="label"
              sx={{ position: "absolute", top: -14, left: -8, bgcolor: "#1976d2", color: "#fff", "&:hover": { bgcolor: "#115293" } }}
              size="small"
            >
              <UploadFileIcon />
              <input
                type="file"
                hidden
                onChange={async (e) => {
                  await handleFileUpload(e);
                  e.target.value = null; // reset để chọn lại cùng file
                }}
              />
            </IconButton>
          </Tooltip>*/}

          <Typography variant="h5" align="center" fontWeight="bold" sx={{ color: "#1976d2", mb: 2 }}>
            DANH SÁCH GIÁO VIÊN BỘ MÔN
          </Typography>
        </Box>

        {/* Thanh tiến trình */}
        {loading && (
          <Box sx={{ width: "50%", maxWidth: 200, mx: "auto", mb: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ height: 4, borderRadius: 3 }} // giảm chiều cao thanh
            />
            <Typography 
              variant="caption" 
              color="text.secondary" 
              align="center" 
              sx={{ mt: 0.5 }} // giảm margin trên
            >
              Đang cập nhật dữ liệu... ({progress}%)
            </Typography>
          </Box>
        )}

        {/* Bảng dữ liệu */}
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader sx={{ "& .MuiTableCell-root": { px: 1, py: 0.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold", textTransform: "uppercase", width: "60px" }}>
                  STT
                </TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold", textTransform: "uppercase" }}>
                  Họ và Tên
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    backgroundColor: "#1976d2",
                    color: "#fff",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    width: "150px",
                    maxWidth: "150px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Môn
                </TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold", textTransform: "uppercase", width: "100px" }}>
                  Lớp
                </TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold", textTransform: "uppercase", width: "100px" }}>
                  Điều chỉnh
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.map((row, idx) => (
                <TableRow
                  key={row.gvbmId}
                  sx={{
                    "&:hover .action-icon": { opacity: 1, transition: "opacity 0.3s ease" },
                    transition: "background-color 0.2s ease",
                    "&:hover": { backgroundColor: "#f5f5f5" },
                  }}
                >
                  <TableCell align="center">{row.stt}</TableCell>

                  {/* 👉 Họ và tên luôn 1 dòng */}
                  <TableCell
                    sx={{
                      maxWidth: "180px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.hoTen}
                  </TableCell>

                  <TableCell
                    sx={{
                      maxWidth: "200px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {(row.monDay || []).join(", ")}
                  </TableCell>

                  <TableCell align="center">
                    <Tooltip title="Phân công lớp">
                      <IconButton
                        size="small"
                        onClick={() => handleAssignClasses(row)}
                        sx={{
                          color: "#1976d2",
                          "&:active": {
                            bgcolor: "rgba(25, 118, 210, 0.2)",
                            transform: "scale(1.1)",
                          },
                        }}
                      >
                        <AssignmentIndIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>

                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="Chỉnh sửa">
                        <IconButton
                          size="small"
                          onClick={() => handleEditRow(idx)}
                          className="action-icon"
                          sx={{
                            opacity: 0,
                            color: "#1976d2",
                            "&:active": {
                              bgcolor: "rgba(25, 118, 210, 0.2)",
                              transform: "scale(1.1)",
                            },
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xóa">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteRow(row.gvbmId)}
                          className="action-icon"
                          sx={{
                            opacity: 0,
                            color: "#d32f2f",
                            "&:active": {
                              bgcolor: "rgba(211, 47, 47, 0.2)",
                              transform: "scale(1.1)",
                            },
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

          </Table>
        </TableContainer>

        {/* Form thêm/sửa */}
        <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
          <TextField
            label="Họ và Tên"
            value={newRow.hoTen}
            onChange={(e) => setNewRow({ ...newRow, hoTen: e.target.value })}
            size="small"
            sx={{ flex: 1.5 }}
          />
          <Autocomplete
            multiple
            freeSolo
            options={monOptions}
            value={newRow.monHoc || []}
            onChange={(e, val) => setNewRow((prev) => ({ ...prev, monHoc: val }))}
            filterSelectedOptions
            disableCloseOnSelect
            size="small"
            sx={{ width: 243 }}
            renderInput={(params) => <TextField {...params} label="Môn học" inputRef={monInputRef} />}
          />

          {isEditing ? (
            <>
              <Button variant="outlined" color="warning" onClick={handleUpdateRow}>
                Sửa
              </Button>
              <Button
                variant="text"
                color="inherit"
                onClick={() => {
                  setIsEditing(false);
                  setEditingIndex(null);
                  setNewRow({ hoTen: "", monHoc: [], gvbmId: "" });
                }}
              >
                Hủy
              </Button>
            </>
          ) : (
            <Button variant="contained" onClick={handleAddRow}>
              Thêm
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  </Box>
);

}
