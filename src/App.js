import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { AppBar, Toolbar, Button, Box, Typography, Divider } from "@mui/material";

import InfoIcon from "@mui/icons-material/Info";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import PrintIcon from "@mui/icons-material/Print";
import SaveIcon from "@mui/icons-material/Save";
import SaveAsIcon from "@mui/icons-material/SaveAs";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DescriptionIcon from "@mui/icons-material/Description";
import NoteAddIcon from "@mui/icons-material/NoteAdd";

// Firestore
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Pages
import Home from "./pages/Home";
import Tab1ThongTin from "./pages/Tab1ThongTin";
import Tab2LichSinhHoat from "./pages/Tab2LichSinhHoat";
import Tab3ThoiGianHoc from "./pages/Tab3ThoiGianHoc";
import Tab4MonHoc from "./pages/Tab4MonHoc";

import DanhSachGVCN from "./pages/DanhSachGVCN";
import DanhSachGVBM from "./pages/DanhSachGVBM";
import PhanCongLopGVBM from "./pages/PhanCongLopGVBM";

import XepTKB_GVCN from "./pages/XepTKB_GVCN";
import XepTKB_GVBM from "./pages/XepTKB_GVBM";

import InTKB_GVCN from "./pages/InTKB_GVCN";
import InTKB_GVBM from "./pages/InTKB_GVBM";
import HeThong from "./pages/HeThong";

import { GVCNProvider, useGVCN } from "./contexts/ContextGVCN";
import { GVBMProvider, useGVBM } from "./contexts/ContextGVBM";

import { TKB_GVBMProvider } from "./contexts/ContextTKB_GVBM"; 
import { ScheduleProvider, useSchedule } from "./contexts/ScheduleContext";
import { OpenFileProvider, useOpenFile } from "./contexts/OpenFileContext";

import { PrintTKBProvider } from "./contexts/PrintTKBContext";

import XepTKBToanTruong from "./pages/ToanTruongTKB";
import XepTKBTuDong from "./pages/ToanTruongTKB_TuDong";

import FileOpenDialog from "./pages/FileOpenDialog";
import SaveDialog from "./pages/SaveDialog"; 
import { NewDocProvider } from "./contexts/NewDocContext";
import { useNewDoc } from "./contexts/NewDocContext";

import { useSaveAutoTkb } from "./hooks/useSaveAutoTkb";
import LinearProgress from "@mui/material/LinearProgress";

// ======================= CHỈ SỬA Ở ĐÂY =======================
// Màu các nút lệnh
const commandColors = {
  "Thông tin chung": "#1976d2",
  "Lịch sinh hoạt CM": "#0288d1",
  "Thời gian học": "#039be5",
  "Danh sách môn học": "#03a9f4",
  "GV chủ nhiệm": "#f57c00",
  "GV bộ môn": "#ff9800",
  "Toàn trường": "#ff9800",
  "Xếp tự động": "#9c27b0",
  "Lưu": "#000000",
  "In cá nhân": "#000000",
  "In toàn trường": "#000000",
  "Mới": "#1976d2",
};

