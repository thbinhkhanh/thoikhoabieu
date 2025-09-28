// src/utils/exportExcel.js
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export const exportAllTeachersToExcel = async (tkb, teachers, vietTatMon = {}) => {
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
  } catch (err) {
    console.error("❌ Lỗi fetch thông tin:", err);
  }

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

  if (!buoiSang.length && !buoiChieu.length) {
    throw new Error("Thiếu dữ liệu thời gian học từ Firestore");
  }

  const workbook = new ExcelJS.Workbook();
  const weekdays = ["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6"];
  const dayKeyCandidates = [
    ["hai","thu2","t2","2"],
    ["ba","thu3","t3","3"],
    ["tư","tu","thu4","t4","tu4","4"],
    ["năm","nam","thu5","t5","5"],
    ["sáu","sau","thu6","t6","6"]
  ];
  const sessionMap = { sáng:"morning", chiều:"afternoon" };
  const teachingRowIdx = { sáng:[1,2,4,5], chiều:[0,1,3,4] };

  const pickDayKey = (tkbOfGv={}, dayIdx)=>{
    const keys = Object.keys(tkbOfGv||{});
    for(const cand of dayKeyCandidates[dayIdx]){
      const k = keys.find(x=>x && x.toLowerCase()===cand);
      if(k) return k;
    }
    return keys[dayIdx]||null;
  };

  const countTeacherSubjects = (teacher, tkbOfGv)=>{
    if(teacher?.monDay?.length>0) return teacher.monDay.length;
    const subjects = new Set();
    Object.values(tkbOfGv||{}).forEach(daySch=>{
      if(!daySch) return;
      ["morning","afternoon"].forEach(s=>(daySch[s]||[]).forEach(p=>{ if(p?.subject) subjects.add(p.subject); }));
    });
    return subjects.size || (teacher.subject?1:0);
  };

  const formatPeriodLabel = (tiet, teacher, teacherSubjectCount)=>{
    if(!tiet) return "";
    const classLabel = tiet.class || tiet.lop || tiet.className || "";
    const subjFull = tiet.subject || "";
    const subjAbbr = vietTatMon[subjFull]||subjFull||"";
    if(teacherSubjectCount<=1) return classLabel||"";
    if(subjAbbr==="TH") return classLabel||"";
    return subjAbbr?`${classLabel} (${subjAbbr})`:classLabel;
  };

  // Lấy chữ cuối trong tên GV
const lastName = (full = "") => {
  const parts = full.trim().split(" ");
  return parts[parts.length - 1] || "";
};

