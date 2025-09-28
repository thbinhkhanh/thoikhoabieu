import { violatesConstraints, assignToSlot } from './autoScheduleUtils';

// =======================
// 1️⃣ Hàm countClassInDay
export function countClassInDay(tkb, gvId, day, className, subject) {
  const daySchedule = tkb?.[gvId]?.[day];
  if (!daySchedule) return 0;

  const periods = [...(daySchedule.morning || []), ...(daySchedule.afternoon || [])];

  return periods.filter(
    period => period && period.subject === subject && period.class === className
  ).length;
}

// =======================
// 2️⃣ Hàm tryPlaceSingleAt
export function tryPlaceSingleAt({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lop,
  subject = "Âm nhạc",
  assignments,
  teachers
}) {
  const sessionArray = tkb?.[gvId]?.[day]?.[session];
  if (!Array.isArray(sessionArray)) return false;
  if (period < 0 || period >= sessionArray.length) return false;
  if (sessionArray[period]) return false;

  const violates = violatesConstraints({
    day,
    session,
    period,
    mon: subject,
    lop,
    gv: { id: gvId },
    tkb
  });
  if (violates) return false;

  const countInDay = countClassInDay(tkb, gvId, day, lop, subject);
  if (countInDay + 1 > 1) return false;

  const ok = assignToSlot(
    tkb,
    globalSchedule,
    gvId,
    lop,
    subject,
    { day, session, period },
    false,
    assignments,
    teachers
  );

  return !!ok;
}

// =======================
// 3️⃣ Hàm trySwapAndAssign
export function trySwapAndAssign({
  gv,
  lop,
  day,
  session,
  period,
  subject,
  newTkb,
  globalSchedule,
  assignments,
  gvList
}) {
  const sessionArray = newTkb?.[gv.id]?.[day]?.[session];
  if (!Array.isArray(sessionArray)) return false;
  if (sessionArray[period]) return false;

  for (const d2 of Object.keys(newTkb[gv.id])) {
    for (const s2 of ["morning", "afternoon"]) {
      const arr2 = newTkb[gv.id][d2][s2];
      if (!Array.isArray(arr2)) continue;

      for (let k = 0; k < arr2.length; k++) {
        const current = arr2[k];
        if (!current || current.subject !== subject || current.class === lop) continue;

        const canSwap = !violatesConstraints({
          day,
          session,
          period,
          mon: subject,
          lop: current.class,
          gv,
          tkb: newTkb
        });

        if (canSwap) {
          sessionArray[period] = current;
          arr2[k] = null;

          const canAssign = !violatesConstraints({
            day: d2,
            session: s2,
            period: k,
            mon: subject,
            lop,
            gv,
            tkb: newTkb
          });

          if (canAssign) {
            assignToSlot(
              newTkb,
              globalSchedule,
              gv.id,
              lop,
              subject,
              { day: d2, session: s2, period: k },
              false,
              assignments,
              gvList
            );
            return true;
          }

          // Hoàn tác nếu không hợp lệ
          arr2[k] = current;
          sessionArray[period] = null;
        }
      }
    }
  }

  return false;
}


export const scheduleLightSubjects = ({
  gvList = [],
  newTkb,
  globalSchedule,
  phanCongGVs,
  assignments,
  gvSummary,
  days,
  lightSubjects = ["Âm nhạc", "Mĩ thuật", "GDTC", "Đạo đức", "Đọc sách"]
}) => {
  for (const subject of lightSubjects) {
    for (const gv of gvList) {
      if (!gv.monDay.includes(subject)) continue;

      const lopList = assignments[gv.id]?.[subject] || [];
      if (!lopList.length) continue;

      const remainingMap = {};
      lopList.forEach(lop => {
        const count = phanCongGVs[gv.id]?.[subject]?.[lop] || 0;
        if (count > 0 && count < 10) {
          remainingMap[lop] = count;
        }
      });

      let A = Object.keys(remainingMap);
      if (!A.length) continue;

      for (const day of days) {
        const sessionArray = newTkb[gv.id][day]?.afternoon;
        if (!Array.isArray(sessionArray)) continue;

        let slotsUsed = 0;

        for (let i = 0; i < sessionArray.length; i++) {
          if (slotsUsed >= 2) break;
          if (sessionArray[i]) continue;

          const candidates = A.filter(lop =>
            remainingMap[lop] > 0 &&
            countClassInDay(newTkb, gv.id, day, lop, subject) < 1 &&
            !violatesConstraints({
              day,
              session: "afternoon",
              period: i,
              mon: subject,
              lop,
              gv,
              tkb: newTkb
            })
          );

          if (candidates.length > 0) {
            const lop = candidates[0];
            const placed = tryPlaceSingleAt({
              tkb: newTkb,
              globalSchedule,
              gvId: gv.id,
              day,
              session: "afternoon",
              period: i,
              lop,
              subject,
              assignments,
              teachers: gvList
            });

            if (placed) {
              remainingMap[lop] -= 1;
              slotsUsed += 1;
              if (remainingMap[lop] === 0) {
                A = A.filter(l => l !== lop);
              }
            }
          }
        }

        if (A.length === 0) break;
      }

      if (!gvSummary[gv.id]) gvSummary[gv.id] = { assigned: 0, failedLops: [] };
      Object.entries(remainingMap).forEach(([lop, remaining]) => {
        if (remaining > 0) {
          const tag = `${lop} - ${subject}`;
          if (!gvSummary[gv.id].failedLops.includes(tag)) {
            gvSummary[gv.id].failedLops.push(tag);
          }
        }
      });
    }
  }

  // ✅ THÊM RETURN ĐỂ TRẢ VỀ KẾT QUẢ CHO PIPELINE
  return {
    newTkb,
    gvList,
    gvSummary,
    assignments,
    globalSchedule,
    days,
    lightSubjects
  };
};

