import React, { useState, useEffect } from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Container,
  Card,
  CardHeader,
  CardContent,
  TextField,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Checkbox,
  Button,
  Grid,
  TableContainer,
  Paper,
  Tooltip,
  IconButton,
  Stack,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";

import InfoIcon from "@mui/icons-material/Info";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ScheduleIcon from "@mui/icons-material/Schedule";
import MenuBookIcon from "@mui/icons-material/MenuBook";

import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/vi";
import dayjs from "dayjs";
import { setDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import LinearProgress from "@mui/material/LinearProgress";

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function HeThong() {
  const [tab, setTab] = useState(0);
  const [namHoc, setNamHoc] = useState("2025-2026");

  const [selectedMon, setSelectedMon] = useState(null);
  const [newMon, setNewMon] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [ngayApDung, setNgayApDung] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [monHoc, setMonHoc] = useState({});

  // --- Map độ rộng cho từng tab (chỉ sửa ở đây) ---
  const tabWidths = {
    0: "810px",  // Tab 1 - Thông tin chung
    1: "810px",  // Tab 2 - Lịch sinh hoạt
    2: "810px",  // Tab 3 - Thời gian học
    3: "1000px", // Tab 4 - Danh sách môn học
  };
  // -------------------------------------------------

  // Tab 1: Thông tin chung
  const fetchTab1 = async () => {
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

  // ✅ Hàm lấy dữ liệu lịch sinh hoạt từ Firestore cho Tab 2
  const fetchTab2 = async () => {
    //console.log("🔄 Đang gọi fetchTab2...");

    try {
      const docSnap = await getDoc(doc(db, "SINHHOATCM", "LICHSINHHOAT"));
      if (docSnap.exists()) {
        const data = docSnap.data(); // { lichSinhHoat: [...] }
        //console.log("✅ Dữ liệu lấy được từ Firestore:", data);

        const arr = (data.lichSinhHoat || []).map((item, index) => {
          //console.log(`🔍 Dòng ${index}:`, item);
          return {
            khoi: item.khoi || `Khối ${index + 1}`,
            thu: item.thu || "Thứ Hai",
          };
        });

        //console.log("📋 Mảng sau khi xử lý:", arr);
        setLichSinhHoat(arr);
      } else {
        console.warn("⚠️ Không tìm thấy document LICHSINHHOAT, dùng dữ liệu mặc định.");
        const defaultData = [
          { khoi: "Khối 1", thu: "Thứ Hai" },
          { khoi: "Khối 2", thu: "Thứ Ba" },
          { khoi: "Khối 3", thu: "Thứ Tư" },
          { khoi: "Khối 4", thu: "Thứ Năm" },
          { khoi: "Khối 5", thu: "Thứ Sáu" },
        ];
        //console.log("📋 Dữ liệu mặc định:", defaultData);
        setLichSinhHoat(defaultData);
      }
    } catch (error) {
      console.error("❌ Lỗi khi lấy dữ liệu LICHSINHHOAT:", error);
    }
  };

  // Tab 3: Thời gian học
  const fetchTab3 = async () => {
    try {
      const docRef = doc(db, "THOIGIANHOC", "thoiGian");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        //console.log("✅ Dữ liệu Tab 3:", data);

        setThoiGianHoc({
          buoiSang: data.buoiSang || [],
          buoiChieu: data.buoiChieu || [],
        });
      } else {
        console.warn("⚠️ Tab 3: Không có dữ liệu");
      }
    } catch (err) {
      console.error("❌ Lỗi khi fetch Tab 3:", err);
    }
  };

  useEffect(() => {
    if (tab === 0) fetchTab1();
    if (tab === 1) fetchTab2();
    if (tab === 2) fetchTab3();
  }, [tab]);

  useEffect(() => {
    const fetchMonHoc = async () => {
      try {
        let loaded = {};

        // đọc doc MON để lấy toàn bộ danh sách môn
        const monSnap = await getDoc(doc(db, "MONHOC_2025-2026", "MON"));
        const { monHoc: allSubjects = [] } = monSnap.exists() ? monSnap.data() : {};

        // khởi tạo state mặc định cho tất cả môn
        allSubjects.forEach((subject) => {
          loaded[subject] = { lop1: false, lop2: false, lop3: false, lop4: false, lop5: false };
        });

        // đọc tất cả doc K1..K5 và gán lại true nếu môn có trong danh sách
        for (const { docId, key } of COLS) {
          const snap = await getDoc(doc(db, "MONHOC_2025-2026", docId));
          if (snap.exists()) {
            const { monHoc: monList = [] } = snap.data();

            monList.forEach((subject) => {
              if (!loaded[subject]) {
                // fallback nếu trong Kx có môn chưa có trong MON
                loaded[subject] = { lop1: false, lop2: false, lop3: false, lop4: false, lop5: false };
              }
              loaded[subject][key] = true;
            });
          }
        }

        setMonHoc(loaded); // cập nhật lại state
        //console.log("✅ Tải môn học thành công:", loaded);
      } catch (err) {
        console.error("❌ Lỗi khi tải môn học:", err);
      }
    };

    fetchMonHoc();
  }, []);

  // Map giữa document trong Firestore và key checkbox trong state
  const COLS = [
    { docId: "K1", key: "lop1" },
    { docId: "K2", key: "lop2" },
    { docId: "K3", key: "lop3" },
    { docId: "K4", key: "lop4" },
    { docId: "K5", key: "lop5" },
  ];

  // Lấy danh sách môn có checkbox = true cho một cột (key)
  const getSubjectsChecked = (key) =>
    Object.entries(monHoc)
      .filter(([, data]) => {
        if (typeof data === "boolean") return data; // fallback nếu chưa đổi cấu trúc
        return !!data?.[key];
      })
      .map(([subject]) => subject);

  // Lấy toàn bộ danh sách môn ở cột "Tên môn học"
  const getAllSubjects = () => Object.keys(monHoc);

  // Cập nhật Firestore
  const handleUpdate_Tab4 = async () => {
    setSaving(true);       // Bắt đầu hiển thị tiến trình
    setProgress(10);       // Khởi động ở mức 10%

    try {
      const writes = COLS.map(({ docId, key }) => {
        const subjects = getSubjectsChecked(key);
        return setDoc(doc(db, "MONHOC_2025-2026", docId), { monHoc: subjects });
      });

      // thêm ghi doc MON
      const allSubjects = getAllSubjects();
      writes.push(
        setDoc(doc(db, "MONHOC_2025-2026", "MON"), { monHoc: allSubjects })
      );

      await Promise.all(writes);

      //console.log("✅ Cập nhật môn học theo từng lớp + MON thành công.");
      setProgress(100);    // Hoàn tất tiến trình

      setTimeout(() => {
        setSaving(false);
        setProgress(0);
      }, 800); // Cho người dùng thấy hiệu ứng hoàn tất
    } catch (err) {
      console.error("❌ Lỗi khi cập nhật:", err);
      setSaving(false);
      setProgress(0);
    }
  };

  const handleChange = (event, newValue) => setTab(newValue);

  const handleAddMon = () => {
    if (!newMon.trim()) return;
    if (monHoc.hasOwnProperty(newMon.trim())) return;
    setMonHoc({ ...monHoc, [newMon.trim()]: true });
    setNewMon("");
  };

  const handleEditMon = () => {
    if (!selectedMon || !newMon.trim()) return;
    const updated = { ...monHoc };
    delete updated[selectedMon];
    updated[newMon.trim()] = true;
    setMonHoc(updated);
    setNewMon("");
    setSelectedMon(null);
    setIsEditing(false);
  };

  const handleDeleteMon = (mon) => {
    const confirmDelete = window.confirm(`⚠️ Bạn có chắc muốn xóa môn "${mon}" không?`);

    if (!confirmDelete) return;

    const updated = { ...monHoc };
    delete updated[mon];
    setMonHoc(updated);
    setSelectedMon(null);
    setIsEditing(false);

    //console.log(`✅ Đã xóa môn "${mon}" khỏi danh sách.`);
  };

  // Khai báo state
  const [ubnd, setUbnd] = useState("Xã Bình Khánh");
  const [truong, setTruong] = useState("Bình Khánh");

  const handleUpdate_Tab1 = async () => {
    setSaving(true);
    setProgress(10); // bắt đầu tiến trình

    try {
      await setDoc(doc(db, "THONGTIN", "INFO"), {
        ubnd,
        truong,
        namHoc,
        ngayApDung: ngayApDung ? dayjs(ngayApDung).format("YYYY-MM-DD") : null,
      });

      setProgress(100); // hoàn tất
      setTimeout(() => {
        setSaving(false);
        setProgress(0);
      }, 1000); // cho người dùng thấy tiến trình hoàn tất
    } catch (err) {
      console.error("❌ Lỗi khi lưu Tab 1:", err);
      setSaving(false);
      setProgress(0);
    }
  };

 const [lichSinhHoat, setLichSinhHoat] = useState([
  { khoi: "Khối 1", thu: "Thứ Hai" },
  { khoi: "Khối 2", thu: "Thứ Ba" },
  { khoi: "Khối 3", thu: "Thứ Tư" },
  { khoi: "Khối 4", thu: "Thứ Năm" },
  { khoi: "Khối 5", thu: "Thứ Sáu" },
]);

  
  const handleUpdate_Tab2 = async () => {
    setSaving(true);       // Bắt đầu hiển thị tiến trình
    setProgress(10);       // Khởi động ở mức 10%

    try {
      await setDoc(doc(db, "SINHHOATCM", "LICHSINHHOAT"), {
        lichSinhHoat, // lưu mảng {khoi, thu}
      });

      setProgress(100);    // Đặt tiến trình hoàn tất
      setTimeout(() => {
        setSaving(false);  // Ẩn tiến trình sau khi hoàn tất
        setProgress(0);    // Reset về 0 để sẵn sàng cho lần sau
      }, 1000);
    } catch (err) {
      console.error("❌ Lỗi khi lưu Tab 2:", err);
      setSaving(false);
      setProgress(0);
    }
  };

  // Khởi tạo state
const [thoiGianHoc, setThoiGianHoc] = useState({
  buoiSang: [
    { tiet: "Tiết 1", gio: "07h00 - 07h40" },
    { tiet: "Tiết 2", gio: "07h45 - 08h25" },
    { tiet: "Tiết 3", gio: "08h30 - 09h10" },
    { tiet: "Tiết 4", gio: "09h15 - 09h55" },
    { tiet: "Tiết 5", gio: "10h00 - 10h40" },
  ],
  buoiChieu: [
    { tiet: "Tiết 1", gio: "14h00 - 14h40" },
    { tiet: "Tiết 2", gio: "14h45 - 15h25" },
    { tiet: "Tiết 3", gio: "15h30 - 16h10" },
    { tiet: "Tiết 4", gio: "16h15 - 16h55" },
  ],
});

const handleUpdate_Tab3 = async () => {
  setSaving(true);       // Bắt đầu hiển thị tiến trình
  setProgress(10);       // Khởi động ở mức 10%

  try {
    await setDoc(doc(db, "THOIGIANHOC", "thoiGian"), {
      buoiSang: thoiGianHoc.buoiSang,
      buoiChieu: thoiGianHoc.buoiChieu,
    });

    //console.log("✅ Lưu Tab 3 thành công");
    setProgress(100);    // Hoàn tất tiến trình

    setTimeout(() => {
      setSaving(false);
      setProgress(0);
    }, 800); // Cho người dùng thấy hiệu ứng hoàn tất
  } catch (err) {
    console.error("❌ Lỗi khi lưu Tab 3:", err);
    setSaving(false);
    setProgress(0);
  }
};


  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{
        px: { xs: 1, sm: 3 },
        py: 4,
        bgcolor: "#e3f2fd", // nền xanh nhạt
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      {/* CHỈ SỬA Ở DÒNG width: sử dụng tabWidths[tab] */}
      <Card sx={{ width: tabWidths[tab] || "70%", boxShadow: 3, borderRadius: 2, transition: "width 0.3s ease" }}>
        <CardHeader
          title="THIẾT LẬP HỆ THỐNG"
          //subheader="Quản lý thông tin chung, lịch sinh hoạt, thời gian học và môn học"
          sx={{ textAlign: "center", pb: 0 }}
          titleTypographyProps={{
            align: "center",
            fontWeight: "bold",
            variant: "h5",
            sx: { color: "#1976d2", mt: 2, mb: 0 },
          }}
          subheaderTypographyProps={{
            align: "center",
            variant: "h6", // 👈 tăng cỡ chữ (h6 thay cho subtitle1)
            sx: { color: "text.secondary", fontWeight: "bold", mt: 0.5, mb: 2 },
          }}
        />

        <CardContent>
          {/* Tabs */}
          <Tabs
            value={tab}
            onChange={handleChange}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab icon={<InfoIcon />} iconPosition="start" label="Thông tin chung" />
            <Tab icon={<CalendarTodayIcon />} iconPosition="start" label="Lịch sinh hoạt" />
            <Tab icon={<ScheduleIcon />} iconPosition="start" label="Thời gian học" />
            <Tab icon={<MenuBookIcon />} iconPosition="start" label="Danh sách môn học" />
          </Tabs>

          {/* Tab 1 - Thông tin chung */}
          <TabPanel value={tab} index={0}>
            <Typography
              variant="h6"
              align="center"
              fontWeight="bold"
              sx={{ color: "#1976d2", mb: 2 }}
            >
              THÔNG TIN CHUNG
            </Typography>

            <Grid container spacing={2} direction="column" alignItems="center">
              <Grid item sx={{ mt: 0, mb: 0 }}>
                <TextField
                  label="Ủy ban nhân dân"
                  value={ubnd}                  // dùng state
                  onChange={(e) => setUbnd(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ width: 300 }}
                />
              </Grid>

              <Grid item sx={{ mt: 0, mb: 0 }}>
                <TextField
                  label="Trường tiểu học"
                  value={truong}                // dùng state
                  onChange={(e) => setTruong(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ width: 300 }}
                />
              </Grid>

              <Grid item sx={{ mt: 0, mb: 0 }}>
                <TextField
                  select
                  label="Năm học"
                  value={namHoc}
                  onChange={(e) => setNamHoc(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ width: 300 }}
                >
                  <MenuItem value="2025-2026">2025 - 2026</MenuItem>
                  <MenuItem value="2026-2027">2026 - 2027</MenuItem>
                  <MenuItem value="2027-2028">2027 - 2028</MenuItem>
                  <MenuItem value="2028-2029">2028 - 2029</MenuItem>
                  <MenuItem value="2029-2030">2029 - 2030</MenuItem>
                </TextField>
              </Grid>

              <Grid item sx={{ mt: 0, mb: 0 }}>
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
                  <DatePicker
                    label="Ngày áp dụng"
                    value={ngayApDung}
                    onChange={(newValue) => setNgayApDung(newValue)}
                    slotProps={{
                      textField: { fullWidth: true, size: "small", sx: { width: 300 } },
                    }}
                  />
                </LocalizationProvider>
              </Grid>
            </Grid>
            <Grid container justifyContent="center">
              <Grid item sx={{ mt: 0, mb: 0 }}>
                <Button
                  variant="contained"
                  onClick={handleUpdate_Tab1}
                  startIcon={<SaveIcon />}   // 👈 icon bên trái chữ
                  sx={{ minWidth: 120, mt: 3 }}
                >
                  Lưu
                </Button>
                {/* Thanh tiến trình dưới nút Lưu */}
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
              </Grid>
            </Grid>
          </TabPanel>

          {/* Tab 2 - Lịch sinh hoạt */}
          <TabPanel value={tab} index={1}>
            <Typography
              variant="h6"
              align="center"
              fontWeight="bold"
              sx={{ color: "#1976d2", mb: 2 }}
            >
              LỊCH SINH HOẠT TỔ CHUYÊN MÔN
            </Typography>

            <TableContainer
              component={Paper}
              sx={{ mb: 3, width: "400px", mx: "auto" }} // 👈 thêm width và căn giữa
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      align="center"
                      sx={{
                        width: "40%",
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                      }}
                    >
                      KHỐI
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        width: "60%",
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                      }}
                    >
                      THỨ
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lichSinhHoat.map((row, i) => (
                    <TableRow key={row.khoi}>
                      <TableCell align="center">{row.khoi}</TableCell>
                      <TableCell align="center">
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={row.thu}   // 👈 dùng state
                          onChange={(e) => {
                            const newLich = [...lichSinhHoat];
                            newLich[i].thu = e.target.value;
                            setLichSinhHoat(newLich);
                          }}
                        >
                          {["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"].map((thu) => (
                            <MenuItem key={thu} value={thu}>
                              {thu}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>

              </Table>
            </TableContainer>
            <Grid container justifyContent="center">
              <Grid item sx={{ mt: 0, mb: 0 }}>
                <Button
                  variant="contained"
                  onClick={handleUpdate_Tab2}
                  startIcon={<SaveIcon />}   // 👈 icon bên trái chữ
                  sx={{ minWidth: 120, mt: 0 }}
                >
                  Lưu
                </Button>
                {/* Thanh tiến trình dưới nút Lưu */}
                  {/* Thanh tiến trình dưới nút Lưu - chỉ hiển thị ở Tab 2 */}
                    {saving && tab === 1 && (
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
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <Typography
              variant="h6"
              align="center"
              fontWeight="bold"
              sx={{ color: "#1976d2", mb: 0 }}
            >
              THỜI GIAN HỌC
            </Typography>

            {/* Buổi sáng */}
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              sx={{ mb: 1, ml: 8 }}   // 👈 lùi qua phải 1 chút
            >
              BUỔI SÁNG
            </Typography>
            <TableContainer
              component={Paper}
              sx={{ mb: 3, width: "400px", mx: "auto" }}   // 👈 chỉnh độ rộng thủ công
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      align="center"
                      sx={{
                        width: "40%",
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                      }}
                    >
                      TIẾT
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        width: "60%",
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                      }}
                    >
                      THỜI GIAN
                    </TableCell>
                  </TableRow>
                </TableHead>
                {/* Buổi sáng */}
                <TableBody>
                  {thoiGianHoc.buoiSang.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell align="center">
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={row.tiet}
                          onChange={(e) => {
                            const newBuoiSang = [...thoiGianHoc.buoiSang];
                            newBuoiSang[idx].tiet = e.target.value;
                            setThoiGianHoc({ ...thoiGianHoc, buoiSang: newBuoiSang });
                          }}
                        >
                          {["Chào cờ", "Tiết 1", "Tiết 2", "Tiết 3", "Tiết 4", "Tiết 5", "Ra chơi"].map(
                            (option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            )
                          )}
                        </TextField>
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          size="small"
                          fullWidth
                          value={row.gio}
                          onChange={(e) => {
                            const newBuoiSang = [...thoiGianHoc.buoiSang];
                            newBuoiSang[idx].gio = e.target.value;
                            setThoiGianHoc({ ...thoiGianHoc, buoiSang: newBuoiSang });
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Buổi chiều */}
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              sx={{ mb: 1, ml: 8 }}   // 👈 lùi qua phải 1 chút
            >
              BUỔI CHIỀU
            </Typography>
            <TableContainer
              component={Paper}
              sx={{ width: "400px", mx: "auto" }}   // 👈 chỉnh riêng cho buổi chiều
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      align="center"
                      sx={{
                        width: "40%",
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                      }}
                    >
                      TIẾT
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        width: "60%",
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                      }}
                    >
                      THỜI GIAN
                    </TableCell>
                  </TableRow>
                </TableHead>
                {/* Buổi chiều */}
                <TableBody>
                  {thoiGianHoc.buoiChieu.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell align="center">
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={row.tiet}
                          onChange={(e) => {
                            const newBuoiChieu = [...thoiGianHoc.buoiChieu];
                            newBuoiChieu[idx].tiet = e.target.value;
                            setThoiGianHoc({ ...thoiGianHoc, buoiChieu: newBuoiChieu });
                          }}
                        >
                          {["Tiết 1", "Tiết 2", "Tiết 3", "Tiết 4", "Ra chơi"].map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          size="small"
                          fullWidth
                          value={row.gio}
                          onChange={(e) => {
                            const newBuoiChieu = [...thoiGianHoc.buoiChieu];
                            newBuoiChieu[idx].gio = e.target.value;
                            setThoiGianHoc({ ...thoiGianHoc, buoiChieu: newBuoiChieu });
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Grid container justifyContent="center">
              <Grid item sx={{ mt: 0, mb: 0 }}>
                <Button
                  variant="contained"
                  onClick={handleUpdate_Tab3}
                  startIcon={<SaveIcon />}   // 👈 icon bên trái chữ
                  sx={{ minWidth: 120, mt: 3 }}
                >
                  Lưu
                </Button>
                {/* Thanh tiến trình dưới nút Lưu */}
                  {saving && tab === 2 && (
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
              </Grid>
            </Grid>
          </TabPanel>


          {/* Tab 4 - Danh sách môn học */}
          <TabPanel value={tab} index={3}>
            <Typography
              variant="h6"
              align="center"
              fontWeight="bold"
              sx={{ color: "#1976d2", mb: 2 }}
            >
              CHỌN MÔN HỌC
            </Typography>

            <TableContainer component={Paper}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        width: "60px",
                        py: 1,
                      }}
                    >
                      STT
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        py: 1,
                      }}
                    >
                      Tên môn học
                    </TableCell>

                    {/* LỚP 1 */}
                    <TableCell
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        width: "80px",
                        py: 1,
                      }}
                    >
                      LỚP 1
                    </TableCell>

                    {/* LỚP 2 */}
                    <TableCell
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        width: "80px",
                        py: 1,
                      }}
                    >
                      LỚP 2
                    </TableCell>

                    {/* LỚP 3 */}
                    <TableCell
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        width: "80px",
                        py: 1,
                      }}
                    >
                      LỚP 3
                    </TableCell>

                    {/* LỚP 4 */}
                    <TableCell
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        width: "80px",
                        py: 1,
                      }}
                    >
                      LỚP 4
                    </TableCell>

                    {/* LỚP 5 */}
                    <TableCell
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        width: "80px",
                        py: 1,
                      }}
                    >
                      LỚP 5
                    </TableCell>

                    <TableCell
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        width: "120px",
                        py: 1,
                      }}
                    >
                      Điều chỉnh
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {Object.entries(monHoc).map(([mon, data], idx) => (
                    <TableRow
                      key={mon}
                      onClick={() => {
                        if (selectedMon !== mon) {
                          setSelectedMon(mon);
                          setIsEditing(false);
                          setNewMon("");
                        }
                      }}
                      sx={{
                        backgroundColor: selectedMon === mon ? "#e0e0e0" : "inherit",
                        "&:hover": { backgroundColor: "#f5f5f5", cursor: "pointer" },
                        transition: "background-color 0.2s ease",
                        height: 30,
                      }}
                    >
                      <TableCell align="center" sx={{ py: 0.5 }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={{ py: 0.5 }}>{mon}</TableCell>

                      {/* Checkbox LỚP 1 */}
                      <TableCell align="center" sx={{ py: 0.5 }}>
                        <Checkbox
                          checked={data.lop1 || false}
                          size="small"
                          onChange={(e) =>
                            setMonHoc({
                              ...monHoc,
                              [mon]: { ...data, lop1: e.target.checked },
                            })
                          }
                        />
                      </TableCell>

                      {/* Checkbox LỚP 2 */}
                      <TableCell align="center" sx={{ py: 0.5 }}>
                        <Checkbox
                          checked={data.lop2 || false}
                          size="small"
                          onChange={(e) =>
                            setMonHoc({
                              ...monHoc,
                              [mon]: { ...data, lop2: e.target.checked },
                            })
                          }
                        />
                      </TableCell>

                      {/* Checkbox LỚP 3 */}
                      <TableCell align="center" sx={{ py: 0.5 }}>
                        <Checkbox
                          checked={data.lop3 || false}
                          size="small"
                          onChange={(e) =>
                            setMonHoc({
                              ...monHoc,
                              [mon]: { ...data, lop3: e.target.checked },
                            })
                          }
                        />
                      </TableCell>

                      {/* Checkbox LỚP 4 */}
                      <TableCell align="center" sx={{ py: 0.5 }}>
                        <Checkbox
                          checked={data.lop4 || false}
                          size="small"
                          onChange={(e) =>
                            setMonHoc({
                              ...monHoc,
                              [mon]: { ...data, lop4: e.target.checked },
                            })
                          }
                        />
                      </TableCell>

                      {/* Checkbox LỚP 5 */}
                      <TableCell align="center" sx={{ py: 0.5 }}>
                        <Checkbox
                          checked={data.lop5 || false}
                          size="small"
                          onChange={(e) =>
                            setMonHoc({
                              ...monHoc,
                              [mon]: { ...data, lop5: e.target.checked },
                            })
                          }
                        />
                      </TableCell>

                      <TableCell align="center" sx={{ py: 0.5 }}>
                        {selectedMon === mon && (
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title="Chỉnh sửa">
                              <IconButton
                                color="primary"
                                size="small"
                                onClick={() => {
                                  setIsEditing(true);
                                  setNewMon(mon);
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Xóa">
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() => handleDeleteMon(mon)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: "flex", gap: 2, mt: 3, justifyContent: "center" }}>
              <TextField
                label="Tên môn học"
                value={newMon}
                onChange={(e) => setNewMon(e.target.value)}
                size="small"
                sx={{ width: 250 }}
              />
              {isEditing ? (
                <>
                  <Button variant="outlined" color="warning" onClick={handleEditMon}>
                    Sửa
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => {
                      setIsEditing(false);
                      setNewMon("");
                      setSelectedMon(null);
                    }}
                  >
                    Hủy
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="contained"
                    onClick={handleAddMon}
                    startIcon={<AddIcon />}   // icon bên trái chữ "Thêm"
                    sx={{ minWidth: 120 }}
                  >
                    Thêm
                  </Button>

                  <Button
                    variant="contained"
                    onClick={handleUpdate_Tab4}
                    startIcon={<SaveIcon />}   // 👈 icon nằm bên trái chữ
                    sx={{ minWidth: 120 }}
                  >
                    Lưu
                  </Button>                
                </>
              )}
            </Box>
            {saving && tab === 3 && (
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
          </TabPanel>
        </CardContent>
      </Card>
    </Container>
  );
}
