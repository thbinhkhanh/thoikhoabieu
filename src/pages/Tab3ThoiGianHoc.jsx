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
  CardContent,
  Grid
} from "@mui/material";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase"; // import db đúng đường dẫn của bạn

export default function Tab3ThoiGianHoc() {
  const [localThoiGian, setLocalThoiGian] = useState({
    buoiSang: [
      { tiet: "Truy bài", gio: "" },
      { tiet: "Tiết 1", gio: "" },
      { tiet: "Tiết 2", gio: "" },
      { tiet: "Tiết 3", gio: "" },
      { tiet: "Tiết 4", gio: "" },
      { tiet: "Tiết 5", gio: "" },
      { tiet: "Ra chơi", gio: "" },
    ],
    buoiChieu: [
      { tiet: "Tiết 1", gio: "" },
      { tiet: "Tiết 2", gio: "" },
      { tiet: "Tiết 3", gio: "" },
      { tiet: "Tiết 4", gio: "" },
      { tiet: "Ra chơi", gio: "" },
    ]
  });

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  // Lấy dữ liệu từ Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, "THOIGIANHOC", "thoiGian");
        const docSnap = await getDoc(docRef);

        const defaultBuoiSang = [
          { tiet: "Truy bài", gio: "" },
          { tiet: "Tiết 1", gio: "" },
          { tiet: "Tiết 2", gio: "" },
          { tiet: "Tiết 3", gio: "" },
          { tiet: "Tiết 4", gio: "" },
          { tiet: "Tiết 5", gio: "" },
          { tiet: "Ra chơi", gio: "" },
        ];

        const defaultBuoiChieu = [
          { tiet: "Tiết 1", gio: "" },
          { tiet: "Tiết 2", gio: "" },
          { tiet: "Tiết 3", gio: "" },
          { tiet: "Tiết 4", gio: "" },
          { tiet: "Ra chơi", gio: "" },
        ];

        const fillBuoi = (arr, defaultArr) => {
          const newArr = [...arr];
          for (let i = arr.length; i < defaultArr.length; i++) {
            newArr.push({ ...defaultArr[i] });
          }
          return newArr;
        };

        if (docSnap.exists()) {
          const data = docSnap.data();
          setLocalThoiGian({
            buoiSang: fillBuoi(data.buoiSang || [], defaultBuoiSang),
            buoiChieu: fillBuoi(data.buoiChieu || [], defaultBuoiChieu),
          });
        } else {
          console.warn("⚠️ Tab 3: Không có dữ liệu, dùng mặc định");
        }
      } catch (err) {
        console.error("❌ Lỗi khi fetch Tab 3:", err);
      }
    };

    fetchData();
  }, []);

  // Lưu trực tiếp ô thay đổi
  const saveData = async (buoi, idx, field, value) => {
    try {
      setSaving(true);
      setProgress(30);

      const updated = [...(localThoiGian[buoi] || [])];
      updated[idx][field] = value;
      const newState = { ...localThoiGian, [buoi]: updated };
      setLocalThoiGian(newState);

      const docRef = doc(db, "THOIGIANHOC", "thoiGian");
      await updateDoc(docRef, newState);

      setProgress(100);
    } catch (err) {
      console.error(`❌ Lỗi khi lưu ${field} của ${buoi}[${idx}]:`, err);
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  const renderTable = (buoi, title, optionsTiet) => (
    <>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, ml: 2 }}>
        {title}
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ width: "40%", backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold" }}>
                TIẾT
              </TableCell>
              <TableCell align="center" sx={{ width: "60%", backgroundColor: "#1976d2", color: "#fff", fontWeight: "bold" }}>
                THỜI GIAN
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(localThoiGian[buoi] || []).map((row, idx) => (
              <TableRow key={idx}>
                <TableCell align="center">
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={row.tiet || ""}
                    onChange={(e) => saveData(buoi, idx, "tiet", e.target.value)}
                  >
                    {optionsTiet.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell align="center">
                  <TextField
                    size="small"
                    fullWidth
                    value={row.gio || ""}
                    onChange={(e) => saveData(buoi, idx, "gio", e.target.value)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );

  return (
    <Box sx={{ mt: 1.5, pt: "20px", pb: 6, px: { xs: 1, sm: 2 }, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
      <Card elevation={6} sx={{ maxWidth: 500, mx: "auto", borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" align="center" fontWeight="bold" sx={{ color: "#1976d2", mb: 2 }}>
            THỜI GIAN HỌC
          </Typography>

          {renderTable(
            "buoiSang",
            "BUỔI SÁNG",
            ["Truy bài", "Tiết 1", "Tiết 2", "Tiết 3", "Tiết 4", "Tiết 5", "Ra chơi"]
          )}
          {renderTable(
            "buoiChieu",
            "BUỔI CHIỀU",
            ["Tiết 1", "Tiết 2", "Tiết 3", "Tiết 4", "Ra chơi"]
          )}

          {/*{saving && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Box sx={{ width: 200, textAlign: "center" }}>
                <LinearProgress variant="determinate" value={progress} sx={{ mb: 0, height: 3, borderRadius: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Đang lưu... {progress}%
                </Typography>
              </Box>
            </Box>
          )}*/}
        </CardContent>
      </Card>
    </Box>
  );
}