/**
 * 🔄 Điều chỉnh lại lịch dạy cho các môn nhẹ (số tiết < 10, ví dụ Âm nhạc, Mĩ thuật, GDTC...)
 * - Chỉ xếp vào buổi chiều (afternoon)
 * - Mỗi buổi chỉ xếp tối đa 2 tiết
 * - Không gom nhóm, không tối ưu, chỉ cố gắng lấp các tiết còn thiếu
 */
function restructureLightSubjectSchedule({
  newTkb,
  gv,
  remainingMap,
  lopList,
  assignments,
  gvList,
  globalSchedule,
  days,
  subject = "Âm nhạc"
}) {
  const sessionOrder = ["afternoon"]; // Chỉ xếp buổi chiều

  for (const day of days) {
    for (const session of sessionOrder) {
      const sessionArray = newTkb[gv.id][day][session];
      if (!Array.isArray(sessionArray)) continue;

      let slotsUsed = 0;

      for (let i = 0; i < sessionArray.length; i++) {
        if (slotsUsed >= 2) break;
        if (sessionArray[i]) continue;

        const candidates = lopList.filter(lop =>
          remainingMap[lop] > 0 &&
          countClassInDay(newTkb, gv.id, day, lop, subject) < 1 &&
          !violatesConstraints({
            day,
            session,
            period: i,
            mon: subject,
            lop,
            gv,
            tkb: newTkb
          })
        );

        if (candidates.length > 0) {
          const lop = candidates[0];
          const placed = tryPlaceSingleAt({
            tkb: newTkb,
            globalSchedule,
            gvId: gv.id,
            day,
            session,
            period: i,
            lop,
            subject,
            assignments,
            teachers: gvList
          });

          if (placed) {
            remainingMap[lop] -= 1;
            slotsUsed += 1;
            if (remainingMap[lop] === 0) {
              lopList = lopList.filter(l => l !== lop);
            }
          }
        }

        if (Object.values(remainingMap).every(r => r === 0)) return;
      }

      if (Object.values(remainingMap).every(r => r === 0)) return;
    }

    if (Object.values(remainingMap).every(r => r === 0)) return;
  }
}

/**
 * 📊 Đếm số tiết của một lớp (lop) thuộc một môn (mon) đã được xếp vào buổi chiều (afternoon) trong một ngày
 * - Dùng để kiểm tra xem lớp đã có tiết môn đó trong buổi chiều chưa
 * - Phục vụ cho việc xếp các môn nhẹ như Âm nhạc, Mĩ thuật, GDTC...
 */
const countClassInAfternoon = (tkb, gvId, day, lop, mon) => {
  const periods = tkb[gvId]?.[day]?.["afternoon"] || [];
  let count = 0;

  for (const slot of periods) {
    if (slot?.class === lop && slot?.subject === mon) {
      count++;
    }
  }

  return count;
};




/**
 * 📊 Đếm số tiết của một lớp (className) thuộc một môn (subject) đã được xếp vào buổi chiều (afternoon) trong một ngày
 * - Dùng để kiểm tra xem lớp đã có tiết môn đó trong buổi chiều chưa
 * - Phục vụ cho việc xếp các môn nhẹ như Âm nhạc, Mĩ thuật, GDTC...
 */
export const countClassInAfternoonBySubject = (
  tkb,
  gvId,
  day,
  className,
  subject = "Âm nhạc"
) => {
  const afternoonSlots = tkb[gvId]?.[day]?.afternoon || [];

  return afternoonSlots.filter(
    t => t && t.subject === subject && t.class === className
  ).length;
};

/**
 * 🧩 Thử xếp một tiết của môn nhẹ (subject) vào một ô cụ thể trong thời khóa biểu
 * - Chỉ xếp nếu ô trống, không vi phạm ràng buộc
 * - Chỉ xếp nếu lớp chưa có tiết môn đó trong buổi chiều hôm đó
 * - Dùng cho các môn nhẹ như Âm nhạc, Mĩ thuật, GDTC...
 */
