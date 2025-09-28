import React, { useEffect, useState, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField,
  List, ListItem, ListItemButton, ListItemText,
  Typography
} from "@mui/material";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useSaveAsTkbAllTeachers } from '../utils/saveAsTkbAllTeachers';

export default function SaveDialog({ open, onClose, saveMode, docName, setDocName }) {
  const [files, setFiles] = useState([]);
  const { saveAsTkbAllTeachers } = useSaveAsTkbAllTeachers();
  const inputRef = useRef(null);

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

  // 🔹 Giữ focus khi mở dialog hoặc khi chọn file
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [docName, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,   // bo góc mềm
          boxShadow: 8       // đổ bóng hiện đại
        }
      }}
    >
      <DialogTitle
        sx={{
          background: "linear-gradient(90deg, #2b579a, #4f8dd8)", // xanh gradient
          color: "white",
          fontWeight: "bold",
          fontSize: "1rem",
          py: 1.2,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        {saveMode === "save" ? "💾 Lưu" : "💾 Lưu với tên mới"}
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
                onClick={() => setDocName(f.id)}
                selected={docName === f.id}
                sx={{
                  "&.Mui-selected": {
                    bgcolor: "#e3f2fd",
                    "&:hover": { bgcolor: "#bbdefb" }
                  }
                }}
              >
                <ListItemText
                  primary={f.id}
                  primaryTypographyProps={{ fontSize: "0.9rem" }}
                />
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
          autoFocus
          fullWidth
          margin="dense"
          size="small"
          variant="outlined"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          label="Nhập tên TKB"
        />
      </DialogContent>

      <DialogActions sx={{ justifyContent: "flex-end", gap: 1.5, px: 3, pb: 2 }}>
        <Button
          variant="contained"
          onClick={() => {
            if (!docName.trim()) return;
            const safeDocId = docName.trim().replace(/\//g, "-");
            onClose();
            saveAsTkbAllTeachers(safeDocId);
          }}
          disabled={!docName.trim()}
        >
          Lưu
        </Button>
        <Button variant="outlined" onClick={onClose}>Hủy</Button>
      </DialogActions>
    </Dialog>
  );
}
