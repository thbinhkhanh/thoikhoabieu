import React, { useState, useEffect } from "react";
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, Checkbox,
  TableContainer, Paper, Stack, Tooltip, IconButton, TextField,
  Typography, LinearProgress, Card, CardContent, Button
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Tab4MonHoc() {
  const [monHoc, setMonHoc] = useState({});
  const [selectedMon, setSelectedMon] = useState(null);
  const [newMon, setNewMon] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const COLS = [
    { docId: "K1", key: "lop1" },
    { docId: "K2", key: "lop2" },
    { docId: "K3", key: "lop3" },
    { docId: "K4", key: "lop4" },
    { docId: "K5", key: "lop5" },
  ];

  const updateMonHocCache = (data) => {
    localStorage.setItem("monHocCache", JSON.stringify(data));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cached = localStorage.getItem("monHocCache");
        if (cached) {
          setMonHoc(JSON.parse(cached));
          return;
        }

        let loaded = {};
        const monSnap = await getDoc(doc(db, "MONHOC_2025-2026", "MON"));
        const { monHoc: allSubjects = [] } = monSnap.exists() ? monSnap.data() : {};

        allSubjects.forEach(subject => {
          loaded[subject] = { lop1: false, lop2: false, lop3: false, lop4: false, lop5: false };
        });

        for (const { docId, key } of COLS) {
          const snap = await getDoc(doc(db, "MONHOC_2025-2026", docId));
          if (snap.exists()) {
            const { monHoc: monList = [] } = snap.data();
            monList.forEach(subject => {
              if (!loaded[subject]) {
                loaded[subject] = { lop1: false, lop2: false, lop3: false, lop4: false, lop5: false };
              }
              loaded[subject][key] = true;
            });
          }
        }

        setMonHoc(loaded);
        updateMonHocCache(loaded);
      } catch (err) {
        console.error("❌ Lỗi khi tải môn học:", err);
      }
    };

    fetchData();
  }, []);

  const saveData = async (mon, key, value) => {
    try {
      setSaving(true);
      setProgress(30);

      const updated = { ...monHoc, [mon]: { ...monHoc[mon], [key]: value } };
      setMonHoc(updated);
      updateMonHocCache(updated);

      const subjectsChecked = Object.entries(updated)
        .filter(([m, data]) => data[key])
        .map(([m]) => m);
      await updateDoc(doc(db, "MONHOC_2025-2026", key.replace("lop", "K")), { monHoc: subjectsChecked });
      await setDoc(doc(db, "MONHOC_2025-2026", "MON"), { monHoc: Object.keys(updated) });

      setProgress(100);
    } catch (err) {
      console.error(`❌ Lỗi khi lưu môn "${mon}" lớp ${key}:`, err);
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  const handleAddMon = async () => {
    if (!newMon.trim() || monHoc.hasOwnProperty(newMon.trim())) return;

    const updated = {
      ...monHoc,
      [newMon.trim()]: { lop1: false, lop2: false, lop3: false, lop4: false, lop5: false }
    };
    setMonHoc(updated);
    updateMonHocCache(updated);
    setNewMon("");

    await setDoc(doc(db, "MONHOC_2025-2026", "MON"), { monHoc: Object.keys(updated) });
  };

  const handleEditMon = async () => {
    if (!selectedMon || !newMon.trim()) return;

    const newName = newMon.trim();
    const updated = { ...monHoc };
    const oldData = updated[selectedMon];

    delete updated[selectedMon];
    updated[newName] = oldData;
    setMonHoc(updated);
    updateMonHocCache(updated);

    await setDoc(doc(db, "MONHOC_2025-2026", "MON"), { monHoc: Object.keys(updated) });

    for (const { docId, key } of COLS) {
      const subjectsChecked = Object.entries(updated)
        .filter(([_, data]) => data[key])
        .map(([m]) => m);
      await setDoc(doc(db, "MONHOC_2025-2026", docId), { monHoc: subjectsChecked });
    }

    setNewMon("");
    setSelectedMon(null);
    setIsEditing(false);
  };

  const handleDeleteMon = async (mon) => {
    if (!window.confirm(`⚠️ Bạn có chắc muốn xóa môn "${mon}" không?`)) return;

    const updated = { ...monHoc };
    delete updated[mon];
    setMonHoc(updated);
    updateMonHocCache(updated);
    setSelectedMon(null);
    setIsEditing(false);

    await setDoc(doc(db, "MONHOC_2025-2026", "MON"), { monHoc: Object.keys(updated) });

    for (const { docId, key } of COLS) {
      const subjectsChecked = Object.entries(updated)
        .filter(([_, data]) => data[key])
        .map(([m]) => m);
      await setDoc(doc(db, "MONHOC_2025-2026", docId), { monHoc: subjectsChecked });
    }
  };

  return (
    <Box sx={{ mt: 1.5, pt: "20px", pb: 6, px: { xs: 1, sm: 2 }, bgcolor: "#e3f2fd", minHeight: "100vh" }}>
      <Card elevation={6} sx={{ maxWidth: 750, mx: "auto", borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" align="center" fontWeight="bold" sx={{ color: "#1976d2", mb: 2 }}>
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
                      whiteSpace: "nowrap",
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
                      whiteSpace: "nowrap",
                    }}
                  >
                    MÔN HỌC
                  </TableCell>
                  {COLS.map(c => (
                    <TableCell
                      key={c.key}
                      align="center"
                      sx={{
                        backgroundColor: "#1976d2",
                        color: "#fff",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {`LỚP ${c.key.slice(-1)}`}
                    </TableCell>
                  ))}
                  <TableCell
                    align="center"
                    sx={{
                      backgroundColor: "#1976d2",
                      color: "#fff",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ĐIỀU CHỈNH
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
                      transition: "background-color 0.2s ease"
                    }}
                  >
                    <TableCell align="center">{idx + 1}</TableCell>

                    {/* ✅ Tên môn học: luôn 1 dòng + cắt nếu dài */}
                    <TableCell
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 200, // tuỳ chỉnh
                      }}
                    >
                      <Tooltip title={mon}>
                        <span>{mon}</span>
                      </Tooltip>
                    </TableCell>

                    {COLS.map(({ key }) => (
                      <TableCell key={key} align="center">
                        <Checkbox
                          checked={data[key] || false}
                          size="small"
                          onChange={e => saveData(mon, key, e.target.checked)}
                        />
                      </TableCell>
                    ))}
                    <TableCell align="center">
                      {selectedMon === mon && (
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="Chỉnh sửa">
                            <IconButton
                              color="primary"
                              size="small"
                              onClick={() => { setIsEditing(true); setNewMon(mon); }}
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
              onChange={e => setNewMon(e.target.value)}
              size="small"
              sx={{ width: 250 }}
            />
            {isEditing ? (
              <>
                <Button variant="outlined" color="warning" onClick={handleEditMon}>Sửa</Button>
                <Button variant="text" color="inherit" onClick={() => { setIsEditing(false); setNewMon(""); setSelectedMon(null); }}>Hủy</Button>
              </>
            ) : (
              <Button variant="contained" onClick={handleAddMon} startIcon={<AddIcon />} sx={{ minWidth: 120 }}>Thêm</Button>
            )}
          </Box>

          {/*{saving && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Box sx={{ width: 200, textAlign: "center" }}>
                <LinearProgress variant="determinate" value={progress} sx={{ mb: 0, height: 3, borderRadius: 1 }} />
                <Typography variant="caption" color="text.secondary">Đang lưu... {progress}%</Typography>
              </Box>
            </Box>
          )}*/}
        </CardContent>
      </Card>
    </Box>
  );
}