export const tryPlaceSingleLightSubject = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lop,
  subject = "Âm nhạc",
  assignments,
  teachers
}) => {
  // Chỉ cho phép xếp buổi chiều
  if (session !== "afternoon") return false;

  const sessionArray = tkb[gvId]?.[day]?.[session];
  if (!Array.isArray(sessionArray)) return false;
  if (period < 0 || period >= sessionArray.length) return false;
  if (sessionArray[period]) return false;

  // Kiểm tra ràng buộc
  if (
    violatesConstraints({
      day,
      session,
      period,
      mon: subject,
      lop,
      gv: { id: gvId },
      tkb
    })
  ) return false;

  // Kiểm tra lớp đã có tiết môn đó trong buổi chiều chưa
  const countInAfternoon = countClassInAfternoonBySubject(tkb, gvId, day, lop, subject);
  if (countInAfternoon + 1 > 1) return false;

  // Thử xếp tiết
  const ok = assignToSlot(
    tkb,
    globalSchedule,
    gvId,
    lop,
    subject,
    { day, session, period },
    false,
    assignments,
    teachers
  );

  return !!ok;
};

/**
 * 🧩 Xếp tiết đơn cho giáo viên dạy các môn nhẹ (số tiết < 10) vào buổi chiều
 * - Chỉ xếp nếu ô trống, không vi phạm ràng buộc
 * - Mỗi lớp chỉ có tối đa 1 tiết môn đó trong buổi chiều
 * - Nếu không xếp được trực tiếp, thử hoán đổi đơn giản
 */
export const fillAfternoonSessionForLightSubject = ({
  gv,
  lopList,
  remainingMap,
  tkb,
  globalSchedule,
  assignments,
  teachers,
  days,
  subject = "Âm nhạc"
}) => {
  const gvId = gv.id;

  for (const day of days) {
    const session = "afternoon";

    if (gv.offTimes?.[day]?.[session]) continue;

    const sessionArray = tkb[gvId]?.[day]?.[session];
    if (!Array.isArray(sessionArray)) continue;

    for (let i = 0; i < sessionArray.length; i++) {
      if (sessionArray[i]) continue;

      const candidates = lopList
        .filter(lop => (remainingMap[lop] || 0) > 0)
        .filter(lop => countClassInAfternoonBySubject(tkb, gvId, day, lop, subject) < 1)
        .filter(lop => !violatesConstraints({
          day,
          session,
          period: i,
          mon: subject,
          lop,
          gv: { id: gvId },
          tkb
        }));

      if (candidates.length === 0) continue;

      const lop = candidates.sort((a, b) => remainingMap[b] - remainingMap[a])[0];

      const placed = tryPlaceSingleLightSubject({
        tkb,
        globalSchedule,
        gvId,
        day,
        session,
        period: i,
        lop,
        subject,
        assignments,
        teachers
      });

      if (placed) {
        remainingMap[lop] -= 1;
      } else {
        // 🔁 Nếu không gán được trực tiếp, thử hoán đổi đơn giản
        for (const l of lopList.filter(l => (remainingMap[l] || 0) > 0)) {
          const success = trySwapAndAssign({
            gv,
            lop: l,
            day,
            session,
            period: i,
            newTkb: tkb,
            globalSchedule,
            assignments,
            gvList: teachers
          });

          if (success) {
            remainingMap[l] -= 1;
            break;
          }
        }
      }
    }
  }
};

/**
 * 📋 Ghi nhận các lớp chưa được xếp đủ tiết cho một môn nhẹ (subject)
 * - Lưu vào `gvSummary` để phục vụ xử lý bổ sung hoặc thống kê
 * - Dễ mở rộng cho các môn như Âm nhạc, Mĩ thuật, GDTC...
 */
export const recordRemainingLightSubjects = ({ gv, remainingMap, gvSummary, subject = "Âm nhạc" }) => {
  const gvId = gv.id;
  if (!gvSummary[gvId]) gvSummary[gvId] = { assigned: 0, failedLops: [] };
  if (!gvSummary[gvId].failedLops) gvSummary[gvId].failedLops = [];

  Object.entries(remainingMap).forEach(([lop, remaining]) => {
    if (remaining > 0) {
      const tag = `${lop} - ${subject}`;
      if (!gvSummary[gvId].failedLops.includes(tag)) {
        gvSummary[gvId].failedLops.push(tag);
      }
    }
  });
};

/**
 * 🔁 Thử hoán đổi một tiết môn nhẹ (subject) giữa hai lớp để lấp tiết còn thiếu
 * - Chỉ áp dụng cho các môn nhẹ như Âm nhạc, Mĩ thuật, GDTC...
 * - Chỉ xếp nếu lớp thiếu chưa có tiết môn đó trong buổi chiều
 * - Chỉ hoán đổi nếu lớp đang có tiết có thể chuyển sang buổi khác mà không vi phạm ràng buộc
 */
