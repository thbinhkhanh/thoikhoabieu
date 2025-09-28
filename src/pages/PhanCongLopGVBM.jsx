import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  CircularProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button, 
  LinearProgress,
  Tooltip
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useParams, useLocation, Link } from "react-router-dom";
import { collection, getDocs, getDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";

export default function PhanCongLopGVBM() {
  const { gvbmId } = useParams();
  const location = useLocation();
  const gvbmFromLocation = location.state?.gvbm || null;

  const [gvbm, setGVBM] = useState(gvbmFromLocation);
  const [dataByKhoi, setDataByKhoi] = useState({});
  const [selectedAssignments, setSelectedAssignments] = useState({});
  const [classPeriods, setClassPeriods] = useState({});
  const [selectedMon, setSelectedMon] = useState(gvbmFromLocation?.monDay?.[0] || "");
  const [loading, setLoading] = useState(false);
  const [monList, setMonList] = useState([]);
  const [vietTatMon, setVietTatMon] = useState({});
  const [totalPeriods, setTotalPeriods] = useState(0);
  const [thinhGiang, setThinhGiang] = useState(false);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [offTimes, setOffTimes] = useState({
    "Thứ 2": { morning: false, afternoon: false },
    "Thứ 3": { morning: false, afternoon: false },
    "Thứ 4": { morning: false, afternoon: false },
    "Thứ 5": { morning: false, afternoon: false },
    "Thứ 6": { morning: false, afternoon: false }
  });

  const khoiKeys = ["1", "2", "3", "4", "5"];
  const daysOfWeek = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];

  useEffect(() => {
    let total = 0;
    Object.entries(classPeriods).forEach(([key, val]) => {
      const [lop, mon] = key.split("|");
      const assignedLops = selectedAssignments[mon] || [];
      if (assignedLops.some(item => item.lop === lop)) {
        total += Number(val || 0);
      }
    });
    setTotalPeriods(total);
  }, [selectedAssignments, classPeriods]);

  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "GVCN_2025-2026"));
        let classData = snapshot.docs.map(docSnap => docSnap.data().lop).filter(Boolean);

        const grouped = {};
        classData.forEach(lop => {
          const khoi = lop.split('.')[0];
          if (!grouped[khoi]) grouped[khoi] = [];
          grouped[khoi].push(lop);
        });

        khoiKeys.forEach(khoi => {
          if (grouped[khoi]) {
            grouped[khoi].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
          }
        });

        setDataByKhoi(grouped);
      } catch (err) {
        console.error("Lỗi khi fetch lớp:", err);
      }
      setLoading(false);
    };

    fetchClasses();
  }, []);

  const fetchPhanCongGVBM = async (gvbmId) => {
  if (!gvbmId) return null;

  try {
    const docRef = doc(db, "PHANCONG_2025-2026", gvbmId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data();

    // Cập nhật thông tin cơ bản
    setOffTimes(data.offTimes || {});
    setClassPeriods(data.classPeriods || {});
    setThinhGiang(data.thinhGiang || false);
    setGVBM({ hoTen: data.hoTen || "", monDay: data.monDay || [] });
    setVietTatMon(data.vietTatMon || {});
    setMonList(data.monDay || []);

    // Nếu selectedMon chưa có hoặc không nằm trong monDay, chọn mặc định môn đầu tiên
    setSelectedMon(prevMon => {
      if (!prevMon || !data.monDay?.includes(prevMon)) {
        return data.monDay?.[0] || "";
      }
      return prevMon;
    });

    // Chuẩn bị danh sách phân công
    const formattedAssignments = {};
    data.monDay?.forEach(mon => {
      formattedAssignments[mon] = [];
    });

    if (data.phanCong) {
      for (const [mon, danhSachLop] of Object.entries(data.phanCong)) {
        formattedAssignments[mon] = danhSachLop.map(item =>
          typeof item === "object"
            ? { lop: item.lop, thinhGiang: item.thinhGiang || false }
            : { lop: item, thinhGiang: false }
        );
      }
    }

    setSelectedAssignments(formattedAssignments);

    // Gán tổng số tiết
    setTotalPeriods(data.totalPeriods || 0);

    return true;
  } catch (err) {
    console.error("❌ Lỗi khi lấy phân công:", err);
    alert("Không thể tải dữ liệu phân công 😢");
    return null;
  }
};

  useEffect(() => {
    const loadGVBM = async () => {
      // Nếu có gvbmFromLocation thì dùng luôn
      if (gvbmFromLocation) {
        setGVBM(gvbmFromLocation);
        setSelectedMon(gvbmFromLocation.monDay?.[0] || "");
        setMonList(gvbmFromLocation.monDay || []);
        // Nếu bạn cần reset assignments, offTimes… có thể gọi fetchPhanCongGVBM với gvbmId ở đây
        await fetchPhanCongGVBM(gvbmFromLocation.gvbmId);
        return;
      }

      // Nếu mở trực tiếp URL (không có state), fetch Firestore
      if (gvbmId) {
        await fetchPhanCongGVBM(gvbmId);
      }
    };

    loadGVBM();
  }, [gvbmId, gvbmFromLocation]);


  const handleCheckboxChange = (lopName, checked) => {
    setSelectedAssignments(prev => {
      const current = prev[selectedMon] || [];
      const updated = checked
        ? [...current, { lop: lopName, thinhGiang: false }]
        : current.filter(item => item.lop !== lopName);

      if (checked) {
        setClassPeriods(cp => ({
          ...cp,
          [`${lopName}|${selectedMon}`]: cp[`${lopName}|${selectedMon}`] || 1
        }));
      } else {
        setClassPeriods(cp => {
          const newCP = { ...cp };
          delete newCP[`${lopName}|${selectedMon}`];
          return newCP;
        });
      }

      return { ...prev, [selectedMon]: updated };
    });
  };

  const handlePeriodChange = (lop, mon, value) => {
    setClassPeriods(prev => ({ ...prev, [`${lop}|${mon}`]: Number(value) }));
  };

  const handleToggleKhoi = (khoi, checked) => {
    const lopTrongKhoi = dataByKhoi[khoi] || [];

    setSelectedAssignments(prev => {
      const current = prev[selectedMon] || [];
      const currentLops = current.map(item => item.lop);

      const updated = checked
        ? [...current, ...lopTrongKhoi.filter(l => !currentLops.includes(l)).map(l => ({ lop: l, thinhGiang: false }))]
        : current.filter(item => !lopTrongKhoi.includes(item.lop));

      // Cập nhật classPeriods đồng thời
      setClassPeriods(cp => {
        const newCP = { ...cp };
        if (checked) {
          lopTrongKhoi.forEach(l => {
            const key = `${l}|${selectedMon}`;
            if (!newCP[key]) newCP[key] = 1; // mặc định 1 tiết
          });
        } else {
          lopTrongKhoi.forEach(l => {
            const key = `${l}|${selectedMon}`;
            delete newCP[key];
          });
        }
        return newCP;
      });

      return { ...prev, [selectedMon]: updated };
    });
  };


  const isKhoiFullySelected = (khoi) => {
    const lopTrongKhoi = dataByKhoi[khoi] || [];
    const current = selectedAssignments[selectedMon]?.map(item => item.lop) || [];
    return lopTrongKhoi.length > 0 && lopTrongKhoi.every(l => current.includes(l));
  };

  const handleOffTimeChange = (day, session, value) => {
    setOffTimes(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [session]: value }
    }));
  };

  const handleSave = async () => {
    if (!gvbmId || !gvbm?.hoTen) return;

    setSaving(true);
    setProgress(0);

    const docRef = doc(db, "PHANCONG_2025-2026", gvbmId);

    const monListToSave = monList.length ? monList : gvbm.monDay || [];
    const vietTatMon = {};
    monListToSave.forEach(mon => {
      vietTatMon[mon] = mon
        .split(" ")
        .map(tu => tu[0])
        .join("")
        .toUpperCase();
    });

    let total = 0;
    const normalizedClassPeriods = {};
    monListToSave.forEach(mon => {
      (selectedAssignments[mon] || []).forEach(({ lop }) => {
        const key = `${lop}|${mon}`;
        const soTiet = classPeriods[key] || 1;
        normalizedClassPeriods[key] = soTiet;
        total += Number(soTiet);
      });
    });

    const updatedOffTimes = {};
    Object.keys(offTimes).forEach(day => {
      updatedOffTimes[day] = {
        morning: offTimes[day]?.morning || false,
        afternoon: offTimes[day]?.afternoon || false
      };
    });

    const phanCongToSave = {};
    monListToSave.forEach(mon => {
      phanCongToSave[mon] = (selectedAssignments[mon] || []).map(item => item.lop);
    });

    const payload = {
      hoTen: gvbm.hoTen,
      monDay: monListToSave,
      vietTatMon,
      phanCong: phanCongToSave,
      classPeriods: normalizedClassPeriods,
      totalPeriods: total,
      offTimes: updatedOffTimes,
      thinhGiang
    };

    try {
      // Giả lập progress
      let prog = 0;
      const interval = setInterval(() => {
        prog += 20;
        if (prog >= 100) prog = 100;
        setProgress(prog);
      }, 100);

      await setDoc(docRef, payload);

      clearInterval(interval);
      setProgress(100);

      setTotalPeriods(total);
    } catch (err) {
      console.error("Lỗi khi lưu phân công:", err);
      alert("Lưu thất bại 😢");
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };




  const maxRows = Math.max(...khoiKeys.map(k => dataByKhoi[k]?.length || 0));
  const rows = Array.from({ length: maxRows }, (_, rowIndex) =>
    khoiKeys.map(khoi => dataByKhoi[khoi]?.[rowIndex] || null)
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
  <Box sx={{ px: { xs: 1, sm: 3 }, py: 4, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
    <Paper elevation={4} sx={{ maxWidth: 900, mx: "auto", p: 3, borderRadius: 3, position: "relative" }}>
      {/* Nút Lưu (icon) ở góc trên trái */}
      <Tooltip title="Lưu">
        <IconButton
          onClick={handleSave}
          //sx={{ position: "absolute", top: 8, left: 8, color: "black" }}
          sx={{ position: "absolute", top: 8, left: 8, color: "black" }}
          size="small"
        >
          <SaveIcon />
        </IconButton>
      </Tooltip>


      {/* Nút X đỏ ở góc trên phải */}
      <Tooltip title="Đóng">
        <IconButton
          onClick={() => navigate(-1)}
          sx={{ position: "absolute", top: 8, right: 8, color: "red" }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </Tooltip>


      <Typography variant="h5" align="center" fontWeight="bold" color="primary" gutterBottom sx={{ mt: 1, mb: 4 }}>
        PHÂN CÔNG GIÁO VIÊN BỘ MÔN
      </Typography>

      <Grid container justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Grid item>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Typography variant="body1">
                Giáo viên: <strong>{gvbm?.hoTen || gvbmId}</strong>
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={thinhGiang} onChange={e => setThinhGiang(e.target.checked)} />}
                label="Thỉnh giảng"
              />
            </Box>
          </Box>

          <Typography variant="body1">
            Môn học: <strong>{gvbm?.monDay?.join(", ")}</strong>
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            Tổng số tiết: <span style={{ color: "red", fontWeight: "bold" }}>{totalPeriods}</span>
          </Typography>
        </Grid>
      </Grid>

      {gvbm?.monDay?.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" fontWeight="bold" color="primary" gutterBottom>
            Dạy {selectedMon} lớp:
          </Typography>
          <RadioGroup row value={selectedMon} onChange={e => setSelectedMon(e.target.value)}>
            {gvbm.monDay.map(mon => (
              <FormControlLabel key={mon} value={mon} control={<Radio />} label={mon} />
            ))}
          </RadioGroup>
        </Box>
      )}

      <Table>
        <TableHead>
          <TableRow>
            {khoiKeys.map(khoi => (
              <TableCell key={khoi} align="center">
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                  <Typography fontWeight="bold">Khối {khoi}</Typography>
                  <Checkbox
                    checked={isKhoiFullySelected(khoi)}
                    onChange={e => handleToggleKhoi(khoi, e.target.checked)}
                    size="small"
                  />
                </Box>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((lop, colIndex) => (
                <TableCell key={colIndex} align="center">
                  {lop && (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                      <Checkbox
                        size="small"
                        checked={(selectedAssignments[selectedMon] || []).some(item => item.lop === lop)}
                        onChange={e => handleCheckboxChange(lop, e.target.checked)}
                      />
                      <Typography variant="body2">{lop}</Typography>
                      {(selectedAssignments[selectedMon] || []).some(item => item.lop === lop) && (
                        <TextField
                          key={`${lop}|${selectedMon}`}
                          type="number"
                          size="small"
                          variant="outlined"
                          sx={{
                            ml: 0.5,
                            width: 50,
                            '& .MuiInputBase-input': { fontSize: 14, padding: '4px 6px', height: '24px' },
                          }}
                          value={classPeriods[`${lop}|${selectedMon}`] || 1}
                          onChange={e => handlePeriodChange(lop, selectedMon, e.target.value)}
                        />
                      )}
                    </Box>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box mt={4} sx={{ p: 2, bgcolor: "#f5f5f5", borderRadius: 2 }}>
        <Typography variant="body1" fontWeight="bold" color="primary" gutterBottom>
          Chọn buổi nghỉ
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              {daysOfWeek.map(day => (
                <TableCell key={day} align="center">{day}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {["Sáng", "Chiều"].map(session => (
              <TableRow key={session}>
                <TableCell>{session}</TableCell>
                {daysOfWeek.map(day => (
                  <TableCell key={day} align="center">
                    <Checkbox
                      checked={offTimes[day]?.[session.toLowerCase()] || false}
                      onChange={e => handleOffTimeChange(day, session.toLowerCase(), e.target.checked)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Nút Lưu vẫn giữ nguyên */}
      {/*<Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSave}
        >
          Lưu
        </Button>
      </Box>*/}

      {saving && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Box sx={{ width: 200, textAlign: "center" }}>
            <LinearProgress variant="determinate" value={progress} sx={{ mb: 0, height: 3, borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">Đang lưu... {progress}%</Typography>
          </Box>
        </Box>
      )}
    </Paper>
  </Box>
);

}