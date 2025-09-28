import React, { createContext, useState, useContext, useEffect } from "react";

const NewDocContext = createContext();

export const NewDocProvider = ({ children }) => {
  const [isNew, setIsNew] = useState(false); // trạng thái "Mới"

  // Log khi isNew thay đổi
  useEffect(() => {
    //console.log("🟢 [NewDocContext] isNew =", isNew);
  }, [isNew]);

  // Hàm gọi khi bấm nút Mới
  const createNewDoc = () => {
    //console.log("➡️ createNewDoc() được gọi");
    setIsNew(true);
  };

  // Sau khi các trang reset xong, gọi reset
  const resetNewDoc = () => {
    //console.log("➡️ resetNewDoc() được gọi");
    setIsNew(false);
  };

  return (
    <NewDocContext.Provider value={{ isNew, createNewDoc, resetNewDoc }}>
      {children}
    </NewDocContext.Provider>
  );
};

export const useNewDoc = () => useContext(NewDocContext);