export const tryMoveOneSlot_LightSubject = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lopMissing,
  days,
  assignments,
  teachers,
  gvSummary,
  subject = "Âm nhạc"
}) => {
  if (session !== "afternoon") return false;

  const sessionArray = tkb[gvId]?.[day]?.[session];
  if (!sessionArray) return false;

  const slot = sessionArray[period];
  if (!slot || slot.subject !== subject) return false;

  const otherLop = slot.class;
  if (otherLop === lopMissing) return false;

  for (const d2 of days) {
    const s2 = "afternoon"; // Chỉ hoán đổi trong buổi chiều

    const teacher = teachers.find(t => t.id === gvId);
    if (teacher?.offTimes?.[d2]?.[s2]) continue;

    const arr2 = tkb[gvId]?.[d2]?.[s2];
    if (!Array.isArray(arr2)) continue;

    for (let j = 0; j < arr2.length; j++) {
      if (arr2[j]) continue;

      const canPlaceMissingHere =
        !violatesConstraints({
          day,
          session,
          period,
          mon: subject,
          lop: lopMissing,
          gv: { id: gvId },
          tkb
        }) &&
        countClassInAfternoonBySubject(tkb, gvId, day, lopMissing, subject) < 1;

      const countOtherInD2 = countClassInAfternoonBySubject(tkb, gvId, d2, otherLop, subject);
      const canPlaceOtherThere =
        !violatesConstraints({
          day: d2,
          session: s2,
          period: j,
          mon: subject,
          lop: otherLop,
          gv: { id: gvId },
          tkb
        }) &&
        countOtherInD2 + (d2 === day ? 0 : 1) <= 1;

      if (canPlaceMissingHere && canPlaceOtherThere) {
        arr2[j] = { subject, class: otherLop };
        sessionArray[period] = { subject, class: lopMissing };

        assignToSlot(
          tkb,
          globalSchedule,
          gvId,
          otherLop,
          subject,
          { day: d2, session: s2, period: j },
          false,
          assignments,
          teachers
        );

        assignToSlot(
          tkb,
          globalSchedule,
          gvId,
          lopMissing,
          subject,
          { day, session, period },
          false,
          assignments,
          teachers
        );

        gvSummary[gvId].assigned += 1;
        return true;
      }
    }
  }

  return false;
};

/**
 * 🔁 Thử hoán đổi nâng cao để xếp tiết còn thiếu cho giáo viên dạy môn nhẹ (subject)
 * - Duyệt qua các lớp chưa đủ tiết và thử hoán đổi với lớp khác
 * - Chỉ xếp buổi chiều nếu giáo viên chưa đủ 20 tiết
 * - Dễ mở rộng cho các môn như Âm nhạc, Mĩ thuật, GDTC...
 */
export const performAdvancedSwapsForLightSubject = ({
  gv,
  tkb,
  globalSchedule,
  assignments,
  teachers,
  days,
  gvSummary,
  subject = "Âm nhạc"
}) => {
  const gvId = gv.id;
  if (!gvSummary[gvId]?.failedLops || gvSummary[gvId].failedLops.length === 0) return false;

  const allowedSessions = gvSummary[gvId].assigned < 20 ? ["afternoon"] : ["afternoon", "morning"];

  let progress = false;
  let progressThisGV = true;

  while (progressThisGV) {
    progressThisGV = false;

    for (const lopStr of [...gvSummary[gvId].failedLops]) {
      const [lopMissing, mon] = lopStr.split(" - ");
      if (mon !== subject) continue;

      let resolved = false;

      outerDayLoop:
      for (const day of days) {
        for (const session of allowedSessions) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = tkb[gvId]?.[day]?.[session];
          if (!Array.isArray(sessionArray)) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            const slot = sessionArray[i];
            if (!slot || slot.subject !== subject || slot.class === lopMissing) continue;

            const moved = tryMoveOneSlot_LightSubject({
              tkb,
              globalSchedule,
              gvId,
              day,
              session,
              period: i,
              lopMissing,
              days,
              assignments,
              teachers,
              gvSummary,
              subject
            });

            if (moved) {
              gvSummary[gvId].failedLops = gvSummary[gvId].failedLops.filter(l => l !== lopStr);
              progressThisGV = true;
              progress = true;
              resolved = true;
              break outerDayLoop;
            }
          }

          if (resolved) break;
        }

        if (resolved) break;
      }
    }
  }

  return progress;
};

/**
 * 🧩 Giai đoạn cuối: cố gắng lấp các tiết còn thiếu cho giáo viên dạy môn nhẹ (subject)
 * - Chỉ xếp buổi chiều (afternoon)
 * - Mỗi lớp chỉ có tối đa 1 tiết mỗi ngày
 * - Nếu slot trống → xếp trực tiếp
 * - Nếu slot đã có lớp khác → thử hoán đổi
 */
