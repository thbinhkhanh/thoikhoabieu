import { doc, getDoc } from "firebase/firestore"; 
import { db } from "../firebase";
import dayjs from "dayjs";

export const printAllTeachersTKB = async (tkb, teachers, vietTatMon = {}) => {
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
  const sessionMap = { sáng:"morning", chiều:"afternoon" };
  const teachingRowIdx = { sáng:[1,2,4,5], chiều:[0,1,3,4] };
  const dayKeyCandidates = [
    ["hai","thu2","t2","2"],["ba","thu3","t3","3"],["tư","tu","thu4","t4","tu4","4"],
    ["năm","nam","thu5","t5","5"],["sáu","sau","thu6","t6","6"]
  ];

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
      ["morning","afternoon"].forEach(s=>(daySch[s]||[]).forEach(p=>{ if(p?.subject) subjects.add(p.subject); }));
    });
    return subjects.size || (teacher.subject?1:0);
  };

  const formatPeriodLabel = (tiet, teacherSubjectCount)=>{
    if(!tiet) return "";
    const classLabel = tiet.class || tiet.lop || tiet.className || "";
    const subjFull = tiet.subject || "";
    const subjAbbr = vietTatMon[subjFull]||subjFull||"";
    if(teacherSubjectCount<=1) return classLabel||"";
    if(subjAbbr==="TH") return classLabel||"";
    return subjAbbr?`${classLabel} (${subjAbbr})`:classLabel;
  };

  let html = `
    <html>
      <head>
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

  // Hàm lấy chữ cuối tên GV
  const lastName = (full) => {
    const parts = (full || "").trim().split(" ");
    return parts[parts.length - 1] || "";
  };

  // 👉 Sắp xếp danh sách GV
  const sortedTeachers = [...teachers].sort((a, b) => {
    const subjA = (a.monDay?.[0] || "").trim();
    const subjB = (b.monDay?.[0] || "").trim();

    const cmpSubj = subjA.localeCompare(subjB, "vi", { sensitivity: "base" });
    if (cmpSubj !== 0) return cmpSubj;

    return lastName(a.name).localeCompare(lastName(b.name), "vi", { sensitivity: "base" });
  });

  // 👉 In theo thứ tự đã sắp xếp
  sortedTeachers.forEach((teacher) => {
    const gvId = teacher.gvId || teacher.id;
    const tkbOfGv = tkb[gvId] || {};
    const teacherSubjectCount = countTeacherSubjects(teacher, tkbOfGv);

    let totalLessons = 0;
    ["sáng", "chiều"].forEach((session) => {
      const sessionKey = sessionMap[session];
      const rowDefs = session === "sáng" ? buoiSang : buoiChieu;
      const teacherSubjectCount = countTeacherSubjects(teacher, tkbOfGv);

      rowDefs.forEach((period, rowIdx) => {
        const posInTeaching = teachingRowIdx[session].indexOf(rowIdx);
        weekdays.forEach((_, dayIdx) => {
          const dayKey = pickDayKey(tkbOfGv, dayIdx);
          const periods = (dayKey && tkbOfGv[dayKey]?.[sessionKey]) || [];
          const cell = posInTeaching !== -1 ? periods[posInTeaching] : null;
          const label = formatPeriodLabel(cell, teacherSubjectCount);
          if (label) totalLessons++;
        });
      });
    });

    const monHocSet = new Set();
    Object.values(tkbOfGv).forEach((daySch) => {
      ["morning", "afternoon"].forEach((s) =>
        (daySch[s] || []).forEach((p) => {
          if (p?.subject) monHocSet.add(p.subject);
        })
      );
    });
    const monHoc = Array.from(monHocSet).join(", ").toUpperCase() || "…";

    html += `<div style="page-break-after: always;">
      <table>
        <tr><td colspan="8" class="bold left">${`ỦY BAN NHÂN DÂN ${ubnd}`.toUpperCase()}</td></tr>
        <tr><td colspan="8" class="bold left">${`TRƯỜNG TIỂU HỌC ${truong}`.toUpperCase()}</td></tr>
        <tr><td colspan="8"></td></tr>
        <tr><td colspan="8" class="center bold" style="font-size:16pt;">THỜI KHÓA BIỂU MÔN ${monHoc}</td></tr>
        <tr><td colspan="8" class="center">NĂM HỌC: ${namHoc}</td></tr>
        <tr><td colspan="8"></td></tr>
        <tr>
          <td colspan="4" class="bold left">GVBM: ${teacher.name?.toUpperCase() || ""}</td>
          <td colspan="4" class="bold right">Tổng số tiết: ${totalLessons}</td>
        </tr>
      </table>
    `;

    html += `<table class="bordered">
      <tr>
        <th>BUỔI</th><th>TIẾT</th><th>THỜI GIAN</th>
        ${weekdays.map((d) => `<th>${d}</th>`).join("")}
      </tr>`;

    ["sáng", "chiều"].forEach((session, sessionIdx) => {
      const sessionKey = sessionMap[session];
      const rowDefs = session === "sáng" ? buoiSang : buoiChieu;
      const startRow = sessionIdx === 0 ? 2 : 9;
      const endRow = startRow + rowDefs.length;
      html += `<tr>
        <td rowspan="${endRow - startRow + 1}" class="center bold">${session.toUpperCase()}</td>
      </tr>`;

      rowDefs.forEach((period, rowIdx) => {
        const posInTeaching = teachingRowIdx[session].indexOf(rowIdx);
        html += `<tr>
          <td>${period.tiet || ""}</td>
          <td>${period.gio || ""}</td>
          ${weekdays
            .map((_, dayIdx) => {
              const dayKey = pickDayKey(tkbOfGv, dayIdx);
              const periods = (dayKey && tkbOfGv[dayKey]?.[sessionKey]) || [];
              const cell = posInTeaching !== -1 ? periods[posInTeaching] : null;
              const label = formatPeriodLabel(cell, teacherSubjectCount);
              return `<td>${label}</td>`;
            })
            .join("")}
        </tr>`;
      });
    });

    html += `</table>`;
    html += `
    <table style="width:100%; border-collapse: collapse; margin-top:5px;">
      <tr>
        <td style="width:50%;" class="left">
          <em>Ngày áp dụng: ${ngayApDung ? dayjs(ngayApDung).format("DD/MM/YYYY") : "…"}</em>
        </td>
        <td style="width:50%;" class="right">
          <em>${truong}, ngày ${dayjs().format("DD")} tháng ${dayjs().format("MM")} năm ${dayjs().format("YYYY")}</em>
        </td>
      </tr>
      <tr>
        <td></td>
        <td style="text-align:right; font-weight:bold;">
          HIỆU TRƯỞNG&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </td>
      </tr>
    </table>
    </div>`;
  });


  html += `</body></html>`;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