// Ribbon Tabs
const ribbonTabs = [
  {
    label: "Hệ thống",
    icon: <InfoIcon />,
    defaultCommand: "Thông tin chung",
    commands: [
      { label: "Thông tin chung", icon: <InfoIcon />, path: "/hethong/thong-tin" },
      { label: "Lịch sinh hoạt CM", icon: <ScheduleIcon />, path: "/hethong/lich-sinh-hoat" },
      { label: "Thời gian học", icon: <ListAltIcon />, path: "/hethong/thoi-gian-hoc" },
      { label: "Danh sách môn học", icon: <ListAltIcon />, path: "/hethong/danh-sach-mon" },
    ],
  },
  {
    label: "Phân công",
    icon: <AssignmentIndIcon />,
    defaultCommand: "GV chủ nhiệm",
    commands: [
      { label: "Mở file", icon: <FolderOpenIcon />, path: null },  // nút Mở file
      { label: "GV chủ nhiệm", icon: <AssignmentIndIcon />, path: "/phan-cong/gvcn" },
      { label: "GV bộ môn", icon: <AssignmentIndIcon />, path: "/phan-cong/gvbm" },
    ],
  },
  {
    label: "Xếp TKB",
      icon: <ScheduleIcon />,
      defaultCommand: "GV chủ nhiệm",
      commands: [
        { label: "Mới", icon: <NoteAddIcon />, path: null },      // ✅ mới thêm
        { label: "Mở file", icon: <FolderOpenIcon />, path: null, group: "Lưu nhóm" },
        { label: "Lưu", icon: <SaveIcon />, path: null, group: "Lưu nhóm" },
        { label: "Lưu...", icon: <SaveAsIcon />, path: null, group: "Lưu nhóm" },
        { label: "GV chủ nhiệm", icon: <ScheduleIcon />, path: "/thoikhoabieu/gvcn" },
        { label: "GV bộ môn", icon: <ScheduleIcon />, path: "/thoikhoabieu/gvbm" },
        { label: "Toàn trường", icon: <ScheduleIcon />, path: "/thoikhoabieu/toan-truong" },
        { label: "Xếp tự động", icon: <ScheduleIcon />, path: "/thoikhoabieu/tu-dong", group: "Xếp tự động" },
      ],
  },
  {
    label: "In TKB",
    icon: <PrintIcon />,
    defaultCommand: "GV chủ nhiệm",
    commands: [
      { label: "In", icon: <PrintIcon />, path: null },        // nút In
      { label: "Tải về", icon: <FileDownloadIcon />, path: null }, // nút tải về
      { label: "GV chủ nhiệm", icon: <DescriptionIcon />, path: "/inthoikhoabieu/gvcn" },
      { label: "GV bộ môn", icon: <DescriptionIcon />, path: "/inthoikhoabieu/gvbm" },
    ],
  },
];

