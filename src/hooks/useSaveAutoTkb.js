// src/hooks/useSaveAutoTkb.jsx
import { useState } from "react";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { useSchedule } from "../contexts/ScheduleContext";
import { useOpenFile } from "../contexts/OpenFileContext";

// Chuyển Map hoặc object sang plain object
const mapToObject = (map) => {
  if (!map) return {};
  if (map instanceof Map) return Object.fromEntries(map);
  if (typeof map === "object") return map;
  return {};
};

// Chuẩn hóa dữ liệu TKB
const normalizeTkbData = (tkbAllTeachers) => {
  const teachersObj = mapToObject(tkbAllTeachers);
  const tkbToSave = {};

  Object.entries(teachersObj).forEach(([key, value]) => {
    const teacherData = mapToObject(value);

    // Giáo viên trực tiếp
    const isTeacherDirect = teacherData.morning || teacherData.afternoon;
    if (isTeacherDirect) {
      const normalizeDay = (arr, len) => {
        const slots = Array(len).fill(null);
        if (Array.isArray(arr)) {
          arr.forEach((item) => {
            if (item && typeof item.period === "number" && item.period >= 1 && item.period <= len) {
              slots[item.period - 1] = item;
            }
          });
        }
        return slots;
      };

      tkbToSave[key] = {
        morning: normalizeDay(teacherData.morning, 5),
        afternoon: normalizeDay(teacherData.afternoon, 4),
      };
      return;
    }

    // Nested object (ví dụ TKB áp dụng ngày cụ thể)
    Object.entries(teacherData).forEach(([teacher, days]) => {
      const normalizedTeacherData = {};
      const dayDataObj = mapToObject(days);

      Object.entries(dayDataObj).forEach(([day, dayData]) => {
        const dayObj = mapToObject(dayData);

        const normalizeDay = (arr, len) => {
          const slots = Array(len).fill(null);
          if (Array.isArray(arr)) {
            arr.forEach((item) => {
              if (item && typeof item.period === "number" && item.period >= 1 && item.period <= len) {
                slots[item.period - 1] = item;
              }
            });
          }
          return slots;
        };

        const morning = normalizeDay(dayObj.morning || [], 5);
        const afternoon = normalizeDay(dayObj.afternoon || [], 4);

        if (morning.some((x) => x !== null) || afternoon.some((x) => x !== null)) {
          normalizedTeacherData[day] = { morning, afternoon };
        }
      });

      if (Object.keys(normalizedTeacherData).length > 0) {
        tkbToSave[teacher] = normalizedTeacherData;
      }
    });
  });

  return tkbToSave;
};

export const useSaveAutoTkb = () => {
  const { tkbAllTeachers, setTkbAllTeachers, setCurrentDocId } = useSchedule();
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const { setOpenFileName } = useOpenFile();

  const saveAutoTkb = async (docId) => {
    if (!docId || typeof docId !== "string") {
      alert("⚠️ Tên tệp không hợp lệ!");
      return;
    }

    if (!tkbAllTeachers || Object.keys(tkbAllTeachers).length === 0) {
      alert("⚠️ Không có dữ liệu để lưu!");
      return;
    }

    try {
      setSaving(true);
      setSaveProgress(0);

      const tkbToSave = normalizeTkbData(tkbAllTeachers);

      if (!Object.keys(tkbToSave).length) {
        alert("⚠️ Không có dữ liệu hợp lệ để lưu!");
        return;
      }

      // Mô phỏng tiến trình lưu
      const steps = 3;
      for (let i = 1; i <= steps; i++) {
        await new Promise((res) => setTimeout(res, 200));
        setSaveProgress(Math.round((i / steps) * 100));
      }

      // Lưu Firestore
      const docRef = doc(collection(db, "TKB_GVBM"), docId);
      await setDoc(docRef, { tkb: tkbToSave, updatedAt: new Date() });

      setCurrentDocId(docId);
      setTkbAllTeachers({ [docId]: tkbToSave });
      setOpenFileName(docId);

      //console.log(`✅ Đã lưu TKB xếp tự động: ${docId}`);
    } catch (error) {
      console.error("❌ Lỗi khi lưu TKB xếp tự động:", error);
      alert("❌ Lưu thất bại. Xem console để biết chi tiết.");
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  return { saveAutoTkb, saving, saveProgress };
};
