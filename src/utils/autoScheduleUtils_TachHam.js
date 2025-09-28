// =========================
// Danh sách các ngày trong tuần
// =========================
export const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];


// =========================
// 1. Khởi tạo TKB rỗng cho giáo viên
// =========================
export const initTKB = (teachers, tkb = {}) => {
  teachers.forEach(t => {
    if (!tkb[t.id]) tkb[t.id] = {};
    days.forEach(d => {
      if (!tkb[t.id][d]) {
        tkb[t.id][d] = {
          morning: new Array(4).fill(null),
          afternoon: new Array(3).fill(null),
        };
      }
    });
  });
  return tkb;
};


// =========================
// 2. Khởi tạo assignments: GV – môn → danh sách lớp
// =========================
export const initAssignments = (teachers, assignments = {}) => {
  teachers.forEach(t => {
    if (!assignments[t.id]) assignments[t.id] = {};
    t.monDay.forEach(mon => {
      if (!assignments[t.id][mon]) {
        const lopPhanCong = Array.isArray(t.phanCong?.[mon]) ? t.phanCong[mon] : [];
        assignments[t.id][mon] = [...lopPhanCong];
      }
    });
  });
  return assignments;
};


// =========================
// 3. Kiểm tra giới hạn số tiết trong ngày
// =========================
export const checkClassLimit = (tkb, lop, day, mon, double = false) => {
  let count = 0;
  for (const gvId in tkb) {
    const buoiSang = tkb[gvId][day]?.morning || [];
    const buoiChieu = tkb[gvId][day]?.afternoon || [];
    [...buoiSang, ...buoiChieu].forEach(tiet => {
      if (tiet?.class === lop && tiet?.subject === mon) count++;
    });
  }
  const maxPerDay = 2;
  return count + (double ? 2 : 1) > maxPerDay;
};


// =========================
// 4. Kiểm tra ràng buộc khi xếp tiết
// =========================
export const violatesConstraints = ({
  day,
  session,
  period,
  mon,
  lop,
  gv,
  tkb,
  totalPeriodsMap
}) => {
  const ngayNghi = ["Thứ 7", "Chủ nhật"];
  if (ngayNghi.includes(day)) return true;

  // Không xếp sáng Thứ 6 cho Tiếng Anh
  if (mon === "Tiếng Anh" && day === "Thứ 6" && session === "morning") return true;

  // Không xếp tiết 1 sáng Thứ 2
  if (day === "Thứ 2" && session === "morning" && period === 0) return true;

  // ✅ Ưu tiên Tin học vào chiều, nếu còn slot
  if (mon === "Tin học") {
    const hasEmptyAfternoon = tkb[gv.id][day].afternoon.some(t => t === null);
    if (session === "morning" && hasEmptyAfternoon) return true;
  }

  // ✅ Các môn nhẹ tải (trừ Tiếng Anh) chỉ xếp buổi chiều
  const isLightSubject = totalPeriodsMap?.[gv.id] < 10 && mon !== "Tiếng Anh";
  if (isLightSubject && session === "morning") return true;

  // ✅ Nếu là môn nhẹ tải, mỗi buổi chiều tối đa 2 tiết
  if (isLightSubject && session === "afternoon") {
    const countInSession = tkb[gv.id][day][session].filter(
      t => t?.class === lop && t?.subject === mon
    ).length;
    if (countInSession >= 2) return true;
  }

  // ✅ Giới hạn số tiết/ngày theo môn
  const maxPerDay = ["Tin học", "Âm nhạc", "GDTC", "Mĩ thuật"].includes(mon) ? 2 : 2;
  const countInDay = [
    ...tkb[gv.id][day].morning,
    ...tkb[gv.id][day].afternoon
  ].filter(t => t?.class === lop && t?.subject === mon).length;

  if (countInDay >= maxPerDay) return true;

  return false;
};


// =========================
// 5. Kiểm tra có thể dùng tiết đôi
// =========================
export const shouldUseDoublePeriod = ({ mon, remaining, period, sessionArray, day, lop, tkb }) => {
  if (
    mon === "Tiếng Anh" &&
    remaining > 1 &&
    period < sessionArray.length - 1 &&
    !sessionArray[period + 1]
  ) {
    const exceedsLimit = checkClassLimit(tkb, lop, day, mon, true);
    return !exceedsLimit;
  }
  return false;
};


// =========================
// 6. Gán tiết vào slot
// =========================
export const assignToSlot = (
  tkb,
  globalSchedule,
  gvId,
  lop,
  mon,
  slot,
  double = false,
  assignments,
  teachers
) => {
  const { day, session, period } = slot;
  if (!Array.isArray(teachers)) return;

  const gv = teachers.find(t => t.id === gvId);
  if (!gv || !gv.monDay.includes(mon)) return;
  if (!assignments?.[gvId]?.[mon]?.includes(lop)) return;
  if (!tkb[gvId] || !tkb[gvId][day] || !tkb[gvId][day][session]) return;

  const sessionArray = tkb[gvId][day][session];

  if (period >= 0 && period < sessionArray.length) {
    sessionArray[period] = {
      period: period + 1,
      class: lop,
      subject: mon
    };
    globalSchedule[`${day}|${session}|${period}|${lop}`] = gvId;
  }

  if (double && period + 1 < sessionArray.length) {
    sessionArray[period + 1] = {
      period: period + 2,
      class: lop,
      subject: mon
    };
    globalSchedule[`${day}|${session}|${period + 1}|${lop}`] = gvId;
  }
};


