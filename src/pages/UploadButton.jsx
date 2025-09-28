// UploadButton.jsx
import { IconButton, Tooltip } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const UploadButton = ({ onUpload }) => (
  <Tooltip title="Nhập danh sách từ Excel">
    <IconButton
      color="primary"
      component="label"
      sx={{
        bgcolor: "#1976d2",
        color: "#fff",
        "&:hover": { bgcolor: "#115293" },
        p: 0.5,
        mr: 1,
      }}
      size="small"
    >
      <UploadFileIcon />
      <input
        type="file"
        hidden
        onChange={async (e) => {
          if (onUpload) await onUpload(e);
          e.target.value = null;
        }}
      />
    </IconButton>
  </Tooltip>
);

export default UploadButton;