function AppContent() {
  const navigate = useNavigate();
  const { openFileName, setOpenFileName } = useOpenFile();
  //const { printGVBM, exportGVBM, printGVCN, exportGVCN } = usePrintTKB(); // ✅ lấy hàm context

  // GVCN
  const [gvcnPrintHandler, setGvcnPrintHandler] = useState(null);
  const [gvcnExportHandler, setGvcnExportHandler] = useState(null);

  // GVBM
  const [gvbmPrintHandler, setGvbmPrintHandler] = useState(null);
  const [gvbmExportHandler, setGvbmExportHandler] = useState(null);

  // Handler lưu
  const [gvcnSaveHandler, setGvcnSaveHandler] = useState(null);

  const [gvbmSaveHandler, setGvbmSaveHandler] = useState(null);
  const [gvbmSaveAsHandler, setGvbmSaveAsHandler] = useState(null);

  // Handler lưu Toàn Trường
  const [thuCongSaveHandler, setThuCongSaveHandler] = useState(null); // XepTKBToanTruong
  const [thuCongSaveAsHandler, setThuCongSaveAsHandler] = useState(null);

  const [tuDongSaveHandler, setTuDongSaveHandler] = useState(null); // ToanTruongTKB_TuDong
  const [tuDongSaveAsHandler, setTuDongSaveAsHandler] = useState(null);
  

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [saveMode, setSaveMode] = useState("save"); // "save" hoặc "saveAs"

  const { tkbAllTeachers } = useSchedule();

  // Mở file
  const [openFileHandler, setOpenFileHandler] = useState(null);
  const [openFileDialog, setOpenFileDialog] = useState(false);

  const [toanTruongSaveHandler, setToanTruongSaveHandler] = useState(null);
  const gvcndata = useGVCN();
  const gvbmData = useGVBM();
  const [saveHandler, setSaveHandler] = useState(null);

  const { isNew, createNewDoc, resetNewDoc } = useNewDoc();
  const { resetSchedule } = useSchedule(); // 🔹 lấy hàm reset
  const [refreshKey, setRefreshKey] = useState(0);
  const { setCurrentDocId } = useSchedule();

  const { saveAutoTkb, saving: autoSaving, saveProgress: autoSaveProgress } = useSaveAutoTkb();
  const [autoScheduleProgress, setAutoScheduleProgress] = useState(0); // ✅ khai báo state

  const [activeTab, setActiveTab] = useState(localStorage.getItem("activeTab") || "Hệ thống");
  const [activeCommand, setActiveCommand] = useState(localStorage.getItem("activeCommand") || "");
  const [ribbonVisible, setRibbonVisible] = useState(() => {
    const v = localStorage.getItem("ribbonVisible");
    return v === null ? true : v === "true";
  });

  //const schoolYear = "Năm học: 2025-2026";

  // Khai báo state cho tiến trình Lưu
  const [saveProgress, setSaveProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // 👉 Hàm giả lập tiến trình lưu
  const startSaveProgress = async () => {
    setIsSaving(true);
    setSaveProgress(0);

    for (let i = 0; i <= 100; i += 20) {
      await new Promise((res) => setTimeout(res, 150));
      setSaveProgress(i);
    }

    setIsSaving(false);
  };

  // =============================================================

  // Handler upload từ DanhSachGVCN
  const [fileUploadHandler, setFileUploadHandler] = useState(null);

  // Ref cho input file ẩn
  const fileInputRef = useRef(null);
  
  // Lấy tên file đang mở từ Firestore
  useEffect(() => {
    const fetchOpenFile = async () => {
      try {
        const docRef = doc(db, "FILE_OPEN", "filename");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setOpenFileName(data.filed || "");
        }
      } catch (err) {
        console.error("Lỗi khi lấy FILE_OPEN:", err);
      }
    };
    fetchOpenFile();
  }, [setOpenFileName]);

  // Lưu trạng thái vào localStorage
  useEffect(() => { localStorage.setItem("activeTab", activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem("activeCommand", activeCommand); }, [activeCommand]);
  useEffect(() => { localStorage.setItem("ribbonVisible", ribbonVisible); }, [ribbonVisible]);

  const handleTabClick = (tab) => {
    setActiveTab(tab.label);
    const cmds = tab.commands || [];
    const keptCmd = cmds.find(c => c.label === activeCommand);
    const defaultCmd = cmds.find(c => c.label === tab.defaultCommand);
    const cmdToUse = keptCmd || defaultCmd || cmds[0];
    if (cmdToUse) {
      setActiveCommand(cmdToUse.label);
      if (window.location.pathname !== cmdToUse.path) navigate(cmdToUse.path);
    } else setActiveCommand("");
  };

  // Mở file
  const handleFileOpen = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.warn("fileInputRef chưa sẵn sàng");
    }
  };

  const [shouldAutoPrint, setShouldAutoPrint] = useState(false);

  // Mở file mặc định cho /thoikhoabieu (chưa có handler riêng từ XepTKBToanTruong)
  useEffect(() => {
    if (!openFileHandler) {
      setOpenFileHandler(() => () => {
        alert("⚠️ Chức năng mở file chỉ khả dụng trong trang Toàn trường.");
      });
    }
  }, [openFileHandler]);


  const handleCommandClick = async (cmd) => {
    setActiveCommand(cmd.label);

    if (cmd.label === "Mới") {
      const confirmReset = window.confirm(
        "⚠️ Bạn có chắc muốn tạo TKB mới?"
      );

      if (!confirmReset) return; // Người dùng hủy, không làm gì cả

      // ✅ Chỉ reset currentDocId TKB, bỏ phần GVBM và TKB khác
      resetSchedule({
        //setCurrentDocId, // chỉ reset docId
      });

      // 🔹 Reset TKB trong GVCN context (không xóa tên GV)
      gvcndata.resetGVCN();

      setOpenFileName("TKB chưa lưu");

      // Đánh dấu là tài liệu mới
      createNewDoc();

      // Buộc re-render các trang hiện tại
      setRefreshKey(prev => prev + 1);

      return;
    }

    if (cmd.label === "Mở file") {
      const currentPath = window.location.pathname;

      if (currentPath.startsWith("/phan-cong")) {
        if (handleFileOpen) {
          handleFileOpen();
        } else {
          alert("⚠️ Chức năng mở file từ máy tính chưa sẵn sàng.");
        }
        return;
      }

      if (currentPath.startsWith("/thoikhoabieu")) {
        setOpenFileDialog(true);
        return;
      }

      console.warn("⚠️ Mở file không được phép ở trang hiện tại");
      return;
    }

  // ===================== TIẾN TRÌNH LƯU... =====================
  if (cmd.label === "Lưu...") {
    const currentPath = window.location.pathname;

    if (currentPath === "/thoikhoabieu/gvbm") {
      setSaveMode("saveAsGVBM");
      setNewDocName("");
      setSaveDialogOpen(true);
      return;
    }

    if (currentPath === "/thoikhoabieu/gvcn") {
      setSaveMode("saveAsGVCN");
      setNewDocName("");
      setSaveDialogOpen(true);
      return;
    }

    if (currentPath === "/thoikhoabieu/toan-truong") {
      setSaveMode("saveAsToanTruong");
      setNewDocName("");
      setSaveDialogOpen(true);
      return;
    }

    if (currentPath === "/thoikhoabieu/tu-dong") {
      setSaveMode("saveAsTuDong");
      setNewDocName("");
      setSaveDialogOpen(true);
      return;
    }

    // Trường hợp khác
    setSaveMode("saveAs");
    setNewDocName("");
    setSaveDialogOpen(true);
    return;
  }

  // ===================== TIẾN TRÌNH LƯU =====================
  if (cmd.label === "Lưu") {
    const currentPath = window.location.pathname;

    if (currentPath === "/thoikhoabieu/gvbm") {
      await startSaveProgress();
      gvbmSaveHandler?.();
      return;
    }

    if (currentPath === "/thoikhoabieu/gvcn") {
      await startSaveProgress();
      gvcnSaveHandler?.();
      return;
    }

    if (currentPath === "/thoikhoabieu/toan-truong") {
      await startSaveProgress();
      thuCongSaveHandler?.(); // gọi hàm lưu thủ công toàn trường
      return;
    }

    if (currentPath === "/thoikhoabieu/tu-dong") {
      if (openFileName === "TKB chưa lưu") {
        setNewDocName("");
        setSaveDialogOpen(true);
      } else {
        await startSaveProgress();
        await tuDongSaveHandler?.();
      }
      return;
    }

    console.warn("⚠️ Không xác định được vị trí để lưu");
    return;
  }


  // ===================== IN =====================
  if (cmd.label === "In") {
    if (window.location.pathname === "/inthoikhoabieu/gvbm") {
      if (gvbmPrintHandler) {
        try {
          gvbmPrintHandler();
        } catch (err) {
          console.error("❌ Lỗi khi in GVBM:", err);
        }
      } else {
        console.warn("⚠️ gvbmPrintHandler chưa sẵn sàng");
      }
      return;
    }

    if (window.location.pathname === "/inthoikhoabieu/gvcn") {
      if (gvcnPrintHandler) {
        try {
          gvcnPrintHandler();
        } catch (err) {
          console.error("❌ Lỗi khi in GVCN:", err);
        }
      } else {
        console.warn("⚠️ gvcnPrintHandler chưa sẵn sàng");
      }
      return;
    }

    setShouldAutoPrint(true);
    navigate("/inthoikhoabieu/gvbm");
    return;
  }

  // ===================== TẢI VỀ =====================
  if (cmd.label === "Tải về") {
    if (window.location.pathname === "/inthoikhoabieu/gvbm") {
      if (gvbmExportHandler) {
        try {
          gvbmExportHandler();
        } catch (err) {
          console.error("❌ Lỗi khi tải về GVBM:", err);
        }
      } else {
        console.warn("⚠️ gvbmExportHandler chưa sẵn sàng");
      }
      return;
    }

    if (window.location.pathname === "/inthoikhoabieu/gvcn") {
      if (gvcnExportHandler) {
        try {
          gvcnExportHandler();
        } catch (err) {
          console.error("❌ Lỗi khi tải về GVCN:", err);
        }
      } else {
        console.warn("⚠️ gvcnExportHandler chưa sẵn sàng");
      }
      return;
    }

    setShouldAutoPrint(false);
    navigate("/inthoikhoabieu/gvbm");
    return;
  }

  if (cmd.path && window.location.pathname !== cmd.path) {
    navigate(cmd.path);
  }
};

  // Điều hướng khi mount
  useEffect(() => {
    const tab = ribbonTabs.find(t => t.label === activeTab) || ribbonTabs[0];
    if (!tab) return;
    let cmd = (tab.commands || []).find(c => c.label === activeCommand);
    if (!cmd) {
      cmd = (tab.commands || []).find(c => c.label === tab.defaultCommand) || (tab.commands || [])[0];
      if (cmd) setActiveCommand(cmd.label);
    }
    if (cmd && window.location.pathname !== cmd.path) navigate(cmd.path, { replace: true });
  }, []);

  return (
    <>
      {/* Input file ẩn */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={(e) => {
          if (fileUploadHandler) fileUploadHandler(e);
          e.target.value = null;
        }}
      />

      {/* Thanh menu chính */}
      <AppBar position="fixed" sx={{ background: "#1976d2", height: "50px" }}>
        <Toolbar
          sx={{
            minHeight: { xs: 30, sm: 50 },  // 👉 mobile 30px, desktop 50px
            display: "flex",
            alignItems: "center",
            px: 1,
            mt: { xs: 1, sm: 0 },           // 👉 thêm margin-top cho mobile
          }}
        >
          <Box
            component="img"
            src="/Logo.png"
            alt="Logo"
            sx={{
              height: "30px",
              cursor: "pointer",
              // Desktop: giữ nguyên m: -2
              ml: { xs: 0.2, sm: -2 },   // 📱 mobile: chỉ lùi nhẹ (0.5), 🖥️ desktop giữ -2
              mt: { xs: -0.7, sm: -2 },     // 📱 mobile: giảm nhích lên (0), 🖥️ desktop giữ -2
              mb: { xs: 0, sm: -2 },
              mr: { xs: 0, sm: -2 },
            }}
          />

          {/* Menu tabs */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              ml: 5,
              overflowX: "auto",
              whiteSpace: "nowrap",
              "&::-webkit-scrollbar": { height: 6 },
            }}
          >
            {ribbonTabs.map((tab) => (
              <Button
                key={tab.label}
                startIcon={React.cloneElement(tab.icon, {
                  sx: { color: "#fff", fontSize: "1.2rem" },
                })}
                sx={{
                  flexShrink: 0,
                  color: "white",
                  textTransform: "none",
                  fontSize: "0.875rem",
                  borderBottom:
                    activeTab === tab.label
                      ? "3px solid #fff"
                      : "3px solid transparent",
                }}
                onClick={() => handleTabClick(tab)}
              >
                {tab.label}
              </Button>
            ))}
          </Box>
          <Box
            sx={{
              flexGrow: 1,
              display: { xs: "none", sm: "flex" }, // 👉 ẩn cả cụm này trên mobile
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {openFileName && (
              <Typography variant="subtitle2" sx={{ color: "#ffeb3b" }}>
                📂 {openFileName}
              </Typography>
            )}

            {/*<Typography variant="subtitle2" sx={{ color: "#fff", ml: 2 }}>
              {schoolYear}
            </Typography>*/}
          </Box>


          <Button
            sx={{
              color: "white",
              fontSize: "1.5rem",
              minWidth: 50,
              height: "30px",
            }}
            onClick={() => setRibbonVisible(!ribbonVisible)}
          >
            {ribbonVisible ? "▴" : "▾"}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Ribbon luôn dưới AppBar */}
      {ribbonVisible && (
        <Box
          sx={{
            mt: "50px", // 👈 đẩy ribbon xuống dưới AppBar cao 50px
            bgcolor: "#fff",
            p: 1,
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #ccc",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: (theme) => theme.zIndex.appBar - 1, // dưới AppBar
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              overflowX: "auto",
              whiteSpace: "nowrap",
              "&::-webkit-scrollbar": { height: 6 },
            }}
          >
            {ribbonTabs.find((t) => t.label === activeTab)?.commands.map((cmd) => (
              <React.Fragment key={cmd.label}>
                {(cmd.label === "GV chủ nhiệm" || cmd.label === "Xếp tự động") && (
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{
                      mx: 1,
                      borderColor: "#757575",
                      borderRightWidth: 2,
                      opacity: 0.5,
                    }}
                  />
                )}

                <Button
                  component={cmd.path ? Link : "button"}
                  to={cmd.path || undefined}
                  onClick={() => handleCommandClick(cmd)}
                  sx={{
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: { xs: "row", sm: "column" },
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: { xs: "auto", sm: 60 },
                    px: { xs: 1, sm: 0 },
                    gap: { xs: 0.5, sm: 0 },
                    borderRadius: 1,
                    textTransform: "none",
                    bgcolor:
                      activeCommand === cmd.label ? "#e0f7fa" : "transparent",
                    "&:hover": { bgcolor: "#b2ebf2" },
                    color: ["Lưu", "Lưu...", "Mở file", "Tải về", "In"].includes(
                      cmd.label
                    )
                      ? "primary.main"
                      : commandColors[cmd.label] || "#000",
                  }}
                >
                  {cmd.icon &&
                    React.cloneElement(cmd.icon, {
                      sx: {
                        fontSize: "1.5rem",
                        mr: { xs: 0.5, sm: 0 },
                        color: ["Lưu", "Lưu...", "Mở file", "Tải về", "In"].includes(
                          cmd.label
                        )
                          ? "inherit"
                          : commandColors[cmd.label] || "#000",
                      },
                    })}
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: { xs: "0.75rem", sm: "0.8rem" },
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cmd.label}
                  </Typography>
                </Button>
              </React.Fragment>
            ))}
          </Box>

          {isSaving && (
            <Box
              sx={{
                flexGrow: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: 0.5,
              }}
            >
              <Box sx={{ width: 180, height: 3 }}>
                <LinearProgress
                  variant="determinate"
                  value={saveProgress}
                  sx={{ height: "3px", borderRadius: 1 }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  mt: 0.5,
                  fontSize: "0.7rem",
                  color: "#000",
                  textAlign: "center",
                }}
              >
                Đang lưu... ({saveProgress}%)
              </Typography>
            </Box>
          )}
        </Box>
      )}


      {/* ✅ Hộp thoại mở file */}
      *<FileOpenDialog
        open={openFileDialog}
        onClose={() => setOpenFileDialog(false)}
      />

      
      {/*<SaveDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        saveMode={saveMode}
        docName={newDocName}
        setDocName={setNewDocName}
        onSave={(safeDocId) => {
          switch (saveMode) {
            case "saveAsGVBM":
              console.log("✅ Gọi saveAsGVBM");
              handlers?.saveAsGVBM?.(safeDocId);
              break;
            case "saveAsGVCN":
              console.log("✅ Gọi saveAsGVCN");
              handlers?.saveAsGVCN?.(safeDocId);
              break;
            case "saveAsToanTruong":
              console.log("✅ Gọi saveAsToanTruong");
              handlers?.saveAsToanTruong?.(safeDocId);
              break;
            case "saveAsTuDong":
            case "saveAsTuDongChinhThuc":
              console.log("✅ Gọi saveAsTuDong");
              handlers?.saveAsTuDong?.(safeDocId);
              break;
            default:
              console.log("⚠️ Gọi fallback save");
              if (window.location.pathname === "/thoikhoabieu/gvbm") {
                gvbmSaveHandler?.(safeDocId);
              } else if (window.location.pathname === "/thoikhoabieu/gvcn") {
                gvcnSaveHandler?.(safeDocId);
              } else {
                console.warn("⚠️ Không xác định được trang hiện tại để gọi Save");
              }
          }
        }}
      />*/}

      <Box sx={{ pt: "100px", px: 2 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/hethong/thong-tin" element={<Tab1ThongTin />} />
          <Route path="/hethong/lich-sinh-hoat" element={<Tab2LichSinhHoat />} />
          <Route path="/hethong/thoi-gian-hoc" element={<Tab3ThoiGianHoc />} />
          <Route path="/hethong/danh-sach-mon" element={<Tab4MonHoc />} />

          <Route path="/phan-cong/gvcn" element={<DanhSachGVCN setUploadHandler={setFileUploadHandler} />} />
          <Route path="/phan-cong/gvbm" element={<DanhSachGVBM setUploadHandler={setFileUploadHandler} />} />

          <Route
            path="/thoikhoabieu/gvcn"
            element={<XepTKB_GVCN key={refreshKey} setSaveHandler={setGvcnSaveHandler} />}
          />

          <Route
            path="/thoikhoabieu/gvbm"
            element={
              <XepTKB_GVBM
                key={refreshKey}
                setSaveHandler={setGvbmSaveHandler}
                setSaveAsHandler={setGvbmSaveAsHandler} // 👈 thêm dòng này
              />
            }
          />

          {/* XepTKBToanTruong */}
          <Route
            path="/thoikhoabieu/toan-truong"
            element={
              <XepTKBToanTruong
                key={refreshKey}
                onOpenFile={setOpenFileHandler}
                setThuCongSaveHandler={setThuCongSaveHandler}       // xử lý "Lưu"
                setThuCongSaveAsHandler={setThuCongSaveAsHandler}   // ✅ xử lý "Lưu..."
              />
            }
          />

          {/* ToanTruongTKB_TuDong */}
          <Route
            path="/thoikhoabieu/tu-dong"
            element={
              <XepTKBTuDong
                key={refreshKey}
                setOpenFileHandler={setOpenFileHandler}
                setTuDongSaveHandler={setTuDongSaveHandler} 
                setTuDongSaveAsHandler={setTuDongSaveAsHandler}                 
              />
            }
          />

          <Route
            path="/inthoikhoabieu/gvbm"
            element={<InTKB_GVBM setPrintHandler={setGvbmPrintHandler} setExportHandler={setGvbmExportHandler} />}
          />

          <Route
            path="/inthoikhoabieu/gvcn"
            element={<InTKB_GVCN setPrintHandler={setGvcnPrintHandler} setExportHandler={setGvcnExportHandler} />}
          />

          <Route path="/phan-cong-lop-gvbm/:gvbmId" element={<PhanCongLopGVBM />} />
          <Route path="/hethong" element={<HeThong />} />
        </Routes>

        {/* ✅ SaveDialog phải nằm ngoài Routes để luôn hiển thị khi cần */}
        <SaveDialog
          docName={newDocName}
          setDocName={setNewDocName}
          open={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          saveMode={saveMode}
          handlers={{
            saveAsGVCN: gvcnSaveHandler,

            saveGVBM: gvbmSaveHandler,         // ✅ hàm Lưu
            saveAsGVBM: gvbmSaveAsHandler,     // ✅ hàm Lưu với tên mới

            saveAsToanTruong: thuCongSaveAsHandler, 

            saveAsTuDong: tuDongSaveAsHandler,      
            saveAsTuDongChinhThuc: tuDongSaveAsHandler,
          }}
        />

      </Box>
    </>
  );
}

export default function App() {
  return (
    <OpenFileProvider>
      <NewDocProvider> {/* ✅ thêm Provider */}
        <Router>
          <ScheduleProvider>
            <GVCNProvider>
              <GVBMProvider>
                <TKB_GVBMProvider>
                  <AppWithPrintContext />
                </TKB_GVBMProvider>
              </GVBMProvider>
            </GVCNProvider>
          </ScheduleProvider>
        </Router>
      </NewDocProvider>
    </OpenFileProvider>
  );
}


// Component để lấy context và truyền vào PrintTKBProvider
function AppWithPrintContext() {
  const gvcndata = useGVCN();    // { contextRows, allSchedules, currentDocId, tkbAllTeachers }
  const gvbmData = useGVBM();    // { contextRows, allSchedules, currentDocId, tkbAllTeachers }

  return (
    <PrintTKBProvider
      gvcndata={{
        contextRows: gvcndata.contextRows,
        allSchedules: gvcndata.allSchedules,
        currentDocId: gvcndata.currentDocId,
        tkbAllTeachers: gvcndata.tkbAllTeachers,
      }}
      gvbmData={{
        contextRows: gvbmData.contextRows,
        allSchedules: gvbmData.allSchedules,
        currentDocId: gvbmData.currentDocId,
        tkbAllTeachers: gvbmData.tkbAllTeachers,
      }}
    >
      <AppContent />
    </PrintTKBProvider>
  );
}
