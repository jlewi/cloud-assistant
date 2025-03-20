// src/components/ui/button.tsx
import React from "react";

export const Button = ({ children, ...props }) => {
  return (
    <button
      {...props}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-4 rounded"
    >
      {children}
    </button>
  );
};
