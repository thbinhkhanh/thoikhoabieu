import React, { useState, useEffect } from "react";
import { Box, Grid, TextField, MenuItem, Typography, LinearProgress, Card, CardContent } from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Tab1ThongTin({ saving, progress }) {
  const [ubnd, setUbnd] = useState("");
  const [truong, setTruong] = useState("");
  const [namHoc, setNamHoc] = useState("");
  const [ngayApDung, setNgayApDung] = useState(null);

  // Fetch dữ liệu khi component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, "THONGTIN", "INFO");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          //console.log("✅ Dữ liệu Tab 1:", data);

          setUbnd(data.ubnd || "");
          setTruong(data.truong || "");
          setNamHoc(data.namHoc || "");
          setNgayApDung(data.ngayApDung ? dayjs(data.ngayApDung) : null);
        } else {
          console.warn("⚠️ Tab 1: Không có dữ liệu");
        }
      } catch (err) {
        console.error("❌ Lỗi khi fetch Tab 1:", err);
      }
    };

    fetchData();
  }, []);

  // Hàm lưu từng trường vào Firestore
  const saveData = async (field, value) => {
    try {
      const docRef = doc(db, "THONGTIN", "INFO");

      let formattedValue = value;

      // Nếu là field ngày thì format về yyyy/MM/dd
      if (field === "ngayApDung" && value) {
        formattedValue = dayjs(value).format("YYYY/MM/DD");
      }

      await updateDoc(docRef, { [field]: formattedValue });

      //console.log(`✅ Đã lưu ${field}:`, formattedValue);
    } catch (err) {
      console.error(`❌ Lỗi khi lưu ${field}:`, err);
    }
  };


  return (
    <Box sx={{ mt: 1.5, pt: "20px", pb: 6, px: { xs: 1, sm: 2 }, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
      <Card elevation={6} sx={{ maxWidth: 500, mx: "auto", borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" align="center" fontWeight="bold" sx={{ color: "#1976d2", mb: 2 }}>
            THÔNG TIN CHUNG
          </Typography>

          <Grid container spacing={2} direction="column" alignItems="center">
            <Grid item>
              <TextField
                label="Ủy ban nhân dân"
                value={ubnd}
                onChange={(e) => {
                  setUbnd(e.target.value);
                  saveData("ubnd", e.target.value);
                }}
                size="small"
                sx={{ width: 250 }}
              />
            </Grid>

            <Grid item>
              <TextField
                label="Trường tiểu học"
                value={truong}
                onChange={(e) => {
                  setTruong(e.target.value);
                  saveData("truong", e.target.value);
                }}
                size="small"
                sx={{ width: 250 }}
              />
            </Grid>

            <Grid item>
              <TextField
                select
                label="Năm học"
                value={namHoc}
                onChange={(e) => {
                  setNamHoc(e.target.value);
                  saveData("namHoc", e.target.value);
                }}
                size="small"
                sx={{ width: 250 }}
              >
                <MenuItem value="2025-2026">2025 - 2026</MenuItem>
                <MenuItem value="2026-2027">2026 - 2027</MenuItem>
                <MenuItem value="2027-2028">2027 - 2028</MenuItem>
              </TextField>
            </Grid>

            <Grid item>
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
                <DatePicker
                  label="Ngày áp dụng"
                  value={ngayApDung}
                  onChange={(newValue) => {
                    setNgayApDung(newValue);
                    saveData("ngayApDung", newValue?.toISOString());
                  }}
                  slotProps={{
                    textField: { fullWidth: true, size: "small", sx: { width: 250 } },
                  }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>

          {saving && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Box sx={{ width: 200, textAlign: "center" }}>
                <LinearProgress variant="determinate" value={progress} sx={{ mb: 0, height: 3, borderRadius: 1 }} />
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