export const finalFillMissingPeriods_LightSubject = ({
  gvList = [],
  newTkb,
  globalSchedule,
  assignments = {},
  gvSummary = {},
  days = [],
  subject = "Âm nhạc"
}) => {
  if (!Array.isArray(gvList)) {
    console.error("❌ Lỗi: gvList phải là một mảng. Nhận được:", gvList);
    return;
  }

  for (const gv of gvList) {
    if (!gv.monDay?.includes(subject)) continue;

    const failedLops = gvSummary[gv.id]?.failedLops || [];
    if (failedLops.length === 0) continue;

    const allowedSessions = ["afternoon"];

    for (const lopStr of failedLops) {
      const [lop, mon] = lopStr.split(" - ");
      if (mon !== subject) continue;

      const totalNeeded = assignments[gv.id]?.[subject]?.filter(l => l === lop).length || 0;

      let alreadyAssigned = days.reduce((sum, day) => {
        const periods = newTkb?.[gv.id]?.[day]?.afternoon || [];
        return sum + periods.filter(t => t?.subject === subject && t?.class === lop).length;
      }, 0);

      let remaining = totalNeeded - alreadyAssigned;
      if (remaining <= 0) continue;

      for (const day of days) {
        for (const session of allowedSessions) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb?.[gv.id]?.[day]?.[session];
          if (!Array.isArray(sessionArray)) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            if (remaining <= 0) break;

            const slot = sessionArray[i];

            // ✅ Nếu slot trống → xếp trực tiếp
            if (!slot) {
              const countInAfternoon = sessionArray.filter(t => t?.subject === subject && t?.class === lop).length;
              if (countInAfternoon >= 1) continue;

              if (!violatesConstraints({ day, session, period: i, mon: subject, lop, gv, tkb: newTkb })) {
                assignToSlot(newTkb, globalSchedule, gv.id, lop, subject, { day, session, period: i }, false, assignments, gvList);
                gvSummary[gv.id].assigned += 1;
                remaining -= 1;
                continue;
              }
            }

            // 🔁 Nếu slot đã có lớp khác → thử hoán đổi
            if (slot?.subject === subject && slot.class !== lop) {
              const otherLop = slot.class;

              for (const d2 of days) {
                for (const s2 of allowedSessions) {
                  if (gv.offTimes?.[d2]?.[s2]) continue;

                  const arr2 = newTkb?.[gv.id]?.[d2]?.[s2];
                  if (!Array.isArray(arr2)) continue;

                  for (let j = 0; j < arr2.length; j++) {
                    if (arr2[j]) continue;

                    const countOtherInAfternoon = arr2.filter(t => t?.subject === subject && t?.class === otherLop).length;
                    if (countOtherInAfternoon >= 1) continue;

                    if (!violatesConstraints({ day: d2, session: s2, period: j, mon: subject, lop: otherLop, gv, tkb: newTkb })) {
                      arr2[j] = slot;
                      sessionArray[i] = null;

                      const countNewInAfternoon = sessionArray.filter(t => t?.subject === subject && t?.class === lop).length;
                      if (countNewInAfternoon >= 1) continue;

                      if (!violatesConstraints({ day, session, period: i, mon: subject, lop, gv, tkb: newTkb })) {
                        assignToSlot(newTkb, globalSchedule, gv.id, lop, subject, { day, session, period: i }, false, assignments, gvList);
                        gvSummary[gv.id].assigned += 1;
                        remaining -= 1;
                        break;
                      }
                    }
                  }
                  if (remaining <= 0) break;
                }
                if (remaining <= 0) break;
              }
            }
          }
        }
      }

      // ✅ Nếu đã xếp đủ → xóa khỏi failedLops
      if (remaining <= 0) {
        gvSummary[gv.id].failedLops = gvSummary[gv.id].failedLops.filter(l => l !== lopStr);
        //console.log(`✅ Đã cứu lớp ${lop} bằng xếp bổ sung môn ${subject}`);
      }
    }
  }
};

/**
 * 🚨 Kiểm tra vi phạm số tiết môn nhẹ (subject) trong buổi chiều
 * - Mỗi lớp chỉ được xếp tối đa 1 tiết mỗi buổi chiều
 * - Trả về danh sách các vi phạm theo giáo viên, lớp, ngày và số tiết
 * - Dễ mở rộng cho các môn như Âm nhạc, Mĩ thuật, GDTC...
 */
export const checkTietPerAfternoon_LightSubject = ({ newTkb, gvList, days, subject = "Âm nhạc" }) => {
  const violations = [];

  for (const gv of gvList) {
    for (const day of days) {
      const lopCount = {};

      const arr = newTkb[gv.id]?.[day]?.["afternoon"];
      if (!arr) continue;

      for (const t of arr) {
        if (t?.subject === subject) {
          lopCount[t.class] = (lopCount[t.class] || 0) + 1;
        }
      }

      for (const lop in lopCount) {
        if (lopCount[lop] > 1) {
          violations.push({ gv: gv.id, lop, day, count: lopCount[lop], subject });
        }
      }
    }
  }

  return violations;
};

/**
 * 🧹 Tối ưu hóa lịch dạy cho giáo viên dạy môn nhẹ (subject)
 * - Di chuyển tiết đầu sáng Thứ 2 nếu có thể (tránh tiết đầu tuần)
 * - Chỉ xử lý buổi chiều (afternoon)
 * - Kiểm tra vi phạm: mỗi lớp chỉ có tối đa 1 tiết mỗi buổi chiều
 */
