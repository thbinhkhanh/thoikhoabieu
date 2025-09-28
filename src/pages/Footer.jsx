// src/components/Footer.jsx
import React from "react";
import { Box, Typography } from "@mui/material";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        py: 1,
        mt: 0,
        backgroundColor: "transparent",
        textAlign: "center",
        borderTop: "1px solid #ddd",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        © 2025 thbinhkhanh@gmail.com. 
      </Typography>
    </Box>
  );
}
