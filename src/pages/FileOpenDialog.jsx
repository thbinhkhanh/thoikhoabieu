// src/pages/FileOpenDialog.jsx
import React, { useState, useEffect, useRef, useContext } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { useSchedule } from "../contexts/ScheduleContext";
import { useOpenFile } from "../contexts/OpenFileContext";
import { deleteDoc } from "firebase/firestore"; // thêm import này
import { useGVCN } from "../contexts/ContextGVCN";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  TextField,
} from "@mui/material";

export default function FileOpenDialog({ open, onClose }) {
  //const { setTkbAllTeachers, setCurrentDocId } = useSchedule();
  const { setTkbAllTeachers, setCurrentDocId, setIsFileOpen } = useSchedule();
  const { setOpenFileName } = useOpenFile();
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState("");
  const inputRef = useRef(null);
   const { contextSchedule, setContextSchedule, allSchedules, setAllSchedules } = useGVCN();

  // 🔹 Lấy danh sách file khi mở dialog
  useEffect(() => {
    if (!open) return;

    const fetchFiles = async () => {
      try {
        const querySnap = await getDocs(collection(db, "TKB_GVBM"));
        setFiles(querySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("❌ Lỗi khi tải danh sách file:", err);
      }
    };

    fetchFiles();
  }, [open]);

  // 🔹 Xác nhận mở file

  const handleConfirm = async () => {
    if (!selectedFileId) return;
    onClose();

    try {
      // 🔹 1. Mở file từ TKB_GVCN (nếu có)
      const docRefGVCN = doc(db, "TKB_GVCN", selectedFileId);
      const docSnapGVCN = await getDoc(docRefGVCN);

      let newContextSchedule = {};
      let newAllSchedules = {};

      if (docSnapGVCN.exists()) {
        const dataGVCN = docSnapGVCN.data();
        const scheduleData = dataGVCN.tkb || dataGVCN;

        for (const [lop, scheduleMap] of Object.entries(scheduleData)) {
          const scheduleObj = { SÁNG: {}, CHIỀU: {} };

          ['SÁNG', 'CHIỀU'].forEach(session => {
            const sessionMap = scheduleMap[session];
            scheduleObj[session] = sessionMap instanceof Map ? Object.fromEntries(sessionMap) : sessionMap || {};
          });

          newContextSchedule[lop] = scheduleObj;
          newAllSchedules[lop] = scheduleObj;
        }

        setContextSchedule(newContextSchedule);
        setAllSchedules(newAllSchedules);

        //console.log("✅ Nội dung context TKB_GVCN:", newContextSchedule);
      } else {
        console.warn(`⚠️ File TKB_GVCN "${selectedFileId}" không tồn tại, bỏ qua!`);
      }

      // 🔹 2. Mở file từ TKB_GVBM
      const docRefGVBM = doc(db, "TKB_GVBM", selectedFileId);
      const docSnapGVBM = await getDoc(docRefGVBM);

      if (docSnapGVBM.exists()) {
        const dataGVBM = docSnapGVBM.data();
        setTkbAllTeachers(prev => {
          const newState = { ...prev, [selectedFileId]: dataGVBM.tkb };
          //console.log("📂 Nội dung context TKB_GVBM sau khi mở file:", newState);
          return newState;
        });
        setCurrentDocId(selectedFileId);
      } else {
        console.warn(`⚠️ File TKB_GVBM "${selectedFileId}" không tồn tại, bỏ qua!`);
      }

      // 🔹 3. Lưu tên file đang mở vào OpenFileContext và Firestore
      await setDoc(doc(db, "FILE_OPEN", "filename"), { filed: selectedFileId });
      setOpenFileName(selectedFileId);

      //console.log(`✅ Đã mở file TKB_GVCN và TKB_GVBM: ${selectedFileId}`);
    } catch (err) {
      console.error("❌ Lỗi mở file TKB:", err);
      alert("Không thể mở file TKB!");
    }
  };

  {/*const handleConfirm_gvcn = async () => {
    if (!selectedFileId) return;
    onClose();

    try {
      // 🔹 Mở file từ TKB_GVCN
      const docRefGVCN = doc(db, "TKB_GVCN", selectedFileId);
      const docSnapGVCN = await getDoc(docRefGVCN);

      if (!docSnapGVCN.exists()) {
        console.warn(`⚠️ File TKB_GVCN "${selectedFileId}" không tồn tại, bỏ qua!`);
        return;
      }

      const dataGVCN = docSnapGVCN.data();

      // Nếu không có field 'tkb', dùng toàn bộ document
      const scheduleData = dataGVCN.tkb || dataGVCN;

      // --- Tạo object mới hoàn toàn cho context
      const newContextSchedule = {};
      const newAllSchedules = {};

      // 🔹 Chuyển từng Map lớp -> Object
      for (const [lop, scheduleMap] of Object.entries(scheduleData)) {
        const scheduleObj = { SÁNG: {}, CHIỀU: {} };

        ['SÁNG', 'CHIỀU'].forEach(session => {
          const sessionMap = scheduleMap[session];
          scheduleObj[session] = sessionMap instanceof Map ? Object.fromEntries(sessionMap) : sessionMap || {};
        });

        newContextSchedule[lop] = scheduleObj;
        newAllSchedules[lop] = scheduleObj;
      }

      // --- Cập nhật context GVCN
      setContextSchedule(newContextSchedule);
      setAllSchedules(newAllSchedules);

      // 🔹 Lưu tên file đang mở vào OpenFileContext và Firestore
      await setDoc(doc(db, "FILE_OPEN", "filename"), { filed: selectedFileId });
      setOpenFileName(selectedFileId);

      //console.log(`✅ Đã mở file TKB_GVCN: ${selectedFileId}`);
    } catch (err) {
      console.error("❌ Lỗi mở file TKB_GVCN:", err);
      alert("Không thể mở file TKB_GVCN!");
    }
  };*/}

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,   // bo góc hộp thoại
          boxShadow: 8       // đổ bóng
        }
      }}
    >
      <DialogTitle
        sx={{
          background: "linear-gradient(90deg, #2b579a, #4f8dd8)", // xanh gradient kiểu hiện đại
          color: "white",
          fontWeight: "bold",
          fontSize: "1rem",
          py: 1.2,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        📂 Chọn file TKB
      </DialogTitle>

      <DialogContent sx={{ mt: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{ mb: 1.5, color: "text.secondary" }}
        >
          Danh sách file có sẵn
        </Typography>

        <List
          dense
          sx={{
            maxHeight: 180,
            overflowY: "auto",
            border: "1px solid #e0e0e0",
            borderRadius: 2,
            mb: 2,
          }}
        >
          {files.map((f) => (
            <ListItem key={f.id} disablePadding>
              <ListItemButton
                selected={selectedFileId === f.id}
                onClick={() => {
                  setSelectedFileId(f.id);
                  setTimeout(() => inputRef.current?.focus(), 0); // giữ con trỏ lại ô nhập
                }}
              >
                <ListItemText primary={f.id} />
              </ListItemButton>

            </ListItem>
          ))}
          {files.length === 0 && (
            <Typography
              variant="body2"
              sx={{ p: 1, color: "text.disabled", fontStyle: "italic" }}
            >
              (Chưa có file nào trong Firestore)
            </Typography>
          )}
        </List>

        <TextField
          inputRef={inputRef}
          fullWidth
          margin="dense"
          size="small"
          variant="outlined"
          value={selectedFileId}
          onChange={(e) => setSelectedFileId(e.target.value)}
          label="Nhập tên TKB"
        />

      </DialogContent>

      <DialogActions sx={{ justifyContent: "flex-end", gap: 1.5, px: 3, pb: 2 }}>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!selectedFileId}
        >
          Mở
        </Button>

        <Button
          variant="outlined"
          color="error"
          onClick={async () => {
            if (!selectedFileId) return;
            const confirmDelete = window.confirm(`Bạn có chắc muốn xóa file "${selectedFileId}" không?`);
            if (!confirmDelete) return;

            try {
              // ✅ Xóa ở TKB_GVBM
              await deleteDoc(doc(db, "TKB_GVBM", selectedFileId));

              // ✅ Xóa ở TKB_GVCN
              await deleteDoc(doc(db, "TKB_GVCN", selectedFileId));

              // ✅ Cập nhật giao diện
              setFiles((prev) => prev.filter((f) => f.id !== selectedFileId));
              setSelectedFileId("");
              //alert("✅ Đã xóa file thành công!");
            } catch (err) {
              console.error("❌ Lỗi xóa file:", err);
              alert("Không thể xóa file!");
            }
          }}
          disabled={!selectedFileId}
        >
          Xóa
        </Button>
        <Button variant="outlined" onClick={onClose}>Hủy</Button>
      </DialogActions>
    </Dialog>

  );
}
