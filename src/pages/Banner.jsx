// src/pages/Banner.jsx
import React from "react";
import { Box, Typography } from "@mui/material";
import { useLocation } from "react-router-dom";

export default function Banner({ title, subtitle }) {
  const location = useLocation();
  const path = location.pathname;

  // Gán tiêu đề tự động theo đường dẫn
  const pageTitles = {
    "/": "TRANG CHỦ",
    "/quanly": "QUẢN LÝ BÁN TRÚ",
    "/gioithieu": "GIỚI THIỆU HỆ THỐNG",
    "/phieu-xuat": "PHIẾU XUẤT",
    "/chi-cho": "CHI CHO",
    "/tien-an": "TIỀN ĂN",
    "/them-thuc-pham": "THÊM THỰC PHẨM",
  };

  const computedTitle = title || pageTitles[path] || "HỆ THỐNG QUẢN LÝ";
  const computedSubtitle = subtitle || "";

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: { xs: 120, sm: 160, md: 200 },
        backgroundImage: "url('/banner.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        mb: 0,
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          zIndex: 1,
        },
      }}
    >
      <Box sx={{ position: "relative", zIndex: 2, textAlign: "center", px: 1 }}>
        <Typography
          variant="h5"
          color="white"
          fontWeight="bold"
          sx={{ fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" } }}
        >
          {computedTitle}
        </Typography>
        {computedSubtitle && (
          <Typography
            variant="subtitle2"
            color="white"
            sx={{ fontSize: { xs: "0.8rem", sm: "1rem" } }}
          >
            {computedSubtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