// Sắp xếp: theo môn trước, rồi theo tên cuối
const sortedTeachers = [...teachers].sort((a, b) => {
  const subjA = (a.monDay?.[0] || "").trim();
  const subjB = (b.monDay?.[0] || "").trim();

  const cmpSubj = subjA.localeCompare(subjB, "vi", { sensitivity: "base" });
  if (cmpSubj !== 0) return cmpSubj;

  return lastName(a.name).localeCompare(lastName(b.name), "vi", { sensitivity: "base" });
});

  // ===== Sheet duy nhất =====
  const ws = workbook.addWorksheet("TKB Toàn Trường");
  const colWidths=[8.17,8.17,15.17,11.17,11.17,11.17,11.17,11.17];

  sortedTeachers.forEach((teacher, index) => {
    const offset=index*47;
    const gvId = teacher.gvId||teacher.id;
    const tkbOfGv = tkb[gvId]||{};
    let totalLessons=0;

    // Dòng UBND (1) + offset
    ws.mergeCells(`A${1+offset}:D${1+offset}`);
    ws.getCell(`A${1+offset}`).value=`ỦY BAN NHÂN DÂN ${ubnd}`.toUpperCase();
    ws.getCell(`A${1+offset}`).alignment={horizontal:"center"};
    ws.getCell(`A${1+offset}`).font={name:"Times New Roman",size:11,bold:true};

    // Dòng Trường Tiểu học (2) + offset
    ws.mergeCells(`A${2+offset}:D${2+offset}`);
    ws.getCell(`A${2+offset}`).value=`TRƯỜNG TIỂU HỌC ${truong}`.toUpperCase();
    ws.getCell(`A${2+offset}`).alignment={horizontal:"center"};
    ws.getCell(`A${2+offset}`).font={name:"Times New Roman",size:11,bold:true};

    // THỜI KHÓA BIỂU MÔN (4) + offset
    const rowMonHoc=4+offset;
    const monHocSet = new Set();
    Object.values(tkbOfGv).forEach(daySch=>["morning","afternoon"].forEach(s=>(daySch[s]||[]).forEach(p=>{ if(p?.subject) monHocSet.add(p.subject); })));
    const monHoc=Array.from(monHocSet).join(", ").toUpperCase()||"…";
    ws.mergeCells(`A${rowMonHoc}:H${rowMonHoc}`);
    ws.getCell(`A${rowMonHoc}`).value=`THỜI KHÓA BIỂU MÔN ${monHoc}`;
    ws.getCell(`A${rowMonHoc}`).alignment={horizontal:"center"};
    ws.getCell(`A${rowMonHoc}`).font={name:"Times New Roman",size:monHoc==="GDTC"?16:14,bold:true};

    // NĂM HỌC (5) + offset
    const rowNamHoc = 5 + offset;
    ws.mergeCells(`A${rowNamHoc}:H${rowNamHoc}`);
    ws.getCell(`A${rowNamHoc}`).value = `NĂM HỌC: ${namHoc}`;
    ws.getCell(`A${rowNamHoc}`).alignment = { horizontal: "center" };
    ws.getCell(`A${rowNamHoc}`).font = { name: "Times New Roman", size: 13 };

    // Tên GV + Tổng số tiết (7) + offset
    const rowInfo=7+offset;
    ws.getCell(`A${rowInfo}`).value="GVBM:";
    ws.getCell(`B${rowInfo}`).value=(teacher.name||"").toUpperCase();
    ws.getCell(`A${rowInfo}`).font={name:"Times New Roman",size:11};
    ws.getCell(`B${rowInfo}`).font={name:"Times New Roman",size:11,bold:true};
    ws.mergeCells(`G${rowInfo}:H${rowInfo}`);
    ws.getCell(`G${rowInfo}`).value=`Tổng số tiết: 0`;
    ws.getCell(`G${rowInfo}`).font={name:"Times New Roman",size:11,bold:true};
    ws.getCell(`G${rowInfo}`).alignment={horizontal:"right"};

    // Header bảng (9) + offset
    const rowHeader=9+offset;
    const header=["BUỔI","TIẾT","THỜI GIAN",...weekdays].map(h=>h.toUpperCase());
    const headerRow=ws.insertRow(rowHeader,header);
    headerRow.eachCell(cell=>{ cell.font={name:"Times New Roman",size:11,bold:true}; cell.alignment={horizontal:"center",vertical:"middle"}; });
    ws.columns=colWidths.map(w=>({width:w}));

    const sectionRowRanges={};
    let currentRow=rowHeader+1;

    for(const session of ["sáng","chiều"]){
      const sessionKey=sessionMap[session];
      const rowDefs=session==="sáng"?buoiSang:buoiChieu;
      const teacherSubjectCount=countTeacherSubjects(teacher,tkbOfGv);
      const startSessionRow=currentRow;

      rowDefs.forEach((period,timeRowIdx)=>{
        const tiet=period?.tiet||"";
        const gio=period?.gio||"";
        const tietLabel=["Truy bài","Ra chơi"].includes(tiet)?"":tiet;
        const row=[session.toUpperCase(),tietLabel,gio];
        const posInTeaching=teachingRowIdx[session].indexOf(timeRowIdx);

        weekdays.forEach((_,dayIdx)=>{
          const dayKey=pickDayKey(tkbOfGv,dayIdx);
          const periods=(dayKey && tkbOfGv[dayKey]?.[sessionKey])||[];
          const cellValue=posInTeaching!==-1?formatPeriodLabel(periods[posInTeaching],teacher,teacherSubjectCount):"";
          if(cellValue) totalLessons++;
          row.push(cellValue);
        });

        ws.addRow(row);
        currentRow++;
      });
      sectionRowRanges[session]=[startSessionRow,currentRow-1];
    }

    ws.getCell(`G${rowInfo}`).value=`Tổng số tiết: ${totalLessons}`;

    // Viền + merge buổi
    const colCount=header.length;
    for(let r=rowHeader;r<currentRow;r++){
      ws.getRow(r).height=27;
      for(let c=1;c<=colCount;c++){
        const cell=ws.getCell(r,c);
        cell.font={name:"Times New Roman",size:11,bold:r===rowHeader};
        cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
        cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}};
      }
    }
    for(const [session,[startR,endR]] of Object.entries(sectionRowRanges)){
      ws.mergeCells(`A${startR}:A${endR}`);
      ws.getCell(`A${startR}`).value=session.toUpperCase();
      ws.getCell(`A${startR}`).alignment={vertical:"middle",horizontal:"center"};
      ws.getCell(`A${startR}`).font={name:"Times New Roman",size:11,bold:true};
    }

    // TRUY BÀI (10) + offset
    const rowTruyBai = 10 + offset; // hàng 10 + offset
    ws.mergeCells(`D${rowTruyBai}:H${rowTruyBai}`); // merge từ D đến H (có thể thay H bằng cột cuối nếu muốn)
    ws.getCell(`D${rowTruyBai}`).value = "TRUY BÀI";
    ws.getCell(`D${rowTruyBai}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`D${rowTruyBai}`).font = { name: "Times New Roman", size: 11, bold: true };

    // RA CHƠI (13) + offset
    const rowRaChoiS = 13 + offset; // hàng 39 + offset
    ws.mergeCells(`D${rowRaChoiS}:H${rowRaChoiS}`); // merge từ D đến H (có thể thay H bằng cột cuối nếu muốn)
    ws.getCell(`D${rowRaChoiS}`).value = "RA CHƠI";
    ws.getCell(`D${rowRaChoiS}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`D${rowRaChoiS}`).font = { name: "Times New Roman", size: 11, bold: true };

    // RA CHƠI (19) + offset
    const rowRaChoiC = 19 + offset; // hàng 19 + offset
    ws.mergeCells(`D${rowRaChoiC}:H${rowRaChoiC}`); // merge từ D đến H (có thể thay H bằng cột cuối nếu muốn)
    ws.getCell(`D${rowRaChoiC}`).value = "RA CHƠI";
    ws.getCell(`D${rowRaChoiC}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`D${rowRaChoiC}`).font = { name: "Times New Roman", size: 11, bold: true };


    // Chữ ký + ngày áp dụng (23) + offset
    const rowSign=23+offset;
    ws.getCell(`A${rowSign}`).value=`Ngày áp dụng: ${ngayApDung?dayjs(ngayApDung).format("DD/MM/YYYY"):"…"}`;
    ws.getCell(`A${rowSign}`).font={name:"Times New Roman",size:11,bold:true,italic:true};
    ws.mergeCells(`E${rowSign}:H${rowSign}`);
    ws.getCell(`E${rowSign}`).value=`${truong}, ngày ${dayjs().format("DD")} tháng ${dayjs().format("MM")} năm ${dayjs().format("YYYY")}`;
    ws.getCell(`E${rowSign}`).alignment={horizontal:"center"};
    ws.getCell(`E${rowSign}`).font={name:"Times New Roman",size:11,bold:true,italic:true};
    ws.mergeCells(`E${rowSign+1}:H${rowSign+1}`);
    ws.getCell(`E${rowSign+1}`).value="HIỆU TRƯỞNG";
    ws.getCell(`E${rowSign+1}`).alignment={horizontal:"center"};
    ws.getCell(`E${rowSign+1}`).font={name:"Times New Roman",size:11,bold:true};

    ws.pageSetup = {
      paperSize: 9,           // A4
      orientation: "portrait",
      horizontalCentered: true,
      //fitToPage: true         // tắt fitToPage
    };
  });

  const buf = await workbook.xlsx.writeBuffer();
  const formattedDate = ngayApDung ? dayjs(ngayApDung).format("DD-MM-YYYY") : dayjs().format("DD-MM-YYYY");
  saveAs(new Blob([buf]), `TKB_GVBM_Ap dung ${formattedDate}.xlsx`);
};
