// src/utils/printTKB_GVBM.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

export const printTeachersTKB = async (gvList = [], vietTatMon = {}) => {
  if (!gvList || gvList.length === 0) {
    console.warn("Không có GV để in.");
    return;
  }

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

  const formatPeriodLabel = (tiet, teacherSubjectCount) => {
    if (!tiet) return "";
    const classLabel = tiet.class || "";
    let subjFull = tiet.subject || "";
    if (subjFull.toUpperCase() === "TH") subjFull = "";
    return subjFull ? `${classLabel} (${subjFull})` : classLabel;
  };

  // === Ghép HTML cho tất cả GV ===
  let html = `
    <html><head>
      <style>
        body { font-family: "Times New Roman"; font-size: 12pt; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 5px; }
        td, th { padding: 5px; vertical-align: middle; }
        .bordered td, .bordered th { border: 1px solid black; text-align: center; }
        .bold { font-weight: bold; }
        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
      </style>
    </head>
    <body>
  `;

  gvList.forEach((gv, idx) => {
    const tkbOfGv = gv.tkbData || {};

    const teacherSubjectCount = (() => {
      const subjects = new Set();
      Object.values(tkbOfGv || {}).forEach(day => {
        ["SÁNG", "CHIỀU"].forEach(session => {
          (day?.[session] || []).forEach(p => {
            if (p?.subject) subjects.add(p.subject);
          });
        });
      });
      return subjects.size || (gv.monDay?.length || 1);
    })();

    let totalLessons = 0;
    ["sáng","chiều"].forEach(session => {
      const sessionKey = sessionMap[session];
      const rowDefs = session === "sáng" ? buoiSang : buoiChieu;
      rowDefs.forEach((_, rowIdx) => {
        const posInTeaching = teachingRowIdx[session].indexOf(rowIdx);
        weekdays.forEach(dayName => {
          const periods = tkbOfGv[dayName]?.[sessionKey] || [];
          const cell = posInTeaching !== -1 ? periods[posInTeaching] : null;
          if (cell && formatPeriodLabel(cell, teacherSubjectCount)) totalLessons++;
        });
      });
    });

    // Header của mỗi GV
    html += `
      <div style="page-break-after: always;">
        <table>
          <tr><td colspan="8" class="bold left">${`ỦY BAN NHÂN DÂN ${ubnd}`.toUpperCase()}</td></tr>
          <tr><td colspan="8" class="bold left">${`TRƯỜNG TIỂU HỌC ${truong}`.toUpperCase()}</td></tr>
          <tr><td colspan="8"></td></tr>
          <tr><td colspan="8" class="center bold" style="font-size:16pt;">THỜI KHÓA BIỂU</td></tr>
          <tr><td colspan="8" class="center">NĂM HỌC: ${namHoc}</td></tr>
          <tr><td colspan="8"></td></tr>
          <tr>
            <td colspan="4" class="bold left">GVBM: ${gv.name?.toUpperCase() || ""}</td>
            <td colspan="4" class="bold right">Tổng số tiết: ${totalLessons}</td>
          </tr>
        </table>
    `;

    // Bảng TKB
    html += `<table class="bordered">
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
        html += `<tr>
          <td class="center" style="width:13%;">${period.tiet || ""}</td>
          <td class="center" style="width:17%;">${period.gio || ""}</td>
          ${weekdays.map(dayName => {
            const periodsGV = tkbOfGv[dayName]?.[sessionKey] || [];
            // Tìm đúng cell có số tiết trùng với period.tiet
            const cell = periodsGV.find(p => {
              if (!p?.tiet) return false;
              // chuyển cả 2 về string, chỉ lấy số đầu nếu p.tiet là "4a" hoặc "4,5"
              const pTietNum = p.tiet.toString().match(/\d+/)?.[0];
              const periodTietNum = period.tiet.toString().match(/\d+/)?.[0];
              return pTietNum === periodTietNum;
            }) || null;
            const label = formatPeriodLabel(cell, teacherSubjectCount);
            return `<td class="center" style="width:13%;">${label}</td>`;
          }).join('')}
        </tr>`;
      });

    });

    // Footer của mỗi GV
    html += `</table>
      <table style="width:100%; border-collapse: collapse; margin-top:5px;">
        <tr>
          <td style="width:50%;" class="left"><em>Ngày áp dụng: ${ngayApDung ? dayjs(ngayApDung).format("DD/MM/YYYY") : "…"}</em></td>
          <td style="width:50%;" class="right"><em>${truong}, ngày ${dayjs().format("DD")} tháng ${dayjs().format("MM")} năm ${dayjs().format("YYYY")}</em></td>
        </tr>
        <tr>
          <td></td>
          <td style="text-align:right; font-weight:bold;">HIỆU TRƯỞNG&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
        </tr>
      </table>
      </div>
    `;
  });

  html += `</body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  } else {
    console.error("❌ Không thể mở cửa sổ in. Có thể bị chặn bởi trình duyệt.");
  }
};
