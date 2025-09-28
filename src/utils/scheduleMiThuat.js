// scheduleMiThuat.js
import { violatesConstraints, assignToSlot } from './autoScheduleUtils';

export const scheduleMiThuat = ({
  gvList = [],
  newTkb,
  globalSchedule,
  phanCongGVs,
  assignments,
  gvSummary,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Mĩ thuật")) continue;

    const lopList = assignments[gv.id]?.["Mĩ thuật"] || [];
    if (!lopList.length) continue;

    const remainingMap = {};
    lopList.forEach(lop => {
      remainingMap[lop] = phanCongGVs[gv.id]?.["Mĩ thuật"]?.[lop] || 0;
    });

    let A = [...lopList.filter(lop => remainingMap[lop] > 0)];
    const allowedSessions = ["afternoon", "morning"];

    for (const day of days) {
      for (const session of allowedSessions) {
        const sessionArray = newTkb[gv.id][day][session];
        if (!Array.isArray(sessionArray)) continue;

        for (let i = 0; i < sessionArray.length; i++) {
          if (sessionArray[i]) continue;

          const candidates = A.filter(lop =>
            remainingMap[lop] > 0 &&
            countClassInDay(newTkb, gv.id, day, lop, "Mĩ thuật") < 1 &&
            !violatesConstraints({ day, session, period: i, mon: "Mĩ thuật", lop, gv, tkb: newTkb })
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
              subject: "Mĩ thuật",
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

    // 👉 Thêm gọi hàm hoán đổi nâng cao nếu còn lớp chưa xếp đủ tiết
    if (Object.values(remainingMap).some(r => r > 0)) {
      restructureMiThuatSchedule({
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

  // Vòng hoán đổi nâng cao để cố gắng xếp nốt các lớp còn thiếu
  let overallProgress = true;
  while (overallProgress) {
    overallProgress = false;

    for (const gv of gvList) {
      if (!gv.monDay.includes("Mĩ thuật")) continue;
      if (!gvSummary[gv.id]?.failedLops || gvSummary[gv.id].failedLops.length === 0) continue;

      const didProgress = performAdvancedSwapsForGV({
        gv,
        tkb: newTkb,
        globalSchedule,
        assignments,
        teachers: gvList,
        days,
        gvSummary,
        mon: "Mĩ thuật"
      });

      if (didProgress) overallProgress = true;
    }
  }

  // Gọi lại hoán đổi nhiều lần để thử xếp nốt các lớp còn thiếu
  for (let retry = 0; retry < 5; retry++) {
    let retryProgress = false;

    for (const gv of gvList) {
      if (!gv.monDay.includes("Mĩ thuật")) continue;
      if (!gvSummary[gv.id]?.failedLops || gvSummary[gv.id].failedLops.length === 0) continue;

      const didProgress = performAdvancedSwapsForGV({
        gv,
        tkb: newTkb,
        globalSchedule,
        assignments,
        teachers: gvList,
        days,
        gvSummary,
        mon: "Mĩ thuật"
      });

      if (didProgress) {
        retryProgress = true;
        //console.log(`✅ Hoán đổi bổ sung lần ${retry + 1} cho GV ${gv.name}`);
      }
    }

    if (!retryProgress) break;
  }

  // Kết thúc: newTkb và globalSchedule đã được cập nhật
};

function restructureMiThuatSchedule({ newTkb, gv, remainingMap, lopList, assignments, gvList, globalSchedule, days }) {
  const sessionOrder = ["afternoon", "morning"];

  for (const day of days) {
    for (const session of sessionOrder) {
      const sessionArray = newTkb[gv.id][day][session];
      if (!Array.isArray(sessionArray)) continue;

      for (let i = 0; i < sessionArray.length; i++) {
        if (sessionArray[i]) continue;

        let moved = false;

        for (const srcSession of ["morning", "afternoon"]) {
          const srcArray = newTkb[gv.id][day][srcSession];
          if (!Array.isArray(srcArray)) continue;

          for (let j = 0; j < srcArray.length; j++) {
            const slot = srcArray[j];
            if (!slot || slot.subject !== "Mĩ thuật") continue;

            const canMove = !violatesConstraints({
              day,
              session,
              period: i,
              mon: "Mĩ thuật",
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
                countClassInDay(newTkb, gv.id, day, lop, "Mĩ thuật") < 1 &&
                !violatesConstraints({
                  day,
                  session: srcSession,
                  period: j,
                  mon: "Mĩ thuật",
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
                  subject: "Mĩ thuật",
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

const countClassInDay = (tkb, gvId, day, lop, mon) => {
  const sessionKeys = ["morning", "afternoon"];
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

export const countClassInDayMiThuat = (tkb, gvId, day, className, subject = "Mĩ thuật") => {
  const dayObj = tkb[gvId]?.[day];
  if (!dayObj) return 0;
  return [...(dayObj.morning || []), ...(dayObj.afternoon || [])]
    .filter(t => t && t.subject === subject && t.class === className).length;
};

export const tryPlaceSingleAt = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lop,
  subject = "Mĩ thuật",
  assignments,
  teachers
}) => {
  const sessionArray = tkb[gvId]?.[day]?.[session];
  if (!Array.isArray(sessionArray)) return false;
  if (period < 0 || period >= sessionArray.length) return false;
  if (sessionArray[period]) return false;

  if (violatesConstraints({ day, session, period, mon: subject, lop, gv: { id: gvId }, tkb })) return false;

  const countInDay = countClassInDayMiThuat(tkb, gvId, day, lop, subject);
  if (countInDay + 1 > 1) return false;

  const ok = assignToSlot(tkb, globalSchedule, gvId, lop, subject, { day, session, period }, false, assignments, teachers);
  return !!ok;
};

export const fillSessionForGV = ({
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
          .filter(lop => countClassInDayMiThuat(tkb, gvId, day, lop) < 1)
          .filter(lop => !violatesConstraints({
            day,
            session,
            period: i,
            mon: "Mĩ thuật",
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

export const recordRemaining = ({ gv, remainingMap, gvSummary }) => {
  const gvId = gv.id;
  if (!gvSummary[gvId].failedLops) gvSummary[gvId].failedLops = [];

  Object.entries(remainingMap).forEach(([lop, remaining]) => {
    if (remaining > 0) {
      const tag = `${lop} - Mĩ thuật`;
      if (!gvSummary[gvId].failedLops.includes(tag)) {
        gvSummary[gvId].failedLops.push(tag);
      }
    }
  });
};

export const tryMoveOneSlot_MiThuat = ({
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
  if (!slot || slot.subject !== "Mĩ thuật") return false;

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
          !violatesConstraints({ day, session, period, mon: "Mĩ thuật", lop: lopMissing, gv: { id: gvId }, tkb }) &&
          countClassInDayMiThuat(tkb, gvId, day, lopMissing) < 1;

        const countOtherInD2 = countClassInDayMiThuat(tkb, gvId, d2, otherLop);
        const canPlaceOtherThere =
          !violatesConstraints({ day: d2, session: s2, period: j, mon: "Mĩ thuật", lop: otherLop, gv: { id: gvId }, tkb }) &&
          countOtherInD2 + (d2 === day ? 0 : 1) <= 1;

        if (canPlaceMissingHere && canPlaceOtherThere) {
          arr2[j] = { subject: "Mĩ thuật", class: otherLop };
          sessionArray[period] = { subject: "Mĩ thuật", class: lopMissing };

          assignToSlot(tkb, globalSchedule, gvId, otherLop, "Mĩ thuật", { day: d2, session: s2, period: j }, false, assignments, teachers);
          assignToSlot(tkb, globalSchedule, gvId, lopMissing, "Mĩ thuật", { day, session, period }, false, assignments, teachers);

          gvSummary[gvId].assigned += 1;
          return true;
        }
      }
    }
  }

  return false;
};

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
            if (!slot || slot.subject !== "Mĩ thuật" || slot.class === lopMissing) continue;

            const moved = tryMoveOneSlot_MiThuat({
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

            // ❌ Không xử lý tiết đôi cho Mĩ thuật
          }
          if (resolved) break;
        }
        if (resolved) break;
      }
    }
  }

  return progress;
};

export const finalFillMissingPeriods_MiThuat = ({
  gvList = [],
  newTkb,
  globalSchedule,
  assignments,
  gvSummary,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Mĩ thuật")) continue;

    const failedLops = gvSummary[gv.id]?.failedLops || [];
    if (failedLops.length === 0) continue;

    const allowedSessions = ["morning", "afternoon"];

    for (const lopStr of failedLops) {
      const lop = lopStr.split(" - ")[0];
      const totalNeeded = assignments[gv.id]?.["Mĩ thuật"]?.filter(l => l === lop).length || 0;

      let alreadyAssigned = [...days].reduce((sum, day) => {
        return sum + ["morning", "afternoon"].reduce((s, session) => {
          return s + newTkb[gv.id][day][session].filter(t => t?.subject === "Mĩ thuật" && t?.class === lop).length;
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
                .filter(t => t?.subject === "Mĩ thuật" && t?.class === lop).length;
              if (countInDay >= 1) continue;

              if (!violatesConstraints({ day, session, period: i, mon: "Mĩ thuật", lop, gv, tkb: newTkb })) {
                assignToSlot(newTkb, globalSchedule, gv.id, lop, "Mĩ thuật", { day, session, period: i }, false, assignments, gvList);
                gvSummary[gv.id].assigned += 1;
                remaining -= 1;
                continue;
              }
            }

            // ❌ Không xử lý tiết đôi cho Mĩ thuật

            // 🔁 Nếu slot đã có lớp khác → thử hoán đổi
            if (slot?.subject === "Mĩ thuật" && slot.class !== lop) {
              const otherLop = slot.class;

              for (const d2 of days) {
                for (const s2 of allowedSessions) {
                  if (gv.offTimes?.[d2]?.[s2]) continue;

                  const arr2 = newTkb[gv.id][d2][s2];
                  if (!arr2) continue;

                  for (let j = 0; j < arr2.length; j++) {
                    if (arr2[j]) continue;

                    const countOtherInDay = [...newTkb[gv.id][d2].morning, ...newTkb[gv.id][d2].afternoon]
                      .filter(t => t?.subject === "Mĩ thuật" && t?.class === otherLop).length;
                    if (countOtherInDay >= 1) continue;

                    if (!violatesConstraints({ day: d2, session: s2, period: j, mon: "Mĩ thuật", lop: otherLop, gv, tkb: newTkb })) {
                      arr2[j] = slot;
                      sessionArray[i] = null;

                      const countNewInDay = [...newTkb[gv.id][day].morning, ...newTkb[gv.id][day].afternoon]
                        .filter(t => t?.subject === "Mĩ thuật" && t?.class === lop).length;
                      if (countNewInDay >= 1) continue;

                      if (!violatesConstraints({ day, session, period: i, mon: "Mĩ thuật", lop, gv, tkb: newTkb })) {
                        assignToSlot(newTkb, globalSchedule, gv.id, lop, "Mĩ thuật", { day, session, period: i }, false, assignments, gvList);
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
    for (const s2 of ["morning", "afternoon"]) {
      const arr2 = newTkb[gv.id][d2][s2];
      if (!arr2) continue;

      for (let k = 0; k < arr2.length; k++) {
        const current = arr2[k];
        if (!current || current.subject !== "Mĩ thuật" || current.class === lop) continue;

        if (!violatesConstraints({ day, session, period, mon: "Mĩ thuật", lop: current.class, gv, tkb: newTkb })) {
          sessionArray[period] = current;
          arr2[k] = null;

          if (!violatesConstraints({ day: d2, session: s2, period: k, mon: "Mĩ thuật", lop, gv, tkb: newTkb })) {
            assignToSlot(newTkb, globalSchedule, gv.id, lop, "Mĩ thuật", { day: d2, session: s2, period: k }, false, assignments, gvList);
            return true;
          }

          arr2[k] = current;
          sessionArray[period] = null;
        }
      }
    }
  }

  return false;
};

export const checkTietPerDay_MiThuat = ({ newTkb, gvList, days }) => {
  const violations = [];

  for (const gv of gvList) {
    for (const day of days) {
      const lopCount = {};

      for (const session of ["morning", "afternoon"]) {
        const arr = newTkb[gv.id][day][session];
        if (!arr) continue;

        for (const t of arr) {
          if (t?.subject === "Mĩ thuật") {
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

export const optimizeMiThuatSchedule = ({
  newTkb,
  gvList,
  assignments,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Mĩ thuật")) continue;

    const lopList = assignments[gv.id]?.["Mĩ thuật"] || [];

    for (const day of days) {
      for (const session of ["morning", "afternoon"]) {
        if (gv.offTimes?.[day]?.[session]) continue;

        const sessionArray = newTkb[gv.id][day][session];
        if (!sessionArray) continue;

        // ❌ Không gom tiết đôi cho Mĩ thuật

        // ✅ Loại bỏ tiết đầu sáng Thứ 2 nếu có thể
        if (
          day === "Thứ 2" &&
          session === "morning" &&
          sessionArray[0]?.subject === "Mĩ thuật"
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

  const violations = checkTietPerDay_MiThuat({ newTkb, gvList, days });
  if (violations.length > 0) {
    //console.log("⚠️ Các lớp bị xếp quá 1 tiết/ngày:");
    violations.forEach(v => {
      //console.log(`- GV ${v.gv}, lớp ${v.lop}, ngày ${v.day}: ${v.count} tiết`);
    });
  } else {
    //console.log("✅ Không có lớp nào bị xếp quá 1 tiết/ngày.");
  }
};

export const groupMiThuatByClass = ({ newTkb, gvList, assignments, days }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Mĩ thuật")) continue;

    const lopList = assignments[gv.id]?.["Mĩ thuật"] || [];

    for (const lop of lopList) {
      const slots = [];

      for (const day of days) {
        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb[gv.id][day][session];
          sessionArray.forEach((t, i) => {
            if (t?.subject === "Mĩ thuật" && t?.class === lop) {
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
};

export const regroupMiThuatSlots = ({ newTkb, gvList, assignments, days }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Mĩ thuật")) continue;

    const lopList = assignments[gv.id]?.["Mĩ thuật"] || [];

    for (const lop of lopList) {
      const slots = [];

      for (const day of days) {
        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb[gv.id][day][session];
          sessionArray.forEach((t, i) => {
            if (t?.subject === "Mĩ thuật" && t?.class === lop) {
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
};

export const resolveMissingMiThuat = ({
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

        const morningSlots = morningArr.filter(t => t?.subject === "Mĩ thuật" && t?.class === lop);
        const afternoonSlots = afternoonArr.filter(t => t?.subject === "Mĩ thuật" && t?.class === lop);

        // 🔄 Gom tiết phân tán trong ngày về một buổi
        if (morningSlots.length > 0 && afternoonSlots.length > 0) {
          const targetSession = morningSlots.length <= afternoonSlots.length ? "morning" : "afternoon";
          const sourceSession = targetSession === "morning" ? "afternoon" : "morning";

          const sourceArray = newTkb[gv.id][day][sourceSession];
          const targetArray = newTkb[gv.id][day][targetSession];

          for (let i = 0; i < sourceArray.length; i++) {
            const slot = sourceArray[i];
            if (slot?.subject === "Mĩ thuật" && slot.class === lop) {
              const emptyIndex = targetArray.findIndex(t => !t);
              if (emptyIndex !== -1 && !gv.offTimes?.[day]?.[targetSession]) {
                targetArray[emptyIndex] = slot;
                sourceArray[i] = null;
              }
            }
          }
        }

        // ❌ Không xử lý tiết đôi → bỏ logic hoán đổi để tạo tiết đôi

        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb[gv.id][day][session];
          if (!sessionArray) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            const slot = sessionArray[i];

            // 🔹 Nếu slot trống → thử gán lớp thiếu vào
            if (!slot) {
              const countInDay = [...morningArr, ...afternoonArr]
                .filter(t => t?.subject === "Mĩ thuật" && t?.class === lop).length;
              if (countInDay >= 1) continue;

              if (!violatesConstraints({ day, session, period: i, mon: "Mĩ thuật", lop, gv, tkb: newTkb })) {
                assignToSlot(newTkb, globalSchedule, gv.id, lop, "Mĩ thuật", { day, session, period: i }, false, assignments, gvList);
                gvSummary[gv.id].assigned += 1;
                gvSummary[gv.id].failedLops = gvSummary[gv.id].failedLops.filter(l => l !== lopStr);
                resolved = true;
                break;
              }
            }

            // 🔁 Nếu slot đã có lớp khác → thử hoán đổi
            else if (slot.subject === "Mĩ thuật" && slot.class !== lop) {
              const otherLop = slot.class;

              for (const d2 of days) {
                for (const s2 of ["morning", "afternoon"]) {
                  if (gv.offTimes?.[d2]?.[s2]) continue;

                  const arr2 = newTkb[gv.id][d2][s2];
                  if (!arr2) continue;

                  for (let j = 0; j < arr2.length; j++) {
                    if (!arr2[j]) {
                      const countOtherInDay = [...newTkb[gv.id][d2].morning, ...newTkb[gv.id][d2].afternoon]
                        .filter(t => t?.subject === "Mĩ thuật" && t?.class === otherLop).length;
                      if (countOtherInDay >= 1) continue;

                      if (!violatesConstraints({ day: d2, session: s2, period: j, mon: "Mĩ thuật", lop: otherLop, gv, tkb: newTkb })) {
                        arr2[j] = slot;
                        sessionArray[i] = null;

                        const countNewInDay = [...morningArr, ...afternoonArr]
                          .filter(t => t?.subject === "Mĩ thuật" && t?.class === lop).length;
                        if (countNewInDay >= 1) continue;

                        if (!violatesConstraints({ day, session, period: i, mon: "Mĩ thuật", lop, gv, tkb: newTkb })) {
                          assignToSlot(newTkb, globalSchedule, gv.id, lop, "Mĩ thuật", { day, session, period: i }, false, assignments, gvList);
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

export const optimizeFullMiThuatSchedule = ({ newTkb, gvList, assignments, days, gvSummary, globalSchedule }) => {
  optimizeMiThuatSchedule({ newTkb, gvList, assignments, days });
  groupMiThuatByClass({ newTkb, gvList, assignments, days });
  regroupMiThuatSlots({ newTkb, gvList, assignments, days });
  // ❌ Không gọi splitDoublePeriodsIfNeeded vì Mĩ thuật không có tiết đôi
  resolveMissingMiThuat({ newTkb, gvList, gvSummary, assignments, globalSchedule, days });
};