export const optimizeLightSubjectSchedule = ({
  newTkb,
  gvList = [], // ✅ đảm bảo là mảng
  assignments = {},
  days = [],
  subject = "Âm nhạc"
}) => {
  if (!Array.isArray(gvList)) {
    console.error("❌ Lỗi: gvList phải là một mảng. Đầu vào nhận được:", gvList);
    return;
  }

  for (const gv of gvList) {
    if (!gv.monDay?.includes(subject)) continue;

    const lopList = assignments[gv.id]?.[subject] || [];

    for (const day of days) {
      const session = "afternoon";
      if (gv.offTimes?.[day]?.[session]) continue;

      const sessionArray = newTkb?.[gv.id]?.[day]?.[session];
      if (!Array.isArray(sessionArray)) continue;

      // ❌ Không gom tiết đôi cho môn nhẹ

      // ✅ Loại bỏ tiết đầu sáng Thứ 2 nếu có thể
      if (
        day === "Thứ 2" &&
        newTkb?.[gv.id]?.["Thứ 2"]?.["morning"]?.[0]?.subject === subject
      ) {
        const morningArray = newTkb[gv.id]["Thứ 2"]["morning"];
        const moved = morningArray.findIndex((t, idx) => idx > 0 && !t);
        if (moved !== -1) {
          morningArray[moved] = morningArray[0];
          morningArray[0] = null;
        }
      }
    }
  }

  const violations = checkTietPerAfternoon_LightSubject({
    newTkb,
    gvList,
    days,
    subject
  });

  if (violations.length > 0) {
    //console.log(`⚠️ Các lớp bị xếp quá 1 tiết buổi chiều cho môn ${subject}:`);
    violations.forEach(v => {
      //console.log(`- GV ${v.gv}, lớp ${v.lop}, ngày ${v.day}: ${v.count} tiết`);
    });
  } else {
    //console.log(`✅ Không có lớp nào bị xếp quá 1 tiết buổi chiều cho môn ${subject}.`);
  }
};

//======================
/**
 * 📦 Gom các tiết môn nhẹ (subject) của cùng một lớp về giữa tuần nếu bị phân tán
 * - Chỉ xử lý buổi chiều (afternoon)
 * - Dễ mở rộng cho các môn như Âm nhạc, Mĩ thuật, GDTC...
 * - Ưu tiên chuyển tiết về Thứ 3, 4, 5 nếu lớp có nhiều tiết rải rác
 */
export const groupLightSubjectByClass = (newTkb, gvList) => {
  // ✅ Kiểm tra đầu vào
  if (!Array.isArray(gvList)) {
    console.error("❌ Lỗi: gvList phải là một mảng. Nhận được:", gvList);
    return {}; // hoặc [] tùy theo mục đích sử dụng
  }

  const grouped = {};

  for (const gv of gvList) {
    if (!gv.monDay || !Array.isArray(gv.monDay)) continue;

    for (const subject of gv.monDay) {
      if (!grouped[subject]) grouped[subject] = [];

      grouped[subject].push(gv.id); // hoặc push cả object gv nếu cần
    }
  }

  return grouped;
};

/**
 * 📦 Gom các tiết môn nhẹ (subject) của cùng một lớp về một ngày cố định nếu bị phân tán
 * - Chỉ xử lý buổi chiều (afternoon)
 * - Gom tối đa 2 tiết về một ngày (ví dụ: Thứ 4 chiều)
 * - Dễ mở rộng cho các môn như Âm nhạc, Mĩ thuật, GDTC...
 */
export const regroupLightSubjectSlots = ({ newTkb, gvList, assignments, days, subject = "Âm nhạc" }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes(subject)) continue;

    const lopList = assignments[gv.id]?.[subject] || [];

    for (const lop of lopList) {
      const slots = [];

      for (const day of days) {
        const session = "afternoon";
        if (gv.offTimes?.[day]?.[session]) continue;

        const sessionArray = newTkb[gv.id]?.[day]?.[session];
        if (!sessionArray) continue;

        sessionArray.forEach((t, i) => {
          if (t?.subject === subject && t?.class === lop) {
            slots.push({ day, session, period: i });
          }
        });
      }

      // 🔹 Gom về Thứ 4 chiều nếu có thể
      const targetDay = "Thứ 4";
      const targetSession = "afternoon";
      if (slots.length >= 2 && !gv.offTimes?.[targetDay]?.[targetSession]) {
        const targetArray = newTkb[gv.id][targetDay][targetSession];
        let moved = 0;

        for (const slot of slots) {
          if (moved >= 2) break;

          const { day, session, period } = slot;
          const current = newTkb[gv.id][day][session][period];
          const emptyIndex = targetArray.findIndex(t => !t);

          if (emptyIndex !== -1) {
            targetArray[emptyIndex] = current;
            newTkb[gv.id][day][session][period] = null;
            moved++;
          }
        }
      }
    }
  }
};

