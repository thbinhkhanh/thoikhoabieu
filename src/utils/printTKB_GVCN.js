import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

/**
 * In thời khóa biểu cho giáo viên
 * @param {Object} gv - { name: string } tên giáo viên
 * @param {Object} tkbData - dữ liệu TKB dạng schedule đã loại bỏ lớp
 * @param {string} tenLop - tên lớp hiện tại (chỉ dùng hiển thị header)
 */
export const printTeachersTKB = async (gvList) => {
  if (!Array.isArray(gvList) || gvList.length === 0) {
    console.warn("Không có GV để in.");
    return;
  }

  // --- Lấy thông tin trường, năm học ---
  let ubnd = "UBND …", truong = "Trường …", namHoc = "Năm học …", ngayApDung = null;
  try {
    const infoDoc = await getDoc(doc(db, "THONGTIN", "INFO"));
    if (infoDoc.exists()) {
      const data = infoDoc.data();
      ubnd = data.ubnd || ubnd;
      truong = data.truong || truong;
      namHoc = data.namHoc || namHoc;
      ngayApDung = data.ngayApDung ? dayjs(data.ngayApDung) : null;
    }
  } catch (err) { console.error(err); }

  // --- Lấy cấu hình buổi học ---
  let buoiSang = [], buoiChieu = [];
  try {
    const timeDoc = await getDoc(doc(db, "THOIGIANHOC", "thoiGian"));
    if (timeDoc.exists()) {
      const data = timeDoc.data();
      buoiSang = data.buoiSang || [];
      buoiChieu = data.buoiChieu || [];
    }
  } catch (err) { console.error(err); }

  const weekdays = ["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6"];
  const sessionMap = { sáng:"SÁNG", chiều:"CHIỀU" };
  const teachingRowIdx = { sáng:[1,2,4,5], chiều:[0,1,3,4] };

  // --- Gom tất cả GV vào 1 tài liệu ---
  let html = `<html><head>
    <style>
      body { font-family: "Times New Roman"; font-size: 12pt; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 5px; }
      td, th { padding: 5px; vertical-align: middle; }
      .bordered td, .bordered th { border: 1px solid black; text-align: center; }
      .bold { font-weight: bold; }
      .center { text-align: center; }
      .left { text-align: left; }
      .right { text-align: right; }
      .page { page-break-after: always; }
    </style>
  </head><body>`;

  gvList.forEach(({ name, tkbData, tenLop }, idx) => {
    html += `<div class="page">
      <table>
        <tr><td colspan="8" class="bold left">${`ỦY BAN NHÂN DÂN ${ubnd}`.toUpperCase()}</td></tr>
        <tr><td colspan="8" class="bold left">${`TRƯỜNG TIỂU HỌC ${truong}`.toUpperCase()}</td></tr>
        <tr><td colspan="8"></td></tr>
        <tr><td colspan="8" class="center bold" style="font-size:16pt;">THỜI KHÓA BIỂU</td></tr>
        <tr><td colspan="8" class="center">NĂM HỌC: ${namHoc}</td></tr>
        <tr><td colspan="8"></td></tr>
        <tr>
          <td colspan="4" class="bold left">GVCN: ${name?.toUpperCase() || ""}</td>
          <td colspan="4" class="bold right">LỚP: ${tenLop}</td>
        </tr>
        <tr><td colspan="8"></td></tr>
      </table>

      <table class="bordered">
        <tr>
          <th style="width:5%;">BUỔI</th>
          <th style="width:13%;">TIẾT</th>
          <th style="width:17%;">THỜI GIAN</th>
          ${weekdays.map(d => `<th style="width:13%;">${d}</th>`).join('')}
        </tr>`;

    ["sáng","chiều"].forEach((session, sessionIdx) => {
      const sessionKey = sessionMap[session];
      const rowDefs = session === "sáng" ? buoiSang : buoiChieu;
      const startRow = sessionIdx === 0 ? 2 : 9;
      const endRow = startRow + rowDefs.length;
      html += `<tr><td rowspan="${endRow - startRow + 1}" class="center bold">${session.toUpperCase()}</td></tr>`;

      rowDefs.forEach((period, rowIdx) => {
        const posInTeaching = teachingRowIdx[session].indexOf(rowIdx);
        html += `<tr>
          <td class="center">${period.tiet || ""}</td>
          <td class="center">${period.gio || ""}</td>
          ${weekdays.map(dayName => {
            const periods = tkbData?.[dayName]?.[sessionKey] || [];
            const cell = posInTeaching !== -1 ? periods[posInTeaching] : null;
            const label = cell?.subject ? String(cell.subject).trim() : "";
            return `<td class="center">${label}</td>`;
          }).join('')}
        </tr>`;
      });
    });

    html += `</table>
      <table style="width:100%; margin-top:5px;">
        <tr>
          <td style="width:50%;" class="left"><em>Ngày áp dụng: ${ngayApDung ? dayjs(ngayApDung).format("DD/MM/YYYY") : "…"}</em></td>
          <td style="width:50%;" class="right"><em>${truong}, ngày ${dayjs().format("DD")} tháng ${dayjs().format("MM")} năm ${dayjs().format("YYYY")}</em></td>
        </tr>
        <tr>
          <td></td>
          <td style="text-align:right; font-weight:bold;">HIỆU TRƯỞNG&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
        </tr>
      </table>
    </div>`;
  });

  html += `</body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
};