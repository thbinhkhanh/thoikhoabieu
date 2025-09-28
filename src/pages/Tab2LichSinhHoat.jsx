import React, { useState, useEffect } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Typography,
  LinearProgress,
  Card,
  CardContent
} from "@mui/material";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase"; // chỉnh đường dẫn đến firebase.js của bạn

export default function Tab2LichSinhHoat({ saving, progress }) {
  const [localLich, setLocalLich] = useState([]);

  // Fetch dữ liệu
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docSnap = await getDoc(doc(db, "SINHHOATCM", "LICHSINHHOAT"));
        if (docSnap.exists()) {
          const data = docSnap.data(); // { lichSinhHoat: [...] }

          const arr = (data.lichSinhHoat || []).map((item, index) => ({
            khoi: item.khoi || `Khối ${index + 1}`,
            thu: item.thu || "Thứ Hai"
          }));

          setLocalLich(arr);
        } else {
          // Nếu document không tồn tại, dùng dữ liệu mặc định
          const defaultData = [
            { khoi: "Khối 1", thu: "Thứ Hai" },
            { khoi: "Khối 2", thu: "Thứ Ba" },
            { khoi: "Khối 3", thu: "Thứ Tư" },
            { khoi: "Khối 4", thu: "Thứ Năm" },
            { khoi: "Khối 5", thu: "Thứ Sáu" },
          ];
          setLocalLich(defaultData);
        }
      } catch (error) {
        console.error("❌ Lỗi khi lấy dữ liệu LICHSINHHOAT:", error);
      }
    };

    fetchData();
  }, []);

  // Hàm lưu từng ô
  const saveData = async (index, field, value) => {
    try {
      const docRef = doc(db, "SINHHOATCM", "LICHSINHHOAT");
      const updated = [...localLich];
      updated[index][field] = value;
      setLocalLich(updated);

      // Lưu toàn bộ mảng updated vào Firestore
      await updateDoc(docRef, { lichSinhHoat: updated });
      //console.log(`✅ Đã lưu ${field} của Khối ${index + 1}:`, value);
    } catch (err) {
      console.error(`❌ Lỗi khi lưu ${field} của Khối ${index + 1}:`, err);
    }
  };

  return (
    <Box sx={{ mt: 1.5, pt: "20px", pb: 6, px: { xs: 1, sm: 2 }, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
      <Card elevation={6} sx={{ maxWidth: 500, mx: "auto", borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" align="center" fontWeight="bold" sx={{ color: "#1976d2", mb: 2 }}>
            LỊCH SINH HOẠT TỔ CHUYÊN MÔN
          </Typography>

          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell
                    align="center"
                    sx={{ width: "40%", backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold" }}
                  >
                    KHỐI
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ width: "60%", backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold" }}
                  >
                    THỨ
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {localLich.length > 0 ? (
                  localLich.map((row, i) => (
                    <TableRow key={row.khoi || i}>
                      <TableCell align="center">{row.khoi}</TableCell>
                      <TableCell align="center">
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={row.thu || ""}
                          onChange={(e) => saveData(i, "thu", e.target.value)}
                        >
                          {["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"].map((thu) => (
                            <MenuItem key={thu} value={thu}>{thu}</MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} align="center">Đang tải dữ liệu...</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

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
        </CardContent>
      </Card>
    </Box>
  );
}