/**
 * 🧩 Cố gắng xếp bổ sung các tiết môn nhẹ (subject) còn thiếu cho giáo viên
 * - Gom tiết phân tán trong ngày về một buổi (chỉ buổi chiều)
 * - Nếu slot trống → gán trực tiếp
 * - Nếu slot đã có lớp khác → thử hoán đổi
 * - Không xử lý tiết đôi
 */
export const resolveMissingLightSubject = ({
  newTkb,
  gvList,
  gvSummary,
  assignments,
  globalSchedule,
  days,
  lightSubjects = ["Âm nhạc", "Mĩ thuật", "GDTC"]
}) => {
  for (const gv of gvList) {
    const subjectsToHandle = gv.monDay.filter(mon => lightSubjects.includes(mon));
    if (subjectsToHandle.length === 0) continue;

    const failedLops = gvSummary[gv.id]?.failedLops || [];
    if (!failedLops.length) continue;

    for (const lopStr of failedLops) {
      const [lop, mon] = lopStr.split(" - ");
      if (!subjectsToHandle.includes(mon)) continue;

      let resolved = false;

      for (const day of days) {
        const morningArr = newTkb[gv.id][day]?.morning || [];
        const afternoonArr = newTkb[gv.id][day]?.afternoon || [];

        // 🔄 Gom tiết sáng về chiều nếu cùng lớp và môn
        const morningSlots = morningArr.filter(t => t?.subject === mon && t?.class === lop);
        const afternoonSlots = afternoonArr.filter(t => t?.subject === mon && t?.class === lop);

        if (morningSlots.length > 0 && afternoonSlots.length > 0) {
          for (let i = 0; i < morningArr.length; i++) {
            const slot = morningArr[i];
            if (slot?.subject === mon && slot.class === lop) {
              const emptyIndex = afternoonArr.findIndex(t => !t);
              if (emptyIndex !== -1 && !gv.offTimes?.[day]?.afternoon) {
                afternoonArr[emptyIndex] = slot;
                morningArr[i] = null;
              }
            }
          }
        }

        const session = "afternoon";
        if (gv.offTimes?.[day]?.[session]) continue;

        const sessionArray = newTkb[gv.id][day][session];
        if (!sessionArray) continue;

        for (let i = 0; i < sessionArray.length; i++) {
          const slot = sessionArray[i];

          // ✅ Slot trống → gán trực tiếp
          if (!slot) {
            const countInAfternoon = sessionArray.filter(t => t?.subject === mon && t?.class === lop).length;
            if (countInAfternoon >= 1) continue;

            if (!violatesConstraints({ day, session, period: i, mon, lop, gv, tkb: newTkb })) {
              assignToSlot(newTkb, globalSchedule, gv.id, lop, mon, { day, session, period: i }, false, assignments, gvList);
              gvSummary[gv.id].assigned += 1;
              gvSummary[gv.id].failedLops = gvSummary[gv.id].failedLops.filter(l => l !== lopStr);
              resolved = true;
              break;
            }
          }

          // 🔁 Slot đã có lớp khác → thử hoán đổi
          else if (slot.subject === mon && slot.class !== lop) {
            const otherLop = slot.class;

            for (const d2 of days) {
              const s2 = "afternoon";
              if (gv.offTimes?.[d2]?.[s2]) continue;

              const arr2 = newTkb[gv.id][d2]?.[s2];
              if (!arr2) continue;

              for (let j = 0; j < arr2.length; j++) {
                if (!arr2[j]) {
                  const countOtherInAfternoon = arr2.filter(t => t?.subject === mon && t?.class === otherLop).length;
                  if (countOtherInAfternoon >= 1) continue;

                  if (!violatesConstraints({ day: d2, session: s2, period: j, mon, lop: otherLop, gv, tkb: newTkb })) {
                    arr2[j] = slot;
                    sessionArray[i] = null;

                    const countNewInAfternoon = sessionArray.filter(t => t?.subject === mon && t?.class === lop).length;
                    if (countNewInAfternoon >= 1) continue;

                    if (!violatesConstraints({ day, session, period: i, mon, lop, gv, tkb: newTkb })) {
                      assignToSlot(newTkb, globalSchedule, gv.id, lop, mon, { day, session, period: i }, false, assignments, gvList);
                      gvSummary[gv.id].assigned += 1;
                      gvSummary[gv.id].failedLops = gvSummary[gv.id].failedLops.filter(l => l !== lopStr);
                      resolved = true;
                      break;
                    }
                  }
                }
              }
              if (resolved) break;
            }
          }

          if (resolved) break;
        }

        if (resolved) break;
      }
    }
  }
};

//======================

