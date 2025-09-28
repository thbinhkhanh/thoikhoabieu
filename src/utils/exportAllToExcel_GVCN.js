import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export const exportAllTeachersToExcel = async (gvList, vietTatMon = {}) => {
  if (!Array.isArray(gvList) || !gvList.length) {
    throw new Error("gvList phải là mảng và không rỗng");
  }

  // Lấy thông tin trường
  let ubnd = "UBND …", truong = "Trường …", namHoc = "Năm học …", ngayApDung = "…";
  try {
    const infoDoc = await getDoc(doc(db, "THONGTIN", "INFO"));
    if (infoDoc.exists()) {
      const data = infoDoc.data();
      ubnd = data.ubnd || ubnd;
      truong = data.truong || truong;
      namHoc = data.namHoc || namHoc;
      ngayApDung = data.ngayApDung ? dayjs(data.ngayApDung).format("DD/MM/YYYY") : ngayApDung;
    }
  } catch (err) {
    console.error("❌ Lỗi fetch thông tin:", err);
  }

  // Lấy thời gian học
  let buoiSang = [], buoiChieu = [];
  try {
    const timeDoc = await getDoc(doc(db, "THOIGIANHOC", "thoiGian"));
    if (timeDoc.exists()) {
      const data = timeDoc.data();
      buoiSang = data.buoiSang || [];
      buoiChieu = data.buoiChieu || [];
    }
  } catch (err) {
    console.error("❌ Lỗi fetch thời gian học:", err);
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("TKB Toàn Trường");
  const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
  const sessionMap = { sáng: "SÁNG", chiều: "CHIỀU" };
  const teachingRowIdx = { sáng: [1, 2, 4, 5], chiều: [0, 1, 3, 4] };
  const colWidths = [8.17, 8.17, 15.17, 11.17, 11.17, 11.17, 11.17, 11.17];

  const formatPeriodLabel = (tiet, teacher, teacherSubjectCount) => {
    if (!tiet) return "";

    const classLabel = tiet.class || tiet.lop || tiet.className || "";
    const subjFull = tiet.subject || "";
    const subjAbbr = vietTatMon[subjFull] || subjFull || "";

    // Nếu chỉ có môn học, không có lớp → trả về tên môn
    if (!classLabel) return subjAbbr;

    // Nếu có cả lớp và môn → ghép lại (không có dấu ngoặc)
    if (teacherSubjectCount <= 1 || subjAbbr === "TH") return classLabel;
    return `${classLabel} - ${subjAbbr}`; // hoặc `${classLabel} ${subjAbbr}` nếu bạn muốn đơn giản
    };

  const countTeacherSubjects = (teacher, tkbOfGv) => {
    if (teacher?.tenMon?.length > 0) return teacher.tenMon.split(",").length;
    const subjects = new Set();
    Object.values(tkbOfGv || {}).forEach(daySch => {
      ["SÁNG", "CHIỀU"].forEach(s => (daySch[s] || []).forEach(p => {
        if (p?.subject) subjects.add(p.subject);
      }));
    });
    return subjects.size || 1;
  };

  gvList.forEach((teacher, index) => {
    const offset = index * 47;
    const tkbOfGv = teacher.tkbData || {};
    let totalLessons = 0;

    // Header
    ws.mergeCells(`A${1 + offset}:D${1 + offset}`);
    ws.getCell(`A${1 + offset}`).value = `ỦY BAN NHÂN DÂN ${ubnd}`.toUpperCase();
    ws.getCell(`A${1 + offset}`).alignment = { horizontal: "center" };
    ws.getCell(`A${1 + offset}`).font = { name: "Times New Roman", size: 11, bold: true };

    ws.mergeCells(`A${2 + offset}:D${2 + offset}`);
    ws.getCell(`A${2 + offset}`).value = `TRƯỜNG TIỂU HỌC ${truong}`.toUpperCase();
    ws.getCell(`A${2 + offset}`).alignment = { horizontal: "center" };
    ws.getCell(`A${2 + offset}`).font = { name: "Times New Roman", size: 11, bold: true };

    const rowMonHoc = 4 + offset;
    ws.mergeCells(`A${rowMonHoc}:H${rowMonHoc}`);
    ws.getCell(`A${rowMonHoc}`).value = `THỜI KHÓA BIỂU`;
    ws.getCell(`A${rowMonHoc}`).alignment = { horizontal: "center" };
    ws.getCell(`A${rowMonHoc}`).font = { name: "Times New Roman", size: 14, bold: true };

    const rowNamHoc = 5 + offset;
    ws.mergeCells(`A${rowNamHoc}:H${rowNamHoc}`);
    ws.getCell(`A${rowNamHoc}`).value = `NĂM HỌC: ${namHoc}`;
    ws.getCell(`A${rowNamHoc}`).alignment = { horizontal: "center" };
    ws.getCell(`A${rowNamHoc}`).font = { name: "Times New Roman", size: 13 };

    const rowInfo = 7 + offset;
    ws.mergeCells(`A${rowInfo}:D${rowInfo}`);
    ws.getCell(`A${rowInfo}`).value = `GVCN: ${teacher.name?.toUpperCase() || ""}`;
    ws.getCell(`A${rowInfo}`).font = { name: "Times New Roman", size: 11, bold: true };

    ws.mergeCells(`E${rowInfo}:H${rowInfo}`);
    ws.getCell(`E${rowInfo}`).value = `LỚP: ${teacher.tenLop || "…"}`;
    ws.getCell(`E${rowInfo}`).alignment = { horizontal: "right" };
    ws.getCell(`E${rowInfo}`).font = { name: "Times New Roman", size: 11, bold: true };

    const rowHeader = 9 + offset;
    const header = ["BUỔI", "TIẾT", "THỜI GIAN", ...weekdays];
    ws.insertRow(rowHeader, header.map(h => h.toUpperCase()));
    ws.columns = colWidths.map(w => ({ width: w }));

    const sectionRowRanges = {};
    let currentRow = rowHeader + 1;

    for (const session of ["sáng", "chiều"]) {
      const sessionKey = sessionMap[session];
      const rowDefs = session === "sáng" ? buoiSang : buoiChieu;
      const teacherSubjectCount = countTeacherSubjects(teacher, tkbOfGv);
      const startSessionRow = currentRow;

      rowDefs.forEach((period, timeRowIdx) => {
        const tiet = period?.tiet || "";
        const gio = period?.gio || "";
        const tietLabel = ["Truy bài", "Ra chơi"].includes(tiet) ? "" : tiet;
        const row = [session.toUpperCase(), tietLabel, gio];
        const posInTeaching = teachingRowIdx[session].indexOf(timeRowIdx);

        weekdays.forEach(dayName => {
          const periods = tkbOfGv[dayName]?.[sessionKey] || [];
          const cellValue = posInTeaching !== -1 ? formatPeriodLabel(periods[posInTeaching], teacher, teacherSubjectCount) : "";
          if (cellValue) totalLessons++;
          row.push(cellValue);
        });

        ws.addRow(row);
        currentRow++;
      });

      sectionRowRanges[session] = [startSessionRow, currentRow - 1];
    }

    ws.getCell(`G${rowInfo}`).value = `LỚP: ${teacher.tenLop || "…"}`;

        // Viền + merge buổi
    for (let r = rowHeader; r < currentRow; r++) {
      ws.getRow(r).height = 27;
      for (let c = 1; c <= header.length; c++) {
        const cell = ws.getCell(r, c);
        cell.font = { name: "Times New Roman", size: 11, bold: r === rowHeader };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      }
    }

    for (const [session, [startR, endR]] of Object.entries(sectionRowRanges)) {
      if (startR < endR) {
        ws.mergeCells(`A${startR}:A${endR}`);
      }
      ws.getCell(`A${startR}`).value = session.toUpperCase();
      ws.getCell(`A${startR}`).alignment = { vertical: "middle", horizontal: "center" };
      ws.getCell(`A${startR}`).font = { name: "Times New Roman", size: 11, bold: true };
    }

    // TRUY BÀI (sáng)
    const rowTruyBai = offset + 10;
    ws.mergeCells(`D${rowTruyBai}:H${rowTruyBai}`);
    ws.getCell(`D${rowTruyBai}`).value = "TRUY BÀI";
    ws.getCell(`D${rowTruyBai}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`D${rowTruyBai}`).font = { name: "Times New Roman", size: 11, bold: true };

    // RA CHƠI (sáng)
    const rowRaChoiS = offset + 13;
    ws.mergeCells(`D${rowRaChoiS}:H${rowRaChoiS}`);
    ws.getCell(`D${rowRaChoiS}`).value = "RA CHƠI";
    ws.getCell(`D${rowRaChoiS}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`D${rowRaChoiS}`).font = { name: "Times New Roman", size: 11, bold: true };

    // RA CHƠI (chiều)
    const rowRaChoiC = offset + 19;
    ws.mergeCells(`D${rowRaChoiC}:H${rowRaChoiC}`);
    ws.getCell(`D${rowRaChoiC}`).value = "RA CHƠI";
    ws.getCell(`D${rowRaChoiC}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`D${rowRaChoiC}`).font = { name: "Times New Roman", size: 11, bold: true };

    // Chữ ký + ngày áp dụng
    const rowSign = offset + 23;
    ws.getCell(`A${rowSign}`).value = `Ngày áp dụng: ${ngayApDung}`;
    ws.getCell(`A${rowSign}`).font = { name: "Times New Roman", size: 11, bold: true, italic: true };

    ws.mergeCells(`E${rowSign}:H${rowSign}`);
    ws.getCell(`E${rowSign}`).value = `${truong}, ngày ${dayjs().format("DD")} tháng ${dayjs().format("MM")} năm ${dayjs().format("YYYY")}`;
    ws.getCell(`E${rowSign}`).alignment = { horizontal: "center" };
    ws.getCell(`E${rowSign}`).font = { name: "Times New Roman", size: 11, bold: true, italic: true };

    ws.mergeCells(`E${rowSign + 1}:H${rowSign + 1}`);
    ws.getCell(`E${rowSign + 1}`).value = "HIỆU TRƯỞNG";
    ws.getCell(`E${rowSign + 1}`).alignment = { horizontal: "center" };
    ws.getCell(`E${rowSign + 1}`).font = { name: "Times New Roman", size: 11, bold: true };

    ws.pageSetup = {
      paperSize: 9,
      orientation: "portrait",
      horizontalCentered: true
    };
  });

  // Ghi file Excel
  const buf = await workbook.xlsx.writeBuffer();
  const formattedDate = ngayApDung !== "…" ? ngayApDung.replace(/\//g, "-") : dayjs().format("DD-MM-YYYY");
  saveAs(new Blob([buf]), `TKB_GVCN_Ap dung ${formattedDate}.xlsx`);
};