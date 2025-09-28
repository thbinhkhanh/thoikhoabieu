import React, { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  LinearProgress,
  Collapse,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Banner from "./Banner";

export default function Home() {
  const navigate = useNavigate();

  // 👉 Menu mới
  const menuList = [
    "NHẬP DANH SÁCH",
    "XẾP THỜI KHÓA BIỂU",
    "IN THỜI KHÓA BIỂU",
    "HỆ THỐNG",
  ];
  const imageList = [
    "nhapdanhsach.png",
    "xepthoikhoabieu.png",
    "inthoikhoabieu.png",
    "hethong.png",
  ];
  const colorMap = ["#42a5f5", "#66bb6a", "#ffb300", "#ab47bc"];

  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  const handleClickMenu = (index) => {
    const pathMap = ["/nhapdanhsach", "/xepthoikhoabieu", "/inthoikhoabieu", "/hethong"];
    navigate(pathMap[index]);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #e3f2fd, #bbdefb)",
        py: 0,
        px: 0,
      }}
    >
      <Banner title="QUẢN LÝ THỜI KHÓA BIỂU" />

      <Box sx={{ px: 2 }}>
        <Grid container spacing={3} justifyContent="center" sx={{ mt: 3, mb: 4 }}>
          {menuList.map((label, index) => (
            <Grid item xs={12} sm={6} md={4} key={label}>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  elevation={4}
                  sx={{
                    borderRadius: 2,
                    overflow: "hidden",
                    textAlign: "center",
                    height: "100%",
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: "#fff",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      p: 1.5,
                      cursor: "pointer",
                    }}
                    onClick={() => handleClickMenu(index)}
                  >
                    <img
                      src={`/${imageList[index]}`}
                      alt={label}
                      width="120px"
                      height="120px"
                      loading="lazy"
                      style={{
                        borderRadius: "8px",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
                      }}
                    />
                  </Box>

                  <CardContent sx={{ py: 1 }}>
                    <Typography
                      variant="h6"
                      fontWeight="600"
                      gutterBottom
                      sx={{ fontSize: { xs: "1rem", sm: "1.1rem" } }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1, fontSize: { xs: "0.8rem", sm: "0.9rem" } }}
                    >
                      Nhấn để vào mục {label}
                    </Typography>

                    <Button
                      variant="contained"
                      fullWidth
                      sx={{
                        backgroundColor: colorMap[index],
                        fontWeight: 600,
                        py: { xs: 0.5, sm: 1 },
                        fontSize: { xs: "0.8rem", sm: "0.9rem" },
                        "&:hover": {
                          backgroundColor: colorMap[index],
                          filter: "brightness(0.9)",
                        },
                      }}
                      onClick={() => handleClickMenu(index)}
                    >
                      Vào {label}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {message && (
          <Box sx={{ px: 2, mb: 2 }}>
            <Collapse in={showAlert}>
              <Alert severity={success ? "success" : "error"} sx={{ width: "25%", mx: "auto" }}>
                {message}
              </Alert>
            </Collapse>
          </Box>
        )}

        {progress > 0 && progress < 100 && (
          <Box sx={{ px: 2, mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ width: "20%", mx: "auto" }}
            />
            <Typography
              variant="caption"
              align="center"
              display="block"
              sx={{ mt: 1 }}
            >
              Đang xử lý dữ liệu... ({currentIndex} bước - {progress}%)
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
