import React, { useState } from "react";
import { Card, CardContent, Typography, Button } from "@mui/material";

const CheckScheduleCard = ({ tkb, formatGVName }) => {
  const [errors, setErrors] = useState([]);

  const handleCheck = () => {
    const errorsMap = {};
    for (const gvId in tkb) {
      for (const day of Object.keys(tkb[gvId])) {
        for (const session of ["morning", "afternoon"]) {
          const periods = tkb[gvId][day][session];
          if (!periods) continue;
          periods.forEach((tiet, idx) => {
            if (!tiet) return;
            const lop = tiet.class;
            const mon = tiet.subject;
            const key = `${day}|${session}|${idx}|${lop}`;
            if (!errorsMap[key]) errorsMap[key] = [];
            errorsMap[key].push({ gvName: formatGVName(gvId), subject: mon });
          });
        }
      }
    }

    const errorMessages = [];
    for (const key in errorsMap) {
      const arr = errorsMap[key];
      if (arr.length <= 1) continue;
      const [day, session, idx, lop] = key.split("|");
      const periodNumber = Number(idx) + 1;
      const sessionLabel = session === "morning" ? "sáng" : "chiều";
      let msg = `Lớp ${lop} (${sessionLabel} ${day}, tiết ${periodNumber}) có ${arr.length} GV cùng dạy:\n`;
      arr.forEach((gv) => {
        msg += `    - ${gv.gvName} (${gv.subject})\n`;
      });
      errorMessages.push(msg.trim());
    }

    setErrors(errorMessages);
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
      <div>
        <Button variant="contained" color="primary" onClick={handleCheck}>
          Kiểm tra trùng tiết
        </Button>
        {errors.length > 0 && (
          <Card style={{ marginTop: 20, minWidth: 400, textAlign: "left" }}>
            <CardContent>
              <Typography variant="h6" color="error">
                Phát hiện trùng tiết:
              </Typography>
              {errors.map((err, idx) => (
                <Typography key={idx} style={{ whiteSpace: "pre-line", marginTop: 10 }}>
                  {err}
                </Typography>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CheckScheduleCard;
