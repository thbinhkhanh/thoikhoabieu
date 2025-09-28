import React, { createContext, useState, useContext, useEffect } from "react";

const OpenFileContext = createContext();

export const OpenFileProvider = ({ children }) => {
  const [openFileName, setOpenFileName] = useState("");

  // 🔹 Log mỗi khi openFileName thay đổi
  useEffect(() => {
    if (openFileName) {
      //console.log("📝 OpenFileContext - openFileName:", openFileName);
    }
  }, [openFileName]);

  return (
    <OpenFileContext.Provider value={{ openFileName, setOpenFileName }}>
      {children}
    </OpenFileContext.Provider>
  );
};

export const useOpenFile = () => {
  const context = useContext(OpenFileContext);
  if (!context) throw new Error("useOpenFile must be used within OpenFileProvider");
  return context;
};
