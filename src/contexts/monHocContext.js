// monHocContext.js
import { doc, getDoc } from "firebase/firestore";

export const monHocContext = {
  K1: [],
  K2: [],
  K3: [],
  K4: [],
  K5: [],
  MON: []
};

export async function loadMonHocContext(db) {
  const khoiDocs = ["K1", "K2", "K3", "K4", "K5"];
  
  for (const khoi of khoiDocs) {
    const docRef = doc(db, "MONHOC_2025-2026", khoi);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {   // ✅ exists() là hàm
      monHocContext[khoi] = docSnap.data().monHoc || [];
    }
  }

  const monDocRef = doc(db, "MONHOC_2025-2026", "MON");
  const monDocSnap = await getDoc(monDocRef);
  if (monDocSnap.exists()) {
    monHocContext.MON = monDocSnap.data().monHoc || [];
  }
}
