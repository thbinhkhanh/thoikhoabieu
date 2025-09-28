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
  return count >= maxPerDay;
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
  totalPeriodsMap,
  double = false
}) => {
  const gvId = gv?.id ?? gv;

  const ngayNghi = ["Thứ 7", "Chủ nhật"];
  if (ngayNghi.includes(day)) return true;

  if (gv?.offTimes?.[day]?.[session] === true) return true;

  // 🔹 Công nghệ: chỉ Thứ 6 (ưu tiên chiều đã xử lý ở scheduleCongNghe)
  if (mon === "Công nghệ" && day !== "Thứ 6") return true;

  // 🔹 Tin học: chỉ buổi chiều
  if (mon === "Tin học" && session === "morning") return true;

  // 🔹 Ví dụ: không xếp tiết 1 sáng Thứ 2
  if (day === "Thứ 2" && session === "morning" && period === 0) return true;

  // 🔹 Giới hạn số tiết trong ngày
  const countInDay = [
    ...(tkb[gvId]?.[day]?.morning || []),
    ...(tkb[gvId]?.[day]?.afternoon || [])
  ].filter(t => t?.class === lop && t?.subject === mon).length;

  if (double) {
    if (countInDay + 2 > 2) return true;
  } else {
    if (countInDay + 1 > 2) return true;
  }

  const sessionArray = tkb[gvId]?.[day]?.[session];
  if (!Array.isArray(sessionArray) || period < 0 || period >= sessionArray.length) return true;

  return false;
};


// =========================
// 5. Tiết đôi Tiếng Anh
// =========================
export const shouldUseDoublePeriod = ({ mon, remaining, period, sessionArray, day, lop, tkb }) => {
  if (mon !== "Tiếng Anh" || remaining < 2) return false;
  if (!Array.isArray(sessionArray)) return false;
  if (period >= sessionArray.length - 1) return false;
  if (sessionArray[period] || sessionArray[period + 1]) return false;

  const isMiddlePeriod = period === 1 || period === 2;
  const exceedsLimit = checkClassLimit(tkb, lop, day, mon, true);
  if (exceedsLimit) return false;

  return true;
};

