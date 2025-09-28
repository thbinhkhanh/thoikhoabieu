// scheduleDaoDuct.js
import { violatesConstraints, assignToSlot } from './autoScheduleUtils';

/**
 * Xếp lịch cho tất cả giáo viên môn Âm nhạc.
 */
export const scheduleDaoDuc = ({
  gvList = [],
  newTkb,
  globalSchedule,
  phanCongGVs,
  assignments,
  gvSummary,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Đạo đức")) continue;

    const lopList = assignments[gv.id]?.["Đạo đức"] || [];
    if (!lopList.length) continue;

    const remainingMap = {};
    lopList.forEach(lop => {
      remainingMap[lop] = phanCongGVs[gv.id]?.["Đạo đức"]?.[lop] || 0;
    });

    let A = [...lopList.filter(lop => remainingMap[lop] > 0)];
    //const allowedSessions = ["afternoon", "morning"];
    const allowedSessions = ["afternoon"];

    for (const day of days) {
      for (const session of allowedSessions) {
        const sessionArray = newTkb[gv.id][day][session];
        if (!Array.isArray(sessionArray)) continue;

        for (let i = 0; i < sessionArray.length; i++) {
          if (sessionArray[i]) continue;

          const candidates = A.filter(lop =>
            remainingMap[lop] > 0 &&
            countClassInDay(newTkb, gv.id, day, lop, "Đạo đức") < 1 &&
            !violatesConstraints({ day, session, period: i, mon: "Đạo đức", lop, gv, tkb: newTkb })
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
              subject: "Đạo đức",
              assignments,
              teachers: gvList
            });

            if (placed) {
              remainingMap[lop] -= 1;
              if (remainingMap[lop] === 0) {
                A = A.filter(l => l !== lop);
              }
            }
          }

          if (A.length === 0) break;
        }

        if (A.length === 0) break;
      }

      if (A.length === 0) break;
    }

    if (Object.values(remainingMap).some(r => r > 0)) {
      restructureDaoDucSchedule({
        newTkb,
        gv,
        remainingMap,
        lopList,
        assignments,
        gvList,
        globalSchedule,
        days
      });
    }

    if (!gvSummary[gv.id]) gvSummary[gv.id] = { assigned: 0, failedLops: [] };
    recordRemaining({ gv, remainingMap, gvSummary });
  }

  let overallProgress = true;
  while (overallProgress) {
    overallProgress = false;

    for (const gv of gvList) {
      if (!gv.monDay.includes("Đạo đức")) continue;
      if (!gvSummary[gv.id]?.failedLops || gvSummary[gv.id].failedLops.length === 0) continue;

      const didProgress = performAdvancedSwapsForGV({
        gv,
        tkb: newTkb,
        globalSchedule,
        assignments,
        teachers: gvList,
        days,
        gvSummary,
        mon: "Đạo đức"
      });

      if (didProgress) overallProgress = true;
    }
  }

  for (let retry = 0; retry < 5; retry++) {
    let retryProgress = false;

    for (const gv of gvList) {
      if (!gv.monDay.includes("Đạo đức")) continue;
      if (!gvSummary[gv.id]?.failedLops || gvSummary[gv.id].failedLops.length === 0) continue;

      const didProgress = performAdvancedSwapsForGV({
        gv,
        tkb: newTkb,
        globalSchedule,
        assignments,
        teachers: gvList,
        days,
        gvSummary,
        mon: "Đạo đức"
      });

      if (didProgress) {
        retryProgress = true;
        //console.log(`✅ Hoán đổi bổ sung lần ${retry + 1} cho GV ${gv.name}`);
      }
    }

    if (!retryProgress) break;
  }
};

/**
 * Sắp xếp lại các tiết Âm nhạc còn thiếu cho một giáo viên,
 * thử di chuyển các slot trống hoặc hoán đổi để xếp đủ.
 */