/**
 * Thử hoán đổi một tiết học của môn ít tiết với một tiết trống để gán cho lớp mới.
 *
 * @param {Object} params - Các tham số đầu vào
 * @param {Object} params.gv - Thông tin giáo viên
 * @param {string} params.lop - Tên lớp cần gán
 * @param {string} params.day - Ngày cần gán
 * @param {string} params.session - Buổi học ("morning" hoặc "afternoon")
 * @param {number} params.period - Vị trí tiết cần gán
 * @param {string} params.subject - Môn học cần xử lý (ví dụ: "Mỹ thuật", "Thể dục")
 * @param {Object} params.newTkb - Thời khóa biểu hiện tại
 * @param {Object} params.globalSchedule - Lịch tổng thể toàn trường
 * @param {Object} params.assignments - Danh sách phân công
 * @param {Object} params.gvList - Danh sách giáo viên
 * @returns {boolean} - Trả về true nếu hoán đổi và gán thành công, false nếu không
 *
export const trySwapAndAssign = ({
  gv,
  lop,
  day,
  session,
  period,
  subject,
  newTkb,
  globalSchedule,
  assignments,
  gvList
}) => {
  const sessionArray = newTkb?.[gv.id]?.[day]?.[session];
  if (!Array.isArray(sessionArray)) return false;
  if (sessionArray[period]) return false;

  for (const d2 of Object.keys(newTkb[gv.id])) {
    for (const s2 of ["morning", "afternoon"]) {
      const arr2 = newTkb[gv.id][d2][s2];
      if (!Array.isArray(arr2)) continue;

      for (let k = 0; k < arr2.length; k++) {
        const current = arr2[k];
        if (!current || current.subject !== subject || current.class === lop) continue;

        const canSwap = !violatesConstraints({
          day,
          session,
          period,
          mon: subject,
          lop: current.class,
          gv,
          tkb: newTkb
        });

        if (canSwap) {
          sessionArray[period] = current;
          arr2[k] = null;

          const canAssign = !violatesConstraints({
            day: d2,
            session: s2,
            period: k,
            mon: subject,
            lop,
            gv,
            tkb: newTkb
          });

          if (canAssign) {
            assignToSlot(
              newTkb,
              globalSchedule,
              gv.id,
              lop,
              subject,
              { day: d2, session: s2, period: k },
              false,
              assignments,
              gvList
            );
            return true;
          }

          // Hoàn tác nếu không hợp lệ
          arr2[k] = current;
          sessionArray[period] = null;
        }
      }
    }
  }

  return false;
};*/


export const scheduleFullLightSubjectPipeline = async (inputData) => {
  try {
    // Bước 1: Xếp lịch sơ bộ cho các môn nhẹ
    const initialSchedule = await scheduleLightSubjects(inputData);

    // 🔧 Lấy các biến cần thiết từ initialSchedule
    const {
      newTkb,
      gvList,
      gvSummary,
      assignments,
      globalSchedule,
      days,
      lightSubjects = ["Âm nhạc", "Mĩ thuật", "GDTC"]
    } = initialSchedule;

    // Bước 2: Giải quyết các môn bị thiếu hoặc chưa đủ tiết
    await resolveMissingLightSubject({
      newTkb,
      gvList,
      gvSummary,
      assignments,
      globalSchedule,
      days,
      lightSubjects
    });

    // Bước 3: Tối ưu hóa lịch học (giảm tiết trống, tránh trùng lịch)
    await optimizeFullLightSubjectSchedule({
      newTkb,
      gvList,
      assignments,
      days,
      gvSummary,
      globalSchedule
    });

    // Bước 4: Điền các tiết còn thiếu nếu có (theo từng môn)
    for (const subject of lightSubjects) {
      await finalFillMissingPeriods_LightSubject({
        newTkb,
        gvList,
        globalSchedule,
        assignments,
        gvSummary,
        days,
        subject
      });
    }

    return newTkb;
  } catch (error) {
    console.error("Lỗi trong pipeline xếp lịch môn nhẹ:", error);
    throw error;
  }
};

/**
 * 🧹 Tối ưu hóa toàn bộ lịch dạy cho giáo viên dạy môn nhẹ (subject)
 * - Gom tiết về giữa tuần nếu bị phân tán
 * - Gom tiết về một buổi cố định (ví dụ Thứ 4 chiều)
 * - Xử lý các lớp còn thiếu tiết bằng cách gán hoặc hoán đổi
 * - Không xử lý tiết đôi
 */
export const optimizeFullLightSubjectSchedule = ({
  newTkb,
  gvList = [], // ✅ đảm bảo là mảng
  assignments = {},
  days = [],
  gvSummary = {},
  globalSchedule = {},
  subject = "Âm nhạc"
}) => {
  if (!Array.isArray(gvList)) {
    console.error("❌ Lỗi: gvList phải là một mảng. Nhận được:", gvList);
    return;
  }

  optimizeLightSubjectSchedule({ newTkb, gvList, assignments, days, subject });
  groupLightSubjectByClass({ newTkb, gvList, assignments, days, subject });
  regroupLightSubjectSlots({ newTkb, gvList, assignments, days, subject });

  // ❌ Không gọi splitDoublePeriodsIfNeeded vì môn nhẹ không có tiết đôi
  resolveMissingLightSubject({
    newTkb,
    gvList,
    gvSummary,
    assignments,
    globalSchedule,
    days,
    lightSubjects: [subject] // ✅ truyền đúng key
  });
};

