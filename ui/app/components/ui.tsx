import React from "react";
import "./ui.module.css";

export const Button = ({ children, className = "", ...props }) => {
  return (
    <button className={`ui-button ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Card = ({ children, className = "" }) => {
  return <div className={`ui-card ${className}`}>{children}</div>;
};

export const CardContent = ({ children, className = "" }) => {
  return <div className={`ui-card-content ${className}`}>{children}</div>;
};