// =========================
// 7. Slot cho GV dạy >10 tiết
// =========================
export const getAvailableSlotsCustom = (
  gvId,
  mon,
  lop,
  double,
  tkb,
  globalSchedule,
  teachers,
  assignments
) => {
  const gv = teachers.find(t => t.id === gvId);
  if (!gv || !gv.monDay.includes(mon) || !tkb[gvId]) return [];

  const slots = [];

  for (const day of days) {
    const morning = tkb[gvId][day].morning;
    const afternoon = tkb[gvId][day].afternoon;
    if (!Array.isArray(morning) || !Array.isArray(afternoon)) continue;

    const offMorning = gv.offTimes?.[day]?.morning ?? false;
    const offAfternoon = gv.offTimes?.[day]?.afternoon ?? false;

    if (!offMorning) {
      for (let i = 0; i < morning.length; i++) {
        if (!morning[i]) {
          if (double && i < morning.length - 1 && !morning[i + 1]) {
            slots.push({ day, session: "morning", period: i, lop, mon, double: true });
            i++;
          } else if (!double) {
            slots.push({ day, session: "morning", period: i, lop, mon });
          }
        }
      }
    }

    if (!offAfternoon) {
      for (let i = 0; i < afternoon.length; i++) {
        if (!afternoon[i]) {
          if (double && i < afternoon.length - 1 && !afternoon[i + 1]) {
            slots.push({ day, session: "afternoon", period: i, lop, mon, double: true });
            i++;
          } else if (!double) {
            slots.push({ day, session: "afternoon", period: i, lop, mon });
          }
        }
      }
    }
  }

  return slots;
};


// =========================
// 8. Slot cho GV dạy ≤10 tiết
// =========================
export const getAvailableSlotsLight = (
  gvId,
  mon,
  lop,
  tkb,
  globalSchedule,
  teachers,
  assignments
) => {
  const gv = teachers.find(t => t.id === gvId);
  if (!gv || !gv.monDay.includes(mon)) return [];
  if (!assignments?.[gvId]?.[mon]?.includes(lop)) return [];

  initTKB(teachers, tkb);
  if (!tkb[gvId]) return [];

  const slots = [];

  for (const day of days) {
    const afternoon = tkb[gvId][day].afternoon;
    if (!Array.isArray(afternoon)) continue;

    const offAfternoon = gv.offTimes?.[day]?.afternoon ?? false;
    if (offAfternoon) continue;

    const used = afternoon.filter(Boolean).length;
    if (used >= 2) continue;

    for (let i = 0; i < 3; i++) {
      if (!afternoon[i]) {
        slots.push({ day, session: "afternoon", period: i, lop, mon });
      }
    }
  }

  return slots;
};


// =========================
// 9. Hoán đổi để tối ưu TKB
// =========================
export const generateSwapCandidates = (tkb) => {
  const candidates = [];
  for (const gvId in tkb) {
    for (const day of days) {
      for (const session of ["morning", "afternoon"]) {
        const periods = tkb[gvId][day][session];
        for (let i = 0; i < periods.length; i++) {
          const tiet = periods[i];
          if (!tiet) continue;
          for (const otherGvId in tkb) {
            if (otherGvId === gvId) continue;
            const otherPeriods = tkb[otherGvId][day][session];
            for (let j = 0; j < otherPeriods.length; j++) {
              const otherTiet = otherPeriods[j];
              if (!otherTiet) continue;
              candidates.push({
                gvA: gvId,
                gvB: otherGvId,
                day,
                session,
                slotA: i,
                slotB: j
              });
            }
          }
        }
      }
    }
  }
  return candidates;
};

export const isValidSwap = (swap, globalSchedule, tkb, teachers, assignments) => {
  const { gvA, gvB, day, session, slotA, slotB } = swap;

  if (!tkb?.[gvA]?.[day]?.[session] || !tkb?.[gvB]?.[day]?.[session]) return false;
  if (!teachers || !assignments) return false;

  const tietA = tkb[gvA][day][session][slotA];
  const tietB = tkb[gvB][day][session][slotB];
  if (!tietA || !tietB) return false;

  const teacherA = teachers.find(t => t.id === gvA);
  const teacherB = teachers.find(t => t.id === gvB);
  if (!teacherA || !teacherB) return false;

  if (!teacherA.monDay.includes(tietB.subject)) return false;
  if (!assignments?.[gvA]?.[tietB.subject]?.includes(tietB.class)) return false;

  if (!teacherB.monDay.includes(tietA.subject)) return false;
  if (!assignments?.[gvB]?.[tietA.subject]?.includes(tietA.class)) return false;

  // ⚠️ Ràng buộc môn Tin học
  const isTinHocA = tietA.subject === "Tin học";
  const isTinHocB = tietB.subject === "Tin học";

  // Nếu chỉ một bên là Tin học → không swap
  if (isTinHocA !== isTinHocB) return false;

  // Nếu cả hai là Tin học → chỉ swap trong buổi chiều
  if (isTinHocA && session !== "afternoon") return false;

  // Nếu khác môn → không swap
  if (tietA.subject !== tietB.subject) return false;

  return true;
};

export const applySwap = (tkb, swap) => {
  const { gvA, gvB, day, session, slotA, slotB } = swap;
  const temp = tkb[gvA][day][session][slotA];
  tkb[gvA][day][session][slotA] = tkb[gvB][day][session][slotB];
  tkb[gvB][day][session][slotB] = temp;
};

export const optimizeSchedule = (tkb, globalSchedule) => {
  const swaps = generateSwapCandidates(tkb);
  for (const swap of swaps) {
    if (isValidSwap(swap, globalSchedule)) {
      applySwap(tkb, swap);
    }
  }
};