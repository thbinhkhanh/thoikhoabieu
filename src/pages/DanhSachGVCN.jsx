import React, { useState } from "react";
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
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { db } from "../firebase";
import { doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { collection, getDocs } from "firebase/firestore";
import { useEffect } from "react";
import { useGVCN } from "../contexts/ContextGVCN"; // đường dẫn tùy theo vị trí file
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';


//export default function DanhSachGVCN() {
export default function DanhSachGVCN({ setUploadHandler }) {
  const [rows, setRows] = useState([]);
  const [newRow, setNewRow] = useState({ hoTen: "", lop: "" });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const { contextRows, setContextRows } = useGVCN();
  const [selectedRow, setSelectedRow] = useState(null);
  const danhSachLop = [...new Set(rows.map((row) => row.lop).filter(Boolean))];
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  const syncRows = (finalData) => {
    setRows(finalData);
    setContextRows(finalData);
  };

  const fetchData = async () => {
    setLoading(true);
    setShowAlert(false);

    try {
      const querySnapshot = await getDocs(collection(db, "GVCN_2025-2026"));

      let data = querySnapshot.docs
        .map((docSnap) => {
          const { hoTen, lop } = docSnap.data() || {};
          return { hoTen, lop };
        })
        .filter((item) => item.hoTen && item.lop);

      // ✅ Sắp xếp theo lớp
      data.sort((a, b) =>
        a.lop.localeCompare(b.lop, "vi", { sensitivity: "base" })
      );

      // ✅ Đánh lại STT
      data = data.map((item, index) => ({
        ...item,
        stt: index + 1,
      }));

      // ✅ Đồng bộ state + context
      //setRows(data);
      //setContextRows(data);
      syncRows(data);

      setSuccess(true);
      setMessage("Tải dữ liệu từ Firestore thành công!");
    } catch (err) {
      console.error("❌ Lỗi khi tải dữ liệu:", err);
      setSuccess(false);
      setMessage("Không thể tải dữ liệu từ Firestore.");
    } finally {
      setLoading(false);
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 4000);
    }
  };


  useEffect(() => {
    fetchData();
  }, []);

  // Upload từ Excel
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setProgress(0);
    setShowAlert(false);

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0];

      let data = [];
      const batch = writeBatch(db);
      const totalRows = worksheet.rowCount - 3;

      for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const hoTen = row.getCell(2).value?.toString().trim() || "";
        const lop = row.getCell(3).value?.toString().trim() || "";

        if (hoTen && lop) {
          data.push({ stt: data.length + 1, hoTen, lop });

          const docRef = doc(db, "GVCN_2025-2026", lop);
          batch.set(docRef, { hoTen, lop });

          const percent = Math.round(((rowNumber - 3) / totalRows) * 100);
          setProgress(percent);
        }
      }

      // ✅ Sắp xếp theo lớp (cột "lop")
      data.sort((a, b) => a.lop.localeCompare(b.lop, "vi", { sensitivity: "base" }));

      // ✅ Đánh lại STT sau khi sắp xếp
      data = data.map((item, index) => ({
        ...item,
        stt: index + 1,
      }));

      await batch.commit();
      //setRows(data);           // cập nhật local state
      //setContextRows(data);    // lưu vào context để tái sử dụng
      syncRows(data);

      setSuccess(true);
      setMessage("Tải dữ liệu thành công!");
    } catch (err) {
      console.error("Lỗi khi ghi Firestore:", err);
      setSuccess(false);
      setMessage("Đã xảy ra lỗi khi tải dữ liệu.");
    }

    setLoading(false);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 4000);
  };

  useEffect(() => {
    if (setUploadHandler) {
      setUploadHandler(() => handleFileUpload);
      return () => setUploadHandler(null);
    }
  }, [setUploadHandler]);


  // Thêm hàng thủ công
  const handleAddRow = async () => {
    const { hoTen, lop } = newRow;

    if (!hoTen || !lop) return;

    // Kiểm tra xem đã có giáo viên này dạy lớp này chưa
    const isDuplicate = rows.some(
      (row) =>
        row.hoTen.trim().toLowerCase() === hoTen.trim().toLowerCase() &&
        row.lop.trim().toLowerCase() === lop.trim().toLowerCase()
    );

    if (isDuplicate) {
      console.warn("Giáo viên đã tồn tại cho lớp này.");
      return;
    }

    // ✅ Thêm mới
    let updatedRows = [...rows, { hoTen, lop }];

    // ✅ Sắp xếp lại theo cột "lop"
    updatedRows.sort((a, b) =>
      a.lop.localeCompare(b.lop, "vi", { sensitivity: "base" })
    );

    // ✅ Đánh lại STT
    updatedRows = updatedRows.map((item, index) => ({
      ...item,
      stt: index + 1,
    }));

    //setRows(updatedRows);        // cập nhật local state
    //setContextRows(updatedRows); // lưu vào context để tái sử dụng
    syncRows(updatedRows);

    try {
      const docRef = doc(db, "GVCN_2025-2026", lop);
      await setDoc(docRef, { hoTen, lop });
    } catch (err) {
      console.error("Lỗi khi ghi Firestore:", err);
    }

    setNewRow({ hoTen: "", lop: "" });
  };


  // Xuất Excel
  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("GVBoMon");

    worksheet.addRow(["Họ và Tên", "Lớp"]);
    rows.forEach((item) => worksheet.addRow([item.hoTen, item.lop]));

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "DanhSachGVBoMon.xlsx");
  };
  
  const handleEditRow = (index) => {
    const row = rows[index];
    setNewRow({ hoTen: row.hoTen, lop: row.lop });
    setIsEditing(true);
    setEditingIndex(index);
  };

  const handleUpdateRow = async () => {
    if (!newRow.hoTen || !newRow.lop) return;

    const isDuplicate = rows.some(
      (row, idx) =>
        idx !== editingIndex &&
        row.hoTen.trim().toLowerCase() === newRow.hoTen.trim().toLowerCase() &&
        row.lop.trim().toLowerCase() === newRow.lop.trim().toLowerCase()
    );

    if (isDuplicate) {
      console.warn("Giáo viên đã tồn tại cho lớp này.");
      return;
    }

    const updatedRows = [...rows];
    const oldLop = rows[editingIndex].lop;

    // ✅ Cập nhật thông tin dòng đang chỉnh sửa
    updatedRows[editingIndex] = {
      hoTen: newRow.hoTen,
      lop: newRow.lop,
    };

    // ✅ Sắp xếp lại theo "lop"
    updatedRows.sort((a, b) =>
      a.lop.localeCompare(b.lop, "vi", { sensitivity: "base" })
    );

    // ✅ Đánh lại STT
    const finalRows = updatedRows.map((item, index) => ({
      ...item,
      stt: index + 1,
    }));

    //setRows(finalRows);
    //setContextRows(finalRows); // ✅ cập nhật lại context sau khi sửa
    syncRows(finalRows);


    try {
      const newDocRef = doc(db, "GVCN_2025-2026", newRow.lop);
      await setDoc(newDocRef, { hoTen: newRow.hoTen, lop: newRow.lop });

      if (oldLop !== newRow.lop) {
        const oldDocRef = doc(db, "GVCN_2025-2026", oldLop);
        await deleteDoc(oldDocRef); // ✅ xóa lớp cũ nếu đã đổi lớp
      }
    } catch (err) {
      console.error("Lỗi khi cập nhật Firestore:", err);
    }

    setNewRow({ hoTen: "", lop: "" });
    setIsEditing(false);
    setEditingIndex(null);
    setSelectedRow(null); // ✅ hủy chọn dòng sau khi sửa
  };

  const handleDeleteRow = async (idx) => {
    const row = rows[idx];
    const confirmDelete = window.confirm(
      `Bạn có chắc muốn xóa giáo viên: ${row.hoTen} - Lớp ${row.lop}?`
    );

    if (!confirmDelete) return;

    try {
      // ✅ Xóa trong Firestore
      const docRef = doc(db, "GVCN_2025-2026", row.lop);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("❌ Lỗi khi xóa Firestore:", err);
    }

    // ✅ Cập nhật lại local state
    const updatedRows = rows.filter((_, i) => i !== idx);

    // ✅ Sắp xếp lại theo "lop"
    updatedRows.sort((a, b) =>
      a.lop.localeCompare(b.lop, "vi", { sensitivity: "base" })
    );

    // ✅ Đánh lại STT
    const finalRows = updatedRows.map((item, index) => ({
      ...item,
      stt: index + 1,
    }));

    //setRows(finalRows);
    //setContextRows(finalRows); // nếu dùng context
    syncRows(finalRows);

    setSelectedRow(null);      // bỏ chọn dòng
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: 4, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
      <Card elevation={6} sx={{ maxWidth: 600, mx: "auto", borderRadius: 3, position: "relative" }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          
          {/* Header với nút upload ở góc trên trái */}
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

            {/* Tiêu đề căn giữa */}
            <Typography
              variant="h5"
              align="center"
              fontWeight="bold"
              color="primary"
              gutterBottom
              sx={{ mt: 1 }}
            >
              DANH SÁCH GIÁO VIÊN CHỦ NHIỆM
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
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold", textTransform: "uppercase", width: "60px" }}>
                    STT
                  </TableCell>
                  <TableCell align="center" sx={{ backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold", textTransform: "uppercase" }}>
                    Họ và Tên
                  </TableCell>
                  <TableCell align="center" sx={{ backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold", textTransform: "uppercase" }}>
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
                    key={idx}
                    sx={{
                      "&:hover .action-icon": { opacity: 1 },
                      "&:hover": { backgroundColor: "#f5f5f5" },
                    }}
                  >
                    <TableCell align="center">{row.stt || idx + 1}</TableCell>

                    {/* 👉 Họ và tên hiển thị trên 1 dòng, phần thừa "..." */}
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

                    <TableCell align="center">{row.lop}</TableCell>

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
                            onClick={() => handleDeleteRow(idx)}
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
              sx={{ flex: 1 }}
            />
            <Autocomplete
              freeSolo
              options={danhSachLop}
              value={newRow.lop}
              onChange={(event, newValue) => { setNewRow({ ...newRow, lop: newValue || "" }); }}
              onInputChange={(event, newInputValue) => { setNewRow({ ...newRow, lop: newInputValue }); }}
              size="small"
              sx={{ width: 120 }}
              renderInput={(params) => <TextField {...params} label="Lớp" />}
            />
            {isEditing ? (
              <>
                <Button variant="outlined" color="warning" onClick={handleUpdateRow}>Sửa</Button>
                <Button variant="text" color="inherit" onClick={() => { setIsEditing(false); setEditingIndex(null); setNewRow({ hoTen: "", lop: "" }); setSelectedRow(null); }}>Hủy</Button>
              </>
            ) : (
              <Button variant="contained" onClick={handleAddRow}>Thêm</Button>
            )}
          </Box>

        </CardContent>
      </Card>
    </Box>
  );
}