function restructureDaoDucSchedule({
  newTkb,
  gv,
  remainingMap,
  lopList,
  assignments,
  gvList,
  globalSchedule,
  days
}) {
  //const sessionOrder = ["afternoon", "morning"];
  const sessionOrder = ["afternoon"];

  for (const day of days) {
    for (const session of sessionOrder) {
      const sessionArray = newTkb[gv.id][day][session];
      if (!Array.isArray(sessionArray)) continue;

      for (let i = 0; i < sessionArray.length; i++) {
        if (sessionArray[i]) continue;

        let moved = false;

        //for (const srcSession of ["morning", "afternoon"]) {
        for (const srcSession of ["afternoon"]) {
          const srcArray = newTkb[gv.id][day][srcSession];
          if (!Array.isArray(srcArray)) continue;

          for (let j = 0; j < srcArray.length; j++) {
            const slot = srcArray[j];
            if (!slot || slot.subject !== "Đạo đức") continue;

            const canMove = !violatesConstraints({
              day,
              session,
              period: i,
              mon: "Đạo đức",
              lop: slot.class,
              gv,
              tkb: newTkb
            });

            if (canMove) {
              newTkb[gv.id][day][session][i] = slot;
              newTkb[gv.id][day][srcSession][j] = null;
              moved = true;
              break;
            }
          }

          if (moved) break;
        }

        if (moved) {
          for (const srcSession of ["morning"]) {
            const srcArray = newTkb[gv.id][day][srcSession];
            if (!Array.isArray(srcArray)) continue;

            for (let j = 0; j < srcArray.length; j++) {
              if (srcArray[j]) continue;

              const candidates = lopList.filter(lop =>
                remainingMap[lop] > 0 &&
                countClassInDay(newTkb, gv.id, day, lop, "Đạo đức") < 1 &&
                !violatesConstraints({
                  day,
                  session: srcSession,
                  period: j,
                  mon: "Đạo đức",
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
                  session: srcSession,
                  period: j,
                  lop,
                  subject: "Đạo đức",
                  assignments,
                  teachers: gvList
                });

                if (placed) {
                  remainingMap[lop] -= 1;
                  break;
                }
              }
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
 * Đếm số lần xuất hiện của một lớp trong ngày cho một giáo viên.
 */
const countClassInDay = (tkb, gvId, day, lop, mon) => {
  //const sessionKeys = ["morning", "afternoon"];
  const sessionKeys = ["afternoon"];
  let count = 0;

  for (const session of sessionKeys) {
    const periods = tkb[gvId]?.[day]?.[session] || [];
    for (const slot of periods) {
      if (slot?.class === lop && slot?.subject === mon) {
        count++;
      }
    }
  }

  return count;
};

/**
 * Đếm số lần xuất hiện của một lớp trong ngày cho môn Âm nhạc (phiên bản export).
 */
export const countClassInDayDaoDuc = (
  tkb,
  gvId,
  day,
  className,
  subject = "Đạo đức"
) => {
  const dayObj = tkb[gvId]?.[day];
  if (!dayObj) return 0;

  //return [...(dayObj.morning || []), ...(dayObj.afternoon || [])]
  return [...(dayObj.afternoon || [])]
    .filter(t => t && t.subject === subject && t.class === className).length;
};

/**
 * Thử xếp một lớp vào slot cụ thể của giáo viên môn Âm nhạc.
 */
export const tryPlaceSingleAt = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lop,
  subject = "Đạo đức",
  assignments,
  teachers
}) => {
  const sessionArray = tkb[gvId]?.[day]?.[session];
  if (!Array.isArray(sessionArray)) return false;
  if (period < 0 || period >= sessionArray.length) return false;
  if (sessionArray[period]) return false;

  // ✅ Kiểm tra tổng số tiết GV đã dạy trong ngày
  const totalAssignedToday = ["morning", "afternoon"].reduce((sum, s) => {
    const arr = tkb[gvId][day][s] || [];
    return sum + arr.filter(t => t).length;
  }, 0);
  if (totalAssignedToday >= 1) return false; // GV đã có 1 tiết → không xếp thêm

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
  )
    return false;

  const countInDay = countClassInDayDaoDuc(tkb, gvId, day, lop, subject);
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
};


/**
 * Xếp các slot trống cho giáo viên môn Âm nhạc theo danh sách lớp còn thiếu.
 */
export const fillSessionForGVDaoDuc = ({
  gv,
  lopList,
  remainingMap,
  tkb,
  globalSchedule,
  assignments,
  teachers,
  days,
  allowedSessions
}) => {
  const gvId = gv.id;

  for (const day of days) {
    for (const session of allowedSessions) {
      if (gv.offTimes?.[day]?.[session]) continue;

      const sessionArray = tkb[gvId][day][session];
      if (!Array.isArray(sessionArray)) continue;

      // 🔀 Xáo trộn danh sách lớp còn tiết trước mỗi buổi
      const shuffledLopList = [...lopList]
        .filter(lop => (remainingMap[lop] || 0) > 0)
        .sort(() => Math.random() - 0.5);

      // ✅ Xếp tiết đơn
      for (let i = 0; i < sessionArray.length; i++) {
        if (sessionArray[i]) continue;

        const candidates = shuffledLopList
          .filter(lop => (remainingMap[lop] || 0) > 0)
          .filter(lop => countClassInDayDaoDuc(tkb, gvId, day, lop) < 1)
          .filter(lop => !violatesConstraints({
            day,
            session,
            period: i,
            mon: "Đạo đức",
            lop,
            gv: { id: gvId },
            tkb
          }));

        if (candidates.length === 0) continue;

        const lop = candidates.sort((a, b) => remainingMap[b] - remainingMap[a])[0];

        const placed = tryPlaceSingleAt({
          tkb,
          globalSchedule,
          gvId,
          day,
          session,
          period: i,
          lop,
          assignments,
          teachers
        });

        if (placed) {
          remainingMap[lop] -= 1;
        } else {
          for (const l of shuffledLopList.filter(l => (remainingMap[l] || 0) > 0)) {
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
  }
};

/**
 * Ghi nhận các lớp còn thiếu cho giáo viên vào gvSummary.
 */
export const recordRemaining = ({ gv, remainingMap, gvSummary }) => {
  const gvId = gv.id;
  if (!gvSummary[gvId].failedLops) gvSummary[gvId].failedLops = [];

  Object.entries(remainingMap).forEach(([lop, remaining]) => {
    if (remaining > 0) {
      const tag = `${lop} - DaoDuc`;
      if (!gvSummary[gvId].failedLops.includes(tag)) {
        gvSummary[gvId].failedLops.push(tag);
      }
    }
  });
};

/**
 * Thử di chuyển một slot Âm nhạc để giải quyết lớp còn thiếu.
 */
export const tryMoveOneSlot_DaoDuc = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lopMissing,
  days,
  allowedSessions,
  assignments,
  teachers,
  gvSummary
}) => {
  const sessionArray = tkb[gvId][day][session];
  if (!sessionArray) return false;

  const slot = sessionArray[period];
  if (!slot || slot.subject !== "Đạo đức") return false;

  const otherLop = slot.class;
  if (otherLop === lopMissing) return false;

  for (const d2 of days) {
    for (const s2 of allowedSessions) {
      if (teachers.find(t => t.id === gvId).offTimes?.[d2]?.[s2]) continue;

      const arr2 = tkb[gvId][d2][s2];
      if (!Array.isArray(arr2)) continue;

      for (let j = 0; j < arr2.length; j++) {
        if (arr2[j]) continue;

        const canPlaceMissingHere =
          !violatesConstraints({
            day,
            session,
            period,
            mon: "Đạo đức",
            lop: lopMissing,
            gv: { id: gvId },
            tkb
          }) &&
          countClassInDayDaoDuc(tkb, gvId, day, lopMissing) < 1;

        const countOtherInD2 = countClassInDayDaoDuc(tkb, gvId, d2, otherLop);
        const canPlaceOtherThere =
          !violatesConstraints({
            day: d2,
            session: s2,
            period: j,
            mon: "Đạo đức",
            lop: otherLop,
            gv: { id: gvId },
            tkb
          }) &&
          countOtherInD2 + (d2 === day ? 0 : 1) <= 1;

        if (canPlaceMissingHere && canPlaceOtherThere) {
          arr2[j] = { subject: "Đạo đức", class: otherLop };
          sessionArray[period] = { subject: "Đạo đức", class: lopMissing };

          assignToSlot(
            tkb,
            globalSchedule,
            gvId,
            otherLop,
            "Đạo đức",
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
            "Đạo đức",
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
  }

  return false;
};

/**
 * Thực hiện hoán đổi nâng cao cho giáo viên để xếp đủ các lớp Âm nhạc còn thiếu.
 */
export const performAdvancedSwapsForGV = ({
  gv,
  tkb,
  globalSchedule,
  assignments,
  teachers,
  days,
  gvSummary
}) => {
  const gvId = gv.id;
  if (!gvSummary[gvId]?.failedLops || gvSummary[gvId].failedLops.length === 0) return false;

  const allowedSessions = gvSummary[gvId].assigned < 20 ? ["afternoon"] : ["afternoon", "morning"];

  let progress = false;
  let progressThisGV = true;

  while (progressThisGV) {
    progressThisGV = false;

    for (const lopStr of [...gvSummary[gvId].failedLops]) {
      const lopMissing = lopStr.split(" - ")[0];
      let resolved = false;

      outerDayLoop:
      for (const day of days) {
        for (const session of allowedSessions) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = tkb[gvId][day][session];
          if (!Array.isArray(sessionArray)) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            const slot = sessionArray[i];
            if (!slot || slot.subject !== "Đạo đức" || slot.class === lopMissing) continue;

            const moved = tryMoveOneSlot_DaoDuc({
              tkb,
              globalSchedule,
              gvId,
              day,
              session,
              period: i,
              lopMissing,
              days,
              allowedSessions,
              assignments,
              teachers,
              gvSummary
            });

            if (moved) {
              gvSummary[gvId].failedLops = gvSummary[gvId].failedLops.filter(l => l !== lopStr);
              progressThisGV = true;
              progress = true;
              resolved = true;
              break outerDayLoop;
            }

            // ❌ Không xử lý tiết đôi cho DaoDuc
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
 * Xếp bổ sung các slot còn thiếu cho tất cả giáo viên Âm nhạc.
 */
export const finalFillMissingPeriods_DaoDuc = ({
  gvList = [],
  newTkb,
  globalSchedule,
  assignments,
  gvSummary,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Đạo đức")) continue;

    const failedLops = gvSummary[gv.id]?.failedLops || [];
    if (failedLops.length === 0) continue;

    //const allowedSessions = ["morning", "afternoon"];
    const allowedSessions = ["afternoon"];

    for (const lopStr of failedLops) {
      const lop = lopStr.split(" - ")[0];
      const totalNeeded = assignments[gv.id]?.["Đạo đức"]?.filter(l => l === lop).length || 0;

      let alreadyAssigned = [...days].reduce((sum, day) => {
        return sum + ["morning", "afternoon"].reduce((s, session) => {
          return s + newTkb[gv.id][day][session].filter(t => t?.subject === "Đạo đức" && t?.class === lop).length;
        }, 0);
      }, 0);

      let remaining = totalNeeded - alreadyAssigned;
      if (remaining <= 0) continue;

      for (const day of days) {
        for (const session of allowedSessions) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb[gv.id][day][session];
          if (!sessionArray) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            if (remaining <= 0) break;

            const slot = sessionArray[i];

            // ✅ Nếu slot trống → xếp trực tiếp
            if (!slot) {
              const countInDay = [...newTkb[gv.id][day].morning, ...newTkb[gv.id][day].afternoon]
                .filter(t => t?.subject === "Đạo đức" && t?.class === lop).length;
              if (countInDay >= 1) continue;

              if (!violatesConstraints({ day, session, period: i, mon: "Đạo đức", lop, gv, tkb: newTkb })) {
                assignToSlot(newTkb, globalSchedule, gv.id, lop, "Đạo đức", { day, session, period: i }, false, assignments, gvList);
                gvSummary[gv.id].assigned += 1;
                remaining -= 1;
                continue;
              }
            }

            // ❌ Không xử lý tiết đôi cho DaoDuc

            // 🔁 Nếu slot đã có lớp khác → thử hoán đổi
            if (slot?.subject === "Đạo đức" && slot.class !== lop) {
              const otherLop = slot.class;

              for (const d2 of days) {
                for (const s2 of allowedSessions) {
                  if (gv.offTimes?.[d2]?.[s2]) continue;

                  const arr2 = newTkb[gv.id][d2][s2];
                  if (!arr2) continue;

                  for (let j = 0; j < arr2.length; j++) {
                    if (arr2[j]) continue;

                    const countOtherInDay = [...newTkb[gv.id][d2].morning, ...newTkb[gv.id][d2].afternoon]
                      .filter(t => t?.subject === "Đạo đức" && t?.class === otherLop).length;
                    if (countOtherInDay >= 1) continue;

                    if (!violatesConstraints({ day: d2, session: s2, period: j, mon: "Đạo đức", lop: otherLop, gv, tkb: newTkb })) {
                      arr2[j] = slot;
                      sessionArray[i] = null;

                      const countNewInDay = [...newTkb[gv.id][day].morning, ...newTkb[gv.id][day].afternoon]
                        .filter(t => t?.subject === "Đạo đức" && t?.class === lop).length;
                      if (countNewInDay >= 1) continue;

                      if (!violatesConstraints({ day, session, period: i, mon: "Đạo đức", lop, gv, tkb: newTkb })) {
                        assignToSlot(newTkb, globalSchedule, gv.id, lop, "Đạo đức", { day, session, period: i }, false, assignments, gvList);
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
        //console.log(`✅ Đã cứu lớp ${lop} bằng xếp bổ sung`);
      }
    }
  }
};

/**
 * Thử hoán đổi slot trống để xếp lớp còn thiếu cho giáo viên Âm nhạc.
 */
export const trySwapAndAssign = ({
  gv,
  lop,
  day,
  session,
  period,
  newTkb,
  globalSchedule,
  assignments,
  gvList
}) => {
  const sessionArray = newTkb[gv.id][day][session];
  const slot = sessionArray[period];
  if (slot) return false;

  for (const d2 of Object.keys(newTkb[gv.id])) {
    //for (const s2 of ["morning", "afternoon"]) {
    for (const s2 of ["afternoon"]) {
      const arr2 = newTkb[gv.id][d2][s2];
      if (!arr2) continue;

      for (let k = 0; k < arr2.length; k++) {
        const current = arr2[k];
        if (!current || current.subject !== "Đạo đức" || current.class === lop) continue;

        if (
          !violatesConstraints({
            day,
            session,
            period,
            mon: "Đạo đức",
            lop: current.class,
            gv,
            tkb: newTkb
          })
        ) {
          sessionArray[period] = current;
          arr2[k] = null;

          if (
            !violatesConstraints({
              day: d2,
              session: s2,
              period: k,
              mon: "Đạo đức",
              lop,
              gv,
              tkb: newTkb
            })
          ) {
            assignToSlot(
              newTkb,
              globalSchedule,
              gv.id,
              lop,
              "Đạo đức",
              { day: d2, session: s2, period: k },
              false,
              assignments,
              gvList
            );
            return true;
          }

          // Hoán đổi không hợp lệ → hoàn tác
          arr2[k] = current;
          sessionArray[period] = null;
        }
      }
    }
  }

  return false;
};

/**
 * Kiểm tra các lớp bị xếp quá 1 tiết/ngày cho giáo viên môn Âm nhạc.
 */
export const checkTietPerDay_DaoDuc = ({ newTkb, gvList, days }) => {
  const violations = [];

  for (const gv of gvList) {
    for (const day of days) {
      const lopCount = {};

      //for (const session of ["morning", "afternoon"]) {
      for (const session of ["afternoon"]) {
        const arr = newTkb[gv.id][day][session];
        if (!arr) continue;

        for (const t of arr) {
          if (t?.subject === "Đạo đức") {
            lopCount[t.class] = (lopCount[t.class] || 0) + 1;
          }
        }
      }

      for (const lop in lopCount) {
        if (lopCount[lop] > 1) {
          violations.push({ gv: gv.id, lop, day, count: lopCount[lop] });
        }
      }
    }
  }

  return violations;
};

/**
 * Tối ưu lịch Âm nhạc cho giáo viên: di chuyển tiết, tránh xếp quá 1 tiết/ngày.
 */
{/*export const optimizeDaoDucSchedule = ({
  newTkb,
  gvList,
  assignments,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Đạo đức")) continue;

    const lopList = assignments[gv.id]?.["Đạo đức"] || [];

    for (const day of days) {
      for (const session of ["morning", "afternoon"]) {
        if (gv.offTimes?.[day]?.[session]) continue;

        const sessionArray = newTkb[gv.id][day][session];
        if (!sessionArray) continue;

        // ❌ Không gom tiết đôi cho DaoDuc

        // ✅ Loại bỏ tiết đầu sáng Thứ 2 nếu có thể
        if (
          day === "Thứ 2" &&
          session === "morning" &&
          sessionArray[0]?.subject === "Đạo đức"
        ) {
          const moved = sessionArray.findIndex((t, idx) => idx > 0 && !t);
          if (moved !== -1) {
            sessionArray[moved] = sessionArray[0];
            sessionArray[0] = null;
          }
        }
      }
    }
  }

  const violations = checkTietPerDay_DaoDuc({ newTkb, gvList, days });
  if (violations.length > 0) {
    //console.log("⚠️ Các lớp bị xếp quá 1 tiết/ngày:");
    violations.forEach(v => {
      //console.log(`- GV ${v.gv}, lớp ${v.lop}, ngày ${v.day}: ${v.count} tiết`);
    });
  } else {
    //console.log("✅ Không có lớp nào bị xếp quá 1 tiết/ngày.");
  }
};*/}

/**
 * Gom các slot Âm nhạc theo lớp để tránh bị phân tán.
 */
{/*export const groupDaoDucByClass = ({ newTkb, gvList, assignments, days }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Đạo đức")) continue;

    const lopList = assignments[gv.id]?.["Đạo đức"] || [];

    for (const lop of lopList) {
      const slots = [];

      for (const day of days) {
        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb[gv.id][day][session];
          sessionArray.forEach((t, i) => {
            if (t?.subject === "Đạo đức" && t?.class === lop) {
              slots.push({ day, session, period: i });
            }
          });
        }
      }

      // 🔹 Gom tiết về giữa tuần nếu bị phân tán
      if (slots.length > 1) {
        const midDays = ["Thứ 3", "Thứ 4", "Thứ 5"];
        const targetDay = midDays.find(d => !slots.some(s => s.day === d));
        if (targetDay && !gv.offTimes?.[targetDay]?.["morning"]) {
          const targetSession = "morning";
          const sessionArray = newTkb[gv.id][targetDay][targetSession];
          const emptyIndex = sessionArray.findIndex(t => !t);
          if (emptyIndex !== -1) {
            const moved = slots[0];
            const movedSlot = newTkb[gv.id][moved.day][moved.session][moved.period];
            newTkb[gv.id][targetDay][targetSession][emptyIndex] = movedSlot;
            newTkb[gv.id][moved.day][moved.session][moved.period] = null;
          }
        }
      }
    }
  }
};*/}

/**
 * Gom các slot Âm nhạc về một buổi cố định nếu có thể.
 */
{/*export const regroupDaoDucSlots = ({ newTkb, gvList, assignments, days }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Đạo đức")) continue;

    const lopList = assignments[gv.id]?.["Đạo đức"] || [];

    for (const lop of lopList) {
      const slots = [];

      for (const day of days) {
        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb[gv.id][day][session];
          sessionArray.forEach((t, i) => {
            if (t?.subject === "Đạo đức" && t?.class === lop) {
              slots.push({ day, session, period: i });
            }
          });
        }
      }

      // 🔹 Gom về Thứ 4 sáng nếu có thể
      const targetDay = "Thứ 4";
      const targetSession = "morning";
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
};*/}

/**
 * Giải quyết các slot Âm nhạc còn thiếu bằng cách gán trực tiếp hoặc hoán đổi.
 */
export const resolveMissingDaoDuc = ({
  newTkb,
  gvList,
  gvSummary,
  assignments,
  globalSchedule,
  days
}) => {
  for (const gv of gvList) {
    const failedLops = gvSummary[gv.id]?.failedLops || [];
    if (!failedLops.length) continue;

    for (const lopStr of failedLops) {
      const lop = lopStr.split(" - ")[0];
      let resolved = false;

      for (const day of days) {
        const morningArr = newTkb[gv.id][day]?.morning || [];
        const afternoonArr = newTkb[gv.id][day]?.afternoon || [];

        const morningSlots = morningArr.filter(t => t?.subject === "Đạo đức" && t?.class === lop);
        const afternoonSlots = afternoonArr.filter(t => t?.subject === "Đạo đức" && t?.class === lop);

        // 🔄 Gom tiết phân tán trong ngày về một buổi
        if (morningSlots.length > 0 && afternoonSlots.length > 0) {
          const targetSession = morningSlots.length <= afternoonSlots.length ? "morning" : "afternoon";
          const sourceSession = targetSession === "morning" ? "afternoon" : "morning";

          const sourceArray = newTkb[gv.id][day][sourceSession];
          const targetArray = newTkb[gv.id][day][targetSession];

          for (let i = 0; i < sourceArray.length; i++) {
            const slot = sourceArray[i];
            if (slot?.subject === "Đạo đức" && slot.class === lop) {
              const emptyIndex = targetArray.findIndex(t => !t);
              if (emptyIndex !== -1 && !gv.offTimes?.[day]?.[targetSession]) {
                targetArray[emptyIndex] = slot;
                sourceArray[i] = null;
              }
            }
          }
        }

        // ❌ Không xử lý tiết đôi

        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb[gv.id][day][session];
          if (!sessionArray) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            const slot = sessionArray[i];

            // 🔹 Nếu slot trống → thử gán lớp thiếu vào
            if (!slot) {
              const countInDay = [...morningArr, ...afternoonArr]
                .filter(t => t?.subject === "Đạo đức" && t?.class === lop).length;
              if (countInDay >= 1) continue;

              if (!violatesConstraints({ day, session, period: i, mon: "Đạo đức", lop, gv, tkb: newTkb })) {
                assignToSlot(newTkb, globalSchedule, gv.id, lop, "Đạo đức", { day, session, period: i }, false, assignments, gvList);
                gvSummary[gv.id].assigned += 1;
                gvSummary[gv.id].failedLops = gvSummary[gv.id].failedLops.filter(l => l !== lopStr);
                resolved = true;
                break;
              }
            }

            // 🔁 Nếu slot đã có lớp khác → thử hoán đổi
            else if (slot.subject === "Đạo đức" && slot.class !== lop) {
              const otherLop = slot.class;

              for (const d2 of days) {
                //for (const s2 of ["morning", "afternoon"]) {
                for (const s2 of ["afternoon"]) {
                  if (gv.offTimes?.[d2]?.[s2]) continue;

                  const arr2 = newTkb[gv.id][d2][s2];
                  if (!arr2) continue;

                  for (let j = 0; j < arr2.length; j++) {
                    if (!arr2[j]) {
                      const countOtherInDay = [...newTkb[gv.id][d2].morning, ...newTkb[gv.id][d2].afternoon]
                        .filter(t => t?.subject === "Đạo đức" && t?.class === otherLop).length;
                      if (countOtherInDay >= 1) continue;

                      if (!violatesConstraints({ day: d2, session: s2, period: j, mon: "Đạo đức", lop: otherLop, gv, tkb: newTkb })) {
                        arr2[j] = slot;
                        sessionArray[i] = null;

                        const countNewInDay = [...morningArr, ...afternoonArr]
                          .filter(t => t?.subject === "Đạo đức" && t?.class === lop).length;
                        if (countNewInDay >= 1) continue;

                        if (!violatesConstraints({ day, session, period: i, mon: "Đạo đức", lop, gv, tkb: newTkb })) {
                          assignToSlot(newTkb, globalSchedule, gv.id, lop, "Đạo đức", { day, session, period: i }, false, assignments, gvList);
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
                if (resolved) break;
              }
            }
            if (resolved) break;
          }
          if (resolved) break;
        }
        if (resolved) break;
      }
    }
  }
};

/**
 * Tối ưu toàn bộ lịch Âm nhạc: gom slot, giải quyết slot thiếu, tránh xếp trùng.
 */
export const optimizeFullDaoDucSchedule = ({
  newTkb,
  gvList,
  assignments,
  days,
  gvSummary,
  globalSchedule
}) => {
  //optimizeDaoDucSchedule({ newTkb, gvList, assignments, days });
  //groupDaoDucByClass({ newTkb, gvList, assignments, days });
  //regroupDaoDucSlots({ newTkb, gvList, assignments, days });
  // ❌ Không gọi splitDoublePeriodsIfNeeded vì DaoDuc không có tiết đôi
  resolveMissingDaoDuc({ newTkb, gvList, gvSummary, assignments, globalSchedule, days });
};