export const isValidDoublePeriod = (sessionArray, i) => {
  if (!Array.isArray(sessionArray)) return false;
  if (typeof i === "number") {
    if (i < 0 || i >= sessionArray.length - 1) return false;
    const a = sessionArray[i];
    const b = sessionArray[i + 1];
    return (
      a && b &&
      a.subject === "Tiếng Anh" &&
      b.subject === "Tiếng Anh" &&
      a.class === b.class
    );
  }
  for (let k = 0; k < sessionArray.length - 1; k++) {
    const a = sessionArray[k], b = sessionArray[k + 1];
    if (a && b && a.subject === "Tiếng Anh" && b.subject === "Tiếng Anh" && a.class === b.class) return true;
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
  if (!Array.isArray(teachers)) return false;

  const gvObj = teachers.find(t => t.id === gvId);
  if (!gvObj || !gvObj.monDay.includes(mon)) return false;
  if (!assignments?.[gvId]?.[mon]?.includes(lop)) return false;
  if (!tkb[gvId] || !tkb[gvId][day] || !tkb[gvId][day][session]) return false;

  const sessionArray = tkb[gvId][day][session];
  if (period < 0 || period >= sessionArray.length) return false;

  if (hasConflict({ day, session, period, lop, gv: gvId, tkb })) return false;

  if (double) {
    if (period + 1 >= sessionArray.length) return false;
    if (sessionArray[period] || sessionArray[period + 1]) return false;
    if (hasConflict({ day, session, period: period + 1, lop, gv: gvId, tkb })) return false;
  } else {
    if (sessionArray[period]) return false;
  }

  sessionArray[period] = { subject: mon, class: lop, period: period + 1 };
  globalSchedule[`${day}|${session}|${period}|${lop}`] = gvId;

  if (double) {
    sessionArray[period + 1] = { subject: mon, class: lop, skip: true, period: period + 2 };
    globalSchedule[`${day}|${session}|${period + 1}|${lop}`] = gvId;
  }

  return true;
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
  assignments,
  totalPeriodsMap
) => {
  const gv = teachers.find(t => t.id === gvId);
  if (!gv || !gv.monDay.includes(mon) || !tkb[gvId]) return [];

  const slots = [];

  for (const day of days) {
    const morning = tkb[gvId][day].morning;
    const afternoon = tkb[gvId][day].afternoon;
    if (!Array.isArray(morning) || !Array.isArray(afternoon)) continue;

    const offMorning = gv.offTimes?.[day]?.morning === true;
    const offAfternoon = gv.offTimes?.[day]?.afternoon === true;

    if (!offMorning) {
      for (let i = 0; i < morning.length; i++) {
        if (!morning[i]) {
          const conflict1 = hasConflict({ day, session: "morning", period: i, lop, gv, tkb });
          const violates1 = violatesConstraints({ day, session: "morning", period: i, mon, lop, gv, tkb, totalPeriodsMap });
          if (conflict1 || violates1) continue;

          if (double && i < morning.length - 1 && !morning[i + 1]) {
            const conflict2 = hasConflict({ day, session: "morning", period: i + 1, lop, gv, tkb });
            const violates2 = violatesConstraints({ day, session: "morning", period: i + 1, mon, lop, gv, tkb, totalPeriodsMap });
            if (conflict2 || violates2) continue;

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
          const conflict1 = hasConflict({ day, session: "afternoon", period: i, lop, gv, tkb });
          const violates1 = violatesConstraints({ day, session: "afternoon", period: i, mon, lop, gv, tkb, totalPeriodsMap });
          if (conflict1 || violates1) continue;

          if (double && i < afternoon.length - 1 && !afternoon[i + 1]) {
            const conflict2 = hasConflict({ day, session: "afternoon", period: i + 1, lop, gv, tkb });
            const violates2 = violatesConstraints({ day, session: "afternoon", period: i + 1, mon, lop, gv, tkb, totalPeriodsMap });
            if (conflict2 || violates2) continue;

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
        const conflict = hasConflict({ day, session: "afternoon", period: i, lop, gv, tkb });
        if (!conflict) {
          slots.push({ day, session: "afternoon", period: i, lop, mon });
        }
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
  const bannedSubjects = ["Tin học", "Công nghệ"];

  for (const gvId in tkb) {
    for (const day of days) {
      for (const session of ["morning", "afternoon"]) {
        const periods = tkb[gvId][day][session];
        for (let i = 0; i < periods.length; i++) {
          const tiet = periods[i];
          if (!tiet) continue;
          if (bannedSubjects.includes(tiet.subject)) continue;

          for (const otherGvId in tkb) {
            if (otherGvId === gvId) continue;
            const otherPeriods = tkb[otherGvId][day][session];
            for (let j = 0; j < otherPeriods.length; j++) {
              const otherTiet = otherPeriods[j];
              if (!otherTiet) continue;
              if (bannedSubjects.includes(otherTiet.subject)) continue;

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

  if (tietA.subject !== tietB.subject) return false;

  if (tietA.subject === "Tin học" && session !== "afternoon") return false;

  applySwap(tkb, swap);
  const conflictAfterA = hasConflict({ day, session, period: slotA, lop: tietB.class, gv: gvA, tkb });
  const conflictAfterB = hasConflict({ day, session, period: slotB, lop: tietA.class, gv: gvB, tkb });
  applySwap(tkb, swap);

  if (conflictAfterA || conflictAfterB) return false;

  return true;
};

export const applySwap = (tkb, swap) => {
  const { gvA, gvB, day, session, slotA, slotB } = swap;
  const temp = tkb[gvA][day][session][slotA];
  tkb[gvA][day][session][slotA] = tkb[gvB][day][session][slotB];
  tkb[gvB][day][session][slotB] = temp;
};

export const optimizeSchedule = (tkb, globalSchedule, teachers, assignments) => {
  const swaps = generateSwapCandidates(tkb);
  for (const swap of swaps) {
    if (!isValidSwap(swap, globalSchedule, tkb, teachers, assignments)) continue;
    applySwap(tkb, swap);
  }
};


// =========================
// 10. Conflict
// =========================
export const hasConflict = ({ day, session, period, lop, gv, tkb }) => {
  const gvId = gv?.id ?? gv;
  if (!tkb) return true;

  for (const otherGvId in tkb) {
    if (String(otherGvId) === String(gvId)) continue;
    const slot = tkb[otherGvId]?.[day]?.[session]?.[period];
    if (slot?.class === lop) return true;
  }

  const slot = tkb[gvId]?.[day]?.[session]?.[period];
  if (slot && slot.class !== lop) return true;

  return false;
};

export const resolveConflicts = (tkb, teachers, globalSchedule) => {
  const conflicts = [];

  for (const gv of teachers) {
    for (const day of Object.keys(tkb[gv.id] || {})) {
      for (const session of ["morning", "afternoon"]) {
        const periods = tkb[gv.id][day][session];
        for (let i = 0; i < periods.length; i++) {
          const slot = periods[i];
          if (!slot) continue;

          const conflict = hasConflict({
            day,
            session,
            period: i,
            lop: slot.class,
            gv,
            tkb
          });

          if (conflict) {
            conflicts.push({ gvId: gv.id, day, session, period: i, class: slot.class });
            tkb[gv.id][day][session][i] = null;
            delete globalSchedule[`${day}|${session}|${i}|${slot.class}`];
          }
        }
      }
    }
  }

  return conflicts;
};
